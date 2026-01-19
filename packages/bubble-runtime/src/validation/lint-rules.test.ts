import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { enforcePayloadTypeRule, LintRuleRegistry } from './lint-rules.js';

describe('enforce-payload-type lint rule', () => {
  it('should error when handle payload uses wrong type for slack/bot_mentioned trigger', () => {
    const code = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class MyFlow extends BubbleFlow<'slack/bot_mentioned'> {
  constructor() {
    super('my-flow', 'A test flow');
  }

  async handle(payload: WebhookEvent): Promise<{ message: string }> {
    return { message: payload.text };
  }
}
`;

    const sourceFile = ts.createSourceFile(
      'test.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const registry = new LintRuleRegistry();
    registry.register(enforcePayloadTypeRule);

    const errors = registry.validateAll(sourceFile);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('SlackMentionEvent');
    expect(errors[0].message).toContain('slack/bot_mentioned');
  });
});
