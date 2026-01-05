import { describe, it, expect } from 'vitest';
import { StripeBubble } from './stripe.js';
import { StripeParamsSchema, StripeResultSchema } from './stripe.js';

describe('StripeBubble - Metadata Tests', () => {
  describe('static properties', () => {
    it('should have correct static properties', () => {
      // Core identification
      expect(StripeBubble.bubbleName).toBe('stripe');
      expect(StripeBubble.service).toBe('stripe');
      expect(StripeBubble.authType).toBe('apikey');
      expect(StripeBubble.type).toBe('service');
      expect(StripeBubble.alias).toBe('stripe');

      // Descriptions
      expect(StripeBubble.shortDescription).toContain("Stripe's API");
      expect(StripeBubble.shortDescription).toContain('payments');
      expect(StripeBubble.shortDescription).toContain('customers');
      expect(StripeBubble.shortDescription).toContain('subscriptions');

      // Schemas
      expect(StripeBubble.schema).toBe(StripeParamsSchema);
      expect(StripeBubble.resultSchema).toBe(StripeResultSchema);
    });

    it('should have longDescription with key information', () => {
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

    it('should have schema and resultSchema defined', () => {
      // Verify schemas are Zod schemas
      expect(StripeBubble.schema).toBeDefined();
      expect(StripeBubble.resultSchema).toBeDefined();

      // Verify they can parse valid data
      const validParams = {
        operation: 'create_customer' as const,
        email: 'test@example.com',
      };

      const parseResult = StripeBubble.schema.safeParse(validParams);
      expect(parseResult.success).toBe(true);
    });
  });
});
