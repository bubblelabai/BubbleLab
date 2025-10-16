import z from 'zod';
import { CredentialType } from '../../../../bubble-shared-schemas/dist/types.js';
import { AIAgentBubble } from '../../index.js';

const openrouterApiKey = process.env.OPENROUTER_API_KEY;

console.log(openrouterApiKey);
describe('AI Agent with open router', () => {
  test('should execute a tool with open router', async () => {
    const result = await new AIAgentBubble({
      systemPrompt:
        'You are a helpful assistant that can answer questions about the slack.',
      message: 'what is the required parameters for the slack bubble?',
      model: {
        model: 'openrouter/x-ai/grok-code-fast-1',
      },
      tools: [
        { name: 'list-bubbles-tool' },
        { name: 'get-bubble-details-tool' },
      ],
      credentials: {
        [CredentialType.OPENROUTER_CRED]: openrouterApiKey,
      },
    }).action();
  });
  test('should get JSON response from open router', async () => {
    const result = await new AIAgentBubble({
      systemPrompt:
        'You are a helpful assistant that can answer questions about the slack.',
      message:
        'what is the required parameters for the slack bubble? PLEASE RETURN A JSON RESPONSE of json schema',
      model: {
        model: 'openrouter/x-ai/grok-code-fast-1',
        jsonMode: true,
      },
      credentials: {
        [CredentialType.OPENROUTER_CRED]: openrouterApiKey,
      },
    });
  });
});

describe('AI Agent with custom tools', () => {
  test('should execute a tool with custom tools', async () => {
    const result = await new AIAgentBubble({
      model: {
        jsonMode: true,
      },
      message:
        'Calculate sales tax for $100 PLEASE RETURN A JSON RESPONSE of json schema { "sales_tax": number }',
      customTools: [
        {
          name: 'calculate-tax',
          description: 'Calculates sales tax for a given amount',
          schema: {
            amount: z.number().describe('Amount to calculate tax on'),
          },
          func: async (input: Record<string, unknown>) => {
            return 299999;
          },
        },
      ],

      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
      },
    }).action();
    const response = JSON.parse(result.data?.response as string) as {
      sales_tax: number;
    };
    expect(response.sales_tax).toBe(299999);
  });
});

describe('AI Agent with tool hooks', () => {
  test('should execute a tool with hooks', async () => {
    const result = await new AIAgentBubble({
      systemPrompt:
        'You are a helpful assistant that can answer questions about the slack.',
      message: 'what is the required parameters for the slack bubble?',
      beforeToolCall: async (context) => {
        if (context.toolName === 'get-bubble-details-tool') {
          console.log('Modifying tool input............');
          context.toolInput = {
            bubbleName: 'hello-world',
          };
        }
        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, any>,
        };
      },
      afterToolCall: async (context) => {
        //Replace the tool call with custom output
        context.messages = context.messages.map((m) => {
          if (m.getType() === 'tool') {
            m.content = 'Slack is no longer supported, do not use it';
          }
          return m;
        });
        return {
          messages: context.messages,
        };
      },
      tools: [
        { name: 'list-bubbles-tool' },
        { name: 'get-bubble-details-tool' },
      ],
      credentials: {
        GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
      },
    }).action();
    expect(result.success).toBe(true);
    expect(result.data?.response).toBeDefined();
    expect(result.data?.response).toContain('Slack');
  });
});
