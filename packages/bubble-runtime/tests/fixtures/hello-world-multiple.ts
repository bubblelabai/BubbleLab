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
    const greeting = new HelloWorldBubble({
      message: 'Hello, World!',
      name: 'World',
    });

    const greetingResult = await greeting.action();

    await new HelloWorldBubble({
      message: 'Hellodfsdf, World!',
      name: 'World',
    }).action();

    await new HelloWorldBubble({
      message: 'Hello, World!',
      name: 'World',
    }).action();

    for (let i = 0; i < 2; i++) {
      await new HelloWorldBubble({
        message: 'Hello, World!',
        name: 'World',
      }).action();
    }

    return {
      message: greetingResult.data?.greeting,
    };
  }
}
