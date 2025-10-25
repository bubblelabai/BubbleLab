/**
 * Template generator for Slack Data Scientist workflows
 *
 * This service generates TypeScript code for BubbleFlow classes that use
 * SlackDataAssistantWorkflow for data analysis triggered by Slack mentions.
 */

export interface SlackDataScientistTemplateInput {
  name: string;
  description: string;
  roles: string;
  verbosity?: '1' | '2' | '3' | '4' | '5';
  technicality?: '1' | '2' | '3' | '4' | '5';
  includeQuery?: boolean;
  includeExplanation?: boolean;
  maxQueries?: number;
}
/**
 * Generates TypeScript code for a Slack data scientist workflow template
 */
export function generateSlackDataScientistTemplate(
  input: SlackDataScientistTemplateInput
): string {
  // Generate a valid TypeScript class name from the input name
  const sanitizedName = input.name
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters except spaces
    .split(/\s+/) // Split by spaces
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(''); // Join without spaces

  // Ensure the class name starts with a letter and is not empty
  const className =
    sanitizedName && /^[a-zA-Z]/.test(sanitizedName)
      ? sanitizedName
      : `Generated${sanitizedName || 'Bot'}`;

  return `import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import {
  BubbleFlow,
  SlackDataAssistantWorkflow,
  SlackBubble,
} from '@bubblelab/bubble-core';

export interface Output {
  success: boolean;
  directAnswer?: string;
  insights?: string[];
  recommendations?: string[];
  slackMessageId?: string;
  error?: string;
}

export class ${className} extends BubbleFlow<'slack/bot_mentioned'> {
  constructor() {
    super(
      'data-analyst-flow',
      'AI-powered database analysis triggered by Slack mentions'
    );
  }

  async handle(
    payload: BubbleTriggerEventRegistry['slack/bot_mentioned']
  ): Promise<Output> {
    try {
      // Extract the question from the Slack message
      const userQuestion = payload.text.replace(/<@[^>]+>/g, '').trim();

      if (!userQuestion) {
        return {
          success: false,
          error: 'Please provide a question after mentioning me.',
        };
      }

      if (payload.monthlyLimitError) {
        // Send a message to the user with the monthly limit error message
        await new SlackBubble({
          channel: payload.channel,
          operation: 'send_message',
          thread_ts: payload.thread_ts || payload.slack_event.event.ts,
          text: payload.monthlyLimitError as string,
        }).action();

        return {
          success: false,
          error: payload.monthlyLimitError as string,
        };
      }

      const workflow = new SlackDataAssistantWorkflow({
        slackChannel: payload.channel,
        userQuestion: userQuestion,
        userName: payload.user,
        dataSourceType: 'postgresql',
        ignoreSSLErrors: true,
        aiModel: 'google/gemini-2.5-pro',
        temperature: 0.3,
        verbosity: '${input.verbosity || '3'}',
        technicality: '${input.technicality || '2'}',
        includeQuery: ${input.includeQuery ?? true},
        maxQueries: ${input.maxQueries ?? 50},
        slackThreadTs: payload.thread_ts || payload.slack_event.event.ts,
        includeExplanation: ${input.includeExplanation ?? true},
        additionalContext: 'Your name is ${input.name.replace(/'/g, "\\'")}. You are an AI Data Scientist.',
      });
      
      const result = await workflow.action();
      return {
        success: result.success,
        directAnswer: result.data?.formattedResponse,
        insights: result.data?.queryResults?.map((queryResult: { summary: string }) => queryResult.summary as string) ?? [],
        recommendations: result.data?.queryResults?.map((queryResult: { summary: string }) => queryResult.summary as string) ?? [],
        slackMessageId: result.data?.slackMessageTs,
        error: result.error ? result.error.substring(0, 100) + '...' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
`;
}
