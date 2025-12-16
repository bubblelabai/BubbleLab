// @ts-expect-error - Bun test
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import { injectCredentialsIntoBubbleParameters } from './bubble-parameters.js';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../services/bubble-factory-instance.js';
import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';

describe('injectCredentialsIntoBubbleParameters', () => {
  it('should inject credentials into bubble parameters for context request flow', async () => {
    const flowCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class GetSchemaFlow extends BubbleFlow<'webhook/http'> {
  async handle() {
    const pg = new PostgreSQLBubble({
      query: \`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position;
      \`
    });

    const result = await pg.action();
    
    if (!result.success) {
      throw new Error(\`Failed to fetch schema: \${result.error}\`);
    }

    return {
      schema: result.data.rows
    };
  }
}
`;

    const credentials = {
      DATABASE_CRED: 74,
    };

    // Validate and extract bubble parameters
    const bubbleFactory = await getBubbleFactory();
    const validationResult = await validateAndExtract(
      flowCode,
      bubbleFactory,
      false
    );

    if (!validationResult.valid) {
      throw new Error(
        `Flow validation failed: ${validationResult.errors?.join(', ')}`
      );
    }

    const parsedBubbles = validationResult.bubbleParameters || {};
    const requiredCredentials = validationResult.requiredCredentials || {};

    // Convert variable IDs to strings if they're numbers (validateAndExtract may return numbers)
    const parsedBubblesStr: Record<string, ParsedBubbleWithInfo> = {};
    for (const [varId, bubble] of Object.entries(parsedBubbles)) {
      parsedBubblesStr[String(varId)] = bubble;
    }

    // requiredCredentials uses bubbleName as key, so we can pass it as-is
    const requiredCredentialsStr: Record<string, string[]> = {};
    for (const [bubbleName, credTypes] of Object.entries(requiredCredentials)) {
      requiredCredentialsStr[bubbleName] = credTypes.map((ct) => String(ct));
    }

    // Inject credentials
    const result = injectCredentialsIntoBubbleParameters(
      parsedBubblesStr,
      requiredCredentialsStr,
      credentials
    );

    // Verify credentials are found in bubble parameters
    // Success means credentials are present in at least one bubble
    let credentialsFound = false;

    for (const bubble of Object.values(result)) {
      const credParam = bubble.parameters.find((p) => p.name === 'credentials');
      if (credParam && credParam.value) {
        const credValue = credParam.value as Record<string, number>;
        // Check if DATABASE_CRED (as string key) is present with value 74
        if (credValue['DATABASE_CRED'] === 74) {
          credentialsFound = true;
          break;
        }
      }
    }

    expect(credentialsFound).toBe(true);
  });

  it('should inject credentials into all bubbles with the same bubbleName', async () => {
    const flowCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class MultiPostgresFlow extends BubbleFlow<'webhook/http'> {
  async handle() {
    const pg1 = new PostgreSQLBubble({
      query: 'SELECT * FROM users LIMIT 10;'
    });

    const pg2 = new PostgreSQLBubble({
      query: 'SELECT * FROM orders LIMIT 10;'
    });

    const result1 = await pg1.action();
    const result2 = await pg2.action();

    return {
      users: result1.data?.rows || [],
      orders: result2.data?.rows || []
    };
  }
}
`;

    const credentials = {
      DATABASE_CRED: 74,
    };

    // Validate and extract bubble parameters
    const bubbleFactory = await getBubbleFactory();
    const validationResult = await validateAndExtract(
      flowCode,
      bubbleFactory,
      false
    );

    if (!validationResult.valid) {
      throw new Error(
        `Flow validation failed: ${validationResult.errors?.join(', ')}`
      );
    }

    const parsedBubbles = validationResult.bubbleParameters || {};
    const requiredCredentials = validationResult.requiredCredentials || {};

    // Convert variable IDs to strings if they're numbers
    const parsedBubblesStr: Record<string, ParsedBubbleWithInfo> = {};
    for (const [varId, bubble] of Object.entries(parsedBubbles)) {
      parsedBubblesStr[String(varId)] = bubble;
    }

    // requiredCredentials uses bubbleName as key
    const requiredCredentialsStr: Record<string, string[]> = {};
    for (const [bubbleName, credTypes] of Object.entries(requiredCredentials)) {
      requiredCredentialsStr[bubbleName] = credTypes.map((ct) => String(ct));
    }

    // Inject credentials
    const result = injectCredentialsIntoBubbleParameters(
      parsedBubblesStr,
      requiredCredentialsStr,
      credentials
    );

    // Count how many PostgreSQL bubbles we have
    const postgresBubbles = Object.values(result).filter(
      (bubble) => bubble.bubbleName === 'postgresql'
    );

    // Verify all PostgreSQL bubbles have credentials injected
    expect(postgresBubbles.length).toBeGreaterThan(0);

    let allBubblesHaveCredentials = true;
    for (const bubble of postgresBubbles) {
      const credParam = bubble.parameters.find((p) => p.name === 'credentials');
      if (!credParam || !credParam.value) {
        allBubblesHaveCredentials = false;
        break;
      }
      const credValue = credParam.value as Record<string, number>;
      if (credValue['DATABASE_CRED'] !== 74) {
        allBubblesHaveCredentials = false;
        break;
      }
    }

    expect(allBubblesHaveCredentials).toBe(true);
    expect(postgresBubbles.length).toBeGreaterThanOrEqual(2); // Should have at least 2 PostgreSQL bubbles
  });
});
