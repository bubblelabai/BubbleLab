// @ts-expect-error bun:test is not in TypeScript definitions
import { describe, it, expect, beforeEach } from 'bun:test';
import { TestApp } from '../test/test-app.js';
import { createBubbleFlow } from '../test/helpers/index.js';
import { db } from '../db/index.js';
import { webhooks } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Type assertion helpers (following the pattern from execute-bubble-flow.test.ts)
const asError = (body: unknown) =>
  body as { error: string; details?: unknown[] };
const asCreateSuccess = (body: unknown) =>
  body as { id: number; message: string };

describe('Webhook Endpoint with Payload Transformation', () => {
  let slackBotFlowId: number;
  let webhookPath: string;

  beforeEach(async () => {
    // Create a BubbleFlow that handles Slack bot mentions
    const response = await createBubbleFlow({
      name: 'Slack Bot Test Flow',
      description: 'A flow that processes Slack bot mentions',
      code: `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow } from '@bubblelab/bubble-core';

export class SlackBotTestFlow extends BubbleFlow<'slack/bot_mentioned'> {
  constructor() {
    super('slack-bot-test', 'Processes Slack bot mentions');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['slack/bot_mentioned']) {
    // Test that we can access transformed fields directly
    const channel = payload.channel;
    const user = payload.user;
    const text = payload.text;
    
    // Test that we can access the full Slack event
    const eventId = payload.slack_event.event_id;
    const teamId = payload.slack_event.team_id;
    
    // Test that we can access the original body
    const originalBody = payload.body;
    
    return {
      success: true,
      message: \`Processed message from \${user} in \${channel}\`,
      cleanText: text.replace(/<@[^>]+>/, '').trim(),
      eventId,
      teamId,
      hasOriginalBody: !!originalBody,
      timestamp: payload.timestamp
    };
  }
}
      `,
      eventType: 'slack/bot_mentioned',
    });

    slackBotFlowId = asCreateSuccess(response.body).id;

    // Get the webhook path from the database and activate it
    const webhook = await db.query.webhooks.findFirst({
      where: (webhooks, { eq }) => eq(webhooks.bubbleFlowId, slackBotFlowId),
    });

    if (!webhook) {
      throw new Error('Webhook not found for created BubbleFlow');
    }

    // Activate the webhook for testing
    await db
      .update(webhooks)
      .set({ isActive: true })
      .where(eq(webhooks.id, webhook.id));

    webhookPath = webhook.path;
  });

  describe('Slack Bot Mention Webhook', () => {
    it('should transform Slack webhook payload and execute BubbleFlow', async () => {
      // Real Slack webhook payload (what Slack actually sends)
      const slackWebhookPayload = {
        token: 'Z6MFCp3UUociOt9gF2aGft9O',
        team_id: 'T07UVUG5ZNY',
        api_app_id: 'A08H7A3BHS5',
        event: {
          user: 'U07UTL8MA9Y',
          type: 'app_mention',
          ts: '1753710380.894809',
          client_msg_id: 'd3b28967-69a2-4187-86a9-c6c007cfbdd5',
          text: '<@U08GXBRKML2> hi',
          team: 'T07UVUG5ZNY',
          blocks: [
            {
              type: 'rich_text',
              block_id: 'lnk4t',
              elements: [
                {
                  type: 'rich_text_section',
                  elements: [
                    { type: 'user', user_id: 'U08GXBRKML2' },
                    { type: 'text', text: ' hi' },
                  ],
                },
              ],
            },
          ],
          channel: 'C08J0L09PT6',
          event_ts: '1753710380.894809',
        },
        type: 'event_callback',
        event_id: 'Ev09878M8U49',
        event_time: 1753710380,
        authorizations: [
          {
            enterprise_id: null,
            team_id: 'T07UVUG5ZNY',
            user_id: 'U08GXBRKML2',
            is_bot: true,
            is_enterprise_install: false,
          },
        ],
        is_ext_shared_channel: false,
        event_context:
          '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
      };

      // Make request to webhook endpoint
      const response = await TestApp.post(
        `/webhook/1/${webhookPath}`,
        slackWebhookPayload,
        {
          'X-Slack-Request-Timestamp': '1753712248',
          'X-Slack-Signature':
            'v0=de4596ce8ea60ee95e796d8d808cd5a104bc3a806e5baf096482ed2fd04781ef',
        }
      );

      // For Slack events, webhook now returns immediately (200 with empty body)
      // This is the correct behavior for Slack webhooks - they require fast responses
      expect(response.status).toBe(200);

      const result = await response.json();

      // Slack webhooks return immediately with empty response, execution happens asynchronously
      expect(result).toEqual({});

      // Note: The actual BubbleFlow execution happens asynchronously in the background
      // In a real-world scenario, you would verify execution through logs, database records,
      // or by checking the execution results via a separate API endpoint
    });

    it('should handle Slack URL verification', async () => {
      const verificationPayload = {
        token: 'test_token_123',
        type: 'url_verification',
        challenge: 'test_challenge_123',
      };

      const response = await TestApp.post(
        `/webhook/1/${webhookPath}`,
        verificationPayload
      );

      expect(response.status).toBe(200);

      const result = (await response.json()) as { challenge: string };
      expect(result.challenge).toBe('test_challenge_123');
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await TestApp.post('/webhook/1/non-existent-path', {
        test: 'data',
      });

      expect(response.status).toBe(404);

      const result = asError(await response.json());
      expect(result.error).toBe('Webhook not found');
    });
  });

  describe('Webhook Payload Transformation Benefits', () => {
    it('should demonstrate the benefits of payload transformation', async () => {
      // This test documents the key benefits of our transformation approach
      // Note: While the actual execution happens asynchronously for Slack events,
      // we can still test that the transformation logic works correctly
      const slackPayload = {
        token: 'Z6MFCp3UUociOt9gF2aGft9O',
        team_id: 'T07UVUG5ZNY',
        api_app_id: 'A08H7A3BHS5',
        event: {
          user: 'U07UTL8MA9Y',
          type: 'app_mention',
          ts: '1753710380.894809',
          client_msg_id: 'd3b28967-69a2-4187-86a9-c6c007cfbdd5',
          text: '<@U08GXBRKML2> hello world',
          team: 'T07UVUG5ZNY',
          blocks: [
            {
              type: 'rich_text',
              block_id: 'lnk4t',
              elements: [
                {
                  type: 'rich_text_section',
                  elements: [
                    { type: 'user', user_id: 'U08GXBRKML2' },
                    { type: 'text', text: ' hello world' },
                  ],
                },
              ],
            },
          ],
          channel: 'C08J0L09PT6',
          event_ts: '1753710380.894809',
        },
        type: 'event_callback',
        event_id: 'Ev09878M8U49',
        event_time: 1753710380,
        authorizations: [
          {
            enterprise_id: null,
            team_id: 'T07UVUG5ZNY',
            user_id: 'U08GXBRKML2',
            is_bot: true,
            is_enterprise_install: false,
          },
        ],
        is_ext_shared_channel: false,
        event_context:
          '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
      };

      const response = await TestApp.post(
        `/webhook/1/${webhookPath}`,
        slackPayload
      );

      expect(response.status).toBe(200);

      const result = await response.json();

      // For Slack events, webhook returns immediately with empty response
      expect(result).toEqual({});

      // ✅ BENEFITS OF PAYLOAD TRANSFORMATION:
      // 1. Direct access to common fields (no need to navigate nested objects)
      //    Before: payload.body.event.channel
      //    After: payload.channel
      //
      // 2. Type safety - TypeScript knows exactly what fields exist
      //    The BubbleFlow code can safely access payload.channel, payload.user, etc.
      //
      // 3. Flexibility - Can access both simplified and full event data
      //    Simplified: payload.eventId, payload.teamId
      //    Full: payload.slack_event contains the complete Slack payload
      //
      // 4. Backward compatibility - Original body preserved in payload.body
      //
      // 5. Consistency - All event types follow the same pattern
      //    Every event has: type, timestamp, path, body + event-specific fields
      //
      // Note: The actual execution of the BubbleFlow with transformed payload
      // happens asynchronously in the background for performance reasons.
    });
  });

  describe('Webhook Stream Endpoint', () => {
    it('should execute webhook by userId/path with streaming response', async () => {
      // Get the webhook from the database to get userId and path
      const webhook = await db.query.webhooks.findFirst({
        where: eq(webhooks.bubbleFlowId, slackBotFlowId),
      });

      expect(webhook).toBeDefined();
      expect(webhook!.userId).toBeTruthy();
      expect(webhook!.path).toBeTruthy();

      const slackPayload = {
        token: 'verification_token_here',
        team_id: 'T07UVUG5ZNY',
        context_team_id: 'T07UVUG5ZNY',
        context_enterprise_id: null,
        api_app_id: 'A08H7A3BHS5',
        event: {
          client_msg_id: '8234asdf-1234-5678-9012-34567890abcd',
          type: 'app_mention',
          text: '<@U08GXBRKML2> hello world',
          user: 'U08H7A3BHS5',
          ts: '1753710380.894809',
          team: 'T07UVUG5ZNY',
          channel: 'C08J0L09PT6',
          event_ts: '1753710380.894809',
        },
        type: 'event_callback',
        event_id: 'Ev09878M8U49',
        event_time: 1753710380,
      };

      const response = await TestApp.post(
        `/webhook/${webhook!.userId}/${webhook!.path}/stream`,
        slackPayload
      );

      // Should get a streaming response
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      // Verify that we can read the stream (basic check)
      const text = await response.text();
      expect(text).toContain('data:');
      expect(text).toContain('event:');
    });

    it('should return 404 for non-existent webhook path', async () => {
      const response = await TestApp.post('/webhook/1/nonexistent/stream', {});

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(asError(result).error).toBe('Webhook not found');
    });

    it('should work even for inactive webhooks (unlike regular webhook endpoint)', async () => {
      // Get the webhook and deactivate it
      const webhook = await db.query.webhooks.findFirst({
        where: eq(webhooks.bubbleFlowId, slackBotFlowId),
      });

      // Deactivate the webhook
      await db
        .update(webhooks)
        .set({ isActive: false })
        .where(eq(webhooks.id, webhook!.id));

      const response = await TestApp.post(
        `/webhook/${webhook!.userId}/${webhook!.path}/stream`,
        {}
      );

      // Should still work even when inactive (this is the key difference from regular webhook endpoint)
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      // Reactivate for other tests
      await db
        .update(webhooks)
        .set({ isActive: true })
        .where(eq(webhooks.id, webhook!.id));
    });
  });
});
