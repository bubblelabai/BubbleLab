// Template for Project Management Assistant (Slack, Gmail)
// Pulls last 24h of Slack messages, summarizes into Updates/Blockers/Decisions
// and sends digest via email

export const templateCode = `import {
  BubbleFlow,
  SlackBubble,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  emailId?: string;
  totalMessages: number;
  summary?: {
    updates: string[];
    blockers: string[];
    decisions: string[];
  };
}

export interface CustomWebhookPayload extends WebhookEvent {
  /**
   * Email address to send the daily digest to.
   * @canBeFile false
   */
  recipientEmail: string;
  /**
   * Slack channel name to pull messages from (without #).
   * @canBeFile false
   */
  channelName: string;
}

interface SlackMessage {
  text?: string;
  user?: string;
  ts?: string;
}

interface DigestSummary {
  updates: string[];
  blockers: string[];
  decisions: string[];
}

export class SlackDigestAndEmailWorkflow extends BubbleFlow<'webhook/http'> {
  // Fetch Slack messages from the last 24 hours
  private async fetchSlackMessages(channelName: string): Promise<SlackMessage[]> {
    // Calculate the timestamp for 24 hours ago
    const oldest = String(Math.floor(Date.now() / 1000) - 24 * 60 * 60);

    // Retrieves Slack conversation history from the specified channel for the last
    // 24 hours using the oldest timestamp, gathering all messages that will be
    // analyzed and summarized into updates, blockers, and decisions.
    const historyResult = await new SlackBubble({
      operation: 'get_conversation_history',
      channel: channelName,
      oldest,
    }).action();

    if (!historyResult.success || !historyResult.data?.messages) {
      throw new Error('Could not retrieve Slack messages');
    }

    if (historyResult.data.messages.length === 0) {
      throw new Error('No new messages in the last 24 hours');
    }

    return historyResult.data.messages;
  }

  // Generate AI summary from Slack messages
  private async generateSummary(messages: SlackMessage[]): Promise<DigestSummary> {
    const messagesText = messages
      .filter(msg => msg.text && msg.user) // Ensure message has text and a user
      .map(msg => \`User \${msg.user}: \${msg.text}\`)
      .join('\\n');

    if (!messagesText) {
      throw new Error('No user messages with text found in the last 24 hours');
    }

    const summaryPrompt = \`
      You are an expert project manager. Analyze the following Slack messages and summarize them into a structured checklist with three categories: Updates, Blockers, and Decisions.
      Provide the output in a clean JSON format like this: {"updates": ["...", "..."], "blockers": ["...", "..."], "decisions": ["...", "..."]}.
      Do not include any explanatory text outside of the JSON structure.

      Messages:
      \${messagesText}
    \`;

    // Analyzes Slack messages using gemini-2.5-flash with jsonMode to categorize
    // them into Updates, Blockers, and Decisions, transforming raw conversation
    // history into a structured project management summary.
    const agentResult = await new AIAgentBubble({
      message: summaryPrompt,
      systemPrompt: 'You are an expert project manager. Analyze messages and organize them into Updates, Blockers, and Decisions. Return only valid JSON with no markdown formatting.',
      model: { 
        model: 'google/gemini-2.5-flash', 
        jsonMode: true 
      },
    }).action();

    if (!agentResult.success || !agentResult.data?.response) {
      throw new Error('AI agent failed to summarize messages');
    }

    let summary: DigestSummary;
    try {
      summary = JSON.parse(agentResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI summary response into valid JSON');
    }

    return summary;
  }

  // Build HTML email from summary
  private buildEmailHtml(channelName: string, summary: DigestSummary): string {
    const { updates = [], blockers = [], decisions = [] } = summary;

    // Helper function to create HTML lists
    const toHtmlList = (items: string[], title: string, emoji: string) => {
      if (!items || items.length === 0) return '';
      return \`
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
            \${emoji} \${title}
          </h2>
          <ul style="list-style: none; padding: 0; margin: 0;">
            \${items.map(item => \`
              <li style="padding: 12px; margin-bottom: 8px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #667eea;">
                \${item}
              </li>
            \`).join('')}
          </ul>
        </div>
      \`;
    };

    return \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Slack Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">💬 Daily Slack Digest</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">#\${channelName}</p>
              <p style="margin: 5px 0 0 0; color: #e0e7ff; font-size: 14px;">\${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 30px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                Here is a summary of the last 24 hours of conversation in your Slack channel.
              </p>

              \${toHtmlList(updates, 'Updates', '✅')}
              \${toHtmlList(blockers, 'Blockers', '❗')}
              \${toHtmlList(decisions, 'Decisions', '⚖️')}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #1e293b; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Stay aligned with your team's progress</p>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                Powered by <a href="https://bubblelab.ai" style="color: #667eea; text-decoration: none; font-weight: 600;">bubble lab</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    \`;
  }

  // Send email via Resend
  private async sendDigestEmail(recipientEmail: string, channelName: string, htmlEmail: string): Promise<string> {
    // Sends the AI-generated project management summary as a formatted HTML email
    // to the recipient, delivering categorized updates, blockers, and decisions
    // directly to their inbox.
    const emailResult = await new ResendBubble({
      operation: 'send_email',
      to: [recipientEmail],
      subject: \`Daily Slack Summary for #\${channelName} - \${new Date().toLocaleDateString()}\`,
      html: htmlEmail,
    }).action();

    if (!emailResult.success || !emailResult.data?.email_id) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return emailResult.data.email_id;
  }

  // Main workflow orchestration
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      recipientEmail = 'user@example.com',
      channelName = 'general'
    } = payload;

    // Step 1: Fetch Slack messages from the last 24 hours
    const messages = await this.fetchSlackMessages(channelName);

    // Step 2: Generate AI-organized summary
    const summary = await this.generateSummary(messages);

    // Step 3: Build HTML email template
    const htmlEmail = this.buildEmailHtml(channelName, summary);

    // Step 4: Send email to recipient
    const emailId = await this.sendDigestEmail(recipientEmail, channelName, htmlEmail);

    return {
      message: \`Successfully sent daily summary to \${recipientEmail}\`,
      emailId,
      totalMessages: messages.length,
      summary,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      recipientEmail: {
        type: 'string',
        format: 'email',
        description: 'Email address to send the daily digest to',
      },
      channelName: {
        type: 'string',
        description: 'Slack channel name to pull messages from (without #)',
        default: 'general',
      },
    },
    required: ['recipientEmail', 'channelName'],
  }),
  requiredCredentials: {
    slack: ['read'],
    resend: ['send'],
  },
};
