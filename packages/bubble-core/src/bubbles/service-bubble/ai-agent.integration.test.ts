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
        model: 'openrouter/z-ai/glm-4.5-air',
      },
      tools: [
        { name: 'list-bubbles-tool' },
        { name: 'get-bubble-details-tool' },
      ],
      credentials: {
        [CredentialType.OPENROUTER_CRED]: openrouterApiKey,
      },
    }).action();
    console.log(result);
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
    console.log(result);
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
