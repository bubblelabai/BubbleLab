// Test the API manually
const API_URL = 'http://localhost:3001';

async function testAPI() {
  console.log('Testing BubbleFlow API...\n');

  // 1. Create a BubbleFlow
  const createResponse = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Greeting Flow',
      description: 'A simple greeting flow',
      code: `
import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class GreetingFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('greeting-flow', 'Greets the user');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    const name = payload.body?.name || 'World';
    return {
      greeting: \`Hello, \${name}!\`,
      timestamp: new Date().toISOString(),
      receivedData: payload,
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
        payload: { name: 'TypeScript User' },
      }),
    }
  );

  const executeResult = await executeResponse.json();
  console.log('\nExecute response:', executeResult);
}

testAPI().catch(console.error);
