import type {
  BubbleTriggerEventRegistry,
  SlackEventWrapper,
  SlackAppMentionEvent,
  SlackMessageEvent,
  SlackFile,
  SlackThreadHistoryMessage,
} from '@bubblelab/shared-schemas';

/**
 * Checks if a Slack event should be ignored based on the flow's event type.
 * This prevents infinite loops and ensures flows only respond to relevant events.
 *
 * - For 'slack/bot_mentioned': Only process 'app_mention' events, skip everything else
 * - For 'slack/message_received': Skip bot messages and system messages (subtypes)
 *
 * @param eventType - The event type from the flow
 * @param rawBody - The raw webhook payload
 * @returns true if the event should be skipped, false if it should be processed
 */
export function shouldSkipSlackEvent(
  eventType: keyof BubbleTriggerEventRegistry,
  rawBody: Record<string, unknown>
): boolean {
  const slackBody = rawBody as unknown as SlackEventWrapper;
  const event = slackBody?.event as
    | SlackMessageEvent
    | SlackAppMentionEvent
    | undefined;

  if (!event) {
    return false;
  }

  if (eventType === 'slack/bot_mentioned') {
    // For bot_mentioned flows, only process app_mention events
    // Skip all other event types (message, etc.)
    if (event.type !== 'app_mention') {
      return true;
    }
    return false;
  }

  if (eventType === 'slack/message_received') {
    // Skip messages from bots (including our own bot)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ('bot_id' in event && (event as any).bot_id) {
      return true;
    }

    // Skip system messages with subtypes (e.g., bot_add, channel_join, message_changed)
    // BUT allow file_share subtype so we can process messages with images/files
    if ('subtype' in event && event.subtype && event.subtype !== 'file_share') {
      return true;
    }

    return false;
  }

  return false;
}

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
    executionId: crypto.randomUUID(),
    path,
    body: rawBody, // Always include the original body for compatibility
  };

  switch (eventType) {
    case 'slack/bot_mentioned': {
      // Transform Slack app_mention event
      const slackBody = rawBody as SlackEventWrapper;
      const event = slackBody.event as SlackAppMentionEvent;
      const threadHistories = (
        rawBody as {
          thread_histories?: SlackThreadHistoryMessage[];
        }
      ).thread_histories;

      const result: BubbleTriggerEventRegistry['slack/bot_mentioned'] = {
        ...basePayload,
        slack_event: slackBody,
        channel: event?.channel,
        user: event?.user,
        text: event?.text,
        thread_ts: event?.thread_ts,
        files: event?.files as SlackFile[] | undefined,
        thread_histories: threadHistories ?? [],
      };
      return result;
    }

    case 'slack/message_received': {
      // Transform Slack message event
      const slackBody = rawBody as SlackEventWrapper;
      const event = slackBody.event as SlackMessageEvent;
      const threadHistories = (
        rawBody as {
          thread_histories?: SlackThreadHistoryMessage[];
        }
      ).thread_histories;

      const result: BubbleTriggerEventRegistry['slack/message_received'] = {
        ...basePayload,
        slack_event: slackBody,
        channel: event?.channel,
        user: event?.user,
        text: event?.text,
        channel_type: event?.channel_type,
        subtype: event?.subtype,
        files: event?.files as SlackFile[] | undefined,
        thread_histories: threadHistories ?? [],
      };
      return result;
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
