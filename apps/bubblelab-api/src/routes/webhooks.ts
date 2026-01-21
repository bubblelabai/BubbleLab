import { OpenAPIHono, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import { webhooks } from '../db/schema.js';
import { getPricingTable } from '../config/pricing.js';
import {
  slackUrlVerificationSchema,
  webhookResponseSchema,
} from '../schemas/index.js';
import {
  webhookRoute,
  webhookStreamRoute,
  webhookTestRoute,
} from '../schemas/webhooks.js';
import {
  executeBubbleFlowViaWebhook,
  executeBubbleFlowWithTracking,
} from '../services/bubble-flow-execution.js';
import { eq } from 'drizzle-orm';
import type { BubbleTriggerEventRegistry } from '@bubblelab/shared-schemas';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import {
  transformWebhookPayload,
  shouldSkipSlackEvent,
} from '../utils/payload-transformer.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

// Handle non-POST methods for webhook endpoint
app.on(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/:userId/:path', (c) => {
  const method = c.req.method;
  return c.json(
    {
      error: 'Method not allowed',
      details: `This webhook only accepts POST requests. Received: ${method}`,
      hint: 'Use POST method to trigger this webhook',
      webhookUrl: c.req.url,
    },
    405
  );
});

app.openapi(webhookRoute, async (c) => {
  const userId = c.req.param('userId');
  const path = c.req.param('path');

  // Parse request body once
  const requestBody = await c.req.json().catch(() => ({}));

  // Check if this is a Slack URL verification request
  const urlVerification = slackUrlVerificationSchema.safeParse(requestBody);
  if (urlVerification.success) {
    // Activate the webhook if it exists but isn't active
    const webhookForActivation = await db.query.webhooks.findFirst({
      where: (webhooks, { eq, and }) =>
        and(eq(webhooks.userId, userId), eq(webhooks.path, path)),
    });

    if (webhookForActivation && !webhookForActivation.isActive) {
      await db
        .update(webhooks)
        .set({ isActive: true })
        .where(eq(webhooks.id, webhookForActivation.id));
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
        details: `Webhook for path '${path}' is not active, please activate it via the toggle on Bubble Studio on the flow page.`,
      },
      403
    );
  }

  // Transform the webhook payload into the appropriate event structure
  const transformedPayload = transformWebhookPayload(
    webhook.bubbleFlow.eventType as keyof BubbleTriggerEventRegistry,
    requestBody,
    `/webhook/${userId}/${path}`,
    c.req.method,
    c.req.header()
  );

  // Merge defaultInputs from the flow (similar to cron behavior)
  // Default values are overridden by incoming payload values
  const defaultInputs = (webhook.bubbleFlow.defaultInputs || {}) as Record<
    string,
    unknown
  >;
  const webhookPayload = {
    ...defaultInputs,
    ...transformedPayload,
  };

  // For Slack events, return 200 immediately and process asynchronously
  const isSlackEvent = webhook.bubbleFlow.eventType.startsWith('slack/');

  if (isSlackEvent) {
    // Skip bot messages and system messages to prevent infinite loops
    if (
      shouldSkipSlackEvent(
        webhook.bubbleFlow.eventType as keyof BubbleTriggerEventRegistry,
        requestBody
      )
    ) {
      return c.json({}, 200);
    }

    // Execute the flow asynchronously (don't await)
    executeBubbleFlowViaWebhook(webhook.bubbleFlowId, webhookPayload, {
      userId,
      pricingTable: getPricingTable(),
    })
      .then(() => {
        // Slack event processed asynchronously
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
    { userId, pricingTable: getPricingTable() }
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
        await executeBubbleFlowWithTracking(webhook.bubbleFlowId, requestBody, {
          userId: webhook.userId,
          useWebhookLogger: true,
          pricingTable: getPricingTable(),
          streamCallback: async (event) => {
            // For terminal-friendly output, just send the message directly
            // instead of wrapping it in JSON
            await stream.writeSSE({
              data: event.message,
              event: event.type,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          },
        });

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

// Test webhook route with simple bearer token authentication
app.openapi(webhookTestRoute, async (c) => {
  // Check for bearer token
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - Bearer token required' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (token !== 'ABCDEFG') {
    return c.json({ error: 'Unauthorized - Invalid token' }, 401);
  }

  // Parse request body
  const requestBody = await c.req.json().catch(() => ({}));
  const receivedMessage = requestBody?.message || '';

  // Create response with ping message and acknowledgment
  const response = {
    success: true,
    message: 'pong',
    acknowledged: true,
    timestamp: new Date().toISOString(),
    ...(receivedMessage && { receivedMessage }),
  };

  return c.json(response, 200);
});

export default app;
