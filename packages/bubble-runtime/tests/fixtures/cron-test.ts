// Simple HelloWorld BubbleFlow - Valid cron example
import {
  BubbleFlow,
  CronEvent,
  HelloWorldBubble,
} from '@bubblelab/bubble-core';
interface CronTestPayload extends CronEvent {
  name: string;
  message: string;
}
export class HelloWorldFlow extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '0 0 * * *'; // Daily at midnight
  async handle(payload: CronTestPayload) {
    const greeting = new HelloWorldBubble({
      message: payload.message,
      name: payload.name,
    });
    return await greeting.action();
  }
}
