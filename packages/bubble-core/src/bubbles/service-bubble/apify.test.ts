import { describe, it, expect, beforeEach } from 'vitest';
import { ApifyBubble } from './apify.js';
import type { ApifyParamsInput } from './apify.js';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Unit tests for Apify Service Bubble
 *
 * Tests the SERVICE LAYER - direct Apify API integration
 * For TOOL LAYER tests (high-level interface), see:
 * - manual-tests/test-instagram-tool.ts
 */
describe('ApifyBubble', () => {
  describe('Schema Validation', () => {
    it('should validate Instagram scraper parameters', () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
          resultsType: 'posts',
          resultsLimit: 200,
          searchType: 'hashtag',
          searchLimit: 1,
        },
        waitForFinish: true,
      };

      const bubble = new ApifyBubble(params);
      expect(bubble.params.actorId).toBe('apify/instagram-scraper');
      expect(bubble.params.input.directUrls).toHaveLength(1);
    });

    it('should apply default values', () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/explore/'],
        },
      };

      const bubble = new ApifyBubble(params);
      expect(bubble.params.input.resultsType).toBe('posts');
      expect(bubble.params.input.resultsLimit).toBe(200);
      expect(bubble.params.waitForFinish).toBe(true);
      expect(bubble.params.timeout).toBe(120000);
    });

    it('should reject invalid URLs', () => {
      const params = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['not-a-valid-url'],
        },
      };

      expect(() => new ApifyBubble(params as ApifyParamsInput)).toThrow();
    });

    it('should reject empty directUrls array', () => {
      const params = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: [],
        },
      };

      expect(() => new ApifyBubble(params as ApifyParamsInput)).toThrow();
    });

    it('should validate resultsLimit range', () => {
      const params = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/explore/'],
          resultsLimit: 1001, // Over the limit
        },
      };

      expect(() => new ApifyBubble(params as ApifyParamsInput)).toThrow();
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(ApifyBubble.bubbleName).toBe('apify');
      expect(ApifyBubble.service).toBe('apify');
      expect(ApifyBubble.authType).toBe('apikey');
      expect(ApifyBubble.type).toBe('service');
      expect(ApifyBubble.alias).toBe('scrape');
    });

    it('should have schemas defined', () => {
      expect(ApifyBubble.schema).toBeDefined();
      expect(ApifyBubble.resultSchema).toBeDefined();
    });
  });

  describe('Credential Selection', () => {
    it('should return undefined when no credentials provided', () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
        },
      };

      const bubble = new ApifyBubble(params);
      const credential = (bubble as any).chooseCredential();
      expect(credential).toBeUndefined();
    });

    it('should select APIFY_CRED when provided', () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
        },
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-apify-token',
        },
      };

      const bubble = new ApifyBubble(params);
      const credential = (bubble as any).chooseCredential();
      expect(credential).toBe('test-apify-token');
    });
  });

  describe('Integration Test', () => {
    it('should fail when no API token is provided', async () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
          resultsType: 'posts',
          resultsLimit: 10,
        },
        waitForFinish: false,
      };

      const bubble = new ApifyBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('API token is required');
    });

    // This test requires a real APIFY_API_TOKEN in environment
    // Skip it if no token is available
    it.skip('should scrape Instagram with real credentials', async () => {
      const apiToken = process.env.APIFY_API_TOKEN;

      if (!apiToken || apiToken.startsWith('test-')) {
        console.log('⚠️  Skipping integration test - no real Apify token');
        return;
      }

      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
          resultsType: 'posts',
          resultsLimit: 5,
        },
        waitForFinish: true,
        timeout: 120000,
        credentials: {
          [CredentialType.APIFY_CRED]: apiToken,
        },
      };

      const bubble = new ApifyBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(true);
      expect(result.data.runId).toBeDefined();
      expect(result.data.status).toBe('SUCCEEDED');
      if (result.data.items) {
        expect(result.data.items.length).toBeGreaterThan(0);
      }
    }, 180000); // 3 minute timeout for this test
  });

  describe('Error Handling', () => {
    it('should handle missing credentials gracefully', async () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
        },
      };

      const bubble = new ApifyBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(false);
      expect(result.data.error).toBeTruthy();
    });

    it('should return error structure on failure', async () => {
      const params: ApifyParamsInput = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
        },
        credentials: {
          [CredentialType.APIFY_CRED]: 'invalid-token',
        },
      };

      const bubble = new ApifyBubble(params);
      const result = await bubble.action();

      expect(result.data).toHaveProperty('success');
      expect(result.data).toHaveProperty('error');
      expect(result.data).toHaveProperty('runId');
      expect(result.data).toHaveProperty('status');
      expect(result.data.success).toBe(false);
    });
  });
});
