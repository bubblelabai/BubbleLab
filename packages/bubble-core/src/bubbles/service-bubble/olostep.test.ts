import { describe, it, expect, beforeAll, vi } from 'vitest';
import { OlostepBubble, type OlostepParamsInput } from './olostep.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleFactory } from '../../bubble-factory.js';
import { ZodDiscriminatedUnion, ZodObject } from 'zod';

// Helper function to create test credentials
const createTestCredentials = () => ({
  [CredentialType.OLOSTEP_API_KEY]: 'ols_test_0123456789abcdef',
});

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const factory = new BubbleFactory();

beforeAll(async () => {
  await factory.registerDefaults();
});

/**
 * Unit tests for Olostep Service Bubble
 *
 * Tests the Olostep API integration for web scraping, crawling, and AI-powered content extraction
 */
describe('OlostepBubble', () => {
  //
  // REGISTRATION & SCHEMA
  //
  describe('Registration & Schema', () => {
    it('should be registered in BubbleRegistry', async () => {
      const bubbleClass = factory.get('olostep');
      expect(bubbleClass).toBeDefined();
      expect(bubbleClass).toBe(OlostepBubble);
    });

    it('schema should be a Zod discriminated union based on "operation"', () => {
      const schema = OlostepBubble.schema;
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
      expect(operationValues).toContain('batch');
      expect(operationValues).toContain('crawl');
      expect(operationValues).toContain('map');
      expect(operationValues).toContain('answer');
    });

    it('result schema should validate a sample scrape result', () => {
      const sample = {
        operation: 'scrape',
        success: true,
        error: '',
        markdown_content: '# Hello World',
      };

      const parsed = OlostepBubble.resultSchema.safeParse(sample);
      expect(parsed.success).toBe(true);
    });
  });

  //
  // METADATA
  //
  describe('Metadata Tests', () => {
    it('should have correct metadata', () => {
      const metadata = factory.getMetadata('olostep');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('olostep');
      expect(metadata?.alias).toBe('web-scraper');
      expect(metadata?.schema).toBeDefined();
      expect(metadata?.resultSchema).toBeDefined();
      expect(metadata?.shortDescription).toContain('Web scraping');
      expect(metadata?.longDescription).toContain('Olostep');
    });

    it('static properties are correct', () => {
      expect(OlostepBubble.bubbleName).toBe('olostep');
      expect(OlostepBubble.alias).toBe('web-scraper');
      expect(OlostepBubble.service).toBe('olostep');
      expect(OlostepBubble.authType).toBe('apikey');
      expect(OlostepBubble.type).toBe('service');
      expect(OlostepBubble.schema).toBeDefined();
      expect(OlostepBubble.resultSchema).toBeDefined();
      expect(OlostepBubble.shortDescription).toContain('Web scraping');
      expect(OlostepBubble.longDescription).toContain('Scrape');
    });
  });

  //
  // CREDENTIAL VALIDATION
  //
  describe('Credential Validation', () => {
    it('should fail testCredential() with missing credentials', async () => {
      const bubble = new OlostepBubble({
        operation: 'scrape',
        url: 'https://example.com',
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });

    it('should pass testCredential() with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ markdown_content: '# Test' }),
      });

      const bubble = new OlostepBubble({
        operation: 'scrape',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const result = await bubble.testCredential();
      expect(result).toBe(true);
    });
  });

  //
  // SCRAPE OPERATION
  //
  describe('Scrape Operation', () => {
    it('should create bubble with scrape operation', () => {
      const params: OlostepParamsInput = {
        operation: 'scrape',
        url: 'https://example.com',
        formats: ['markdown'],
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.operation).toBe('scrape');
      expect((bubble as any).params.url).toBe('https://example.com');
    });

    it('should accept all scrape optional parameters', () => {
      const params: OlostepParamsInput = {
        operation: 'scrape',
        url: 'https://example.com',
        formats: ['markdown', 'html'],
        country: 'US',
        wait_before_scraping: 2000,
        parser: '@olostep/product-page',
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.formats).toEqual(['markdown', 'html']);
      expect((bubble as any).params.country).toBe('US');
      expect((bubble as any).params.wait_before_scraping).toBe(2000);
      expect((bubble as any).params.parser).toBe('@olostep/product-page');
    });

    it('should return success for scrape', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            markdown_content: '# Test Page',
            metadata: { title: 'Test', url: 'https://example.com' },
          }),
      });

      const bubble = new OlostepBubble({
        operation: 'scrape',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('scrape');
      expect(res.success).toBe(true);
      expect(res.error).toBe('');
      expect(res.data.markdown_content).toBeDefined();
    });
  });

  //
  // BATCH OPERATION
  //
  describe('Batch Operation', () => {
    it('should create bubble with batch operation', () => {
      const params: OlostepParamsInput = {
        operation: 'batch',
        urls: ['https://example.com/1', 'https://example.com/2'],
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.operation).toBe('batch');
      expect((bubble as any).params.urls).toHaveLength(2);
    });

    it('should return success for batch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            batch_id: 'batch_123',
            status: 'processing',
          }),
      });

      const bubble = new OlostepBubble({
        operation: 'batch',
        urls: ['https://example.com/1', 'https://example.com/2'],
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('batch');
      expect(res.success).toBe(true);
      expect(res.data.batch_id).toBeDefined();
    });
  });

  //
  // CRAWL OPERATION
  //
  describe('Crawl Operation', () => {
    it('should create bubble with crawl operation', () => {
      const params: OlostepParamsInput = {
        operation: 'crawl',
        start_url: 'https://example.com',
        max_pages: 50,
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.operation).toBe('crawl');
      expect((bubble as any).params.start_url).toBe('https://example.com');
      expect((bubble as any).params.max_pages).toBe(50);
    });

    it('should return success for crawl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            crawl_id: 'crawl_123',
            status: 'completed',
            pages_crawled: 10,
          }),
      });

      const bubble = new OlostepBubble({
        operation: 'crawl',
        start_url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('crawl');
      expect(res.success).toBe(true);
      expect(res.data.crawl_id).toBeDefined();
    });
  });

  //
  // MAP OPERATION
  //
  describe('Map Operation', () => {
    it('should create bubble with map operation', () => {
      const params: OlostepParamsInput = {
        operation: 'map',
        url: 'https://example.com',
        top_n: 200,
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.operation).toBe('map');
      expect((bubble as any).params.url).toBe('https://example.com');
      expect((bubble as any).params.top_n).toBe(200);
    });

    it('should return success for map', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            urls: ['https://example.com/page1', 'https://example.com/page2'],
            total_urls: 2,
          }),
      });

      const bubble = new OlostepBubble({
        operation: 'map',
        url: 'https://example.com',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('map');
      expect(res.success).toBe(true);
      expect(res.data.urls).toBeDefined();
      expect(res.data.urls!.length).toBeGreaterThan(0);
    });
  });

  //
  // ANSWER OPERATION
  //
  describe('Answer Operation', () => {
    it('should create bubble with answer operation', () => {
      const params: OlostepParamsInput = {
        operation: 'answer',
        task: 'What is the main topic of this website?',
        context_urls: ['https://example.com'],
      };

      const bubble = new OlostepBubble(params);
      expect((bubble as any).params.operation).toBe('answer');
      expect((bubble as any).params.task).toContain('main topic');
    });

    it('should return success for answer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            answer: 'This website is about example content.',
            citations: [{ url: 'https://example.com', title: 'Example' }],
            sources_used: 1,
          }),
      });

      const bubble = new OlostepBubble({
        operation: 'answer',
        task: 'What is this website about?',
        credentials: createTestCredentials(),
      });

      const res = await bubble.action();

      expect(res.data.operation).toBe('answer');
      expect(res.success).toBe(true);
      expect(res.data.answer).toBeDefined();
    });
  });
});
