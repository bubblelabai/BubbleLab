// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import { runBubbleFlow } from './execution.js';

describe('BubbleFlow Execution with observability', () => {
  it('should handle setTimeout in HelloWorld bubble without hanging', async () => {
    // HelloWorld bubble code in normal TypeScript (before transpile)
    const bubbleScript = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';
import type { WebhookEvent } from '@bubblelab/bubble-core';

interface HelloWorldPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class HelloWorldFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: HelloWorldPayload) {
    console.log('Starting HelloWorld bubble with timeout...');
    
    const helloWorldBubble = new HelloWorldBubble({
      name: payload.name || 'Test',
      message: payload.message || 'Hello from timeout test!'
    });
    
    const result = await helloWorldBubble.action();
    
    console.log('HelloWorld result:', result);
    
    return result;
  }
}
`;

    const bubbleParameters = {};

    const payload = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: '/test-timeout',
      body: { name: 'TimeoutTest', message: 'Testing timeout fix!' },
      name: 'TimeoutTest',
      message: 'Testing timeout fix!',
    };

    const options = {
      userId: 'test-timeout-user-id',
    };

    // Set a reasonable timeout for the test
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Test timed out - execution is hanging'));
      }, 7000); // 7 second timeout
    });

    const executionPromise = runBubbleFlow(
      bubbleScript,
      bubbleParameters,
      payload,
      options
    );

    // This should complete without timing out
    const result = await Promise.race([executionPromise, timeoutPromise]);
    // TODO: Not done yet

    console.log(result);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.error).toBe('');
  }, 10000); // Set test timeout to 10 seconds
});
