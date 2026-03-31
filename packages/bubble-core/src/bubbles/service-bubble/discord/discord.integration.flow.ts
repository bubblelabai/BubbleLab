import {
  BubbleFlow,
  DiscordBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  channelId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
  /** Target channel ID for message tests */
  channel_id?: string;
  /** Target guild ID for guild-level tests */
  guild_id?: string;
}

/**
 * Integration flow that exercises all Discord bubble operations end-to-end.
 * Requires a valid Discord credential with bot permissions.
 */
export class DiscordIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let testChannelId = payload.channel_id || '';
    let createdChannelId = '';
    let sentMessageId = '';

    // 1. Get guild info
    const guildResult = await new DiscordBubble({
      operation: 'get_guild',
      guild_id: payload.guild_id,
    }).action();

    results.push({
      operation: 'get_guild',
      success: guildResult.success,
      details: guildResult.success
        ? `Guild: ${(guildResult as { guild?: { name?: string } }).guild?.name}`
        : guildResult.error,
    });

    // 2. List channels
    const channelsResult = await new DiscordBubble({
      operation: 'list_channels',
      guild_id: payload.guild_id,
    }).action();

    results.push({
      operation: 'list_channels',
      success: channelsResult.success,
      details: channelsResult.success
        ? `Found ${((channelsResult as { channels?: unknown[] }).channels || []).length} channels`
        : channelsResult.error,
    });

    // Use first text channel if no channel_id provided
    if (!testChannelId && channelsResult.success) {
      const channels =
        (channelsResult as { channels?: Array<{ id: string; type: number }> })
          .channels || [];
      const textChannel = channels.find((c) => c.type === 0);
      testChannelId = textChannel?.id || '';
    }

    // 3. Create a test channel
    const createChannelResult = await new DiscordBubble({
      operation: 'create_channel',
      guild_id: payload.guild_id,
      name: `test-bubble-${Date.now()}`,
      topic: 'Integration test channel - safe to delete',
      type: 'text',
    }).action();

    results.push({
      operation: 'create_channel',
      success: createChannelResult.success,
      details: createChannelResult.success
        ? `Created channel: ${(createChannelResult as { channel?: { id?: string } }).channel?.id}`
        : createChannelResult.error,
    });

    if (createChannelResult.success) {
      createdChannelId =
        (createChannelResult as { channel?: { id?: string } }).channel?.id ||
        '';
    }

    const msgChannel = createdChannelId || testChannelId;

    if (msgChannel) {
      // 4. Send a message
      const sendResult = await new DiscordBubble({
        operation: 'send_message',
        channel_id: msgChannel,
        content: 'Hello from BubbleLab integration test! 🧪',
        embeds: [
          {
            title: 'Test Embed',
            description:
              'This is a test embed with special chars: éàü & <html>',
            color: 5793266,
            fields: [
              {
                name: 'Field 1',
                value: 'Value with unicode: 日本語',
                inline: true,
              },
              { name: 'Field 2', value: 'Value 2', inline: true },
            ],
          },
        ],
      }).action();

      results.push({
        operation: 'send_message',
        success: sendResult.success,
        details: sendResult.success
          ? `Sent message: ${(sendResult as { message?: { id?: string } }).message?.id}`
          : sendResult.error,
      });

      if (sendResult.success) {
        sentMessageId =
          (sendResult as { message?: { id?: string } }).message?.id || '';
      }

      // 5. List messages
      const listMsgResult = await new DiscordBubble({
        operation: 'list_messages',
        channel_id: msgChannel,
        limit: 5,
      }).action();

      results.push({
        operation: 'list_messages',
        success: listMsgResult.success,
        details: listMsgResult.success
          ? `Found ${((listMsgResult as { messages?: unknown[] }).messages || []).length} messages`
          : listMsgResult.error,
      });

      if (sentMessageId) {
        // 6. Edit the message
        const editResult = await new DiscordBubble({
          operation: 'edit_message',
          channel_id: msgChannel,
          message_id: sentMessageId,
          content: 'Edited message from BubbleLab ✏️',
        }).action();

        results.push({
          operation: 'edit_message',
          success: editResult.success,
          details: editResult.success
            ? 'Message edited successfully'
            : editResult.error,
        });

        // 7. Add reaction
        const reactionResult = await new DiscordBubble({
          operation: 'add_reaction',
          channel_id: msgChannel,
          message_id: sentMessageId,
          emoji: '👍',
        }).action();

        results.push({
          operation: 'add_reaction',
          success: reactionResult.success,
          details: reactionResult.success
            ? 'Reaction added'
            : reactionResult.error,
        });

        // 8. Pin message
        const pinResult = await new DiscordBubble({
          operation: 'pin_message',
          channel_id: msgChannel,
          message_id: sentMessageId,
        }).action();

        results.push({
          operation: 'pin_message',
          success: pinResult.success,
          details: pinResult.success ? 'Message pinned' : pinResult.error,
        });

        // 9. Create thread from message
        const threadResult = await new DiscordBubble({
          operation: 'create_thread',
          channel_id: msgChannel,
          message_id: sentMessageId,
          name: 'Test Thread',
          auto_archive_duration: '60',
        }).action();

        results.push({
          operation: 'create_thread',
          success: threadResult.success,
          details: threadResult.success
            ? `Thread created: ${(threadResult as { thread?: { id?: string } }).thread?.id}`
            : threadResult.error,
        });

        // 10. Delete the message (cleanup)
        const deleteResult = await new DiscordBubble({
          operation: 'delete_message',
          channel_id: msgChannel,
          message_id: sentMessageId,
        }).action();

        results.push({
          operation: 'delete_message',
          success: deleteResult.success,
          details: deleteResult.success
            ? 'Message deleted'
            : deleteResult.error,
        });
      }
    }

    // 11. List threads
    const threadsResult = await new DiscordBubble({
      operation: 'list_threads',
      guild_id: payload.guild_id,
    }).action();

    results.push({
      operation: 'list_threads',
      success: threadsResult.success,
      details: threadsResult.success
        ? `Found ${((threadsResult as { threads?: unknown[] }).threads || []).length} active threads`
        : threadsResult.error,
    });

    // 12. List members
    const membersResult = await new DiscordBubble({
      operation: 'list_members',
      guild_id: payload.guild_id,
      limit: 10,
    }).action();

    results.push({
      operation: 'list_members',
      success: membersResult.success,
      details: membersResult.success
        ? `Found ${((membersResult as { members?: unknown[] }).members || []).length} members`
        : membersResult.error,
    });

    // 13. Delete test channel (cleanup)
    if (createdChannelId) {
      const deleteChannelResult = await new DiscordBubble({
        operation: 'delete_channel',
        channel_id: createdChannelId,
      }).action();

      results.push({
        operation: 'delete_channel',
        success: deleteChannelResult.success,
        details: deleteChannelResult.success
          ? 'Test channel deleted'
          : deleteChannelResult.error,
      });
    }

    return {
      channelId: testChannelId,
      testResults: results,
    };
  }
}
