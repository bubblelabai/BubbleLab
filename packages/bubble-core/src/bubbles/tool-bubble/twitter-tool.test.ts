import { describe, it, expect } from 'vitest';
import { TwitterTool } from '@bubblelab/bubble-core';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('TwitterTool', () => {
  describe('Schema Validation - ScrapeProfile Operation', () => {
    it('should validate scrapeProfile parameters', () => {
      const params = {
        operation: 'scrapeProfile' as const,
        usernames: ['elonmusk'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TwitterTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeProfile',
        usernames: ['elonmusk'],
        limit: 10,
      });
    });
  });

  describe('Schema Validation - Search Operation', () => {
    it('should validate search parameters', () => {
      const params = {
        operation: 'search' as const,
        queries: ['openai'],
        limit: 20,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new TwitterTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'search',
        queries: ['openai'],
        limit: 20,
      });
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(TwitterTool.bubbleName).toBe('twitter-tool');
      expect(TwitterTool.type).toBe('tool');
    });

    it('should have schemas defined', () => {
      expect(TwitterTool.schema).toBeDefined();
      expect(TwitterTool.resultSchema).toBeDefined();
    });
  });

  describe('Credential Handling', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new TwitterTool({
        operation: 'scrapeProfile',
        twitterHandles: ['elonmusk'],
        maxItems: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
    });
  });
});
