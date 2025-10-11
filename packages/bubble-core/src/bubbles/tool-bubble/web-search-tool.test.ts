import { describe, it, expect } from 'vitest';
import { WebSearchTool } from './web-search-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Helper function to add delay between tests to avoid rate limiting
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('WebSearchTool', () => {
  describe('performAction', () => {
    it('should handle missing API key gracefully', async () => {
      const tool = new WebSearchTool({
        query: 'what is the weather in tokyo',
        limit: 2,
        // Missing credentials
      });

      // Use performAction directly to get the raw result
      const result = await tool.performAction();

      console.log(result);

      expect(result.success).toBe(false);
      expect(result.error).toContain('FIRECRAWL_API_KEY is required');
      expect(result.query).toBe('what is the weather in tokyo');
      expect(result.searchEngine).toBe('Firecrawl');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBe(0);
    });

    it('should limit results to minimum of 1', async () => {
      const tool = new WebSearchTool({
        query: 'test search',
        limit: 1, // Valid minimum value
        credentials: {
          [CredentialType.FIRECRAWL_API_KEY]: 'fake-key-for-test',
        },
      });

      const result = await tool.performAction();

      // Will fail due to fake API key, but validates parameter structure
      expect(result.success).toBe(false);
      expect(result.searchEngine).toBe('Firecrawl');
    });

    it('should have proper error handling structure', async () => {
      // Test that the result structure is correct regardless of success/failure
      const tool = new WebSearchTool({
        query: 'test search',
        credentials: {
          [CredentialType.FIRECRAWL_API_KEY]: 'fake-key-for-test',
        },
      });

      const result = await tool.performAction();

      // Check result structure - should have all required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalResults');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('searchEngine');

      // For a failed search with fake key, check specific values
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.searchEngine).toBe('Firecrawl');
    });
  });

  describe('static properties', () => {
    it('should have correct metadata', () => {
      expect(WebSearchTool.bubbleName).toBe('web-search-tool');
      expect(WebSearchTool.alias).toBe('websearch');
      expect(WebSearchTool.type).toBe('tool');
      expect(WebSearchTool.shortDescription).toContain('Firecrawl');
      expect(WebSearchTool.longDescription).toContain('comprehensive');
    });

    it('should have valid schema', () => {
      const schema = WebSearchTool.schema;

      // Test valid input
      const validResult = schema.safeParse({
        query: 'test search',
        limit: 4,
        location: 'us',
      });
      expect(validResult.success).toBe(true);

      // Test invalid input - missing query
      const invalidResult = schema.safeParse({});
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('toolAgent static method', () => {
    it('should create a LangGraph tool', () => {
      const langGraphTool = WebSearchTool.toolAgent({}, {});

      expect(langGraphTool).toHaveProperty('name');
      expect(langGraphTool).toHaveProperty('description');
      expect(langGraphTool).toHaveProperty('schema');
      expect(langGraphTool).toHaveProperty('func');
      expect(typeof langGraphTool.func).toBe('function');
    });

    it('should execute tool function', async () => {
      const langGraphTool = WebSearchTool.toolAgent({}, {});

      const result = await langGraphTool.func({
        query: 'test search',
        limit: 3,
      });
      console.log('Web search tool result:', result);
      expect(result).toHaveProperty('success');
      expect(result.data).toHaveProperty('query');
    });
  });
});
