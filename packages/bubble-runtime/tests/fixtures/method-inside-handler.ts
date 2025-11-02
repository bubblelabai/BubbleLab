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
}

/**
 * This flow tests a method inside the handler
 */
export class MethodInsideHandlerFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any): Promise<Output> {
    async function test() {
      await new AIAgentBubble({
        message: 'Hello, world!',
        model: {
          model: 'google/gemini-2.5-flash',
        },
      }).action();

      const b = new SlackBubble({
        operation: 'send_message',
        channel: 'general',
        text: 'Hello, world!',
      });

      return 'Hello, world!';
    }

    await test();

    return {
      message: 'Hello, world!',
    };
  }
}
