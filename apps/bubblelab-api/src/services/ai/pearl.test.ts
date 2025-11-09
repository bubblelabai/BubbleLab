// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { runPearl } from './pearl.js';
import type { AvailableModel, PearlRequest } from '@bubblelab/shared-schemas';
import { CredentialType } from '@bubblelab/shared-schemas';
import { env } from '../../config/env.js';

/**
 * Test case structure for Pearl AI agent
 */

/**
 * General test case interface for Pearl (expects code generation)
 */
interface PearlTestCase {
  request: PearlRequest;
  snippetContains: string[];
  snippetMatches: RegExp[];
  expectedType: 'code' | 'question' | 'answer' | 'reject';
}

/**
 * Test helper to execute and validate a test case
 */
async function runTestCase(testCase: PearlTestCase) {
  if (!env.GOOGLE_API_KEY && !env.OPENAI_API_KEY) {
    return;
  }

  // Execute Pearl agent
  const result = await runPearl(testCase.request, {
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
    [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
    [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
  });

  console.log('Pearl result:', JSON.stringify(result, null, 2));

  // Validate basic fields
  expect(result.success).toBe(true);
  expect(result.type).toBe('code');
  expect(result.message).toBeDefined();
  expect(result.snippet).toBeDefined();

  // Validate snippet contains expected strings
  for (const text of testCase.snippetContains) {
    expect(result.snippet).toContain(text);
  }

  // Validate snippet matches expected patterns
  for (const pattern of testCase.snippetMatches) {
    expect(result.snippet).toMatch(pattern);
  }
}

// ============================================================================
// TEST CASE DEFINITIONS
// Add new test cases here
// ============================================================================

/**
 * Simple test case: Generate a basic workflow that sends an email
 */
const simpleEmailWorkflowTestCase: PearlTestCase = {
  request: {
    availableVariables: [],
    userRequest:
      'Create a workflow that sends an email to user@example.com with subject "Hello" and body "Welcome to our platform!"',
    userName: 'Test User',
    conversationHistory: [],
    model: 'google/gemini-2.5-pro',
  },
  snippetContains: [
    'BubbleFlow',
    'user@example.com',
    'Hello',
    'Welcome to our platform!',
  ],
  snippetMatches: [/class.*extends BubbleFlow/i, /async handle/i],
  expectedType: 'code',
};

/**
 * Test case: User asking how to run an existing workflow
 */
const howToRunWorkflowTestCase: PearlTestCase = {
  request: {
    model: 'google/gemini-2.5-pro',
    availableVariables: [
      {
        name: 'WebhookEvent',
        type: '(alias) interface WebhookEvent\nimport WebhookEvent',
        kind: 'const',
      },
      {
        name: 'Output',
        type: 'interface Output',
        kind: 'const',
      },
      {
        name: 'CustomWebhookPayload',
        type: 'interface CustomWebhookPayload',
        kind: 'const',
      },
      {
        name: 'UntitledFlow',
        type: 'class UntitledFlow',
        kind: 'const',
      },
      {
        name: 'agent',
        type: 'AIAgentBubble',
        kind: 'const',
      },
      {
        name: 'result',
        type: 'const result: BubbleResult<{\n    response: string;\n    toolCalls: {\n        tool: string;\n        input?: unknown;\n        output?: unknown;\n    }[];\n    iterations: number;\n    error: string;\n    success: boolean;\n}>',
        kind: 'const',
      },
    ],
    userRequest: 'How do I run this flow?',
    userName: 'Test User',
    conversationHistory: [],
    currentCode: `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;
    this.logger?.error("fdfd")
    // Simple AI agent that responds to user queries with web search
    const agent = new AIAgentBubble({
      message: query,
      systemPrompt: 'You are a helpful assistant.',
      tools: [
        {
          name: 'web-search-tool',
          config: {
            limit: 1,
          },
        },
      ],
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(\`AI Agent failed: \${result.error}\`);
    }

    return {
      response: result.data.response,
    };
  }
}
`,
    additionalContext:
      "\n\nUser's timezone: America/Los_Angeles\n\nCurrent time: Sunday, November 9, 2025 at 3:37:48 AM PST\n\nUser's provided input:\n {}",
  },
  expectedType: 'answer',
  snippetMatches: [],
  snippetContains: ['webhook', 'HTTP', 'deploy'],
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Pearl AI Agent', () => {
  afterAll(async () => {
    // Wait for logger to upload logs before test ends
    console.log('Waiting for logger to finish uploading logs...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('Logger upload complete, test ending');
  });

  it('should generate a simple email workflow with Gemini 2.5 pro', async () => {
    const testCase = simpleEmailWorkflowTestCase;
    await runTestCase(testCase);
  }, 60000);
});
