// Simple HelloWorld BubbleFlow - Valid example
import {
  BubbleFlow,
  AIAgentBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface HelloWorldPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class HelloWorldFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: HelloWorldPayload) {
    const weatherAgent: AIAgentBubble = new AIAgentBubble({
      message: 'Find the weather in San Francisco',
      model: { model: 'google/gemini-2.5-flash' },
      tools: [{ name: 'research-agent-tool' }],
    });
    const weatherResult = await weatherAgent.action();
    return {
      message: weatherResult.data?.response,
    };
  }
}
