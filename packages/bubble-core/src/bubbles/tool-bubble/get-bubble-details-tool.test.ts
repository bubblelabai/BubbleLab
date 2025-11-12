import { GetBubbleDetailsTool } from './get-bubble-details-tool.js';
import { z } from 'zod';
import { BubbleFactory } from '../../bubble-factory.js';
import { describe, test, expect } from 'vitest';

describe('GetBubbleDetailsTool', () => {
  describe('basic properties', () => {
    test('should have correct metadata', () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'hello-world' });
      expect(tool.name).toBe('get-bubble-details-tool');
      expect(tool.type).toBe('tool');
      expect(tool.alias).toBe('details');
      expect(tool.shortDescription).toContain(
        'detailed information about a specific bubble'
      );
    });

    test('should have longDescription with use cases', () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'hello-world' });
      expect(tool.longDescription).toContain('Use cases:');
      expect(tool.longDescription).toContain('AI agent understanding');
      expect(tool.longDescription).toContain('Parameter validation');
      expect(tool.longDescription).toContain('Documentation generation');
    });
  });

  describe('parameter validation', () => {
    test('should require bubbleName parameter', () => {
      expect(() => {
        // @ts-expect-error testing invalid input
        new GetBubbleDetailsTool({});
      }).toThrow('Input Schema validation failed');
    });
    test('should validate empty bubbleName', () => {
      expect(() => {
        new GetBubbleDetailsTool({ bubbleName: '' });
      }).toThrow('Bubble name is required');
    });
  });

  describe('execution', () => {
    test('should have suffient info for research-agent-tool', async () => {
      const tool = await new GetBubbleDetailsTool({
        bubbleName: 'research-agent-tool',
      }).action();
      console.log(JSON.stringify(tool.data, null, 2));
    });

    test('should successfully get details for existing bubble', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'hello-world' });
      const result = await tool.action();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('hello-world');
      expect(result.data?.usageExample).toBeDefined();
    });

    test('should generate usage example', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'ai-agent' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      expect(usageExample).toContain('// Example usage');
      expect(usageExample).toContain('const');
      expect(usageExample).toContain('new');
      expect(usageExample).toContain('Bubble');
      expect(usageExample).toContain('.action()');
    });

    test('should show enum structure for google-sheets credential parameter', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'google-sheets' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      // Should contain both values of the enum for example,  OVERWRITE and INSERT_ROWS
      expect(usageExample).toContain('OVERWRITE');
      expect(usageExample).toContain('INSERT_ROWS');
      expect(usageExample).toBeDefined();
    });

    test('should show nested schema structure for ai-agent images parameter', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'ai-agent' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      // Should show the ImageInputSchema structure instead of just empty array
      expect(usageExample).toContain('images: [{ type:');
      expect(usageExample).toContain('mimeType:');
      expect(usageExample).toContain('description:');
    });

    test('research-agent-tool should show description in nested schema structure for expectedResultSchema parameter', async () => {
      const tool = new GetBubbleDetailsTool({
        bubbleName: 'research-agent-tool',
      });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      console.log(usageExample);
      expect(usageExample).not.toContain('ResearchAgentToolBubble');
      expect(usageExample).toBeDefined();
      console.log(result.data.usageExample);
      expect(usageExample).toContain('An array of trends');
    });

    // Should show description in nested schema structure for gmail bubble
    test('should show description in nested schema structure for gmail bubble', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'gmail' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      console.log(result.data.usageExample);
      expect(usageExample).toContain('Clean, readable email text content');
    });

    test('should show output schema structure for reddit-scrape-tool images parameter', async () => {
      const tool = new GetBubbleDetailsTool({
        bubbleName: 'reddit-scrape-tool',
      });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      // Should show the ImageInputSchema structure instead of just empty array
      expect(usageExample).toContain('author:');
    });

    test('should show object output in research-agent-tool expectedResultSchema parameter', async () => {
      const tool = new GetBubbleDetailsTool({
        bubbleName: 'research-agent-tool',
      });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      //Should show the desecripton of individual fields in the result schema
      // Should show the ImageInputSchema structure instead of just empty array
      expect(usageExample).toContain('result');
    });

    test('should show nested schema structure for ai-agent model parameter', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'ai-agent' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      // Should show the ModelConfigSchema structure instead of just the default object
      expect(usageExample).toContain('model: { model:');
      expect(usageExample).toContain('temperature:');
      expect(usageExample).toContain('maxTokens:');
      expect(usageExample).toContain('jsonMode:');
    });

    test('should show ouput schema for complex schema', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'google-calendar' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      console.log(result.data.usageExample);

      //For output schema, should show the structure of the schema
      expect(usageExample).toContain('timeZone');
      expect(usageExample).toContain('selected');
      expect(usageExample).toContain('accessRole');
    });

    test('should throw error for non-existent bubble', async () => {
      const tool = new GetBubbleDetailsTool({
        bubbleName: 'non-existent-bubble',
      });
      //Expect error to be thrown
      await expect(tool.action()).rejects.toThrow();
    });
  });

  describe('toAgentTool conversion', () => {
    test('should convert to LangGraph tool format', () => {
      const agentTool = GetBubbleDetailsTool.toolAgent();
      expect(agentTool).toBeDefined();
      expect(agentTool.name).toBe('get-bubble-details-tool');
      expect(agentTool.description).toContain('detailed information');
      expect(agentTool.schema).toBeDefined();
      expect(typeof agentTool.func).toBe('function');
    });

    test('should execute successfully as agent tool', async () => {
      const agentTool = GetBubbleDetailsTool.toolAgent();
      const result = await agentTool.func<
        z.infer<typeof GetBubbleDetailsTool.resultSchema>
      >({ bubbleName: 'slack' });
      expect(result).toBeDefined();
      expect(result?.data?.name).toBe('slack');
      expect(result?.data?.usageExample).toBeDefined();
    });

    test('should handle errors in agent tool execution', async () => {
      // const tool = new GetBubbleDetailsTool({ bubbleName: 'invalid' }); // Not used in this test
      const agentTool = GetBubbleDetailsTool.toolAgent();
      await expect(agentTool.func({ bubbleName: 'invalid' })).rejects.toThrow(
        'not found in registry'
      );
    });
  });

  describe('registry integration', () => {
    test('should be registered in BubbleRegistry', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();
      const registeredClass = factory.get('get-bubble-details-tool');
      expect(registeredClass).toBeDefined();
      expect(registeredClass).toBe(GetBubbleDetailsTool);
    });

    test('should have metadata in registry', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();
      const metadata = factory.getMetadata('get-bubble-details-tool');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('get-bubble-details-tool');
      expect(metadata?.type).toBe('tool');
      expect(metadata?.shortDescription).toContain('detailed information');
    });
  });
  describe('output schema', () => {
    test('should show output schema structure for instagram-tool', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'instagram-tool' });
      const result = await tool.action();
      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();
      console.log(result.data.usageExample);
      expect(usageExample).toContain('url: string | null');
    });
  });
});
