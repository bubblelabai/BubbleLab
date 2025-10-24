import { describe, it, expect, beforeEach } from 'vitest';
import { ApifyBubble, TypedApifyParamsInput } from './apify/apify.js';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Unit tests for Apify Service Bubble
 *
 * Tests the SERVICE LAYER - generic Apify API integration that works with ANY actor
 * For TOOL LAYER tests (high-level interface), see:
 * - manual-tests/test-instagram-tool.ts (Instagram-specific)
 */
describe('ApifyBubble', () => {
  describe('Schema Validation', () => {
    it('should validate generic actor parameters (Instagram scraper example)', () => {
      const params: TypedApifyParamsInput<'apify/instagram-scraper'> = {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/humansofny/'],
          resultsType: 'posts',
          resultsLimit: 200,
        },
        waitForFinish: true,
      };

      const bubble = new ApifyBubble(params);
      expect((bubble as any).params.actorId).toBe('apify/instagram-scraper');
      expect(((bubble as any).params.input as any).directUrls).toHaveLength(1);
    });

    it('should validate generic actor parameters (web scraper example)', () => {
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
          maxRequestsPerCrawl: 100,
        },
        waitForFinish: true,
      };

      const bubble = new ApifyBubble(params);
      expect((bubble as any).params.actorId).toBe('apify/web-scraper');
      expect(((bubble as any).params.input as any).startUrls).toHaveLength(1);
    });

    it('should accept any actor ID string', () => {
      const params: TypedApifyParamsInput<string> = {
        actorId: 'custom/my-scraper',
        input: {
          anyField: 'anyValue',
          nestedData: {
            foo: 'bar',
          },
        },
      };

      const bubble = new ApifyBubble(params);
      expect((bubble as any).params.actorId).toBe('custom/my-scraper');
      expect(((bubble as any).params.input as any).anyField).toBe('anyValue');
    });

    it('should apply default values', () => {
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
        },
      };

      const bubble = new ApifyBubble(params);
      expect((bubble as any).params.waitForFinish).toBe(true);
      expect((bubble as any).params.timeout).toBe(120000);
    });

    it('should accept arbitrary input structure', () => {
      const params: TypedApifyParamsInput<'apify/reddit-scraper'> = {
        actorId: 'apify/reddit-scraper',
        input: {
          subreddits: ['javascript', 'webdev'],
          maxPosts: 50,
          includeComments: true,
          nested: {
            deeply: {
              structured: {
                data: [1, 2, 3],
              },
            },
          },
        },
      };

      const bubble = new ApifyBubble(params);
      expect((bubble as any).params.actorId).toBe('apify/reddit-scraper');
      expect(((bubble as any).params.input as any).subreddits).toEqual([
        'javascript',
        'webdev',
      ]);
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
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
        },
      };

      const bubble = new ApifyBubble(params);
      const credential = (bubble as any).chooseCredential();
      expect(credential).toBeUndefined();
    });

    it('should select APIFY_CRED when provided', () => {
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
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
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
          maxRequestsPerCrawl: 10,
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
    it.skip('should run any Apify actor with real credentials (web scraper example)', async () => {
      const apiToken = process.env.APIFY_API_TOKEN;

      if (!apiToken || apiToken.startsWith('test-')) {
        console.log('⚠️  Skipping integration test - no real Apify token');
        return;
      }

      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
          maxRequestsPerCrawl: 5,
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
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
        },
      };

      const bubble = new ApifyBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(false);
      expect(result.data.error).toBeTruthy();
    });

    it('should return error structure on failure', async () => {
      const params: TypedApifyParamsInput<'apify/web-scraper'> = {
        actorId: 'apify/web-scraper',
        input: {
          startUrls: [{ url: 'https://example.com' }],
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
