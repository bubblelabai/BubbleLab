import { describe, it, expect } from 'vitest';
import { WebExtractTool } from './web-extract-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('WebExtractTool', () => {
  const mockCredentials = {
    [CredentialType.FIRECRAWL_API_KEY]:
      process.env.FIRECRAWL_API_KEY || 'test-key',
  };

  describe('Schema Validation', () => {
    it('should validate required parameters', () => {
      const validParams = {
        url: 'https://example.com',
        prompt: 'Extract product information',
        schema: '{"name": "string", "price": "number"}',
        credentials: mockCredentials,
      };

      const result = WebExtractTool.schema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidParams = {
        url: 'not-a-url',
        prompt: 'Extract data',
        schema: '{}',
      };

      const result = WebExtractTool.schema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject empty prompt', () => {
      const invalidParams = {
        url: 'https://example.com',
        prompt: '',
        schema: '{}',
      };

      const result = WebExtractTool.schema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject empty schema', () => {
      const invalidParams = {
        url: 'https://example.com',
        prompt: 'Extract data',
        schema: '',
      };

      const result = WebExtractTool.schema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return error when FIRECRAWL_API_KEY is missing', async () => {
      const extractTool = new WebExtractTool({
        url: 'https://example.com',
        prompt: 'Extract data',
        schema: '{}',
        // No credentials provided
      });

      const result = await extractTool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('FIRECRAWL_API_KEY is required');
    });

    it('should return error when schema is invalid JSON', async () => {
      const extractTool = new WebExtractTool({
        url: 'https://example.com',
        prompt: 'Extract data',
        schema: 'invalid json',
        credentials: mockCredentials,
      });

      const result = await extractTool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON schema provided');
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(WebExtractTool.bubbleName).toBe('web-extract-tool');
      expect(WebExtractTool.shortDescription).toContain('structured data');
      expect(WebExtractTool.longDescription).toContain('AI-powered');
      expect(WebExtractTool.alias).toBe('extract');
      expect(WebExtractTool.type).toBe('tool');
    });
  });

  // Integration test - only runs if FIRECRAWL_API_KEY is available
  describe('Integration Tests', () => {
    const hasApiKey = process.env.FIRECRAWL_API_KEY;

    it.skipIf(!hasApiKey)(
      'should extract product data from Uniqlo page',
      async () => {
        const extractTool = new WebExtractTool({
          url: 'https://www.uniqlo.com/us/en/products/E470612-000',
          prompt:
            'Extract the product name, price, and all available product image URLs (especially PNG images). Focus on the main product images that show the clothing item clearly.',
          schema: JSON.stringify({
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              images: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['name', 'images'],
          }),
          credentials: mockCredentials,
        });

        const result = await extractTool.action();

        console.log('Extraction result:', JSON.stringify(result, null, 2));

        expect(result.success).toBe(true);
        expect(result.data?.extractedData).toBeDefined();

        if (result.success && result.data?.extractedData) {
          const data = result.data.extractedData as {
            name?: string;
            images?: string[];
            [key: string]: unknown;
          };
          expect(data.name).toBeDefined();
          expect(data.images).toBeDefined();
          expect(Array.isArray(data.images)).toBe(true);

          // Check if we got image URLs
          if (data.images && data.images.length > 0) {
            console.log('Found images:', data.images);
            // Check if any images are PNG or contain image URLs
            const hasImageUrls = data.images.some(
              (img: string) =>
                typeof img === 'string' &&
                (img.includes('.png') ||
                  img.includes('.jpg') ||
                  img.includes('.jpeg') ||
                  img.includes('image'))
            );
            expect(hasImageUrls).toBe(true);
          }
        }
      },
      30000
    ); // 30 second timeout for API call

    it.skipIf(!hasApiKey)(
      'should extract structured data with specific schema',
      async () => {
        const extractTool = new WebExtractTool({
          url: 'https://www.uniqlo.com/us/en/products/E470612-000',
          prompt:
            'Extract the main product image URL that ends in .png or .jpg. Look for the primary product image that shows the clothing item.',
          schema: JSON.stringify({
            type: 'object',
            properties: {
              main_image_url: {
                type: 'string',
                description: 'The main product image URL',
              },
              product_name: {
                type: 'string',
                description: 'The name of the product',
              },
            },
            required: ['main_image_url', 'product_name'],
          }),
          credentials: mockCredentials,
        });

        const result = await extractTool.action();

        console.log(
          'Structured extraction result:',
          JSON.stringify(result, null, 2)
        );

        expect(result.success).toBe(true);
        expect(result.data?.extractedData).toBeDefined();

        if (result.success && result.data?.extractedData) {
          const data = result.data.extractedData as {
            main_image_url?: string;
            product_name?: string;
            [key: string]: unknown;
          };
          expect(data.main_image_url).toBeDefined();
          expect(data.product_name).toBeDefined();
          expect(typeof data.main_image_url).toBe('string');
          expect(typeof data.product_name).toBe('string');
        }
      },
      30000
    );
  });
});
