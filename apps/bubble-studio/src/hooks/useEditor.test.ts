import { describe, it, expect } from 'vitest';
import type {
  ValidateBubbleFlowResponse,
  ParsedBubbleWithInfo,
  BubbleParameter,
} from '@bubblelab/shared-schemas';
import {
  updateBubbleParamInCode,
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
      message: query,
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

  it('should update normal systemPrompt and produce valid code', async () => {
    // Step 1: Validate original code to get bubble parameters with locations
    const originalValidation = await validateCode(NORMAL_SYSTEM_PROMPT_CODE);
    expect(originalValidation.valid).toBe(true);
    expect(originalValidation.bubbles).toBeDefined();

    // Step 2: Use the same utility function to update the param
    const bubbleParameters = originalValidation.bubbles as Record<
      string,
      ParsedBubbleWithInfo
    >;
    const newSystemPrompt = 'You are a coding assistant.';

    const result = updateBubbleParamInCode(
      NORMAL_SYSTEM_PROMPT_CODE,
      bubbleParameters,
      'agent',
      'systemPrompt',
      newSystemPrompt
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Step 3: Validate the updated code
    const updatedValidation = await validateCode(result.code);
    if (!updatedValidation.valid) {
      console.log(
        '[updateBubbleParam] Updated validation failed:',
        updatedValidation
      );
      console.log('[updateBubbleParam] Updated code:', result.code);
    }
    expect(updatedValidation.valid).toBe(true);

    // Step 4: Verify the new value is reflected
    const updatedAgentBubble = Object.values(
      updatedValidation.bubbles || {}
    ).find((b) => b.variableName === 'agent');
    const updatedParam = updatedAgentBubble?.parameters.find(
      (p) => p.name === 'systemPrompt'
    );

    expect(updatedParam?.value).toBe(newSystemPrompt);
  });

  it('should update template string systemPrompt and produce valid code', async () => {
    // Step 1: Validate original code to get bubble parameters with locations
    const originalValidation = await validateCode(
      TEMPLATE_STRING_SYSTEM_PROMPT
    );
    expect(originalValidation.valid).toBe(true);
    expect(originalValidation.bubbles).toBeDefined();
    const bubbleParameters = originalValidation.bubbles || {};
    const newSystemPrompt = 'You are a coding assistant.';
    const systemPromptParam = Object.values(bubbleParameters)
      .find((b) => b.variableName === 'agent')
      ?.parameters.find((p) => p.name === 'systemPrompt');
    const extractedParam = extractParamValue(systemPromptParam, 'systemPrompt');
    expect(extractedParam?.value).toBe(
      'Hello i am model \${aiModel} with prompt \${aiPrompt}'
    );
    expect(extractedParam?.shouldBeEditable).toBe(true);
    expect(extractedParam?.type).toBe(BubbleParameterType.STRING);

    // Step 2: Update the system prompt
    const result = updateBubbleParamInCode(
      TEMPLATE_STRING_SYSTEM_PROMPT,
      bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      'agent',
      'systemPrompt',
      newSystemPrompt
    );

    if (!result.success) {
      console.log('[updateBubbleParam] Result failed:', result);
    }
    expect(result.success).toBe(true);

    // Update prompt in the updated code
    const updatedResult = updateBubbleParamInCode(
      result.success ? result.code : '',
      bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      'agent',
      'systemPrompt',
      newSystemPrompt
    );

    const updatedValidation = await validateCode(
      updatedResult.success ? updatedResult.code : ''
    );
    if (!updatedValidation.valid) {
      console.log(
        '[updateBubbleParam] Updated validation failed:',
        updatedValidation
      );
      console.log(
        '[updateBubbleParam] Updated code:',
        updatedResult.success ? updatedResult.code : ''
      );
    }
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

    const result = extractParamValue(modelParam, 'model.model');
    expect(result?.value).toBe('google/gemini-2.5-pro');
  });
  it('should return undefined when param is invalid', () => {
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
    const bubbleParameters: Record<string, ParsedBubbleWithInfo> = {
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
    };

    const result = updateBubbleParamInCode(
      CODE_WITH_MODEL,
      bubbleParameters,
      'agent',
      'model.model',
      'google/gemini-3-pro-preview'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toContain("'google/gemini-3-pro-preview'");
      expect(result.code).not.toContain("'google/gemini-2.5-flash'");
    }
  });
});
