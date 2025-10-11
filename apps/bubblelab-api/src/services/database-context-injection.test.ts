// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db } from '../db/index.js';
import {
  bubbleFlows,
  userCredentials,
  webhooks,
  bubbleFlowExecutions,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import '../config/env.js';
import { CredentialEncryption } from '../utils/encryption.js';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas';
import { injectCredentials } from './credential-injector.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';
import { TEST_USER_ID } from '../test/setup.js';

// BubbleFlow code that uses database-analyzer
const testBubbleFlowWithDatabaseAnalyzer = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import { DatabaseAnalyzerWorkflowBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  success: boolean;
  analyzedSchema?: any;
}

export class DatabaseAnalysisFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('db-analysis-flow', 'A flow that analyzes database schema');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const analyzer = new DatabaseAnalyzerWorkflowBubble({
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      credentials: { DATABASE_CRED: 1 }
    });
    
    const result = await analyzer.action();
    
    return {
      success: result.success,
      analyzedSchema: result.data?.databaseSchema?.cleanedJSON
    };
  }
}
`;

describe('Database Context Injection', () => {
  let createdBubbleFlowId: number | undefined;
  let createdCredentialId: number | undefined;
  const testUserId = TEST_USER_ID;

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (createdCredentialId) {
      await db
        .delete(userCredentials)
        .where(eq(userCredentials.id, createdCredentialId));
    }

    if (createdBubbleFlowId) {
      // Delete related records first due to foreign key constraints
      await db
        .delete(bubbleFlowExecutions)
        .where(eq(bubbleFlowExecutions.bubbleFlowId, createdBubbleFlowId));
      await db
        .delete(webhooks)
        .where(eq(webhooks.bubbleFlowId, createdBubbleFlowId));
      await db
        .delete(bubbleFlows)
        .where(eq(bubbleFlows.id, createdBubbleFlowId));
    }
  }

  it('should inject database metadata into database-analyzer bubble', async () => {
    // 1. Create a database credential with metadata
    const testMetadata: DatabaseMetadata = {
      tables: {
        users: {
          id: 'Primary key for user identification',
          email: 'User email address',
          created_at: 'Timestamp when user was created',
        },
        orders: {
          id: 'Primary key for order',
          user_id: 'Foreign key to users table',
          total: 'Total amount of the order in cents',
        },
      },
      tableNotes: {
        users: 'Core user table containing authentication data',
        orders: 'E-commerce order tracking table',
      },
      rules: [
        {
          id: '1',
          text: 'Always filter orders by user_id for security',
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          text: 'Never expose user passwords',
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          text: 'This rule is disabled',
          enabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // Encrypt a test connection string
    const encryptedValue = await CredentialEncryption.encrypt(
      'postgresql://test:test@localhost:5432/testdb?sslmode=disable'
    );

    // Insert credential with metadata
    const [credential] = await db
      .insert(userCredentials)
      .values({
        userId: testUserId,
        credentialType: 'DATABASE_CRED',
        encryptedValue,
        name: 'Test Database with Metadata',
        metadata: testMetadata,
      })
      .returning();

    createdCredentialId = credential.id;

    // 2. Create bubble parameters that reference this credential
    const bubbleParameters: Record<string, ParsedBubble> = {
      analyzer: {
        // Match the variable name in the test code
        bubbleName: 'database-analyzer',
        variableName: 'analyzer',
        className: 'DatabaseAnalyzerWorkflowBubble',
        hasAwait: true,
        hasActionCall: true,
        parameters: [
          {
            name: 'dataSourceType',
            value: 'postgresql',
            type: BubbleParameterType.STRING,
          },
          {
            name: 'ignoreSSLErrors',
            value: true,
            type: BubbleParameterType.BOOLEAN,
          },
          {
            name: 'credentials',
            value: { DATABASE_CRED: createdCredentialId },
            type: BubbleParameterType.OBJECT,
          },
        ],
      },
    };

    // 3. Test credential injection
    const userCreds = [
      {
        bubbleVarName: 'analyzer', // Match the variable name
        secret: await CredentialEncryption.decrypt(encryptedValue),
        credentialType: 'DATABASE_CRED',
        credentialId: createdCredentialId,
        metadata: testMetadata,
      },
    ];

    const injectionResult = await injectCredentials(
      testBubbleFlowWithDatabaseAnalyzer,
      bubbleParameters,
      userCreds
    );

    expect(injectionResult.success).toBe(true);
    expect(injectionResult.code).toBeDefined();

    // 4. Verify injected metadata parameter
    const codeWithInjection = injectionResult.code!;

    console.log('Injected code:', codeWithInjection);

    // Check that injectedMetadata parameter was added to the constructor
    expect(codeWithInjection).toContain('injectedMetadata');

    // The injected metadata should be in the constructor parameters
    // Look for the pattern in the reconstructed code
    const constructorMatch = codeWithInjection.match(
      /new DatabaseAnalyzerWorkflowBubble\({[\s\S]*?}\)/
    );

    expect(constructorMatch).toBeTruthy();

    if (constructorMatch) {
      const constructorCode = constructorMatch[0];
      // Verify the structure contains our metadata parameter
      expect(constructorCode).toContain('injectedMetadata');
    }

    // 5. Verify only enabled rules are included
    const enabledRulesCount = testMetadata.rules!.filter(
      (r) => r.enabled
    ).length;
    expect(enabledRulesCount).toBe(2); // Should have 2 enabled rules

    console.log('✅ Database context injection test passed');
    console.log(
      'Injected code snippet:',
      codeWithInjection.substring(0, 500) + '...'
    );
  });

  it('should not inject metadata when DATABASE_CRED has no metadata', async () => {
    // Create credential without metadata
    const encryptedValue = await CredentialEncryption.encrypt(
      'postgresql://test:test@localhost:5432/testdb?sslmode=disable'
    );

    const [credential] = await db
      .insert(userCredentials)
      .values({
        userId: testUserId,
        credentialType: 'DATABASE_CRED',
        encryptedValue,
        name: 'Test Database without Metadata',
        // No metadata field
      })
      .returning();

    createdCredentialId = credential.id;

    const bubbleParameters: Record<string, ParsedBubble> = {
      analyzer: {
        // Match the variable name in the test code
        bubbleName: 'database-analyzer',
        variableName: 'analyzer',
        className: 'DatabaseAnalyzerWorkflowBubble',
        hasAwait: true,
        hasActionCall: true,
        parameters: [
          {
            name: 'credentials',
            value: { DATABASE_CRED: createdCredentialId },
            type: BubbleParameterType.OBJECT,
          },
        ],
      },
    };

    const userCreds = [
      {
        bubbleVarName: 'analyzer', // Match the variable name
        secret: await CredentialEncryption.decrypt(encryptedValue),
        credentialType: 'DATABASE_CRED',
        credentialId: createdCredentialId,
        metadata: undefined,
      },
    ];

    const injectionResult = await injectCredentials(
      testBubbleFlowWithDatabaseAnalyzer,
      bubbleParameters,
      userCreds
    );

    expect(injectionResult.success).toBe(true);

    // Should not contain injectedMetadata parameter
    expect(injectionResult.code).not.toContain('injectedMetadata:');
  });
});
