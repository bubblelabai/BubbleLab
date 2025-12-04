import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Telegram Bot API base URL
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// Define parse mode for message formatting
const ParseMode = z
  .enum(['HTML', 'Markdown', 'MarkdownV2'])
  .optional()
  .describe('Text formatting mode (HTML, Markdown, or MarkdownV2)');

// Define inline keyboard button schema
const InlineKeyboardButtonSchema = z.object({
  text: z.string().describe('Button text'),
  url: z.string().url().optional().describe('HTTP or tg:// URL to open'),
  callback_data: z
    .string()
    .max(64)
    .optional()
    .describe('Callback data (max 64 bytes)'),
  web_app: z.record(z.unknown()).optional().describe('Web App information'),
  login_url: z.record(z.unknown()).optional().describe('Login URL information'),
  switch_inline_query: z.string().optional().describe('Switch to inline query'),
  switch_inline_query_current_chat: z
    .string()
    .optional()
    .describe('Switch to inline query in current chat'),
  callback_game: z.record(z.unknown()).optional().describe('Callback game'),
  pay: z.boolean().optional().describe('Pay button'),
});

// Define inline keyboard markup schema
const InlineKeyboardMarkupSchema = z.object({
  inline_keyboard: z
    .array(z.array(InlineKeyboardButtonSchema))
    .describe('Array of button rows'),
});

// Define reply keyboard button schema
const KeyboardButtonSchema = z.object({
  text: z.string().describe('Button text'),
  request_contact: z.boolean().optional().describe('Request user contact'),
  request_location: z.boolean().optional().describe('Request user location'),
  request_poll: z
    .object({
      type: z.enum(['quiz', 'regular']).optional(),
    })
    .optional()
    .describe('Request poll'),
  web_app: z.record(z.unknown()).optional().describe('Web App information'),
});

// Define reply keyboard markup schema
const ReplyKeyboardMarkupSchema = z.object({
  keyboard: z
    .array(z.array(KeyboardButtonSchema))
    .describe('Array of button rows'),
  is_persistent: z.boolean().optional().describe('Show keyboard to all users'),
  resize_keyboard: z
    .boolean()
    .optional()
    .describe('Resize keyboard to fit buttons'),
  one_time_keyboard: z.boolean().optional().describe('Hide keyboard after use'),
  input_field_placeholder: z
    .string()
    .optional()
    .describe('Placeholder for input field'),
  selective: z
    .boolean()
    .optional()
    .describe('Show keyboard to specific users only'),
});

// Define reply markup union
const ReplyMarkupSchema = z
  .union([InlineKeyboardMarkupSchema, ReplyKeyboardMarkupSchema])
  .optional()
  .describe('Inline keyboard or reply keyboard markup');

