import { BubbleFlowValidationTool } from './bubbleflow-validation-tool.js';
import { BubbleFactory } from '../../bubble-factory.js';

describe('Debug Boilerplate', () => {
  it('should debug boilerplate validation', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();

    const boilerplate = bubbleFactory.generateBubbleFlowBoilerplate();

    console.log('Generated boilerplate:');
    console.log('─'.repeat(50));
    console.log(boilerplate);
    console.log('─'.repeat(50));

    const tool = new BubbleFlowValidationTool({
      code: boilerplate,
      options: { includeDetails: true },
    });

    const result = await tool.action();

    if (!result.success) {
      console.log('Validation errors:', result.data?.errors);
    }

    expect(result.success).toBe(true);
  });
});
