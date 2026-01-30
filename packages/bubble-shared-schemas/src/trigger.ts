export interface BubbleTriggerEventRegistry {
  'slack/bot_mentioned': SlackMentionEvent;
  'slack/message_received': SlackMessageReceivedEvent;
  'schedule/cron': CronEvent;
  'webhook/http': WebhookEvent;
}

// Runtime object that mirrors the interface keys
// This allows us to validate event types at runtime
export const BUBBLE_TRIGGER_EVENTS = {
  'slack/bot_mentioned': true,
  'slack/message_received': true,
  'schedule/cron': true,
  'webhook/http': true,
} as const satisfies Record<keyof BubbleTriggerEventRegistry, true>;

// Helper function to check if an event type is valid
export function isValidBubbleTriggerEvent(
  eventType: string
): eventType is keyof BubbleTriggerEventRegistry {
  return eventType in BUBBLE_TRIGGER_EVENTS;
}

export interface BubbleTriggerEvent {
  type: keyof BubbleTriggerEventRegistry;
  timestamp: string;
  executionId: string;
  path: string;
  [key: string]: unknown;
}

/**
 * Cron event payload structure
 *
 * The 'cron' field contains the cron expression in standard 5-part cron format:
 *
 * ┌───────────── minute (0 - 59)
 * │ ┌───────────── hour (0 - 23)
 * │ │ ┌───────────── day of month (1 - 31)
 * │ │ │ ┌───────────── month (1 - 12)
 * │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
 * │ │ │ │ │
 * * * * * *
 *
 * @example
 * ```typescript
 * // Daily at midnight
 * { cron: '0 0 * * *' }
 *
 * // Every weekday at 9am
 * { cron: '0 9 * * 1-5' }
 *
 * // Every 15 minutes
 * { cron: '*\/15 * * * *' }
 *
 * // First day of every month at midnight
 * { cron: '0 0 1 * *' }
 * ```
 */
export interface CronEvent extends BubbleTriggerEvent {
  /** The cron expression defining when this event triggers */
  cron: string;
  body?: Record<string, unknown>;
}

export interface WebhookEvent extends BubbleTriggerEvent {
  body?: Record<string, unknown>;
}

export interface BubbleTrigger {
  type: keyof BubbleTriggerEventRegistry;
  cronSchedule?: string;
  name?: string;
  description?: string;
  timeout?: number;
  retries?: number;
}

// Slack Event Wrapper (outer payload)
export interface SlackEventWrapper {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackAppMentionEvent | SlackMessageEvent;
  type: 'event_callback';
  authorizations: Array<{
    enterprise_id?: string;
    team_id: string;
    user_id: string;
    is_bot: boolean;
  }>;
  event_context: string;
  event_id: string;
  event_time: number;
}

// App Mention Event (inner event data)
export interface SlackAppMentionEvent {
  type: 'app_mention';
  user: string;
  text: string;
  ts: string;
  channel: string;
  event_ts: string;
  thread_ts?: string;
}

// Slack Message Event (inner event data)
export interface SlackMessageEvent {
  type: 'message';
  user: string;
  text: string;
  ts: string;
  channel: string;
  event_ts: string;
  channel_type: 'channel' | 'group' | 'im' | 'mpim';
  subtype?: string;
  // Bot message indicators - present when message is from a bot
  bot_id?: string;
  bot_profile?: {
    id: string;
    name: string;
    app_id: string;
  };
}

// BubbleTrigger-specific event types that wrap Slack events
export interface SlackMentionEvent extends BubbleTriggerEvent {
  slack_event: SlackEventWrapper;
  channel: string;
  user: string;
  text: string;
  thread_ts?: string;
}

export interface SlackMessageReceivedEvent extends BubbleTriggerEvent {
  slack_event: SlackEventWrapper;
  channel: string;
  user: string;
  text: string;
  channel_type: 'channel' | 'group' | 'im' | 'mpim';
  subtype?: string;
}

// ============================================================================
// Centralized Trigger Configuration
// Single source of truth for all trigger metadata
// ============================================================================

/**
 * JSON Schema type for payload validation
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Configuration for a trigger event type
 * Single source of truth for all trigger metadata
 */
export interface TriggerEventConfig {
  /** The bubble/service name (e.g., 'Slack') - used for logo lookup */
  serviceName: string;
  /** Human-friendly name (e.g., 'When Slack bot is mentioned') */
  friendlyName: string;
  /** Description of what this trigger does */
  description: string;
  /** Setup guide markdown for configuring this trigger */
  setupGuide: string;
  /** JSON Schema for the payload */
  payloadSchema: JsonSchema;
}

/**
 * Registry of all trigger event configurations
 * Keys must match BubbleTriggerEventRegistry
 */
export const TRIGGER_EVENT_CONFIGS: Record<
  keyof BubbleTriggerEventRegistry,
  TriggerEventConfig
