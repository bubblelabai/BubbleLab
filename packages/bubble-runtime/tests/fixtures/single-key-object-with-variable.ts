import {
  BubbleFlow,
  LumaBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface LumaPayload extends WebhookEvent {
  luma_url: string;
}

export interface Output {
  events_found: number;
}

/**
 * Regression fixture: reproduces the bubble-runtime parameter-injection bug where
 * `new LumaBubble({ url: variable })` — a single-key object literal whose value is
 * a variable reference — was incorrectly unwrapped to `new LumaBubble(variable)`,
 * passing a bare string where Zod expected `{ url, credentials? }` and producing
 * "Expected object, received string" at runtime.
 */
export class LumaFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: LumaPayload): Promise<Output> {
    const { luma_url } = payload;
    const luma = new LumaBubble({ url: luma_url });
    const result = await luma.action();
    return {
      events_found: result.success ? result.data.events.length : 0,
    };
  }
}
