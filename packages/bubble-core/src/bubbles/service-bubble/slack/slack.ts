/**
 * Slack Bubble - Comprehensive Slack integration
 * Supports messaging, channels, users, reactions, and file uploads
 */
import { z } from 'zod';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  SLACK_API_BASE,
  SlackParamsSchema,
  SlackResultSchema,
  SlackChannelSchema,
  SlackUserSchema,
  SlackMessageSchema,
  type SlackParams,
  type SlackParamsInput,
  type SlackResult,
  type SlackApiError,
  type SlackApiResponse,
} from './slack.schema.js';
import { markdownToMrkdwn } from './slack.utils.js';

export class SlackBubble<
  T extends SlackParamsInput = SlackParamsInput,
> extends ServiceBubble<
  T,
  Extract<SlackResult, { operation: T['operation'] }>
> {
  public async testCredential(): Promise<boolean> {
    const response = await this.makeSlackApiCall('auth.test', {});
    if (response.ok) {
      return true;
    }
    return false;
  }

  static readonly type = 'service' as const;
  static readonly service = 'slack';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'slack';
  static readonly schema = SlackParamsSchema;
  static readonly resultSchema = SlackResultSchema;
  static readonly shortDescription =
    'Slack integration for messaging and workspace management';
  static readonly longDescription = `
Comprehensive Slack integration for messaging and workspace management.
Supports both Bot tokens (xoxb-) and User tokens (xoxp-).

## Token Types: Bot vs User

| Aspect | Bot Token (xoxb-) | User Token (xoxp-) |
|--------|-------------------|-------------------|
| Identity | Acts as the bot | Acts as the authorizing user |
| Channel access | Only channels bot is added to | All channels user can access |
| Message deletion | Can only delete bot's own messages | Can delete any message user has permission for |
| Message posting | Messages appear from the bot | Messages appear from the user |
| Scope location | "Bot Token Scopes" section | "User Token Scopes" section |

Choose **Bot token** for: Automations, notifications, bots that act independently
Choose **User token** for: Acting on behalf of a user, accessing user's private channels

## Required OAuth Scopes by Operation

Configure in your Slack App: OAuth & Permissions page
Official docs: https://docs.slack.dev/reference/scopes/

### Messaging Operations
| Operation        | Bot Token Scope | User Token Scope |
|------------------|-----------------|------------------|
| send_message     | chat:write (+ chat:write.public for any public channel) | chat:write |
| send_message (to user DM) | chat:write + im:write | chat:write + im:write |
| schedule_message | chat:write | chat:write |
| update_message   | chat:write | chat:write |
| delete_message   | chat:write (own messages only) | chat:write (any deletable) |

**Note on DMs**: When you pass a user ID (e.g., U12345678) as the channel, SlackBubble automatically opens a DM conversation with that user. This requires the \`im:write\` scope in addition to \`chat:write\`.

### Channel & Conversation Operations
| Operation                | Bot Token Scope | User Token Scope |
|--------------------------|-----------------|------------------|
| list_channels            | channels:read, groups:read | channels:read, groups:read |
| get_channel_info         | channels:read OR groups:read | channels:read OR groups:read |
| join_channel             | channels:join | channels:write |
| get_conversation_history | channels:history, groups:history | channels:history, groups:history |
| get_thread_replies       | channels:history, groups:history | channels:history, groups:history |

### User Operations
| Operation     | Bot Token Scope | User Token Scope |
|---------------|-----------------|------------------|
| list_users    | users:read | users:read |
| get_user_info | users:read | users:read |
| (email field) | + users:read.email | + users:read.email |

### Reaction & File Operations
| Operation       | Bot Token Scope | User Token Scope |
|-----------------|-----------------|------------------|
| add_reaction    | reactions:write | reactions:write |
| remove_reaction | reactions:write | reactions:write |
| upload_file     | files:write | files:write |

### Direct Message (DM) Scopes
For operations on DMs and group DMs, add these additional scopes:
| Scope | Purpose |
|-------|---------|
| im:read | Access direct message channel info |
| im:write | Start direct message conversations |
| im:history | Read direct message history |
| mpim:read | Access group DM channel info |
| mpim:write | Start group DM conversations |
| mpim:history | Read group DM history |

## Quick Setup Guide

### For Bot Tokens (xoxb-)
1. Go to https://api.slack.com/apps → select your app
2. Navigate to "OAuth & Permissions"
3. Scroll to "Bot Token Scopes" section → add required scopes
4. Click "Install to Workspace" (or "Reinstall" if updating)
5. Copy "Bot User OAuth Token" (starts with xoxb-)

### For User Tokens (xoxp-)
1. Go to https://api.slack.com/apps → select your app
2. Navigate to "OAuth & Permissions"
3. Scroll to "User Token Scopes" section → add required scopes
4. Click "Install to Workspace" (or "Reinstall" if updating)
5. Copy "User OAuth Token" (starts with xoxp-)

## Minimum Recommended Scopes
For Bot Token: chat:write, channels:read, groups:read, users:read, channels:history
For User Token: chat:write, channels:read, groups:read, users:read, channels:history, channels:write

## Setting Up Slack Triggers (Event Subscriptions)

To trigger BubbleFlow workflows from Slack events (like @mentions), you need to configure Event Subscriptions.
Official docs: https://docs.slack.dev/apis/events-api/

### Supported Trigger Events
| Trigger Type | Slack Event | Required Scope |
|--------------|-------------|----------------|
| slack/bot_mentioned | app_mention | app_mentions:read |

### Step-by-Step Event Subscriptions Setup

**Step 1: Get your webhook URL from Bubble Lab**
- In Bubble Lab, create a flow with a Slack trigger (e.g., slack/bot_mentioned)
- Copy the webhook URL provided (format: https://api.bubblelab.ai/webhook/{userId}/{path})

**Step 2: Enable Event Subscriptions in Slack**
1. Go to https://api.slack.com/apps → select your app
2. Click "Event Subscriptions" in the left sidebar
3. Toggle "Enable Events" to ON

**Step 3: Configure Request URL**
1. Paste your Bubble Lab webhook URL in the "Request URL" field
2. Slack will send a verification challenge to your URL
3. Wait for the green "Verified" checkmark (Bubble Lab handles verification automatically)
4. If verification fails, click "Retry" (your server may need a moment to respond)

**Step 4: Subscribe to Bot Events**
1. Scroll down to "Subscribe to bot events"
2. Click "Add Bot User Event"
3. Add the events you need:
   - For @mentions: add "app_mention"
4. Click "Save Changes"

**Step 5: Add Required OAuth Scopes**
1. Go to "OAuth & Permissions" in the sidebar
2. Under "Bot Token Scopes", add:
   - app_mentions:read (for app_mention events)
3. Click "Save"

**Step 6: Reinstall Your App**
1. Go to "Install App" in the sidebar
2. Click "Reinstall to Workspace"
3. Authorize the new permissions

### Troubleshooting Event Subscriptions
- **Verification failed**: Ensure your webhook URL is correct and accessible
- **Not receiving events**: Check that you added the correct scopes AND reinstalled the app
- **Bot not responding**: Make sure the bot is invited to the channel where it's mentioned
  `;
  static readonly alias = 'slack';

  constructor(
    params: T = {
      operation: 'list_channels',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SlackResult, { operation: T['operation'] }>> {
    void context;

    // Cast to output type for internal use (base class already validated)
    const params = this.params as SlackParams;

    try {
      const result = await (async (): Promise<SlackResult> => {
        switch (params.operation) {
          case 'send_message':
            return await this.sendMessage(
              params as Extract<SlackParams, { operation: 'send_message' }>
            );
          case 'list_channels':
            return await this.listChannels(
              params as Extract<SlackParams, { operation: 'list_channels' }>
            );
          case 'get_channel_info':
            return await this.getChannelInfo(
              params as Extract<SlackParams, { operation: 'get_channel_info' }>
            );
          case 'get_user_info':
            return await this.getUserInfo(
              params as Extract<SlackParams, { operation: 'get_user_info' }>
            );
          case 'list_users':
            return await this.listUsers(
              params as Extract<SlackParams, { operation: 'list_users' }>
            );
          case 'get_conversation_history':
            return await this.getConversationHistory(
              params as Extract<
                SlackParams,
                { operation: 'get_conversation_history' }
              >
            );
          case 'get_thread_replies':
            return await this.getThreadReplies(
              params as Extract<
                SlackParams,
                { operation: 'get_thread_replies' }
              >
            );
          case 'update_message':
            return await this.updateMessage(
              params as Extract<SlackParams, { operation: 'update_message' }>
            );
          case 'delete_message':
            return await this.deleteMessage(
              params as Extract<SlackParams, { operation: 'delete_message' }>
            );
          case 'add_reaction':
            return await this.addReaction(
              params as Extract<SlackParams, { operation: 'add_reaction' }>
            );
          case 'remove_reaction':
            return await this.removeReaction(
              params as Extract<SlackParams, { operation: 'remove_reaction' }>
            );
          case 'upload_file':
            return await this.uploadFile(
              params as Extract<SlackParams, { operation: 'upload_file' }>
            );
          case 'join_channel':
            return await this.joinChannel(
              params as Extract<SlackParams, { operation: 'join_channel' }>
            );
          case 'schedule_message':
            return await this.scheduleMessage(
              params as Extract<SlackParams, { operation: 'schedule_message' }>
            );
          default: {
            // Exhaustive check - this should never happen if all operations are covered
            const exhaustiveCheck: never = params;
            throw new Error(
              `Unsupported operation: ${(exhaustiveCheck as SlackParams).operation}`
            );
          }
        }
      })();

      return result as Extract<SlackResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      return {
        success: false,
        ok: false,
        operation: failedOperation,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred in SlackBubble',
      } as Extract<SlackResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Helper method to resolve channel names to channel IDs.
   */
  private async resolveChannelId(channelInput: string): Promise<string> {
    if (/^[CGD][A-Z0-9]+$/i.test(channelInput)) {
      return channelInput;
    }

    if (/^[UW][A-Z0-9]+$/i.test(channelInput)) {
      const dmChannel = await this.openDmConversation(channelInput);
      return dmChannel;
    }

    const channelName = channelInput.replace(/^#/, '');

    const response = await this.makeSlackApiCall(
      'conversations.list',
      {
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '1000',
      },
      'GET'
    );

    if (!response.ok) {
      throw new Error(`Failed to list channels: ${response.error}`);
    }

    const channels = response.channels as Array<{
      id: string;
      name: string;
    }>;
    const matchedChannel = channels.find(
      (channel) => channel.name.toLowerCase() === channelName.toLowerCase()
    );

    if (!matchedChannel) {
      throw new Error(
        `Channel "${channelName}" not found. Available channels: ${channels.map((c) => c.name).join(', ')}`
      );
    }

    return matchedChannel.id;
  }

  private async sendMessage(
    params: Extract<SlackParams, { operation: 'send_message' }>
  ): Promise<Extract<SlackResult, { operation: 'send_message' }>> {
    const {
      channel,
      text,
      username,
      icon_emoji,
      icon_url,
      attachments,
      blocks,
      thread_ts,
      reply_broadcast,
      unfurl_links,
      unfurl_media,
    } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    // Auto-convert markdown to Slack mrkdwn format
    const formattedText = text ? markdownToMrkdwn(text) : text;

    const body: Record<string, unknown> = {
      channel: resolvedChannel,
      text: formattedText,
      unfurl_links,
      unfurl_media,
    };

    if (username) body.username = username;
    if (icon_emoji) body.icon_emoji = icon_emoji;
    if (icon_url) body.icon_url = icon_url;
    if (attachments) body.attachments = JSON.stringify(attachments);
    if (blocks) body.blocks = JSON.stringify(blocks);
    if (thread_ts) {
      body.thread_ts = thread_ts;
      body.reply_broadcast = reply_broadcast;
    }
    const response = await this.makeSlackApiCall('chat.postMessage', body);

    return {
      operation: 'send_message',
      ok: response.ok,
      channel: response.ok ? (response.channel as string) : undefined,
      ts: response.ok ? (response.ts as string) : undefined,
      message:
        response.ok && response.message
          ? SlackMessageSchema.parse(response.message)
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async listChannels(
    params: Extract<SlackParams, { operation: 'list_channels' }>
  ): Promise<Extract<SlackResult, { operation: 'list_channels' }>> {
    const { types, exclude_archived, limit, cursor } = params;

    const queryParams: Record<string, string> = {
      types: types.join(','),
      exclude_archived: exclude_archived.toString(),
      limit: limit.toString(),
    };

    if (cursor) queryParams.cursor = cursor;

    const response = await this.makeSlackApiCall(
      'conversations.list',
      queryParams,
      'GET'
    );

    return {
      operation: 'list_channels',
      ok: response.ok,
      channels:
        response.ok && response.channels
          ? z.array(SlackChannelSchema).parse(response.channels)
          : undefined,
      response_metadata:
        response.ok && response.response_metadata
          ? {
              next_cursor: (
                response.response_metadata as { next_cursor: string }
              ).next_cursor,
            }
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async getChannelInfo(
    params: Extract<SlackParams, { operation: 'get_channel_info' }>
  ): Promise<Extract<SlackResult, { operation: 'get_channel_info' }>> {
    const { channel, include_locale } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const queryParams: Record<string, string> = {
      channel: resolvedChannel,
      include_locale: include_locale.toString(),
    };

    const response = await this.makeSlackApiCall(
      'conversations.info',
      queryParams,
      'GET'
    );

    return {
      operation: 'get_channel_info',
      ok: response.ok,
      channel:
        response.ok && response.channel
          ? SlackChannelSchema.parse(response.channel)
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async getUserInfo(
    params: Extract<SlackParams, { operation: 'get_user_info' }>
  ): Promise<Extract<SlackResult, { operation: 'get_user_info' }>> {
    const { user, include_locale } = params;

    const queryParams: Record<string, string> = {
      user,
      include_locale: include_locale.toString(),
    };

    const response = await this.makeSlackApiCall(
      'users.info',
      queryParams,
      'GET'
    );

    return {
      operation: 'get_user_info',
      ok: response.ok,
      user:
        response.ok && response.user
          ? SlackUserSchema.parse(response.user)
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async listUsers(
    params: Extract<SlackParams, { operation: 'list_users' }>
  ): Promise<Extract<SlackResult, { operation: 'list_users' }>> {
    const { limit, cursor, include_locale } = params;

    const queryParams: Record<string, string> = {
      limit: limit.toString(),
      include_locale: include_locale.toString(),
    };

    if (cursor) queryParams.cursor = cursor;

    const response = await this.makeSlackApiCall(
      'users.list',
      queryParams,
      'GET'
    );

    return {
      operation: 'list_users',
      ok: response.ok,
      members:
        response.ok && response.members
          ? z.array(SlackUserSchema).parse(response.members)
          : undefined,
      response_metadata:
        response.ok && response.response_metadata
          ? {
              next_cursor: (
                response.response_metadata as { next_cursor: string }
              ).next_cursor,
            }
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async getConversationHistory(
    params: Extract<SlackParams, { operation: 'get_conversation_history' }>
  ): Promise<Extract<SlackResult, { operation: 'get_conversation_history' }>> {
    const { channel, latest, oldest, inclusive, limit, cursor } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const queryParams: Record<string, string> = {
      channel: resolvedChannel,
      inclusive: inclusive.toString(),
      limit: limit.toString(),
    };

    if (latest) queryParams.latest = latest;
    if (oldest) queryParams.oldest = oldest;
    if (cursor) queryParams.cursor = cursor;

    const response = await this.makeSlackApiCall(
      'conversations.history',
      queryParams,
      'GET'
    );

    return {
      operation: 'get_conversation_history',
      ok: response.ok,
      messages:
        response.ok && response.messages
          ? z.array(SlackMessageSchema).parse(response.messages)
          : undefined,
      has_more: response.ok ? (response.has_more as boolean) : undefined,
      response_metadata:
        response.ok && response.response_metadata
          ? {
              next_cursor: (
                response.response_metadata as { next_cursor: string }
              ).next_cursor,
            }
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async getThreadReplies(
    params: Extract<SlackParams, { operation: 'get_thread_replies' }>
  ): Promise<Extract<SlackResult, { operation: 'get_thread_replies' }>> {
    const { channel, ts, latest, oldest, inclusive, limit, cursor } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const queryParams: Record<string, string> = {
      channel: resolvedChannel,
      ts: ts,
    };

    if (latest) queryParams.latest = latest;
    if (oldest) queryParams.oldest = oldest;
    if (inclusive !== undefined) queryParams.inclusive = inclusive.toString();
    if (limit !== undefined) queryParams.limit = limit.toString();
    if (cursor) queryParams.cursor = cursor;

    const response = await this.makeSlackApiCall(
      'conversations.replies',
      queryParams,
      'GET'
    );

    return {
      operation: 'get_thread_replies',
      ok: response.ok,
      messages:
        response.ok && response.messages
          ? z.array(SlackMessageSchema).parse(response.messages)
          : undefined,
      has_more: response.ok ? (response.has_more as boolean) : undefined,
      response_metadata:
        response.ok && response.response_metadata
          ? {
              next_cursor: (
                response.response_metadata as { next_cursor: string }
              ).next_cursor,
            }
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async updateMessage(
    params: Extract<SlackParams, { operation: 'update_message' }>
  ): Promise<Extract<SlackResult, { operation: 'update_message' }>> {
    const { channel, ts, text, attachments, blocks } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const body: Record<string, unknown> = {
      channel: resolvedChannel,
      ts,
    };

    // Auto-convert markdown to Slack mrkdwn format
    if (text) body.text = markdownToMrkdwn(text);
    if (attachments) body.attachments = JSON.stringify(attachments);
    if (blocks) body.blocks = JSON.stringify(blocks);

    const response = await this.makeSlackApiCall('chat.update', body);

    return {
      operation: 'update_message',
      ok: response.ok,
      channel: response.ok ? (response.channel as string) : undefined,
      ts: response.ok ? (response.ts as string) : undefined,
      text: response.ok ? (response.text as string) : undefined,
      message:
        response.ok && response.message
          ? SlackMessageSchema.parse(response.message)
          : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async deleteMessage(
    params: Extract<SlackParams, { operation: 'delete_message' }>
  ): Promise<Extract<SlackResult, { operation: 'delete_message' }>> {
    const { channel, ts } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const body: Record<string, unknown> = {
      channel: resolvedChannel,
      ts,
    };

    const response = await this.makeSlackApiCall('chat.delete', body);

    return {
      operation: 'delete_message',
      ok: response.ok,
      channel: response.ok ? (response.channel as string) : undefined,
      ts: response.ok ? (response.ts as string) : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async addReaction(
    params: Extract<SlackParams, { operation: 'add_reaction' }>
  ): Promise<Extract<SlackResult, { operation: 'add_reaction' }>> {
    const { name, channel, timestamp } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const body: Record<string, unknown> = {
      name,
      channel: resolvedChannel,
      timestamp,
    };

    const response = await this.makeSlackApiCall('reactions.add', body);

    return {
      operation: 'add_reaction',
      ok: response.ok,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async removeReaction(
    params: Extract<SlackParams, { operation: 'remove_reaction' }>
  ): Promise<Extract<SlackResult, { operation: 'remove_reaction' }>> {
    const { name, channel, timestamp } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const body: Record<string, unknown> = {
      name,
      channel: resolvedChannel,
      timestamp,
    };

    const response = await this.makeSlackApiCall('reactions.remove', body);

    return {
      operation: 'remove_reaction',
      ok: response.ok,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async uploadFile(
    params: Extract<SlackParams, { operation: 'upload_file' }>
  ): Promise<Extract<SlackResult, { operation: 'upload_file' }>> {
    const { channel, file_path, filename, title, initial_comment, thread_ts } =
      params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const fileBuffer = await fs.readFile(file_path);
      const actualFilename = filename || path.basename(file_path);
      const fileSize = fileBuffer.length;

      const uploadUrlResponse = await this.makeSlackApiCall(
        'files.getUploadURLExternal',
        {
          filename: actualFilename,
          length: fileSize.toString(),
        }
      );

      if (!uploadUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.error}`);
      }

      const { upload_url, file_id } = uploadUrlResponse as {
        ok: true;
        upload_url: string;
        file_id: string;
      };

      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        body: fileBuffer,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      const completeParams: Record<string, unknown> = {
        files: JSON.stringify([
          {
            id: file_id,
            title: title || actualFilename,
          },
        ]),
      };

      if (resolvedChannel) completeParams.channel_id = resolvedChannel;
      if (initial_comment) completeParams.initial_comment = initial_comment;
      if (thread_ts) completeParams.thread_ts = thread_ts;

      const completeResponse = await this.makeSlackApiCall(
        'files.completeUploadExternal',
        completeParams
      );

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete upload: ${completeResponse.error}`);
      }

      interface SlackUploadedFile {
        id?: string;
        created?: number;
        timestamp?: number;
        name?: string;
        title?: string;
        mimetype?: string;
        filetype?: string;
        pretty_type?: string;
        user?: string;
        editable?: boolean;
        size?: number;
        mode?: string;
        is_external?: boolean;
        external_type?: string;
        is_public?: boolean;
        public_url_shared?: boolean;
        display_as_bot?: boolean;
        username?: string;
        url_private?: string;
        url_private_download?: string;
        permalink?: string;
        permalink_public?: string;
        shares?: Record<string, unknown>;
        channels?: string[];
        groups?: string[];
        ims?: string[];
        has_rich_preview?: boolean;
      }

      const files =
        (completeResponse as { files?: SlackUploadedFile[] }).files || [];
      const uploadedFile: SlackUploadedFile = files[0] || {};

      return {
        operation: 'upload_file',
        ok: true,
        file: {
          id: uploadedFile.id || file_id,
          created: uploadedFile.created || Date.now() / 1000,
          timestamp: uploadedFile.timestamp || Date.now() / 1000,
          name: uploadedFile.name || actualFilename,
          title: uploadedFile.title || title || actualFilename,
          mimetype: uploadedFile.mimetype || 'image/png',
          filetype: uploadedFile.filetype || 'png',
          pretty_type: uploadedFile.pretty_type || 'PNG',
          user: uploadedFile.user || '',
          editable: uploadedFile.editable || false,
          size: uploadedFile.size || fileSize,
          mode: uploadedFile.mode || 'hosted',
          is_external: uploadedFile.is_external || false,
          external_type: uploadedFile.external_type || '',
          is_public: uploadedFile.is_public || false,
          public_url_shared: uploadedFile.public_url_shared || false,
          display_as_bot: uploadedFile.display_as_bot || false,
          username: uploadedFile.username || '',
          url_private: uploadedFile.url_private || '',
          url_private_download: uploadedFile.url_private_download || '',
          permalink: uploadedFile.permalink || '',
          permalink_public: uploadedFile.permalink_public || '',
          shares: uploadedFile.shares || {},
          channels: uploadedFile.channels || [resolvedChannel],
          groups: uploadedFile.groups || [],
          ims: uploadedFile.ims || [],
          has_rich_preview: uploadedFile.has_rich_preview || false,
        },
        error: '',
        success: true,
      };
    } catch (error) {
      return {
        operation: 'upload_file',
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown file upload error',
        success: false,
      };
    }
  }

  private async joinChannel(
    params: Extract<SlackParams, { operation: 'join_channel' }>
  ): Promise<Extract<SlackResult, { operation: 'join_channel' }>> {
    const { channel } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    const body: Record<string, unknown> = {
      channel: resolvedChannel,
    };

    const response = await this.makeSlackApiCall('conversations.join', body);

    return {
      operation: 'join_channel',
      ok: response.ok,
      channel:
        response.ok && response.channel
          ? SlackChannelSchema.parse(response.channel)
          : undefined,
      already_in_channel: response.ok
        ? (response.already_in_channel as boolean)
        : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  private async scheduleMessage(
    params: Extract<SlackParams, { operation: 'schedule_message' }>
  ): Promise<Extract<SlackResult, { operation: 'schedule_message' }>> {
    const {
      channel,
      text,
      post_at,
      thread_ts,
      blocks,
      unfurl_links,
      unfurl_media,
    } = params;

    const resolvedChannel = await this.resolveChannelId(channel);

    // Auto-convert markdown to Slack mrkdwn format
    const formattedText = text ? markdownToMrkdwn(text) : text;

    const body: Record<string, unknown> = {
      channel: resolvedChannel,
      text: formattedText,
      post_at,
    };

    if (thread_ts) body.thread_ts = thread_ts;
    if (blocks) body.blocks = JSON.stringify(blocks);
    if (unfurl_links !== undefined) body.unfurl_links = unfurl_links;
    if (unfurl_media !== undefined) body.unfurl_media = unfurl_media;

    const response = await this.makeSlackApiCall('chat.scheduleMessage', body);

    return {
      operation: 'schedule_message',
      ok: response.ok,
      channel: response.ok
        ? (response.channel as string | undefined)
        : undefined,
      scheduled_message_id: response.ok
        ? (response.scheduled_message_id as string | undefined)
        : undefined,
      post_at: response.ok
        ? (response.post_at as number | undefined)
        : undefined,
      error: !response.ok ? JSON.stringify(response, null, 2) : '',
      success: response.ok,
    };
  }

  /**
   * Opens a DM conversation with a user and returns the DM channel ID.
   */
  private async openDmConversation(userId: string): Promise<string> {
    const response = await this.makeSlackApiCall('conversations.open', {
      users: userId,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to open DM with user ${userId}: ${response.error}. ` +
          `Make sure you have the 'im:write' scope enabled in your Slack app.`
      );
    }

    const channel = response.channel as { id: string } | undefined;
    if (!channel?.id) {
      throw new Error(
        `Failed to get DM channel ID for user ${userId}. Unexpected API response.`
      );
    }

    return channel.id;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No slack credentials provided');
    }

    return credentials[CredentialType.SLACK_CRED];
  }

  private async makeSlackApiCall(
    endpoint: string,
    params: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<SlackApiResponse | SlackApiError> {
    const url = `${SLACK_API_BASE}/${endpoint}`;

    const authToken = this.chooseCredential();

    if (!authToken) {
      throw new Error(
        'Slack authentication token is required but was not provided'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type':
        method === 'POST'
          ? 'application/json'
          : 'application/x-www-form-urlencoded',
    };

    let fetchConfig: RequestInit;

    if (method === 'GET') {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      fetchConfig = {
        method: 'GET',
        headers,
      };
      const urlWithParams = `${url}?${searchParams.toString()}`;

      const response = await fetch(urlWithParams, fetchConfig);
      const data = (await response.json()) as SlackApiResponse | SlackApiError;

      if (!response.ok && !data.ok) {
        throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
      }

      return data;
    } else {
      const needsJson =
        ['chat.postMessage', 'chat.update'].includes(endpoint) &&
        (params.blocks || params.attachments);

      if (needsJson) {
        fetchConfig = {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        };
      } else {
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        }
        fetchConfig = {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        };
      }

      const response = await fetch(url, fetchConfig);
      const data = (await response.json()) as SlackApiResponse | SlackApiError;

      if (!response.ok && !data.ok) {
        throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
      }

      return data;
    }
  }
}
