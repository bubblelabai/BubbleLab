import { describe, it, expect } from 'vitest';
import { GoogleMapsTool } from './google-maps-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('GoogleMapsTool', () => {
  describe('Schema Validation - Search Operation', () => {
    it('should validate search parameters', () => {
      const params = {
        operation: 'search' as const,
        queries: ['restaurants in nyc'],
        limit: 10,
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      const tool = new GoogleMapsTool(params);
      expect(tool).toBeDefined();
      expect((tool as any).params).toMatchObject({
        operation: 'search',
        queries: ['restaurants in nyc'],
        limit: 10,
      });
    });

    it('should require at least one search string', () => {
      const params = {
        operation: 'search' as const,
        queries: [],
        credentials: {
          [CredentialType.APIFY_CRED]: 'test-token',
        },
      };

      expect(() => new GoogleMapsTool(params as any)).toThrow();
    });
  });

  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(GoogleMapsTool.bubbleName).toBe('google-maps-tool');
      expect(GoogleMapsTool.type).toBe('tool');
    });

    it('should have schemas defined', () => {
      expect(GoogleMapsTool.schema).toBeDefined();
      expect(GoogleMapsTool.resultSchema).toBeDefined();
    });
  });

  describe('Credential Handling', () => {
    it('should return error when no credentials provided', async () => {
      const tool = new GoogleMapsTool({
        operation: 'search',
        queries: ['cafe'],
        limit: 1,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.error).toContain('APIFY_CRED');
    });
  });
});
