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

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleTriggerEvent,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  fileId?: string;
  message: string;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  // No custom payload fields needed for this request
}

export class GoogleDriveUploadFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const params: any = {
      name: `hello world.txt ${Date.now()}`,
      operation: 'upload_file',
      content: 'hello world',
      mimeType: 'text/plain',
    };

    const uploadBubble = new GoogleDriveBubble(params);

    const result = (await uploadBubble.action()) as any;

    if (!result.success || !result.data?.file?.id) {
      throw new Error(
        `Failed to upload file: ${result.error || 'Unknown error'}`
      );
    }

    return {
      fileId: result.data.file.id,
      message: `Successfully uploaded file with ID: ${result.data.file.id}`,
    };
  }
}
