import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// Base URL for fal.ai API
const FAL_AI_BASE_URL = 'https://queue.fal.run';

// Define the parameters schema for the fal.ai bubble
export const FalAiParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('text_to_image')
      .describe('Generate an image from a text prompt'),
    model: z
      .string()
      .min(1, 'Model is required')
      .describe(
        'Fal AI model ID (e.g., "fal-ai/flux/dev", "fal-ai/stable-diffusion-v1-5")'
      ),
    prompt: z
      .string()
      .min(1, 'Prompt is required')
      .describe('Text prompt describing the image to generate'),
    imageSize: z
      .enum([
        'square_hd',
        'square',
        'portrait_4_3',
        'portrait_16_9',
        'landscape_4_3',
        'landscape_16_9',
      ])
      .optional()
      .default('square_hd')
      .describe('Image size/aspect ratio'),
    numImages: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .default(1)
      .describe('Number of images to generate (1-4)'),
    seed: z
      .number()
      .int()
      .optional()
      .describe('Random seed for reproducible results'),
    numInferenceSteps: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of inference steps (higher = better quality, slower)'),
    guidanceScale: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe('Guidance scale (higher = more adherence to prompt)'),
    enableSafetyChecker: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable safety checker to filter inappropriate content'),
    waitForResult: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Whether to wait for the result (true) or return request_id immediately (false)'
      ),
    maxWaitTime: z
      .number()
      .int()
      .min(1000)
      .max(300000)
      .optional()
      .default(300000)
      .describe(
        'Maximum time to wait for result in milliseconds (default: 5 minutes)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('image_to_image')
      .describe('Transform an image based on a text prompt'),
    model: z
      .string()
      .min(1, 'Model is required')
      .describe('Fal AI model ID for image-to-image (e.g., "fal-ai/flux/dev")'),
    prompt: z
      .string()
      .min(1, 'Prompt is required')
      .describe('Text prompt describing the transformation'),
    imageUrl: z
      .string()
      .url('Must be a valid URL')
      .describe('URL of the source image to transform'),
    strength: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.8)
      .describe(
        'Transformation strength (0.0 = no change, 1.0 = full transformation)'
      ),
    numImages: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .default(1)
      .describe('Number of images to generate (1-4)'),
    seed: z
      .number()
      .int()
      .optional()
      .describe('Random seed for reproducible results'),
    waitForResult: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Whether to wait for the result (true) or return request_id immediately (false)'
      ),
    maxWaitTime: z
      .number()
      .int()
      .min(1000)
      .max(300000)
      .optional()
      .default(300000)
      .describe(
        'Maximum time to wait for result in milliseconds (default: 5 minutes)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('get_status')
      .describe('Check the status of an async job'),
    requestId: z
      .string()
      .min(1, 'Request ID is required')
      .describe('The request ID returned from a previous operation'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('get_result')
      .describe('Retrieve the result of a completed job'),
    requestId: z
      .string()
      .min(1, 'Request ID is required')
      .describe('The request ID of the completed job'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

export type FalAiParamsInput = z.input<typeof FalAiParamsSchema>;
export type FalAiParamsParsed = z.output<typeof FalAiParamsSchema>;

// Define result schemas
export const FalAiResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('text_to_image'),
    requestId: z
      .string()
      .optional()
      .describe(
        'Request ID for async operations (when waitForResult is false)'
      ),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe('URL of the generated image'),
    imageUrls: z
      .array(z.string().url())
      .optional()
      .describe('URLs of multiple generated images (when numImages > 1)'),
    status: z
      .string()
      .optional()
      .describe(
        'Status of the request (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED)'
      ),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('image_to_image'),
    requestId: z
      .string()
      .optional()
      .describe(
        'Request ID for async operations (when waitForResult is false)'
      ),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe('URL of the transformed image'),
    imageUrls: z
      .array(z.string().url())
      .optional()
      .describe('URLs of multiple transformed images (when numImages > 1)'),
    status: z
      .string()
      .optional()
      .describe(
        'Status of the request (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED)'
      ),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('get_status'),
    status: z
      .string()
      .describe(
        'Current status of the request (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED)'
      ),
    success: z.boolean().describe('Whether the status check was successful'),
    error: z.string().describe('Error message if the status check failed'),
  }),
  z.object({
    operation: z.literal('get_result'),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe('URL of the generated/transformed image'),
    imageUrls: z
      .array(z.string().url())
      .optional()
      .describe('URLs of multiple images if multiple were generated'),
    status: z.string().optional().describe('Final status of the request'),
    success: z
      .boolean()
      .describe('Whether the result retrieval was successful'),
    error: z.string().describe('Error message if the result retrieval failed'),
  }),
]);

export type FalAiResult = z.output<typeof FalAiResultSchema>;

