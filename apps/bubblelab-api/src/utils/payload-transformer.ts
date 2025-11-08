import type {
  BubbleTriggerEventRegistry,
  SlackEventWrapper,
  SlackAppMentionEvent,
  SlackMessageEvent,
} from '@bubblelab/shared-schemas';

/**
 * Transforms raw webhook payload into the appropriate BubbleTriggerEvent structure
 * based on the event type. This ensures the payload matches the expected interface
 * for each specific event type.
 */
export function transformWebhookPayload(
  eventType: keyof BubbleTriggerEventRegistry,
  rawBody: Record<string, any>,
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

    case 'schedule/cron': {
      // For cron events, we might have cron-specific data
      const result: BubbleTriggerEventRegistry['schedule/cron'] = {
        ...basePayload,
        method,
        headers,
        cron: rawBody.cron,
        ...(rawBody.body as Record<string, unknown>),
      };
      return result;
    }

    case 'webhook/http': {
      const result: BubbleTriggerEventRegistry['webhook/http'] = {
        ...basePayload,
        method,
        headers,
        ...(rawBody as Record<string, unknown>),
      };
      return result;
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
