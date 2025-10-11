import type { WebhookEvent } from '../../bubble-trigger';
import { BubbleFlow } from '../bubble-flow-class.js';
// Import all services
import * as bubbles from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  userId: string;
  requestId: string;
  customData: {
    source: string;
    priority: 'low' | 'medium' | 'high';
    metadata: Record<string, any>;
  };
}

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A flow that handles webhook events');
  }
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    // Type assertion to access your custom fields
    const customPayload = payload;
    const { userId, requestId, customData } = customPayload;

    const result = await new bubbles.AIAgentBubble({
      message: `Hello user ${userId}, priority: ${customData.priority}`,
      model: {
        model: 'google/gemini-2.5-flash',
      },
    }).action();

    return {
      message: `Response from ${payload.path} (Request: ${requestId}): ${result.data?.response ?? 'No response'}`,
    };
  }
}
