import { describe, it, expect } from 'vitest';
import {
  isGeminiErrorResponse,
  getGeminiErrorDetails,
} from './safe-gemini-chat.js';
import { AIMessage } from '@langchain/core/messages';

/**
 * Unit tests for SafeGeminiChat utilities
 *
 * Note: Full integration tests with actual Gemini API calls are in
 * gemini-2.5-flash-reliability.integration.test.ts
 */
describe('SafeGeminiChat Utilities', () => {
  describe('isGeminiErrorResponse', () => {
    it('should detect Gemini error responses with [Gemini Error] prefix', () => {
      const errorMessage = new AIMessage({
        content: '[Gemini Error] The model was unable to generate a response.',
        additional_kwargs: {
          finishReason: 'SAFETY_BLOCKED',
          error: 'candidateContent.parts.reduce is not a function',
        },
      });

      expect(isGeminiErrorResponse(errorMessage)).toBe(true);
    });

    it('should detect Gemini error responses with [Gemini Response Error] prefix', () => {
      const errorMessage = new AIMessage({
        content: '[Gemini Response Error] Unable to generate response',
      });

      expect(isGeminiErrorResponse(errorMessage)).toBe(true);
    });

    it('should detect responses with SAFETY_BLOCKED finish reason', () => {
      const errorMessage = new AIMessage({
        content: 'Some content',
        additional_kwargs: {
          finishReason: 'SAFETY_BLOCKED',
        },
      });

      expect(isGeminiErrorResponse(errorMessage)).toBe(true);
    });

    it('should detect responses with ERROR finish reason', () => {
      const errorMessage = new AIMessage({
        content: 'Some content',
        additional_kwargs: {
          finishReason: 'ERROR',
        },
      });

      expect(isGeminiErrorResponse(errorMessage)).toBe(true);
    });

    it('should not detect normal AI messages as errors', () => {
      const normalMessage = new AIMessage({
        content: 'This is a normal response',
      });

      expect(isGeminiErrorResponse(normalMessage)).toBe(false);
    });

    it('should not detect messages with normal finish reasons', () => {
      const normalMessage = new AIMessage({
        content: 'Normal response',
        additional_kwargs: {
          finishReason: 'STOP',
        },
      });

      expect(isGeminiErrorResponse(normalMessage)).toBe(false);
    });
  });

  describe('getGeminiErrorDetails', () => {
    it('should extract error details from additional_kwargs', () => {
      const errorMessage = new AIMessage({
        content: '[Gemini Error] Something went wrong',
        additional_kwargs: {
          error: 'candidateContent.parts.reduce error',
        },
      });

      expect(getGeminiErrorDetails(errorMessage)).toBe(
        'candidateContent.parts.reduce error'
      );
    });

    it('should return undefined if no error details present', () => {
      const message = new AIMessage({
        content: 'Normal message',
      });

      expect(getGeminiErrorDetails(message)).toBeUndefined();
    });

    it('should handle messages with empty additional_kwargs', () => {
      const message = new AIMessage({
        content: 'Message',
        additional_kwargs: {},
      });

      expect(getGeminiErrorDetails(message)).toBeUndefined();
    });
  });

  describe('Error Message Format Validation', () => {
    it('should recognize error messages that match expected format', () => {
      // This validates that our error detection works with the actual error messages
      // that SafeGeminiChat produces

      const expectedErrorMessage = new AIMessage({
        content: `[Gemini Error] The model was unable to generate a response. This can happen when:
1. Content safety filters are triggered (despite BLOCK_NONE setting)
2. The model encounters policy violations
3. The response contains blocked content
4. Network or API issues occur

Original error: candidateContent.parts.reduce is not a function

Please try:
- Rephrasing your prompt
- Using a different model (e.g., gemini-1.5-flash)
- Checking the Google AI Studio for more details`,
        additional_kwargs: {
          finishReason: 'SAFETY_BLOCKED',
          error: 'candidateContent.parts.reduce is not a function',
        },
      });

      expect(isGeminiErrorResponse(expectedErrorMessage)).toBe(true);
      expect(getGeminiErrorDetails(expectedErrorMessage)).toBe(
        'candidateContent.parts.reduce is not a function'
      );
    });

    it('should recognize invoke error messages', () => {
      const invokeErrorMessage = new AIMessage({
        content:
          '[Gemini Response Error] Unable to generate response due to content filtering or API issue. Error: candidateContent.parts.reduce',
        additional_kwargs: {
          finishReason: 'ERROR',
          error: 'candidateContent.parts.reduce',
        },
      });

      expect(isGeminiErrorResponse(invokeErrorMessage)).toBe(true);
    });
  });

  describe('Error Detection Edge Cases', () => {
    it('should handle messages with null content', () => {
      const message = new AIMessage({
        content: null as any,
      });

      // Should not throw, should return false
      expect(isGeminiErrorResponse(message)).toBe(false);
    });

    it('should handle messages with array content', () => {
      const message = new AIMessage({
        content: ['Some', 'content'] as any,
      });

      expect(isGeminiErrorResponse(message)).toBe(false);
    });

    it('should handle messages with object content containing error indicators', () => {
      const message = new AIMessage({
        content: { text: '[Gemini Error] Something' } as any,
      });

      // Object content should still be checked (toString will be called)
      expect(isGeminiErrorResponse(message)).toBe(false);
    });
  });
});
