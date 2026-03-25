import { BubbleFlow } from '../../../bubble-flow/bubble-flow-class.js';
import { SnowflakeBubble } from './snowflake.js';
import type { WebhookEvent } from '@bubblelab/shared-schemas';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * Integration test flow for Snowflake bubble.
 * Exercises all operations end-to-end against a real Snowflake account.
 *
 * Prerequisites:
 * - Snowflake account with key-pair auth configured
 * - SNOWFLAKE_CRED credential set up with account, username, privateKey
 * - A warehouse available (e.g., COMPUTE_WH)
 */
export class SnowflakeIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List databases
    const listDbResult = await new SnowflakeBubble({
      operation: 'list_databases',
    }).action();

    results.push({
      operation: 'list_databases',
      success: listDbResult.success,
      details: listDbResult.success
        ? `Found ${listDbResult.databases?.length ?? 0} databases`
        : listDbResult.error,
    });

    // 2. Execute SQL — create a test database
    const testDbName = `BUBBLELAB_TEST_${Date.now()}`;
    const createDbResult = await new SnowflakeBubble({
      operation: 'execute_sql',
      statement: `CREATE DATABASE IF NOT EXISTS "${testDbName}"`,
    }).action();

    results.push({
      operation: 'execute_sql (CREATE DATABASE)',
      success: createDbResult.success,
      details: createDbResult.success
        ? `Created database ${testDbName}`
        : createDbResult.error,
    });

    if (!createDbResult.success) {
      return { testResults: results };
    }

    try {
      // 3. List schemas in the new database
      const listSchemasResult = await new SnowflakeBubble({
        operation: 'list_schemas',
        database: testDbName,
      }).action();

      results.push({
        operation: 'list_schemas',
        success: listSchemasResult.success,
        details: listSchemasResult.success
          ? `Found ${listSchemasResult.schemas?.length ?? 0} schemas (should include PUBLIC, INFORMATION_SCHEMA)`
          : listSchemasResult.error,
      });

      // 4. Create a test table with various column types
      const createTableResult = await new SnowflakeBubble({
        operation: 'execute_sql',
        statement: `CREATE TABLE "${testDbName}"."PUBLIC"."test_table" (
          id INT AUTOINCREMENT,
          name VARCHAR NOT NULL,
          email VARCHAR,
          amount DECIMAL(10,2),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
          notes TEXT
        )`,
      }).action();

      results.push({
        operation: 'execute_sql (CREATE TABLE)',
        success: createTableResult.success,
        details: createTableResult.success
          ? 'Created test_table with 7 columns'
          : createTableResult.error,
      });

      // 5. Insert test data with edge cases
      const insertResult = await new SnowflakeBubble({
        operation: 'execute_sql',
        statement: `INSERT INTO "${testDbName}"."PUBLIC"."test_table" (name, email, amount, notes) VALUES
          ('Alice O''Brien', 'alice@test.com', 1500.50, 'Regular customer'),
          ('Bob "Bobby" Smith', 'bob@test.com', 3200.00, NULL),
          ('Carol & Dave LLC', 'carol@test.com', 0.01, 'Unicode: \u00e9\u00e8\u00ea')`,
      }).action();

      results.push({
        operation: 'execute_sql (INSERT with edge cases)',
        success: insertResult.success,
        details: insertResult.success
          ? 'Inserted 3 rows with special characters, NULL, and unicode'
          : insertResult.error,
      });

      // 6. List tables
      const listTablesResult = await new SnowflakeBubble({
        operation: 'list_tables',
        database: testDbName,
        schema: 'PUBLIC',
      }).action();

      results.push({
        operation: 'list_tables',
        success: listTablesResult.success,
        details: listTablesResult.success
          ? `Found ${listTablesResult.tables?.length ?? 0} tables: ${listTablesResult.tables?.map((t) => t.name).join(', ')}`
          : listTablesResult.error,
      });

      // 7. Describe table
      const describeResult = await new SnowflakeBubble({
        operation: 'describe_table',
        database: testDbName,
        schema: 'PUBLIC',
        table: 'test_table',
      }).action();

      results.push({
        operation: 'describe_table',
        success: describeResult.success,
        details: describeResult.success
          ? `Found ${describeResult.columns?.length ?? 0} columns: ${describeResult.columns?.map((c) => `${c.name} (${c.type})`).join(', ')}`
          : describeResult.error,
      });

      // 8. Query data back
      const queryResult = await new SnowflakeBubble({
        operation: 'execute_sql',
        statement: `SELECT name, email, amount FROM "${testDbName}"."PUBLIC"."test_table" ORDER BY name`,
      }).action();

      results.push({
        operation: 'execute_sql (SELECT)',
        success: queryResult.success,
        details: queryResult.success
          ? `Retrieved ${queryResult.num_rows ?? 0} rows, ${queryResult.columns?.length ?? 0} columns`
          : queryResult.error,
      });
    } finally {
      // Cleanup: drop the test database
      const dropResult = await new SnowflakeBubble({
        operation: 'execute_sql',
        statement: `DROP DATABASE IF EXISTS "${testDbName}"`,
      }).action();

      results.push({
        operation: 'execute_sql (DROP DATABASE cleanup)',
        success: dropResult.success,
        details: dropResult.success
          ? `Dropped ${testDbName}`
          : dropResult.error,
      });
    }

    return { testResults: results };
  }
}
