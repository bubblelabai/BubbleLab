import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for FlowIDEView component logic
 * Tests the 404 flow not found functionality
 */

const isFlowNotFound = (flowError: Error | null): boolean => {
  if (!flowError) return false;
  const errorMessage = flowError.message || '';
  // Check for both status code 404 and "BubbleFlow not found" message
  const has404Status = /HTTP\s+404|404/.test(errorMessage);
  const hasNotFoundMessage = errorMessage.includes('BubbleFlow not found');
  return has404Status && hasNotFoundMessage;
};

describe('FlowIDEView - Flow Not Found Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFlowNotFoundError function', () => {
    it('should return false when there is no error', () => {
      const flowError = null;
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return true when error message contains both 404 status and "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 404: {"error":"BubbleFlow not found"}');
      expect(isFlowNotFound(flowError)).toBe(true);
    });

    it('should return false when error message contains "BubbleFlow not found" but no 404 status', () => {
      const flowError = new Error('BubbleFlow not found');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return false when error message contains 404 but not "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 404: {"error":"Resource not found"}');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return true when error message contains "404" in different formats', () => {
      const errorFormats = [
        'HTTP 404: {"error":"BubbleFlow not found"}',
        'HTTP404: {"error":"BubbleFlow not found"}',
        'Error 404: BubbleFlow not found',
        'Status 404 - BubbleFlow not found',
      ];

      errorFormats.forEach((errorMsg) => {
        const flowError = new Error(errorMsg);
        expect(isFlowNotFound(flowError)).toBe(true);
      });
    });

    it('should return false when error message does not contain "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 404: Network error');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return false when error message contains "not found" but not "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 404: Resource not found');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should handle empty error message', () => {
      const flowError = new Error('');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should handle error with undefined message', () => {
      const flowError = { message: undefined } as unknown as Error;
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return false for other HTTP status codes even with "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 500: {"error":"BubbleFlow not found"}');
      expect(isFlowNotFound(flowError)).toBe(false);
    });

    it('should return false for 400 status code', () => {
      const flowError = new Error('HTTP 400: {"error":"BubbleFlow not found"}');
      expect(isFlowNotFound(flowError)).toBe(false);
    });
  });

  describe('Error handling scenarios', () => {
    it('should correctly identify 404 errors from API', () => {
      // Simulate the error format from api.ts
      const apiError = new Error('HTTP 404: {"error":"BubbleFlow not found"}');
      expect(isFlowNotFound(apiError)).toBe(true);
    });

    it('should require both 404 status and "BubbleFlow not found" message', () => {
      const testCases = [
        {
          error: 'HTTP 404: {"error":"BubbleFlow not found"}',
          expected: true,
        },
        {
          error: 'BubbleFlow not found',
          expected: false,
        },
        {
          error: 'HTTP 404: {"error":"Something else"}',
          expected: false,
        },
        {
          error: 'HTTP 500: {"error":"BubbleFlow not found"}',
          expected: false,
        },
      ];

      testCases.forEach(({ error, expected }) => {
        const flowError = new Error(error);
        expect(isFlowNotFound(flowError)).toBe(expected);
      });
    });

    it('should not match partial strings incorrectly', () => {
      const flowError = new Error('HTTP 404: BubbleFlowNotFound'); // No space
      expect(isFlowNotFound(flowError)).toBe(false);
    });
  });

  describe('Component state logic', () => {
    it('should show 404 page when flowError contains both 404 status and "BubbleFlow not found"', () => {
      const flowError = new Error('HTTP 404: {"error":"BubbleFlow not found"}');
      const flowId = 123;
      const currentFlow = null;
      const flowLoading = false;

      // Simulate the conditional rendering logic
      const isNotFound = isFlowNotFound(flowError);
      const shouldShow404 = Boolean(flowId && isNotFound);
      const shouldShowLoading = Boolean(flowId && flowLoading && !flowError);
      const shouldShowFlow = Boolean(
        flowId && currentFlow && !flowError && !flowLoading
      );

      expect(shouldShow404).toBe(true);
      expect(shouldShowLoading).toBe(false);
      expect(shouldShowFlow).toBe(false);
    });

    it('should show loading state when loading and no error', () => {
      const flowError: Error | null = null;
      const flowId = 123;
      const currentFlow = null;
      const flowLoading = true;

      const isNotFound = isFlowNotFound(flowError);
      const shouldShow404 = Boolean(flowId && isNotFound);
      const shouldShowLoading = Boolean(flowId && flowLoading && !flowError);
      const shouldShowFlow = Boolean(
        flowId && currentFlow && !flowError && !flowLoading
      );

      expect(shouldShow404).toBe(false);
      expect(shouldShowLoading).toBe(true);
      expect(shouldShowFlow).toBe(false);
    });

    it('should show flow when flow exists and loaded', () => {
      const flowError: Error | null = null;
      const flowId = 123;
      const currentFlow = { id: 123, name: 'Test Flow', code: 'test' };
      const flowLoading = false;

      const isNotFound = isFlowNotFound(flowError);
      const shouldShow404 = Boolean(flowId && isNotFound);
      const shouldShowLoading = Boolean(flowId && flowLoading && !flowError);
      const shouldShowFlow = Boolean(
        flowId && currentFlow && !flowError && !flowLoading
      );

      expect(shouldShow404).toBe(false);
      expect(shouldShowLoading).toBe(false);
      expect(shouldShowFlow).toBe(true);
    });

    it('should prioritize 404 over loading state', () => {
      const flowError = new Error('HTTP 404: {"error":"BubbleFlow not found"}');
      const flowId = 123;
      const flowLoading = true;

      // In the actual component, isFlowNotFound() is checked first
      const isNotFound = isFlowNotFound(flowError);
      const shouldShow404 = Boolean(flowId && isNotFound);
      const shouldShowLoading = Boolean(flowId && flowLoading && !isNotFound);

      expect(shouldShow404).toBe(true);
      expect(shouldShowLoading).toBe(false);
    });
  });
});
