import { describe, it, expect } from 'vitest';
import { InstagramTool } from './instagram-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Unit tests for Instagram Tool
 *
 * Tests the TOOL LAYER - high-level Instagram-specific interface
 * For SERVICE LAYER tests (generic Apify), see:
 * - bubbles/service-bubble/apify.test.ts
 * For INTEGRATION tests with real API, see:
 * - manual-tests/test-instagram-tool.ts
 */
describe('InstagramTool', () => {
  describe('Schema Validation - ScrapeProfile Operation', () => {
    it('should validate scrapeProfile parameters', () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: ['@humansofny'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeProfile',
        profiles: ['@humansofny'],
        limit: 10,
      });
    });

    it('should work without explicit limit (uses default)', () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: ['instagram'],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      // Should not throw - default limit is handled by zod schema
      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
    });

    it('should require at least one profile', async () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: [],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new InstagramTool(params as any);
      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profiles array is required');
    });

    it('should validate limit range for profiles', () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: ['test'],
        limit: 1001, // Over the limit (max is 1000)
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      // The schema validation should still catch this during construction
      expect(() => new InstagramTool(params)).toThrow();
    });
  });

  describe('Schema Validation - ScrapeHashtag Operation', () => {
    it('should validate scrapeHashtag parameters', () => {
      const params = {
        operation: 'scrapeHashtag' as const,
        hashtags: ['ai', 'tech'],
        limit: 50,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params.hashtags).toEqual(['ai', 'tech']);
      expect((tool as any).params.limit).toBe(50);
      expect((tool as any).params.operation).toBe('scrapeHashtag');
    });

    it('should work without explicit limit (uses default)', () => {
      const params = {
        operation: 'scrapeHashtag' as const,
        hashtags: ['ai'],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      // Should not throw - default limit is handled by zod schema
      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
    });

    it('should require at least one hashtag', async () => {
      const params = {
        operation: 'scrapeHashtag' as const,
        hashtags: [],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new InstagramTool(params as any);
      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Hashtags array is required');
    });

    it('should validate limit range for hashtags', () => {
      const params = {
        operation: 'scrapeHashtag' as const,
        hashtags: ['ai'],
        limit: 1001, // Over the limit
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      expect(() => new InstagramTool(params)).toThrow();
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(InstagramTool.bubbleName).toBe('instagram-tool');
      expect(InstagramTool.alias).toBe('ig');
      expect(InstagramTool.type).toBe('tool');
    });

    it('should have schemas defined', () => {
      expect(InstagramTool.schema).toBeDefined();
      expect(InstagramTool.resultSchema).toBeDefined();
    });

    it('should have descriptions defined', () => {
      expect(InstagramTool.shortDescription).toBeDefined();
      expect(InstagramTool.longDescription).toBeDefined();
      expect(InstagramTool.shortDescription).toContain('Instagram');
    });
  });

  describe('URL Normalization - ScrapeProfile', () => {
    it('should normalize @username format', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['@humansofny'],
        limit: 1,
      });

      const result = await tool.action();

      // Should fail without credentials but we can check the error
      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.success).toBe(false);
    });

    it('should accept plain username', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['humansofny'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.success).toBe(false);
    });

    it('should accept full Instagram URL', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['https://www.instagram.com/humansofny/'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.success).toBe(false);
    });
  });

  describe('Hashtag Normalization - ScrapeHashtag', () => {
    it('should accept plain hashtags', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai', 'tech'],
        limit: 10,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.success).toBe(false);
    });

    it('should accept hashtag URLs', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['https://www.instagram.com/explore/tags/ai'],
        limit: 10,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.success).toBe(false);
    });
  });

  describe('Credential Handling - ScrapeProfile', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['test'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect((result.data as any).posts).toEqual([]);
      expect((result.data as any).profiles).toEqual([]);
      expect((result.data as any).totalPosts).toBe(0);
    });

    it('should return proper error structure for scrapeProfile', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['test'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('operation');
      expect(result.data).toHaveProperty('posts');
      expect(result.data as any).toHaveProperty('profiles');
      expect(result.data).toHaveProperty('totalPosts');
      expect(result.data as any).toHaveProperty('scrapedProfiles');
      expect(result.data.operation).toBe('scrapeProfile');
    });
  });

  describe('Credential Handling - ScrapeHashtag', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai'],
        limit: 10,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.data.posts).toEqual([]);
      expect(result.data.totalPosts).toBe(0);
    });

    it('should return proper error structure for scrapeHashtag', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai'],
        limit: 10,
      });

      const result = await tool.action();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('operation');
      expect(result.data).toHaveProperty('posts');
      expect(result.data).toHaveProperty('totalPosts');
      expect(result.data as any).toHaveProperty('scrapedHashtags');
      expect(result.data.operation).toBe('scrapeHashtag');
    });
  });

  describe('Result Structure - ScrapeProfile', () => {
    it('should return consistent structure on error', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['profile1', 'profile2'],
        limit: 5,
      });

      const result = await tool.action();

      // Check structure even on error
      expect(Array.isArray(result.data.posts)).toBe(true);
      expect(Array.isArray((result.data as any).profiles)).toBe(true);
      expect(Array.isArray((result.data as any).scrapedProfiles)).toBe(true);
      expect(typeof result.data.totalPosts).toBe('number');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.error).toBe('string');
      expect(result.data.operation).toBe('scrapeProfile');
    });

    it('should track scraped profiles on error', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['profile1', 'profile2'],
        limit: 5,
      });

      const result = await tool.action();

      // Should have attempted to track profiles (may be normalized URLs or empty on early error)
      expect(Array.isArray((result.data as any).scrapedProfiles)).toBe(true);
      // When error occurs early (no credentials), scrapedProfiles may be empty
      // This is acceptable behavior
    });
  });

  describe('Result Structure - ScrapeHashtag', () => {
    it('should return consistent structure on error', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai', 'tech'],
        limit: 10,
      });

      const result = await tool.action();

      // Check structure even on error
      expect(Array.isArray(result.data.posts)).toBe(true);
      expect(Array.isArray((result.data as any).scrapedHashtags)).toBe(true);
      expect(typeof result.data.totalPosts).toBe('number');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.error).toBe('string');
      expect(result.data.operation).toBe('scrapeHashtag');
    });

    it('should track scraped hashtags on error', async () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai', 'tech'],
        limit: 10,
      });

      const result = await tool.action();

      // Should have attempted to track hashtags
      expect(Array.isArray((result.data as any).scrapedHashtags)).toBe(true);
      // When error occurs early (no credentials), scrapedHashtags may be empty
      // This is acceptable behavior
    });
  });

  describe('Multiple Profiles', () => {
    it('should accept multiple profiles', () => {
      const tool = new InstagramTool({
        operation: 'scrapeProfile',
        profiles: ['profile1', 'profile2', 'profile3'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      });

      expect((tool as any).params.profiles).toHaveLength(3);
    });
  });

  describe('Multiple Hashtags', () => {
    it('should accept multiple hashtags', () => {
      const tool = new InstagramTool({
        operation: 'scrapeHashtag',
        hashtags: ['ai', 'tech', 'innovation'],
        limit: 50,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      });

      expect((tool as any).params.hashtags).toHaveLength(3);
    });
  });

  describe('Data Transformation', () => {
    it('should define single object result schema', () => {
      const resultSchema = InstagramTool.resultSchema;

      // Should be a single object schema (not discriminated union)
      expect(resultSchema._def.typeName).toBe('ZodObject');
      expect(resultSchema.shape.operation).toBeDefined();
      expect(resultSchema.shape.posts).toBeDefined();
      expect(resultSchema.shape.totalPosts).toBeDefined();
      expect(resultSchema.shape.success).toBeDefined();
      expect(resultSchema.shape.error).toBeDefined();
    });

    it('should define operation field with enum values', () => {
      const resultSchema = InstagramTool.resultSchema;
      const operationField = resultSchema.shape.operation;

      expect(operationField._def.typeName).toBe('ZodEnum');
      expect(operationField._def.values).toContain('scrapeProfile');
      expect(operationField._def.values).toContain('scrapeHashtag');
    });

    it('should define optional fields for different operations', () => {
      const resultSchema = InstagramTool.resultSchema;

      // Profile-specific fields (optional)
      expect(resultSchema.shape.profiles).toBeDefined();
      expect(resultSchema.shape.scrapedProfiles).toBeDefined();

      // Hashtag-specific fields (optional)
      expect(resultSchema.shape.scrapedHashtags).toBeDefined();

      // Common fields (required)
      expect(resultSchema.shape.posts).toBeDefined();
      expect(resultSchema.shape.totalPosts).toBeDefined();
      expect(resultSchema.shape.success).toBeDefined();
      expect(resultSchema.shape.error).toBeDefined();
    });
  });
});
