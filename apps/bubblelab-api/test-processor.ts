import { processUserCode } from './src/services/code-processor.js';

const testCode = `
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
`;

console.log('Original code:');
console.log(testCode);
console.log('\n\nProcessed code:');
console.log(processUserCode(testCode));
