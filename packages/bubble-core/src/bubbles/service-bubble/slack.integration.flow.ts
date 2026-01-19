import {
  BubbleFlow,
  SlackBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  testChannelId?: string;
  testChannelName?: string;
  testMessageTs?: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Slack Integration Test workflow.
 */
export interface SlackIntegrationTestPayload extends WebhookEvent {
  /**
   * The channel name or ID to use for testing.
   * If not provided, will use the first available channel or create a test channel.
   * @canBeFile false
   */
  testChannel?: string;
}

export class SlackIntegrationTest extends BubbleFlow<'webhook/http'> {
  // Lists all channels in the workspace
  private async listChannels() {
    const result = await new SlackBubble({
      operation: 'list_channels',
      types: ['public_channel', 'private_channel'],
      exclude_archived: true,
      limit: 50,
    }).action();

    if (!result.success || result.data?.operation !== 'list_channels') {
      throw new Error(`Failed to list channels: ${result.error}`);
    }

    return result.data.channels || [];
  }

  // Gets detailed information about a specific channel
  private async getChannelInfo(channel: string) {
    const result = await new SlackBubble({
      operation: 'get_channel_info',
      channel: channel,
    }).action();

    return result.data.channel;
  }

  // Sends a message to a channel
  private async sendMessage(channel: string, text: string) {
    const result = await new SlackBubble({
      operation: 'send_message',
      channel: channel,
      text: text,
    }).action();

    return {
      ts: result.data.ts,
      channel: result.data.channel,
    };
  }

  // Sends a message with blocks (Block Kit)
  private async sendMessageWithBlocks(channel: string) {
    const result = await new SlackBubble({
      operation: 'send_message',
      channel: channel,
      text: 'Test message with blocks',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Integration Test*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test message with Block Kit formatting.',
          },
        },
      ],
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'send_message' ||
      !result.data.ts
    ) {
      throw new Error(`Failed to send message with blocks: ${result.error}`);
    }

    return {
      ts: result.data.ts,
      channel: result.data.channel,
    };
  }

  // Gets conversation history from a channel
  private async getConversationHistory(channel: string, limit: number = 10) {
    const result = await new SlackBubble({
      operation: 'get_conversation_history',
      channel: channel,
      limit: limit,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'get_conversation_history'
    ) {
      throw new Error(`Failed to get conversation history: ${result.error}`);
    }

    return result.data.messages || [];
  }

  // Updates an existing message
  private async updateMessage(channel: string, ts: string, newText: string) {
    const result = await new SlackBubble({
      operation: 'update_message',
      channel: channel,
      ts: ts,
      text: newText,
    }).action();

    if (!result.success || result.data?.operation !== 'update_message') {
      throw new Error(`Failed to update message: ${result.error}`);
    }

    return result.data;
  }

  // Deletes a message
  private async deleteMessage(channel: string, ts: string) {
    const result = await new SlackBubble({
      operation: 'delete_message',
      channel: channel,
      ts: ts,
    }).action();

    if (!result.success || result.data?.operation !== 'delete_message') {
      throw new Error(`Failed to delete message: ${result.error}`);
    }

    return result.data;
  }

  // Adds a reaction to a message
  private async addReaction(channel: string, timestamp: string, emoji: string) {
    const result = await new SlackBubble({
      operation: 'add_reaction',
      channel: channel,
      timestamp: timestamp,
      name: emoji,
    }).action();

    if (!result.success || result.data?.operation !== 'add_reaction') {
      throw new Error(`Failed to add reaction: ${result.error}`);
    }

    return result.data;
  }

  // Removes a reaction from a message
  private async removeReaction(
    channel: string,
    timestamp: string,
    emoji: string
  ) {
    const result = await new SlackBubble({
      operation: 'remove_reaction',
      channel: channel,
      timestamp: timestamp,
      name: emoji,
    }).action();

    if (!result.success || result.data?.operation !== 'remove_reaction') {
      throw new Error(`Failed to remove reaction: ${result.error}`);
    }

    return result.data;
  }

  // Lists all users in the workspace
  private async listUsers() {
    const result = await new SlackBubble({
      operation: 'list_users',
      limit: 50,
    }).action();

    if (!result.success || result.data?.operation !== 'list_users') {
      throw new Error(`Failed to list users: ${result.error}`);
    }

    return result.data.members || [];
  }

  // Gets detailed information about a specific user
  private async getUserInfo(userId: string) {
    const result = await new SlackBubble({
      operation: 'get_user_info',
      user: userId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'get_user_info' ||
      !result.data.user
    ) {
      throw new Error(`Failed to get user info: ${result.error}`);
    }

    return result.data.user;
  }

  // Joins a channel (if not already a member)
  private async joinChannel(channel: string) {
    const result = await new SlackBubble({
      operation: 'join_channel',
      channel: channel,
    }).action();

    if (!result.success || result.data?.operation !== 'join_channel') {
      throw new Error(`Failed to join channel: ${result.error}`);
    }

    return result.data;
  }

  async handle(payload: SlackIntegrationTestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let testChannelId: string | undefined;
    let testChannelName: string | undefined;
    let testMessageTs: string | undefined;

    try {
      // 1. List Channels
      const channels = await this.listChannels();
      results.push({
        operation: 'list_channels',
        success: channels.length > 0,
        details: `Found ${channels.length} channels`,
      });

      if (channels.length === 0) {
        throw new Error('No channels available for testing');
      }

      // 2. Determine test channel
      if (payload.testChannel) {
        // Try to find the specified channel
        const channel = channels.find(
          (c) =>
            c.id === payload.testChannel ||
            c.name === payload.testChannel?.replace(/^#/, '')
        );
        if (channel) {
          testChannelId = channel.id;
          testChannelName = channel.name;
        } else {
          // If channel name/ID provided but not found, try to get info anyway
          // (might be a channel name that needs resolution)
          const channelInfo = await this.getChannelInfo(payload.testChannel);
          testChannelId = channelInfo?.id;
          testChannelName = channelInfo?.name;
        }
      } else {
        // Use the first available channel
        const firstChannel = channels[0];
        testChannelId = firstChannel.id;
        testChannelName = firstChannel.name;
      }

      if (!testChannelId) {
        throw new Error('Could not determine test channel');
      }

      // 3. Get Channel Info
      const channelInfo = await this.getChannelInfo(testChannelId);
      results.push({
        operation: 'get_channel_info',
        success: !!channelInfo,
        details: `Channel: ${channelInfo?.name} (${channelInfo?.id})`,
      });

      // 4. Join Channel (if not already a member)
      try {
        await this.joinChannel(testChannelId);
        results.push({
          operation: 'join_channel',
          success: true,
          details: 'Joined or already in channel',
        });
      } catch (error) {
        // Might already be in channel or might not have permission
        results.push({
          operation: 'join_channel',
          success: false,
          details:
            error instanceof Error
              ? error.message
              : 'Failed to join channel (may already be a member)',
        });
      }

      // 5. Send Message
      const sendResult = await this.sendMessage(
        testChannelId,
        'Integration test message - ' + new Date().toISOString()
      );
      testMessageTs = sendResult.ts;
      results.push({
        operation: 'send_message',
        success: true,
        details: `Message sent with timestamp: ${testMessageTs}`,
      });

      // 6. Send Message with Blocks
      const blockResult = await this.sendMessageWithBlocks(testChannelId);
      results.push({
        operation: 'send_message_with_blocks',
        success: true,
        details: `Block message sent with timestamp: ${blockResult.ts}`,
      });

      // 7. Get Conversation History
      const history = await this.getConversationHistory(testChannelId, 5);
      results.push({
        operation: 'get_conversation_history',
        success: history.length > 0,
        details: `Retrieved ${history.length} messages`,
      });

      // 8. Update Message
      if (testMessageTs) {
        const updatedMessage = await this.updateMessage(
          testChannelId,
          testMessageTs,
          'Integration test message - UPDATED - ' + new Date().toISOString()
        );
        results.push({
          operation: 'update_message',
          success: true,
          details: `Message updated successfully`,
        });
      }

      // 9. Add Reaction
      if (testMessageTs) {
        await this.addReaction(testChannelId, testMessageTs, 'thumbsup');
        results.push({
          operation: 'add_reaction',
          success: true,
          details: 'Added thumbsup reaction',
        });
      }

      // 10. Remove Reaction
      if (testMessageTs) {
        await this.removeReaction(testChannelId, testMessageTs, 'thumbsup');
        results.push({
          operation: 'remove_reaction',
          success: true,
          details: 'Removed thumbsup reaction',
        });
      }

      // 11. List Users
      const users = await this.listUsers();
      results.push({
        operation: 'list_users',
        success: users.length > 0,
        details: `Found ${users.length} users`,
      });

      // 12. Get User Info (if users available)
      if (users.length > 0) {
        const firstUser = users[0];
        const userInfo = await this.getUserInfo(firstUser.id);
        results.push({
          operation: 'get_user_info',
          success: !!userInfo,
          details: `User: ${userInfo.name} (${userInfo.id})`,
        });
      }

      // 13. Delete Message (cleanup)
      if (testMessageTs) {
        await this.deleteMessage(testChannelId, testMessageTs);
        results.push({
          operation: 'delete_message',
          success: true,
          details: 'Test message deleted',
        });
      }
    } catch (error) {
      // If any operation fails, add it to results
      results.push({
        operation: 'error',
        success: false,
        details:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }

    return {
      testChannelId,
      testChannelName,
      testMessageTs,
      testResults: results,
    };
  }
}
