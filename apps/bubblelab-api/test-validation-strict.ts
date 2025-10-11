// Test strict validation with properly typed code
const API_URL = 'http://localhost:3001';

async function testStrictValidation() {
  console.log('Testing strict TypeScript validation...\n');

  // Test 1: Extra properties on AIAgentBubble
  console.log('=== Test 1: Extra properties not allowed ===');
  const test1Response = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Extra Properties Test',
      description: 'Testing strict type checking',
      code: `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    const result = await new AIAgentBubble({
      message: "Hello",
      model: {
        model: "google/gemini-2.0-flash-exp"
      },
      // @ts-expect-error Testing extra property
      extraProperty: "should not be allowed",
      randomField: 123
    }).action();
    
    return { result };
  }
}
      `,
      eventType: 'webhook/http',
    }),
  });

  const test1Result = await test1Response.json();
  console.log('Response:', test1Result);
  console.log('---\n');

  // Test 2: Wrong model enum value
  console.log('=== Test 2: Invalid model enum value ===');
  const test2Response = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Invalid Model Enum Test',
      description: 'Testing model enum validation',
      code: `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    const result = await new AIAgentBubble({
      message: "Hello",
      model: {
        model: "invalid-model/xyz"  // Not in the allowed enum
      }
    }).action();
    
    return { result };
  }
}
      `,
      eventType: 'webhook/http',
    }),
  });

  const test2Result = await test2Response.json();
  console.log('Response:', test2Result);
  console.log('---\n');

  // Test 3: Check if model is actually required
  console.log('=== Test 3: Is model parameter required? ===');
  const test3Response = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Model Required Test',
      description: 'Testing if model is required',
      code: `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    // Only message, no model
    const result = await new AIAgentBubble({
      message: "Hello, is model required?"
    }).action();
    
    return { result };
  }
}
      `,
      eventType: 'webhook/http',
    }),
  });

  const test3Result = await test3Response.json();
  console.log('Response:', test3Result);
  console.log('---\n');

  // Test 4: Completely wrong constructor signature
  console.log('=== Test 4: Wrong constructor signature ===');
  const test4Response = await fetch(`${API_URL}/bubble-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Wrong Constructor Test',
      description: 'Testing wrong constructor parameters',
      code: `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    // Passing string instead of object
    const result = await new AIAgentBubble("Just a string").action();
    
    return { result };
  }
}
      `,
      eventType: 'webhook/http',
    }),
  });

  const test4Result = await test4Response.json();
  console.log('Response:', test4Result);
}

testStrictValidation().catch(console.error);
