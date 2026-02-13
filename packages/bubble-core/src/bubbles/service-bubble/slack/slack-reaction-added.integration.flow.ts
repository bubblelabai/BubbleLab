import { BubbleFlow, SlackBubble } from '@bubblelab/bubble-core';
import type { SlackReactionAddedEvent } from '@bubblelab/shared-schemas';

export interface Output {
  success: boolean;
  reaction?: string;
  user?: string;
  channel?: string;
  messageText?: string;
  sentMessageTs?: string;
  error?: string;
}

/**
 * Integration test for the slack/reaction_added trigger.
 *
 * When a user adds an emoji reaction to a message, this flow:
 * 1. Reads the reaction details from the payload
 * 2. Sends a confirmation message to the same channel
 *
 * To test: React to any message in a channel where the bot is present.
 */
export class SlackReactionAddedIntegrationTest extends BubbleFlow<'slack/reaction_added'> {
  constructor() {
    super(
      'slack-reaction-added-test',
      'Test flow for slack/reaction_added trigger — confirms reaction details'
    );
  }

  // Sends a confirmation message summarizing the reaction event
  private async sendConfirmation(
    channel: string,
    reaction: string,
    user: string,
    messageText: string | undefined,
    itemTs: string | undefined
  ) {
    const lines = [
      `:white_check_mark: *Reaction trigger test received!*`,
      `• *Reaction:* :${reaction}: (\`${reaction}\`)`,
      `• *User:* <@${user}>`,
      `• *Channel:* <#${channel}>`,
    ];

    if (itemTs) {
      lines.push(`• *Reacted message ts:* \`${itemTs}\``);
    }

    if (messageText) {
      const truncated =
        messageText.length > 200
          ? messageText.slice(0, 200) + '…'
          : messageText;
      lines.push(`• *Original message:* ${truncated}`);
    } else {
      lines.push(`• *Original message:* _(not available)_`);
    }

    const result = await new SlackBubble({
      operation: 'send_message',
      channel,
      text: lines.join('\n'),
      thread_ts: itemTs,
    }).action();

    return result.data?.ts as string | undefined;
  }

  async handle(payload: SlackReactionAddedEvent): Promise<Output> {
    const { reaction, user, channel, item_ts, message_text } = payload;

    if (!channel) {
      return {
        success: false,
        error:
          'No channel in reaction event (may be a file or file_comment reaction)',
      };
    }

    const sentTs = await this.sendConfirmation(
      channel,
      reaction,
      user,
      message_text,
      item_ts
    );

    return {
      success: true,
      reaction,
      user,
      channel,
      messageText: message_text,
      sentMessageTs: sentTs,
    };
  }
}
