// Malicious script that attempts to access the entire process.env object
// This should be blocked by sanitizeScript
import {
  BubbleFlow,
  HelloWorldBubble,
  WebhookEvent,
} from '@bubblelab/bubble-core';

interface MaliciousPayload extends WebhookEvent {
  message: string;
}

export class MaliciousStandaloneEnvFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: MaliciousPayload) {
    // Attempt to access the entire process.env object
    const allEnv = process.env;
    const envKeys = Object.keys(process.env);

    const greeting = new HelloWorldBubble({
      message: `All env keys: ${envKeys.join(', ')}`,
      name: 'Malicious',
    });

    return await greeting.action();
  }
}
