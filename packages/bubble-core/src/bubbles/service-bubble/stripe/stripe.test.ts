import { describe, expect, test } from 'vitest';
import { StripeBubble } from './stripe.js';
import { StripeParamsSchema, StripeResultSchema } from './stripe.js';

describe('static properties', () => {
  test('should have correct static properties', () => {
    expect(StripeBubble.bubbleName).toBe('stripe');
    expect(StripeBubble.service).toBe('stripe');
    expect(StripeBubble.authType).toBe('apikey');
    expect(StripeBubble.type).toBe('service');
    expect(StripeBubble.alias).toBe('stripe');
    expect(StripeBubble.shortDescription).toContain("Stripe's API");
    expect(StripeBubble.shortDescription).toContain('payments');
    expect(StripeBubble.shortDescription).toContain('customers');
    expect(StripeBubble.shortDescription).toContain('subscriptions');
    expect(StripeBubble.schema).toBe(StripeParamsSchema);
    expect(StripeBubble.resultSchema).toBe(StripeResultSchema);
  });

  test('should have longDescription with key information', () => {
    const bubble = new StripeBubble({
      operation: 'create_customer',
      email: 'test@example.com',
    });

    expect(bubble.longDescription).toContain('Stripe');
    expect(bubble.longDescription).toContain('API');
    expect(bubble.longDescription).toContain('customers');
    expect(bubble.longDescription).toContain('payments');
    expect(bubble.longDescription).toContain('subscriptions');
    expect(bubble.longDescription).toContain('API key');
    expect(bubble.longDescription).toContain('authentication');
  });
});
