// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db } from '../db/index.js';
import { bubbleFlows, webhooks, bubbleFlowExecutions } from '../db/schema.js';
import { inArray } from 'drizzle-orm';
import '../config/env.js';
import type {
  CreateBubbleFlowResponse,
  WebhookExecutionResponse,
  ErrorResponse,
} from '../schemas/index.js';
import { TestApp } from '../test/test-app.js';

// Interface for test execution data to avoid any types
interface TestExecutionData {
  success: boolean;
  receivedPayload: {
    type: string;
    path: string;
    body: unknown;
  };
  message: string;
  timestamp: string;
}

// Simple BubbleFlow code for testing
const testBubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class TestWebhookFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    return {
      success: true,
      receivedPayload: payload,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}`;

describe('Webhook Integration Tests', () => {
  let createdFlowIds: number[] = [];

  beforeEach(async () => {
    // Clean up any existing test flows
    createdFlowIds = [];
  });

  afterEach(async () => {
    // Clean up created flows
    if (createdFlowIds.length > 0) {
      await db
        .delete(bubbleFlowExecutions)
        .where(inArray(bubbleFlowExecutions.bubbleFlowId, createdFlowIds));
      await db
        .delete(webhooks)
        .where(inArray(webhooks.bubbleFlowId, createdFlowIds));
      await db
        .delete(bubbleFlows)
        .where(inArray(bubbleFlows.id, createdFlowIds));
    }
  });

  describe('1. Creating webhooks with and without path', () => {
    it('should create webhook with provided path', async () => {
      const response = await TestApp.post('/bubble-flow', {
        name: 'Test Flow with Custom Path',
        description: 'Testing webhook with custom path',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookPath: 'custom-test-path',
        webhookActive: true,
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as CreateBubbleFlowResponse;
      createdFlowIds.push(result.id);

      expect(result.id).toBeTypeOf('number');
      expect(result.message).toBe('BubbleFlow created successfully');
      expect(result.webhook).toBeDefined();
      expect(result.webhook?.path).toBe('custom-test-path');
      expect(result.webhook?.url).toContain('custom-test-path');
      expect(result.webhook?.active).toBe(true);
    });

    it('should create webhook with auto-generated path when none provided', async () => {
      const response = await TestApp.post('/bubble-flow', {
        name: 'Test Flow with Auto Path',
        description: 'Testing webhook with auto-generated path',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as CreateBubbleFlowResponse;
      createdFlowIds.push(result.id);

      expect(result.id).toBeTypeOf('number');
      expect(result.webhook).toBeDefined();
      expect(result.webhook?.path).toBeTypeOf('string');
      expect(result.webhook?.path?.length).toBe(12); // nanoid generates 12 chars
      expect(result.webhook?.url).toContain(result.webhook?.path);
      expect(result.webhook?.active).toBe(true);
    });

    it('should create webhook even for non-webhook event types', async () => {
      const response = await TestApp.post('/bubble-flow', {
        name: 'Test Slack Flow with Webhook',
        description: 'Testing webhook for slack event',
        code: testBubbleFlowCode,
        eventType: 'slack/bot_mentioned',
        webhookPath: 'slack-test',
        webhookActive: true,
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as CreateBubbleFlowResponse;
      createdFlowIds.push(result.id);

      expect(result.webhook).toBeDefined();
      expect(result.webhook?.path).toBe('slack-test');
    });
  });

  describe('2. Posting to webhook and payload passing', () => {
    let webhookPath: string;
    let flowId: number;

    beforeEach(async () => {
      // Create a flow for testing
      const createResponse = await TestApp.post('/bubble-flow', {
        name: 'Payload Test Flow',
        description: 'Testing payload passing',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookPath: 'payload-test',
        webhookActive: true,
      });

      const createResult =
        (await createResponse.json()) as CreateBubbleFlowResponse;
      flowId = createResult.id;
      webhookPath = createResult.webhook!.path;
      createdFlowIds.push(flowId);
    });

    it('should successfully execute webhook and pass payload', async () => {
      const testPayload = {
        message: 'Hello webhook!',
        data: { count: 42, active: true },
        timestamp: new Date().toISOString(),
      };

      const response = await TestApp.post(
        `/webhook/1/${webhookPath}`,
        testPayload
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as WebhookExecutionResponse;

      expect(result.success).toBe(true);
      expect(result.executionId).toBeTypeOf('number');
      expect(result.webhook.userId).toBe('1');
      expect(result.webhook.path).toBe('payload-test');
      expect(result.webhook.method).toBe('POST');
      expect(result.data).toBeDefined();

      // Verify the payload was passed correctly
      const executionData = result.data as TestExecutionData;
      expect(executionData.success).toBe(true);
      expect(executionData.receivedPayload).toBeDefined();
      expect(executionData.receivedPayload.body).toEqual(testPayload);
      expect(executionData.receivedPayload.type).toBe('webhook/http');
      expect(executionData.receivedPayload.path).toBe(
        '/webhook/1/payload-test'
      );
    });

    it('should handle empty payload', async () => {
      const response = await TestApp.post(`/webhook/1/${webhookPath}`, {});

      expect(response.status).toBe(200);
      const result = (await response.json()) as WebhookExecutionResponse;

      expect(result.success).toBe(true);
      const executionData = result.data as TestExecutionData;
      expect(executionData.receivedPayload.body).toEqual({});
    });
  });

  describe('3. Posting to inactive webhook', () => {
    let webhookPath: string;
    let flowId: number;

    beforeEach(async () => {
      // Create an inactive webhook
      const createResponse = await TestApp.post('/bubble-flow', {
        name: 'Inactive Webhook Flow',
        description: 'Testing inactive webhook',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookPath: 'inactive-test',
        webhookActive: false, // Inactive webhook
      });

      const createResult =
        (await createResponse.json()) as CreateBubbleFlowResponse;
      flowId = createResult.id;
      webhookPath = createResult.webhook!.path;
      createdFlowIds.push(flowId);
    });

    it('should reject requests to inactive webhook', async () => {
      const response = await TestApp.post(`/webhook/1/${webhookPath}`, {
        test: 'data',
      });

      expect(response.status).toBe(403);
      const result = (await response.json()) as ErrorResponse;

      expect(result.error).toBe('Webhook inactive');
      expect(result.details).toContain('not active');
    });
  });

  describe('4. Posting to non-existing webhook', () => {
    it('should return 404 for non-existing webhook path', async () => {
      const response = await TestApp.post('/webhook/1/non-existing-path', {
        test: 'data',
      });

      expect(response.status).toBe(404);
      const result = (await response.json()) as ErrorResponse;

      expect(result.error).toBe('Webhook not found');
      expect(result.details).toContain('/webhook/1/non-existing-path');
    });

    it('should return 404 for non-existing user ID', async () => {
      const response = await TestApp.post('/webhook/999/some-path', {
        test: 'data',
      });

      expect(response.status).toBe(404);
      const result = (await response.json()) as ErrorResponse;

      expect(result.error).toBe('Webhook not found');
      expect(result.details).toContain('/webhook/999/some-path');
    });
  });

  describe('5. Creating flow with invalid event type', () => {
    it('should reject invalid event type when creating webhook', async () => {
      const response = await TestApp.post('/bubble-flow', {
        name: 'Invalid Event Type Flow',
        description: 'Testing invalid event type',
        code: testBubbleFlowCode,
        eventType: 'invalid/event/type',
        webhookPath: 'invalid-event',
        webhookActive: true,
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as ErrorResponse;

      expect(result.error).toBe('Invalid event type for webhook');
      expect(result.details).toContain('invalid/event/type');
      expect(result.details).toContain(
        'not a valid BubbleTriggerEventRegistry key'
      );
    });

    it('should accept valid event types', async () => {
      const validEventTypes = [
        'webhook/http',
        'slack/bot_mentioned',
        'slack/message_received',
        'gmail/email_received',
        'schedule/cron/daily',
      ];

      for (const eventType of validEventTypes) {
        const response = await TestApp.post('/bubble-flow', {
          name: `Valid ${eventType} Flow`,
          description: `Testing ${eventType} event type`,
          code: testBubbleFlowCode,
          eventType,
          webhookActive: true,
        });

        expect(response.status).toBe(201);
        const result = (await response.json()) as CreateBubbleFlowResponse;
        createdFlowIds.push(result.id);

        expect(result.webhook).toBeDefined();
      }
    });
  });

  describe('Duplicate webhook path handling', () => {
    it('should reject duplicate webhook paths for same user', async () => {
      // Create first flow with specific path
      const firstResponse = await TestApp.post('/bubble-flow', {
        name: 'First Flow',
        description: 'First flow with path',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookPath: 'duplicate-test',
        webhookActive: true,
      });

      expect(firstResponse.status).toBe(201);
      const firstResult =
        (await firstResponse.json()) as CreateBubbleFlowResponse;
      createdFlowIds.push(firstResult.id);

      // Try to create second flow with same path
      const secondResponse = await TestApp.post('/bubble-flow', {
        name: 'Second Flow',
        description: 'Second flow with same path',
        code: testBubbleFlowCode,
        eventType: 'webhook/http',
        webhookPath: 'duplicate-test',
        webhookActive: true,
      });

      expect(secondResponse.status).toBe(400);
      const secondResult = (await secondResponse.json()) as ErrorResponse;

      expect(secondResult.error).toBe('Webhook path already exists');
      expect(secondResult.details).toContain('duplicate-test');
      expect(secondResult.details).toContain('already in use');
    });
  });
});
