// Template for Project Management Assistant (Slack, Gmail)
// Pulls last 24h of Slack messages, summarizes into Updates/Blockers/Decisions
// and sends digest via email

export const templateCode = `import {
  // Base classes
  BubbleFlow,
  BaseBubble,
  ServiceBubble,
  WorkflowBubble,
  ToolBubble,
  
  // Service Bubbles
  HelloWorldBubble,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
  ResendBubble,
  StorageBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  
  // Template Workflows
  SlackDataAssistantWorkflow,
  PDFFormOperationsWorkflow,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
    
  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleOperationResult,
  type BubbleTriggerEvent,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  summary?: {
    updates: string[];
    blockers: string[];
    decisions: string[];
  };
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  recipientEmail: string;
  channelName: string;
}

export class SlackDigestAndEmailWorkflow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { recipientEmail, channelName } = payload;

    // Calculate the timestamp for 24 hours ago
    const oldest = String(Math.floor(Date.now() / 1000) - 24 * 60 * 60);


    // 1. Fetch Slack messages from the last 24 hours
    const historyResult = await new SlackBubble({
      operation: 'get_conversation_history',
      channel: channelName,
      oldest,
    }).action();

    if (!historyResult.success || !historyResult.data?.messages || historyResult.data.messages.length === 0) {
      return { message: 'Could not retrieve Slack messages or no new messages in the last 24 hours.' };
    }

    // 2. Format messages for the AI agent
    const messagesText = historyResult.data.messages
      .filter(msg => msg.text && msg.user) // Ensure message has text and a user
      .map(msg => \`User \${msg.user}: \${msg.text}\`)
      .join('\\n');

    if (!messagesText) {
        return { message: 'No user messages with text found in the last 24 hours.' };
    }

    const summaryPrompt = \`
      You are an expert project manager. Analyze the following Slack messages and summarize them into a structured checklist with three categories: Updates, Blockers, and Decisions.
      Provide the output in a clean JSON format like this: {"updates": ["...", "..."], "blockers": ["...", "..."], "decisions": ["...", "..."]}.
      Do not include any explanatory text outside of the JSON structure.

      Messages:
      \${messagesText}
    \`;

    // 3. Summarize messages with an AI agent
    const agentResult = await new AIAgentBubble({
      message: summaryPrompt,
      model: { model: 'google/gemini-2.5-flash', jsonMode: true },
    }).action();

    if (!agentResult.success || !agentResult.data?.response) {
      throw new Error('AI agent failed to summarize messages.');
    }

    let summary: { updates: string[]; blockers: string[]; decisions: string[] };
    try {
      summary = JSON.parse(agentResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI summary response into valid JSON.');
    }
    
    const { updates = [], blockers = [], decisions = [] } = summary;

    // Helper function to create HTML lists
    const toHtmlList = (items: string[], title: string) => {
      if (!items || items.length === 0) return '';
      return \`<h2>\${title}</h2><ul>\${items.map(item => \`<li>\${item}</li>\`).join('')}</ul>\`;
    };

    // 4. Format the summary into an HTML email
    const htmlBody = \`
      <h1>Daily Digest for #\${channelName}</h1>
      <p>Here is a summary of the last 24 hours of conversation.</p>
      \${toHtmlList(updates, '✅ Updates')}
      \${toHtmlList(blockers, '❗️ Blockers')}
      \${toHtmlList(decisions, '⚖️ Decisions')}
    \`;

    // 5. Send the summary email
    const emailResult = await new ResendBubble({
      operation: 'send_email',
      to: [recipientEmail],
      subject: \`Daily Slack Summary for #\${channelName}\`,
      html: htmlBody,
    }).action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error}\`);
    }

    return {
      message: \`Successfully sent daily summary to \${recipientEmail}\`,
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
      },
    },
    required: ['recipientEmail', 'channelName'],
  }),
  requiredCredentials: {
    slack: {
      description: 'Slack API credentials for accessing channel messages',
      required: true,
    },
    resend: {
      description: 'Resend API credentials for sending emails',
      required: true,
    },
    ai: {
      description: 'AI service credentials for message summarization',
      required: true,
    },
  },
};
