// Template for Product Image Transformer - AI-Powered Product Photography
//
// INPUT: imageFile (required base64), prompt (optional), filename (optional)
//
// Workflow:
// PHASE 1: Input Processing
//   - Validate input image is base64 (not URL)
//   - Parse optional transformation prompt
//   - Set default filename if not provided
//
// PHASE 2: AI Image Transformation
//   - Use Gemini 2.5 Flash Image to transform the product image
//   - Apply professional marketing photo styling
//   - Add clean backgrounds, studio lighting, and context
//
// PHASE 3: Google Drive Upload
//   - Upload transformed image as PNG to Google Drive
//   - Return file metadata with view link
//
// OUTPUT: Transformed image (base64), message, Google Drive file info

export const templateCode = `import {z} from 'zod';

import {
  // Base classes
  BubbleFlow,
  // Service Bubbles
  AIAgentBubble, // bubble name: 'ai-agent'
  GoogleDriveBubble, // bubble name: 'google-drive'
  // Event Types
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** Transformed image as Base64 string. */
  transformedImage: string;
  /** Result message. */
  message: string;
  /** Google Drive file info for the uploaded image. */
  driveFile?: {
    /** Google Drive file ID. */
    id: string;
    /** File name in Google Drive. */
    name: string;
    /** Link to view file in Google Drive. */
    webViewLink?: string;
  };
}

// TRIGGER TYPE 1: Webhook HTTP Trigger
export interface ProductImagePayload extends WebhookEvent {
  /**
   * Upload an image file directly using the paperclip icon.
   * @canBeFile true
   */
  imageFile: string;
  
  /**
   * Custom transformation instructions for how the AI should transform your product image.
   * @canBeFile false
   */
  prompt?: string;

  /**
   * Filename for Google Drive. Defaults to "transformed-product-{timestamp}.png" if not provided.
   * @canBeFile false
   */
  filename?: string;
}

export class ProductImageTransformer extends BubbleFlow<'webhook/http'> {
  
  // Transforms image using Gemini 2.5 Flash Image based on the prompt
  private async transformImage(imageFile: string, customPrompt?: string): Promise<string> {
    const defaultPrompt = "Transform this product image into a professional marketing photo. Add a clean, modern background, professional studio lighting, and if appropriate, include a model holding or using the product. Make it look like a high-end product advertisement.";
    const finalPrompt = customPrompt || defaultPrompt;

    // Validate that input is base64 data, not a URL
    if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
      throw new Error('URLs are not supported. Please upload an image file directly using the paperclip icon.');
    }

    // Processes the input image using AI to transform it into a professional marketing photo.
    // Accepts only base64 data from file upload. The model applies the transformation
    // prompt to generate enhanced imagery with professional lighting and background.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash-image-preview' },
      systemPrompt: 'You are a professional product photographer and photo editor AI.',
      message: finalPrompt,
      images: [{ type: 'base64' as const, data: imageFile, mimeType: 'image/png' }],
      tools: [] // Must be empty for image generation
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(\`AI Agent failed to transform image: \${result.error}\`);
    }

    // The response field contains the base64 encoded image data
    return result.data.response;
  }

  // Uploads transformed image to Google Drive and returns file metadata
  private async uploadToGoogleDrive(imageData: string, filename?: string): Promise<{ id: string; name: string; webViewLink?: string }> {
    // Generate a default filename if not provided
    const finalFilename = filename || \`transformed-product-\${Date.now()}.png\`;

    // Uploads the Base64 transformed image to Google Drive as a PNG file. Returns file metadata
    // including ID and webViewLink for sharing. File goes to root folder unless parent_folder_id specified.
    const googleDrive = new GoogleDriveBubble({
      operation: 'upload_file',
      name: finalFilename,
      content: imageData,
      mimeType: 'image/png',
    });

    const result = await googleDrive.action();

    if (!result.success || !result.data.file) {
      throw new Error(\`Failed to upload to Google Drive: \${result.data.error}\`);
    }

    return {
      id: result.data.file.id,
      name: result.data.file.name,
      webViewLink: result.data.file.webViewLink,
    };
  }

  // Main workflow orchestration
  async handle(payload: ProductImagePayload): Promise<Output> {
    const { 
      imageFile, 
      prompt = "Transform this product image into a professional marketing photo. Add a clean, modern background, professional studio lighting, and if appropriate, include a model holding or using the product. Make it look like a high-end product advertisement.",
      filename = "transformed-product.png"
    } = payload;

    if (!imageFile) {
      throw new Error("Input 'imageFile' is required.");
    }

    const aiResponse = await this.transformImage(imageFile, prompt);

    // Parse the AI response to extract the base64 image data
    // The response is a JSON array with text and inlineData elements
    let transformedImage = '';
    try {
      const parsed = JSON.parse(aiResponse);
      if (Array.isArray(parsed)) {
        // Find the inlineData element containing the image
        const imageElement = parsed.find((el: any) => el.type === 'inlineData');
        if (imageElement?.inlineData?.data) {
          transformedImage = imageElement.inlineData.data;
        } else {
          throw new Error('Image data not found in AI response');
        }
      } else {
        // If it's not an array, assume the whole response is the base64 data
        transformedImage = aiResponse;
      }
    } catch (error) {
      // If parsing fails, assume the whole response is the base64 data
      transformedImage = aiResponse;
    }

    // Upload the transformed image to Google Drive
    const driveFile = await this.uploadToGoogleDrive(transformedImage, filename);

    return {
      transformedImage,
      message: "Image transformed successfully and uploaded to Google Drive.",
      driveFile,
    };
  }
}`;

export const metadata = {};
