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
  type BubbleOperationResult,
  type BubbleTriggerEvent,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class HelloWorldFlow extends BubbleFlow<'webhook/http'> {
  async handle(): Promise<Output> {
    const helloWorldBubble = new HelloWorldBubble({ name: 'World' });
    const result = await helloWorldBubble.action();

    if (!result.data) {
      throw new Error('HelloWorldBubble execution failed');
    }

    return {
      message: result.data.greeting,
    };
  }
}
