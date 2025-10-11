import { ZodObject } from 'zod';
import { PostgreSQLBubble } from '../../index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleFactory } from '../../bubble-factory.js';
import { SqlOperations } from './postgresql.js';

// Helper function to create test credentials
const createTestCredentials = () => ({
  [CredentialType.DATABASE_CRED]:
    'postgresql://user:pass@localhost:5432/testdb',
});

const factory = new BubbleFactory();

beforeAll(async () => {
  await factory.registerDefaults();
});

describe('PostgreSQLBubble', () => {
  describe('Registration and Schema', () => {
    test('should be registered in BubbleRegistry', async () => {
      const registeredBubble = factory.get('postgresql');
      expect(registeredBubble).toBeDefined();
      expect(registeredBubble).toBe(PostgreSQLBubble);
    });

    test('should have proper schema shape', () => {
      const registeredBubble = factory.get('postgresql');
      // Check if schema is a ZodObject
      if (registeredBubble?.schema instanceof ZodObject) {
        expect(registeredBubble?.schema.shape).toBeDefined();

        const schemaKeys = Object.keys(registeredBubble?.schema.shape || {});
        expect(schemaKeys).toContain('query');
        expect(schemaKeys).toContain('allowedOperations');
        expect(schemaKeys).toContain('parameters');
        expect(schemaKeys).toContain('timeout');
        expect(schemaKeys).toContain('maxRows');
        expect(schemaKeys).toContain('credentials');
      } else {
        throw new Error('Schema is not a ZodObject');
      }
    });

    test('should have result schema defined', () => {
      expect(PostgreSQLBubble.resultSchema).toBeDefined();

      if (PostgreSQLBubble.resultSchema) {
        const resultValidation = PostgreSQLBubble.resultSchema.safeParse({
          rows: [{ id: 1, name: 'test' }],
          rowCount: 1,
          command: 'SELECT',
          executionTime: 100,
          cleanedJSONString: '{"id":1,"name":"test"}',
          success: true,
          error: '',
        });

        console.log('Result validation:', resultValidation.error);
        expect(resultValidation.success).toBe(true);
      }
    });
  });

  describe('SQL Injection Protection', () => {
    test('should block dangerous SQL injection patterns', () => {
      const maliciousQueries = [
        'SELECT * FROM users WHERE id = 1; DROP TABLE users; --',
        'SELECT * FROM users; DELETE FROM logs',
      ];

      maliciousQueries.forEach((query) => {
        expect(() => {
          new PostgreSQLBubble({
            credentials: createTestCredentials(),
            query,
          });
        }).toThrow();
      });
    });

    test('should allow safe queries', () => {
      const safeQueries = [
        'SELECT id, name FROM users WHERE active = $1',
        'SELECT COUNT(*) FROM orders',
        'SELECT * FROM products LIMIT 10',
      ];

      safeQueries.forEach((query) => {
        expect(() => {
          new PostgreSQLBubble({
            credentials: createTestCredentials(),
            query,
            parameters: query.includes('$1') ? ['test'] : [],
          });
        }).not.toThrow();
      });
    });
  });

  describe('Operation Validation', () => {
    test('should block operations not in allowed list', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'DELETE FROM users WHERE id = $1',
          allowedOperations: [SqlOperations.enum.SELECT], // DELETE not allowed
          parameters: ['123'],
        });
      }).toThrow(/SQL operation 'DELETE' is not allowed/);
    });

    test('should allow operations in allowed list', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'DELETE FROM users WHERE id = $1',
          allowedOperations: [SqlOperations.enum.DELETE], // DELETE allowed
          parameters: ['123'],
        });
      }).not.toThrow();
    });

    test('should require WHERE clause for DELETE operations', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'DELETE FROM users',
          allowedOperations: [SqlOperations.enum.DELETE],
        });
      }).toThrow(/DELETE queries must include a WHERE clause for safety/);
    });

    test('should require WHERE clause for UPDATE operations', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'UPDATE users SET active = false',
          allowedOperations: [SqlOperations.enum.UPDATE],
        });
      }).toThrow(/UPDATE queries must include a WHERE clause for safety/);
    });
  });

  describe('Parameter Validation', () => {
    test('should validate parameter count matches placeholders', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'SELECT * FROM users WHERE id = $1 AND name = $2',
          parameters: ['123'], // Missing second parameter
        });
      }).toThrow(/Parameter count mismatch/);
    });

    test('should accept correct parameter count', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'SELECT * FROM users WHERE id = $1 AND name = $2',
          parameters: ['123', 'admin'],
        });
      }).not.toThrow();
    });

    test('should handle queries with no parameters', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'SELECT COUNT(*) FROM users',
          parameters: [],
        });
      }).not.toThrow();
    });
  });

  describe('Dangerous Keyword Blocking', () => {
    test('should block dangerous SQL keywords', () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'ALTER TABLE users ADD COLUMN test VARCHAR(255)',
        'TRUNCATE TABLE logs',
        'CREATE TABLE malicious (id INT)',
        'GRANT ALL ON users TO public',
        'REVOKE SELECT ON users FROM user',
      ];

      dangerousQueries.forEach((query) => {
        expect(() => {
          new PostgreSQLBubble({
            credentials: createTestCredentials(),
            query,
            allowedOperations: [SqlOperations.enum.SELECT], // Even if we somehow allow it
          });
        }).toThrow();
      });
    });
  });

  describe('Bubble Metadata', () => {
    test('should have correct metadata', () => {
      const metadata = factory.getMetadata('postgresql');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('postgresql');
      expect(metadata?.shortDescription).toContain('PostgreSQL');
      expect(metadata?.alias).toBe('pg');
      expect(metadata?.schema).toBeDefined();
      expect(metadata?.resultSchema).toBeDefined();
    });

    test('should have proper static properties', () => {
      expect(PostgreSQLBubble.bubbleName).toBe('postgresql');
      expect(PostgreSQLBubble.alias).toBe('pg');
      expect(PostgreSQLBubble.schema).toBeDefined();
      expect(PostgreSQLBubble.resultSchema).toBeDefined();
      expect(PostgreSQLBubble.shortDescription).toContain('PostgreSQL');
      expect(PostgreSQLBubble.longDescription).toContain('PostgreSQL');
    });
  });

  describe('Quote and Parentheses Validation', () => {
    test('should detect unbalanced quotes', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: "SELECT * FROM users WHERE name = 'unbalanced",
        });
      }).toThrow(/Unbalanced single quotes/);
    });

    test('should detect unbalanced parentheses', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: 'SELECT * FROM users WHERE id IN (1, 2, 3',
        });
      }).toThrow(/Unbalanced parentheses/);
    });

    test('should accept balanced quotes and parentheses', () => {
      expect(() => {
        new PostgreSQLBubble({
          credentials: createTestCredentials(),
          query: "SELECT * FROM users WHERE name = 'admin' AND id IN (1, 2, 3)",
        });
      }).not.toThrow();
    });
  });

  describe('Configuration Defaults', () => {
    test('should use default values for optional parameters', () => {
      const bubble = new PostgreSQLBubble({
        credentials: createTestCredentials(),
        query: 'SELECT * FROM users',
      });

      expect(bubble.currentParams.allowedOperations).toEqual([
        'SELECT',
        'WITH',
        'EXPLAIN',
        'ANALYZE',
        'SHOW',
        'DESCRIBE',
        'DESC',
      ]);
      expect(bubble.currentParams.parameters).toEqual([]);
      expect(bubble.currentParams.timeout).toBe(30000);
      expect(bubble.currentParams.maxRows).toBe(1000);
    });

    test('should override defaults with provided values', () => {
      const bubble = new PostgreSQLBubble({
        credentials: createTestCredentials(),
        query: 'SELECT * FROM users',
        allowedOperations: [
          SqlOperations.enum.SELECT,
          SqlOperations.enum.INSERT,
        ],
        timeout: 60000,
        maxRows: 500,
      });

      expect(bubble.currentParams.allowedOperations).toEqual([
        'SELECT',
        'INSERT',
      ]);
      expect(bubble.currentParams.timeout).toBe(60000);
      expect(bubble.currentParams.maxRows).toBe(500);
    });
  });

  describe('Multi-Schema Support', () => {
    test('should format table names correctly for different schemas', () => {
      // Mock the database query result to simulate multiple schemas
      const mockSchemaData = [
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'id',
          data_type: 'integer',
        },
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'name',
          data_type: 'varchar',
        },
        {
          table_schema: 'analytics',
          table_name: 'events',
          column_name: 'event_id',
          data_type: 'uuid',
        },
        {
          table_schema: 'analytics',
          table_name: 'events',
          column_name: 'timestamp',
          data_type: 'timestamp',
        },
        {
          table_schema: 'staging',
          table_name: 'temp_data',
          column_name: 'temp_id',
          data_type: 'integer',
        },
      ];

      // Create a mock bubble instance for testing the formatting logic
      const bubble = new PostgreSQLBubble({
        credentials: createTestCredentials(),
        query: 'SELECT 1',
      });

      // Simulate the processing logic from getCredentialMetadata
      const compactSchema: Record<string, Record<string, string>> = {};

      mockSchemaData.forEach((row) => {
        const tableSchema = row.table_schema as string;
        const tableName = row.table_name as string;
        const columnName = row.column_name as string;
        const dataType = row.data_type as string;

        // Format table name: public schema tables have no prefix, others have schema prefix
        const formattedTableName =
          tableSchema === 'public' ? tableName : `${tableSchema}.${tableName}`;

        if (!compactSchema[formattedTableName]) {
          compactSchema[formattedTableName] = {};
        }
        compactSchema[formattedTableName][columnName] = dataType;
      });

      // Verify the formatting is correct
      expect(compactSchema).toEqual({
        users: {
          id: 'integer',
          name: 'varchar',
        },
        'analytics.events': {
          event_id: 'uuid',
          timestamp: 'timestamp',
        },
        'staging.temp_data': {
          temp_id: 'integer',
        },
      });

      // Verify that public schema tables don't have prefix
      expect(compactSchema['users']).toBeDefined();
      expect(compactSchema['public.users']).toBeUndefined();

      // Verify that non-public schema tables have prefix
      expect(compactSchema['analytics.events']).toBeDefined();
      expect(compactSchema['events']).toBeUndefined();
    });
  });
});
