// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach } from 'bun:test';
import { injectCredentials } from './credential-injector.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';

describe('System Credential Loading', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    process.env = { ...originalEnv };
  });

  it('should detect missing SLACK_TOKEN when SLACK_BOT_TOKEN is set', async () => {
    // Setup: Set SLACK_BOT_TOKEN (legacy) but not SLACK_TOKEN (expected)
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token-123';
    delete process.env.SLACK_TOKEN;

    const originalCode = `
import { BubbleFlow, SlackBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const slack = new SlackBubble({ operation: 'send_message' });
    return { success: true };
  }
}`;

    const bubbleParameters: Record<string, ParsedBubble> = {
      slack: {
        variableName: 'slack',
        className: 'SlackBubble',
        bubbleName: 'slack',
        parameters: [
          {
            name: 'operation',
            value: '"send_message"',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: true,
        hasActionCall: true,
      },
    };

    const result = await injectCredentials(originalCode, bubbleParameters, []);

    // The injection should succeed but no credentials will be injected
    // because SLACK_TOKEN is not found
    expect(result.success).toBe(true);
    expect(result.injectedCredentials).toEqual({});

    // Verify the code doesn't have credentials injected
    expect(result.code).not.toContain('credentials:');
    console.log('❌ SLACK_TOKEN not found, credentials not injected');
  });

  it('should successfully inject credentials when SLACK_TOKEN is set', async () => {
    // Setup: Set SLACK_TOKEN (correct)
    process.env.SLACK_TOKEN = 'xoxb-test-token-456';

    const originalCode = `
import { BubbleFlow, SlackBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const slack = new SlackBubble({ operation: 'send_message' });
    return { success: true };
  }
}`;

    const bubbleParameters: Record<string, ParsedBubble> = {
      slack: {
        variableName: 'slack',
        className: 'SlackBubble',
        bubbleName: 'slack',
        parameters: [
          {
            name: 'operation',
            value: '"send_message"',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: true,
        hasActionCall: true,
      },
    };

    const result = await injectCredentials(originalCode, bubbleParameters, []);

    // The injection should succeed with credentials
    expect(result.success).toBe(true);
    expect(result.injectedCredentials).toEqual({ slack: 'SLACK_CRED:system' });

    // Verify the code has credentials injected
    expect(result.code).toContain('credentials:');
    expect(result.code).toContain('SLACK_CRED:');
    console.log('✅ SLACK_TOKEN found, credentials injected successfully');
  });

  it('should show environment variable mismatch issue', () => {
    // This test demonstrates the core issue
    console.log('\n🔍 Environment Variable Check:');
    console.log(
      `  SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN || 'NOT SET'}`
    );
    console.log(`  SLACK_TOKEN: ${process.env.SLACK_TOKEN || 'NOT SET'}`);

    // The credential injector looks for SLACK_TOKEN
    const expectedEnvVar = 'SLACK_TOKEN';
    const legacyEnvVar = 'SLACK_BOT_TOKEN';

    if (process.env[legacyEnvVar] && !process.env[expectedEnvVar]) {
      console.log(
        `\n⚠️  Issue detected: ${legacyEnvVar} is set but ${expectedEnvVar} is not!`
      );
      console.log(
        '  The credential injector expects SLACK_TOKEN, not SLACK_BOT_TOKEN'
      );
    }
  });
});
