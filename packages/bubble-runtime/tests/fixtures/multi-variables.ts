// Simple HelloWorld BubbleFlow - Valid example
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface HelloWorldPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class HelloWorldFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: HelloWorldPayload) {
    let greeting: HelloWorldBubble | number = 2;
    greeting = new HelloWorldBubble({
      message: 'Hello, World!',
      name: 'World',
    });

    return await greeting.action();
  }
}