> = {
  'slack/message_received': {
    serviceName: 'Slack',
    friendlyName: 'When Slack message is received',
    description:
      'Triggered when a message is posted in a channel your bot has access to',
    setupGuide: `## Slack Message Event Setup Guide

### 1. Create a Slack App
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace

### 2. Configure OAuth Scopes
Navigate to **OAuth & Permissions** and add these Bot Token Scopes:
- \`channels:history\` - To read messages in public channels
- \`groups:history\` - To read messages in private channels
- \`im:history\` - To read direct messages
- \`mpim:history\` - To read group direct messages
- \`chat:write\` - To send messages

### 3. Enable Event Subscriptions
1. Go to **Event Subscriptions**
2. Toggle "Enable Events" to ON
3. Toggle the webhook active button above and copy the webhook URL
4. Add your webhook URL to the Request URL field
5. Subscribe to bot events: \`message.channels\`, \`message.groups\`, \`message.im\`, \`message.mpim\`

### 4. Install to Workspace
1. Go to **Install App**
2. Click "Install to Workspace"
3. Authorize the requested permissions

### 5. Get Your Bot Token
Copy the **Bot User OAuth Token** (starts with \`xoxb-\`) from the OAuth & Permissions page.`,
    payloadSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The message text' },
        channel: {
          type: 'string',
          description: 'Channel ID where message was posted',
        },
        user: { type: 'string', description: 'User ID who posted the message' },
        channel_type: {
          type: 'string',
          description: 'Type of channel (channel, group, im, mpim)',
        },
        slack_event: {
          type: 'object',
          description: 'Full Slack event wrapper',
          properties: {
            token: { type: 'string', description: 'Verification token' },
            team_id: { type: 'string', description: 'Workspace ID' },
            api_app_id: { type: 'string', description: 'Slack App ID' },
            type: {
              type: 'string',
              enum: ['event_callback'],
              description: 'Event type',
            },
            event_id: { type: 'string', description: 'Unique event ID' },
            event_time: { type: 'number', description: 'Event timestamp' },
            event_context: { type: 'string', description: 'Event context' },
            authorizations: {
              type: 'array',
              description: 'Bot authorizations',
              items: {
                type: 'object',
                properties: {
                  enterprise_id: { type: 'string' },
                  team_id: { type: 'string' },
                  user_id: { type: 'string' },
                  is_bot: { type: 'boolean' },
                },
              },
            },
            event: {
              type: 'object',
              description: 'Inner message event data',
              properties: {
                type: {
                  type: 'string',
                  enum: ['message'],
                  description: 'Event type',
                },
                user: {
                  type: 'string',
                  description: 'User ID who sent the message',
                },
                text: { type: 'string', description: 'Message text content' },
                ts: { type: 'string', description: 'Message timestamp' },
                channel: { type: 'string', description: 'Channel ID' },
                event_ts: { type: 'string', description: 'Event timestamp' },
                channel_type: {
                  type: 'string',
                  enum: ['channel', 'group', 'im', 'mpim'],
                  description: 'Type of channel',
                },
                subtype: {
                  type: 'string',
                  description: 'Message subtype (if any)',
                },
              },
              required: [
                'type',
                'user',
                'text',
                'ts',
                'channel',
                'event_ts',
                'channel_type',
              ],
            },
          },
          required: [
            'token',
            'team_id',
            'api_app_id',
            'type',
            'event_id',
            'event_time',
            'event',
          ],
        },
      },
      required: ['text', 'channel', 'user', 'slack_event'],
    },
  },
  'slack/bot_mentioned': {
    serviceName: 'Slack',
    friendlyName: 'When Slack bot is mentioned',
    description: 'Triggered when someone mentions your bot in a Slack channel',
    setupGuide: `## Slack Bot Setup Guide

### 1. Create a Slack App
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace

### 2. Configure OAuth Scopes
Navigate to **OAuth & Permissions** and add these Bot Token Scopes:
- \`app_mentions:read\` - To receive mention events
- \`chat:write\` - To send messages
- \`channels:history\` - To read channel messages (optional)

### 3. Enable Event Subscriptions
1. Go to **Event Subscriptions**
2. Toggle "Enable Events" to ON
3. Toggle the webhook active button above and copy the webhook URL
4. Add your webhook URL to the Request URL field
5. Subscribe to bot events: \`app_mention\`

### 4. Install to Workspace
1. Go to **Install App**
2. Click "Install to Workspace"
3. Authorize the requested permissions

### 5. Get Your Bot Token
Copy the **Bot User OAuth Token** (starts with \`xoxb-\`) from the OAuth & Permissions page.`,
    payloadSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The message text mentioning the bot',
        },
        channel: {
          type: 'string',
          description: 'Channel ID where bot was mentioned',
        },
        user: { type: 'string', description: 'User ID who mentioned the bot' },
        thread_ts: {
          type: 'string',
          description: 'Thread timestamp (if replying in a thread)',
        },
        slack_event: {
          type: 'object',
          description: 'Full Slack event wrapper',
          properties: {
            token: { type: 'string', description: 'Verification token' },
            team_id: { type: 'string', description: 'Workspace ID' },
            api_app_id: { type: 'string', description: 'Slack App ID' },
            type: {
              type: 'string',
              enum: ['event_callback'],
              description: 'Event type',
            },
            event_id: { type: 'string', description: 'Unique event ID' },
            event_time: { type: 'number', description: 'Event timestamp' },
            event_context: { type: 'string', description: 'Event context' },
            authorizations: {
              type: 'array',
              description: 'Bot authorizations',
              items: {
                type: 'object',
                properties: {
                  enterprise_id: { type: 'string' },
                  team_id: { type: 'string' },
                  user_id: { type: 'string' },
                  is_bot: { type: 'boolean' },
                },
              },
            },
            event: {
              type: 'object',
              description: 'Inner app_mention event data',
              properties: {
                type: {
                  type: 'string',
                  enum: ['app_mention'],
                  description: 'Event type',
                },
                user: {
                  type: 'string',
                  description: 'User ID who mentioned the bot',
                },
                text: {
                  type: 'string',
                  description: 'Message text containing the mention',
                },
                ts: { type: 'string', description: 'Message timestamp' },
                channel: { type: 'string', description: 'Channel ID' },
                event_ts: { type: 'string', description: 'Event timestamp' },
                thread_ts: {
                  type: 'string',
                  description: 'Thread timestamp (if in a thread)',
                },
              },
              required: ['type', 'user', 'text', 'ts', 'channel', 'event_ts'],
            },
          },
          required: [
            'token',
            'team_id',
            'api_app_id',
            'type',
            'event_id',
            'event_time',
            'event',
          ],
        },
      },
      required: ['text', 'channel', 'user', 'slack_event'],
    },
  },
  'schedule/cron': {
    serviceName: 'Cron',
    friendlyName: 'On Schedule',
    description:
      'Triggered on a recurring schedule defined by a cron expression',
    setupGuide: `## Cron Schedule Setup Guide

Configure when this flow should run using the schedule editor or a cron expression.

### Common Schedules
- **Every minute**: \`* * * * *\`
- **Every hour**: \`0 * * * *\`
- **Daily at midnight**: \`0 0 * * *\`
- **Weekly on Monday**: \`0 0 * * 1\`
- **Monthly on the 1st**: \`0 0 1 * *\`

### Cron Format
\`\`\`
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
\`\`\`

### Custom Payload Interface
Define your own payload interface extending CronEvent for scheduled input data:
\`\`\`typescript
interface DailyReportPayload extends CronEvent {
  reportType: 'summary' | 'detailed';
  recipients: string[];
}

export class DailyReportFlow extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '0 9 * * 1-5'; // Weekdays at 9am

  async handle(payload: DailyReportPayload) {
    // Access fields directly: payload.reportType, payload.recipients
  }
}
\`\`\``,
    payloadSchema: {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
  },
  'webhook/http': {
    serviceName: 'Webhook',
    friendlyName: 'HTTP Webhook',
    description: 'Triggered by an HTTP POST request to your webhook URL',
    setupGuide: `## Webhook Setup Guide

### Your Webhook URL
Toggle the webhook active button above and copy the webhook URL to send HTTP POST requests to trigger this flow.

### Request Format
\`\`\`bash
curl -X POST https://your-domain.com/webhook/your-path \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "name": "John"}'
\`\`\`

### Custom Payload Interface
Define your own payload interface extending WebhookEvent:
\`\`\`typescript
interface MyPayload extends WebhookEvent {
  email: string;
  name: string;
  message?: string;
}

export class MyFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: MyPayload) {
    // Access fields directly: payload.email, payload.name
  }
}
\`\`\`

The JSON body fields from the HTTP request are directly available on the payload object.`,
    payloadSchema: {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
  },
};

/**
 * Get configuration for a trigger event type
 * @param eventType - The trigger event type key
 * @returns The trigger configuration or undefined if not found
 */
export function getTriggerEventConfig(
  eventType: keyof BubbleTriggerEventRegistry
): TriggerEventConfig {
  return TRIGGER_EVENT_CONFIGS[eventType];
}

/**
 * Check if an event type is a service trigger (not webhook/cron)
 * Service triggers get special UI treatment with logos and friendly names
 */
export function isServiceTrigger(
  eventType: keyof BubbleTriggerEventRegistry
): boolean {
  return eventType !== 'webhook/http' && eventType !== 'schedule/cron';
}

/**
 * Mapping from trigger event interface names to their event type keys.
 * Used by BubbleParser to identify when a payload interface extends a known trigger event.
 */
export const TRIGGER_EVENT_INTERFACE_MAP: Record<
  string,
  keyof BubbleTriggerEventRegistry
> = {
  SlackMentionEvent: 'slack/bot_mentioned',
  SlackMessageReceivedEvent: 'slack/message_received',
  CronEvent: 'schedule/cron',
  WebhookEvent: 'webhook/http',
  BubbleTriggerEvent: 'webhook/http', // Base type defaults to webhook
};

/**
 * Get the trigger event type key from an interface name.
 * @param interfaceName - The name of the interface (e.g., 'SlackMentionEvent')
 * @returns The trigger event type key or undefined if not a known trigger interface
 */
export function getTriggerEventTypeFromInterfaceName(
  interfaceName: string
): keyof BubbleTriggerEventRegistry | undefined {
  return TRIGGER_EVENT_INTERFACE_MAP[interfaceName];
}
