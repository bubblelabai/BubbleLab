import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ─── Shared Fields ────────────────────────────────────────────────────

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const channelIdField = z
  .string()
  .min(1, 'Channel ID is required')
  .describe('Discord channel ID (snowflake)');

const guildIdField = z
  .string()
  .optional()
  .describe(
    'Discord guild/server ID (snowflake). Auto-filled from credential if not provided.'
  );

const limitField = z
  .number()
  .min(1)
  .max(100)
  .optional()
  .default(25)
  .describe('Maximum number of results to return (1-100, default 25)');

// ─── Embed Schema ─────────────────────────────────────────────────────

const EmbedFieldSchema = z.object({
  name: z.string().describe('Field name'),
  value: z.string().describe('Field value'),
  inline: z.boolean().optional().describe('Whether to display inline'),
});

const EmbedSchema = z.object({
  title: z.string().optional().describe('Embed title'),
  description: z.string().optional().describe('Embed description text'),
  url: z.string().url().optional().describe('Embed title URL'),
  color: z
    .number()
    .optional()
    .describe('Embed color as decimal integer (e.g. 0x5865F2 = 5793266)'),
  fields: z
    .array(EmbedFieldSchema)
    .optional()
    .describe('Array of embed fields'),
  footer: z
    .object({
      text: z.string().describe('Footer text'),
      icon_url: z.string().url().optional().describe('Footer icon URL'),
    })
    .optional()
    .describe('Embed footer'),
  thumbnail: z
    .object({ url: z.string().url().describe('Thumbnail image URL') })
    .optional()
    .describe('Embed thumbnail'),
  image: z
    .object({ url: z.string().url().describe('Image URL') })
    .optional()
    .describe('Embed image'),
  author: z
    .object({
      name: z.string().describe('Author name'),
      url: z.string().url().optional().describe('Author URL'),
      icon_url: z.string().url().optional().describe('Author icon URL'),
    })
    .optional()
    .describe('Embed author'),
  timestamp: z.string().optional().describe('ISO 8601 timestamp for the embed'),
});

// ─── Parameter Schema ─────────────────────────────────────────────────

