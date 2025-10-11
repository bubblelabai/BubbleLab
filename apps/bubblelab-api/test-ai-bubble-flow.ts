// Test the API with AIAgentBubble
const API_URL = 'http://localhost:3001';

async function testAIBubbleFlow() {
  console.log('Testing BubbleFlow with AIAgentBubble...\n');

  // 1. Create a BubbleFlow that uses AIAgentBubble
  const createResponse = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'AI Agent Test Flow',
      description: 'A flow that uses AIAgentBubble',
      code: `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow } from '@bubblelab/bubble-core';
// Import all services
import * as bubbles from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A flow that handles webhook events');
  }
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const result = await new bubbles.AIAgentBubble({
      message: 'Hello, how are you?',
      model: {
        model: 'google/gemini-2.5-flash',
      },
    }).action();
    return {
      message: \`Response from \${payload.path}: \${result.data?.response ?? 'No response'}\`,
    };
  }
}
      `,
      eventType: 'webhook/http',
    }),
  });

  const createResult = await createResponse.json();
  console.log('Create response:', createResult);

  if (!createResponse.ok) {
    console.error('Failed to create flow');
    return;
  }

  // 2. Execute the BubbleFlow
  const executeResponse = await fetch(
    `${API_URL}/execute-bubble-flow/${createResult.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { path: '/test-ai' },
      }),
    }
  );

  const executeResult = await executeResponse.json();
  console.log('\nExecute response:', executeResult);
}

testAIBubbleFlow().catch(console.error);
