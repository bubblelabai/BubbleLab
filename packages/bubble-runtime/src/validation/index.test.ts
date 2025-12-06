import { describe, it, expect } from 'vitest';
import { getFixture } from '../../tests/fixtures/index.js';
import { validateBubbleFlow, validateAndExtract } from './index.js';
import { BubbleFactory } from '@bubblelab/bubble-core';

describe('BubbleFlow Validation', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  describe('Lint styles', () => {
    it('should fail lint style rules in github-pr-sequential flow', async () => {
      const code = getFixture('github-pr-sequential');
      const result = await validateBubbleFlow(code);
      console.log(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
  describe('Valid BubbleFlow validation', () => {
    it('should invalidate credential in flow', async () => {
      const code = getFixture('credential-in-flow');
      const result = await validateBubbleFlow(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      expect(result.errors![0]).toContain('credentials');
    });

    it('should validate calender step flow', async () => {
      const code = getFixture('invalid-step-flow');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(false);
      // Expect error message to contain 'throw statements are not allowed directly in handle method. Move error handling into another step.'
      expect(
        result.errors?.some((error) =>
          error.includes(
            'throw statements are not allowed directly in handle method. Move error handling into another step.'
          )
        )
      ).toBe(true);
    });
    it('should validate simple HelloWorld BubbleFlow', async () => {
      const code = getFixture('hello-world');
      const result = await validateBubbleFlow(code, false);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate yfinance flow', async () => {
      const code = getFixture('yfinance');
      const result = await validateAndExtract(code, bubbleFactory, false);
      console.log(result.inputSchema);
      expect(result.inputSchema).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should validate HelloWorld with environment variables', async () => {
      const code = getFixture('hello-world-wrong-para');
      const result = await validateBubbleFlow(code, false);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      // Check if the error message contains 'customGreeting does not exist'
      expect(result.errors![0]).contain("'customGreeting' does not exist");
    });

    it('should validate anonymous bubble instantiation', async () => {
      const code = getFixture('anonymous-bubble');
      const result = await validateBubbleFlow(code, false);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate complex workflow with multiple bubbles', async () => {
      const code = getFixture('complex-workflow');
      const result = await validateBubbleFlow(code, false);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Validation and Extraction', () => {
    it('should validate and extract simple HelloWorld BubbleFlow', async () => {
      const code = getFixture('hello-world');
      const result = await validateAndExtract(code, bubbleFactory, false);
      console.log(result);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.bubbleParameters).toBeDefined();

      // Note: These tests will pass when extractBubbleParameters is implemented
      // For now they'll show empty parameters since extraction returns []
      const bubbles = Object.keys(result.bubbleParameters || {});
      expect(bubbles).toHaveLength(1); // Will be 1 when extraction is implemented
    });

    it('should validate and extract HelloWorld with environment variables', async () => {
      const code = getFixture('hello-world-wrong-type');
      const result = await validateAndExtract(code, bubbleFactory, false);

      expect(result.valid).toBe(false);
    });
  });

  describe('Invalid BubbleFlow validation', () => {
    it('should fail validation for class not extending BubbleFlow', async () => {
      const code = getFixture('invalid-flow');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain(
        'Code must contain a class that extends BubbleFlow'
      );
    });

    it('should fail validation for missing handle method', async () => {
      const code = getFixture('missing-handle-flow');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors?.some((error) =>
          error.includes('does not implement inherited abstract member')
        )
      ).toBe(true);
    });
    it('passes on valid TestScript flow', async () => {
      const code = getFixture('test-script');
      const result = await validateBubbleFlow(code);
      console.log(result);
      expect(result.valid).toBe(true);
    });

    it('should fail validation when a method calls another method', async () => {
      const code = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  private async helperMethod(): Promise<string> {
    return 'test';
  }

  private async gatherContext(): Promise<string> {
    // This should fail - calling another method from a method
    const result = await this.helperMethod();
    return result;
  }

  async handle(payload: any): Promise<any> {
    const context = await this.gatherContext();
    return { context };
  }
}
`;
      const result = await validateBubbleFlow(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors?.some((error) =>
          error.includes('cannot be called from another method')
        )
      ).toBe(true);
    });
  });
});
