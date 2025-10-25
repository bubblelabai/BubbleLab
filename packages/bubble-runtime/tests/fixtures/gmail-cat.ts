import {
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
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  HttpBubble,
  ApifyBubble,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
  InstagramTool,
  LinkedInTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleTriggerEvent,
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';
import { z } from 'zod';

export interface Output {
  categorizedEmails: {
    emailId: string;
    suggestedLabels: string[];
    agentResponse?: string;
  }[];
  errors: string[];
}

export interface CustomCronPayload extends CronEvent {
  // No custom payload needed for this cron job
}

export class GmailCategorizationCron extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '*/5 * * * *'; // Every 5 minutes

  async handle(payload: CustomCronPayload): Promise<Output> {
    const categorizedEmails: Output['categorizedEmails'] = [];
    const errors: string[] = [];

    const listEmailsBubble = new GmailBubble({
      operation: 'list_emails',
      query: 'is:unread',
      max_results: 5, // Process 5 emails at a time to avoid hitting limits
    });

    const listResult = await listEmailsBubble.action();

    if (
      !listResult.success ||
      !listResult.data?.messages ||
      listResult.data.messages.length === 0
    ) {
      const errorMessage =
        listResult.error || 'No new messages found to process.';
      console.log(errorMessage);
      if (listResult.error) {
        errors.push(errorMessage);
      }
      return { categorizedEmails, errors };
    }

    const customTools: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
      func: (args: Record<string, unknown>) => Promise<unknown>;
    }[] = [
      {
        name: 'read_gmail_message_content',
        description:
          'Reads the full content, subject, and sender of a specific email using its ID.',
        schema: {
          message_id: z
            .string()
            .describe('The ID of the Gmail message to read.'),
        },
        func: async (args: Record<string, unknown>) => {
          const { message_id } = args as { message_id: string };
          const result = await new GmailBubble({
            operation: 'get_email',
            message_id,
            format: 'full',
          }).action();
          if (result.success && result.data?.message) {
            return {
              snippet: result.data.message.snippet,
              headers: result.data.message.payload?.headers?.filter((h) =>
                ['From', 'To', 'Subject', 'Date'].includes(h.name)
              ),
              body_snippet: result.data.message.payload?.body?.data?.substring(
                0,
                500
              ), // Return a snippet of the body
            };
          }
          return { error: result.error || 'Failed to retrieve email.' };
        },
      },
    ];

    const systemPrompt =
      'Objective:\nAnalyze an incoming email and suggest appropriate labels for categorization.\n\nTool:\n- read_gmail_message_content: Use this tool with the email ID to get the full content, sender, and subject.\n\nInstructions:\n1. You will be given an email ID and a snippet.\n2. Use the \'read_gmail_message_content\' tool to get the email\'s full details.\n3. Analyze the email\'s subject, sender, and content to determine the most relevant categories.\n4. Suggest a list of suitable labels. Try to use a consistent structure like "Parent/Child" or simple labels.\n5. Your final response must be a valid JSON object containing a single key "suggested_labels" which is an array of strings. For example: { "suggested_labels": ["Work/Projects/Alpha", "Finance/Receipts"] }.';

    for (const message of listResult.data.messages) {
      if (!message.id) continue;

      try {
        const agentBubble = new AIAgentBubble({
          message:
            'Please suggest labels for the email with ID: ' +
            message.id +
            '. Snippet: ' +
            message.snippet,
          systemPrompt,
          customTools,
          model: {
            model: 'google/gemini-2.5-pro',
            jsonMode: true,
          },
        });

        const agentResult = await agentBubble.action();

        if (agentResult.success && agentResult.data?.response) {
          try {
            const responseJson = JSON.parse(agentResult.data.response);
            categorizedEmails.push({
              emailId: message.id,
              suggestedLabels: responseJson.suggested_labels || [],
              agentResponse: agentResult.data.response,
            });
          } catch (e) {
            const parseError =
              'Failed to parse agent JSON response for email ' +
              message.id +
              ': ' +
              agentResult.data.response;
            console.error(parseError);
            errors.push(parseError);
          }
        } else {
          const agentError =
            'Agent failed for email ' + message.id + ': ' + agentResult.error;
          console.error(agentError);
          errors.push(agentError);
        }

        await new GmailBubble({
          operation: 'mark_as_read',
          message_ids: [message.id],
        }).action();
      } catch (error) {
        const errorMessage =
          'An unexpected error occurred for email ' +
          message.id +
          ': ' +
          (error instanceof Error ? error.message : String(error));
        console.error(errorMessage);
        errors.push(errorMessage);
        await new GmailBubble({
          operation: 'mark_as_read',
          message_ids: [message.id],
        }).action();
      }
    }

    return { categorizedEmails, errors };
  }
}
