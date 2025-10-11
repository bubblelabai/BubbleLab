// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db } from '../db/index.js';
import { bubbleFlows, webhooks, bubbleFlowExecutions } from '../db/schema.js';
import { inArray } from 'drizzle-orm';
import '../config/env.js';
import { TestApp } from '../test/test-app.js';
import {
  bubbleFlowListResponseSchema,
  webhookExecutionResponseSchema,
} from '../schemas/index.js';
import { z } from 'zod';

// Simple BubbleFlow code for testing
const simpleBubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  success: boolean;
}

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A simple test flow');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const shouldFail = payload.body && (payload.body as any).shouldFail;
    
    if (shouldFail) {
      throw new Error('Test failure');
    }
    
    return {
      message: 'Test execution successful',
      success: true,
    };
  }
}
`;

describe('Webhook Execution Tracking Integration', () => {
  let createdBubbleFlowId: number;
  let webhookPath: string;

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (createdBubbleFlowId) {
      await db
        .delete(bubbleFlowExecutions)
        .where(
          inArray(bubbleFlowExecutions.bubbleFlowId, [createdBubbleFlowId])
        );
      await db
        .delete(webhooks)
        .where(inArray(webhooks.bubbleFlowId, [createdBubbleFlowId]));
      await db
        .delete(bubbleFlows)
        .where(inArray(bubbleFlows.id, [createdBubbleFlowId]));
      createdBubbleFlowId = 0;
    }
  }

  it('should track webhook execution counts: 2 executions, 1 failure', async () => {
    // 1. Create a BubbleFlow
    const createFlowResponse = await TestApp.post('/bubble-flow', {
      name: 'Execution Tracking Test Flow',
      description: 'Testing webhook execution tracking',
      code: simpleBubbleFlowCode,
      eventType: 'webhook/http',
      webhookActive: true,
    });

    expect(createFlowResponse.status).toBe(201);
    const flowData = (await createFlowResponse.json()) as any;
    createdBubbleFlowId = flowData.id;
    webhookPath = flowData.webhook.path;

    console.log(
      `Created flow ${createdBubbleFlowId} with webhook path: ${webhookPath}`
    );

    // 2. Check initial counts via list endpoint
    const listResponse = await TestApp.get('/bubble-flow');
    expect(listResponse.status).toBe(200);
    const listData = (await listResponse.json()) as z.infer<
      typeof bubbleFlowListResponseSchema
    >;
    const flows = listData.bubbleFlows;
    const ourFlow = flows.find((f) => f.id === createdBubbleFlowId);
    expect(ourFlow).toBeDefined();
    expect(ourFlow!.webhookExecutionCount).toBe(0);
    expect(ourFlow!.webhookFailureCount).toBe(0);

    // 3. Execute via webhook - SUCCESS
    const successResponse = await TestApp.post(`/webhook/1/${webhookPath}`, {
      test: 'success execution',
    });
    expect(successResponse.status).toBe(200);
    const successResult = (await successResponse.json()) as z.infer<
      typeof webhookExecutionResponseSchema
    >;
    expect(successResult.success).toBe(true);

    // 4. Execute via webhook - FAILURE
    const failureResponse = await TestApp.post(`/webhook/1/${webhookPath}`, {
      shouldFail: true,
    });
    expect(failureResponse.status).toBe(200);
    const failureResult = (await failureResponse.json()) as z.infer<
      typeof webhookExecutionResponseSchema
    >;
    expect(failureResult.success).toBe(false);

    // 5. Check final counts via list endpoint
    const finalListResponse = await TestApp.get('/bubble-flow');
    expect(finalListResponse.status).toBe(200);
    const finalListData = (await finalListResponse.json()) as z.infer<
      typeof bubbleFlowListResponseSchema
    >;
    const finalFlows = finalListData.bubbleFlows;
    const finalFlow = finalFlows.find((f) => f.id === createdBubbleFlowId);

    expect(finalFlow).toBeDefined();
    expect(finalFlow!.webhookExecutionCount).toBe(2); // 2 total executions
    expect(finalFlow!.webhookFailureCount).toBe(1); // 1 failure

    console.log(
      `Final counts: executions=${finalFlow!.webhookExecutionCount}, failures=${finalFlow!.webhookFailureCount}`
    );
  });

  it('should not track counts for non-webhook executions (direct execution)', async () => {
    // 1. Create a BubbleFlow
    const createFlowResponse = await TestApp.post('/bubble-flow', {
      name: 'Direct Execution Test Flow',
      description:
        'Testing that direct executions do not affect webhook counts',
      code: simpleBubbleFlowCode,
      eventType: 'webhook/http',
      webhookActive: true,
    });

    expect(createFlowResponse.status).toBe(201);
    const flowData = (await createFlowResponse.json()) as any;
    createdBubbleFlowId = flowData.id;

    // 2. Execute directly (not via webhook) - should NOT affect counters
    const directResponse = await TestApp.post(
      `/bubble-flow/${createdBubbleFlowId}/execute`,
      {
        test: 'direct execution',
      }
    );
    expect(directResponse.status).toBe(200);

    // 3. Check counts remain 0
    const listResponse = await TestApp.get('/bubble-flow');
    expect(listResponse.status).toBe(200);
    const listData = (await listResponse.json()) as z.infer<
      typeof bubbleFlowListResponseSchema
    >;

    const ourFlow = listData.bubbleFlows.find(
      (f) => f.id === createdBubbleFlowId
    );

    expect(ourFlow).toBeDefined();
    expect(ourFlow?.webhookExecutionCount).toBe(0); // Should still be 0
    expect(ourFlow?.webhookFailureCount).toBe(0); // Should still be 0

    console.log(
      `Direct execution counts: executions=${ourFlow?.webhookExecutionCount}, failures=${ourFlow?.webhookFailureCount}`
    );
  });
});
