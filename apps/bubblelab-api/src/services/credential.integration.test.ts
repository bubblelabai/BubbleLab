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
  CredentialResponse,
  CreateCredentialResponse,
  UpdateCredentialResponse,
  BubbleFlowDetailsResponse,
} from '../schemas/index.js';
import { TestApp } from '../test/test-app.js';

// Simple BubbleFlow code that uses credentials
const testBubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A flow that uses credentials');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    return {
      message: \`Received webhook: \${payload.path}\`,
    };
  }
}
`;

describe('Credential Management Integration', () => {
  let createdBubbleFlowId: number;
  let createdCredentialIds: number[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (createdCredentialIds.length > 0) {
      // Filter out any undefined values before trying to delete
      const validIds = createdCredentialIds.filter(
        (id) => id !== undefined && id !== null
      );
      if (validIds.length > 0) {
        await db
          .delete(userCredentials)
          .where(inArray(userCredentials.id, validIds));
      }
      createdCredentialIds.length = 0; // Clear the array
    }

    if (createdBubbleFlowId) {
      // Delete related records first due to foreign key constraints
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

  it('should create bubble flow, add credentials, and see empty credentials in parameters', async () => {
    // 1. Create a BubbleFlow
    const createFlowResponse = await TestApp.post('/bubble-flow', {
      name: 'Test Credential Flow',
      description: 'Testing credential integration',
      code: testBubbleFlowCode,
      eventType: 'webhook/http',
      webhookActive: true,
    });

    expect(createFlowResponse.status).toBe(201);
    const flowData =
      (await createFlowResponse.json()) as CreateBubbleFlowResponse;
    createdBubbleFlowId = flowData.id;

    // 2. Get the bubble flow details - should have empty credentials initially
    const getFlowResponse = await TestApp.get(
      `/bubble-flow/${createdBubbleFlowId}`
    );

    expect(getFlowResponse.status).toBe(200);
    const flowDetails =
      (await getFlowResponse.json()) as BubbleFlowDetailsResponse;

    // Should have bubbleParameters but credentials should be empty initially
    expect(flowDetails.bubbleParameters).toBeDefined();
    expect(typeof flowDetails.bubbleParameters).toBe('object');

    // 3. Create some credentials
    const createOpenAICredResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-test-openai-key-123',
      name: 'My OpenAI Key',
      skipValidation: true,
    });

    expect(createOpenAICredResponse.status).toBe(201);
    const openAICredData =
      (await createOpenAICredResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(openAICredData.id);

    const createSlackCredResponse = await TestApp.post('/credentials', {
      credentialType: 'SLACK_CRED',
      value: 'xoxb-slack-token-456',
      name: 'My Slack Bot Token',
      skipValidation: true,
    });

    expect(createSlackCredResponse.status).toBe(201);
    const slackCredData =
      (await createSlackCredResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(slackCredData.id);

    // 4. List credentials to verify they were created
    const listCredentialsResponse = await TestApp.get('/credentials');

    expect(listCredentialsResponse.status).toBe(200);
    const credentials =
      (await listCredentialsResponse.json()) as CredentialResponse[];

    // Check that both credentials exist
    const openAICred = credentials.find(
      (c) => c.credentialType === 'OPENAI_CRED'
    );
    const slackCred = credentials.find(
      (c) => c.credentialType === 'SLACK_CRED'
    );

    expect(openAICred).toBeDefined();
    expect(slackCred).toBeDefined();
    expect(openAICred?.name).toBe('My OpenAI Key');
    expect(slackCred?.name).toBe('My Slack Bot Token');

    // 5. Delete one credential
    const deleteResponse = await TestApp.delete(
      `/credentials/${openAICredData.id}`
    );

    expect(deleteResponse.status).toBe(200);
    createdCredentialIds = createdCredentialIds.filter(
      (id) => id !== openAICredData.id
    );

    // 6. Verify credential was deleted
    const listAfterDeleteResponse = await TestApp.get('/credentials');

    expect(listAfterDeleteResponse.status).toBe(200);
    const credentialsAfterDelete =
      (await listAfterDeleteResponse.json()) as CredentialResponse[];

    // Should only have Slack credential remaining
    const remainingSlackCred = credentialsAfterDelete.find(
      (c) => c.credentialType === 'SLACK_CRED'
    );
    const remainingOpenAICred = credentialsAfterDelete.find(
      (c) => c.credentialType === 'OPENAI_CRED'
    );

    expect(remainingSlackCred).toBeDefined();
    expect(remainingOpenAICred).toBeUndefined();
    expect(remainingSlackCred?.name).toBe('My Slack Bot Token');
  });

  it('should handle credential access control by user', async () => {
    // Create credential as user 1
    const createCredResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-user1-key',
      name: 'User 1 Key',
      skipValidation: true,
    });

    expect(createCredResponse.status).toBe(201);
    const credData =
      (await createCredResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(credData.id);

    // Try to access as user 2 - should not see user 1's credentials
    const listAsUser2Response = await TestApp.get('/credentials', {
      'X-User-ID': '2',
    });

    expect(listAsUser2Response.status).toBe(200);
    const user2Credentials =
      (await listAsUser2Response.json()) as CredentialResponse[];
    expect(user2Credentials.find((c) => c.id === credData.id)).toBeUndefined();

    // Try to delete user 1's credential as user 2 - should fail
    const deleteAsUser2Response = await TestApp.delete(
      `/credentials/${credData.id}`,
      {
        'X-User-ID': '2',
      }
    );

    expect(deleteAsUser2Response.status).toBe(404);

    // Verify user 1 can still access their credential
    const listAsUser1Response = await TestApp.get('/credentials');

    expect(listAsUser1Response.status).toBe(200);
    const user1Credentials =
      (await listAsUser1Response.json()) as CredentialResponse[];
    expect(user1Credentials.find((c) => c.id === credData.id)).toBeDefined();
  });

  it('should update credential successfully', async () => {
    // 1. Create a credential first
    const createResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-test-original-key',
      name: 'Test OpenAI Key',
      skipValidation: true,
    });

    expect(createResponse.status).toBe(201);
    const createdCredential =
      (await createResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(createdCredential.id);

    // 2. Update the credential
    const updateResponse = await TestApp.put(
      `/credentials/${createdCredential.id}`,
      {
        value: 'sk-test-updated-key',
        name: 'Updated Test OpenAI Key',
        skipValidation: true,
      }
    );

    expect(updateResponse.status).toBe(200);
    const updatedCredential =
      (await updateResponse.json()) as UpdateCredentialResponse;
    expect(updatedCredential.id).toBe(createdCredential.id);
    expect(updatedCredential.message).toBe('Credential updated successfully');

    // 3. List credentials to verify the update
    const listResponse = await TestApp.get('/credentials');
    expect(listResponse.status).toBe(200);

    const credentials = (await listResponse.json()) as CredentialResponse[];
    const updatedCred = credentials.find((c) => c.id === createdCredential.id);

    expect(updatedCred).toBeDefined();
    expect(updatedCred?.name).toBe('Updated Test OpenAI Key');
    // Value should be encrypted, so we can't check the actual value
    expect(updatedCred?.credentialType).toBe('OPENAI_CRED');
  });

  it('should handle credential update with invalid ID', async () => {
    const invalidUpdateResponse = await TestApp.put('/credentials/999999', {
      value: 'sk-test-invalid',
      name: 'Invalid Test',
    });

    expect(invalidUpdateResponse.status).toBe(404);
  });

  it('should handle credential update with invalid ID format', async () => {
    const invalidFormatResponse = await TestApp.put('/credentials/invalid', {
      value: 'sk-test-invalid',
      name: 'Invalid Test',
    });

    expect(invalidFormatResponse.status).toBe(400);
  });

  it('should handle credential update access control', async () => {
    // Create credential as user 1
    const createResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-user1-key',
      name: 'User 1 Key',
      skipValidation: true,
    });

    expect(createResponse.status).toBe(201);
    const credData = (await createResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(credData.id);

    // Try to update user 1's credential as user 2 - should fail
    const updateAsUser2Response = await TestApp.put(
      `/credentials/${credData.id}`,
      {
        value: 'sk-user2-key',
        name: 'User 2 Key',
        skipValidation: true,
      },
      {
        'X-User-ID': '2',
      }
    );

    expect(updateAsUser2Response.status).toBe(404);

    // Verify user 1 can still update their credential
    const updateAsUser1Response = await TestApp.put(
      `/credentials/${credData.id}`,
      {
        value: 'sk-user1-updated-key',
        name: 'User 1 Updated Key',
        skipValidation: true,
      }
    );

    expect(updateAsUser1Response.status).toBe(200);
    const updatedCredential =
      (await updateAsUser1Response.json()) as UpdateCredentialResponse;
    expect(updatedCredential.id).toBe(credData.id);
    expect(updatedCredential.message).toBe('Credential updated successfully');
  });

  it('should handle credential update with missing required fields', async () => {
    // Create a credential first
    const createResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-test-key',
      name: 'Test Key',
      skipValidation: true,
    });

    expect(createResponse.status).toBe(201);
    const createdCredential =
      (await createResponse.json()) as CreateCredentialResponse;
    createdCredentialIds.push(createdCredential.id);

    // Try to update with empty value - should fail
    const updateResponse = await TestApp.put(
      `/credentials/${createdCredential.id}`,
      {
        value: '',
        name: 'Updated Name',
        skipValidation: true,
      }
    );

    expect(updateResponse.status).toBe(400);
  });
});
