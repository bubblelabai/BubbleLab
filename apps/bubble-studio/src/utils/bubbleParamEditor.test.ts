import { describe, it, expect } from 'vitest';
import type {
  ParsedBubbleWithInfo,
  BubbleParameter,
} from '@bubblelab/shared-schemas';
import {
  updateBubbleParamInCode,
  updateCachedBubbleParameters,
  extractParamValue,
} from './bubbleParamEditor';
import { BubbleParameterType } from '@bubblelab/shared-schemas';

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
      result.editedBubbleEndLine,
      result.editedParamEndLine
    );

    console.log(
      '[Test] Updated bubbleParameters:',
      JSON.stringify(updatedBubbleParameters, null, 2)
    );

    return { code: result.code, bubbleParameters: updatedBubbleParameters };
  }
  return undefined;
}

describe('extractParamValue', () => {
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

    const result = extractParamValue(modelParam, 'model.model');
    expect(result?.value).toBe('google/gemini-2.5-pro');
  });

  it('should return shouldBeEditable=false when model is not in AvailableModels', () => {
    const result = extractParamValue(
      {
        name: 'model',
        value: '{ model: "random string" }',
        type: BubbleParameterType.STRING,
      },
      'model.model'
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

  it('should return shouldBeEditable=false when systemPrompt param is a variable', () => {
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

describe('updateBubbleParamInCode with multi-line template literal', () => {
  it('should update multi-line template literal systemPrompt', () => {
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

    const MULTILINE_SYSTEM_PROMPT_VALUE = `You are a LinkedIn content analyzer.
      Your job is to determine if the provided markdown content is a valid LinkedIn post or a login/auth wall.

      Indicators of a Login Wall:
      - "Sign In", "Join now", "authwall"
      - "Page not found" or generic LinkedIn footer links only
      - Lack of specific post content or author details

      If it is a valid post, extract the author's full name and their profile URL.`;
    // cspell:enable

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

  it('should allow consecutive updates using cached bubbleParameters', () => {
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
            value: '`Hello user ${username}`',
            type: BubbleParameterType.STRING,
          },
        ],
        hasAwait: true,
        hasActionCall: true,
      },
    };

    // First update
    const firstResult = testBubbleParamUpdateWithCache({
      code: SINGLE_LINE_TEMPLATE_CODE,
      bubbleParameters: initialBubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'Welcome ${username}!',
      shouldContain: ['Welcome ${username}!'],
      shouldNotContain: ['Hello user'],
    });

    expect(firstResult).toBeDefined();
    if (!firstResult) return;

    // Verify backticks preserved in cache
    const cachedParam = firstResult.bubbleParameters['agent']?.parameters.find(
      (p) => p.name === 'systemPrompt'
    );
    expect(cachedParam?.value).toBe('`Welcome ${username}!`');

    // Second update using cached parameters
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

    const cachedParam2 = secondResult.bubbleParameters[
      'agent'
    ]?.parameters.find((p) => p.name === 'systemPrompt');
    expect(cachedParam2?.value).toBe('`Greetings ${username}!`');
  });
});

describe('updateBubbleParamInCode with line shift handling', () => {
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
        location: { startLine: 7, startCol: 1, endLine: 9, endCol: 3 },
        parameters: [
          {
            name: 'systemPrompt',
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
    expect(firstResult.bubbleParameters['agent1']?.location.endLine).toBe(3);

    // Verify agent2's location was shifted up by 2 lines
    expect(firstResult.bubbleParameters['agent2']?.location.startLine).toBe(5);
    expect(firstResult.bubbleParameters['agent2']?.location.endLine).toBe(7);

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
    expect(result.bubbleParameters['agent1']?.location.endLine).toBe(5);

    // Verify agent2's location shifted down by 2
    expect(result.bubbleParameters['agent2']?.location.startLine).toBe(7);
    expect(result.bubbleParameters['agent2']?.location.endLine).toBe(9);
  });
});

describe('updateBubbleParamInCode with real parser output', () => {
  // This test uses actual bubble data from the parser to ensure compatibility
  // cspell:disable
  const REAL_CODE = `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

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
      systemPrompt: \`Hello
\`,
      model: {
        model: 'openrouter/z-ai/glm-4.6',
        temperature: 0.6
      },
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

  // Real bubble parameters from the parser (as provided by user)
  const realBubbleParameters: Record<string, ParsedBubbleWithInfo> = {
    '414': {
      variableId: 414,
      variableName: 'agent',
      bubbleName: 'ai-agent',
      className: 'AIAgentBubble',
      parameters: [
        {
          name: 'message',
          value: 'query',
          type: BubbleParameterType.VARIABLE,
          location: {
            startLine: 17,
            startCol: 15,
            endLine: 17,
            endCol: 20,
          },
          source: 'object-property',
        },
        {
          name: 'systemPrompt',
          value: '`Hello\n`',
          type: BubbleParameterType.STRING,
          location: {
            startLine: 18,
            startCol: 20,
            endLine: 19,
            endCol: 1,
          },
          source: 'object-property',
        },
        {
          name: 'model',
          value:
            "{\n        model: 'openrouter/z-ai/glm-4.6',\n        temperature: 0.6\n      }",
          type: BubbleParameterType.OBJECT,
          location: {
            startLine: 20,
            startCol: 13,
            endLine: 23,
            endCol: 7,
          },
          source: 'object-property',
        },
        {
          name: 'tools',
          value:
            "[\n        {\n          name: 'web-search-tool',\n          config: {\n            limit: 1,\n          },\n        },\n      ]",
          type: BubbleParameterType.ARRAY,
          location: {
            startLine: 24,
            startCol: 13,
            endLine: 31,
            endCol: 7,
          },
          source: 'object-property',
        },
      ],
      hasAwait: false,
      hasActionCall: false,
      nodeType: 'service',
      location: {
        startLine: 16,
        startCol: 18,
        endLine: 32,
        endCol: 6,
      },
    },
  };

  it('should update systemPrompt to add another line and shift all subsequent params', () => {
    // Original systemPrompt is `Hello\n` (2 lines in code: line 18-19)
    // New systemPrompt will be `Hello\nWorld\n` (3 lines in code)
    // This adds 1 line, so all subsequent params should shift down by 1

    const result = testBubbleParamUpdateWithCache({
      code: REAL_CODE,
      bubbleParameters: realBubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'Hello\nWorld\n',
      shouldContain: ['Hello', 'World'],
      shouldNotContain: [],
    });

    expect(result).toBeDefined();
    if (!result) return;

    const bubble = result.bubbleParameters['414'];
    expect(bubble).toBeDefined();

    // Get all params after systemPrompt
    const messageParam = bubble?.parameters.find((p) => p.name === 'message');
    const systemPromptParam = bubble?.parameters.find(
      (p) => p.name === 'systemPrompt'
    );
    const modelParam = bubble?.parameters.find((p) => p.name === 'model');
    const toolsParam = bubble?.parameters.find((p) => p.name === 'tools');

    console.log('[Test] After adding 1 line to systemPrompt:');
    console.log('  message location:', messageParam?.location);
    console.log('  systemPrompt location:', systemPromptParam?.location);
    console.log('  model location:', modelParam?.location);
    console.log('  tools location:', toolsParam?.location);

    // message is BEFORE systemPrompt, should NOT shift
    // Original: startLine: 17, endLine: 17
    expect(messageParam?.location?.startLine).toBe(17);
    expect(messageParam?.location?.endLine).toBe(17);

    // systemPrompt location doesn't shift (it's the edited param)
    // But its endLine extends by 1 due to the added line
    // Original: startLine: 18, endLine: 19 (2 lines)
    // After adding 1 line: startLine: 18, endLine: 20 (3 lines)
    // Actually the param location in the cache might not change because
    // we only shift params that come AFTER the bubble's endLine
    // Let's check what we expect based on implementation

    // model is AFTER systemPrompt, should shift down by 1
    // Original: startLine: 20, endLine: 23
    // After +1 line shift: startLine: 21, endLine: 24
    expect(modelParam?.location?.startLine).toBe(21);
    expect(modelParam?.location?.endLine).toBe(24);

    // tools is AFTER model, should also shift down by 1
    // Original: startLine: 24, endLine: 31
    // After +1 line shift: startLine: 25, endLine: 32
    expect(toolsParam?.location?.startLine).toBe(25);
    expect(toolsParam?.location?.endLine).toBe(32);

    // Verify the bubble's overall location also updates
    // Original: startLine: 16, endLine: 32
    // After +1 line: startLine: 16, endLine: 33
    expect(bubble?.location.startLine).toBe(16);
    expect(bubble?.location.endLine).toBe(33);
  });

  it('should update model.model in real parser output', () => {
    const result = testBubbleParamUpdate({
      code: REAL_CODE,
      bubbleParameters: realBubbleParameters,
      variableName: 'agent',
      paramPath: 'model.model',
      newValue: 'google/gemini-2.5-flash',
      shouldContain: ["'google/gemini-2.5-flash'"],
      shouldNotContain: ["'openrouter/z-ai/glm-4.6'"],
    });

    expect(result).toBeDefined();
  });

  it('should handle consecutive updates on real parser output', () => {
    // First update: change systemPrompt
    const firstResult = testBubbleParamUpdateWithCache({
      code: REAL_CODE,
      bubbleParameters: realBubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'First update',
      shouldContain: ['First update'],
      shouldNotContain: ['Hello'],
    });

    expect(firstResult).toBeDefined();
    if (!firstResult) return;

    // Second update: change systemPrompt again
    const secondResult = testBubbleParamUpdateWithCache({
      code: firstResult.code,
      bubbleParameters: firstResult.bubbleParameters,
      variableName: 'agent',
      paramPath: 'systemPrompt',
      newValue: 'Second update',
      shouldContain: ['Second update'],
      shouldNotContain: ['First update'],
    });

    expect(secondResult).toBeDefined();
    if (!secondResult) return;

    // Third update: change model.model
    const thirdResult = testBubbleParamUpdateWithCache({
      code: secondResult.code,
      bubbleParameters: secondResult.bubbleParameters,
      variableName: 'agent',
      paramPath: 'model.model',
      newValue: 'anthropic/claude-3.5-sonnet',
      shouldContain: ["'anthropic/claude-3.5-sonnet'"],
      shouldNotContain: ["'openrouter/z-ai/glm-4.6'"],
    });

    expect(thirdResult).toBeDefined();
  });
});
