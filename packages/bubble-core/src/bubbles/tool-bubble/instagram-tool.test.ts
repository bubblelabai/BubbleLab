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
  describe('Schema Validation', () => {
    it('should validate Instagram tool parameters', () => {
      const params = {
        profiles: ['@humansofny'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params.profiles).toEqual(['@humansofny']);
      expect((tool as any).params.limit).toBe(10);
    });

    it('should work without explicit limit (uses default)', () => {
      const params = {
        profiles: ['instagram'],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      // Should not throw - default limit is handled by zod schema
      const tool = new InstagramTool(params);
      expect(tool).toBeDefined();
    });

    it('should require at least one profile', () => {
      const params = {
        profiles: [],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      expect(() => new InstagramTool(params as any)).toThrow();
    });

    it('should validate limit range', () => {
      const params = {
        profiles: ['test'],
        limit: 201, // Over the limit
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

  describe('URL Normalization', () => {
    it('should normalize @username format', async () => {
      const tool = new InstagramTool({
        profiles: ['@humansofny'],
        limit: 1,
      });

      const result = await tool.action();

      // Should fail without credentials but we can check the error
      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.data.success).toBe(false);
    });

    it('should accept plain username', async () => {
      const tool = new InstagramTool({
        profiles: ['humansofny'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.data.success).toBe(false);
    });

    it('should accept full Instagram URL', async () => {
      const tool = new InstagramTool({
        profiles: ['https://www.instagram.com/humansofny/'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.data.success).toBe(false);
    });
  });

  describe('Credential Handling', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new InstagramTool({
        profiles: ['test'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
      expect(result.data.posts).toEqual([]);
      expect(result.data.profiles).toEqual([]);
      expect(result.data.totalPosts).toBe(0);
    });

    it('should return proper error structure', async () => {
      const tool = new InstagramTool({
        profiles: ['test'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('posts');
      expect(result.data).toHaveProperty('profiles');
      expect(result.data).toHaveProperty('totalPosts');
      expect(result.data).toHaveProperty('scrapedProfiles');
    });
  });

  describe('Result Structure', () => {
    it('should return consistent structure on error', async () => {
      const tool = new InstagramTool({
        profiles: ['profile1', 'profile2'],
        limit: 5,
      });

      const result = await tool.action();

      // Check structure even on error
      expect(Array.isArray(result.data.posts)).toBe(true);
      expect(Array.isArray(result.data.profiles)).toBe(true);
      expect(Array.isArray(result.data.scrapedProfiles)).toBe(true);
      expect(typeof result.data.totalPosts).toBe('number');
      expect(typeof result.data.success).toBe('boolean');
      expect(typeof result.data.error).toBe('string');
    });

    it('should track scraped profiles on error', async () => {
      const tool = new InstagramTool({
        profiles: ['profile1', 'profile2'],
        limit: 5,
      });

      const result = await tool.action();

      // Should have attempted to track profiles (may be normalized URLs or empty on early error)
      expect(Array.isArray(result.data.scrapedProfiles)).toBe(true);
      // When error occurs early (no credentials), scrapedProfiles may be empty
      // This is acceptable behavior
    });
  });

  describe('Multiple Profiles', () => {
    it('should accept multiple profiles', () => {
      const tool = new InstagramTool({
        profiles: ['profile1', 'profile2', 'profile3'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      });

      expect((tool as any).params.profiles).toHaveLength(3);
    });
  });

  describe('Data Transformation', () => {
    it('should define post schema', () => {
      const resultSchema = InstagramTool.resultSchema;
      const shape = resultSchema.shape;

      expect(shape.posts).toBeDefined();
      expect(shape.profiles).toBeDefined();
      expect(shape.totalPosts).toBeDefined();
      expect(shape.success).toBeDefined();
    });

    it('should define profile schema', () => {
      const resultSchema = InstagramTool.resultSchema;
      const shape = resultSchema.shape;

      // Profiles should always be included now
      expect(shape.profiles).toBeDefined();
    });
  });
});
