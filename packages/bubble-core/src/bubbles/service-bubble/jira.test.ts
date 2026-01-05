import { describe, test, expect } from 'vitest';
import { GetBubbleDetailsTool } from '../tool-bubble/get-bubble-details-tool.js';
import { JiraBubble } from './jira.js';

describe('JiraBubble', () => {
  describe('result schema validation (similar to Slack tests)', () => {
    test('should validate list_projects result', () => {
      const mockResult = {
        operation: 'list_projects' as const,
        projects: [],
        success: true,
        error: '',
      };

      const parsed = JiraBubble.resultSchema?.parse(mockResult);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('list_projects');
    });

    test('should validate create_issue result', () => {
      const mockResult = {
        operation: 'create_issue' as const,
        issueKey: 'PROJ-123',
        issueId: '10001',
        success: true,
        error: '',
      };

      const parsed = JiraBubble.resultSchema?.parse(mockResult);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('create_issue');
      if (parsed && parsed.operation === 'create_issue') {
        expect(parsed.issueKey).toBe('PROJ-123');
      }
    });

    test('should fail validation for wrong operation type', () => {
      const invalid = {
        operation: 'invalid_operation',
        success: true,
        error: '',
      };

      expect(() => {
        JiraBubble.resultSchema?.parse(invalid as never);
      }).toThrow();
    });
  });

  describe('usage example via GetBubbleDetailsTool (like Notion)', () => {
    test('should expose a useful usage example for jira bubble', async () => {
      const tool = new GetBubbleDetailsTool({ bubbleName: 'jira' });
      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const usageExample = result.data?.usageExample;
      expect(usageExample).toBeDefined();

      // Basic structure checks similar to other bubbles
      expect(usageExample).toContain('// Example usage');
      expect(usageExample).toContain('const');
      expect(usageExample).toContain('new');
      expect(usageExample).toContain('JiraBubble');
      expect(usageExample).toContain('.action()');

      // Input parameters: should mention common Jira fields
      expect(usageExample).toContain('operation');
      expect(usageExample).toContain('projectKey');
      expect(usageExample).toContain('summary');
      expect(usageExample).toContain('description');

      // Output fields: should mention key result properties
      expect(usageExample).toMatch(/issueKey|issues|projects/);
    });
  });
});
