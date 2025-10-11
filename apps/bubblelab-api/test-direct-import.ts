// Test the API with direct AIAgentBubble import
const API_URL = 'http://localhost:3001';

async function testDirectImport() {
  console.log('Testing BubbleFlow with direct AIAgentBubble import...\n');

  // 1. Create a BubbleFlow with direct import
  const createResponse = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Direct Import Test Flow',
      description: 'Tests direct import of AIAgentBubble',
      code: `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

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
    const result = await new AIAgentBubble({
      message: 'Hello, how are you?',
      model: {
        model: 'google/gemini-2.0-flash-exp',
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
        payload: { path: '/test-direct-import' },
      }),
    }
  );

  const executeResult = await executeResponse.json();
  console.log('\nExecute response:', executeResult);

  // 3. Check the processed code in database
  console.log('\n--- Checking processed code in database ---');
}

testDirectImport().catch(console.error);
