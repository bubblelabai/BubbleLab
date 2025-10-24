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
}

/**
 * Test case for rejection scenarios
 */
interface PearlRejectTestCase {
  request: PearlRequest;
  expectedType: 'reject' | 'question';
  messageContains?: string[];
}

/**
 * Test case definition (without model specified)
 */
interface PearlTestCaseDefinition {
  request: Omit<PearlRequest, 'model'>;
  snippetContains: string[];
  snippetMatches: RegExp[];
}

/**
 * Reject test case definition (without model specified)
 */
interface PearlRejectTestCaseDefinition {
  request: Omit<PearlRequest, 'model'>;
  expectedType: 'reject' | 'question';
  messageContains?: string[];
}

/**
 * Helper to create a test case from a definition with a specific model
 */
function createTestCase(
  definition: PearlTestCaseDefinition,
  model: AvailableModel
): PearlTestCase {
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

/**
 * Helper to create a reject test case from a definition with a specific model
 */
function createRejectTestCase(
  definition: PearlRejectTestCaseDefinition,
  model: AvailableModel
): PearlRejectTestCase {
  return {
    request: {
      ...definition.request,
      model,
    },
    expectedType: definition.expectedType,
    messageContains: definition.messageContains,
  };
}

/**
 * Test helper to execute and validate a reject/question test case
 */
async function runRejectTestCase(testCase: PearlRejectTestCase) {
  console.log('Running reject test case:', testCase.request.userRequest);

  // Execute Pearl agent
  const result = await runPearl(testCase.request, {
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
    [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
    [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
  });

  console.log('Pearl result:', JSON.stringify(result, null, 2));

  // Validate basic fields
  expect(result.success).toBe(true);
  expect(result.type).toBe(testCase.expectedType);
  expect(result.message).toBeDefined();

  // Validate message contains expected strings
  if (testCase.messageContains) {
    for (const text of testCase.messageContains) {
      expect(result.message).toContain(text);
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

/**
 * Simple test case: Generate a basic workflow that sends an email
 */
function createSimpleEmailWorkflowTestCase(): PearlTestCaseDefinition {
  // Get boiler plate
  return {
    request: {
      availableVariables: [],
      userRequest:
        'Create a workflow that sends an email to user@example.com with subject "Hello" and body "Welcome to our platform!"',
      userName: 'Test User',
      conversationHistory: [],
    },
    snippetContains: [
      'BubbleFlow',
      'user@example.com',
      'Hello',
      'Welcome to our platform!',
    ],
    snippetMatches: [/class.*extends BubbleFlow/i, /async handle/i],
  };
}

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
    const testCase = createSimpleEmailWorkflowTestCase();
    await runTestCase(createTestCase(testCase, 'openrouter/z-ai/glm-4.6'));
  }, 60000);
});
