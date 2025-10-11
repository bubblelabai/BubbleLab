// @ts-expect-error bun:test is not in TypeScript definitions
import { describe, it, expect, beforeEach } from 'bun:test';
import { db } from '../db/index.js';
import { bubbleFlowExecutions } from '../db/schema.js';
import { createBubbleFlow, executeBubbleFlow } from '../test/helpers/index.js';
import {
  validBubbleFlowCode,
  validWebhookPayload,
} from '../test/fixtures/bubble-flows.js';
import { eq } from 'drizzle-orm';

describe('POST /execute-bubble-flow/:id', () => {
  // Type assertion helpers
  const asError = (body: unknown) =>
    body as { error: string; details?: unknown[] };
  const asExecSuccess = (body: unknown) =>
    body as {
      executionId: number;
      success: boolean;
      data?: unknown;
      error?: string;
    };
  const asCreateSuccess = (body: unknown) =>
    body as { id: number; message: string };
  let validFlowId: number;

  beforeEach(async () => {
    // Create a valid flow for testing
    const response = await createBubbleFlow({
      name: 'Test Execution Flow',
      code: validBubbleFlowCode,
      eventType: 'webhook/http',
    });
    validFlowId = asCreateSuccess(response.body).id;
  });

  describe('Request Validation', () => {
    it('should reject request with invalid ID format', async () => {
      const response = await executeBubbleFlow(
        'not-a-number' as unknown as number,
        validWebhookPayload
      );

      expect(response.status).toBe(400);
      expect(asError(response.body).error).toBeDefined();
    });

    it('should accept request with missing payload', async () => {
      const response = await executeBubbleFlow(
        validFlowId,
        undefined as unknown
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('success');
    });

    it('should accept any payload type', async () => {
      const payloads = [
        { type: 'object' },
        { a: 3 },
        { a: true },
        { a: {} },
        { a: () => {} },
      ] as unknown[];

      for (const payload of payloads) {
        const response = await executeBubbleFlow(validFlowId, payload);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Flow Execution', () => {
    it('should execute valid flow successfully', async () => {
      const response = await executeBubbleFlow(
        validFlowId,
        validWebhookPayload
      );

      expect(response.status).toBe(200);
      const responseBody = asExecSuccess(response.body);
      expect(responseBody.success).toBe(true);
      // Expect any string
      console.log('responseBody', responseBody);
      expect(responseBody.data).toBeDefined();
      expect(responseBody.error).toBe('');
      expect(responseBody.executionId).toBeDefined();
    });

    it('should return 404 for non-existent flow', async () => {
      const response = await executeBubbleFlow(9999, validWebhookPayload);

      expect(response.status).toBe(404);
      expect(asError(response.body).error).toBe('BubbleFlow not found');
    });

    it('should handle execution errors gracefully', async () => {
      // Create a flow that will throw an error
      const errorFlowCode = `
        import { BubbleFlow } from '@bubblelab/bubble-core';
        import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
        export class ErrorFlow extends BubbleFlow<'webhook/http'> {
          constructor() {
            super('error-flow', 'Throws an error');
          }
          
          async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
            throw new Error('Intentional test error');
          }
        }
      `;

      const createResponse = await createBubbleFlow({
        name: 'Error Flow',
        code: errorFlowCode,
        eventType: 'webhook/http',
      });

      const response = await executeBubbleFlow(
        asCreateSuccess(createResponse.body).id,
        validWebhookPayload
      );

      expect(response.status).toBe(400);
      expect(asError(response.body)).toMatchObject({
        error: expect.stringContaining('error'),
      });
    });
  });

  describe('Execution History', () => {
    it('should create execution record with running status', async () => {
      await executeBubbleFlow(validFlowId, validWebhookPayload);

      const executions = await db.select().from(bubbleFlowExecutions);
      expect(executions.length).toBeGreaterThan(0);

      const execution = executions[0];
      expect(execution.bubbleFlowId).toBe(validFlowId);
      expect(execution.payload).toHaveProperty('timestamp');
    });

    it('should update execution record on success', async () => {
      const response = await executeBubbleFlow(
        validFlowId,
        validWebhookPayload
      );

      const execution = await db.query.bubbleFlowExecutions.findFirst({
        where: eq(
          bubbleFlowExecutions.id,
          asExecSuccess(response.body).executionId
        ),
      });

      expect(execution).toBeDefined();
      expect(execution?.status).toBe('success');
      expect(execution?.result).toBeDefined();
      expect(execution?.error).toBeNull();
      expect(execution?.completedAt).toBeDefined();
    });

    it('should update execution record on error', async () => {
      // Create error flow
      const errorFlowCode = `
        import { BubbleFlow } from '@bubblelab/bubble-core';
        import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

        export class ErrorFlow extends BubbleFlow<'webhook/http'> {
          constructor() {
            super('error-flow', 'Throws an error');
          }
          
          async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
            throw new Error('Test execution error');
          }
        }
      `;

      const createResponse = await createBubbleFlow({
        name: 'Error Flow',
        code: errorFlowCode,
        eventType: 'webhook/http',
      });

      const response = await executeBubbleFlow(
        asCreateSuccess(createResponse.body).id,
        validWebhookPayload
      );

      // Since the flow failed, response status should be 400
      expect(response.status).toBe(400);
      expect(asError(response.body)).toMatchObject({
        error: expect.stringContaining('error'),
      });

      // Find the execution record by bubbleFlowId since executionId is not available in error response
      const executions = await db.query.bubbleFlowExecutions.findMany({
        where: eq(
          bubbleFlowExecutions.bubbleFlowId,
          asCreateSuccess(createResponse.body).id
        ),
        orderBy: (table, { desc }) => [desc(table.startedAt)],
        limit: 1,
      });

      const execution = executions[0];
      expect(execution).toBeDefined();
      expect(execution?.status).toBe('error');
      expect(execution?.result).not.toBeNull();
      expect(execution?.error).toContain('Test execution error');
      expect(execution?.completedAt).toBeDefined();
    });

    it('should track multiple executions of same flow', async () => {
      // Execute the same flow multiple times
      const payload1 = { test: 1 };
      const payload2 = { test: 2 };
      const payload3 = { test: 3 };

      await executeBubbleFlow(validFlowId, payload1);
      await executeBubbleFlow(validFlowId, payload2);
      await executeBubbleFlow(validFlowId, payload3);

      const executions = await db
        .select()
        .from(bubbleFlowExecutions)
        .where(eq(bubbleFlowExecutions.bubbleFlowId, validFlowId));

      expect(executions.length).toBe(3);

      // Expect new wrapped format - each payload should be wrapped in BubbleTriggerEvent
      const expectedPayloads = [
        {
          type: 'webhook/http',
          path: `/execute-bubble-flow/${validFlowId}`,
          body: payload1,
          ...payload1,
        },
        {
          type: 'webhook/http',
          path: `/execute-bubble-flow/${validFlowId}`,
          body: payload2,
          ...payload2,
        },
        {
          type: 'webhook/http',
          path: `/execute-bubble-flow/${validFlowId}`,
          body: payload3,
          ...payload3,
        },
      ];

      executions.forEach((execution, index) => {
        expect(execution.payload).toMatchObject(expectedPayloads[index]);
        expect(execution.payload).toHaveProperty('timestamp');
      });
    });
  });

  describe('Performance', () => {
    it('should handle concurrent executions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        executeBubbleFlow(validFlowId, { concurrent: i })
      );

      const responses = await Promise.all(promises);

      console.log('Responses from performance test', responses);
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(
        responses.every((r) => asExecSuccess(r.body).success === true)
      ).toBe(true);

      const executions = await db.select().from(bubbleFlowExecutions);
      expect(executions.length).toBe(10);
    });
  });
});
