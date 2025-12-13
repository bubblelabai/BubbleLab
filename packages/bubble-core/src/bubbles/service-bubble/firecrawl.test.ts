import { ZodObject, ZodDiscriminatedUnion } from 'zod';
import { FirecrawlBubble } from '../../index.js';
import { BubbleFactory } from '../../bubble-factory.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { vi } from 'vitest';

// Helper function to create test credentials
const createTestCredentials = () => ({
  [CredentialType.FIRECRAWL_API_KEY]: 'fc-0123456789abcdef0123456789abcdef',
});

// Mock Firecrawl SDK
vi.mock('@mendable/firecrawl-js', () => {
  return {
    Firecrawl: vi.fn().mockImplementation(() => {
      return {
        getConcurrency: vi.fn().mockResolvedValue(5),

        scrape: vi.fn().mockImplementation(async (url, opts) => ({
          markdown: '# Test',
          html: '<h1>Test</h1>',
          url,
          opts,
        })),

        search: vi.fn().mockImplementation(async (query) => ({
          data: [{ url: 'https://example.com', title: 'Result' }],
        })),

        map: vi.fn().mockResolvedValue({
          links: [
            {
              url: 'https://example.com',
              title: 'Home',
              description: 'Example',
              category: 'web',
            },
          ],
        }),

        crawl: vi.fn().mockImplementation(async () => ({
          status: 'completed',
          total: 1,
          completed: 1,
          data: [{ markdown: '# Page' }],
        })),

        extract: vi.fn().mockResolvedValue({
          success: true,
          data: { name: 'Example' },
          status: 'completed',
          id: 'job123',
        }),
      };
    }),
  };
});

const factory = new BubbleFactory();

beforeAll(async () => {
  await factory.registerDefaults();
});

describe('FirecrawlBubble', () => {
  //
  // REGISTRATION & SCHEMA
  //
  describe('Registration & Schema', () => {
    test('should be registered in BubbleRegistry', async () => {
      const bubbleClass = factory.get('firecrawl');
      expect(bubbleClass).toBeDefined();
      expect(bubbleClass).toBe(FirecrawlBubble);
    });

    test('schema should be a Zod discriminated union based on "operation"', () => {
      const schema = FirecrawlBubble.schema;
      expect(schema).toBeDefined();

      // Validate ZodDiscriminatedUnion
      expect(schema instanceof ZodDiscriminatedUnion).toBe(true);

      const du = schema as ZodDiscriminatedUnion<
        'operation',
        readonly ZodObject<any>[]
      >;
      expect(du.discriminator).toBe('operation');

      const operationValues = du.options.map((o) => o.shape.operation.value);

      expect(operationValues).toContain('scrape');
      expect(operationValues).toContain('search');
      expect(operationValues).toContain('map');
      expect(operationValues).toContain('crawl');
      expect(operationValues).toContain('extract');
    });

    test('result schema should validate a sample scrape result', () => {
      const sample = {
        operation: 'scrape',
        success: true,
        error: '',
        markdown: '# Hello',
      };

      const parsed = FirecrawlBubble.resultSchema.safeParse(sample);
      expect(parsed.success).toBe(true);
    });
  });

  //
  // CREDENTIAL VALIDATION
  //
  describe('Credential Validation', () => {
    test('should fail testCredential() with missing credentials', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'scrape',
        url: 'https://example.com',
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });

    test('should pass testCredential() with valid credentials', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'scrape',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const result = await bubble.testCredential();
      expect(result).toBe(true);
    });
  });

  //
  // SCRAPE
  //
  describe('Scrape Operation', () => {
    test('should return success for scrape', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'scrape',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('scrape');
      expect(res.success).toBe(true);
      expect(res.error).toBe('');
      expect(res.data.markdown).toBeDefined();
    });
  });

  //
  // SEARCH
  //
  describe('Search Operation', () => {
    test('should return search results', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'search',
        query: 'hello',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('search');
      expect(res.success).toBe(true);
      expect(res.data.other || res.data.web || res.data).toBeDefined();
    });
  });

  //
  // MAP
  //
  describe('Map Operation', () => {
    test('should return map results', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'map',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('map');
      expect(res.success).toBe(true);
      expect(res.data.links.length).toBeGreaterThan(0);
    });
  });

  //
  // CRAWL
  //
  describe('Crawl Operation', () => {
    test('should return crawl results', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'crawl',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('crawl');
      expect(res.data.status).toBe('completed');
      expect(res.success).toBe(true);
      expect(res.data.data.length).toBeGreaterThan(0);
    });
  });

  //
  // EXTRACT
  //
  describe('Extract Operation', () => {
    test('should return extract results', async () => {
      const bubble = new FirecrawlBubble({
        operation: 'extract',
        urls: ['https://example.com'],
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('extract');
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });
  });

  //
  // METADATA
  //
  describe('Metadata Tests', () => {
    test('should have correct metadata', () => {
      const metadata = factory.getMetadata('firecrawl');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('firecrawl');
      expect(metadata?.alias).toBe('firecrawl');
      expect(metadata?.schema).toBeDefined();
      expect(metadata?.resultSchema).toBeDefined();
      expect(metadata?.shortDescription).toContain('Firecrawl');
      expect(metadata?.longDescription).toContain('web crawling');
    });

    test('static properties are correct', () => {
      expect(FirecrawlBubble.bubbleName).toBe('firecrawl');
      expect(FirecrawlBubble.alias).toBe('firecrawl');
      expect(FirecrawlBubble.schema).toBeDefined();
      expect(FirecrawlBubble.resultSchema).toBeDefined();
      expect(FirecrawlBubble.shortDescription).toContain('Firecrawl');
      expect(FirecrawlBubble.longDescription).toContain('Scrape content');
    });
  });
});
