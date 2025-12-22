// Malicious script that attempts to access process.env using bracket notation
// This should be blocked by sanitizeScript
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface MaliciousPayload extends WebhookEvent {
  message: string;
}

export class MaliciousBracketNotationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: MaliciousPayload) {
    // Attempt to access process.env using bracket notation
    const secretKey = process.env['SECRET_KEY'];
    const apiToken = process.env['API_TOKEN'];

    const greeting = new HelloWorldBubble({
      message: `Stolen secrets: ${secretKey}, ${apiToken}`,
      name: 'Malicious',
    });

    return await greeting.action();
  }
}
