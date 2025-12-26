import { describe, it, expect } from 'vitest';
import { ResearchAgentTool } from './research-agent-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import z from 'zod';

//Remove all environment variables
process.env = {};

describe('ResearchAgentTool', () => {
  describe('performAction', () => {
    it('should handle missing FIRECRAWL_API_KEY gracefully', async () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development',
        expectedResultSchema: JSON.stringify({
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
        }),
        // Missing FIRECRAWL_API_KEY
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'fake-key-for-test',
        },
      });

      const result = await tool.performAction();

      expect(result.success).toBe(false);
      expect(result.result).toEqual({});
      expect(result.sourcesUsed).toEqual([]);
      expect(result.iterationsUsed).toBe(0);
      expect(result.summary).toContain('Research failed');
    });

    it('should handle Zod schema as expectedResultSchema', async () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development',
        expectedResultSchema: z.object({
          trends: z.array(z.string()).describe('An array of trends'),
          summary: z.string().describe('A summary of the trends'),
        }),
      });
      const result = tool.getExpectedResultSchema();
      expect(result).toBeDefined();
      console.log(result);
      expect(result).toContain('');
    });

    it('should handle missing GOOGLE_GEMINI_CRED gracefully', async () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development',
        expectedResultSchema: JSON.stringify({
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
        }),
        // Missing GOOGLE_GEMINI_CRED
        credentials: {
          [CredentialType.FIRECRAWL_API_KEY]: 'fake-key-for-test',
        },
      });

      const result = await tool.performAction();
      const expectedResultSchema = tool.getExpectedResultSchema();
      expect(expectedResultSchema).toBeDefined();
      console.log(expectedResultSchema);
      expect(expectedResultSchema).toContain(
        '{"type":"object","properties":{"trends":{"type":"array","items":{"type":"string"}},"summary":{"type":"string"}}}'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('credential');
      expect(result.result).toEqual({});
      expect(result.sourcesUsed).toEqual([]);
      expect(result.iterationsUsed).toBe(0);
      expect(result.summary).toContain('Research failed');
    });

    it('should respect custom maxIterations', async () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development',
        expectedResultSchema: JSON.stringify({
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
        }),
        maxIterations: 50,
      });

      expect(tool['params'].maxIterations).toBe(50);
    });

    it('should have proper error handling structure', async () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development',
        expectedResultSchema: JSON.stringify({
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
        }),
        credentials: {
          [CredentialType.FIRECRAWL_API_KEY]: 'fake-key-for-test',
          [CredentialType.GOOGLE_GEMINI_CRED]: 'fake-key-for-test',
        },
      });

      const result = await tool.performAction();

      // Check result structure - should have all required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('sourcesUsed');
      expect(result).toHaveProperty('iterationsUsed');

      // For failed research with fake keys, check specific values
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.error).toBe('string');
      expect(typeof result.result).toBe('object');
      expect(typeof result.summary).toBe('string');
      expect(Array.isArray(result.sourcesUsed)).toBe(true);
      expect(typeof result.iterationsUsed).toBe('number');
    });
  });

  describe('static properties', () => {
    it('should have correct metadata', () => {
      expect(ResearchAgentTool.bubbleName).toBe('research-agent-tool');
      expect(ResearchAgentTool.alias).toBe('research');
      expect(ResearchAgentTool.type).toBe('tool');
      expect(ResearchAgentTool.shortDescription).toContain('research agent');
      expect(ResearchAgentTool.longDescription).toContain('sophisticated');
    });

    it('should have valid schema', () => {
      const schema = ResearchAgentTool.schema;

      // Test valid input
      const validResult = schema.safeParse({
        task: 'Research AI trends',
        expectedResultSchema: '{"type": "object"}',
        maxIterations: 50,
      });
      expect(validResult.success).toBe(true);

      // Test invalid input - missing task
      const invalidResult = schema.safeParse({
        expectedResultSchema: '{"type": "object"}',
      });
      expect(invalidResult.success).toBe(false);

      // Test invalid input - missing expectedResultSchema
      const invalidResult2 = schema.safeParse({
        task: 'Research AI trends',
      });
      expect(invalidResult2.success).toBe(false);
    });
  });

  describe('toolAgent static method', () => {
    it('should create a LangGraph tool', () => {
      const langGraphTool = ResearchAgentTool.toolAgent({}, {});

      expect(langGraphTool).toHaveProperty('name');
      expect(langGraphTool).toHaveProperty('description');
      expect(langGraphTool).toHaveProperty('schema');
      expect(langGraphTool).toHaveProperty('func');
      expect(typeof langGraphTool.func).toBe('function');
      expect(langGraphTool.name).toBe('research-agent-tool');
    });

    it('should execute tool function', async () => {
      const langGraphTool = ResearchAgentTool.toolAgent({}, {});

      const result = await langGraphTool.func({
        task: 'Research AI trends',
        expectedResultSchema: '{"type": "object"}',
      });

      expect(result).toHaveProperty('success');
      expect(result.data).toHaveProperty('result');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('sourcesUsed');
      expect(result.data).toHaveProperty('iterationsUsed');
    });
  });

  describe('private methods', () => {
    it('should generate proper research summary', () => {
      const tool = new ResearchAgentTool({
        task: 'Research the latest trends in AI development for 2024',
        expectedResultSchema: '{"type": "object"}',
      });

      // Access private method via bracket notation for testing
      const summary = tool['generateResearchSummary'](
        'Research the latest trends in AI development for 2024',
        5, // tool calls
        3 // sources
      );

      expect(typeof summary).toBe('string');
      expect(summary).toContain('Research the latest trends in AI');
      expect(summary).toContain('5 tool operations');
      expect(summary).toContain('3 web sources');
      expect(summary).toContain('structured information');
    });

    it('should extract sources from tool calls', () => {
      const tool = new ResearchAgentTool({
        task: 'Research AI trends',
        expectedResultSchema: '{"type": "object"}',
      });

      const mockToolCalls = [
        {
          tool: 'web-search-tool',
          output: {
            results: [
              { url: 'https://example.com/ai-trends' },
              { url: 'https://example.com/machine-learning' },
            ],
          },
        },
        {
          tool: 'web-scrape-tool',
          input: { url: 'https://example.com/ai-research' },
        },
        {
          tool: 'web-scrape-tool',
          input: { url: 'https://example.com/ai-trends' }, // duplicate
        },
      ];

      // Access private method via bracket notation for testing
      const sources = tool['extractSourcesFromToolCalls'](mockToolCalls);

      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBe(3); // duplicates removed
      expect(sources).toContain('https://example.com/ai-trends');
      expect(sources).toContain('https://example.com/machine-learning');
      expect(sources).toContain('https://example.com/ai-research');
    });

    it('should handle undefined inputs/outputs in tool calls', () => {
      const tool = new ResearchAgentTool({
        task: 'Research AI trends',
        expectedResultSchema: '{"type": "object"}',
      });

      const mockToolCalls = [
        {
          tool: 'web-search-tool',
          // missing output
        },
        {
          tool: 'web-scrape-tool',
          // missing input
        },
        {
          tool: 'unknown-tool',
          input: { url: 'https://example.com' },
          output: { data: 'test' },
        },
      ];

      // Access private method via bracket notation for testing
      const sources = tool['extractSourcesFromToolCalls'](mockToolCalls);

      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBe(0); // no valid sources extracted
    });
  });
});
