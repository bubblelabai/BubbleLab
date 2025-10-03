// Complex workflow with multiple bubbles - Valid example
import {
  BubbleFlow,
  HelloWorldBubble,
  PostgreSQLBubble,
  SlackBubble,
  SlackMentionEvent,
} from '@bubblelab/bubble-core';

interface ComplexWorkflowPayload extends SlackMentionEvent {
  message: string;
  name: string;
}

export class ComplexWorkflow extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: ComplexWorkflowPayload) {
    const database = new PostgreSQLBubble({
      query: 'SELECT count(*) as user_count FROM users',
      ignoreSSL: true,
      allowedOperations: ['SELECT'],
    });
    await new SlackBubble({
      operation: 'send_message',
      text: payload.text,
      channel: payload.channel,
    }).action();
    await database.action();
    return await new HelloWorldBubble({
      message: payload.message,
      name: payload.name,
    }).action();
  }
}
