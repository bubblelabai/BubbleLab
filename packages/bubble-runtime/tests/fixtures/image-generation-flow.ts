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
  fileIds: string[];
  error?: string;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  // base64 encoded image
  image: string;
  // mime type of the image
  mimeType: string;
}

export class ImageBackgroundGeneratorFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { image, mimeType } = payload;

    if (!image || !mimeType) {
      throw new Error('Image and mimeType are required in the payload.');
    }

    const fileIds: string[] = [];
    const prompts = [
      'Take the main subject from the provided image and place it on a background of a bustling, sunny day in Times Square. The lighting on the subject should match the sunny environment.',
      'Take the main subject from the provided image and place it on a background of Times Square at night, with all the bright billboards lit up. The lighting on the subject should reflect the neon lights.',
    ];

    for (let i = 0; i < prompts.length; i++) {
      const generateImageAgent = new AIAgentBubble({
        message: prompts[i],
        images: [{ type: 'base64', data: image, mimeType: mimeType }],
        model: { model: 'google/gemini-2.5-flash-image-preview' },
        tools: [],
      });

      const generationResult = await generateImageAgent.action();

      if (!generationResult.success || !generationResult.data?.response) {
        console.error(
          `AI image generation failed for prompt ${i + 1}:`,
          generationResult.error
        );
        continue; // Skip to the next iteration if this one fails
      }

      // The response is a data URI, e.g., "data:image/png;base64,iVBORw0KGgo..."
      // We need to extract the base64 part.
      const base64Data = generationResult.data.response.split(',')[1];
      if (!base64Data) {
        console.error(
          `Could not extract base64 data from AI response for prompt ${i + 1}`
        );
        continue;
      }

      const uploadBubble = new GoogleDriveBubble({
        operation: 'upload_file',
        name: `Image with Time Square background ${i + 1}.png`,
        content: base64Data,
        mimeType: 'image/png', // The generated image is always PNG
      });

      const uploadResult = await uploadBubble.action();

      if (uploadResult.success && uploadResult.data?.file?.id) {
        fileIds.push(uploadResult.data.file.id);
      } else {
        console.error(
          `Google Drive upload failed for prompt ${i + 1}:`,
          uploadResult.error
        );
      }
    }

    if (fileIds.length === 0) {
      return {
        fileIds: [],
        error: 'Failed to generate and upload any images.',
      };
    }

    return {
      fileIds,
    };
  }
}
