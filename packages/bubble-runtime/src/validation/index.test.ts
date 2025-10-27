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

  it('strict type checking', async () => {
    const code = getFixture('linkedin-lead-finder');
    const result = await validateBubbleFlow(code);
    console.log(result);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((error) => error.includes('TS2322'))).toBe(true);
  });

  describe('Valid BubbleFlow validation', () => {
    it('should validate simple HelloWorld BubbleFlow', async () => {
      const code = getFixture('hello-world');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate yfinance flow', async () => {
      const code = getFixture('yfinance');
      const result = await validateAndExtract(code, bubbleFactory);
      console.log(result.inputSchema);
      expect(result.inputSchema).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should validate HelloWorld with environment variables', async () => {
      const code = getFixture('hello-world-wrong-para');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      // Check if the error message contains 'customGreeting does not exist'
      expect(result.errors![0]).contain("'customGreeting' does not exist");
    });

    it('should validate anonymous bubble instantiation', async () => {
      const code = getFixture('anonymous-bubble');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate complex workflow with multiple bubbles', async () => {
      const code = getFixture('complex-workflow');
      const result = await validateBubbleFlow(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Validation and Extraction', () => {
    it('should validate and extract simple HelloWorld BubbleFlow', async () => {
      const code = getFixture('hello-world');
      const result = await validateAndExtract(code, bubbleFactory);
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
      const result = await validateAndExtract(code, bubbleFactory);

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
  });
});
