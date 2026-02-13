// @ts-expect-error bun:test is not in TypeScript definitions
import { describe, it, expect } from 'bun:test';
import {
  createBubbleFlow,
  executeBubbleFlow,
  testApp,
  isErrorResponse,
  isCreateBubbleFlowResponse,
  isExecuteBubbleFlowResponse,
  type CreateBubbleFlowResponse,
  type ExecuteBubbleFlowResponse,
  type ErrorResponse,
} from '../test/helpers/index.js';
import { db } from '../db/index.js';
import { bubbleFlows, bubbleFlowExecutions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Integration Tests', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await testApp.get('/');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('End-to-End Flow', () => {
    it('should create and execute a bubble flow', async () => {
      // Step 1: Create a bubble flow
      const bubbleFlowCode = `
        import { BubbleFlow } from '@bubblelab/bubble-core';
        import * as bubbles from '@bubblelab/bubble-core';
        import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

        export class GreetingFlow extends BubbleFlow<'webhook/http'> {
          constructor() {
            super('greeting-flow', 'Greets users based on input');
          }
          
          async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
            const name = payload.body?.name || 'World';
            const greeting = \`Hello, \${name}! Your request was processed at \${new Date().toISOString()}\`;
            
            return {
              greeting,
              originalPayload: payload,
              processed: true
            };
          }
        }
      `;

      const createResponse = await createBubbleFlow({
        name: 'Greeting Flow',
        description: 'A flow that greets users',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
      });

      expect(createResponse.status).toBe(201);
      expect(isCreateBubbleFlowResponse(createResponse.body)).toBe(true);
      const flowId = (createResponse.body as CreateBubbleFlowResponse).id;

      // Step 2: Execute the flow with different payloads
      const payloads = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'World' }, // Should default to 'World'
      ];

      for (const payload of payloads) {
        const execResponse = await executeBubbleFlow(flowId, payload);

        expect(execResponse.status).toBe(200);
        expect(isExecuteBubbleFlowResponse(execResponse.body)).toBe(true);
        const body = execResponse.body as ExecuteBubbleFlowResponse;
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('greeting');
        expect(body.data).toHaveProperty('processed', true);

        if (payload.name) {
          expect((body.data as { greeting: string }).greeting).toContain(
            payload.name
          );
        } else {
          expect((body.data as { greeting: string }).greeting).toContain(
            'World'
          );
        }
      }

      // Step 3: Verify execution history
      const executions = await db
        .select()
        .from(bubbleFlowExecutions)
        .where(eq(bubbleFlowExecutions.bubbleFlowId, flowId));

      expect(executions.length).toBe(3);
      expect(executions.every((e) => e.status === 'success')).toBe(true);
    }, 90000); // 90s for CI (create + 3 executions + DB query can be slow on cold runners)

    it('should handle complex bubble flow with AI integration', async () => {
      // This tests the actual bubble integration
      const aiFlowCode = `
        import { BubbleFlow } from '@bubblelab/bubble-core';
        import * as bubbles from '@bubblelab/bubble-core';
        import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

        export class AIAnalysisFlow extends BubbleFlow<'webhook/http'> {
          constructor() {
            super('ai-analysis-flow', 'Analyzes text using AI');
          }
          
          async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
            const text = payload.body?.text || 'Hello, AI!';
            
            try {
              // Mock AI response for testing
              // In real implementation, this would call AIAgentBubble
              const mockAIResponse = {
                analysis: 'This is a greeting message',
                sentiment: 'positive',
                wordCount: (text as string).split(' ').length,
              };
              
              return {
                success: true,
                input: text,
                analysis: mockAIResponse,
                timestamp: new Date().toISOString(),
              };
            } catch (error: unknown) {
              return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }
        }
      `;

      const createResponse = await createBubbleFlow({
        name: 'AI Analysis Flow',
        code: aiFlowCode,
        eventType: 'webhook/http',
      });

      expect(createResponse.status).toBe(201);

      const execResponse = await executeBubbleFlow(
        (createResponse.body as CreateBubbleFlowResponse).id,
        {
          text: 'Analyze this text please',
        }
      );

      expect(execResponse.status).toBe(200);
      const body = execResponse.body as ExecuteBubbleFlowResponse;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('analysis');
      expect(
        (body.data as { analysis: { wordCount: number } }).analysis.wordCount
      ).toBe(4);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle validation and execution errors appropriately', async () => {
      // Try to create invalid flow
      const invalidResponse = await createBubbleFlow({
        name: 'Invalid Flow',
        code: 'this is not valid TypeScript code',
        eventType: 'webhook/http',
      });

      expect(invalidResponse.status).toBe(400);
      expect(isErrorResponse(invalidResponse.body)).toBe(true);
      expect((invalidResponse.body as ErrorResponse).error).toBe(
        'TypeScript validation failed'
      );

      // Verify no flow was created
      const flows = await db.select().from(bubbleFlows);
      expect(flows.find((f) => f.name === 'Invalid Flow')).toBeUndefined();

      // Try to execute non-existent flow
      const execResponse = await executeBubbleFlow(99999, { test: true });
      expect(execResponse.status).toBe(404);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent flow creations and executions', async () => {
      const flowCount = 5;
      const execPerFlow = 3;

      // Create multiple flows concurrently
      const createPromises = Array.from({ length: flowCount }, (_, i) =>
        createBubbleFlow({
          name: `Concurrent Flow ${i}`,
          code: `
            import { BubbleFlow } from '@bubblelab/bubble-core';
            import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

            export class ConcurrentFlow${i} extends BubbleFlow<'webhook/http'> {
              constructor() {
                super('concurrent-flow-${i}', 'Test concurrent operations');
              }
              
              async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
                return { flowId: ${i}, payload };
              }
            }
          `,
          eventType: 'webhook/http',
        })
      );

      const createResponses = await Promise.all(createPromises);
      expect(createResponses.every((r) => r.status === 201)).toBe(true);

      // Execute each flow multiple times concurrently
      const execPromises = createResponses.flatMap((createRes) =>
        Array.from({ length: execPerFlow }, (_, i) =>
          executeBubbleFlow((createRes.body as CreateBubbleFlowResponse).id, {
            execution: i,
          })
        )
      );

      const execResponses = await Promise.all(execPromises);
      expect(execResponses.every((r) => r.status === 200)).toBe(true);

      // Verify all executions were recorded
      const allExecutions = await db.select().from(bubbleFlowExecutions);
      expect(allExecutions.length).toBe(flowCount * execPerFlow);
    });
  });
});
