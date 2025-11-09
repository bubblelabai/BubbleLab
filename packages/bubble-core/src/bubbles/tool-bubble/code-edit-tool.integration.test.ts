import { CredentialType } from '@bubblelab/shared-schemas';
import { EditBubbleFlowTool } from './code-edit-tool.js';
import { describe, it, expect } from 'vitest';

describe('CodeEditTool', () => {
  it('should edit the code', async () => {
    const tool = new EditBubbleFlowTool({
      initialCode: 'console.log("Hello, world!");',
      instructions: 'Wrap the the console.log in a function',
      codeEdit: 'function newFunction() { // ... existing code ... }',
      credentials: {
        [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',
      },
    });
    const result = await tool.action();
    console.log(result.data.mergedCode);
    expect(result.success).toBe(true);
  });
});
