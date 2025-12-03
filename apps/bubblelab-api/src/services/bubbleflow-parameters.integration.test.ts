// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db } from '../db/index.js';
import {
  bubbleFlows,
  userCredentials,
  webhooks,
  bubbleFlowExecutions,
} from '../db/schema.js';
import { inArray } from 'drizzle-orm';
import '../config/env.js';
import type {
  CreateBubbleFlowResponse,
  BubbleFlowDetailsResponse,
  ExecuteBubbleFlowResponse,
  CredentialResponse,
} from '../schemas/index.js';
import { TestApp } from '../test/test-app.js';

// BubbleFlow code that uses PostgreSQL bubble
const postgresBubbleFlowCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  queryResult?: unknown;
}

export class PostgresTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('postgres-test-flow', 'A flow that tests PostgreSQL bubble parameters');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const postgres = new PostgreSQLBubble({
      query: "SELECT 'Hello World' as greeting",
      ignoreSSL: true
    });
    
    try {
      const result = await postgres.action();
      return {
        message: 'PostgreSQL query executed successfully',
        queryResult: result,
      };
    } catch (error) {
      return {
        message: \`PostgreSQL query failed: \${error instanceof Error ? error.message : String(error)}\`,
      };
    }
  }
}
`;

describe('BubbleFlow Parameters Integration', () => {
  let createdBubbleFlowId: number;
  let createdCredentialIds: number[] = [];

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (createdCredentialIds.length > 0) {
      await db
        .delete(userCredentials)
        .where(inArray(userCredentials.id, createdCredentialIds));
      createdCredentialIds = [];
    }

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

  it('should create bubble flow with postgres bubble and update its parameters', async () => {
    // 1. Create a PostgreSQL credential first
    const TEST_DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/postgres';
    const createCredResponse = await TestApp.post('/credentials', {
      credentialType: 'DATABASE_CRED',
      value: TEST_DATABASE_URL,
      name: 'Test Database Connection',
      skipValidation: true, // Skip validation since PostgreSQL might not be running locally
    });

    expect(createCredResponse.status).toBe(201);
    const credData = (await createCredResponse.json()) as CredentialResponse;
    createdCredentialIds.push(credData.id);

    // 2. Create a BubbleFlow with PostgreSQL bubble
    const createFlowResponse = await TestApp.post('/bubble-flow', {
      name: 'PostgreSQL Test Flow',
      description: 'Testing PostgreSQL bubble parameter updates',
      code: postgresBubbleFlowCode,
      eventType: 'webhook/http',
      webhookActive: true,
    });

    if (createFlowResponse.status !== 201) {
      const errorData = await createFlowResponse.json();
      console.log('Flow creation failed:', JSON.stringify(errorData, null, 2));
    }
    expect(createFlowResponse.status).toBe(201);
    const flowData =
      (await createFlowResponse.json()) as CreateBubbleFlowResponse;
    createdBubbleFlowId = flowData.id;

    // 3. Get the bubble flow details to see initial parameters
    const getFlowResponse = await TestApp.get(
      `/bubble-flow/${createdBubbleFlowId}`
    );

    expect(getFlowResponse.status).toBe(200);
    const flowDetails =
      (await getFlowResponse.json()) as BubbleFlowDetailsResponse;

    expect(flowDetails.bubbleParameters).toBeDefined();

    // 4. Execute the flow to see initial result
    const executeResponse = await TestApp.post(
      `/bubble-flow/${createdBubbleFlowId}/execute`,
      {
        payload: { test: 'initial execution' },
      }
    );

    const executeResult =
      (await executeResponse.json()) as ExecuteBubbleFlowResponse;

    const postgrestId = Object.keys(flowDetails.bubbleParameters).find(
      (key) =>
        flowDetails.bubbleParameters[key].className === 'PostgreSQLBubble'
    );

    // 5. Update the bubble parameters to add credential mapping
    const existingParams = flowDetails.bubbleParameters as Record<
      string,
      unknown
    >;
    const postgresParams = existingParams[postgrestId!] as
      | { parameters?: unknown[] }
      | undefined;

    const updateParams = {
      ...flowDetails.bubbleParameters,
      // Add credential ID to the postgres bubble parameters
      [postgrestId!]: {
        ...postgresParams,
        parameters: [
          ...(postgresParams?.parameters || []),
          {
            name: 'credentials',
            value: { DATABASE_CRED: credData.id },
            type: 'object',
          },
        ],
      },
    };

    const updateResponse = await TestApp.put(
      `/bubble-flow/${createdBubbleFlowId}`,
      {
        bubbleParameters: updateParams,
      }
    );

    expect(updateResponse.status).toBe(200);

    // 6. Get updated flow details to verify changes
    const getUpdatedFlowResponse = await TestApp.get(
      `/bubble-flow/${createdBubbleFlowId}`
    );

    expect(getUpdatedFlowResponse.status).toBe(200);
    (await getUpdatedFlowResponse.json()) as BubbleFlowDetailsResponse;

    // 7. Execute again to see if parameters took effect
    const executeAgainResponse = await TestApp.post(
      `/bubble-flow/${createdBubbleFlowId}/execute`,
      {
        payload: { test: 'execution with updated parameters' },
      }
    );

    // 8. Execute with streaming route (SSE)
    const executeStreamResponse = await TestApp.post(
      `/bubble-flow/${createdBubbleFlowId}/execute-stream`,
      {
        payload: { test: 'execution with updated parameters' },
      }
    );

    expect(executeStreamResponse.status).toBe(200);
    // Should be Server-Sent Events
    const contentType = executeStreamResponse.headers.get('content-type') || '';
    expect(contentType.includes('text/event-stream')).toBe(true);
    const streamText = await executeStreamResponse.text();
    // Basic SSE shape checks
    expect(streamText.includes('event:')).toBe(true);
    expect(streamText.includes('data:')).toBe(true);
    // Stream should complete
    expect(streamText.includes('event: stream_complete')).toBe(true);

    const executeAgainResult =
      (await executeAgainResponse.json()) as ExecuteBubbleFlowResponse;
    console.log(executeAgainResult);

    expect(executeAgainResult.success).toBe(true);

    // Verify that both executions were successful
    expect(executeResult.success).toBe(true);
    expect(executeAgainResult.success).toBe(true);
  }, 30000); // Set timeout to 30 seconds
});
