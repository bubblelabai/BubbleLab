import { EditBubbleFlowTool } from './code-edit-tool.js';
import { describe, it, expect } from 'vitest';

describe('CodeEditTool', () => {
  it('should replace a unique match', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'const x = 1;\nconst y = 2;',
      old_string: 'const x = 1;',
      new_string: 'const x = 42;',
    });
    const result = await tool.action();
    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(true);
    expect(result.data.mergedCode).toBe('const x = 42;\nconst y = 2;');
  });

  it('should return error when old_string is not found', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'const x = 1;',
      old_string: 'const z = 99;',
      new_string: 'const z = 100;',
    });
    const result = await tool.action();
    expect(result.success).toBe(false);
    expect(result.data.applied).toBe(false);
    expect(result.data.error).toBe('old_string not found in code');
  });

  it('should return error when old_string is not unique', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'foo bar foo',
      old_string: 'foo',
      new_string: 'baz',
    });
    const result = await tool.action();
    expect(result.success).toBe(false);
    expect(result.data.applied).toBe(false);
    expect(result.data.error).toContain('not unique');
  });

  it('should replace all occurrences when replace_all is true', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'foo bar foo baz foo',
      old_string: 'foo',
      new_string: 'qux',
      replace_all: true,
    });
    const result = await tool.action();
    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(true);
    expect(result.data.mergedCode).toBe('qux bar qux baz qux');
  });

  it('should delete code when new_string is empty', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'line1\nline2\nline3',
      old_string: '\nline2',
      new_string: '',
    });
    const result = await tool.action();
    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(true);
    expect(result.data.mergedCode).toBe('line1\nline3');
  });

  it('should return error when old_string equals new_string', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'const x = 1;',
      old_string: 'const x = 1;',
      new_string: 'const x = 1;',
    });
    const result = await tool.action();
    expect(result.success).toBe(false);
    expect(result.data.applied).toBe(false);
    expect(result.data.error).toBe(
      'new_string must be different from old_string'
    );
  });

  it('should return error when old_string is empty', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'const x = 1;',
      old_string: '',
      new_string: 'something',
    });
    const result = await tool.action();
    expect(result.success).toBe(false);
    expect(result.data.applied).toBe(false);
    expect(result.data.error).toBe('old_string cannot be empty');
  });

  it('should return error when initialCode is empty', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: '',
      old_string: 'something',
      new_string: 'other',
    });
    const result = await tool.action();
    expect(result.success).toBe(false);
    expect(result.data.applied).toBe(false);
    expect(result.data.error).toBe('Initial code cannot be empty');
  });

  it('should handle multiline replacements', async () => {
    const initialCode = `function hello() {
  console.log("hello");
  return true;
}`;
    const tool = new EditBubbleFlowTool({
      initialCode,
      old_string: '  console.log("hello");\n  return true;',
      new_string: '  console.log("world");\n  return false;',
    });
    const result = await tool.action();
    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(true);
    expect(result.data.mergedCode).toContain('console.log("world")');
    expect(result.data.mergedCode).toContain('return false');
  });
});
