// @ts-expect-error bun:test is not in TypeScript definitions
import { describe, it, expect } from 'bun:test';
import type {
  BubbleTriggerEventRegistry,
  SlackEventWrapper,
  SlackAppMentionEvent,
  SlackMessageEvent,
} from '@bubblelab/bubble-core';

// Mock the transformation function (this would be imported from the actual implementation)
function transformWebhookPayload(
  eventType: keyof BubbleTriggerEventRegistry,
  rawBody: unknown,
  path: string,
  method: string,
  headers: Record<string, string>
): BubbleTriggerEventRegistry[keyof BubbleTriggerEventRegistry] & {
  body: unknown;
} {
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

      return {
        ...basePayload,
        slack_event: slackBody,
        channel: event.channel,
        user: event.user,
        text: event.text,
        thread_ts: event.thread_ts,
      };
    }

    case 'slack/message_received': {
      // Transform Slack message event
      const slackBody = rawBody as SlackEventWrapper;
      const event = slackBody.event as SlackMessageEvent;

      return {
        ...basePayload,
        slack_event: slackBody,
        channel: event.channel,
        user: event.user,
        text: event.text,
        channel_type: event.channel_type,
        subtype: event.subtype,
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

describe('Webhook Payload Transformation', () => {
  describe('Slack Bot Mention Events', () => {
    const mockSlackWebhookPayload: SlackEventWrapper = {
      token: 'Z6MFCp3UUociOt9gF2aGft9O',
      team_id: 'T07UVUG5ZNY',
      api_app_id: 'A08H7A3BHS5',
      event: {
        user: 'U07UTL8MA9Y',
        type: 'app_mention',
        text: '<@U08GXBRKML2> hi',
        channel: 'C08J0L09PT6',
        ts: '1753712246.912699',
        event_ts: '1753712246.912699',
      },
      type: 'event_callback',
      event_id: 'Ev097Q4KBBSS',
      event_time: 1753712246,
      authorizations: [
        {
          enterprise_id: undefined,
          team_id: 'T07UVUG5ZNY',
          user_id: 'U08GXBRKML2',
          is_bot: true,
        },
      ],
      event_context:
        '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
    };

    it('should transform Slack bot mention webhook payload correctly', () => {
      const transformed = transformWebhookPayload(
        'slack/bot_mentioned',
        mockSlackWebhookPayload,
        '/webhook/1/test',
        'POST',
        { 'content-type': 'application/json' }
      );

      // Verify the transformed payload has the correct structure
      expect(transformed.type).toBe('slack/bot_mentioned');
      expect(transformed.path).toBe('/webhook/1/test');
      expect(transformed.timestamp).toBeDefined();

      // Verify direct access to common fields
      expect(transformed.channel).toBe('C08J0L09PT6');
      expect(transformed.user).toBe('U07UTL8MA9Y');
      expect(transformed.text).toBe('<@U08GXBRKML2> hi');

      // Verify full Slack event is preserved
      expect(transformed.slack_event).toBeDefined();
      expect((transformed as any).slack_event.event_id).toBe('Ev097Q4KBBSS');
      expect((transformed as any).slack_event.team_id).toBe('T07UVUG5ZNY');

      // Verify original body is preserved
      expect(transformed.body).toBeDefined();
      expect((transformed.body as SlackEventWrapper).event_id).toBe(
        'Ev097Q4KBBSS'
      );
    });

    it('should handle thread_ts when present', () => {
      const payloadWithThread = {
        ...mockSlackWebhookPayload,
        event: {
          ...mockSlackWebhookPayload.event,
          thread_ts: '1753712245.000000',
        },
      };

      const transformed = transformWebhookPayload(
        'slack/bot_mentioned',
        payloadWithThread,
        '/webhook/1/test',
        'POST',
        {}
      );

      expect(transformed.thread_ts).toBe('1753712245.000000');
    });
  });

  describe('Slack Message Events', () => {
    const mockSlackMessagePayload: SlackEventWrapper = {
      token: 'Z6MFCp3UUociOt9gF2aGft9O',
      team_id: 'T07UVUG5ZNY',
      api_app_id: 'A08H7A3BHS5',
      event: {
        user: 'U07UTL8MA9Y',
        type: 'message',
        text: 'Hello world',
        channel: 'C08J0L09PT6',
        ts: '1753712246.912699',
        event_ts: '1753712246.912699',
        channel_type: 'channel',
        subtype: 'bot_message',
      },
      type: 'event_callback',
      event_id: 'Ev097Q4KBBSS',
      event_time: 1753712246,
      authorizations: [
        {
          enterprise_id: undefined,
          team_id: 'T07UVUG5ZNY',
          user_id: 'U08GXBRKML2',
          is_bot: true,
        },
      ],
      event_context:
        '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
    };

    it('should transform Slack message webhook payload correctly', () => {
      const transformed = transformWebhookPayload(
        'slack/message_received',
        mockSlackMessagePayload,
        '/webhook/1/test',
        'POST',
        {}
      );

      expect(transformed.type).toBe('slack/message_received');
      expect(transformed.channel).toBe('C08J0L09PT6');
      expect(transformed.user).toBe('U07UTL8MA9Y');
      expect(transformed.text).toBe('Hello world');
      expect(transformed.channel_type).toBe('channel');
      expect(transformed.subtype).toBe('bot_message');
    });
  });

  describe('Gmail Email Events', () => {
    it('should transform Gmail webhook payload correctly', () => {
      const gmailPayload = { email: 'test@example.com' };

      const transformed = transformWebhookPayload(
        'gmail/email_received',
        gmailPayload,
        '/webhook/1/gmail',
        'POST',
        {}
      );

      expect(transformed.type).toBe('gmail/email_received');
      expect(transformed.email).toBe('test@example.com');
      expect(transformed.body).toBeDefined();
    });
  });

  describe('Cron Events', () => {
    it('should transform cron webhook payload correctly', () => {
      const cronPayload = { cron: '0 12 * * *' };

      const transformed = transformWebhookPayload(
        'schedule/cron/daily',
        cronPayload,
        '/webhook/1/cron',
        'POST',
        {}
      );

      expect(transformed.type).toBe('schedule/cron/daily');
      expect(transformed.cron).toBe('0 12 * * *');
    });

    it('should use default cron when not provided', () => {
      const transformed = transformWebhookPayload(
        'schedule/cron/daily',
        {},
        '/webhook/1/cron',
        'POST',
        {}
      );

      expect(transformed.cron).toBe('0 0 * * *');
    });
  });

  describe('Generic Webhook Events', () => {
    it('should transform generic webhook payload correctly', () => {
      const genericPayload = {
        message: 'Hello world',
        data: { key: 'value' },
      };

      const transformed = transformWebhookPayload(
        'webhook/http',
        genericPayload,
        '/webhook/1/generic',
        'POST',
        { 'x-custom-header': 'test' }
      );

      expect(transformed.type).toBe('webhook/http');
      expect(transformed.method).toBe('POST');
      expect(transformed.headers).toEqual({ 'x-custom-header': 'test' });
      expect(transformed.body).toEqual(genericPayload);
    });
  });

  describe('BubbleFlow Usage Example', () => {
    it('should demonstrate how BubbleFlow would use transformed payload', () => {
      const mockSlackPayload: SlackEventWrapper = {
        token: 'Z6MFCp3UUociOt9gF2aGft9O',
        team_id: 'T07UVUG5ZNY',
        api_app_id: 'A08H7A3BHS5',
        event: {
          user: 'U07UTL8MA9Y',
          type: 'app_mention',
          text: '<@U08GXBRKML2> analyze data',
          channel: 'C08J0L09PT6',
          ts: '1753712246.912699',
          event_ts: '1753712246.912699',
        },
        type: 'event_callback',
        event_id: 'Ev097Q4KBBSS',
        event_time: 1753712246,
        authorizations: [
          {
            enterprise_id: undefined,
            team_id: 'T07UVUG5ZNY',
            user_id: 'U08GXBRKML2',
            is_bot: true,
          },
        ],
        event_context:
          '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
      };

      const transformed = transformWebhookPayload(
        'slack/bot_mentioned',
        mockSlackPayload,
        '/webhook/1/test',
        'POST',
        {}
      );

      // Simulate BubbleFlow processing
      const cleanMessage = (transformed as any).text
        .replace(/<@[^>]+>/, '')
        .trim();
      const response = {
        success: true,
        message: `Processed message from ${(transformed as any).user} in ${(transformed as any).channel}`,
        cleanText: cleanMessage,
        timestamp: transformed.timestamp,
        eventId: (transformed as any).slack_event.event_id,
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe(
        'Processed message from U07UTL8MA9Y in C08J0L09PT6'
      );
      expect(response.cleanText).toBe('analyze data');
      expect(response.eventId).toBe('Ev097Q4KBBSS');
    });
  });
});
