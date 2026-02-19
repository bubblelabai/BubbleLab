export interface BubbleTriggerEventRegistry {
  'slack/bot_mentioned': SlackMentionEvent;
  'slack/message_received': SlackMessageReceivedEvent;
  'slack/reaction_added': SlackReactionAddedEvent;
  'slack/approval_resumed': SlackApprovalResumedEvent;
  'airtable/record_created': AirtableRecordCreatedEvent;
  'airtable/record_updated': AirtableRecordUpdatedEvent;
  'airtable/record_deleted': AirtableRecordDeletedEvent;
  'schedule/cron': CronEvent;
  'webhook/http': WebhookEvent;
}

// Runtime object that mirrors the interface keys
// This allows us to validate event types at runtime
export const BUBBLE_TRIGGER_EVENTS = {
  'slack/bot_mentioned': true,
  'slack/message_received': true,
  'slack/reaction_added': true,
  'slack/approval_resumed': true,
  'airtable/record_created': true,
  'airtable/record_updated': true,
  'airtable/record_deleted': true,
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

/**
 * Slack file object - included in message events when files/images are shared
 * @see https://api.slack.com/types/file
 */
export interface SlackFile {
  /** Unique file identifier */
  id: string;
  /** Filename with extension */
  name: string;
  /** Display title of the file */
  title?: string;
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  mimetype: string;
  /** File extension without dot (e.g., 'png', 'pdf') */
  filetype: string;
  /** File size in bytes */
  size: number;
  /** User ID who uploaded the file */
  user?: string;

  // File access URLs (require authentication with bot token)
  /** Private URL to view the file (requires bot token auth) */
  url_private?: string;
  /** Private URL to download the file (requires bot token auth) */
  url_private_download?: string;

  // Image dimensions
  /** Original image width in pixels */
  original_w?: number;
  /** Original image height in pixels */
  original_h?: number;

  /** Permanent link to the file */
  permalink?: string;
}

/**
 * Slack thread history message with user context
 */
export interface SlackThreadHistoryMessage {
  /** Slack user ID or bot ID */
  user_id: string;
  /** User display name (best effort) */
  name: string;
  /** User timezone (best effort) */
  timezone: string | null;
  /** Message text */
  message: string;
  /** Private download URLs for images attached to the message */
  image_url_private_downloads?: string[];
}

// Slack Event Wrapper (outer payload)
// Generic parameter narrows `.event` per trigger type; defaults to full union for routing code
export interface SlackEventWrapper<
  TEvent =
    | SlackAppMentionEvent
    | SlackMessageEvent
    | SlackReactionAddedRawEvent,
> {
  token: string;
  team_id: string;
  api_app_id: string;
  event: TEvent;
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
  /** Files/images attached to the mention message */
  files?: SlackFile[];
  /** Whether this message was an upload */
  upload?: boolean;
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
  /** Thread timestamp - present when this message is a reply in a thread */
  thread_ts?: string;
  /** Message subtype (e.g., 'file_share', 'bot_message', 'channel_join') */
  subtype?: string;
  // Bot message indicators - present when message is from a bot
  bot_id?: string;
  bot_profile?: {
    id: string;
    name: string;
    app_id: string;
  };
  /** Files/images attached to this message (present when subtype is 'file_share' or user uploads files) */
  files?: SlackFile[];
  /** Whether this message was an upload */
  upload?: boolean;
}

// BubbleTrigger-specific event types that wrap Slack events
export interface SlackMentionEvent extends BubbleTriggerEvent {
  slack_event: SlackEventWrapper<SlackAppMentionEvent>;
  channel: string;
  user: string;
  text: string;
  /** Message timestamp - use this when replying to the message */
  ts?: string;
  /** Thread timestamp - present when this message is a reply in a thread */
  thread_ts?: string;
  /** Files/images attached to the mention message */
  files?: SlackFile[];
  /** Thread history messages, including current message for non-threaded events */
  thread_histories: SlackThreadHistoryMessage[];
}

export interface SlackMessageReceivedEvent extends BubbleTriggerEvent {
  slack_event: SlackEventWrapper<SlackMessageEvent>;
  channel: string;
  user: string;
  text: string;
  /** Message timestamp - use this when replying to the message */
  ts?: string;
  /** Thread timestamp - present when this message is a reply in a thread */
  thread_ts?: string;
  channel_type: 'channel' | 'group' | 'im' | 'mpim';
  subtype?: string;
  /** Files/images attached to this message */
  files?: SlackFile[];
  /** Thread history messages, including current message for non-threaded events */
  thread_histories: SlackThreadHistoryMessage[];
}

// Raw Slack reaction_added event (inner event data)
export interface SlackReactionAddedRawEvent {
  type: 'reaction_added';
  user: string;
  reaction: string;
  item_user?: string;
  item: {
    type: 'message' | 'file' | 'file_comment';
    channel?: string;
    ts?: string;
    file?: string;
    file_comment?: string;
  };
  event_ts: string;
}

// Enriched payload for BubbleFlow
export interface SlackReactionAddedEvent extends BubbleTriggerEvent {
  slack_event: SlackEventWrapper<SlackReactionAddedRawEvent>;
  /** The user who reacted */
  user: string;
  /** Emoji reaction name (e.g. "thumbsup") */
  reaction: string;
  /** Channel where the reacted message lives */
  channel?: string;
  /** Timestamp of the message that was reacted to */
  item_ts?: string;
  /** The user who authored the original item */
  item_user?: string;
  /** Full item reference from the reaction event */
  item: {
    type: 'message' | 'file' | 'file_comment';
    channel?: string;
    ts?: string;
    file?: string;
    file_comment?: string;
  };
  /** Text of the original message that was reacted to (fetched via API) */
  message_text?: string;
  event_ts: string;
}

/**
 * Slack approval resumed event — fired when a human approves a pending
 * flow action via the approval link buttons and the flow resumes execution.
 */
export interface SlackApprovalResumedEvent extends BubbleTriggerEvent {
  /** The approval record ID */
  approvalId: string;
  /** The action that was approved (e.g. 'run-flow', 'activate-flow') */
  action: string;
  /** The target flow ID that the action applies to */
  targetFlowId: number;
  /** Slack channel where the approval thread lives */
  channel: string;
  /** Slack thread timestamp of the approval conversation */
  threadTs: string;
  /** User or identifier who approved the action */
  approvedBy: string;
}

// ============================================================================
// Airtable Event Types
// ============================================================================

/**
 * Base Airtable event structure
 */
export interface AirtableEventBase extends BubbleTriggerEvent {
  airtable_event: {
    baseId: string;
    webhookId: string;
    timestamp: string;
    baseTransactionNumber: number;
    actionMetadata?: {
      source: string;
      sourceMetadata?: Record<string, unknown>;
    };
  };
  base_id: string;
  table_id: string;
}

/**
 * Airtable record created event
 */
export interface AirtableRecordCreatedEvent extends AirtableEventBase {
  airtable_event: AirtableEventBase['airtable_event'] & {
    type: 'record_created';
    records: Record<string, { cellValuesByFieldId: Record<string, unknown> }>;
  };
}

/**
 * Airtable record updated event
 */
export interface AirtableRecordUpdatedEvent extends AirtableEventBase {
  airtable_event: AirtableEventBase['airtable_event'] & {
    type: 'record_updated';
    records: Record<
      string,
      {
        current: { cellValuesByFieldId: Record<string, unknown> };
        previous?: { cellValuesByFieldId: Record<string, unknown> };
      }
    >;
  };
}

/**
 * Airtable record deleted event
 */
export interface AirtableRecordDeletedEvent extends AirtableEventBase {
  airtable_event: AirtableEventBase['airtable_event'] & {
    type: 'record_deleted';
    recordIds: string[];
  };
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
  /** Credential type required for this trigger (checked via triggerCredentialId) */
  requiredCredentialType?: string;
  /** defaultInputs keys that must be non-empty for the trigger to be "ready" */
  requiredConfigFields?: string[];
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
    requiredCredentialType: 'SLACK_CRED',
    requiredConfigFields: ['slack_active_channels'],
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
- \`users:read\` - To look up user names and timezones

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
        files: {
          type: 'array',
          description:
            'Files/images attached to the message. Present when user shares files. Use url_private with bot token to download.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique file identifier' },
              name: { type: 'string', description: 'Filename with extension' },
              title: { type: 'string', description: 'Display title' },
              mimetype: {
                type: 'string',
                description: 'MIME type (e.g., image/png)',
              },
              filetype: {
                type: 'string',
                description: 'File extension (e.g., png)',
              },
              size: { type: 'number', description: 'File size in bytes' },
              url_private: {
                type: 'string',
                description: 'Private URL to access file (requires bot token)',
              },
              url_private_download: {
                type: 'string',
                description:
                  'Private URL to download file (requires bot token)',
              },
              thumb_360: {
                type: 'string',
                description: '360px thumbnail URL for images',
              },
              thumb_480: {
                type: 'string',
                description: '480px thumbnail URL for images',
              },
              original_w: {
                type: 'number',
                description: 'Original image width in pixels',
              },
              original_h: {
                type: 'number',
                description: 'Original image height in pixels',
              },
              permalink: {
                type: 'string',
                description: 'Permanent link to the file',
              },
            },
          },
        },
        thread_histories: {
          type: 'array',
          description:
            'Thread history messages including current message for non-threaded events',
          items: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'Slack user ID or bot ID',
              },
              name: {
                type: 'string',
                description: 'User display name (best effort)',
              },
              timezone: {
                type: ['string', 'null'],
                description: 'User timezone (best effort)',
              },
              message: { type: 'string', description: 'Message text' },
              image_url_private_downloads: {
                type: 'array',
                description:
                  'Private download URLs for images attached to the message',
                items: { type: 'string' },
              },
            },
            required: ['user_id', 'name', 'timezone', 'message'],
          },
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
                  description:
                    'Message subtype (e.g., file_share when files attached)',
                },
                files: {
                  type: 'array',
                  description: 'Files attached to the message',
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
      required: ['text', 'channel', 'user', 'thread_histories', 'slack_event'],
    },
  },
  'slack/bot_mentioned': {
    serviceName: 'Slack',
    friendlyName: 'When Slack bot is mentioned',
    description: 'Triggered when someone mentions your bot in a Slack channel',
    requiredCredentialType: 'SLACK_CRED',
    requiredConfigFields: ['slack_active_channels'],
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
- \`users:read\` - To look up user names and timezones

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
        files: {
          type: 'array',
          description:
            'Files/images attached to the mention message. Use url_private with bot token to download.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique file identifier' },
              name: { type: 'string', description: 'Filename with extension' },
              title: { type: 'string', description: 'Display title' },
              mimetype: {
                type: 'string',
                description: 'MIME type (e.g., image/png)',
              },
              filetype: {
                type: 'string',
                description: 'File extension (e.g., png)',
              },
              size: { type: 'number', description: 'File size in bytes' },
              url_private: {
                type: 'string',
                description: 'Private URL to access file (requires bot token)',
              },
              url_private_download: {
                type: 'string',
                description:
                  'Private URL to download file (requires bot token)',
              },
              thumb_360: {
                type: 'string',
                description: '360px thumbnail URL for images',
              },
              thumb_480: {
                type: 'string',
                description: '480px thumbnail URL for images',
              },
              original_w: {
                type: 'number',
                description: 'Original image width in pixels',
              },
              original_h: {
                type: 'number',
                description: 'Original image height in pixels',
              },
              permalink: {
                type: 'string',
                description: 'Permanent link to the file',
              },
            },
          },
        },
        thread_histories: {
          type: 'array',
          description:
            'Thread history messages including current message for non-threaded events',
          items: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'Slack user ID or bot ID',
              },
              name: {
                type: 'string',
                description: 'User display name (best effort)',
              },
              timezone: {
                type: ['string', 'null'],
                description: 'User timezone (best effort)',
              },
              message: { type: 'string', description: 'Message text' },
              image_url_private_downloads: {
                type: 'array',
                description:
                  'Private download URLs for images attached to the message',
                items: { type: 'string' },
              },
            },
            required: ['user_id', 'name', 'timezone', 'message'],
          },
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
                files: {
                  type: 'array',
                  description: 'Files attached to the mention message',
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
      required: ['text', 'channel', 'user', 'thread_histories', 'slack_event'],
    },
  },
  'slack/reaction_added': {
    serviceName: 'Slack',
    friendlyName: 'When emoji reaction is added',
    description:
      'Triggered when a user adds an emoji reaction to a message in a Slack channel',
    requiredCredentialType: 'SLACK_CRED',
    requiredConfigFields: ['slack_active_channels'],
    setupGuide: `## Slack Reaction Event Setup Guide

### 1. Create a Slack App
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace

### 2. Configure OAuth Scopes
Navigate to **OAuth & Permissions** and add these Bot Token Scopes:
- \`reactions:read\` - To receive reaction events
- \`channels:history\` - To fetch the reacted message text
- \`groups:history\` - To fetch messages in private channels
- \`chat:write\` - To send messages
- \`users:read\` - To look up user names

### 3. Enable Event Subscriptions
1. Go to **Event Subscriptions**
2. Toggle "Enable Events" to ON
3. Toggle the webhook active button above and copy the webhook URL
4. Add your webhook URL to the Request URL field
5. Subscribe to bot events: \`reaction_added\`

### 4. Install to Workspace
1. Go to **Install App**
2. Click "Install to Workspace"
3. Authorize the requested permissions

### 5. Get Your Bot Token
Copy the **Bot User OAuth Token** (starts with \`xoxb-\`) from the OAuth & Permissions page.`,
    payloadSchema: {
      type: 'object',
      properties: {
        reaction: {
          type: 'string',
          description: 'Emoji reaction name (e.g. "thumbsup", "heart")',
        },
        user: {
          type: 'string',
          description: 'User ID who added the reaction',
        },
        channel: {
          type: 'string',
          description: 'Channel ID where the reacted message lives',
        },
        item_ts: {
          type: 'string',
          description: 'Timestamp of the message that was reacted to',
        },
        item_user: {
          type: 'string',
          description: 'User ID who authored the original message',
        },
        item: {
          type: 'object',
          description: 'Full item reference from the reaction event',
          properties: {
            type: {
              type: 'string',
              enum: ['message', 'file', 'file_comment'],
              description: 'Type of item that was reacted to',
            },
            channel: { type: 'string', description: 'Channel ID' },
            ts: { type: 'string', description: 'Message timestamp' },
            file: { type: 'string', description: 'File ID (if file reaction)' },
            file_comment: {
              type: 'string',
              description: 'File comment ID (if file comment reaction)',
            },
          },
        },
        message_text: {
          type: 'string',
          description:
            'Text of the original message that was reacted to (fetched via API, best-effort)',
        },
        event_ts: {
          type: 'string',
          description: 'Event timestamp',
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
              description: 'Inner reaction_added event data',
              properties: {
                type: {
                  type: 'string',
                  enum: ['reaction_added'],
                  description: 'Event type',
                },
                user: {
                  type: 'string',
                  description: 'User ID who added the reaction',
                },
                reaction: {
                  type: 'string',
                  description: 'Emoji reaction name',
                },
                item_user: {
                  type: 'string',
                  description: 'User who authored the reacted item',
                },
                item: {
                  type: 'object',
                  description: 'The item that was reacted to',
                },
                event_ts: { type: 'string', description: 'Event timestamp' },
              },
              required: ['type', 'user', 'reaction', 'item', 'event_ts'],
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
      required: ['reaction', 'user', 'item', 'slack_event'],
    },
  },
  'slack/approval_resumed': {
    serviceName: 'Slack',
    friendlyName: 'When approval is granted',
    description:
      'Triggered internally when a human approves a pending flow action via Slack approval buttons',
    setupGuide:
      'This trigger is used internally by the approval system. It fires automatically when a user clicks "Approve" on an approval request in Slack.',
    payloadSchema: {
      type: 'object',
      properties: {
        approvalId: {
          type: 'string',
          description: 'The approval record ID',
        },
        action: {
          type: 'string',
          description:
            'The action that was approved (e.g. run-flow, activate-flow)',
        },
        targetFlowId: {
          type: 'number',
          description: 'The target flow ID',
        },
        channel: {
          type: 'string',
          description: 'Slack channel of the approval thread',
        },
        threadTs: {
          type: 'string',
          description: 'Slack thread timestamp',
        },
        approvedBy: {
          type: 'string',
          description: 'User who approved the action',
        },
      },
      required: [
        'approvalId',
        'action',
        'targetFlowId',
        'channel',
        'threadTs',
        'approvedBy',
      ],
    },
  },
  'airtable/record_created': {
    serviceName: 'Airtable',
    friendlyName: 'When Airtable record is created',
    description: 'Triggered when a new record is created in an Airtable base',
    requiredCredentialType: 'AIRTABLE_OAUTH',
    requiredConfigFields: ['airtable_base_id'],
    setupGuide: `## Airtable Record Created Setup Guide

### 1. Connect Your Airtable Account
1. Go to Credentials and add an Airtable OAuth connection
2. Authorize access to your Airtable workspace

### 2. Create a Webhook
Webhooks must be created via the Airtable API. The system will handle this automatically when you configure the trigger.

### 3. Configure the Trigger
1. Select your Airtable credential
2. Choose the base and table to monitor
3. The webhook will be created automatically

### Payload Structure
The payload includes:
- \`base_id\`: The Airtable base ID
- \`table_id\`: The table where records were created
- \`airtable_event.records\`: Map of record IDs to their field values`,
    payloadSchema: {
      type: 'object',
      properties: {
        base_id: { type: 'string', description: 'Airtable base ID' },
        table_id: {
          type: 'string',
          description: 'Table ID where record was created',
        },
        airtable_event: {
          type: 'object',
          description: 'Full Airtable event data',
        },
      },
      required: ['base_id', 'table_id', 'airtable_event'],
    },
  },
  'airtable/record_updated': {
    serviceName: 'Airtable',
    friendlyName: 'When Airtable record is updated',
    description: 'Triggered when a record is updated in an Airtable base',
    requiredCredentialType: 'AIRTABLE_OAUTH',
    requiredConfigFields: ['airtable_base_id'],
    setupGuide: `## Airtable Record Updated Setup Guide

### 1. Connect Your Airtable Account
1. Go to Credentials and add an Airtable OAuth connection
2. Authorize access to your Airtable workspace

### 2. Configure the Trigger
1. Select your Airtable credential
2. Choose the base and table to monitor
3. The webhook will be created automatically

### Payload Structure
The payload includes:
- \`base_id\`: The Airtable base ID
- \`table_id\`: The table where records were updated
- \`airtable_event.records\`: Map of record IDs to their current and previous field values`,
    payloadSchema: {
      type: 'object',
      properties: {
        base_id: { type: 'string', description: 'Airtable base ID' },
        table_id: {
          type: 'string',
          description: 'Table ID where record was updated',
        },
        airtable_event: {
          type: 'object',
          description:
            'Full Airtable event data with current and previous values',
        },
      },
      required: ['base_id', 'table_id', 'airtable_event'],
    },
  },
  'airtable/record_deleted': {
    serviceName: 'Airtable',
    friendlyName: 'When Airtable record is deleted',
    description: 'Triggered when a record is deleted from an Airtable base',
    requiredCredentialType: 'AIRTABLE_OAUTH',
    requiredConfigFields: ['airtable_base_id'],
    setupGuide: `## Airtable Record Deleted Setup Guide

### 1. Connect Your Airtable Account
1. Go to Credentials and add an Airtable OAuth connection
2. Authorize access to your Airtable workspace

### 2. Configure the Trigger
1. Select your Airtable credential
2. Choose the base and table to monitor
3. The webhook will be created automatically

### Payload Structure
The payload includes:
- \`base_id\`: The Airtable base ID
- \`table_id\`: The table where records were deleted
- \`airtable_event.recordIds\`: Array of deleted record IDs`,
    payloadSchema: {
      type: 'object',
      properties: {
        base_id: { type: 'string', description: 'Airtable base ID' },
        table_id: {
          type: 'string',
          description: 'Table ID where record was deleted',
        },
        airtable_event: {
          type: 'object',
          description: 'Full Airtable event data with deleted record IDs',
        },
      },
      required: ['base_id', 'table_id', 'airtable_event'],
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
  return (
    eventType !== 'webhook/http' &&
    eventType !== 'schedule/cron' &&
    eventType !== 'slack/approval_resumed'
  );
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
  SlackReactionAddedEvent: 'slack/reaction_added',
  SlackApprovalResumedEvent: 'slack/approval_resumed',
  AirtableRecordCreatedEvent: 'airtable/record_created',
  AirtableRecordUpdatedEvent: 'airtable/record_updated',
  AirtableRecordDeletedEvent: 'airtable/record_deleted',
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

// ============================================================================
// Airtable Trigger Configuration Types
// ============================================================================

/** Delay options for Airtable triggers (in seconds) */
export const AIRTABLE_DELAY_OPTIONS = [0, 30, 60, 120, 300, 600] as const;
export type AirtableDelaySeconds = (typeof AIRTABLE_DELAY_OPTIONS)[number];

/** User-friendly labels for delay options */
export const AIRTABLE_DELAY_LABELS: Record<AirtableDelaySeconds, string> = {
  0: 'No delay',
  30: '30 seconds',
  60: '1 minute',
  120: '2 minutes',
  300: '5 minutes',
  600: '10 minutes',
};

/** Airtable base metadata */
export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: 'none' | 'read' | 'comment' | 'edit' | 'create';
}

/** Airtable table metadata */
export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
}

/** Extended table metadata with fields */
export interface AirtableTableFull extends AirtableTable {
  primaryFieldId: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
  }>;
}

/** Type-safe keys for Airtable trigger defaultInputs */
export const AIRTABLE_TRIGGER_CONFIG_KEYS = {
  BASE_ID: 'airtable_base_id',
  TABLE_ID: 'airtable_table_id',
  WEBHOOK_ID: 'airtable_webhook_id',
  MAC_SECRET: 'airtable_mac_secret',
  WEBHOOK_EXPIRATION: 'airtable_webhook_expiration',
  DELAY_SECONDS: 'airtable_trigger_delay_seconds',
} as const;

/** Airtable trigger configuration stored in defaultInputs */
export interface AirtableTriggerConfig {
  airtable_base_id?: string;
  airtable_table_id?: string;
  airtable_webhook_id?: string;
  airtable_mac_secret?: string;
  airtable_webhook_expiration?: string;
  airtable_trigger_delay_seconds?: AirtableDelaySeconds;
}

/** Extract typed Airtable config from defaultInputs */
export function getAirtableTriggerConfig(
  defaultInputs: Record<string, unknown>
): AirtableTriggerConfig {
  return {
    airtable_base_id: defaultInputs.airtable_base_id as string | undefined,
    airtable_table_id: defaultInputs.airtable_table_id as string | undefined,
    airtable_webhook_id: defaultInputs.airtable_webhook_id as
      | string
      | undefined,
    airtable_mac_secret: defaultInputs.airtable_mac_secret as
      | string
      | undefined,
    airtable_webhook_expiration: defaultInputs.airtable_webhook_expiration as
      | string
      | undefined,
    airtable_trigger_delay_seconds:
      defaultInputs.airtable_trigger_delay_seconds as
        | AirtableDelaySeconds
        | undefined,
  };
}

/** Helper type for Airtable event types */
export type AirtableEventType = Extract<
  keyof BubbleTriggerEventRegistry,
  `airtable/${string}`
>;
