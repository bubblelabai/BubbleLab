import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  DiscordParamsSchema,
  DiscordResultSchema,
  type DiscordParams,
  type DiscordParamsInput,
  type DiscordResult,
} from './discord.schema.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/** Map user-friendly channel type to Discord's integer type */
const CHANNEL_TYPE_MAP: Record<string, number> = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  forum: 15,
};

/**
 * Discord Service Bubble
 *
 * Comprehensive Discord integration for messaging, channel management,
 * threads, reactions, and guild operations via the Discord REST API (v10).
 */
export class DiscordBubble<
  T extends DiscordParamsInput = DiscordParamsInput,
> extends ServiceBubble<
  T,
  Extract<DiscordResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'discord';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'discord';
  static readonly schema = DiscordParamsSchema;
  static readonly resultSchema = DiscordResultSchema;
  static readonly shortDescription =
    'Discord integration for messaging, channels, threads, and server management';
  static readonly longDescription = `
    Comprehensive Discord integration via the REST API (v10).

    Features:
    - Send, edit, delete, and pin messages in channels
    - List and read message history
    - Add emoji reactions to messages
    - List, create, and delete channels
    - Create and list threads
    - List guild/server members
    - Get guild/server information

    Security Features:
    - OAuth 2.0 authentication with Discord
    - Guild-scoped access with bot permissions
    - Secure credential handling with base64-encoded payloads
  `;
  static readonly alias = '';

  constructor(
    params: T = {
      operation: 'list_channels',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Discord credentials are required');
    }

    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bot ${creds.botToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord API error (${response.status}): ${text}`);
    }
    return true;
  }

  private parseCredentials(): {
    botToken: string;
    guildId: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const raw = credentials[CredentialType.DISCORD_CRED];
    if (!raw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        botToken?: string;
        accessToken?: string;
        guildId?: string;
      }>(raw);

      // Prefer botToken (injected by credential-helper from env)
      const token = parsed.botToken || parsed.accessToken;
      if (token) {
        return {
          botToken: token,
          guildId: parsed.guildId || '',
        };
      }
    } catch {
      // If decoding fails, treat the raw value as a token
    }

    return { botToken: raw, guildId: '' };
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.botToken;
  }

  /** Resolve guild ID from params or credential metadata. */
  private getGuildId(paramsGuildId?: string): string {
    if (paramsGuildId) return paramsGuildId;
    const creds = this.parseCredentials();
    if (creds?.guildId) return creds.guildId;
    throw new Error(
      'Guild ID is required. Provide it in the guild_id parameter or ensure your Discord credential has guild metadata.'
    );
  }

  // ─── API Request Helper ─────────────────────────────────────────────

  private async discordRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Discord credentials are required');
    }

    const url = `${DISCORD_API_BASE}${endpoint}`;

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bot ${creds.botToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    // 204 No Content (e.g., reactions, pins, deletes)
    if (response.status === 204) {
      return null;
    }

    const text = await response.text();

    if (!response.ok) {
      let errorMessage = `Discord API error (${response.status})`;
      try {
        const errorData = JSON.parse(text);
        if (errorData.message) {
          errorMessage += `: ${errorData.message}`;
        }
        if (errorData.code) {
          errorMessage += ` [code: ${errorData.code}]`;
        }
      } catch {
        errorMessage += `: ${text}`;
      }
      throw new Error(errorMessage);
    }

    return text ? JSON.parse(text) : null;
  }

  // ─── Main Action ────────────────────────────────────────────────────

  protected async performAction(): Promise<
    Extract<DiscordResult, { operation: T['operation'] }>
  > {
    const { operation } = this.params;

    try {
      const result = await (async (): Promise<DiscordResult> => {
        const p = this.params as DiscordParams;
        switch (operation) {
          case 'send_message':
            return await this.sendMessage(
              p as Extract<DiscordParams, { operation: 'send_message' }>
            );
          case 'list_messages':
            return await this.listMessages(
              p as Extract<DiscordParams, { operation: 'list_messages' }>
            );
          case 'edit_message':
            return await this.editMessage(
              p as Extract<DiscordParams, { operation: 'edit_message' }>
            );
          case 'delete_message':
            return await this.deleteMessage(
              p as Extract<DiscordParams, { operation: 'delete_message' }>
            );
          case 'pin_message':
            return await this.pinMessage(
              p as Extract<DiscordParams, { operation: 'pin_message' }>
            );
          case 'add_reaction':
            return await this.addReaction(
              p as Extract<DiscordParams, { operation: 'add_reaction' }>
            );
          case 'list_channels':
            return await this.listChannels(
              p as Extract<DiscordParams, { operation: 'list_channels' }>
            );
          case 'create_channel':
            return await this.createChannel(
              p as Extract<DiscordParams, { operation: 'create_channel' }>
            );
          case 'delete_channel':
            return await this.deleteChannel(
              p as Extract<DiscordParams, { operation: 'delete_channel' }>
            );
          case 'create_thread':
            return await this.createThread(
              p as Extract<DiscordParams, { operation: 'create_thread' }>
            );
          case 'list_threads':
            return await this.listThreads(
              p as Extract<DiscordParams, { operation: 'list_threads' }>
            );
          case 'list_members':
            return await this.listMembers(
              p as Extract<DiscordParams, { operation: 'list_members' }>
            );
          case 'get_guild':
            return await this.getGuild(
              p as Extract<DiscordParams, { operation: 'get_guild' }>
            );
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      })();

      return result as Extract<DiscordResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as Extract<DiscordResult, { operation: T['operation'] }>;
    }
  }

  // ─── Message Operations ─────────────────────────────────────────────

  private async sendMessage(
    params: Extract<DiscordParams, { operation: 'send_message' }>
  ): Promise<Extract<DiscordResult, { operation: 'send_message' }>> {
    const body: Record<string, unknown> = {};
    if (params.content) body.content = params.content;
    if (params.embeds) body.embeds = params.embeds;
    if (params.tts) body.tts = params.tts;
    if (params.reply_to) {
      body.message_reference = { message_id: params.reply_to };
    }

    const message = await this.discordRequest(
      `/channels/${params.channel_id}/messages`,
      'POST',
      body
    );

    return {
      operation: 'send_message' as const,
      success: true,
      message: message as Record<string, unknown>,
      error: '',
    };
  }

  private async listMessages(
    params: Extract<DiscordParams, { operation: 'list_messages' }>
  ): Promise<Extract<DiscordResult, { operation: 'list_messages' }>> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.before) queryParams.set('before', params.before);
    if (params.after) queryParams.set('after', params.after);

    const qs = queryParams.toString();
    const messages = await this.discordRequest(
      `/channels/${params.channel_id}/messages${qs ? `?${qs}` : ''}`
    );

    return {
      operation: 'list_messages' as const,
      success: true,
      messages: messages as Record<string, unknown>[],
      error: '',
    };
  }

  private async editMessage(
    params: Extract<DiscordParams, { operation: 'edit_message' }>
  ): Promise<Extract<DiscordResult, { operation: 'edit_message' }>> {
    const body: Record<string, unknown> = {};
    if (params.content !== undefined) body.content = params.content;
    if (params.embeds) body.embeds = params.embeds;

    const message = await this.discordRequest(
      `/channels/${params.channel_id}/messages/${params.message_id}`,
      'PATCH',
      body
    );

    return {
      operation: 'edit_message' as const,
      success: true,
      message: message as Record<string, unknown>,
      error: '',
    };
  }

  private async deleteMessage(
    params: Extract<DiscordParams, { operation: 'delete_message' }>
  ): Promise<Extract<DiscordResult, { operation: 'delete_message' }>> {
    await this.discordRequest(
      `/channels/${params.channel_id}/messages/${params.message_id}`,
      'DELETE'
    );

    return {
      operation: 'delete_message' as const,
      success: true,
      error: '',
    };
  }

  private async pinMessage(
    params: Extract<DiscordParams, { operation: 'pin_message' }>
  ): Promise<Extract<DiscordResult, { operation: 'pin_message' }>> {
    await this.discordRequest(
      `/channels/${params.channel_id}/pins/${params.message_id}`,
      'PUT'
    );

    return {
      operation: 'pin_message' as const,
      success: true,
      error: '',
    };
  }

  // ─── Reaction Operations ────────────────────────────────────────────

  private async addReaction(
    params: Extract<DiscordParams, { operation: 'add_reaction' }>
  ): Promise<Extract<DiscordResult, { operation: 'add_reaction' }>> {
    const encodedEmoji = encodeURIComponent(params.emoji);
    await this.discordRequest(
      `/channels/${params.channel_id}/messages/${params.message_id}/reactions/${encodedEmoji}/@me`,
      'PUT'
    );

    return {
      operation: 'add_reaction' as const,
      success: true,
      error: '',
    };
  }

  // ─── Channel Operations ─────────────────────────────────────────────

  private async listChannels(
    params: Extract<DiscordParams, { operation: 'list_channels' }>
  ): Promise<Extract<DiscordResult, { operation: 'list_channels' }>> {
    const guildId = this.getGuildId(params.guild_id);
    const channels = await this.discordRequest(`/guilds/${guildId}/channels`);

    return {
      operation: 'list_channels' as const,
      success: true,
      channels: channels as Record<string, unknown>[],
      error: '',
    };
  }

  private async createChannel(
    params: Extract<DiscordParams, { operation: 'create_channel' }>
  ): Promise<Extract<DiscordResult, { operation: 'create_channel' }>> {
    const guildId = this.getGuildId(params.guild_id);
    const body: Record<string, unknown> = {
      name: params.name,
      type: CHANNEL_TYPE_MAP[params.type] ?? 0,
    };
    if (params.topic) body.topic = params.topic;
    if (params.parent_id) body.parent_id = params.parent_id;
    if (params.nsfw !== undefined) body.nsfw = params.nsfw;

    const channel = await this.discordRequest(
      `/guilds/${guildId}/channels`,
      'POST',
      body
    );

    return {
      operation: 'create_channel' as const,
      success: true,
      channel: channel as Record<string, unknown>,
      error: '',
    };
  }

  private async deleteChannel(
    params: Extract<DiscordParams, { operation: 'delete_channel' }>
  ): Promise<Extract<DiscordResult, { operation: 'delete_channel' }>> {
    await this.discordRequest(`/channels/${params.channel_id}`, 'DELETE');

    return {
      operation: 'delete_channel' as const,
      success: true,
      error: '',
    };
  }

  // ─── Thread Operations ──────────────────────────────────────────────

  private async createThread(
    params: Extract<DiscordParams, { operation: 'create_thread' }>
  ): Promise<Extract<DiscordResult, { operation: 'create_thread' }>> {
    const endpoint = params.message_id
      ? `/channels/${params.channel_id}/messages/${params.message_id}/threads`
      : `/channels/${params.channel_id}/threads`;

    const body: Record<string, unknown> = {
      name: params.name,
      auto_archive_duration: Number(params.auto_archive_duration),
    };

    // Standalone threads (without a message) need type 11 (public thread)
    if (!params.message_id) {
      body.type = 11;
    }

    const thread = await this.discordRequest(endpoint, 'POST', body);

    return {
      operation: 'create_thread' as const,
      success: true,
      thread: thread as Record<string, unknown>,
      error: '',
    };
  }

  private async listThreads(
    params: Extract<DiscordParams, { operation: 'list_threads' }>
  ): Promise<Extract<DiscordResult, { operation: 'list_threads' }>> {
    const guildId = this.getGuildId(params.guild_id);
    const result = (await this.discordRequest(
      `/guilds/${guildId}/threads/active`
    )) as { threads?: Record<string, unknown>[] };

    return {
      operation: 'list_threads' as const,
      success: true,
      threads: result?.threads || [],
      error: '',
    };
  }

  // ─── Member Operations ──────────────────────────────────────────────

  private async listMembers(
    params: Extract<DiscordParams, { operation: 'list_members' }>
  ): Promise<Extract<DiscordResult, { operation: 'list_members' }>> {
    const guildId = this.getGuildId(params.guild_id);
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.after) queryParams.set('after', params.after);

    const qs = queryParams.toString();
    const members = await this.discordRequest(
      `/guilds/${guildId}/members${qs ? `?${qs}` : ''}`
    );

    return {
      operation: 'list_members' as const,
      success: true,
      members: members as Record<string, unknown>[],
      error: '',
    };
  }

  // ─── Guild Operations ───────────────────────────────────────────────

  private async getGuild(
    params: Extract<DiscordParams, { operation: 'get_guild' }>
  ): Promise<Extract<DiscordResult, { operation: 'get_guild' }>> {
    const guildId = this.getGuildId(params.guild_id);
    const guild = await this.discordRequest(`/guilds/${guildId}`);

    return {
      operation: 'get_guild' as const,
      success: true,
      guild: guild as Record<string, unknown>,
      error: '',
    };
  }
}
