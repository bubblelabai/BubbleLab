/**
 * Slack Bubble Schema Definitions
 * All Zod schemas for Slack operations
 */
import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Slack API base URL
export const SLACK_API_BASE = 'https://slack.com/api';

// ============================================================================
// CHANNEL TYPES
// ============================================================================

export const ChannelTypes = z
  .enum(['public_channel', 'private_channel', 'mpim', 'im'])
  .describe(
    'Types of Slack channels: public_channel, private_channel, mpim (multi-person direct message), im (direct message)'
  );

// ============================================================================
// MESSAGE ATTACHMENT SCHEMA
// ============================================================================

export const MessageAttachmentSchema = z.object({
  color: z
    .string()
    .optional()
    .describe('Color bar accent (hex color or good/warning/danger)'),
  pretext: z
    .string()
    .optional()
    .describe('Text that appears before the main attachment content'),
  author_name: z
    .string()
    .optional()
    .describe('Author name displayed at the top'),
  author_link: z
    .string()
    .url()
    .optional()
    .describe('URL to link the author name'),
  author_icon: z.string().url().optional().describe('Author icon image URL'),
  title: z.string().optional().describe('Attachment title text'),
  title_link: z.string().url().optional().describe('URL to link the title'),
  text: z.string().optional().describe('Main attachment text content'),
  fields: z
    .array(
      z.object({
        title: z.string().describe('Field title'),
        value: z.string().describe('Field value'),
        short: z
          .boolean()
          .optional()
          .describe('Whether field should be displayed side-by-side'),
      })
    )
    .optional()
    .describe('Array of field objects for structured data'),
  image_url: z.string().url().optional().describe('URL of image to display'),
  thumb_url: z.string().url().optional().describe('URL of thumbnail image'),
  footer: z.string().optional().describe('Footer text'),
  footer_icon: z.string().url().optional().describe('Footer icon URL'),
  ts: z.number().optional().describe('Timestamp for the attachment'),
});

// ============================================================================
// BLOCK KIT SCHEMA
// ============================================================================

