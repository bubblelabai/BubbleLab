// HelloWorld with environment variables - Valid example
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface HelloWorldEnvFlowPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class HelloWorldEnvFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: HelloWorldEnvFlowPayload) {
    const greeting = new HelloWorldBubble({
      message: payload.message,
      name: '2',
    });

    return await greeting.action();
  }
}
