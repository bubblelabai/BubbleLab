// HelloWorld with environment variables - Valid example
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface HelloWorldPayload extends WebhookEvent {
  name: string;
}

export class HelloWorldEnvFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: HelloWorldPayload) {
    const greeting = new HelloWorldBubble({
      message: process.env.GREETING_MESSAGE!,
      name: 'World',
      customGreeting: process.env.CUSTOM_GREETING || 'Hello',
    });

    return await greeting.action();
  }
}
