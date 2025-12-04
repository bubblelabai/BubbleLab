import { GetBubbleDetailsTool } from '../tool-bubble/get-bubble-details-tool.js';
import { describe, test, expect } from 'vitest';

// Important input attributes to check
const INPUT_ATTRIBUTES = [
  'chat_id',
  'text',
  'photo',
  'document',
  'parse_mode',
  'caption',
  'message_id',
  'offset',
  'limit',
  'action',
];

// Important output attributes to check
const OUTPUT_ATTRIBUTES = ['message'];

describe('Telegram Bubble Details', () => {
  test('should have important attributes with name, type/example, and description in usage example', async () => {
    const tool = new GetBubbleDetailsTool({ bubbleName: 'telegram' });
    const result = await tool.action();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const usageExample = result.data?.usageExample;
    expect(usageExample).toBeDefined();

    // Check input attributes - should have "example string" format and description
    for (const attr of INPUT_ATTRIBUTES) {
      expect(usageExample).toContain(attr);
      // Check for input format: attributeName: "example string" // description
      expect(usageExample).toContain(`${attr}:`);
      expect(usageExample).toContain('example string');
      // Check for description (after //)
      const attrIndex = usageExample.indexOf(attr);
      const afterAttr = usageExample.substring(attrIndex);
      expect(afterAttr).toContain('//');
    }

    // Check output attributes - should have type and description
    for (const attr of OUTPUT_ATTRIBUTES) {
      expect(usageExample).toContain(attr);
      // Check for output format in comments: // attributeName: type // description
      const outputSection =
        usageExample.split('outputSchema')[1] || usageExample;
      expect(outputSection).toContain(attr);
      // Check for type indicators (boolean, number, string, etc.)
      console.log(outputSection);
      console.log(attr);
      const hasType =
        outputSection.includes(`${attr}: boolean`) ||
        outputSection.includes(`${attr}: number`) ||
        outputSection.includes(`${attr}: string`) ||
        outputSection.includes(`${attr}: {`);
      expect(hasType).toBe(true);
      // Check for description
      const attrIndex = outputSection.indexOf(attr);
      const afterAttr = outputSection.substring(attrIndex);
      expect(afterAttr).toContain('//');
    }
  });
});
