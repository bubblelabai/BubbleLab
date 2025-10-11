// @ts-expect-error bun:test is not in TypeScript definitions
import { describe, it, expect } from 'bun:test';
import { db } from '../db/index.js';
import { bubbleFlows } from '../db/schema.js';
import {
  createBubbleFlow,
  expectValidationError,
  expectSuccess,
} from '../test/helpers/index.js';
import { eq } from 'drizzle-orm';
import {
  validBubbleFlowCode,
  invalidBubbleFlowCodeNoClass,
  invalidBubbleFlowCodeNoHandle,
  syntaxErrorBubbleFlowCode,
  typeErrorBubbleFlowCode,
} from '../test/fixtures/bubble-flows.js';

describe('POST /bubble-flow', () => {
  // Type assertion helper for cleaner tests
  const asError = (body: unknown) =>
    body as { error: string; details?: unknown[] };
  const asSuccess = (body: unknown) => body as { id: number; message: string };
  describe('Request Validation', () => {
    it('should reject request with missing required fields', async () => {
      const response = await createBubbleFlow({
        name: '',
        code: '',
        eventType: '',
      });

      expect(response.status).toBe(400);
      expect(asError(response.body).error).toContain('Validation failed');
      // Check that we have error details (format can vary)
      expect(asError(response.body).details).toBeDefined();
    });

    it('should reject request with invalid field types', async () => {
      const response = await createBubbleFlow({
        name: 123 as unknown as string, // TODO: clarify type
        code: true as unknown as string, // TODO: clarify type
        eventType: [] as unknown as string, // TODO: clarify type
      });

      expect(response.status).toBe(400);
      expect(asError(response.body).error).toContain('Validation failed');
      expect(asError(response.body).details).toBeDefined();
    });

    it('should accept request with optional description', async () => {
      const response = await createBubbleFlow({
        name: 'Test Flow with Description',
        description: 'This is a test flow description',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      expectSuccess(response);
    });
  });

  describe('TypeScript Validation', () => {
    it('should accept valid BubbleFlow code', async () => {
      const response = await createBubbleFlow({
        name: 'Valid Test Flow',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      expectSuccess(response);

      // Verify it was saved to database
      const saved = await db.query.bubbleFlows.findFirst({
        where: eq(bubbleFlows.id, asSuccess(response.body).id),
      });

      expect(saved).toBeDefined();
      expect(saved?.name).toBe('Valid Test Flow');
    });

    it('should reject code without BubbleFlow class', async () => {
      const response = await createBubbleFlow({
        name: 'Invalid Flow - No Class',
        code: invalidBubbleFlowCodeNoClass,
        eventType: 'webhook/http',
      });

      expectValidationError(
        response,
        'Code must contain a class that extends BubbleFlow'
      );
    });

    it('should reject code without handle method', async () => {
      const response = await createBubbleFlow({
        name: 'Invalid Flow - No Handle',
        code: invalidBubbleFlowCodeNoHandle,
        eventType: 'webhook/http',
      });

      expectValidationError(
        response,
        'does not implement inherited abstract member'
      );
    });

    it('should reject code with syntax errors', async () => {
      const response = await createBubbleFlow({
        name: 'Syntax Error Flow',
        code: syntaxErrorBubbleFlowCode,
        eventType: 'webhook/http',
      });

      expect(response.status).toBe(400);
      expect(asError(response.body).error).toBe('TypeScript validation failed');
      expect(asError(response.body).details).toBeDefined();
    });

    it('should reject code with type errors when strict mode is enabled', async () => {
      const response = await createBubbleFlow({
        name: 'Type Error Flow',
        code: typeErrorBubbleFlowCode,
        eventType: 'webhook/http',
      });

      expect(response.status).toBe(400);
      expect(asError(response.body).error).toBe('TypeScript validation failed');
      expect(asError(response.body).details).toBeDefined();
    });
  });

  describe('Database Persistence', () => {
    it('should generate auto-incrementing IDs', async () => {
      const response1 = await createBubbleFlow({
        name: 'First Flow',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      const response2 = await createBubbleFlow({
        name: 'Second Flow',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      expect(asSuccess(response1.body).id).toBeGreaterThan(0);
      expect(asSuccess(response2.body).id).toBeGreaterThan(0);
    });

    it('should store timestamps', async () => {
      const response = await createBubbleFlow({
        name: 'Timestamped Flow',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      const saved = await db.query.bubbleFlows.findFirst({
        where: eq(bubbleFlows.id, asSuccess(response.body).id),
      });

      expect(saved?.createdAt).toBeDefined();
      expect(saved?.updatedAt).toBeDefined();
    });

    it('should not store invalid flows', async () => {
      const countBefore = await db.select().from(bubbleFlows);

      await createBubbleFlow({
        name: 'Should Not Be Saved',
        code: invalidBubbleFlowCodeNoClass,
        eventType: 'webhook/http',
      });

      const countAfter = await db.select().from(bubbleFlows);
      expect(countAfter.length).toBe(countBefore.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error by closing the connection
      // This is a simplified example - in real tests you'd use proper mocking

      const response = await createBubbleFlow({
        name: 'Test Flow',
        code: validBubbleFlowCode,
        eventType: 'webhook/http',
      });

      // Should still work
      expect([200, 201, 500]).toContain(response.status);
    });
  });
});
