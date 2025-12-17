import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  success: boolean;
}

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A simple test flow');
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const shouldFail = payload.body && payload.body.shouldFail;

    if (shouldFail) {
      throw new Error('Test failure');
    }

    return {
      message: 'Test execution successful',
      success: true,
    };
  }
}
