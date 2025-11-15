import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebTestTool } from './web-test-tool.js';
import type { BubbleContext } from '../../types/bubble.js';

// Mock Firecrawl
vi.mock('@mendable/firecrawl-js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      scrape: vi.fn().mockResolvedValue({
        markdown: '# Test Page\n\nThis is a test page with content.',
        html: '<h1>Test Page</h1><p>This is a test page with content.</p>',
        rawHtml: '<!DOCTYPE html><html><body>...</body></html>',
        links: ['https://example.com/link1', 'https://example.com/link2'],
        screenshot: 'base64-encoded-screenshot-data',
        extract: {
          title: 'Test Product',
          price: 99.99,
          images: ['https://example.com/image1.jpg'],
        },
        metadata: {
          title: 'Test Page',
          description: 'A test page description',
          statusCode: 200,
        },
      }),
    })),
  };
});

describe('WebTestTool', () => {
  let context: BubbleContext;

  beforeEach(() => {
    context = {
      executionId: 'test-execution',
      userId: 'test-user',
    } as BubbleContext;
  });

  describe('Static Properties', () => {
    it('should have correct bubble metadata', () => {
      expect(WebTestTool.bubbleName).toBe('web-test-tool');
      expect(WebTestTool.alias).toBe('webtest');
      expect(WebTestTool.type).toBe('tool');
      expect(WebTestTool.shortDescription).toContain('web testing');
      expect(WebTestTool.longDescription).toBeTruthy();
    });

    it('should have valid schemas', () => {
      expect(WebTestTool.schema).toBeDefined();
      expect(WebTestTool.resultSchema).toBeDefined();
    });
  });

  describe('Basic Scraping', () => {
    it('should scrape a URL with default options', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.url).toBe('https://example.com');
      expect(result.data?.markdown).toContain('Test Page');
      expect(result.data?.error).toBe('');
    });

    it('should return error when API key is missing', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(false);
      expect(result.data?.error).toContain('FIRECRAWL_API_KEY');
    });

    it('should scrape with multiple formats', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          formats: ['markdown', 'html', 'rawHtml', 'links'],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.markdown).toBeTruthy();
      expect(result.data?.html).toBeTruthy();
      expect(result.data?.rawHtml).toBeTruthy();
      expect(result.data?.links).toBeInstanceOf(Array);
      expect(result.data?.links?.length).toBeGreaterThan(0);
    });
  });

  describe('Browser Actions', () => {
    it('should perform click action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'click',
              selector: '#accept-button',
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform write action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'write',
              selector: '#username',
              text: 'testuser',
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform wait action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'wait',
              milliseconds: 1000,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform scroll action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'scroll',
              direction: 'down',
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform press key action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'press',
              key: 'Enter',
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform execute JavaScript action', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            {
              type: 'executeJavascript',
              script: 'document.querySelector(".modal").remove()',
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(1);
    });

    it('should perform multiple actions in sequence', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/login',
          actions: [
            { type: 'wait', milliseconds: 500 },
            { type: 'click', selector: '#login-btn' },
            { type: 'write', selector: '#username', text: 'user@example.com' },
            { type: 'write', selector: '#password', text: 'password123' },
            { type: 'press', key: 'Enter' },
            { type: 'wait', milliseconds: 2000 },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(6);
    });
  });

  describe('Screenshot Functionality', () => {
    it('should capture viewport screenshot', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          formats: [
            {
              type: 'screenshot',
              fullPage: false,
              quality: 90,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.screenshot?.base64).toBeTruthy();
      expect(result.data?.screenshot?.fullPage).toBe(false);
      expect(result.data?.screenshot?.format).toBe('png');
    });

    it('should capture full page screenshot', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          formats: [
            {
              type: 'screenshot',
              fullPage: true,
              quality: 80,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.screenshot?.fullPage).toBe(true);
    });

    it('should capture screenshot with custom viewport', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          formats: [
            {
              type: 'screenshot',
              fullPage: false,
              quality: 95,
              viewport: {
                width: 1920,
                height: 1080,
              },
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.screenshot).toBeDefined();
    });

    it('should capture screenshot after performing actions', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          actions: [
            { type: 'click', selector: '#menu-button' },
            { type: 'wait', milliseconds: 500 },
            { type: 'screenshot', fullPage: true },
          ],
          formats: [
            {
              type: 'screenshot',
              fullPage: true,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.metadata?.actionsPerformed).toBe(3);
    });
  });

  describe('JSON Extraction', () => {
    it('should extract structured data with JSON format', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/product',
          formats: [
            {
              type: 'json',
              prompt: 'Extract product name, price, and images',
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  price: { type: 'number' },
                  images: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'price'],
              },
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.extractedJson).toBeDefined();
      expect(result.data?.extractedJson?.title).toBe('Test Product');
      expect(result.data?.extractedJson?.price).toBe(99.99);
    });

    it('should extract data after performing actions', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/product',
          actions: [
            { type: 'click', selector: '.show-details' },
            { type: 'wait', milliseconds: 1000 },
          ],
          formats: [
            {
              type: 'json',
              prompt: 'Extract all product details',
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  price: { type: 'number' },
                },
              },
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.extractedJson).toBeDefined();
      expect(result.data?.metadata?.actionsPerformed).toBe(2);
    });
  });

  describe('Advanced Options', () => {
    it('should respect include/exclude tags', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          includeTags: ['h1', 'p', '.content'],
          excludeTags: ['#ad', '.footer', '#cookie-banner'],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });

    it('should set main content extraction', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          onlyMainContent: false,
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });

    it('should wait before scraping', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          waitFor: 2000,
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });

    it('should respect custom timeout', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          timeout: 45000,
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });

    it('should parse PDFs when specified', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/document.pdf',
          parsers: ['pdf'],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });

    it('should control cache with maxAge', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          maxAge: 0, // Force fresh scrape
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle login flow with screenshot', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/app',
          actions: [
            { type: 'click', selector: '#login-btn' },
            { type: 'write', selector: '#email', text: 'user@example.com' },
            { type: 'write', selector: '#password', text: 'secure123' },
            { type: 'press', key: 'Enter' },
            { type: 'wait', milliseconds: 3000 },
          ],
          formats: [
            'markdown',
            {
              type: 'screenshot',
              fullPage: true,
              quality: 85,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.markdown).toBeTruthy();
      expect(result.data?.screenshot).toBeDefined();
      expect(result.data?.metadata?.actionsPerformed).toBe(5);
    });

    it('should handle e-commerce product extraction', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://shop.example.com/product/123',
          actions: [
            { type: 'click', selector: '.cookie-accept' },
            { type: 'wait', milliseconds: 500 },
            { type: 'click', selector: '.show-all-images' },
            { type: 'wait', milliseconds: 1000 },
          ],
          formats: [
            {
              type: 'json',
              prompt:
                'Extract product name, price, description, all image URLs, and availability',
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  description: { type: 'string' },
                  images: { type: 'array', items: { type: 'string' } },
                  inStock: { type: 'boolean' },
                },
              },
            },
            {
              type: 'screenshot',
              fullPage: true,
            },
          ],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.extractedJson).toBeDefined();
      expect(result.data?.screenshot).toBeDefined();
    });

    it('should handle form automation and validation', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com/contact',
          actions: [
            { type: 'write', selector: '#name', text: 'John Doe' },
            { type: 'write', selector: '#email', text: 'john@example.com' },
            {
              type: 'write',
              selector: '#message',
              text: 'This is a test message',
            },
            { type: 'click', selector: '#submit' },
            { type: 'wait', milliseconds: 2000 },
            { type: 'screenshot', fullPage: false },
          ],
          formats: [
            'markdown',
            {
              type: 'screenshot',
              fullPage: false,
            },
          ],
          excludeTags: ['#header', '#footer'],
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.success).toBe(true);
      expect(result.data?.metadata?.actionsPerformed).toBe(6);
    });
  });

  describe('Metadata', () => {
    it('should include execution metadata', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata?.executionTime).toBeGreaterThan(0);
      expect(result.data?.metadata?.title).toBe('Test Page');
      expect(result.data?.metadata?.statusCode).toBe(200);
    });

    it('should track credits used', async () => {
      const tool = new WebTestTool(
        {
          url: 'https://example.com',
          credentials: {
            FIRECRAWL_API_KEY: 'test-api-key',
          },
        },
        context
      );

      const result = await tool.action();

      expect(result.data?.creditsUsed).toBeGreaterThanOrEqual(1);
    });
  });
});
