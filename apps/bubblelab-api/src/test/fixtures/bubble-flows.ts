export const validBubbleFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow } from '@bubblelab/bubble-core';
import * as bubbles from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  processed: boolean;
  success: boolean;
  error: string;
}

export class TestValidFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-valid-flow', 'A valid test flow');
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    return {
      message: 'Test flow executed successfully',
      processed: true,
      success: true,
      error: ''
    };
  }
}
`;

export const invalidBubbleFlowCodeNoClass = `
// This code has no class extending BubbleFlow
const someFunction = () => {
  console.log('This is not a BubbleFlow');
};

export { someFunction };
`;

export const invalidBubbleFlowCodeNoHandle = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class InvalidFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('invalid-flow', 'Missing handle method');
  }
  
  // Missing handle method
}
`;

export const syntaxErrorBubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class SyntaxErrorFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('syntax-error-flow', 'Has syntax error');
  }
  
  async handle(payload) {
    // Missing closing brace
    return { message: 'test'
  }
}
`;

export const typeErrorBubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class TypeErrorFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('type-error-flow', 'Has type error');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']): Promise<Output> {
    const result: string = 123; // Type error: number assigned to string
    return { message: result };
  }
}
`;

export const validWebhookPayload = {
  path: '/test-webhook',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: {
    test: true,
    data: 'sample payload',
  },
};