// Define the parameters schema for different Telegram operations
const TelegramParamsSchema = z.discriminatedUnion('operation', [
  // Send message operation
  z.object({
    operation: z
      .literal('send_message')
      .describe('Send a text message to a Telegram chat'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe(
        'Unique identifier for the target chat or username (e.g., @channelusername)'
      ),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe('Text of the message to be sent'),
    parse_mode: ParseMode,
    entities: z
      .array(z.unknown())
      .optional()
      .describe('List of special entities in the message text'),
    disable_web_page_preview: z
      .boolean()
      .optional()
      .describe('Disable link previews for links in this message'),
    disable_notification: z
      .boolean()
      .optional()
      .describe('Sends the message silently'),
    protect_content: z
      .boolean()
      .optional()
      .describe('Protects the content from forwarding and saving'),
    reply_to_message_id: z
      .number()
      .optional()
      .describe('If the message is a reply, ID of the original message'),
    allow_sending_without_reply: z
      .boolean()
      .optional()
      .describe(
        'Allow sending message even if the replied message is not found'
      ),
    reply_markup: ReplyMarkupSchema,
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Send photo operation
  z.object({
    operation: z
      .literal('send_photo')
      .describe('Send a photo to a Telegram chat'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    photo: z
      .union([z.string().url(), z.string()])
      .describe('Photo to send (file_id, HTTP URL, or file path)'),
    caption: z.string().optional().describe('Photo caption'),
    parse_mode: ParseMode,
    caption_entities: z
      .array(z.unknown())
      .optional()
      .describe('List of special entities in the caption'),
    has_spoiler: z.boolean().optional().describe('Mark photo as spoiler'),
    disable_notification: z
      .boolean()
      .optional()
      .describe('Sends the message silently'),
    protect_content: z
      .boolean()
      .optional()
      .describe('Protects the content from forwarding and saving'),
    reply_to_message_id: z
      .number()
      .optional()
      .describe('If the message is a reply, ID of the original message'),
    allow_sending_without_reply: z
      .boolean()
      .optional()
      .describe(
        'Allow sending message even if the replied message is not found'
      ),
    reply_markup: ReplyMarkupSchema,
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Send document operation
  z.object({
    operation: z
      .literal('send_document')
      .describe('Send a document to a Telegram chat'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    document: z
      .union([z.string().url(), z.string()])
      .describe('File to send (file_id, HTTP URL, or file path)'),
    thumbnail: z
      .union([z.string().url(), z.string()])
      .optional()
      .describe('Thumbnail of the file'),
    caption: z.string().optional().describe('Document caption'),
    parse_mode: ParseMode,
    caption_entities: z
      .array(z.unknown())
      .optional()
      .describe('List of special entities in the caption'),
    disable_content_type_detection: z
      .boolean()
      .optional()
      .describe('Disable automatic file type detection'),
    disable_notification: z
      .boolean()
      .optional()
      .describe('Sends the message silently'),
    protect_content: z
      .boolean()
      .optional()
      .describe('Protects the content from forwarding and saving'),
    reply_to_message_id: z
      .number()
      .optional()
      .describe('If the message is a reply, ID of the original message'),
    allow_sending_without_reply: z
      .boolean()
      .optional()
      .describe(
        'Allow sending message even if the replied message is not found'
      ),
    reply_markup: ReplyMarkupSchema,
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Edit message operation
  z.object({
    operation: z
      .literal('edit_message')
      .describe('Edit a previously sent message'),
    chat_id: z
      .union([z.string(), z.number()])
      .optional()
      .describe('Unique identifier for the target chat or username'),
    message_id: z
      .number()
      .optional()
      .describe('Identifier of the message to edit'),
    inline_message_id: z
      .string()
      .optional()
      .describe('Identifier of the inline message to edit'),
    text: z.string().min(1).describe('New text of the message'),
    parse_mode: ParseMode,
    entities: z
      .array(z.unknown())
      .optional()
      .describe('List of special entities in the message text'),
    disable_web_page_preview: z
      .boolean()
      .optional()
      .describe('Disable link previews for links in this message'),
    reply_markup: InlineKeyboardMarkupSchema.optional(),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete message operation
  z.object({
    operation: z.literal('delete_message').describe('Delete a message'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    message_id: z.number().describe('Identifier of the message to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get me operation
  z.object({
    operation: z.literal('get_me').describe('Get bot information'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get chat operation
  z.object({
    operation: z.literal('get_chat').describe('Get information about a chat'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get updates operation
  z.object({
    operation: z
      .literal('get_updates')
      .describe('Receive incoming updates using long polling'),
    offset: z
      .number()
      .optional()
      .describe('Identifier of the first update to be returned'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Limits the number of updates to be retrieved (1-100)'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in seconds for long polling'),
    allowed_updates: z
      .array(z.string())
      .optional()
      .describe('List of update types to receive'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Send chat action operation
  z.object({
    operation: z
      .literal('send_chat_action')
      .describe(
        "Tell the user that something is happening on the bot's side (typing, uploading photo, etc.)"
      ),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    action: z
      .enum([
        'typing',
        'upload_photo',
        'record_video',
        'upload_video',
        'record_voice',
        'upload_voice',
        'upload_document',
        'find_location',
        'record_video_note',
        'upload_video_note',
        'choose_sticker',
      ])
      .describe('Type of action to broadcast'),
    message_thread_id: z
      .number()
      .optional()
      .describe(
        'Unique identifier for the target message thread (for forum topics)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Set message reaction operation
  z.object({
    operation: z
      .literal('set_message_reaction')
      .describe('Add a reaction to a message'),
    chat_id: z
      .union([z.string(), z.number()])
      .describe('Unique identifier for the target chat or username'),
    message_id: z.number().describe('Identifier of the message to react to'),
    reaction: z
      .array(
        z.union([
          z.object({
            type: z.literal('emoji'),
            emoji: z.string().describe('Emoji reaction (e.g., "👍", "❤️")'),
          }),
          z.object({
            type: z.literal('custom_emoji'),
            custom_emoji_id: z.string().describe('Custom emoji identifier'),
          }),
        ])
      )
      .optional()
      .describe('Array of reactions to set (empty array to remove reactions)'),
    is_big: z
      .boolean()
      .optional()
      .describe('Pass True to set the reaction with a bigger animation'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Set webhook operation
  z.object({
    operation: z
      .literal('set_webhook')
      .describe('Specify a URL to receive incoming updates via webhook'),
    url: z
      .union([z.literal(''), z.string().url()])
      .describe(
        'HTTPS URL to send updates to. Use an empty string to remove webhook integration'
      ),
    ip_address: z
      .string()
      .optional()
      .describe(
        'The fixed IP address which will be used to send webhook requests instead of the IP address resolved through DNS'
      ),
    max_connections: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery (1-100). Defaults to 40'
      ),
    allowed_updates: z
      .array(z.string())
      .optional()
      .describe(
        'A list of update types you want your bot to receive (e.g., ["message", "callback_query"])'
      ),
    drop_pending_updates: z
      .boolean()
      .optional()
      .describe('Pass True to drop all pending updates'),
    secret_token: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional()
      .describe(
        'A secret token to be sent in the X-Telegram-Bot-Api-Secret-Token header (1-256 characters, A-Z, a-z, 0-9, _, -)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete webhook operation
  z.object({
    operation: z
      .literal('delete_webhook')
      .describe('Remove webhook integration to switch back to getUpdates'),
    drop_pending_updates: z
      .boolean()
      .optional()
      .describe('Pass True to drop all pending updates'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get webhook info operation
  z.object({
    operation: z
      .literal('get_webhook_info')
      .describe('Get current webhook status and information'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Type definitions
export type TelegramParams = z.infer<typeof TelegramParamsSchema>;
export type TelegramParamsParsed = z.output<typeof TelegramParamsSchema>;
export type TelegramParamsInput = z.input<typeof TelegramParamsSchema>;

// Define WebhookInfo schema
const TelegramWebhookInfoSchema = z.object({
  url: z
    .string()
    .describe('Webhook URL, may be empty if webhook is not set up'),
  has_custom_certificate: z
    .boolean()
    .describe(
      'True, if a custom certificate was provided for webhook certificate checks'
    ),
  pending_update_count: z
    .number()
    .describe('Number of updates awaiting delivery'),
  ip_address: z
    .string()
    .optional()
    .describe('Currently used webhook IP address'),
  last_error_date: z
    .number()
    .optional()
    .describe(
      'Unix time for the most recent error that happened when trying to deliver an update via webhook'
    ),
  last_error_message: z
    .string()
    .optional()
    .describe(
      'Error message in human-readable format for the most recent error that happened when trying to deliver an update via webhook'
    ),
  last_synchronization_error_date: z
    .number()
    .optional()
    .describe(
      'Unix time of the most recent error that happened when trying to synchronize available updates with Telegram datacenters'
    ),
  max_connections: z
    .number()
    .optional()
    .describe(
      'The maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery'
    ),
  allowed_updates: z
    .array(z.string())
    .optional()
    .describe(
      'A list of update types the bot is subscribed to. Defaults to all update types except chat_member'
    ),
});

// Type aliases for schema inference (for type assertions without parsing)
type TelegramMessage = z.infer<typeof TelegramMessageSchema>;
type TelegramUser = z.infer<typeof TelegramUserSchema>;
type TelegramChat = z.infer<typeof TelegramChatSchema>;
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
type TelegramWebhookInfo = z.infer<typeof TelegramWebhookInfoSchema>;

// Define result schemas for different operations
const TelegramMessageSchema = z.object({
  message_id: z.number().describe('Unique message identifier'),
  from: z
    .object({
      id: z.number().describe('User identifier'),
      is_bot: z.boolean().describe('True if user is a bot'),
      first_name: z.string().describe('User first name'),
      last_name: z.string().optional().describe('User last name'),
      username: z.string().optional().describe('User username'),
      language_code: z.string().optional().describe('User language code'),
    })
    .optional()
    .describe('Sender information'),
  date: z.number().describe('Date the message was sent (Unix time)'),
  chat: z
    .object({
      id: z.number().describe('Chat identifier'),
      type: z
        .enum(['private', 'group', 'supergroup', 'channel'])
        .describe('Chat type'),
      title: z.string().optional().describe('Chat title'),
      username: z.string().optional().describe('Chat username'),
      first_name: z
        .string()
        .optional()
        .describe('First name (for private chats)'),
      last_name: z
        .string()
        .optional()
        .describe('Last name (for private chats)'),
    })
    .describe('Chat information'),
  text: z.string().optional().describe('Message text'),
  photo: z
    .array(
      z.object({
        file_id: z.string().describe('File identifier'),
        file_unique_id: z.string().describe('Unique file identifier'),
        width: z.number().describe('Photo width'),
        height: z.number().describe('Photo height'),
        file_size: z.number().optional().describe('File size in bytes'),
      })
    )
    .optional()
    .describe('Message photo'),
  document: z
    .object({
      file_id: z.string().describe('File identifier'),
      file_unique_id: z.string().describe('Unique file identifier'),
      file_name: z.string().optional().describe('Original filename'),
      mime_type: z.string().optional().describe('MIME type'),
      file_size: z.number().optional().describe('File size in bytes'),
    })
    .optional()
    .describe('Message document'),
});

const TelegramUserSchema = z.object({
  id: z.number().describe('User identifier'),
  is_bot: z.boolean().describe('True if user is a bot'),
  first_name: z.string().describe('User first name'),
  last_name: z.string().optional().describe('User last name'),
  username: z.string().optional().describe('User username'),
  language_code: z.string().optional().describe('User language code'),
});

const TelegramChatSchema = z.object({
  id: z.number().describe('Chat identifier'),
  type: z
    .enum(['private', 'group', 'supergroup', 'channel'])
    .describe('Chat type'),
  title: z.string().optional().describe('Chat title'),
  username: z.string().optional().describe('Chat username'),
  first_name: z.string().optional().describe('First name (for private chats)'),
  last_name: z.string().optional().describe('Last name (for private chats)'),
  description: z.string().optional().describe('Chat description'),
  invite_link: z.string().optional().describe('Chat invite link'),
});

const TelegramUpdateSchema = z.object({
  update_id: z.number().describe('Update identifier'),
  message: TelegramMessageSchema.optional().describe('New incoming message'),
  edited_message: TelegramMessageSchema.optional().describe('Edited message'),
  channel_post: TelegramMessageSchema.optional().describe('New channel post'),
  edited_channel_post: TelegramMessageSchema.optional().describe(
    'Edited channel post'
  ),
  callback_query: z
    .object({
      id: z.string().describe('Callback query identifier'),
      from: TelegramUserSchema.describe('User who sent the callback'),
      message: TelegramMessageSchema.optional().describe(
        'Message with the callback button'
      ),
      inline_message_id: z
        .string()
        .optional()
        .describe('Inline message identifier'),
      chat_instance: z.string().describe('Global identifier for the chat'),
      data: z.string().optional().describe('Callback data'),
      game_short_name: z.string().optional().describe('Game short name'),
    })
    .optional()
    .describe('New incoming callback query'),
});

const TelegramResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('send_message')
      .describe('Send a text message to a Telegram chat'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    message: TelegramMessageSchema.optional().describe('Sent message object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('send_photo')
      .describe('Send a photo to a Telegram chat'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    message: TelegramMessageSchema.optional().describe('Sent message object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('send_document')
      .describe('Send a document to a Telegram chat'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    message: TelegramMessageSchema.optional().describe('Sent message object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('edit_message')
      .describe('Edit a previously sent message'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    message: TelegramMessageSchema.optional().describe('Edited message object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z.literal('delete_message').describe('Delete a message'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z.literal('get_me').describe('Get bot information'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    user: TelegramUserSchema.optional().describe('Bot user object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z.literal('get_chat').describe('Get information about a chat'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    chat: TelegramChatSchema.optional().describe('Chat object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_updates')
      .describe('Receive incoming updates using long polling'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    updates: z
      .array(TelegramUpdateSchema)
      .optional()
      .describe('Array of Update objects'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('send_chat_action')
      .describe("Tell the user that something is happening on the bot's side"),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('set_message_reaction')
      .describe('Add a reaction to a message'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('set_webhook')
      .describe('Specify a URL to receive incoming updates via webhook'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('delete_webhook')
      .describe('Remove webhook integration to switch back to getUpdates'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_webhook_info')
      .describe('Get current webhook status and information'),
    ok: z.boolean().describe('Whether the Telegram API call was successful'),
    webhook_info: TelegramWebhookInfoSchema.optional().describe(
      'Webhook information object'
    ),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),
]);

export type TelegramResult = z.infer<typeof TelegramResultSchema>;

export class TelegramBubble<
  T extends TelegramParams = TelegramParams,
> extends ServiceBubble<
  T,
  Extract<TelegramResult, { operation: T['operation'] }>
> {
  public async testCredential(): Promise<boolean> {
    // Make a test API call to the Telegram API
    const response = await this.makeTelegramApiCall('getMe', {});
    if (response.ok) {
      return true;
    }
    return false;
  }

  static readonly type = 'service' as const;
  static readonly service = 'telegram';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'telegram';
  static readonly schema = TelegramParamsSchema;
  static readonly resultSchema = TelegramResultSchema;
  static readonly shortDescription =
    'Telegram Bot API integration for messaging and bot management';
  static readonly longDescription = `
    Comprehensive Telegram Bot API integration bubble for managing messages, chats, and bot operations.
    Use cases:
    - Send text messages, photos, and documents to chats
    - Edit and delete messages
    - Get bot and chat information
    - Receive updates via polling or webhooks
    - Support for inline keyboards and reply keyboards
    
    Security Features:
    - Bot token-based authentication
    - Parameter validation and sanitization
    - Rate limiting awareness
    - Comprehensive error handling
  `;
  static readonly alias = 'telegram';

  constructor(
    params: T = {
      operation: 'get_me',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    // If no credentials were injected, return undefined
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // Telegram bubble always uses Telegram bot token credentials
    // Using string literal since CredentialType enum may not be updated in type system yet
    return credentials['TELEGRAM_BOT_TOKEN'];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<TelegramResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<TelegramResult> => {
        switch (operation) {
          case 'send_message':
            return await this.sendMessage(this.params);
          case 'send_photo':
            return await this.sendPhoto(this.params);
          case 'send_document':
            return await this.sendDocument(this.params);
          case 'edit_message':
            return await this.editMessage(this.params);
          case 'delete_message':
            return await this.deleteMessage(this.params);
          case 'get_me':
            return await this.getMe(this.params);
          case 'get_chat':
            return await this.getChat(this.params);
          case 'get_updates':
            return await this.getUpdates(this.params);
          case 'send_chat_action':
            return await this.sendChatAction(this.params);
          case 'set_message_reaction':
            return await this.setMessageReaction(this.params);
          case 'set_webhook':
            return await this.setWebhook(this.params);
          case 'delete_webhook':
            return await this.deleteWebhook(this.params);
          case 'get_webhook_info':
            return await this.getWebhookInfo(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<TelegramResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      return {
        success: false,
        ok: false,
        operation: failedOperation,
        error: error instanceof Error ? error.message : String(error),
      } as Extract<TelegramResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Make an API call to the Telegram Bot API
   */
  private async makeTelegramApiCall(
    method: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean;
    result?: unknown;
    error_code?: number;
    description?: string;
  }> {
    const token = this.chooseCredential();
    if (!token) {
      throw new Error('Telegram bot token is required');
    }

    const url = `${TELEGRAM_API_BASE}${token}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        ok: boolean;
        result?: unknown;
        error_code?: number;
        description?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          error_code: data.error_code,
          description: data.description || 'Unknown error',
        };
      }

      return data;
    } catch (error) {
      throw new Error(
        `Telegram API call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sendMessage(
    params: Extract<TelegramParams, { operation: 'send_message' }>
  ): Promise<Extract<TelegramResult, { operation: 'send_message' }>> {
    const {
      chat_id,
      text,
      parse_mode,
      entities,
      disable_web_page_preview,
      disable_notification,
      protect_content,
      reply_to_message_id,
      allow_sending_without_reply,
      reply_markup,
    } = params;

    const body: Record<string, unknown> = {
      chat_id,
      text,
    };

    if (parse_mode) body.parse_mode = parse_mode;
    if (entities) body.entities = entities;
    if (disable_web_page_preview !== undefined)
      body.disable_web_page_preview = disable_web_page_preview;
    if (disable_notification !== undefined)
      body.disable_notification = disable_notification;
    if (protect_content !== undefined) body.protect_content = protect_content;
    if (reply_to_message_id !== undefined)
      body.reply_to_message_id = reply_to_message_id;
    if (allow_sending_without_reply !== undefined)
      body.allow_sending_without_reply = allow_sending_without_reply;
    if (reply_markup) body.reply_markup = reply_markup;

    const response = await this.makeTelegramApiCall('sendMessage', body);

    return {
      operation: 'send_message',
      ok: response.ok,
      message:
        response.ok && response.result
          ? (response.result as TelegramMessage)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async sendPhoto(
    params: Extract<TelegramParams, { operation: 'send_photo' }>
  ): Promise<Extract<TelegramResult, { operation: 'send_photo' }>> {
    const {
      chat_id,
      photo,
      caption,
      parse_mode,
      caption_entities,
      has_spoiler,
      disable_notification,
      protect_content,
      reply_to_message_id,
      allow_sending_without_reply,
      reply_markup,
    } = params;

    const body: Record<string, unknown> = {
      chat_id,
      photo,
    };

    if (caption) body.caption = caption;
    if (parse_mode) body.parse_mode = parse_mode;
    if (caption_entities) body.caption_entities = caption_entities;
    if (has_spoiler !== undefined) body.has_spoiler = has_spoiler;
    if (disable_notification !== undefined)
      body.disable_notification = disable_notification;
    if (protect_content !== undefined) body.protect_content = protect_content;
    if (reply_to_message_id !== undefined)
      body.reply_to_message_id = reply_to_message_id;
    if (allow_sending_without_reply !== undefined)
      body.allow_sending_without_reply = allow_sending_without_reply;
    if (reply_markup) body.reply_markup = reply_markup;

    const response = await this.makeTelegramApiCall('sendPhoto', body);

    return {
      operation: 'send_photo',
      ok: response.ok,
      message:
        response.ok && response.result
          ? (response.result as TelegramMessage)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async sendDocument(
    params: Extract<TelegramParams, { operation: 'send_document' }>
  ): Promise<Extract<TelegramResult, { operation: 'send_document' }>> {
    const {
      chat_id,
      document,
      thumbnail,
      caption,
      parse_mode,
      caption_entities,
      disable_content_type_detection,
      disable_notification,
      protect_content,
      reply_to_message_id,
      allow_sending_without_reply,
      reply_markup,
    } = params;

    const body: Record<string, unknown> = {
      chat_id,
      document,
    };

    if (thumbnail) body.thumbnail = thumbnail;
    if (caption) body.caption = caption;
    if (parse_mode) body.parse_mode = parse_mode;
    if (caption_entities) body.caption_entities = caption_entities;
    if (disable_content_type_detection !== undefined)
      body.disable_content_type_detection = disable_content_type_detection;
    if (disable_notification !== undefined)
      body.disable_notification = disable_notification;
    if (protect_content !== undefined) body.protect_content = protect_content;
    if (reply_to_message_id !== undefined)
      body.reply_to_message_id = reply_to_message_id;
    if (allow_sending_without_reply !== undefined)
      body.allow_sending_without_reply = allow_sending_without_reply;
    if (reply_markup) body.reply_markup = reply_markup;

    const response = await this.makeTelegramApiCall('sendDocument', body);

    return {
      operation: 'send_document',
      ok: response.ok,
      message:
        response.ok && response.result
          ? (response.result as TelegramMessage)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async editMessage(
    params: Extract<TelegramParams, { operation: 'edit_message' }>
  ): Promise<Extract<TelegramResult, { operation: 'edit_message' }>> {
    const {
      chat_id,
      message_id,
      inline_message_id,
      text,
      parse_mode,
      entities,
      disable_web_page_preview,
      reply_markup,
    } = params;

    const body: Record<string, unknown> = {
      text,
    };

    if (chat_id) body.chat_id = chat_id;
    if (message_id !== undefined) body.message_id = message_id;
    if (inline_message_id) body.inline_message_id = inline_message_id;
    if (parse_mode) body.parse_mode = parse_mode;
    if (entities) body.entities = entities;
    if (disable_web_page_preview !== undefined)
      body.disable_web_page_preview = disable_web_page_preview;
    if (reply_markup) body.reply_markup = reply_markup;

    const response = await this.makeTelegramApiCall('editMessageText', body);

    return {
      operation: 'edit_message',
      ok: response.ok,
      message:
        response.ok && response.result
          ? (response.result as TelegramMessage)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async deleteMessage(
    params: Extract<TelegramParams, { operation: 'delete_message' }>
  ): Promise<Extract<TelegramResult, { operation: 'delete_message' }>> {
    const { chat_id, message_id } = params;

    const body: Record<string, unknown> = {
      chat_id,
      message_id,
    };

    const response = await this.makeTelegramApiCall('deleteMessage', body);

    return {
      operation: 'delete_message',
      ok: response.ok,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async getMe(
    params: Extract<TelegramParams, { operation: 'get_me' }>
  ): Promise<Extract<TelegramResult, { operation: 'get_me' }>> {
    void params;

    const response = await this.makeTelegramApiCall('getMe', {});

    return {
      operation: 'get_me',
      ok: response.ok,
      user:
        response.ok && response.result
          ? (response.result as TelegramUser)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async getChat(
    params: Extract<TelegramParams, { operation: 'get_chat' }>
  ): Promise<Extract<TelegramResult, { operation: 'get_chat' }>> {
    const { chat_id } = params;

    const body: Record<string, unknown> = {
      chat_id,
    };

    const response = await this.makeTelegramApiCall('getChat', body);

    return {
      operation: 'get_chat',
      ok: response.ok,
      chat:
        response.ok && response.result
          ? (response.result as TelegramChat)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async getUpdates(
    params: Extract<TelegramParams, { operation: 'get_updates' }>
  ): Promise<Extract<TelegramResult, { operation: 'get_updates' }>> {
    const parsed = TelegramParamsSchema.parse(params);
    const { offset, limit, timeout, allowed_updates } = parsed as Extract<
      TelegramParamsParsed,
      { operation: 'get_updates' }
    >;

    const body: Record<string, unknown> = {};

    if (offset !== undefined) body.offset = offset;
    if (limit !== undefined) body.limit = limit;
    if (timeout !== undefined) body.timeout = timeout;
    if (allowed_updates) body.allowed_updates = allowed_updates;

    const response = await this.makeTelegramApiCall('getUpdates', body);

    return {
      operation: 'get_updates',
      ok: response.ok,
      updates:
        response.ok && response.result
          ? (response.result as TelegramUpdate[])
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async sendChatAction(
    params: Extract<TelegramParams, { operation: 'send_chat_action' }>
  ): Promise<Extract<TelegramResult, { operation: 'send_chat_action' }>> {
    const { chat_id, action, message_thread_id } = params;

    const body: Record<string, unknown> = {
      chat_id,
      action,
    };

    if (message_thread_id !== undefined)
      body.message_thread_id = message_thread_id;

    const response = await this.makeTelegramApiCall('sendChatAction', body);

    return {
      operation: 'send_chat_action',
      ok: response.ok,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async setMessageReaction(
    params: Extract<TelegramParams, { operation: 'set_message_reaction' }>
  ): Promise<Extract<TelegramResult, { operation: 'set_message_reaction' }>> {
    const { chat_id, message_id, reaction, is_big } = params;

    const body: Record<string, unknown> = {
      chat_id,
      message_id,
    };

    // Format reactions for Telegram API
    if (reaction !== undefined) {
      body.reaction = reaction.map((r) => {
        if (r.type === 'emoji') {
          return { type: 'emoji', emoji: r.emoji };
        } else {
          return { type: 'custom_emoji', custom_emoji_id: r.custom_emoji_id };
        }
      });
    } else {
      // Empty array to remove reactions
      body.reaction = [];
    }

    if (is_big !== undefined) body.is_big = is_big;

    const response = await this.makeTelegramApiCall('setMessageReaction', body);

    return {
      operation: 'set_message_reaction',
      ok: response.ok,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async setWebhook(
    params: Extract<TelegramParams, { operation: 'set_webhook' }>
  ): Promise<Extract<TelegramResult, { operation: 'set_webhook' }>> {
    const {
      url,
      ip_address,
      max_connections,
      allowed_updates,
      drop_pending_updates,
      secret_token,
    } = params;

    const body: Record<string, unknown> = {
      url,
    };

    if (ip_address !== undefined) body.ip_address = ip_address;
    if (max_connections !== undefined) body.max_connections = max_connections;
    if (allowed_updates !== undefined) body.allowed_updates = allowed_updates;
    if (drop_pending_updates !== undefined)
      body.drop_pending_updates = drop_pending_updates;
    if (secret_token !== undefined) body.secret_token = secret_token;

    const response = await this.makeTelegramApiCall('setWebhook', body);

    return {
      operation: 'set_webhook',
      ok: response.ok,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async deleteWebhook(
    params: Extract<TelegramParams, { operation: 'delete_webhook' }>
  ): Promise<Extract<TelegramResult, { operation: 'delete_webhook' }>> {
    const { drop_pending_updates } = params;

    const body: Record<string, unknown> = {};

    if (drop_pending_updates !== undefined)
      body.drop_pending_updates = drop_pending_updates;

    const response = await this.makeTelegramApiCall('deleteWebhook', body);

    return {
      operation: 'delete_webhook',
      ok: response.ok,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }

  private async getWebhookInfo(
    params: Extract<TelegramParams, { operation: 'get_webhook_info' }>
  ): Promise<Extract<TelegramResult, { operation: 'get_webhook_info' }>> {
    void params;

    const response = await this.makeTelegramApiCall('getWebhookInfo', {});

    return {
      operation: 'get_webhook_info',
      ok: response.ok,
      webhook_info:
        response.ok && response.result
          ? (response.result as TelegramWebhookInfo)
          : undefined,
      error: !response.ok
        ? response.description ||
          `Error code: ${response.error_code || 'unknown'}`
        : '',
      success: response.ok,
    };
  }
}