export class FalAiBubble extends ServiceBubble<FalAiParamsParsed, FalAiResult> {
  static readonly type = 'service' as const;
  static readonly service = 'fal-ai';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName: BubbleName = 'fal-ai';
  static readonly schema = FalAiParamsSchema;
  static readonly resultSchema = FalAiResultSchema;
  static readonly shortDescription =
    'Fal AI integration for media generation (text-to-image, image-to-image)';
  static readonly longDescription = `
    Integrate with Fal AI's media generation APIs for creating and transforming images.

    Features:
    - Text-to-image generation with various models (Flux, Stable Diffusion, etc.)
    - Image-to-image transformation
    - Configurable image sizes and quality settings
    - Async job status checking and result retrieval
    - Automatic polling for long-running operations

    Use cases:
    - Generate images from text descriptions
    - Transform existing images with AI
    - Create multiple variations of images
    - Batch image generation workflows

    Supported Models:
    - fal-ai/flux/dev - Fast, high-quality image generation
    - fal-ai/stable-diffusion-v1-5 - Classic Stable Diffusion
    - fal-ai/flux/schnell - Ultra-fast generation
    - And many more (check Fal AI docs for full list)
  `;
  static readonly alias = 'falai';

  constructor(params: FalAiParamsInput, context?: BubbleContext) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.FAL_AI_API_KEY];
  }
  public async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) return false;

    // Test by checking if we can make an authenticated request
    // We'll use a simple status check with a dummy request ID
    // The API will return 404 for invalid request ID, but 401 for invalid key
    try {
      const response = await fetch(
        `${FAL_AI_BASE_URL}/test-request-id/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 401 = invalid key, 404 = valid key but invalid request ID (which is fine)
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  protected async performAction(context?: BubbleContext): Promise<FalAiResult> {
    void context;
    const params = this.params;

    switch (params.operation) {
      case 'text_to_image':
        return this.textToImage(params);
      case 'image_to_image':
        return this.imageToImage(params);
      case 'get_status':
        return this.getStatus(params);
      case 'get_result':
        return this.getResult(params);
      default:
        throw new Error(`Unknown operation: ${(params as any).operation}`);
    }
  }

  /**
   * Poll for job status until completion or timeout
   */
  private async pollForResult(
    requestId: string,
    maxWaitTime: number,
    apiKey: string
  ): Promise<{ status: string; result?: unknown }> {
    const startTime = Date.now();
    let pollInterval = 1000; // Start with 1 second
    const maxInterval = 10000; // Cap at 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      // Direct API call to avoid schema validation issues
      try {
        const statusResponse = await this.makeApiRequest(
          `/${requestId}/status`,
          'GET',
          undefined,
          apiKey
        );

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          return {
            status: 'FAILED',
            result: {
              error: `Failed to get status: ${statusResponse.status} ${statusResponse.statusText} - ${errorText}`,
            },
          };
        }

        const statusData = (await statusResponse.json()) as { status: string };
        const status = statusData.status?.toUpperCase();

        if (status === 'COMPLETED') {
          // Fetch the result directly
          const resultResponse = await this.makeApiRequest(
            `/${requestId}`,
            'GET',
            undefined,
            apiKey
          );

          if (!resultResponse.ok) {
            const errorText = await resultResponse.text();
            return {
              status: 'FAILED',
              result: {
                error: `Failed to get result: ${resultResponse.status} ${resultResponse.statusText} - ${errorText}`,
              },
            };
          }

          const resultData = (await resultResponse.json()) as {
            images?: Array<{ url: string }>;
            image?: { url: string };
            status?: string;
          };

          // Handle different response formats
          let imageUrl: string | undefined;
          let imageUrls: string[] | undefined;

          if (
            resultData.images &&
            Array.isArray(resultData.images) &&
            resultData.images.length > 0
          ) {
            imageUrls = resultData.images.map((img) => img.url);
            imageUrl = imageUrls[0]; // First image as primary
          } else if (resultData.image?.url) {
            imageUrl = resultData.image.url;
          }

          return {
            status: 'COMPLETED',
            result: {
              operation: 'get_result',
              imageUrl,
              imageUrls,
              status: resultData.status,
              success: true,
              error: '',
            },
          };
        }

        if (status === 'FAILED') {
          return { status: 'FAILED', result: { error: 'Job failed' } };
        }

        // Still in progress, wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        pollInterval = Math.min(pollInterval * 1.5, maxInterval); // Exponential backoff
      } catch (error) {
        return {
          status: 'FAILED',
          result: {
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          },
        };
      }
    }

    return {
      status: 'TIMEOUT',
      result: { error: 'Polling timeout exceeded' },
    };
  }

  /**
   * Make API request to fal.ai
   */
  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown,
    apiKey?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Key ${apiKey}`;
    }

    return fetch(`${FAL_AI_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async textToImage(
    params: Extract<FalAiParamsParsed, { operation: 'text_to_image' }>
  ): Promise<Extract<FalAiResult, { operation: 'text_to_image' }>> {
    const {
      model,
      prompt,
      imageSize,
      numImages,
      seed,
      numInferenceSteps,
      guidanceScale,
      enableSafetyChecker,
      waitForResult,
      maxWaitTime,
    } = params;

    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'text_to_image',
        success: false,
        error: 'Fal AI API key is required',
      };
    }

    try {
      // Build request body
      const requestBody: Record<string, unknown> = {
        prompt,
        image_size: imageSize,
        num_images: numImages,
      };

      if (seed !== undefined) {
        requestBody.seed = seed;
      }
      if (numInferenceSteps !== undefined) {
        requestBody.num_inference_steps = numInferenceSteps;
      }
      if (guidanceScale !== undefined) {
        requestBody.guidance_scale = guidanceScale;
      }
      if (enableSafetyChecker !== undefined) {
        requestBody.enable_safety_checker = enableSafetyChecker;
      }

      // Submit the request
      const response = await this.makeApiRequest(
        `/fal-ai/${model}`,
        'POST',
        requestBody,
        apiKey
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'text_to_image',
          success: false,
          error: `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        request_id: string;
        status?: string;
      };

      const requestId = data.request_id;

      // If not waiting for result, return immediately
      if (!waitForResult) {
        return {
          operation: 'text_to_image',
          requestId,
          success: true,
          error: '',
        };
      }

      // Poll for result
      const pollResult = await this.pollForResult(
        requestId,
        maxWaitTime ?? 300000,
        apiKey
      );

      if (pollResult.status === 'COMPLETED' && pollResult.result) {
        const result = pollResult.result as Extract<
          FalAiResult,
          { operation: 'get_result' }
        >;
        return {
          operation: 'text_to_image',
          imageUrl: result.imageUrl,
          imageUrls: result.imageUrls,
          status: 'COMPLETED',
          success: true,
          error: '',
        };
      }

      return {
        operation: 'text_to_image',
        requestId,
        status: pollResult.status,
        success: false,
        error:
          (pollResult.result as { error?: string })?.error ||
          'Image generation failed or timed out',
      };
    } catch (error) {
      return {
        operation: 'text_to_image',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async imageToImage(
    params: Extract<FalAiParamsParsed, { operation: 'image_to_image' }>
  ): Promise<Extract<FalAiResult, { operation: 'image_to_image' }>> {
    const {
      model,
      prompt,
      imageUrl,
      strength,
      numImages,
      seed,
      waitForResult,
      maxWaitTime,
    } = params;

    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'image_to_image',
        success: false,
        error: 'Fal AI API key is required',
      };
    }

    try {
      // Build request body
      const requestBody: Record<string, unknown> = {
        prompt,
        image_url: imageUrl,
        strength,
        num_images: numImages,
      };

      if (seed !== undefined) {
        requestBody.seed = seed;
      }

      // Submit the request
      const response = await this.makeApiRequest(
        `/fal-ai/${model}`,
        'POST',
        requestBody,
        apiKey
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'image_to_image',
          success: false,
          error: `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        request_id: string;
        status?: string;
      };

      const requestId = data.request_id;

      // If not waiting for result, return immediately
      if (!waitForResult) {
        return {
          operation: 'image_to_image',
          requestId,
          success: true,
          error: '',
        };
      }

      // Poll for result
      const pollResult = await this.pollForResult(
        requestId,
        maxWaitTime ?? 300000,
        apiKey
      );

      if (pollResult.status === 'COMPLETED' && pollResult.result) {
        const result = pollResult.result as Extract<
          FalAiResult,
          { operation: 'get_result' }
        >;
        return {
          operation: 'image_to_image',
          imageUrl: result.imageUrl,
          imageUrls: result.imageUrls,
          status: 'COMPLETED',
          success: true,
          error: '',
        };
      }

      return {
        operation: 'image_to_image',
        requestId,
        status: pollResult.status,
        success: false,
        error:
          (pollResult.result as { error?: string })?.error ||
          'Image transformation failed or timed out',
      };
    } catch (error) {
      return {
        operation: 'image_to_image',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getStatus(
    params: Extract<FalAiParamsParsed, { operation: 'get_status' }>
  ): Promise<Extract<FalAiResult, { operation: 'get_status' }>> {
    const { requestId } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_status',
        status: 'FAILED',
        success: false,
        error: 'Fal AI API key is required',
      };
    }

    try {
      const response = await this.makeApiRequest(
        `/${requestId}/status`,
        'GET',
        undefined,
        apiKey
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_status',
          status: 'FAILED',
          success: false,
          error: `Failed to get status: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as { status: string };
      return {
        operation: 'get_status',
        status: data.status,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_status',
        status: 'FAILED',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getResult(
    params: Extract<FalAiParamsParsed, { operation: 'get_result' }>
  ): Promise<Extract<FalAiResult, { operation: 'get_result' }>> {
    const { requestId } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_result',
        success: false,
        error: 'Fal AI API key is required',
      };
    }

    try {
      const response = await this.makeApiRequest(
        `/${requestId}`,
        'GET',
        undefined,
        apiKey
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_result',
          success: false,
          error: `Failed to get result: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        images?: Array<{ url: string }>;
        image?: { url: string };
        status?: string;
      };

      // Handle different response formats
      let imageUrl: string | undefined;
      let imageUrls: string[] | undefined;

      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        imageUrls = data.images.map((img) => img.url);
        imageUrl = imageUrls[0]; // First image as primary
      } else if (data.image?.url) {
        imageUrl = data.image.url;
      }

      return {
        operation: 'get_result',
        imageUrl,
        imageUrls,
        status: data.status,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_result',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
