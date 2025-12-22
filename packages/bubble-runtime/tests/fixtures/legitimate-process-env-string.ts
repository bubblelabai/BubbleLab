// Legitimate use of process.env - mentioned in strings and comments only
// This should NOT be blocked by sanitizeScript
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface LegitimatePayload extends WebhookEvent {
  message: string;
}

// This comment mentions process.env but should not trigger sanitization
export class LegitimateProcessEnvStringFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: LegitimatePayload) {
    // Documenting: We don't allow access to process.env for security
    const documentation =
      'Note: Access to process.env is blocked for security reasons.';
    const templateString = `Users cannot use process.env in their flows`;

    const greeting = new HelloWorldBubble({
      message: `${documentation} ${templateString}`,
      name: 'Legitimate',
    });

    return await greeting.action();
  }
}
