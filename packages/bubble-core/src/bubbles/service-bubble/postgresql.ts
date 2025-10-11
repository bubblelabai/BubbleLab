import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import {
  CredentialType,
  type DatabaseMetadata,
} from '@bubblelab/shared-schemas';
import { Pool, type QueryResult } from 'pg';

// Define available SQL operations
export const SqlOperations = z.enum([
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'WITH', // Common Table Expressions for complex analysis
  'EXPLAIN', // Query execution plans for optimization
  'ANALYZE', // Table statistics for analysis
  'SHOW', // Show database/table information
  'DESCRIBE', // Describe table structure
  'DESC', // Alias for DESCRIBE
  'CREATE', // Allow CREATE TEMPORARY for analysis
]);
type SqlOperation = z.output<typeof SqlOperations>;
// Define the parameters schema for the PostgreSQL bubble
const PostgreSQLParamsSchema = z.object({
  ignoreSSL: z
    .boolean()
    .default(true)
    .describe('Ignore SSL certificate errors when connecting to the database'),
  query: z
    .string()
    .min(1, 'Query is required')
    .refine((query) => {
      // Basic SQL injection patterns to reject
      const suspiciousPatterns = [
        /;\s*--/, // Comment injection
        /;\s*\/\*/, // Block comment injection
        /'\s*;\s*drop/i, // Drop table injection
        /;\s*delete\s+from/i, // Delete injection via semicolon
        /;\s*insert\s+into/i, // Insert injection via semicolon
        /;\s*update\s+\w+\s+set/i, // Update injection via semicolon
        /'\s*;\s*alter/i, // Alter injection
        /'\s*;\s*create/i, // Create injection
        /union\s+select/i, // Union select injection
        /'\s*or\s+1\s*=\s*1/i, // Classic OR injection
        /'\s*or\s+true/i, // OR true injection
        /'\s*and\s+1\s*=\s*1/i, // AND injection
        /exec\s*\(/i, // Stored procedure execution
        /sp_/i, // System stored procedures
        /xp_/i, // Extended stored procedures
        /declare\s+@/i, // Variable declaration
        /cast\s*\(/i, // Type casting (can be used maliciously)
        /convert\s*\(/i, // Type conversion
        /waitfor\s+delay/i, // Time-based attacks
        /benchmark\s*\(/i, // MySQL benchmark attacks
        /sleep\s*\(/i, // Sleep attacks
        /load_file\s*\(/i, // File reading attacks
        /into\s+outfile/i, // File writing attacks
        /information_schema.*password/i, // Block password-related schema probing
        /pg_stat_/i, // PostgreSQL statistics
        /pg_user/i, // PostgreSQL user info
        /current_user\s*\(\)/i, // Function call for user enumeration (but allow current_user as column)
        /session_user/i, // Session enumeration
        /version\s*\(/i, // Version enumeration
        /\bxp_cmdshell\b/i, // Command execution
        /\bdbms_/i, // Oracle DBMS packages
        /\butl_/i, // Oracle UTL packages
      ];

      return !suspiciousPatterns.some((pattern) => pattern.test(query));
    }, 'Query contains potentially dangerous SQL patterns')
    .describe(
      'SQL query to execute against the PostgreSQL database (use parameterized queries with $1, $2, etc.)'
    ),
  allowedOperations: z
    .array(SqlOperations)
    .default([
      'SELECT',
      'WITH',
      'EXPLAIN',
      'ANALYZE',
      'SHOW',
      'DESCRIBE',
      'DESC',
    ])
    .describe(
      'List of allowed SQL operations for security (defaults to read-only operations)'
    ),
  parameters: z
    .array(z.unknown())
    .optional()
    .default([])
    .describe(
      'Parameters for parameterized queries (e.g., [value1, value2] for $1, $2)'
    ),
  timeout: z
    .number()
    .positive()
    .default(30000)
    .describe(
      'Query timeout in milliseconds (default: 30 seconds, max recommended: 300000)'
    ),
  maxRows: z
    .number()
    .positive()
    .default(1000)
    .describe(
      'Maximum number of rows to return to prevent large result sets (default: 1000)'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

type PostgreSQLParamsInput = z.input<typeof PostgreSQLParamsSchema>;
type PostgreSQLParams = z.output<typeof PostgreSQLParamsSchema>;

// Define the result schema for validation
const PostgreSQLResultSchema = z.object({
  rows: z
    .array(z.record(z.unknown()))
    .describe(
      'Array of result rows, each row is an object with column names as keys'
    ),
  rowCount: z
    .number()
    .nullable()
    .describe('Number of rows affected by the query (null for SELECT queries)'),
  command: z
    .string()
    .describe('SQL command that was executed (SELECT, INSERT, UPDATE, DELETE)'),
  fields: z
    .array(
      z.object({
        name: z.string().describe('Column name'),
        dataTypeID: z.number().describe('PostgreSQL data type identifier'),
      })
    )
    .optional()
    .describe('Metadata about the columns returned by the query'),
  executionTime: z.number().describe('Query execution time in milliseconds'),
  success: z.boolean().describe('Whether the query executed successfully'),
  // Make error optional or undefined
  error: z
    .string()
    .describe(
      'Error message if query execution failed (empty string if successful)'
    ),
  cleanedJSONString: z
    .string()
    .describe(
      'Clean JSON string representation of the row data, suitable for AI prompts and integrations'
    ),
});

type PostgreSQLResult = z.output<typeof PostgreSQLResultSchema>;

// Example usage:
//   const pgBubble = new PostgreSQLBubble({
//   connectionString: 'postgresql://user:pass@localhost:5432/db',
//   ignoreSSL: false, // Set to true to ignore SSL certificate errors
//   query: 'SELECT * FROM users WHERE active = $1 AND role = $2',
//   parameters: [true, 'admin'],
//   allowedOperations: ['SELECT'],
//   maxRows: 100,
//   timeout: 30000,
//   returnCleanedJSONString: true, // Optional: return results as cleaned JSON string
// });
export class PostgreSQLBubble extends ServiceBubble<
  PostgreSQLParams,
  PostgreSQLResult
> {
  public async testCredential(): Promise<boolean> {
    // Make a query to the database to test the credential
    const connectionString = this.chooseCredential();
    const pool = new Pool({
      connectionString,
      ssl: this.params.ignoreSSL ? { rejectUnauthorized: false } : undefined,
    });

    try {
      await pool.query('SELECT 1');
      return true;
    } finally {
      await pool.end();
    }
  }
  static readonly type = 'service' as const;
  static readonly service = 'postgresql';
  static readonly authType = 'connection-string' as const;
  // Required static metadata - TypeScript will enforce these exist
  static readonly bubbleName = 'postgresql';
  static readonly schema = PostgreSQLParamsSchema;
  static readonly resultSchema = PostgreSQLResultSchema;
  static readonly shortDescription =
    'Execute PostgreSQL queries with operation validation';
  static readonly longDescription = `
    Execute SQL queries against PostgreSQL databases with proper validation and security controls.
    Use cases:
    - Data retrieval with SELECT queries
    - Data manipulation with INSERT, UPDATE, DELETE (when explicitly allowed)
    - Database reporting and analytics
    - Data migration and synchronization tasks
    - JSON string output for integration with other systems
    
    Security Features:
    - Operation whitelist (defaults to SELECT only)
    - Parameterized queries to prevent SQL injection
    - Connection timeout controls
    - Result sanitization for JSON output
  `;
  static readonly alias = 'pg';

  constructor(
    params: PostgreSQLParamsInput = {
      query: 'SELECT 1',
      allowedOperations: ['SELECT'],
      parameters: [],
      timeout: 30000,
      maxRows: 1000,
    },
    context?: BubbleContext
  ) {
    super(params, context);

    // Perform additional validation after Zod schema validation
    this.validateSqlOperation(this.params.query, this.params.allowedOperations);
    this.validateParameterUsage(this.params.query, this.params.parameters);
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<PostgreSQLResult> {
    // Context is available but not currently used in this implementation
    void context;

    const {
      ignoreSSL,
      query,
      allowedOperations,
      parameters,
      timeout,
      maxRows,
    } = this.params;
    const startTime = Date.now();

    // Validate the SQL operation against allowed operations
    this.validateSqlOperation(query, allowedOperations);

    // Additional validation: ensure parameters are used for any dynamic values
    this.validateParameterUsage(query, parameters);

    // Create connection pool with strict settings
    // Use chooseCredential to get the appropriate credential
    const connectionString = this.chooseCredential();

    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeout,
      idleTimeoutMillis: timeout,
      max: 1, // Single connection for bubble execution
      allowExitOnIdle: true, // Exit when idle
      statement_timeout: timeout, // Query timeout
      ssl: ignoreSSL ? { rejectUnauthorized: false } : undefined, // SSL configuration
    });

    try {
      // Execute the query with parameters (prevents SQL injection)
      const result: QueryResult = await pool.query(query, parameters);
      const executionTime = Date.now() - startTime;

      // Additional safety: truncate rows if they exceed maxRows
      const truncatedRows = result.rows.slice(0, maxRows);
      const wasTruncated = result.rows.length > maxRows;

      if (wasTruncated) {
        console.warn(`Result set truncated to ${maxRows} rows`);
      }

      return {
        rows: truncatedRows,
        rowCount: result.rowCount,
        command: result.command,
        fields: result.fields?.map((field) => ({
          name: field.name,
          dataTypeID: field.dataTypeID,
        })),
        executionTime,
        success: true,
        error: '',
        cleanedJSONString: this.cleanJSONString(truncatedRows),
      };
    } finally {
      // Always close the pool
      await pool.end();
    }
  }

  async getCredentialMetadata(): Promise<DatabaseMetadata | undefined> {
    const connectionString = this.chooseCredential();
    if (!connectionString) {
      return undefined;
    }

    const pool = new Pool({
      connectionString,
      ssl: this.params.ignoreSSL ? { rejectUnauthorized: false } : undefined,
    });

    try {
      // Query all schemas, not just 'public'
      const schemaQuery = `
        SELECT 
          t.table_schema,
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name 
          AND t.table_schema = c.table_schema
        WHERE t.table_type = 'BASE TABLE'
          AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY t.table_schema, t.table_name, c.ordinal_position
      `;

      const result = await pool.query(schemaQuery);
      const rawData = result.rows;

      // Process the schema data into the same compact format as database-analyzer
      // Tables from 'public' schema will not have schema prefix, others will
      const compactSchema: Record<string, Record<string, string>> = {};

      rawData.forEach((row) => {
        const tableSchema = row.table_schema as string;
        const tableName = row.table_name as string;
        const columnName = row.column_name as string;
        const dataType = row.data_type as string;

        // Format table name: public schema tables have no prefix, others have schema prefix
        const formattedTableName = `${tableSchema}.${tableName}`;

        if (!compactSchema[formattedTableName]) {
          compactSchema[formattedTableName] = {};
        }
        compactSchema[formattedTableName][columnName] = dataType;
      });

      return {
        tables: compactSchema,
        databaseName: 'postgresql_database',
        databaseType: 'postgresql' as const,
      };
    } catch (error) {
      console.error('Error getting credential metadata:', error);
      return undefined;
    } finally {
      await pool.end();
    }
  }

  /**
   * Validate that the SQL query operation is allowed
   */
  private validateSqlOperation(
    query: string,
    allowedOperations: SqlOperation[]
  ): void {
    // Extract the first SQL keyword (operation) from the query
    const trimmedQuery = query.trim().toUpperCase();
    const firstKeyword = trimmedQuery.split(/\s+/)[0];

    // Check if the operation is in the allowed list
    const isAllowed = allowedOperations.some((op) =>
      firstKeyword.startsWith(op)
    );

    if (!isAllowed) {
      throw new Error(
        `SQL operation '${firstKeyword}' is not allowed. Allowed operations: ${allowedOperations.join(', ')}`
      );
    }

    // Additional validation for dangerous operations
    if (firstKeyword === 'DELETE' && !trimmedQuery.includes('WHERE')) {
      throw new Error('DELETE queries must include a WHERE clause for safety');
    }

    if (firstKeyword === 'UPDATE' && !trimmedQuery.includes('WHERE')) {
      throw new Error('UPDATE queries must include a WHERE clause for safety');
    }

    // Block potentially dangerous keywords using word boundaries
    // Allow CREATE TEMPORARY for analysis but block permanent CREATE operations
    const dangerousKeywords = [
      '\\bDROP\\b',
      '\\bALTER\\b',
      '\\bTRUNCATE\\b',
      '\\bGRANT\\b',
      '\\bREVOKE\\b',
      '\\bCOPY\\b',
      '\\bBULK\\b',
      '\\bLOAD\\b',
    ];

    const containsDangerous = dangerousKeywords.some((keyword) =>
      new RegExp(keyword, 'i').test(trimmedQuery)
    );

    if (containsDangerous) {
      throw new Error(
        `Query contains potentially dangerous operations. This bubble only supports: ${allowedOperations.join(', ')}`
      );
    }

    // Validate parentheses balance to prevent injection through unclosed strings
    this.validateParenthesesBalance(query);
  }

  /**
   * Validate parameter usage to encourage parameterized queries
   */
  private validateParameterUsage(query: string, parameters: unknown[]): void {
    // Count parameter placeholders ($1, $2, etc.)
    const paramPlaceholders = (query.match(/\$\d+/g) || []).length;

    if (paramPlaceholders !== parameters.length) {
      throw new Error(
        `Parameter count mismatch: query has ${paramPlaceholders} placeholders but ${parameters.length} parameters provided`
      );
    }

    // Warn if query contains string literals with potential variables
    const hasStringLiterals = /['"][^'"]*\$[^'"]*['"]/.test(query);
    if (hasStringLiterals) {
      console.warn(
        'Query contains string literals with $ symbols. Consider using parameterized queries.'
      );
    }
  }

  /**
   * Validate parentheses and quotes are balanced
   */
  private validateParenthesesBalance(query: string): void {
    let parenCount = 0;
    let singleQuoteCount = 0;
    let doubleQuoteCount = 0;

    for (const char of query) {
      switch (char) {
        case '(':
          parenCount++;
          break;
        case ')':
          parenCount--;
          break;
        case "'":
          singleQuoteCount++;
          break;
        case '"':
          doubleQuoteCount++;
          break;
      }
    }

    if (parenCount !== 0) {
      throw new Error('Unbalanced parentheses in query');
    }

    if (singleQuoteCount % 2 !== 0) {
      throw new Error('Unbalanced single quotes in query');
    }

    if (doubleQuoteCount % 2 !== 0) {
      throw new Error('Unbalanced double quotes in query');
    }
  }

  /**
   * Clean and format query results as a JSON string
   */
  private cleanJSONString(rows: Record<string, unknown>[]): string {
    try {
      // Clean the data by removing any potential circular references and handling special values
      const cleanedRows = rows.map((row) => this.cleanObject(row));

      // Return just the essential data as a clean JSON string
      return JSON.stringify(cleanedRows, null, 2);
    } catch (error) {
      // Fallback to basic JSON stringify if cleaning fails
      console.warn('Failed to clean JSON data, using basic stringify:', error);
      return JSON.stringify(rows, null, 2);
    }
  }

  /**
   * Clean an object by handling special values and preventing circular references
   */
  private cleanObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj instanceof Buffer) {
      return `<Buffer ${obj.length} bytes>`;
    }

    if (typeof obj === 'function') {
      return '<function>';
    }

    if (typeof obj === 'symbol') {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip functions and symbols as keys
        if (typeof key === 'string') {
          cleaned[key] = this.cleanObject(value);
        }
      }
      return cleaned;
    }

    return obj;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params;

    // If no credentials were injected, return undefined
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No postgres credentials provided');
    }

    // PostgreSQL bubble always uses database credentials
    return credentials[CredentialType.DATABASE_CRED];
  }
}
