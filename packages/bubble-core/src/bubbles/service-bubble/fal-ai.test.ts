import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FalAiBubble } from './fal-ai.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Mock fetch
const globalFetch = global.fetch;
const mockFetch = vi.fn();

describe('FalAiBubble', () => {
  let bubble: FalAiBubble;
  const mockApiKey = 'fal-mock-api-key';

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('basic properties', () => {
    it('should have correct static properties', () => {
      expect(FalAiBubble.bubbleName).toBe('fal-ai');
      expect(FalAiBubble.service).toBe('fal-ai');
      expect(FalAiBubble.authType).toBe('apikey');
      expect(FalAiBubble.type).toBe('service');
      expect(FalAiBubble.alias).toBe('falai');
      expect(FalAiBubble.shortDescription).toContain('fal.ai');
    });

    it('should have longDescription with use cases', () => {
      const bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
      });
      expect(bubble.longDescription).toContain('media generation');
      expect(bubble.longDescription).toContain('Text-to-image');
    });
  });

  describe('text_to_image', () => {
    it('should successfully generate an image with waitForResult=true', async () => {
      const mockRequestId = 'req-123';
      const mockImageUrl = 'https://fal.ai/files/image.png';

      // Mock initial request submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: mockRequestId }),
      });

      // Mock status check (IN_PROGRESS) - first poll
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'IN_PROGRESS' }),
      });

      // Mock status check (COMPLETED) - second poll
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'COMPLETED' }),
      });

      // Mock result retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: [{ url: mockImageUrl }],
          status: 'COMPLETED',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'A beautiful sunset',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const resultPromise = bubble.performAction();

      // Advance timers to allow polling to complete
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result).toEqual({
        operation: 'text_to_image',
        imageUrl: mockImageUrl,
        imageUrls: [mockImageUrl],
        status: 'COMPLETED',
        success: true,
        error: '',
      });

      // Verify API calls
      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/fal-ai/flux/dev',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Key ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return request_id immediately when waitForResult=false', async () => {
      const mockRequestId = 'req-456';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: mockRequestId }),
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'A beautiful sunset',
        waitForResult: false,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'text_to_image',
        requestId: mockRequestId,
        success: true,
        error: '',
      });

      // Should only call once (no polling)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      const errorMessage = 'Invalid API key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => errorMessage,
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'text_to_image',
        success: false,
        error: expect.stringContaining('API request failed'),
      });
    });

    it('should handle missing credentials', async () => {
      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'text_to_image',
        success: false,
        error: 'fal.ai API key is required',
      });
    });

    it('should apply default values', async () => {
      const mockRequestId = 'req-default';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: mockRequestId }),
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        waitForResult: false,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      await bubble.performAction();

      const requestBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string
      );
      expect(requestBody.image_size).toBe('square_hd');
      expect(requestBody.num_images).toBe(1);
      expect(requestBody.enable_safety_checker).toBe(true);
    });

    it('should handle multiple images', async () => {
      const mockRequestId = 'req-multi';
      const mockImageUrls = [
        'https://fal.ai/files/image1.png',
        'https://fal.ai/files/image2.png',
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'COMPLETED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            images: mockImageUrls.map((url) => ({ url })),
            status: 'COMPLETED',
          }),
        });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        numImages: 2,
        waitForResult: true,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const resultPromise = bubble.performAction();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result.imageUrls).toEqual(mockImageUrls);
      expect(result.imageUrl).toBe(mockImageUrls[0]);
    });

    it('should handle polling timeout', async () => {
      const mockRequestId = 'req-timeout';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ status: 'IN_PROGRESS' }),
        });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        waitForResult: true,
        maxWaitTime: 1000, // 1 second timeout
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const resultPromise = bubble.performAction();

      // Fast-forward time to trigger timeout (need to go past maxWaitTime)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('image_to_image', () => {
    it('should successfully transform an image', async () => {
      const mockRequestId = 'req-img2img';
      const mockImageUrl = 'https://fal.ai/files/transformed.png';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'COMPLETED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            images: [{ url: mockImageUrl }],
            status: 'COMPLETED',
          }),
        });

      bubble = new FalAiBubble({
        operation: 'image_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'Make it more colorful',
        imageUrl: 'https://example.com/image.jpg',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const resultPromise = bubble.performAction();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result).toEqual({
        operation: 'image_to_image',
        imageUrl: mockImageUrl,
        imageUrls: [mockImageUrl],
        status: 'COMPLETED',
        success: true,
        error: '',
      });

      const requestBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string
      );
      expect(requestBody.image_url).toBe('https://example.com/image.jpg');
      expect(requestBody.prompt).toBe('Make it more colorful');
      expect(requestBody.strength).toBe(0.8); // Default value
    });

    it('should handle missing credentials', async () => {
      bubble = new FalAiBubble({
        operation: 'image_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        imageUrl: 'https://example.com/image.jpg',
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'image_to_image',
        success: false,
        error: 'fal.ai API key is required',
      });
    });
  });

  describe('get_status', () => {
    it('should successfully get job status', async () => {
      const mockRequestId = 'req-status';
      const mockStatus = 'IN_PROGRESS';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: mockStatus }),
      });

      bubble = new FalAiBubble({
        operation: 'get_status',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_status',
        status: mockStatus,
        success: true,
        error: '',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://queue.fal.run/${mockRequestId}/status`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Key ${mockApiKey}`,
          }),
        })
      );
    });

    it('should handle API errors when getting status', async () => {
      const mockRequestId = 'req-invalid';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Request not found',
      });

      bubble = new FalAiBubble({
        operation: 'get_status',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_status',
        status: 'FAILED',
        success: false,
        error: expect.stringContaining('Failed to get status'),
      });
    });

    it('should handle missing credentials', async () => {
      bubble = new FalAiBubble({
        operation: 'get_status',
        requestId: 'req-123',
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_status',
        status: 'FAILED',
        success: false,
        error: 'fal.ai API key is required',
      });
    });
  });

  describe('get_result', () => {
    it('should successfully get job result', async () => {
      const mockRequestId = 'req-result';
      const mockImageUrl = 'https://fal.ai/files/result.png';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: [{ url: mockImageUrl }],
          status: 'COMPLETED',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_result',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_result',
        imageUrl: mockImageUrl,
        imageUrls: [mockImageUrl],
        status: 'COMPLETED',
        success: true,
        error: '',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://queue.fal.run/${mockRequestId}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Key ${mockApiKey}`,
          }),
        })
      );
    });

    it('should handle single image format', async () => {
      const mockRequestId = 'req-single';
      const mockImageUrl = 'https://fal.ai/files/single.png';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          image: { url: mockImageUrl },
          status: 'COMPLETED',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_result',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.imageUrl).toBe(mockImageUrl);
    });

    it('should handle multiple images in result', async () => {
      const mockRequestId = 'req-multi-result';
      const mockImageUrls = [
        'https://fal.ai/files/result1.png',
        'https://fal.ai/files/result2.png',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: mockImageUrls.map((url) => ({ url })),
          status: 'COMPLETED',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_result',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.imageUrls).toEqual(mockImageUrls);
      expect(result.imageUrl).toBe(mockImageUrls[0]);
    });

    it('should handle API errors when getting result', async () => {
      const mockRequestId = 'req-error';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Result not found',
      });

      bubble = new FalAiBubble({
        operation: 'get_result',
        requestId: mockRequestId,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_result',
        success: false,
        error: expect.stringContaining('Failed to get result'),
      });
    });

    it('should handle missing credentials', async () => {
      bubble = new FalAiBubble({
        operation: 'get_result',
        requestId: 'req-123',
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_result',
        success: false,
        error: 'fal.ai API key is required',
      });
    });
  });

  describe('testCredential', () => {
    it('should return true for valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 404, // 404 is OK (invalid request ID, but valid auth)
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.testCredential();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/test-request-id/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Key ${mockApiKey}`,
          }),
        })
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid credentials (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: 'invalid-key',
        },
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });

    it('should return false if no API key provided', async () => {
      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });

    it('should return false if fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });
  });

  describe('polling logic', () => {
    it('should poll with exponential backoff', async () => {
      const mockRequestId = 'req-poll';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'IN_QUEUE' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'IN_PROGRESS' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'COMPLETED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            images: [{ url: 'https://fal.ai/files/polled.png' }],
            status: 'COMPLETED',
          }),
        });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        waitForResult: true,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const resultPromise = bubble.performAction();

      // Advance timers to simulate polling delays
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      // Should have called status endpoint multiple times
      expect(mockFetch).toHaveBeenCalledTimes(5); // 1 submit + 3 status + 1 result
    });

    it('should handle FAILED status', async () => {
      const mockRequestId = 'req-failed';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'FAILED' }),
        });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        waitForResult: true,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  describe('action() method integration', () => {
    it('should work when calling .action() inherited from BaseBubble', async () => {
      const mockRequestId = 'req-action';
      const mockImageUrl = 'https://fal.ai/files/action.png';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: mockRequestId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'COMPLETED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            images: [{ url: mockImageUrl }],
            status: 'COMPLETED',
          }),
        });

      bubble = new FalAiBubble({
        operation: 'text_to_image',
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        waitForResult: true,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      // Call .action() instead of .performAction()
      const resultPromise = bubble.action();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        operation: 'text_to_image',
        imageUrl: mockImageUrl,
        imageUrls: [mockImageUrl],
        status: 'COMPLETED',
        success: true,
        error: '',
      });
    });
  });

  describe('list_models', () => {
    it('should successfully list models', async () => {
      const mockModels = [
        {
          endpoint_id: 'fal-ai/flux/dev',
          metadata: {
            display_name: 'FLUX.1 [dev]',
            category: 'text-to-image',
            description: 'Fast text-to-image generation',
            status: 'active',
          },
        },
        {
          endpoint_id: 'fal-ai/flux/schnell',
          metadata: {
            display_name: 'FLUX.1 [schnell]',
            category: 'text-to-image',
            status: 'active',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: mockModels,
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        limit: 10,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'list_models',
        models: mockModels,
        has_more: false,
        success: true,
        error: '',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models?limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Key ${mockApiKey}`,
          }),
        })
      );
    });

    it('should handle pagination with cursor', async () => {
      const mockCursor = 'cursor-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: true,
          next_cursor: 'cursor-456',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        limit: 5,
        cursor: mockCursor,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('cursor-456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`cursor=${mockCursor}`),
        expect.any(Object)
      );
    });

    it('should support OpenAPI schema expansion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              endpoint_id: 'fal-ai/flux/dev',
              openapi: {
                openapi: '3.0.4',
                paths: {},
                components: {},
              },
            },
          ],
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        limit: 1,
        expand: ['openapi-3.0'],
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('expand=openapi-3.0'),
        expect.any(Object)
      );
    });

    it('should support category filtering', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        category: 'text-to-image',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      await bubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=text-to-image'),
        expect.any(Object)
      );
    });

    it('should support status filtering', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        status: 'active',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      await bubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=active'),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'list_models',
        success: false,
        error: expect.stringContaining('Failed to list models'),
      });
    });

    it('should work without credentials (lower rate limits)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'list_models',
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      // Should not include Authorization header
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });

  describe('search_models', () => {
    it('should successfully search models', async () => {
      const mockModels = [
        {
          endpoint_id: 'fal-ai/flux/dev',
          metadata: {
            display_name: 'FLUX.1 [dev]',
            category: 'text-to-image',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: mockModels,
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'search_models',
        query: 'flux',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'search_models',
        models: mockModels,
        has_more: false,
        success: true,
        error: '',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=flux'),
        expect.any(Object)
      );
    });

    it('should support combined search and filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: false,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'search_models',
        query: 'video',
        category: 'image-to-video',
        limit: 5,
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      await bubble.performAction();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('q=video');
      expect(callUrl).toContain('category=image-to-video');
      expect(callUrl).toContain('limit=5');
    });

    it('should handle search with pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
          has_more: true,
          next_cursor: 'search-cursor-123',
        }),
      });

      bubble = new FalAiBubble({
        operation: 'search_models',
        query: 'stable diffusion',
        cursor: 'prev-cursor',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      expect(result.next_cursor).toBe('search-cursor-123');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid query',
      });

      bubble = new FalAiBubble({
        operation: 'search_models',
        query: 'test',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'search_models',
        success: false,
        error: expect.stringContaining('Failed to search models'),
      });
    });
  });

  describe('get_model', () => {
    it('should successfully get a single model', async () => {
      const mockModel = {
        endpoint_id: 'fal-ai/flux/dev',
        metadata: {
          display_name: 'FLUX.1 [dev]',
          category: 'text-to-image',
          description: 'Fast, high-quality image generation',
          status: 'active',
          tags: ['fast', 'pro'],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [mockModel],
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_model',
        endpointId: 'fal-ai/flux/dev',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_model',
        models: [mockModel],
        success: true,
        error: '',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('endpoint_id=fal-ai%2Fflux%2Fdev'),
        expect.any(Object)
      );
    });

    it('should support multiple endpoint IDs', async () => {
      const mockModels = [
        { endpoint_id: 'fal-ai/flux/dev' },
        { endpoint_id: 'fal-ai/flux/schnell' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: mockModels,
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_model',
        endpointId: ['fal-ai/flux/dev', 'fal-ai/flux/schnell'],
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(2);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('endpoint_id=fal-ai%2Fflux%2Fdev');
      expect(callUrl).toContain('endpoint_id=fal-ai%2Fflux%2Fschnell');
    });

    it('should support OpenAPI schema expansion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              endpoint_id: 'fal-ai/flux/dev',
              openapi: {
                openapi: '3.0.4',
                paths: {
                  '/': {
                    post: {
                      requestBody: {},
                    },
                  },
                },
              },
            },
          ],
        }),
      });

      bubble = new FalAiBubble({
        operation: 'get_model',
        endpointId: 'fal-ai/flux/dev',
        expand: ['openapi-3.0'],
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('expand=openapi-3.0'),
        expect.any(Object)
      );
    });

    it('should handle model not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found',
      });

      bubble = new FalAiBubble({
        operation: 'get_model',
        endpointId: 'fal-ai/nonexistent',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result).toEqual({
        operation: 'get_model',
        success: false,
        error: expect.stringContaining('Failed to get model'),
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      bubble = new FalAiBubble({
        operation: 'get_model',
        endpointId: 'fal-ai/flux/dev',
        credentials: {
          [CredentialType.FAL_AI_API_KEY]: mockApiKey,
        },
      });

      const result = await bubble.performAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });
});
