import { describe, it, expect } from 'vitest';
import { TikTokTool } from '@bubblelab/bubble-core';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('TikTokTool', () => {
  describe('Schema Validation - ScrapeProfile Operation', () => {
    it('should validate scrapeProfile parameters', () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: ['tiktok'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TikTokTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeProfile',
        profiles: ['tiktok'],
        limit: 10,
      });
    });

    it('should require at least one profile', async () => {
      const params = {
        operation: 'scrapeProfile' as const,
        profiles: [],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TikTokTool(params as any);
      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profiles required');
    });
  });

  describe('Schema Validation - ScrapeHashtag Operation', () => {
    it('should validate scrapeHashtag parameters', () => {
      const params = {
        operation: 'scrapeHashtag' as const,
        hashtags: ['funny'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TikTokTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeHashtag',
        hashtags: ['funny'],
        limit: 10,
      });
    });
  });

  describe('Schema Validation - ScrapeVideo Operation', () => {
    it('should validate scrapeVideo parameters', () => {
      const params = {
        operation: 'scrapeVideo' as const,
        videoUrls: ['https://www.tiktok.com/@user/video/123'],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TikTokTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeVideo',
        videoUrls: ['https://www.tiktok.com/@user/video/123'],
      });
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(TikTokTool.bubbleName).toBe('tiktok-tool');
      expect(TikTokTool.type).toBe('tool');
    });

    it('should have schemas defined', () => {
      expect(TikTokTool.schema).toBeDefined();
      expect(TikTokTool.resultSchema).toBeDefined();
    });
  });

  describe('Credential Handling', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new TikTokTool({
        operation: 'scrapeProfile',
        profiles: ['tiktok'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
    });
  });

  describe('Data Transformation', () => {
    it('should define single object result schema', () => {
      const resultSchema = TikTokTool.resultSchema;
      expect(resultSchema._def.typeName).toBe('ZodObject');
      expect(resultSchema.shape.videos).toBeDefined();
    });
  });
});
