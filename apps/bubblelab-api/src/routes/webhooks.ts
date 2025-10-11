import { OpenAPIHono, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import { webhooks } from '../db/schema.js';
import {
  slackUrlVerificationSchema,
  webhookResponseSchema,
} from '../schemas/index.js';
import { webhookRoute, webhookStreamRoute } from '../schemas/routes.js';
import {
  executeBubbleFlowViaWebhook,
  executeBubbleFlowWithLiveStreaming,
} from '../services/bubble-flow-execution.js';
import { eq } from 'drizzle-orm';
import type {
  BubbleTriggerEventRegistry,
  SlackEventWrapper,
  SlackAppMentionEvent,
  SlackMessageEvent,
} from '@bubblelab/bubble-core';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

/**
 * Transforms raw webhook payload into the appropriate BubbleTriggerEvent structure
 * based on the event type. This ensures the payload matches the expected interface
 * for each specific event type.
 */
function transformWebhookPayload(
  eventType: keyof BubbleTriggerEventRegistry,
  rawBody: unknown,
  path: string,
  method: string,
  headers: Record<string, string>
): BubbleTriggerEventRegistry[keyof BubbleTriggerEventRegistry] {
  const basePayload = {
    type: eventType,
    timestamp: new Date().toISOString(),
    path,
    body: rawBody, // Always include the original body for compatibility
  };

  switch (eventType) {
    case 'slack/bot_mentioned': {
      // Transform Slack app_mention event
      const slackBody = rawBody as SlackEventWrapper;
      const event = slackBody.event as SlackAppMentionEvent;

      const result: BubbleTriggerEventRegistry['slack/bot_mentioned'] = {
        ...basePayload,
        slack_event: slackBody,
        channel: event?.channel,
        user: event?.user,
        text: event?.text,
        thread_ts: event?.thread_ts,
      };
      return result;
    }

    case 'slack/message_received': {
      // Transform Slack message event
      const slackBody = rawBody as SlackEventWrapper;
      const event = slackBody.event as SlackMessageEvent;

      return {
        ...basePayload,
        slack_event: slackBody,
        channel: event?.channel,
        user: event?.user,
        text: event?.text,
        channel_type: event?.channel_type,
        subtype: event?.subtype,
      };
    }

    case 'gmail/email_received': {
      // For Gmail events, we expect the email data in the body
      const emailBody = rawBody as { email: string };
      return {
        ...basePayload,
        email: emailBody.email,
      };
    }

    case 'schedule/cron/daily': {
      // For cron events, we might have cron-specific data
      const cronBody = rawBody as { cron?: string };
      return {
        ...basePayload,
        cron: cronBody.cron || '0 0 * * *', // Default to daily at midnight
      };
    }

    case 'webhook/http': {
      // For generic webhook events, pass through the entire payload
      return {
        ...basePayload,
        method,
        headers,
        body: rawBody as Record<string, unknown>,
      };
    }

    default:
      // Fallback for unknown event types
      return {
        ...basePayload,
        method,
        headers,
        body: rawBody as Record<string, unknown>,
      } as BubbleTriggerEventRegistry[keyof BubbleTriggerEventRegistry] & {
        body: unknown;
      };
  }
}

app.openapi(webhookRoute, async (c) => {
  const userId = c.req.param('userId');
  const path = c.req.param('path');

  // Parse request body once
  const requestBody =
    c.req.method !== 'GET' ? await c.req.json().catch(() => ({})) : {};

  // Check if this is a Slack URL verification request
  const urlVerification = slackUrlVerificationSchema.safeParse(requestBody);
  if (urlVerification.success) {
    console.log(`🔗 Slack URL verification for webhook: ${userId}/${path}`);

    // Activate the webhook if it exists but isn't active
    const webhook = await db.query.webhooks.findFirst({
      where: (webhooks, { eq, and }) =>
        and(eq(webhooks.userId, userId), eq(webhooks.path, path)),
    });

    if (webhook && !webhook.isActive) {
      console.log(`🟢 Activating webhook: ${userId}/${path}`);
      await db
        .update(webhooks)
        .set({ isActive: true })
        .where(eq(webhooks.id, webhook.id));
    }

    // Respond with the challenge as required by Slack
    const verificationResponse: z.infer<typeof webhookResponseSchema> = {
      challenge: urlVerification.data.challenge,
    };
    return c.json(verificationResponse, 200);
  }

  // Find the webhook by userId and path for normal processing
  const webhook = await db.query.webhooks.findFirst({
    where: (webhooks, { eq, and }) =>
      and(eq(webhooks.userId, userId), eq(webhooks.path, path)),
    with: {
      bubbleFlow: true,
    },
  });

  if (!webhook) {
    return c.json(
      {
        error: 'Webhook not found',
        details: `No webhook found for path: /webhook/${userId}/${path}`,
      },
      404
    );
  }

  if (!webhook.isActive) {
    return c.json(
      {
        error: 'Webhook inactive',
        details: `Webhook for path '${path}' is not active`,
      },
      403
    );
  }

  // Transform the webhook payload into the appropriate event structure
  const webhookPayload = transformWebhookPayload(
    webhook.bubbleFlow.eventType as keyof BubbleTriggerEventRegistry,
    requestBody,
    `/webhook/${userId}/${path}`,
    c.req.method,
    c.req.header()
  );

  console.log(
    `🔗 Webhook triggered: ${userId}/${path} -> BubbleFlow ID ${webhook.bubbleFlowId}`
  );
  console.log(`📦 Event type: ${webhook.bubbleFlow.eventType}`);
  console.log(`📦 Original body keys: ${Object.keys(requestBody).join(', ')}`);
  console.log(
    `📦 Transformed payload keys: ${Object.keys(webhookPayload).join(', ')}`
  );
  console.log(
    `📦 Transformed payload: ${JSON.stringify(webhookPayload, null, 2)}`
  );

  // For Slack events, return 200 immediately and process asynchronously
  const isSlackEvent = webhook.bubbleFlow.eventType.startsWith('slack/');

  if (isSlackEvent) {
    // Execute the flow asynchronously (don't await)
    executeBubbleFlowViaWebhook(webhook.bubbleFlowId, webhookPayload, {
      userId,
    })
      .then((result) => {
        console.log(
          `✅ Slack event processed asynchronously for ${userId}/${path}:`,
          result.success ? 'Success' : `Failed - ${result.error}`
        );
      })
      .catch((error) => {
        console.error(
          `❌ Error processing Slack event for ${userId}/${path}:`,
          error
        );
      });

    // Return immediate 200 response for Slack
    return c.json({}, 200);
  }

  // For non-Slack events, wait for execution to complete
  const result = await executeBubbleFlowViaWebhook(
    webhook.bubbleFlowId,
    webhookPayload,
    { userId }
  );

  // Return execution result with webhook metadata
  const response: z.infer<typeof webhookResponseSchema> = {
    ...result,
    data: result.data as Record<string, unknown> | undefined,
    webhook: {
      userId,
      path,
      triggeredAt: webhookPayload.timestamp,
      method: c.req.method,
    },
  };

  return c.json(response, 200);
});

app.openapi(webhookStreamRoute, async (c) => {
  const userId = c.req.param('userId');
  const path = c.req.param('path');

  // Parse request body once
  const requestBody =
    c.req.method !== 'GET' ? await c.req.json().catch(() => ({})) : {};

  // Find the webhook by userId and path (same logic as the regular webhook route)
  const webhook = await db.query.webhooks.findFirst({
    where: (webhooks, { eq, and }) =>
      and(eq(webhooks.userId, userId), eq(webhooks.path, path)),
    with: {
      bubbleFlow: true,
    },
  });

  if (!webhook) {
    return c.json(
      {
        error: 'Webhook not found',
        details: `No webhook found for path: /webhook/${userId}/${path}`,
      },
      404
    );
  }

  try {
    return streamSSE(c, async (stream) => {
      try {
        await executeBubbleFlowWithLiveStreaming(
          webhook.bubbleFlowId,
          requestBody,
          {
            userId: webhook.userId,
            streamCallback: async (event) => {
              await stream.writeSSE({
                data: JSON.stringify(event),
                event: event.type,
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              });
            },
          }
        );

        // Send stream completion
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'stream_complete',
            timestamp: new Date().toISOString(),
          }),
          event: 'stream_complete',
        });
      } catch (error) {
        console.error('[API] Webhook streaming execution error:', error);
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unknown streaming error',
            recoverable: false,
          }),
          event: 'error',
        });
      }
    });
  } catch (error) {
    // Return 404 for "BubbleFlow not found" errors
    if (
      error instanceof Error &&
      (error.message === 'BubbleFlow not found' ||
        error.message ===
          'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.')
    ) {
      return c.json({ error: 'BubbleFlow not found' }, 404);
    }
    throw error; // Let global error handler deal with other errors
  }
});

export default app;
