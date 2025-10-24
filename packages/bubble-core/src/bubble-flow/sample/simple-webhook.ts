import type { BubbleTriggerEventRegistry } from '@bubblelab/shared-schemas';
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
        model: 'google/gemini-2.5-flash',
      },
    }).action();
    return {
      message: `Response from ${payload.path}: ${result.data?.response ?? 'No response'}`,
    };
  }
}
