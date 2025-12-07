// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import { executeBubbleFlow } from './execution.js';
import type { BubbleResult } from '@bubblelab/bubble-core';

describe('BubbleFlow Execution Timeout Fix', () => {
  it('should handle setTimeout in HelloWorld bubble without hanging', async () => {
    // Sample processed code similar to what HelloWorld bubble generates
    const processedCode = `
const { BubbleFlow, HelloWorldBubble } = __bubbleCore;

class TestTimeoutFlow extends BubbleFlow {
  async handle(payload) {
    console.log('Starting HelloWorld bubble with timeout...');
    
    const helloWorldBubble = new HelloWorldBubble({
      name: payload.name || 'Test',
      message: payload.message || 'Hello from timeout test!'
    });
    
    const result = await helloWorldBubble.action();
    
    console.log('HelloWorld result:', result);
    
    return {
      success: true,
      data: result,
      error: ''
    };
  }
}
`;

    const payload = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: '/test-timeout',
      body: { name: 'TimeoutTest', message: 'Testing timeout fix!' },
      name: 'TimeoutTest',
      executionId: 'test-timeout-execution-id',
      message: 'Testing timeout fix!',
    };

    const options = {
      userId: 'test-timeout-user-id',
      pricingTable: {},
    };

    // Set a reasonable timeout for the test
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Test timed out - execution is hanging'));
      }, 5000); // 5 second timeout
    });

    const executionPromise = executeBubbleFlow(processedCode, payload, options);

    // This should complete without timing out
    const result = await Promise.race([executionPromise, timeoutPromise]);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // The result.data contains the return value from the BubbleFlow handle method
    // which returns { success: true, data: BubbleResult, error: '' }
    const flowResult = result.data as {
      success: boolean;
      data: BubbleResult<{ greeting: string }>;
      error: string;
    };
    expect(flowResult.success).toBe(true);
    expect(flowResult.data.data?.greeting).toContain('TimeoutTest');
    expect(result.error).toBe('');
  }, 10000); // Set test timeout to 10 seconds

  it('should provide access to core JavaScript globals like Date', async () => {
    const processedCode = `
const { BubbleFlow } = __bubbleCore;

class TestGlobalsFlow extends BubbleFlow {
  async handle(payload) {
    // Test that Date is available (core JavaScript global)
    const now = new Date();
    const timestamp = now.toISOString();
    
    // Test that Math is available
    const random = Math.random();
    
    return {
      success: true,
      timestamp,
      random,
      message: 'Globals test completed',
      error: ''
    };
  }
}
`;

    const payload = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: '/test-globals',
      body: {},
      executionId: 'test-globals-execution-id',
    };

    const options = {
      userId: 'test-globals-user-id',
      pricingTable: {},
    };

    const result = await executeBubbleFlow(processedCode, payload, options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // The result.data contains the return value from our test flow
    const testResult = result.data as {
      timestamp: string;
      random: number;
      message: string;
    };
    expect(testResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
    expect(typeof testResult.random).toBe('number');
    expect(testResult.message).toBe('Globals test completed');
  });

  it('should handle Promise with setTimeout correctly', async () => {
    const processedCode = `
const { BubbleFlow } = __bubbleCore;

class TestPromiseTimeoutFlow extends BubbleFlow {
  async handle(payload) {
    // This is the exact pattern that was causing the hang
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    return {
      message: 'Promise with setTimeout completed',
    };
  }
}
`;

    const payload = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: '/test-promise-timeout',
      body: {},
      executionId: 'test-promise-timeout-execution-id',
    };

    const options = {
      userId: 'test-promise-timeout-user-id',
      pricingTable: {},
    };

    const startTime = Date.now();
    const result = await executeBubbleFlow(processedCode, payload, options);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    console.log('[Execution Timeout Test] Result:', result);

    // The result.data contains the return value from our test flow
    const testResult = result.data as { message: string };
    expect(testResult.message).toBe('Promise with setTimeout completed');
    expect(endTime - startTime).toBeGreaterThanOrEqual(49); // Should take at least 50ms
    expect(endTime - startTime).toBeLessThan(1000); // But not hang for seconds
  });
});
