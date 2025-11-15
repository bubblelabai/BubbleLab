// Template for Gmail Reply Assistant
// This template reads unread emails from the past 24h, filters marketing emails,
// and drafts smart replies using AI

export const templateCode = `import {
  BubbleFlow,
  GmailBubble,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  totalUnreadEmails: number;
  filteredEmails: number;
  draftsCreated: number;
  draftIds: string[];
}

export interface CustomWebhookPayload extends WebhookEvent {
  filterMarketing?: boolean;
}

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  body: string;
  snippet: string;
}

export class GmailReplyAssistantFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { filterMarketing = true } = payload;

    const draftIds: string[] = [];

    // Retrieves up to 50 unread emails from the Gmail inbox that arrived in the past
    // 24 hours, providing the initial list of emails that need replies.
    const listEmails = new GmailBubble({
      operation: 'list_emails',
      query: 'is:unread newer_than:1d',
      maxResults: 50,
    });

    const listResult = await listEmails.action();

    if (!listResult.success || !listResult.data?.messages) {
      throw new Error(\`Failed to list emails: \${listResult.error || 'No messages found'}\`);
    }

    const emailList = listResult.data.messages as Array<{ id: string; threadId: string }>;

    if (emailList.length === 0) {
      return {
        message: 'No unread emails found in the past 24 hours',
        totalUnreadEmails: 0,
        filteredEmails: 0,
        draftsCreated: 0,
        draftIds: [],
      };
    }

    // Retrieves the complete email content including headers, body text, and metadata
    // for each unread email using the message_id, providing full context needed for
    // AI analysis and reply generation.
    const emails: Email[] = [];
    for (const email of emailList) {
      const getEmail = new GmailBubble({
        operation: 'get_email',
        message_id: email.id,
      });

      const emailResult = await getEmail.action();

      if (emailResult.success && emailResult.data?.message) {
        const message = emailResult.data.message;

        // Extract headers
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Decode body (simplified - assumes text/plain in body.data)
        let bodyText = '';
        const bodyData = message.payload?.body?.data;
        if (bodyData) {
          bodyText = Buffer.from(bodyData, 'base64').toString('utf-8');
        }

        emails.push({
          id: message.id,
          threadId: message.threadId || '',
          subject: getHeader('Subject'),
          from: getHeader('From'),
          body: bodyText,
          snippet: message.snippet || '',
        });
      }
    }

    // Classifies emails using gemini-2.5-flash with jsonMode to identify important
    // emails requiring replies, filtering out marketing emails, newsletters, and
    // automated notifications to ensure only meaningful emails get reply drafts.
    let filteredEmails: Email[] = emails;

    if (filterMarketing) {
      const classificationPrompt = \`
        You are an email classification expert. Analyze the following emails and determine which ones are important and require a reply.

        Filter out:
        - Marketing emails and promotional content
        - Newsletters and bulk emails
        - Automated notifications (e.g., password resets, order confirmations)
        - Spam or low-priority messages

        Keep:
        - Personal emails from individuals
        - Work-related emails requiring action
        - Important business communications

        Return a JSON array with this structure:
        [
          {
            "emailId": "email ID",
            "isImportant": true/false,
            "category": "personal" | "work" | "marketing" | "automated" | "newsletter",
            "reason": "Brief reason for classification"
          }
        ]

        Emails to classify:
        \${JSON.stringify(
          emails.map((e) => ({
            id: e.id,
            subject: e.subject,
            from: e.from,
            snippet: e.snippet,
          }))
        )}
      \`;

      // Analyzes emails to classify them as important or non-important, filtering out
      // noise and focusing on emails that need human-like responses.
      const classificationAgent = new AIAgentBubble({
        message: classificationPrompt,
        systemPrompt: 'You are an expert email classifier. Return only valid JSON with no markdown formatting.',
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
        },
      });

      const classificationResult = await classificationAgent.action();

      if (!classificationResult.success || !classificationResult.data?.response) {
        throw new Error(\`Failed to classify emails: \${classificationResult.error || 'No response'}\`);
      }

      let classifications: Array<{
        emailId: string;
        isImportant: boolean;
        category: string;
        reason: string;
      }>;
      try {
        classifications = JSON.parse(classificationResult.data.response);
      } catch (error) {
        throw new Error('Failed to parse email classification JSON');
      }

      // Filter to only important emails
      const importantEmailIds = new Set(
        classifications.filter((c) => c.isImportant).map((c) => c.emailId)
      );
      filteredEmails = emails.filter((e) => importantEmailIds.has(e.id));
    }

    // Creates contextual, professional email replies using gemini-2.5-flash with
    // jsonMode, analyzing original email content to generate responses that match
    // the tone and address key points, creating draft replies users can review and send.
    for (const email of filteredEmails) {
      const replyPrompt = \`
        You are a professional email assistant. Draft a smart, contextual reply to the following email.

        Email Details:
        From: \${email.from}
        Subject: \${email.subject}
        Body:
        \${email.body}

        Instructions:
        - Be professional and courteous
        - Address the key points in the email
        - Keep the reply concise but complete
        - Match the tone of the original email
        - Include a proper greeting and sign-off

        Return a JSON object with:
        {
          "subject": "Re: [original subject]",
          "body": "The reply email body in plain text"
        }
      \`;

      // Generates a smart, contextual reply for a single email, creating professional
      // responses that address key points while matching the original email's tone.
      const replyAgent = new AIAgentBubble({
        message: replyPrompt,
        systemPrompt: 'You are a professional email assistant. Draft helpful, contextual email replies. Return only valid JSON with no markdown formatting.',
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
        },
      });

      const replyResult = await replyAgent.action();

      if (!replyResult.success || !replyResult.data?.response) {
        continue; // Skip this email if reply generation fails
      }

      let replyData: { subject: string; body: string };
      try {
        replyData = JSON.parse(replyResult.data.response);
      } catch (error) {
        continue; // Skip this email if JSON parsing fails
      }

      // Creates a draft email in Gmail with the AI-generated reply content, linking
      // it to the original email thread if available, making the reply available for
      // user review and sending.
      // Extract recipient email from "From" header (format: "Name <email@example.com>")
      const toEmail = email.from.match(/<(.+?)>/)?.[1] || email.from;

      const createDraft = new GmailBubble({
        operation: 'create_draft',
        to: [toEmail],
        subject: replyData.subject,
        body_text: replyData.body,
        ...(email.threadId ? { thread_id: email.threadId } : {}),
      });

      const draftResult = await createDraft.action();

      if (draftResult.success && draftResult.data?.draft) {
        draftIds.push(draftResult.data.draft.id);
      }
    }

    return {
      message: \`Successfully created \${draftIds.length} draft replies from \${emails.length} unread emails\`,
      totalUnreadEmails: emails.length,
      filteredEmails: filteredEmails.length,
      draftsCreated: draftIds.length,
      draftIds,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      filterMarketing: {
        type: 'boolean',
        description:
          'Filter out marketing emails, newsletters, and automated notifications (default: true)',
        default: true,
      },
    },
    required: [],
  }),
  requiredCredentials: {
    gmail: ['read', 'compose'],
  },
  // Pre-validated bubble parameters for instant visualization
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'listEmails',
      bubbleName: 'GmailBubble',
      className: 'GmailBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'list_emails', type: 'string' },
        { name: 'query', value: 'is:unread newer_than:1d', type: 'string' },
        { name: 'maxResults', value: 50, type: 'number' },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'getEmail',
      bubbleName: 'GmailBubble',
      className: 'GmailBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'get_email', type: 'string' },
        { name: 'message_id', value: 'email.id', type: 'variable' },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'classificationAgent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value: 'Classify emails as important or marketing/automated',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value: 'Expert email classifier',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-flash' },
          type: 'object',
        },
      ],
    },
    4: {
      variableId: 4,
      variableName: 'replyAgent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value: 'Draft smart, contextual reply to email',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value: 'Professional email assistant',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-flash' },
          type: 'object',
        },
      ],
    },
    5: {
      variableId: 5,
      variableName: 'createDraft',
      bubbleName: 'GmailBubble',
      className: 'GmailBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'create_draft', type: 'string' },
        { name: 'to', value: ['toEmail'], type: 'array' },
        { name: 'subject', value: 'replyData.subject', type: 'variable' },
        { name: 'body_text', value: 'replyData.body', type: 'variable' },
        { name: 'thread_id', value: 'email.threadId', type: 'variable' },
      ],
    },
  },
};
