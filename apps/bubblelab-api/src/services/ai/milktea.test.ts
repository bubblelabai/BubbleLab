// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll } from 'bun:test';
import { runMilkTea } from './milktea.js';
import type { AvailableModel, MilkTeaRequest } from '@bubblelab/shared-schemas';
import { CredentialType } from '@bubblelab/shared-schemas';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../../config/env.js';

/**
 * Test case structure for Milk Tea AI agent
 */

// Load bubble definitions from JSON
let bubbleDefinitions: {
  bubbles: Array<{
    name: string;
    alias: string;
    type: string;
    shortDescription: string;
    inputSchema: string;
    outputSchema: string;
    usageExample: string;
    requiredCredentials: string[];
  }>;
};

/**
 * General test case interface for Milk Tea
 */
interface MilkTeaTestCase {
  request: MilkTeaRequest;
  snippetContains: string[];
  snippetMatches: RegExp[];
}

/**
 * Test case definition (without model specified)
 */
interface MilkTeaTestCaseDefinition {
  request: Omit<MilkTeaRequest, 'model'>;
  snippetContains: string[];
  snippetMatches: RegExp[];
}

/**
 * Helper to get bubble schema from definitions
 */
async function getBubbleSchema(bubbleName: string) {
  // Load bubble definitions if not already loaded
  if (!bubbleDefinitions) {
    const bubblesJsonPath = join(__dirname, 'bubbles.json');
    const bubblesJson = await readFile(bubblesJsonPath, 'utf-8');
    bubbleDefinitions = JSON.parse(bubblesJson);
  }

  const bubble = bubbleDefinitions.bubbles.find((b) => b.name === bubbleName);
  if (!bubble) {
    throw new Error(`Bubble '${bubbleName}' not found in definitions`);
  }
  return {
    name: bubble.name,
    shortDescription: bubble.shortDescription,
    inputSchema: bubble.inputSchema,
    outputSchema: bubble.outputSchema,
    usageExample: bubble.usageExample,
  };
}

/**
 * Helper to create a test case from a definition with a specific model
 */
function createTestCase(
  definition: MilkTeaTestCaseDefinition,
  model: AvailableModel
): MilkTeaTestCase {
  return {
    request: {
      ...definition.request,
      model,
    },
    snippetContains: definition.snippetContains,
    snippetMatches: definition.snippetMatches,
  };
}

/**
 * Test helper to execute and validate a test case
 */
async function runTestCase(testCase: MilkTeaTestCase) {
  console.log('Running test case:', testCase.request.userRequest);

  // Execute Milk Tea agent
  const result = await runMilkTea(testCase.request, {
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
    [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
  });

  console.log('Milk Tea result:', JSON.stringify(result, null, 2));

  // Validate basic fields
  expect(result.success).toBe(true);
  expect(result.type).toBe('code');
  expect(result.snippet).toBeDefined();

  if (result.type === 'code' && result.snippet) {
    // Validate snippet contains expected strings
    for (const text of testCase.snippetContains) {
      expect(result.snippet).toContain(text);
    }

    // Validate snippet matches expected patterns
    for (const pattern of testCase.snippetMatches) {
      expect(result.snippet).toMatch(pattern);
    }
  }

  // Wait for logger to upload logs before test ends
  console.log('Waiting for logger to finish uploading logs...');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('Logger upload complete, test ending');
}

// ============================================================================
// TEST CASE DEFINITIONS
// Add new test cases here
// ============================================================================

async function createEmailWaitlistTestCase(): Promise<MilkTeaTestCaseDefinition> {
  return {
    request: {
      userRequest:
        'I want to send emails to all waitlist users. The email should have subject "Welcome!" and body "Thank you for joining our waitlist."',
      bubbleName: 'resend',
      bubbleSchema: await getBubbleSchema('resend'),
      currentCode: `import {
  BubbleFlow,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  input: string;
}

export class EmailWaitlistFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const waitlistUsers = [
      { email: 'user1@example.com', name: 'Alice' },
      { email: 'user2@example.com', name: 'Bob' },
    ];

    // INSERT_LOCATION

    return {
      message: \`Sent emails to \${waitlistUsers.length} users\`,
    };
  }
}`,
      insertLocation: '// INSERT_LOCATION',
      availableCredentials: [CredentialType.RESEND_CRED],
      userName: 'Test User',
      conversationHistory: [],
    },
    snippetContains: ['ResendBubble', '.action()'],
    snippetMatches: [/waitlistUsers/i],
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Milk Tea AI Agent', () => {
  beforeAll(async () => {
    const bubblesJsonPath = join(__dirname, 'bubbles.json');
    const bubblesJson = await readFile(bubblesJsonPath, 'utf-8');
    bubbleDefinitions = JSON.parse(bubblesJson);
  });

  it('should generate code snippet for sending emails to waitlist users with Gemini 2.5 Pro', async () => {
    const testCase = await createEmailWaitlistTestCase();
    await runTestCase(createTestCase(testCase, 'google/gemini-2.5-pro'));
  }, 60000);

  it('should generate code snippet for sending emails to waitlist users with GPT-5', async () => {
    const testCase = await createEmailWaitlistTestCase();
    await runTestCase(createTestCase(testCase, 'openai/gpt-5'));
  }, 60000);
});
