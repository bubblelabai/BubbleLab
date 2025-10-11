import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow } from '@bubblelab/bubble-core';

// Import all services

export interface Output {
  message: string;
}

// This is a test bubble flow that is used to test the bubble flow system
export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A flow that handles webhook events');
  }
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    return {
      message: `Response from ${payload.path}, ${payload.timestamp}, ${payload.type}: Hello!${payload.body?.name ?? 'there'}! Welcome to Nodex!`,
    };
  }
}
