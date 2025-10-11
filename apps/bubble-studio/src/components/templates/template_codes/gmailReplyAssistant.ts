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

    // 1. List unread emails from the past 24 hours
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

    // 2. Fetch full email details for each email
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
        if (message.payload?.body?.data) {
          bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        }

        emails.push({
          id: message.id,
          threadId: message.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          body: bodyText,
          snippet: message.snippet || '',
        });
      }
    }

    // 3. Filter marketing/non-important emails if requested
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

    // 4. Generate smart replies for each important email
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

      // 5. Create draft for the reply
      // Extract recipient email from "From" header (format: "Name <email@example.com>")
      const toEmail = email.from.match(/<(.+?)>/)?.[1] || email.from;

      const createDraft = new GmailBubble({
        operation: 'create_draft',
        to: [toEmail],
        subject: replyData.subject,
        body_text: replyData.body,
        thread_id: email.threadId,
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
