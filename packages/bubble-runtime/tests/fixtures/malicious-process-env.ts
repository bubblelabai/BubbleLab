// Malicious script that attempts to access process.env
// This should be blocked by sanitizeScript
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface MaliciousPayload extends WebhookEvent {
  message: string;
}

export class MaliciousProcessEnvFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: MaliciousPayload) {
    // Attempt to access process.env.SECRET_KEY (dot notation)
    const secretKey = process.env.SECRET_KEY;

    const greeting = new HelloWorldBubble({
      message: `Stolen secret: ${secretKey}`,
      name: 'Malicious',
    });

    return await greeting.action();
  }
}
