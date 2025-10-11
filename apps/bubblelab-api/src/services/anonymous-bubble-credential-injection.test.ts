// @ts-expect-error - Bun test
import { expect, describe, it } from 'bun:test';
import { parseBubbleFlow } from './bubble-flow-parser.js';
import { injectCredentials } from './credential-injector.js';

describe('Anonymous Bubble Credential Injection', () => {
  it('should inject credentials into anonymous slack bubble expressions', async () => {
    const originalCode = `
export class TestFlow extends BubbleFlow {
  async handle(payload: any): Promise<BubbleOperationResult> {
    // Anonymous bubble that should get credentials injected
    await new SlackBubble({
      operation: "list_channels"
    }).action();

    return { success: true };
  }
}`;

    // Parse the code
    const parseResult = await parseBubbleFlow(originalCode);

    // Debug output if parsing fails
    if (!parseResult.success) {
      console.log('Parse errors:', parseResult.errors);
    }

    expect(parseResult.success).toBe(true);
    expect(Object.keys(parseResult.bubbles)).toHaveLength(1);

    // Should have an anonymous bubble
    const anonymousKey = Object.keys(parseResult.bubbles)[0];
    expect(anonymousKey).toMatch(/^_anonymous_SlackBubble_\d+$/);
    expect(parseResult.bubbles[anonymousKey].bubbleName).toBe('slack');

    // Mock user credentials for the anonymous bubble
    const userCredentials = [
      {
        bubbleVarName: anonymousKey,
        secret: 'xoxb-test-token',
        credentialType: 'SLACK_CRED',
        credentialId: 1,
      },
    ];

    // Inject credentials
    const injectionResult = await injectCredentials(
      originalCode,
      parseResult.bubbles,
      userCredentials
    );

    expect(injectionResult.success).toBe(true);
    expect(injectionResult.code).toBeDefined();
    expect(injectionResult.injectedCredentials).toBeDefined();
    expect(Object.keys(injectionResult.injectedCredentials!)).toHaveLength(1);

    // Check that the injected code contains the credentials parameter
    expect(injectionResult.code!).toContain(
      'credentials: { SLACK_CRED: "xoxb-test-token" }'
    );
  });

  it('should handle multiple anonymous slack bubbles of the same type', async () => {
    const originalCode = `
export class TestFlow extends BubbleFlow {
  async handle(payload: any): Promise<BubbleOperationResult> {
    // First anonymous bubble
    await new SlackBubble({
      operation: "list_channels"
    }).action();

    // Second anonymous bubble
    await new SlackBubble({
      operation: "list_channels"
    }).action();

    return { success: true };
  }
}`;

    // Parse the code
    const parseResult = await parseBubbleFlow(originalCode);

    // Debug output if parsing fails
    if (!parseResult.success) {
      console.log('Parse errors:', parseResult.errors);
    }

    expect(parseResult.success).toBe(true);
    expect(Object.keys(parseResult.bubbles)).toHaveLength(2);

    // Should have two anonymous bubbles
    const anonymousKeys = Object.keys(parseResult.bubbles);
    expect(
      anonymousKeys.every((key) => key.startsWith('_anonymous_SlackBubble_'))
    ).toBe(true);

    // Mock user credentials for both anonymous bubbles
    const userCredentials = anonymousKeys.map((key, index) => ({
      bubbleVarName: key,
      secret: `xoxb-test-token-${index + 1}`,
      credentialType: 'SLACK_CRED',
      credentialId: index + 1,
    }));

    // Inject credentials
    const injectionResult = await injectCredentials(
      originalCode,
      parseResult.bubbles,
      userCredentials
    );

    expect(injectionResult.success).toBe(true);
    expect(injectionResult.code).toBeDefined();
    expect(Object.keys(injectionResult.injectedCredentials!)).toHaveLength(2);

    // Check that both credentials were injected
    expect(injectionResult.code!).toContain(
      'credentials: { SLACK_CRED: "xoxb-test-token-1" }'
    );
    expect(injectionResult.code!).toContain(
      'credentials: { SLACK_CRED: "xoxb-test-token-2" }'
    );
  });

  it('should handle mixed named and anonymous slack bubbles', async () => {
    const originalCode = `
export class TestFlow extends BubbleFlow {
  async handle(payload: any): Promise<BubbleOperationResult> {
    // Named bubble
    const slackService = new SlackBubble({
      operation: "list_channels"
    });

    // Anonymous bubble
    await new SlackBubble({
      operation: "list_channels"
    }).action();

    return { success: true };
  }
}`;

    // Parse the code
    const parseResult = await parseBubbleFlow(originalCode);

    // Debug output if parsing fails
    if (!parseResult.success) {
      console.log('Parse errors:', parseResult.errors);
    }

    expect(parseResult.success).toBe(true);
    expect(Object.keys(parseResult.bubbles)).toHaveLength(2);

    // Should have one named and one anonymous bubble
    const namedKey = 'slackService';
    const anonymousKey = Object.keys(parseResult.bubbles).find((key) =>
      key.startsWith('_anonymous_')
    );

    expect(parseResult.bubbles[namedKey]).toBeDefined();
    expect(anonymousKey).toBeDefined();
    expect(anonymousKey).toMatch(/^_anonymous_SlackBubble_\d+$/);

    // Mock user credentials for both bubbles
    const userCredentials = [
      {
        bubbleVarName: namedKey,
        secret: 'named-slack-token',
        credentialType: 'SLACK_CRED',
        credentialId: 1,
      },
      {
        bubbleVarName: anonymousKey!,
        secret: 'anonymous-slack-token',
        credentialType: 'SLACK_CRED',
        credentialId: 2,
      },
    ];

    // Inject credentials
    const injectionResult = await injectCredentials(
      originalCode,
      parseResult.bubbles,
      userCredentials
    );

    expect(injectionResult.success).toBe(true);
    expect(injectionResult.code).toBeDefined();
    expect(Object.keys(injectionResult.injectedCredentials!)).toHaveLength(2);

    // Check that both credentials were injected
    expect(injectionResult.code!).toContain(
      'credentials: { SLACK_CRED: "named-slack-token" }'
    );
    expect(injectionResult.code!).toContain(
      'credentials: { SLACK_CRED: "anonymous-slack-token" }'
    );
  });
});
