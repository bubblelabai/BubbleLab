import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import {
  enforcePayloadTypeRule,
  noToStringOnExpectedOutputSchemaRule,
  LintRuleRegistry,
} from './lint-rules.js';

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

describe('no-tostring-on-expected-output-schema lint rule', () => {
  it('should error when .toString() is called on expectedOutputSchema', () => {
    const code = `
import { z } from 'zod';
import { AIAgentBubble } from '@bubblelab/bubble-core';

const parser = new AIAgentBubble({
  message: 'Extract companies',
  model: { model: 'google/gemini-2.5-flash' },
  expectedOutputSchema: z.object({
    companies: z.array(z.object({ name: z.string() })),
  }).toString(),
});
`;

    const sourceFile = ts.createSourceFile(
      'test.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const registry = new LintRuleRegistry();
    registry.register(noToStringOnExpectedOutputSchemaRule);

    const errors = registry.validateAll(sourceFile);

    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('Do not call .toString()');
    expect(errors[0].message).toContain('expectedOutputSchema');
  });

  it('should not error when Zod schema is passed directly without .toString()', () => {
    const code = `
import { z } from 'zod';
import { AIAgentBubble } from '@bubblelab/bubble-core';

const parser = new AIAgentBubble({
  message: 'Extract companies',
  model: { model: 'google/gemini-2.5-flash' },
  expectedOutputSchema: z.object({
    companies: z.array(z.object({ name: z.string() })),
  }),
});
`;

    const sourceFile = ts.createSourceFile(
      'test.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const registry = new LintRuleRegistry();
    registry.register(noToStringOnExpectedOutputSchemaRule);

    const errors = registry.validateAll(sourceFile);

    expect(errors.length).toBe(0);
  });

  it('should not error when toString is called on other properties', () => {
    const code = `
import { z } from 'zod';

const obj = {
  someOtherProperty: z.object({ name: z.string() }).toString(),
};
`;

    const sourceFile = ts.createSourceFile(
      'test.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const registry = new LintRuleRegistry();
    registry.register(noToStringOnExpectedOutputSchemaRule);

    const errors = registry.validateAll(sourceFile);
    console.log(errors);

    expect(errors.length).toBe(0);
  });
});
