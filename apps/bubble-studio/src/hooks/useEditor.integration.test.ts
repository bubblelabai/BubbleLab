import { describe, it, expect } from 'vitest';
import type {
  ValidateBubbleFlowResponse,
  ParsedBubbleWithInfo,
  BubbleParameter,
} from '@bubblelab/shared-schemas';
import {
  updateBubbleParamInCode,
  updateCachedBubbleParameters,
  extractParamValue,
} from '../utils/bubbleParamEditor';
import { BubbleParameterType } from '@bubblelab/shared-schemas';

const API_BASE_URL =
  process.env.VITE_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:3001';

async function validateCode(code: string): Promise<ValidateBubbleFlowResponse> {
  const response = await fetch(`${API_BASE_URL}/bubble-flow/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, options: { includeDetails: true } }),
  });
  return response.json();
}

/**
 * Helper function for testing bubble param updates.
 * Validates that updateBubbleParamInCode successfully updates the code
 * and verifies the expected content changes.
 * Returns the updated code on success.
 */
function testBubbleParamUpdate(opts: {
  code: string;
  bubbleParameters: Record<string, ParsedBubbleWithInfo>;
  variableName: string;
  paramPath: string;
  newValue: unknown;
  shouldContain: string[];
  shouldNotContain: string[];
}): string | undefined {
  // Find the bubble by variableName to get its variableId
  const bubble = Object.values(opts.bubbleParameters).find(
    (b) => b.variableName === opts.variableName
  );
  if (!bubble) {
    throw new Error(`Bubble not found: ${opts.variableName}`);
  }

  const result = updateBubbleParamInCode(
    opts.code,
    opts.bubbleParameters,
    bubble.variableId,
    opts.paramPath,
    opts.newValue
  );

  console.log(`[Test] Update result for ${opts.paramPath}:`, result);
  if (result.success) {
    console.log('[Test] Updated code:', result.code);
  }

  expect(result.success).toBe(true);
  if (result.success) {
    for (const expected of opts.shouldContain) {
      expect(result.code).toContain(expected);
    }
    for (const notExpected of opts.shouldNotContain) {
      expect(result.code).not.toContain(notExpected);
    }
    return result.code;
  }
  return undefined;
}

/**
 * Helper function for testing bubble param updates WITH cache updates.
 * This simulates the actual editor behavior where bubbleParameters cache
 * is updated after each edit.
 * Returns the updated code and updated bubbleParameters on success.
 */
function testBubbleParamUpdateWithCache(opts: {
  code: string;
  bubbleParameters: Record<string, ParsedBubbleWithInfo>;
  variableName: string;
  paramPath: string;
  newValue: unknown;
  shouldContain: string[];
  shouldNotContain: string[];
}):
  | { code: string; bubbleParameters: Record<string, ParsedBubbleWithInfo> }
  | undefined {
  // Find the bubble by variableName to get its variableId
  const bubble = Object.values(opts.bubbleParameters).find(
    (b) => b.variableName === opts.variableName
  );
  if (!bubble) {
    throw new Error(`Bubble not found: ${opts.variableName}`);
  }

  const result = updateBubbleParamInCode(
    opts.code,
    opts.bubbleParameters,
    bubble.variableId,
    opts.paramPath,
    opts.newValue
  );

  console.log(`[Test] Update result for ${opts.paramPath}:`, result);
  if (result.success) {
    console.log('[Test] Updated code:', result.code);
  }

  expect(result.success).toBe(true);
  if (result.success) {
    for (const expected of opts.shouldContain) {
      expect(result.code).toContain(expected);
    }
    for (const notExpected of opts.shouldNotContain) {
      expect(result.code).not.toContain(notExpected);
    }

    // Update the cached bubble parameters (same logic as useEditor.ts)
    const updatedBubbleParameters = updateCachedBubbleParameters(
      opts.bubbleParameters,
      result.relatedVariableIds,
      opts.paramPath,
      opts.newValue,
      result.isTemplateLiteral,
      result.lineDiff,
      result.editedBubbleEndLine
    );

    console.log(
      '[Test] Updated bubbleParameters:',
      JSON.stringify(updatedBubbleParameters, null, 2)
    );

    return { code: result.code, bubbleParameters: updatedBubbleParameters };
  }
  return undefined;
}

/**
 * Helper function for testing bubble param updates via API validation.
 * First validates the code to get parsed bubble parameters, then tests the update.
 * Returns the updated code on success.
 */
async function testBubbleParamUpdateWithValidation(opts: {
  code: string;
  variableName: string;
  paramPath: string;
  newValue: unknown;
  shouldContain: string[];
  shouldNotContain: string[];
}): Promise<string | undefined> {
  const originalValidation = await validateCode(opts.code);

  console.log(
    '[Test] Original validation:',
    JSON.stringify(originalValidation, null, 2)
  );

  if (!originalValidation.valid) {
    console.log('[Test] Validation errors:', originalValidation.errors);
    // Skip if validation fails
    return undefined;
  }

  expect(originalValidation.bubbles).toBeDefined();

  const bubbleParameters = originalValidation.bubbles as Record<
    string,
    ParsedBubbleWithInfo
  >;

  const bubble = Object.values(bubbleParameters).find(
    (b) => b.variableName === opts.variableName
  );
  expect(bubble).toBeDefined();

  const baseParamName = opts.paramPath.split('.')[0];
  const param = bubble?.parameters.find((p) => p.name === baseParamName);
  console.log(`[Test] ${opts.paramPath} param:`, param);

  return testBubbleParamUpdate({
    code: opts.code,
    bubbleParameters,
    variableName: opts.variableName,
    paramPath: opts.paramPath,
    newValue: opts.newValue,
    shouldContain: opts.shouldContain,
    shouldNotContain: opts.shouldNotContain,
  });
}

// cspell:disable
describe('updateBubbleParam', () => {
  const NORMAL_SYSTEM_PROMPT_CODE = `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;

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
}`;

  const TEMPLATE_STRING_SYSTEM_PROMPT = `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;

    const aiModel = 'google/gemini-3-flash-preview'
    const aiPrompt = "HIHIHHI"
    // Simple AI agent that responds to user queries with web search
    const agent = new AIAgentBubble({
      message: \`\\nMessage\`,
      model :{
        model: aiModel,
        temperature: 0.6
      },
      systemPrompt: \`Hello i am model \${aiModel} with prompt \${aiPrompt}\`,
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
}`;
  // cspell:enable

  it('should update normal systemPrompt and produce valid code', async () => {
    await testBubbleParamUpdateWithValidation({
      code: NORMAL_SYSTEM_PROMPT_CODE,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'You are a coding assistant.',
      shouldContain: ['You are a coding assistant.'],
      shouldNotContain: ['You are a helpful assistant.'],
    });
  });

  it('should update message with escaped newline and produce valid code', async () => {
    // This test simulates the actual frontend behavior:
    // 1. API returns param.value from source code
    // 2. extractParamValue processes it → displays value to user
    // 3. User modifies the displayed value (appending/changing text)
    // 4. updateBubbleParamInCode produces new code
    // 5. Repeat - second update uses displayed value from step 2 on the updated code
    //
    // All updates derive their values from what the frontend would display,
    // maximizing simulation of real frontend behavior.

    // First, validate the original code to get bubble parameters
    const originalValidation = await validateCode(
      TEMPLATE_STRING_SYSTEM_PROMPT
    );
    expect(originalValidation.valid).toBe(true);
    expect(originalValidation.bubbles).toBeDefined();

    let currentCode = TEMPLATE_STRING_SYSTEM_PROMPT;
    let bubbleParameters = originalValidation.bubbles as Record<
      string,
      ParsedBubbleWithInfo
    >;

    // Get the message param and extract the displayed value (simulating frontend)
    let bubble = Object.values(bubbleParameters).find(
      (b) => b.variableName === 'agent'
    );
    expect(bubble).toBeDefined();
    let messageParam = bubble?.parameters.find((p) => p.name === 'message');
    expect(messageParam).toBeDefined();

    // This is what the frontend displays to the user (after stripping backticks)
    let displayedValue = extractParamValue(messageParam, 'message');
    console.log(
      '[Test] Initial displayed value to user:',
      displayedValue?.value
    );
    expect(displayedValue?.value).toBe('\\nMessage'); // backslash-n-Message

    // FIRST UPDATE: User appends ' hi' to the displayed value
    const firstUpdateValue = displayedValue?.value + ' hi';
    console.log('[Test] First update - user changes to:', firstUpdateValue);

    const firstResult = updateBubbleParamInCode(
      currentCode,
      bubbleParameters,
      bubble!.variableId,
      'message',
      firstUpdateValue
    );
    expect(firstResult.success).toBe(true);
    if (!firstResult.success) return;

    console.log('[Test] First update result code snippet:');
    console.log(firstResult.code.substring(0, 500));

    // Validate the updated code to get new bubble parameters for second update
    const firstValidation = await validateCode(firstResult.code);
    expect(firstValidation.valid).toBe(true);
    expect(firstValidation.bubbles).toBeDefined();

    currentCode = firstResult.code;
    bubbleParameters = firstValidation.bubbles as Record<
      string,
      ParsedBubbleWithInfo
    >;

    // Get the new displayed value (simulating what frontend shows after first update)
    bubble = Object.values(bubbleParameters).find(
      (b) => b.variableName === 'agent'
    );
    messageParam = bubble?.parameters.find((p) => p.name === 'message');
    displayedValue = extractParamValue(messageParam, 'message');
    console.log(
      '[Test] After first update, displayed value:',
      displayedValue?.value
    );
    expect(displayedValue?.value).toBe('\\nMessage hi');

    // SECOND UPDATE: User modifies the displayed value (replacing ' hi' with ' updated')
    const secondUpdateValue = (displayedValue?.value as string).replace(
      ' hi',
      ' updated'
    );
    console.log('[Test] Second update - user changes to:', secondUpdateValue);

    const secondResult = updateBubbleParamInCode(
      currentCode,
      bubbleParameters,
      bubble!.variableId,
      'message',
      secondUpdateValue
    );
    expect(secondResult.success).toBe(true);
    if (!secondResult.success) return;

    console.log('[Test] Second update result code snippet:');
    console.log(secondResult.code.substring(0, 500));

    // Verify the final code is valid
    const finalValidation = await validateCode(secondResult.code);
    console.log('[Test] Final validation:', finalValidation.valid);
    expect(finalValidation.valid).toBe(true);

    // Verify the final displayed value
    const finalBubbleParameters = finalValidation.bubbles as Record<
      string,
      ParsedBubbleWithInfo
    >;
    const finalBubble = Object.values(finalBubbleParameters).find(
      (b) => b.variableName === 'agent'
    );
    const finalMessageParam = finalBubble?.parameters.find(
      (p) => p.name === 'message'
    );
    const finalDisplayedValue = extractParamValue(finalMessageParam, 'message');
    console.log('[Test] Final displayed value:', finalDisplayedValue?.value);
    expect(finalDisplayedValue?.value).toBe('\\nMessage updated');
  });

  it('should update template string systemPrompt and produce valid code', async () => {
    // First validate to check extractParamValue behavior
    const originalValidation = await validateCode(
      TEMPLATE_STRING_SYSTEM_PROMPT
    );
    console.log(originalValidation.error);
    expect(originalValidation.valid).toBe(true);
    expect(originalValidation.bubbles).toBeDefined();

    const bubbleParameters = originalValidation.bubbles || {};
    const systemPromptParam = Object.values(bubbleParameters)
      .find((b) => b.variableName === 'agent')
      ?.parameters.find((p) => p.name === 'systemPrompt');
    const extractedParam = extractParamValue(systemPromptParam, 'systemPrompt');
    expect(extractedParam?.value).toBe(
      'Hello i am model ${aiModel} with prompt ${aiPrompt}'
    );
    expect(extractedParam?.shouldBeEditable).toBe(true);
    expect(extractedParam?.type).toBe(BubbleParameterType.STRING);

    // Then test the update
    await testBubbleParamUpdateWithValidation({
      code: TEMPLATE_STRING_SYSTEM_PROMPT,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'You are a coding assistant.',
      shouldContain: ['You are a coding assistant.'],
      shouldNotContain: ['Hello i am model'],
    });
  });
}, 50000);

describe('extractModelValue', () => {
  it('should extract model from string representation', () => {
    const modelParam: BubbleParameter = {
      name: 'model',
      value: "{\n        model: 'google/gemini-2.5-pro'\n      }",
      type: BubbleParameterType.OBJECT,
      location: {
        startLine: 18,
        startCol: 13,
        endLine: 20,
        endCol: 7,
      },
      source: 'object-property',
    };

    const result = extractParamValue(modelParam, 'model.model', 'ai-agent');
    expect(result?.value).toBe('google/gemini-2.5-pro');
  });
  it('should return undefined when param is invalid', () => {
    const result = extractParamValue(
      {
        name: 'model',
        value: '{ model: "random string" }',
        type: BubbleParameterType.STRING,
      },
      'model.model',
      'ai-agent'
    );
    expect(result?.value).toBe('random string');
    expect(result?.shouldBeEditable).toBe(false);
    expect(result?.type).toBe(BubbleParameterType.STRING);
  });
  it('should return undefined when model.model param is a variable', () => {
    const modelParam: BubbleParameter = {
      name: 'model',
      value: '{\n        model: aiModel,\n        temperature: 0.6\n      }',
      type: BubbleParameterType.OBJECT,
      location: {
        startLine: 19,
        startCol: 13,
        endLine: 22,
        endCol: 7,
      },
      source: 'object-property',
    };
    const result = extractParamValue(modelParam, 'model.model');
    expect(result?.value).toBe(undefined);
  });
  it('should return undefined when systemPrompt param is a variable', () => {
    const modelParam: BubbleParameter = {
      name: 'systemPrompt',
      value: 'systemPrompt',
      type: BubbleParameterType.VARIABLE,
    };
    const result = extractParamValue(modelParam, 'systemPrompt');
    expect(result?.value).toBe('systemPrompt');
    expect(result?.shouldBeEditable).toBe(false);
    expect(result?.type).toBe(BubbleParameterType.VARIABLE);
  });
});

describe('getNestedParamValue', () => {
  it('should get nested value from string representation', () => {
    const modelParam: BubbleParameter = {
      name: 'model',
      value: "{\n        model: 'google/gemini-2.5-pro'\n      }",
      type: BubbleParameterType.OBJECT,
    };

    const result = extractParamValue(modelParam, 'model.model');
    expect(result?.value).toBe('google/gemini-2.5-pro');
  });

  it('should get direct value for non-nested path', () => {
    const systemPromptParam: BubbleParameter = {
      name: 'systemPrompt',
      value: 'You are a helpful assistant.',
      type: BubbleParameterType.STRING,
    };

    const result = extractParamValue(systemPromptParam, 'systemPrompt');
    expect(result?.value).toBe('You are a helpful assistant.');
  });
});

describe('updateBubbleParamInCode with model.model', () => {
  const CODE_WITH_MODEL = `const agent = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash'
      },
      systemPrompt: 'You are helpful.',
    });`;

  it('should update model.model value', () => {
    testBubbleParamUpdate({
      code: CODE_WITH_MODEL,
      bubbleParameters: {
        agent: {
          variableId: 1,
          variableName: 'agent',
          bubbleName: 'ai-agent',
          className: 'AIAgentBubble',
          nodeType: 'service',
          location: { startLine: 1, startCol: 1, endLine: 6, endCol: 6 },
          parameters: [
            {
              name: 'model',
              value: "{\n        model: 'google/gemini-2.5-flash'\n      }",
              type: BubbleParameterType.OBJECT,
            },
            {
              name: 'systemPrompt',
              value: 'You are helpful.',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      },
      variableName: 'agent',
      paramPath: 'model.model',
      newValue: 'google/gemini-3-pro-preview',
      shouldContain: ["'google/gemini-3-pro-preview'"],
      shouldNotContain: ["'google/gemini-2.5-flash'"],
    });
  });
});

describe('updateBubbleParamInCode with multi-line template literal systemPrompt', () => {
  // This tests the LinkedIn analyzer scenario with multi-line template literal containing ${} interpolation
  // cspell:disable
  const MULTILINE_TEMPLATE_CODE = `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';
import { z } from 'zod';

export interface LinkedInPayload extends WebhookEvent {
  content: string;
}

export class LinkedInAnalyzerFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: LinkedInPayload) {
    const { content } = payload;

    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: \`You are a LinkedIn content analyzer.
      Your job is to determine if the provided markdown content is a valid LinkedIn post or a login/auth wall.

      Indicators of a Login Wall:
      - "Sign In", "Join now", "authwall"
      - "Page not found" or generic LinkedIn footer links only
      - Lack of specific post content or author details

      If it is a valid post, extract the author's full name and their profile URL.\`,
      message: \`Analyze this content:\n\n\${content.substring(0, 15000)}\`,
      expectedOutputSchema: z.object({
        isLoginWall: z.boolean().describe("True if the content is a login screen, auth wall, or error page."),
        authorName: z.string().nullable().describe("The full name of the post author."),
        authorProfileUrl: z.string().nullable().describe("The URL to the author's profile.")
      })
    });

    const result = await agent.action();
    return result.data;
  }
}`;
  // cspell:enable

  const MULTILINE_SYSTEM_PROMPT_VALUE = `You are a LinkedIn content analyzer.
      Your job is to determine if the provided markdown content is a valid LinkedIn post or a login/auth wall.

      Indicators of a Login Wall:
      - "Sign In", "Join now", "authwall"
      - "Page not found" or generic LinkedIn footer links only
      - Lack of specific post content or author details

      If it is a valid post, extract the author's full name and their profile URL.`;

  it('should update multi-line template literal systemPrompt', () => {
    // Line numbers updated for the interface definition (4 extra lines)
    testBubbleParamUpdate({
      code: MULTILINE_TEMPLATE_CODE,
      bubbleParameters: {
        agent: {
          variableId: 1,
          variableName: 'agent',
          bubbleName: 'ai-agent',
          className: 'AIAgentBubble',
          nodeType: 'service',
          location: { startLine: 12, startCol: 5, endLine: 29, endCol: 6 },
          parameters: [
            {
              name: 'model',
              value: "{ model: 'google/gemini-2.5-flash' }",
              type: BubbleParameterType.OBJECT,
            },
            {
              name: 'systemPrompt',
              // Note: The parser stores the value WITH the backticks for template literals
              value: '`' + MULTILINE_SYSTEM_PROMPT_VALUE + '`',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'message',
              value:
                '`Analyze this content:\n\n${content.substring(0, 15000)}`',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      },
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'You are a simple content analyzer.',
      shouldContain: ['You are a simple content analyzer.'],
      shouldNotContain: ['LinkedIn content analyzer'],
    });
  });

  it('should handle systemPrompt update via API validation and allow subsequent updates', async () => {
    // First update
    const updatedCode = await testBubbleParamUpdateWithValidation({
      code: MULTILINE_TEMPLATE_CODE,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'You are a simple content analyzer.',
      shouldContain: ['You are a simple content analyzer.'],
      shouldNotContain: ['LinkedIn content analyzer'],
    });

    expect(updatedCode).toBeDefined();
    if (!updatedCode) return;

    // Second update on the already-updated code
    const secondUpdatedCode = await testBubbleParamUpdateWithValidation({
      code: updatedCode,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'You are an expert data analyst.',
      shouldContain: ['You are an expert data analyst.'],
      shouldNotContain: ['simple content analyzer'],
    });

    expect(secondUpdatedCode).toBeDefined();

    // Validate the final code is still valid
    if (secondUpdatedCode) {
      const finalValidation = await validateCode(secondUpdatedCode);
      console.log(
        '[Test] Final validation after 2 updates:',
        finalValidation.valid
      );
      expect(finalValidation.valid).toBe(true);
    }
  }, 30000);

  it('should allow consecutive updates using cached bubbleParameters (simulating editor behavior)', () => {
    // This test simulates the actual editor behavior where:
    // 1. First update is made
    // 2. bubbleParameters cache is updated (not re-fetched from server)
    // 3. Second update uses the cached bubbleParameters
    //
    // This is the scenario where the bug occurs if template literal format is not preserved in cache.
    //
    // Note: We use single-line template literals here to avoid line count changes
    // that would invalidate the cached location. The multi-line case is tested
    // via API validation which refreshes locations.

    const SINGLE_LINE_TEMPLATE_CODE = `const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: \`Hello user \${username}\`,
    });`;

    const initialBubbleParameters: Record<string, ParsedBubbleWithInfo> = {
      agent: {
        variableId: 1,
        variableName: 'agent',
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        nodeType: 'service',
        location: { startLine: 1, startCol: 1, endLine: 4, endCol: 6 },
        parameters: [
          {
            name: 'model',
            value: "{ model: 'google/gemini-2.5-flash' }",
            type: BubbleParameterType.OBJECT,
          },
          {
            name: 'systemPrompt',
            // Template literal with interpolation
            value: '`Hello user ${username}`',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: true,
        hasActionCall: true,
      },
    };

    // First update - should succeed and preserve template literal format
    const firstResult = testBubbleParamUpdateWithCache({
      code: SINGLE_LINE_TEMPLATE_CODE,
      bubbleParameters: initialBubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      // Note: New value still contains ${} so it stays as template literal in code
      newValue: 'Welcome ${username}!',
      shouldContain: ['Welcome ${username}!'],
      shouldNotContain: ['Hello user'],
    });

    expect(firstResult).toBeDefined();
    if (!firstResult) return;

    // Verify the cached value has backticks preserved
    const cachedParam = firstResult.bubbleParameters['agent']?.parameters.find(
      (p) => p.name === 'systemPrompt'
    );
    console.log(
      '[Test] Cached systemPrompt after first update:',
      cachedParam?.value
    );
    expect(cachedParam?.value).toBe('`Welcome ${username}!`'); // Should have backticks

    // Second update using CACHED bubbleParameters - this should also succeed
    const secondResult = testBubbleParamUpdateWithCache({
      code: firstResult.code,
      bubbleParameters: firstResult.bubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'Greetings ${username}!',
      shouldContain: ['Greetings ${username}!'],
      shouldNotContain: ['Welcome'],
    });

    expect(secondResult).toBeDefined();
    if (!secondResult) return;

    // Verify second cached value also has backticks
    const cachedParam2 = secondResult.bubbleParameters[
      'agent'
    ]?.parameters.find((p) => p.name === 'systemPrompt');
    console.log(
      '[Test] Cached systemPrompt after second update:',
      cachedParam2?.value
    );
    expect(cachedParam2?.value).toBe('`Greetings ${username}!`');

    // Third update to ensure it keeps working
    const thirdResult = testBubbleParamUpdateWithCache({
      code: secondResult.code,
      bubbleParameters: secondResult.bubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'Final message ${username}!',
      shouldContain: ['Final message ${username}!'],
      shouldNotContain: ['Greetings'],
    });

    expect(thirdResult).toBeDefined();
    if (!thirdResult) return;

    // Verify third cached value also has backticks
    const cachedParam3 = thirdResult.bubbleParameters['agent']?.parameters.find(
      (p) => p.name === 'systemPrompt'
    );
    expect(cachedParam3?.value).toBe('`Final message ${username}!`');
  });
});

describe('updateBubbleParamInCode with line shift handling', () => {
  // This tests the scenario where a multi-line value is replaced with a single-line value
  // The line numbers should be adjusted so subsequent edits still work

  // Code with two bubbles: agent1 (multi-line systemPrompt) and agent2 (after agent1)
  const CODE_WITH_TWO_BUBBLES = `const agent1 = new AIAgentBubble({
  systemPrompt: \`Line1
Line2
Line3\`,
});

const agent2 = new AIAgentBubble({
  systemPrompt: 'I am agent2',
});`;

  it('should adjust line numbers when multi-line value becomes single-line', () => {
    const initialBubbleParameters: Record<string, ParsedBubbleWithInfo> = {
      agent1: {
        variableId: 1,
        variableName: 'agent1',
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        nodeType: 'service',
        // agent1 spans lines 1-5 (the multi-line template takes 4 lines + closing)
        location: { startLine: 1, startCol: 1, endLine: 5, endCol: 3 },
        parameters: [
          {
            name: 'systemPrompt',
            value: '`Line1\nLine2\nLine3`',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: false,
        hasActionCall: false,
      },
      agent2: {
        variableId: 2,
        variableName: 'agent2',
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        nodeType: 'service',
        // agent2 starts at line 7 (after blank line 6)
        location: { startLine: 7, startCol: 1, endLine: 9, endCol: 3 },
        parameters: [
          {
            name: 'systemPrompt',
            // Note: value is the raw content, serialization adds quotes
            value: 'I am agent2',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: false,
        hasActionCall: false,
      },
    };

    // First update: replace agent1's 3-line value with 1-line value (-2 lines)
    const firstResult = testBubbleParamUpdateWithCache({
      code: CODE_WITH_TWO_BUBBLES,
      bubbleParameters: initialBubbleParameters,
      variableName: 'agent1',
      paramPath: 'systemPrompt',
      newValue: 'Single line prompt',
      shouldContain: ['Single line prompt'],
      shouldNotContain: ['Line1', 'Line2', 'Line3'],
    });

    expect(firstResult).toBeDefined();
    if (!firstResult) return;

    // Verify agent1's location was updated (endLine reduced by 2)
    const agent1Location = firstResult.bubbleParameters['agent1']?.location;
    console.log('[Test] agent1 location after first update:', agent1Location);
    expect(agent1Location?.endLine).toBe(3); // Was 5, now 5 - 2 = 3

    // Verify agent2's location was shifted up by 2 lines
    const agent2Location = firstResult.bubbleParameters['agent2']?.location;
    console.log('[Test] agent2 location after first update:', agent2Location);
    expect(agent2Location?.startLine).toBe(5); // Was 7, now 7 - 2 = 5
    expect(agent2Location?.endLine).toBe(7); // Was 9, now 9 - 2 = 7

    // Second update: edit agent2's systemPrompt using the updated locations
    const secondResult = testBubbleParamUpdateWithCache({
      code: firstResult.code,
      bubbleParameters: firstResult.bubbleParameters,
      variableName: 'agent2',
      paramPath: 'systemPrompt',
      newValue: 'Updated agent2 prompt',
      shouldContain: ['Updated agent2 prompt'],
      shouldNotContain: ['I am agent2'],
    });

    expect(secondResult).toBeDefined();
    if (!secondResult) return;

    // Verify both updates are in the final code
    expect(secondResult.code).toContain('Single line prompt');
    expect(secondResult.code).toContain('Updated agent2 prompt');
    expect(secondResult.code).not.toContain('Line1');
    expect(secondResult.code).not.toContain('I am agent2');
  });

  it('should handle line expansion (single-line to multi-line)', () => {
    const CODE_SINGLE_LINE = `const agent1 = new AIAgentBubble({
  systemPrompt: \`Short\`,
});

const agent2 = new AIAgentBubble({
  systemPrompt: 'I am agent2',
});`;

    const initialBubbleParameters: Record<string, ParsedBubbleWithInfo> = {
      agent1: {
        variableId: 1,
        variableName: 'agent1',
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        nodeType: 'service',
        location: { startLine: 1, startCol: 1, endLine: 3, endCol: 3 },
        parameters: [
          {
            name: 'systemPrompt',
            value: '`Short`',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: false,
        hasActionCall: false,
      },
      agent2: {
        variableId: 2,
        variableName: 'agent2',
        bubbleName: 'ai-agent',
        className: 'AIAgentBubble',
        nodeType: 'service',
        location: { startLine: 5, startCol: 1, endLine: 7, endCol: 3 },
        parameters: [
          {
            name: 'systemPrompt',
            // Note: value is the raw content, serialization adds quotes
            value: 'I am agent2',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: false,
        hasActionCall: false,
      },
    };

    // Replace single-line with multi-line (+2 lines)
    const result = testBubbleParamUpdateWithCache({
      code: CODE_SINGLE_LINE,
      bubbleParameters: initialBubbleParameters,
      variableName: 'agent1',
      paramPath: 'systemPrompt',
      newValue: 'Line1\nLine2\nLine3',
      shouldContain: ['Line1', 'Line2', 'Line3'],
      shouldNotContain: ['Short'],
    });

    expect(result).toBeDefined();
    if (!result) return;

    // Verify agent1's endLine increased by 2
    const agent1Location = result.bubbleParameters['agent1']?.location;
    expect(agent1Location?.endLine).toBe(5); // Was 3, now 3 + 2 = 5

    // Verify agent2's location shifted down by 2
    const agent2Location = result.bubbleParameters['agent2']?.location;
    expect(agent2Location?.startLine).toBe(7); // Was 5, now 5 + 2 = 7
    expect(agent2Location?.endLine).toBe(9); // Was 7, now 7 + 2 = 9

    // Verify agent2 can still be edited with updated location
    const secondResult = testBubbleParamUpdateWithCache({
      code: result.code,
      bubbleParameters: result.bubbleParameters,
      variableName: 'agent2',
      paramPath: 'systemPrompt',
      newValue: 'Agent2 still works!',
      shouldContain: ['Agent2 still works!'],
      shouldNotContain: ['I am agent2'],
    });

    expect(secondResult).toBeDefined();
  });
});
