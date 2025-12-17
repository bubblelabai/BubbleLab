// Template for Personal Assistant (Google Calendar, Gmail, Slack)
// This file contains the template code and metadata for the personal assistant workflow

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
  GoogleCalendarBubble,
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
  status: string;
  messageId?: string;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  /**
   * Email address to send the calendar summary to.
   * @canBeFile false
   */
  email: string;
}

interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
  description?: string;
}

export class CalendarReportFlow extends BubbleFlow<'webhook/http'> {
  // Retrieve calendar events for the next 30 days
  private async getCalendarEvents(): Promise<CalendarEvent[]> {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Retrieves calendar events from the primary Google Calendar for the next 30 days,
    // ordered chronologically with recurring events expanded, providing the raw event
    // data that will be summarized and emailed.
    const calendar = new GoogleCalendarBubble({
      operation: 'list_events',
      calendar_id: 'primary',
      time_min: timeMin,
      time_max: timeMax,
      single_events: true,
      order_by: 'startTime',
    });

    const eventsResult = await calendar.action();

    if (!eventsResult.success || !eventsResult.data || !eventsResult.data.events || eventsResult.data.events.length === 0) {
      return [];
    }

    const events = eventsResult.data.events.map((event: any) => ({
      summary: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      description: event.description,
    }));

    return events;
  }

  // Generate HTML email summary from calendar events
  private async generateEventSummary(events: CalendarEvent[]): Promise<string> {
    // Transforms raw calendar events into a beautifully formatted HTML email summary
    // by analyzing all events and creating a professional summary that highlights
    // important dates, meetings, and deadlines.
    const agent = new AIAgentBubble({
      systemPrompt: 'You are an expert at summarizing calendar events and creating beautiful, well-formatted HTML emails. Create a summary of the provided events. The output should be only the HTML body content.',
      message: \`Please summarize the following calendar events into a well-formatted email body: \${JSON.stringify(events)}\`,
    });

    const agentResult = await agent.action();

    if (!agentResult.success || !agentResult.data?.response) {
      throw new Error('Failed to generate event summary.');
    }

    return agentResult.data.response;
  }

  // Send the calendar summary email
  private async sendSummaryEmail(email: string, htmlContent: string): Promise<string> {
    // Sends the AI-generated calendar summary as an HTML email to the recipient,
    // delivering the formatted calendar report directly to their inbox.
    const emailBubble = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: 'Your Weekly Calendar Summary',
      html: htmlContent,
    });

    const emailResult = await emailBubble.action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error}\`);
    }

    return emailResult.data?.email_id || '';
  }

  // Main workflow orchestration
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { email } = payload;

    // Step 1: Retrieve calendar events for the next 30 days
    const events = await this.getCalendarEvents();

    if (events.length === 0) {
      return {
        status: 'No events found, no email sent.',
      };
    }

    // Step 2: Generate HTML email summary from calendar events
    const htmlContent = await this.generateEventSummary(events);

    // Step 3: Send the calendar summary email
    const messageId = await this.sendSummaryEmail(email, htmlContent);

    return {
      status: 'Report sent successfully',
      messageId,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address to send the calendar summary to',
      },
    },
    required: ['email'],
  }),
  requiredCredentials: {
    'google-calendar': ['read'],
    resend: ['send'],
  },
  // Pre-validated bubble parameters for instant visualization (no server validation needed)
  // Keys correspond to variableIds to ensure stable ordering/selection
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'calendar',
      bubbleName: 'GoogleCalendarBubble',
      className: 'GoogleCalendarBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'list_events', type: 'string' },
        { name: 'calendar_id', value: 'primary', type: 'string' },
        { name: 'time_min', value: '${timeMin}', type: 'string' },
        { name: 'time_max', value: '${timeMax}', type: 'string' },
        { name: 'single_events', value: true, type: 'boolean' },
        { name: 'order_by', value: 'startTime', type: 'string' },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'agent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'systemPrompt',
          value:
            'You are an expert at summarizing calendar events and creating beautiful, well-formatted HTML emails. Create a summary of the provided events. The output should be only the HTML body content.',
          type: 'string',
        },
        {
          name: 'message',
          value:
            'Please summarize the following calendar events into a well-formatted email body: ${JSON.stringify(events)}',
          type: 'string',
        },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'emailBubble',
      bubbleName: 'ResendBubble',
      className: 'ResendBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'send_email', type: 'string' },
        { name: 'to', value: '${email}', type: 'string' },
        {
          name: 'subject',
          value: 'Your Weekly Calendar Summary',
          type: 'string',
        },
        { name: 'html', value: '${agentResult.data.response}', type: 'string' },
      ],
    },
  },
};
