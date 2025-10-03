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
 * This flow tests multiple action calls to the same bubble and different bubbles
 */
export class ImageBackgroundGeneratorFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any): Promise<Output> {
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

    const a = new AIAgentBubble({
      message: 'Hello, world!',
      model: {
        model: 'google/gemini-2.5-flash',
      },
    });

    await a.action();
    await b.action();
    await a.action();
    await b.action();

    return {
      message: 'Hello, world!',
    };
  }
}
