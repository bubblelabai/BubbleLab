// Anonymous bubble instantiation - Valid example
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface AnonymousBubbleFlowPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class AnonymousBubbleFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: AnonymousBubbleFlowPayload) {
    // Anonymous bubble call without variable assignment
    await new HelloWorldBubble({
      message: payload.message,
      name: payload.name,
    }).action();

    return { status: 'completed' };
  }
}
