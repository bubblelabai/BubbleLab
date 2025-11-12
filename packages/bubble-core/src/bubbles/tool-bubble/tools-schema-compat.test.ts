import { describe, it, expect } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BubbleFactory } from '../../bubble-factory.js';

describe('Tool agent schemas are Gemini-compatible', () => {
  it('should not contain const or anyOf in JSON schema', async () => {
    const factory = new BubbleFactory();
    await factory.registerDefaults();

    const allBubbles = factory.getAll();
    const toolClasses = allBubbles.filter(
      (BubbleClass) => BubbleClass.type === 'tool'
    );

    expect(toolClasses.length).toBeGreaterThan(0);

    for (const ToolClass of toolClasses) {
      if (!ToolClass.toolAgent) {
        throw new Error(
          `Tool class ${ToolClass.bubbleName} does not define toolAgent()`
        );
      }

      const agentTool = ToolClass.toolAgent({}, {});
      const jsonSchema = zodToJsonSchema(agentTool.schema, 'ToolParams');
      const schemaText = JSON.stringify(jsonSchema);

      const hasConst = schemaText.includes('"const"');

      expect(hasConst).toBe(false);
    }
  });
});
