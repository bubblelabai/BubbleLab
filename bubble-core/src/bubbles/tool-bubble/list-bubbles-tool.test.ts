import { ListBubblesTool } from './list-bubbles-tool.js';
import { BubbleFactory } from '../../bubble-factory.js';
import { z } from 'zod';

describe('ListBubblesTool', () => {
  describe('basic properties', () => {
    test('should have correct metadata', () => {
      const tool = new ListBubblesTool();

      expect(tool.name).toBe('list-bubbles-tool');
      expect(tool.type).toBe('tool');
      expect(tool.alias).toBe('list');
      expect(tool.shortDescription).toContain('Lists all available bubbles');
    });

    test('should have longDescription with use cases', () => {
      const tool = new ListBubblesTool();

      expect(tool.longDescription).toContain('Use cases:');
      expect(tool.longDescription).toContain('AI agent discovery');
      expect(tool.longDescription).toContain('System introspection');
    });
  });

  describe('execution', () => {
    test('should successfully list all bubbles', async () => {
      const tool = new ListBubblesTool();
      const result = await tool.action();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.bubbles).toBeInstanceOf(Array);
      expect(result.data?.totalCount).toBeGreaterThan(0);
    });

    test('should include bubble metadata in results', async () => {
      const tool = new ListBubblesTool();
      const result = await tool.action();

      const bubbles = result.data?.bubbles || [];

      // Check that known bubbles are included
      const helloWorldBubble = bubbles.find((b) => b.name === 'hello-world');
      expect(helloWorldBubble).toBeDefined();
      expect(helloWorldBubble?.shortDescription).toBeDefined();
      expect(helloWorldBubble?.type).toBe('service');

      const aiAgentBubble = bubbles.find((b) => b.name === 'ai-agent');
      expect(aiAgentBubble).toBeDefined();
      expect(aiAgentBubble?.type).toBe('service');
    });

    test('should extract use cases from longDescription', async () => {
      const tool = new ListBubblesTool();
      const result = await tool.action();

      const bubbles = result.data?.bubbles || [];

      bubbles.forEach((bubble) => {
        expect(bubble.useCase).toBeDefined();
        expect(typeof bubble.useCase).toBe('string');
        expect(bubble.useCase.length).toBeGreaterThan(0);
      });
    });
  });

  describe('toAgentTool conversion', () => {
    test('should convert to LangGraph tool format', () => {
      const agentTool = ListBubblesTool.toolAgent();

      expect(agentTool).toBeDefined();
      expect(agentTool.name).toBe('list-bubbles-tool');
      expect(agentTool.description).toContain('Lists all available bubbles');
      expect(agentTool.schema).toBeDefined();
      expect(typeof agentTool.func).toBe('function');
    });

    test('should execute successfully as agent tool', async () => {
      const agentTool = ListBubblesTool.toolAgent();

      const result = await agentTool.func<
        z.infer<typeof ListBubblesTool.resultSchema>
      >({});

      expect(result).toBeDefined();
      expect(result?.data?.bubbles).toBeInstanceOf(Array);
      expect(result?.data?.totalCount).toBeGreaterThan(0);
    });
  });

  describe('registry integration', () => {
    test('should be registered in BubbleRegistry', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();
      const registeredClass = factory.get('list-bubbles-tool');

      expect(registeredClass).toBeDefined();
      expect(registeredClass).toBe(ListBubblesTool);
    });

    test('should have metadata in registry', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();
      const metadata = factory.getMetadata('list-bubbles-tool');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('list-bubbles-tool');
      expect(metadata?.type).toBe('tool');
      expect(metadata?.shortDescription).toContain(
        'Lists all available bubbles'
      );
    });
  });
});