export const DiscordParamsSchema = z.discriminatedUnion('operation', [
  // ── Messages ───────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('send_message')
      .describe(
        'Send a message to a Discord channel. Requires Send Messages permission.'
      ),
    channel_id: channelIdField,
    content: z
      .string()
      .max(2000)
      .optional()
      .describe('[ONEOF:body] Message text content (max 2000 chars)'),
    embeds: z
      .array(EmbedSchema)
      .max(10)
      .optional()
      .describe('[ONEOF:body] Rich embed objects (max 10)'),
    tts: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether this is a text-to-speech message'),
    reply_to: z
      .string()
      .optional()
      .describe('Message ID to reply to (creates a threaded reply)'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_messages')
      .describe(
        'Read messages from a Discord channel. Requires Read Message History permission.'
      ),
    channel_id: channelIdField,
    limit: limitField,
    before: z
      .string()
      .optional()
      .describe('Get messages before this message ID (for pagination)'),
    after: z
      .string()
      .optional()
      .describe('Get messages after this message ID (for pagination)'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('edit_message')
      .describe('Edit a message sent by the bot'),
    channel_id: channelIdField,
    message_id: z
      .string()
      .min(1, 'Message ID is required')
      .describe('ID of the message to edit'),
    content: z
      .string()
      .max(2000)
      .optional()
      .describe('New message text content'),
    embeds: z
      .array(EmbedSchema)
      .max(10)
      .optional()
      .describe('New embed objects'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('delete_message')
      .describe(
        'Delete a message. Bot can delete own messages or others with Manage Messages permission.'
      ),
    channel_id: channelIdField,
    message_id: z
      .string()
      .min(1, 'Message ID is required')
      .describe('ID of the message to delete'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('pin_message')
      .describe(
        'Pin a message in a channel. Requires Manage Messages permission.'
      ),
    channel_id: channelIdField,
    message_id: z
      .string()
      .min(1, 'Message ID is required')
      .describe('ID of the message to pin'),
    credentials: credentialsField,
  }),

  // ── Reactions ──────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('add_reaction')
      .describe(
        'Add a reaction emoji to a message. Requires Add Reactions permission.'
      ),
    channel_id: channelIdField,
    message_id: z
      .string()
      .min(1, 'Message ID is required')
      .describe('ID of the message to react to'),
    emoji: z
      .string()
      .min(1, 'Emoji is required')
      .describe(
        'Unicode emoji (e.g. "👍") or custom emoji in name:id format (e.g. "my_emoji:123456")'
      ),
    credentials: credentialsField,
  }),

  // ── Channels ───────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_channels')
      .describe(
        'List all channels in a guild/server. Requires View Channels permission.'
      ),
    guild_id: guildIdField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_channel')
      .describe(
        'Create a new channel in a guild. Requires Manage Channels permission.'
      ),
    guild_id: guildIdField,
    name: z
      .string()
      .min(1)
      .max(100)
      .describe('Channel name (will be lowercased and hyphenated by Discord)'),
    type: z
      .enum(['text', 'voice', 'category', 'announcement', 'forum'])
      .optional()
      .default('text')
      .describe('Channel type (default: text)'),
    topic: z
      .string()
      .max(1024)
      .optional()
      .describe('Channel topic/description'),
    parent_id: z
      .string()
      .optional()
      .describe('Parent category channel ID to nest this channel under'),
    nsfw: z.boolean().optional().describe('Whether channel is NSFW'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('delete_channel')
      .describe(
        'Delete a channel. Requires Manage Channels permission. This cannot be undone.'
      ),
    channel_id: channelIdField,
    credentials: credentialsField,
  }),

  // ── Threads ────────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('create_thread')
      .describe(
        'Create a new thread in a channel. Requires Send Messages permission.'
      ),
    channel_id: channelIdField,
    name: z.string().min(1).max(100).describe('Thread name'),
    message_id: z
      .string()
      .optional()
      .describe(
        'Message ID to start thread from (omit to create a thread without a starter message)'
      ),
    auto_archive_duration: z
      .enum(['60', '1440', '4320', '10080'])
      .optional()
      .default('1440')
      .describe(
        'Minutes of inactivity before auto-archive: 60 (1hr), 1440 (24hr), 4320 (3d), 10080 (7d)'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_threads')
      .describe('List active threads in a guild'),
    guild_id: guildIdField,
    credentials: credentialsField,
  }),

  // ── Members ────────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_members')
      .describe(
        'List members of a guild/server. Requires Server Members Intent.'
      ),
    guild_id: guildIdField,
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Maximum number of members to return (1-1000, default 100)'),
    after: z
      .string()
      .optional()
      .describe('Get members after this user ID (for pagination)'),
    credentials: credentialsField,
  }),

  // ── Guild Info ─────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('get_guild')
      .describe('Get information about the guild/server'),
    guild_id: guildIdField,
    credentials: credentialsField,
  }),
]);

// ─── Discord Resource Schema ──────────────────────────────────────────

const DiscordResourceSchema = z
  .record(z.string(), z.unknown())
  .describe('A Discord resource object with its fields');

// ─── Result Schema ────────────────────────────────────────────────────

export const DiscordResultSchema = z.discriminatedUnion('operation', [
  // Messages
  z.object({
    operation: z.literal('send_message'),
    success: z.boolean(),
    message: DiscordResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_messages'),
    success: z.boolean(),
    messages: z.array(DiscordResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('edit_message'),
    success: z.boolean(),
    message: DiscordResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_message'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('pin_message'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Reactions
  z.object({
    operation: z.literal('add_reaction'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Channels
  z.object({
    operation: z.literal('list_channels'),
    success: z.boolean(),
    channels: z.array(DiscordResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_channel'),
    success: z.boolean(),
    channel: DiscordResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_channel'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Threads
  z.object({
    operation: z.literal('create_thread'),
    success: z.boolean(),
    thread: DiscordResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_threads'),
    success: z.boolean(),
    threads: z.array(DiscordResourceSchema).optional(),
    error: z.string(),
  }),
  // Members
  z.object({
    operation: z.literal('list_members'),
    success: z.boolean(),
    members: z.array(DiscordResourceSchema).optional(),
    error: z.string(),
  }),
  // Guild
  z.object({
    operation: z.literal('get_guild'),
    success: z.boolean(),
    guild: DiscordResourceSchema.optional(),
    error: z.string(),
  }),
]);

// ─── Type Exports ─────────────────────────────────────────────────────

export type DiscordParamsInput = z.input<typeof DiscordParamsSchema>;
export type DiscordParams = z.output<typeof DiscordParamsSchema>;
export type DiscordResult = z.output<typeof DiscordResultSchema>;
