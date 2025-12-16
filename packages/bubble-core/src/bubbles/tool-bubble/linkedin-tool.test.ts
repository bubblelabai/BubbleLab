import { describe, it, expect } from 'vitest';
import { LinkedInTool } from './linkedin-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('LinkedInTool', () => {
  describe('Schema Validation - ScrapeJobs Operation', () => {
    it('should validate scrapeJobs parameters', () => {
      const params = {
        operation: 'scrapeJobs' as const,
        keyword: 'software engineer',
        location: 'United States',
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new LinkedInTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'scrapeJobs',
        keyword: 'software engineer',
        location: 'United States',
        limit: 10,
      });
    });

    it('should work with optional filters', () => {
      const params = {
        operation: 'scrapeJobs' as const,
        keyword: 'react developer',
        jobType: ['full-time', 'contract'],
        workplaceType: ['remote'],
        experienceLevel: ['mid-senior'],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new LinkedInTool(params as any);
      expect(tool).toBeDefined();
      expect((tool as any).params.jobType).toEqual(['full-time', 'contract']);
      expect((tool as any).params.workplaceType).toEqual(['remote']);
    });
  });

  describe('Schema Validation - ScrapePosts Operation', () => {
    it('should validate scrapePosts parameters', () => {
      const params = {
        operation: 'scrapePosts' as const,
        profileUrl: 'https://linkedin.com/in/williamhgates',
        limit: 5,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new LinkedInTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params.operation).toBe('scrapePosts');
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(LinkedInTool.bubbleName).toBe('linkedin-tool');
      expect(LinkedInTool.type).toBe('tool');
    });
  });

  describe('Credential Handling', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new LinkedInTool({
        operation: 'scrapeJobs',
        keyword: 'test',
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
    });
  });

  describe('Data Transformation', () => {
    it('should define correct result schema', () => {
      const resultSchema = LinkedInTool.resultSchema;
      expect(resultSchema.shape.jobs).toBeDefined();
      expect(resultSchema.shape.posts).toBeDefined();
      expect(resultSchema.shape.operation).toBeDefined();
    });
  });
});
