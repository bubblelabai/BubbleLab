import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { PostgreSQLBubble } from '../service-bubble/postgresql.js';

// Define the parameters schema
const SQLQueryToolParamsSchema = z.object({
  query: z
    .string()
    .describe(
      'SQL query to execute (SELECT, WITH, EXPLAIN, ANALYZE, SHOW, DESCRIBE only)'
    ),
  reasoning: z
    .string()
    .describe(
      "Explain why you're running this specific query and what you hope to learn from it"
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Database credentials (injected at runtime)'),
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Configuration for the tool bubble'),
});

// Type definitions
type SQLQueryToolParamsInput = z.input<typeof SQLQueryToolParamsSchema>;
type SQLQueryToolParams = z.output<typeof SQLQueryToolParamsSchema>;
type SQLQueryToolResult = z.output<typeof SQLQueryToolResultSchema>;

// Result schema for validation
const SQLQueryToolResultSchema = z.object({
  // Query results
  rows: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Array of query result rows as objects'),
  rowCount: z.number().describe('Number of rows returned by the query'),

  // Metadata
  executionTime: z.number().describe('Query execution time in milliseconds'),
  fields: z
    .array(
      z.object({
        name: z.string().describe('Name of the column'),
        dataTypeID: z
          .number()
          .optional()
          .describe('PostgreSQL data type ID for the column'),
      })
    )
    .optional()
    .describe('Array of column metadata from the query result'),

  // Standard result fields
  success: z.boolean().describe('Whether the query execution was successful'),
  error: z.string().describe('Error message if query execution failed'),
});

/**
 * SQLQueryTool - Execute SQL queries against PostgreSQL databases
 *
 * This tool bubble provides a safe, read-only interface for AI agents to query
 * PostgreSQL databases. It's designed for data analysis, exploration, and
 * business intelligence tasks.
 */
export class SQLQueryTool extends ToolBubble<
  SQLQueryToolParams,
  SQLQueryToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'sql-query-tool';
  static readonly schema = SQLQueryToolParamsSchema;
  static readonly resultSchema = SQLQueryToolResultSchema;
  static readonly shortDescription =
    'Execute read-only SQL queries against PostgreSQL databases for data analysis';
  static readonly longDescription = `
    A tool bubble that provides safe, read-only SQL query execution against PostgreSQL databases.
    
    Features:
    - Execute SELECT, WITH, EXPLAIN, ANALYZE, SHOW, and DESCRIBE queries
    - Automatic query timeout and row limit enforcement (30s timeout, 1000 rows max)
    - Clean JSON formatting of results for AI consumption
    - Detailed execution metadata including timing and row counts
    
    Security:
    - Read-only operations enforced
    - Query timeout protection (30 seconds)
    - Row limit protection (1000 rows max)
    
    Use cases:
    - AI agents performing iterative database exploration
    - Data analysis and business intelligence queries
    - Schema discovery and table introspection
    - Performance analysis with EXPLAIN queries
    - Automated reporting and data extraction
  `;
  static readonly alias = 'sql';

  constructor(params: SQLQueryToolParamsInput, context?: BubbleContext) {
    super(params, context);
  }

  async performAction(context?: BubbleContext): Promise<SQLQueryToolResult> {
    void context; // Context available but not currently used
    const startTime = Date.now();

    try {
      // Log query execution
      console.debug(`\n🔍 [SQLQueryTool] Executing SQL query...`);
      console.debug(`💭 [SQLQueryTool] Reasoning: ${this.params.reasoning}`);
      console.debug(
        `📝 [SQLQueryTool] Query: ${this.params.query.substring(0, 200)}${this.params.query.length > 200 ? '...' : ''}`
      );

      // Create PostgreSQL bubble with default settings
      const pgBubble = new PostgreSQLBubble(
        {
          query: this.params.query,
          allowedOperations: [
            'SELECT',
            'WITH',
            'EXPLAIN',
            'ANALYZE',
            'SHOW',
            'DESCRIBE',
            'DESC',
          ],
          timeout: 30000, // 30 seconds
          maxRows: 1000, // Reasonable limit for analysis
          credentials: this.params.credentials,
          ...(this.params.config || {}),
        },
        this.context
      );

      // Execute the query
      const result = await pgBubble.action();
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        console.log(`❌ [SQLQueryTool] Query failed: ${result.error}`);
        return {
          rowCount: 0,
          executionTime,
          success: false,
          error: result.error,
        };
      }

      const rowCount = result.data?.rowCount || result.data?.rows?.length || 0;
      console.log(`✅ [SQLQueryTool] Query successful:`);
      console.log(`📊 [SQLQueryTool] Rows returned: ${rowCount}`);
      console.log(`⏱️  [SQLQueryTool] Execution time: ${executionTime}ms`);
      return {
        rows: result.data?.rows,
        rowCount,
        executionTime,
        fields: result.data?.fields,
        success: true,
        error: '',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.log(`💥 [SQLQueryTool] Query error: ${errorMessage}`);

      return {
        rowCount: 0,
        executionTime,
        success: false,
        error: errorMessage,
      };
    }
  }
}
