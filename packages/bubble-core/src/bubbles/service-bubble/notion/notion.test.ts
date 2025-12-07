import { GetBubbleDetailsTool } from '../../tool-bubble/get-bubble-details-tool.js';
import { describe, test, expect } from 'vitest';

// Important input attributes to check
const INPUT_ATTRIBUTES = [
  'page_id',
  'database_id',
  'data_source_id',
  'properties',
  'parent',
  'children',
  'block_id',
  'rich_text',
  'filter',
  'title',
  'icon',
  'start_cursor',
  'page_size',
];

// Important output attributes to check
const OUTPUT_ATTRIBUTES = [
  'page',
  'database',
  'dataSource',
  'results',
  'blocks',
  'comment',
  'users',
];

describe('Notion Bubble Details', () => {
  test('should have important attributes with name, type/example, and description in usage example', async () => {
    const tool = new GetBubbleDetailsTool({ bubbleName: 'notion' });
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

      const hasType =
        usageExample.includes(`${attr}: boolean`) ||
        usageExample.includes(`${attr}: number`) ||
        usageExample.includes(`${attr}: string`) ||
        usageExample.includes(`${attr}: {`) ||
        usageExample.includes(`${attr}?: {`) ||
        usageExample.includes(`${attr}?: object`);
      expect(hasType).toBe(true);
      // Check for description
      const attrIndex = usageExample.indexOf(attr);
      const afterAttr = usageExample.substring(attrIndex);
      expect(afterAttr).toContain('//');
    }
  });
});
