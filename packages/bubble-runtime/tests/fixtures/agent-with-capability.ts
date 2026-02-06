import {
  BubbleFlow,
  AIAgentBubble,
  SlackBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

interface SlackMentionPayload extends WebhookEvent {
  text: string;
  channel: string;
  thread_ts?: string;
}

export class SlackKBBot extends BubbleFlow<'webhook/http'> {
  async handle(payload: SlackMentionPayload) {
    const agent = new AIAgentBubble({
      message: payload.text,
      systemPrompt: 'You are our team assistant.',
      model: { model: 'google/gemini-2.5-flash', temperature: 0.3 },
      capabilities: [
        {
          id: 'google-doc-knowledge-base',
          inputs: { docId: '11YWBOYFRDe3C6qj5Qei2QxUJrbVEPIsC' },
        },
      ],
    });

    const result = await agent.action();

    await new SlackBubble({
      operation: 'send_message',
      channel: payload.channel,
      text: result.data?.response || 'Something went wrong.',
      thread_ts: payload.thread_ts,
    }).action();

    return { response: result.data?.response };
  }
}