export const BlockElementSchema = z
  .object({
    type: z
      .string()
      .describe('Block element type (section, divider, button, etc.)'),
    text: z
      .object({
        type: z.enum(['plain_text', 'mrkdwn']).describe('Text formatting type'),
        text: z.string().describe('The actual text content'),
        emoji: z.boolean().optional(),
        verbatim: z.boolean().optional(),
      })
      .optional()
      .describe('Text object for the block element'),
    elements: z
      .array(
        z.object({
          type: z
            .enum(['plain_text', 'mrkdwn', 'image'])
            .describe('Element type'),
          text: z.string().optional().describe('Text content'),
          image_url: z
            .string()
            .optional()
            .describe('Image URL for image elements'),
          alt_text: z
            .string()
            .optional()
            .describe('Alt text for image elements'),
          emoji: z.boolean().optional(),
          verbatim: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Elements array for context blocks'),
  })
  .passthrough()
  .describe('Block Kit element for rich message formatting');

// ============================================================================
// PARAMETERS SCHEMA (DISCRIMINATED UNION)
// ============================================================================

export const SlackParamsSchema = z.discriminatedUnion('operation', [
  // Send message operation
  z.object({
    operation: z
      .literal('send_message')
      .describe(
        'Send a message to a Slack channel or DM. Required scopes: chat:write (add chat:write.public for public channels bot has not joined, add im:write to send DMs to users)'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890), channel name (e.g., general or #general), or user ID for DM (e.g., U1234567890 - requires im:write scope)'
      ),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe('Message text content'),
    username: z
      .string()
      .optional()
      .describe('Override bot username for this message'),
    icon_emoji: z
      .string()
      .optional()
      .describe('Override bot icon with emoji (e.g., :robot_face:)'),
    icon_url: z
      .string()
      .url()
      .optional()
      .describe('Override bot icon with custom image URL'),
    attachments: z
      .array(MessageAttachmentSchema)
      .optional()
      .describe('Legacy message attachments'),
    blocks: z
      .array(BlockElementSchema)
      .optional()
      .describe('Block Kit structured message blocks'),
    thread_ts: z
      .string()
      .optional()
      .describe('Timestamp of parent message to reply in thread'),
    reply_broadcast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Broadcast thread reply to channel'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
    unfurl_links: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable automatic link unfurling'),
    unfurl_media: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable automatic media unfurling'),
  }),

  // List channels operation
  z.object({
    operation: z
      .literal('list_channels')
      .describe(
        'List all channels in the Slack workspace. Required scopes: channels:read (public), groups:read (private), im:read (DMs), mpim:read (group DMs)'
      ),
    types: z
      .array(ChannelTypes)
      .optional()
      .default(['public_channel', 'private_channel', 'mpim', 'im'])
      .describe('Types of channels to include in results'),
    exclude_archived: z
      .boolean()
      .optional()
      .default(true)
      .describe('Exclude archived channels from results'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(50)
      .describe('Maximum number of channels to return (1-1000)'),
    cursor: z
      .string()
      .optional()
      .describe('Cursor for pagination to get next set of results'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get channel info operation
  z.object({
    operation: z
      .literal('get_channel_info')
      .describe(
        'Get detailed information about a specific channel. Required scopes: channels:read (public), groups:read (private), im:read (DMs), mpim:read (group DMs)'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general)'
      ),
    include_locale: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include locale information in the response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get user info operation
  z.object({
    operation: z
      .literal('get_user_info')
      .describe(
        'Get detailed information about a specific user. Required scopes: users:read (add users:read.email to access email field)'
      ),
    user: z
      .string()
      .min(1, 'User ID is required')
      .describe('User ID to get information about'),
    include_locale: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include locale information in the response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List users operation
  z.object({
    operation: z
      .literal('list_users')
      .describe(
        'List all users in the Slack workspace. Required scopes: users:read (add users:read.email to access email field)'
      ),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(50)
      .describe('Maximum number of users to return (1-1000)'),
    cursor: z
      .string()
      .optional()
      .describe('Cursor for pagination to get next set of results'),
    include_locale: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include locale information in the response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get conversation history operation
  z.object({
    operation: z
      .literal('get_conversation_history')
      .describe(
        'Retrieve message history from a channel or direct message. Required scopes: channels:history (public), groups:history (private), im:history (DMs), mpim:history (group DMs)'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general)'
      ),
    latest: z
      .string()
      .optional()
      .describe('End of time range of messages to include (timestamp)'),
    oldest: z
      .string()
      .optional()
      .describe('Start of time range of messages to include (timestamp)'),
    inclusive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include messages with latest or oldest timestamps in results'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(20)
      .describe('Maximum number of messages to return (1-1000)'),
    cursor: z
      .string()
      .optional()
      .describe('Cursor for pagination to get next set of results'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get thread replies operation
  z.object({
    operation: z
      .literal('get_thread_replies')
      .describe(
        'Retrieve all replies to a thread in a channel. Required scopes: channels:history (public), groups:history (private), im:history (DMs), mpim:history (group DMs)'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID is required')
      .describe('Channel ID where the thread exists'),
    ts: z
      .string()
      .min(1, 'Thread timestamp is required')
      .describe('Timestamp of the parent message to get replies for'),
    latest: z
      .string()
      .optional()
      .describe('End of time range of messages to include (timestamp)'),
    oldest: z
      .string()
      .optional()
      .describe('Start of time range of messages to include (timestamp)'),
    inclusive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include messages with latest or oldest timestamps in results'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Maximum number of messages to return (1-1000)'),
    cursor: z
      .string()
      .optional()
      .describe('Cursor for pagination to get next set of results'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update message operation
  z.object({
    operation: z
      .literal('update_message')
      .describe(
        'Update an existing message in a channel. Required scopes: chat:write'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general) where the message is located'
      ),
    ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to update'),
    text: z.string().optional().describe('New text content for the message'),
    attachments: z
      .array(MessageAttachmentSchema)
      .optional()
      .describe('New legacy message attachments'),
    blocks: z
      .array(BlockElementSchema)
      .optional()
      .describe('New Block Kit structured message blocks'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete message operation
  z.object({
    operation: z
      .literal('delete_message')
      .describe(
        'Delete a message from a channel. Required scopes: chat:write. Note: Bot tokens can only delete messages posted by the bot; user tokens can delete any message the user has permission to delete'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general) where the message is located'
      ),
    ts: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Add reaction operation
  z.object({
    operation: z
      .literal('add_reaction')
      .describe(
        'Add an emoji reaction to a message. Required scopes: reactions:write'
      ),
    name: z
      .string()
      .min(1, 'Emoji name is required')
      .describe('Emoji name without colons (e.g., thumbsup, heart)'),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general) where the message is located'
      ),
    timestamp: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to react to'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Remove reaction operation
  z.object({
    operation: z
      .literal('remove_reaction')
      .describe(
        'Remove an emoji reaction from a message. Required scopes: reactions:write'
      ),
    name: z
      .string()
      .min(1, 'Emoji name is required')
      .describe('Emoji name without colons (e.g., thumbsup, heart)'),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general) where the message is located'
      ),
    timestamp: z
      .string()
      .min(1, 'Message timestamp is required')
      .describe('Timestamp of the message to remove reaction from'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Join channel operation
  z.object({
    operation: z
      .literal('join_channel')
      .describe(
        'Join a public Slack channel. Required scopes: channels:join (bot token) or channels:write (user token)'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890) or channel name (e.g., general or #general) to join'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Upload file operation
  z.object({
    operation: z
      .literal('upload_file')
      .describe(
        'Upload a file to a Slack channel. Required scopes: files:write'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890), channel name (e.g., general or #general), or user ID for DM'
      ),
    file_path: z
      .string()
      .min(1, 'File path is required')
      .describe('Local file path to upload'),
    filename: z
      .string()
      .optional()
      .describe('Override filename for the upload'),
    title: z.string().optional().describe('Title for the file'),
    initial_comment: z
      .string()
      .optional()
      .describe('Initial comment to post with the file'),
    thread_ts: z
      .string()
      .optional()
      .describe('Timestamp of parent message to upload file in thread'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Schedule message operation
  z.object({
    operation: z
      .literal('schedule_message')
      .describe(
        'Schedule a message to be sent at a future time. Required scopes: chat:write. Max 120 days in advance.'
      ),
    channel: z
      .string()
      .min(1, 'Channel ID or name is required')
      .describe(
        'Channel ID (e.g., C1234567890), channel name (e.g., general or #general), or user ID for DM'
      ),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe('Message text content'),
    post_at: z
      .number()
      .int()
      .positive()
      .describe(
        'Unix timestamp (seconds) for when to send the message. Must be within 120 days from now.'
      ),
    thread_ts: z
      .string()
      .optional()
      .describe('Timestamp of parent message to reply in thread'),
    blocks: z
      .array(BlockElementSchema)
      .optional()
      .describe('Block Kit structured message blocks'),
    unfurl_links: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable automatic link unfurling'),
    unfurl_media: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable automatic media unfurling'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// ============================================================================
// RESPONSE DATA SCHEMAS
// ============================================================================

export const SlackChannelSchema = z
  .object({
    id: z.string().describe('Unique channel identifier'),
    name: z.string().describe('Channel name without # prefix'),
    is_channel: z
      .boolean()
      .optional()
      .describe('True if this is a public channel'),
    is_group: z
      .boolean()
      .optional()
      .describe('True if this is a private channel'),
    is_im: z.boolean().optional().describe('True if this is a direct message'),
    is_mpim: z
      .boolean()
      .optional()
      .describe('True if this is a multi-person direct message'),
    is_private: z
      .boolean()
      .optional()
      .describe('True if this is a private channel'),
    created: z.number().describe('Unix timestamp when channel was created'),
    is_archived: z.boolean().describe('True if channel is archived'),
    is_general: z
      .boolean()
      .optional()
      .describe('True if this is the #general channel'),
    unlinked: z
      .number()
      .optional()
      .describe('Unix timestamp when channel was unlinked'),
    name_normalized: z.string().optional().describe('Normalized channel name'),
    is_shared: z
      .boolean()
      .optional()
      .describe('True if channel is shared with other workspaces'),
    is_ext_shared: z
      .boolean()
      .optional()
      .describe('True if channel is shared externally'),
    is_org_shared: z
      .boolean()
      .optional()
      .describe('True if channel is shared across organization'),
    shared_team_ids: z
      .array(z.string())
      .optional()
      .describe('IDs of teams this channel is shared with'),
    pending_shared: z
      .array(z.string())
      .optional()
      .describe('Pending shared connections'),
    pending_connected_team_ids: z
      .array(z.string())
      .optional()
      .describe('Pending team connection IDs'),
    is_pending_ext_shared: z
      .boolean()
      .optional()
      .describe('True if external sharing is pending'),
    is_member: z
      .boolean()
      .optional()
      .describe('True if the bot is a member of this channel'),
    is_open: z.boolean().optional().describe('True if the channel is open'),
    topic: z
      .object({
        value: z.string().describe('Topic text'),
        creator: z.string().describe('User ID who set the topic'),
        last_set: z.number().describe('Unix timestamp when topic was last set'),
      })
      .optional()
      .describe('Channel topic information'),
    purpose: z
      .object({
        value: z.string().describe('Purpose text'),
        creator: z.string().describe('User ID who set the purpose'),
        last_set: z
          .number()
          .describe('Unix timestamp when purpose was last set'),
      })
      .optional()
      .describe('Channel purpose information'),
    num_members: z
      .number()
      .optional()
      .describe('Number of members in the channel'),
  })
  .describe('Slack channel object with metadata');

export const SlackUserSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    team_id: z.string().optional().describe('Team/workspace ID'),
    name: z.string().describe('Username (handle without @)'),
    deleted: z.boolean().optional().describe('True if user account is deleted'),
    color: z.string().optional().describe('Color code for user in UI'),
    real_name: z.string().optional().describe('Users real name'),
    tz: z.string().optional().describe('Timezone identifier'),
    tz_label: z.string().optional().describe('Human-readable timezone label'),
    tz_offset: z
      .number()
      .optional()
      .describe('Timezone offset from UTC in seconds'),
    profile: z
      .object({
        title: z.string().optional().describe('Job title'),
        phone: z.string().optional().describe('Phone number'),
        skype: z.string().optional().describe('Skype username'),
        real_name: z.string().optional().describe('Real name from profile'),
        real_name_normalized: z
          .string()
          .optional()
          .describe('Normalized real name'),
        display_name: z.string().optional().describe('Display name'),
        display_name_normalized: z
          .string()
          .optional()
          .describe('Normalized display name'),
        fields: z
          .record(z.unknown())
          .optional()
          .describe('Custom profile fields'),
        status_text: z.string().optional().describe('Current status text'),
        status_emoji: z.string().optional().describe('Current status emoji'),
        status_expiration: z
          .number()
          .optional()
          .describe('Unix timestamp when status expires'),
        avatar_hash: z.string().optional().describe('Hash for avatar image'),
        image_original: z
          .string()
          .optional()
          .describe('URL of original avatar image'),
        is_custom_image: z
          .boolean()
          .optional()
          .describe('True if using custom avatar'),
        email: z.string().optional().describe('Email address'),
        first_name: z.string().optional().describe('First name'),
        last_name: z.string().optional().describe('Last name'),
        image_24: z.string().optional().describe('24x24 pixel avatar URL'),
        image_32: z.string().optional().describe('32x32 pixel avatar URL'),
        image_48: z.string().optional().describe('48x48 pixel avatar URL'),
        image_72: z.string().optional().describe('72x72 pixel avatar URL'),
        image_192: z.string().optional().describe('192x192 pixel avatar URL'),
        image_512: z.string().optional().describe('512x512 pixel avatar URL'),
        image_1024: z
          .string()
          .optional()
          .describe('1024x1024 pixel avatar URL'),
      })
      .optional()
      .describe('User profile information'),
    is_admin: z
      .boolean()
      .optional()
      .describe('True if user is workspace admin'),
    is_owner: z
      .boolean()
      .optional()
      .describe('True if user is workspace owner'),
    is_primary_owner: z
      .boolean()
      .optional()
      .describe('True if user is primary workspace owner'),
    is_restricted: z
      .boolean()
      .optional()
      .describe('True if user is restricted (single-channel guest)'),
    is_ultra_restricted: z
      .boolean()
      .optional()
      .describe('True if user is ultra restricted (multi-channel guest)'),
    is_bot: z.boolean().optional().describe('True if this is a bot user'),
    is_app_user: z.boolean().optional().describe('True if this is an app user'),
    updated: z
      .number()
      .optional()
      .describe('Unix timestamp when user was last updated'),
    has_2fa: z
      .boolean()
      .optional()
      .describe('True if user has two-factor authentication enabled'),
  })
  .describe('Slack user object with profile and permissions');

export const SlackMessageSchema = z
  .object({
    type: z.string().describe('Message type (usually "message")'),
    ts: z.string().optional().describe('Message timestamp (unique identifier)'),
    user: z.string().optional().describe('User ID who sent the message'),
    bot_id: z
      .string()
      .optional()
      .describe('Bot ID if message was sent by a bot'),
    bot_profile: z
      .object({
        name: z.string().optional().describe('Bot display name'),
      })
      .optional()
      .describe('Bot profile information if message was sent by a bot'),
    username: z
      .string()
      .optional()
      .describe('Username of the bot or user who sent the message'),
    text: z.string().optional().describe('Message text content'),
    thread_ts: z
      .string()
      .optional()
      .describe('Timestamp of parent message if this is a thread reply'),
    parent_user_id: z
      .string()
      .optional()
      .describe('User ID of thread parent message author'),
    reply_count: z
      .number()
      .optional()
      .describe('Number of replies in this thread'),
    reply_users_count: z
      .number()
      .optional()
      .describe('Number of unique users who replied in thread'),
    latest_reply: z
      .string()
      .optional()
      .describe('Timestamp of most recent reply in thread'),
    reply_users: z
      .array(z.string())
      .optional()
      .describe('Array of user IDs who replied in thread'),
    is_locked: z.boolean().optional().describe('True if thread is locked'),
    subscribed: z
      .boolean()
      .optional()
      .describe('True if current user is subscribed to thread'),
    attachments: z
      .array(z.unknown())
      .optional()
      .describe('Legacy message attachments'),
    blocks: z
      .array(z.unknown())
      .optional()
      .describe('Block Kit structured content'),
    reactions: z
      .array(
        z.object({
          name: z.string().describe('Emoji name without colons'),
          users: z
            .array(z.string())
            .describe('User IDs who reacted with this emoji'),
          count: z.number().describe('Total count of this reaction'),
        })
      )
      .optional()
      .describe('Array of emoji reactions on this message'),
  })
  .describe('Slack message object with content and metadata');

// ============================================================================
// RESULT SCHEMAS (DISCRIMINATED UNION)
// ============================================================================

export const SlackResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('send_message')
      .describe('Send a message to a Slack channel or DM'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: z
      .string()
      .optional()
      .describe('Channel ID where the message was sent'),
    ts: z.string().optional().describe('Timestamp of the sent message'),
    message: SlackMessageSchema.optional().describe(
      'Details of the sent message'
    ),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('list_channels')
      .describe('List all channels in the Slack workspace'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channels: z
      .array(SlackChannelSchema)
      .optional()
      .describe('Array of channel objects'),
    response_metadata: z
      .object({
        next_cursor: z
          .string()
          .describe('Cursor for pagination to get next set of results'),
      })
      .optional()
      .describe('Metadata for pagination'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_channel_info')
      .describe('Get detailed information about a specific channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: SlackChannelSchema.optional().describe(
      'Channel information object'
    ),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_user_info')
      .describe('Get detailed information about a specific user'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    user: SlackUserSchema.optional().describe('User information object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('list_users')
      .describe('List all users in the Slack workspace'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    members: z
      .array(SlackUserSchema)
      .optional()
      .describe('Array of user objects'),
    response_metadata: z
      .object({
        next_cursor: z
          .string()
          .describe('Cursor for pagination to get next set of results'),
      })
      .optional()
      .describe('Metadata for pagination'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_conversation_history')
      .describe('Retrieve message history from a channel or direct message'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    messages: z
      .array(SlackMessageSchema)
      .optional()
      .describe('Array of message objects'),
    has_more: z
      .boolean()
      .optional()
      .describe('Whether there are more messages to retrieve'),
    response_metadata: z
      .object({
        next_cursor: z
          .string()
          .describe('Cursor for pagination to get next set of results'),
      })
      .optional()
      .describe('Metadata for pagination'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_thread_replies')
      .describe('Retrieve all replies to a thread in a channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    messages: z
      .array(SlackMessageSchema)
      .optional()
      .describe('Array of message objects in the thread'),
    has_more: z
      .boolean()
      .optional()
      .describe('Whether there are more messages to retrieve'),
    response_metadata: z
      .object({
        next_cursor: z
          .string()
          .describe('Cursor for pagination to get next set of results'),
      })
      .optional()
      .describe('Metadata for pagination'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('update_message')
      .describe('Update an existing message in a channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: z
      .string()
      .optional()
      .describe('Channel ID where the message was updated'),
    ts: z.string().optional().describe('Timestamp of the updated message'),
    text: z.string().optional().describe('Updated text content of the message'),
    message: SlackMessageSchema.optional().describe(
      'Details of the updated message'
    ),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('delete_message')
      .describe('Delete a message from a channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: z
      .string()
      .optional()
      .describe('Channel ID where the message was deleted'),
    ts: z.string().optional().describe('Timestamp of the deleted message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('add_reaction')
      .describe('Add an emoji reaction to a message'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('remove_reaction')
      .describe('Remove an emoji reaction from a message'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('join_channel')
      .describe('Join a public Slack channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: SlackChannelSchema.optional().describe(
      'Channel information object after joining'
    ),
    already_in_channel: z
      .boolean()
      .optional()
      .describe('Whether the bot was already a member of the channel'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('upload_file')
      .describe('Upload a file to a Slack channel'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    file: z
      .object({
        id: z.string().describe('Unique file identifier'),
        created: z.number().describe('Unix timestamp when file was created'),
        timestamp: z.number().describe('Unix timestamp when file was uploaded'),
        name: z.string().describe('Original filename'),
        title: z.string().optional().describe('File title'),
        mimetype: z.string().describe('MIME type of the file'),
        filetype: z.string().describe('File type extension'),
        pretty_type: z.string().describe('Human-readable file type'),
        user: z.string().describe('User ID who uploaded the file'),
        editable: z.boolean().describe('Whether the file is editable'),
        size: z.number().describe('File size in bytes'),
        mode: z.string().describe('File sharing mode'),
        is_external: z
          .boolean()
          .describe('Whether file is from external source'),
        external_type: z.string().describe('External file type if applicable'),
        is_public: z.boolean().describe('Whether file is publicly accessible'),
        public_url_shared: z.boolean().describe('Whether public URL is shared'),
        display_as_bot: z
          .boolean()
          .describe('Whether file is displayed as uploaded by bot'),
        username: z.string().describe('Username of uploader'),
        url_private: z.string().describe('Private URL to access file'),
        url_private_download: z.string().describe('Private download URL'),
        permalink: z.string().describe('Permanent link to file'),
        permalink_public: z
          .string()
          .optional()
          .describe('Public permanent link'),
        shares: z
          .object({
            public: z
              .record(
                z.array(
                  z.object({
                    reply_users: z
                      .array(z.string())
                      .describe('User IDs who replied'),
                    reply_users_count: z
                      .number()
                      .describe('Number of unique users who replied'),
                    reply_count: z.number().describe('Total number of replies'),
                    ts: z.string().describe('Timestamp of the share'),
                    channel_name: z.string().describe('Name of the channel'),
                    team_id: z.string().describe('Team ID'),
                  })
                )
              )
              .optional()
              .describe('Public channel shares'),
            private: z
              .record(
                z.array(
                  z.object({
                    reply_users: z
                      .array(z.string())
                      .describe('User IDs who replied'),
                    reply_users_count: z
                      .number()
                      .describe('Number of unique users who replied'),
                    reply_count: z.number().describe('Total number of replies'),
                    ts: z.string().describe('Timestamp of the share'),
                    channel_name: z.string().describe('Name of the channel'),
                    team_id: z.string().describe('Team ID'),
                  })
                )
              )
              .optional()
              .describe('Private channel shares'),
          })
          .optional()
          .describe('Information about where file is shared'),
        channels: z
          .array(z.string())
          .optional()
          .describe('Channel IDs where file is shared'),
        groups: z
          .array(z.string())
          .optional()
          .describe('Private group IDs where file is shared'),
        ims: z
          .array(z.string())
          .optional()
          .describe('Direct message IDs where file is shared'),
        has_rich_preview: z
          .boolean()
          .optional()
          .describe('Whether file has rich preview'),
      })
      .optional()
      .describe('File information object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('schedule_message')
      .describe('Schedule a message to be sent at a future time'),
    ok: z.boolean().describe('Whether the Slack API call was successful'),
    channel: z
      .string()
      .optional()
      .describe('Channel ID where message will be posted'),
    scheduled_message_id: z
      .string()
      .optional()
      .describe('Unique identifier for the scheduled message'),
    post_at: z
      .number()
      .optional()
      .describe('Unix timestamp when message will be posted'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type SlackParamsInput = z.input<typeof SlackParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation)
export type SlackParams = z.output<typeof SlackParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type SlackResult = z.output<typeof SlackResultSchema>;

// Helper type to get the result type for a specific operation
export type SlackOperationResult<T extends SlackParamsInput['operation']> =
  Extract<SlackResult, { operation: T }>;

// ============================================================================
// API INTERFACES
// ============================================================================

export interface SlackApiError {
  ok: false;
  error: string;
  response_metadata?: {
    warnings?: string[];
    messages?: string[];
  };
}

export interface SlackApiResponse {
  ok: true;
  [key: string]: unknown;
}
