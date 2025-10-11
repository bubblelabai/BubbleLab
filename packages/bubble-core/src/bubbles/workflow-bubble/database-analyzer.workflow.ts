import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import { PostgreSQLBubble } from '../service-bubble/postgresql.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Parameter schema with user-friendly names and clear descriptions
const DatabaseAnalyzerParamsSchema = z.object({
  /**
   * The data source service to analyze (currently supports 'postgresql')
   */
  dataSourceType: z
    .enum(['postgresql'])
    .describe('Data source type to analyze'),

  /**
   * Whether to ignore SSL certificate errors when connecting
   */
  ignoreSSLErrors: z
    .boolean()
    .default(false)
    .describe('Ignore SSL certificate errors'),

  /**
   * Include additional metadata like enum values and constraints
   */
  includeMetadata: z
    .boolean()
    .default(true)
    .describe('Include enum values and column constraints'),

  /**
   * Injected credentials from the system
   */
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),

  /**
   * Injected metadata from user credentials (database schema notes and rules)
   */
  injectedMetadata: z
    .object({
      tables: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      tableNotes: z.record(z.string(), z.string()).optional(),
      rules: z.array(z.string()).optional(),
    })
    .optional()
    .describe(
      'Additional database context injected from user credentials metadata'
    ),
});

// Result schema with structured database schema information
const DatabaseAnalyzerResultSchema = z.object({
  success: z.boolean(),
  error: z.string(),

  /**
   * The analyzed database schema in structured format
   */
  databaseSchema: z
    .object({
      /**
       * Raw schema data as returned by the database
       */
      rawData: z.array(z.record(z.unknown())).optional(),

      /**
       * Cleaned JSON string representation of the schema
       */
      cleanedJSON: z.string().optional(),

      /**
       * Number of tables found
       */
      tableCount: z.number().optional(),

      /**
       * List of table names
       */
      tableNames: z.array(z.string()).optional(),
    })
    .optional(),

  /**
   * Summary of the analysis operation
   */
  analysisSummary: z
    .object({
      dataSourceType: z.string(),
      connectionSuccessful: z.boolean(),
      analysisTimestamp: z.date(),
    })
    .optional(),
});

type DatabaseAnalyzerResult = z.output<typeof DatabaseAnalyzerResultSchema>;
type DatabaseAnalyzerParamsInput = z.input<typeof DatabaseAnalyzerParamsSchema>;
type DatabaseAnalyzerParams = z.output<typeof DatabaseAnalyzerParamsSchema>;

/**
 * DatabaseAnalyzerWorkflowBubble - Analyzes database schema structure
 *
 * This workflow bubble simplifies database schema analysis by:
 * 1. Connecting to the specified database
 * 2. Querying the information schema to get table/column structure
 * 3. Extracting metadata like enum values and constraints
 * 4. Returning structured schema information ready for AI analysis
 *
 * Common use cases:
 * - Data discovery and cataloging
 * - Generating queries based on schema structure
 * - Database documentation generation
 * - AI-powered data analysis preparation
 */
export class DatabaseAnalyzerWorkflowBubble extends WorkflowBubble<
  DatabaseAnalyzerParams,
  DatabaseAnalyzerResult
> {
  static readonly type = 'workflow' as const;
  static readonly bubbleName = 'database-analyzer';
  static readonly schema = DatabaseAnalyzerParamsSchema;
  static readonly resultSchema = DatabaseAnalyzerResultSchema;
  static readonly shortDescription =
    'Analyzes database schema structure and metadata';
  static readonly longDescription =
    'Connects to a database and extracts comprehensive schema information including tables, columns, data types, constraints, and enum values. Perfect for AI-powered data analysis, query generation, and database documentation. Currently supports PostgreSQL with plans for additional database types.';
  static readonly alias = 'analyze-db';

  constructor(params: DatabaseAnalyzerParamsInput, context?: BubbleContext) {
    super(params, context);
  }

  protected async performAction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context?: BubbleContext
  ): Promise<DatabaseAnalyzerResult> {
    const {
      dataSourceType,
      ignoreSSLErrors,
      includeMetadata,
      credentials,
      injectedMetadata,
    } = this.params;

    try {
      console.log(
        `[DatabaseAnalyzer] Starting schema analysis for ${dataSourceType}`
      );

      // Currently only PostgreSQL is supported
      if (dataSourceType !== 'postgresql') {
        return {
          success: false,
          error: `Unsupported data source type: ${dataSourceType}. Currently only PostgreSQL is supported.`,
        };
      }

      // Build the schema query based on metadata requirements
      const schemaQuery = this.buildPostgreSQLSchemaQuery(includeMetadata);

      // Execute the schema analysis using PostgreSQL bubble
      const postgresqlBubble = new PostgreSQLBubble(
        {
          query: schemaQuery,
          ignoreSSL: ignoreSSLErrors,
          allowedOperations: [
            'SELECT',
            'WITH',
            'EXPLAIN',
            'ANALYZE',
            'SHOW',
            'DESCRIBE',
            'DESC',
            'CREATE',
          ], // Allow analytical operations
          timeout: 30000, // 30 second timeout
          maxRows: 1000, // Limit to prevent excessive data
          ...(credentials && { credentials }),
        },
        this.context
      );

      console.log('[DatabaseAnalyzer] Executing schema query...');
      const schemaResult = await postgresqlBubble.action();

      if (!schemaResult.success) {
        return {
          success: false,
          error: `Failed to analyze database schema: ${schemaResult.error}`,
        };
      }

      // Process the schema data
      const rawData = schemaResult.data?.rows as
        | Array<Record<string, unknown>>
        | undefined;

      // Extract table names with schema formatting: public schema tables have no prefix, others have schema prefix
      const tableNames = rawData
        ? Array.from(
            new Set(
              rawData.map((row) => {
                const tableSchema = row.table_schema as string;
                const tableName = row.table_name as string;
                return tableSchema === 'public'
                  ? tableName
                  : `${tableSchema}.${tableName}`;
              })
            )
          )
        : [];

      // Create compact schema format: {table: {column: type}}
      let compactCleanedJSON = '';
      if (rawData) {
        const compactSchema: Record<string, Record<string, string>> = {};

        rawData.forEach((row) => {
          const tableSchema = row.table_schema as string;
          const tableName = row.table_name as string;
          const columnName = row.column_name as string;
          const dataType = row.data_type as string;

          // Format table name: public schema tables have no prefix, others have schema prefix
          const formattedTableName =
            tableSchema === 'public'
              ? tableName
              : `${tableSchema}.${tableName}`;

          if (!compactSchema[formattedTableName]) {
            compactSchema[formattedTableName] = {};
          }
          compactSchema[formattedTableName][columnName] = dataType;
        });
        // Merge injected metadata if available
        const enhancedSchema: any = { ...compactSchema };

        if (injectedMetadata) {
          console.log('[DatabaseAnalyzer] Injecting metadata into schema...');

          // Merge table column notes
          if (injectedMetadata.tables) {
            for (const [tableName, columns] of Object.entries(
              injectedMetadata.tables
            )) {
              if (enhancedSchema[tableName]) {
                // Add column notes as metadata
                for (const [columnName, note] of Object.entries(columns)) {
                  if (enhancedSchema[tableName][columnName]) {
                    // Append note to column type
                    enhancedSchema[tableName][columnName] =
                      `${enhancedSchema[tableName][columnName]} /* ${note} */`;
                  }
                }
              }
            }
          }

          // Add metadata section with strict rules and table notes
          enhancedSchema._metadata = {
            critical_instructions:
              'STRICTLY FOLLOW ALL RULES AND TABLE NOTES BELOW. These are mandatory requirements.',
            ...(injectedMetadata.rules && {
              rules: [
                '🚨 CRITICAL: You must strictly adhere to ALL rules listed below:',
                ...injectedMetadata.rules,
              ],
            }),
            ...(injectedMetadata.tableNotes && {
              tableNotes: [
                '⚠️ IMPORTANT: Pay special attention to these table descriptions and usage notes:',
                ...Object.entries(injectedMetadata.tableNotes).map(
                  ([table, note]) => `${table}: ${note}`
                ),
              ],
            }),
            source: 'database-analyzer-with-injected-context',
          };
        }

        // Generate ultra-compact JSON (no whitespace)
        compactCleanedJSON = JSON.stringify(enhancedSchema);

        console.log(
          `[DatabaseAnalyzer] Schema analysis completed. Found ${tableNames.length} tables. ${
            injectedMetadata
              ? `Injected metadata ${injectedMetadata.rules?.length} rules and ${injectedMetadata.tableNotes?.length} table notes`
              : ''
          }`
        );
      }

      return {
        success: true,
        error: '',
        databaseSchema: {
          rawData,
          cleanedJSON: compactCleanedJSON,
          tableCount: tableNames.length,
          tableNames,
        },
        analysisSummary: {
          dataSourceType,
          connectionSuccessful: true,
          analysisTimestamp: new Date(),
        },
      };
    } catch (error) {
      console.error('[DatabaseAnalyzer] Workflow execution failed:', error);

      return {
        success: false,
        error: `Database analysis workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        analysisSummary: {
          dataSourceType,
          connectionSuccessful: false,
          analysisTimestamp: new Date(),
        },
      };
    }
  }

  /**
   * Builds the PostgreSQL schema query based on metadata requirements
   */
  private buildPostgreSQLSchemaQuery(includeMetadata: boolean): string {
    const baseQuery = `
      SELECT 
        t.table_schema,
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.ordinal_position`;

    const metadataQuery = includeMetadata
      ? `
        ,
        -- Include enum values for USER-DEFINED types
        CASE 
          WHEN c.data_type = 'USER-DEFINED' THEN (
            SELECT array_to_string(array_agg(e.enumlabel ORDER BY e.enumsortorder), ', ')
            FROM pg_type pt
            JOIN pg_enum e ON pt.oid = e.enumtypid
            WHERE pt.typname = c.udt_name
          )
          ELSE NULL
        END as enum_values,
        
        -- Include character maximum length for string types
        c.character_maximum_length,
        
        -- Include numeric precision and scale
        c.numeric_precision,
        c.numeric_scale`
      : '';

    const fromClause = `
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY t.table_schema, t.table_name, c.ordinal_position`;

    return baseQuery + metadataQuery + fromClause;
  }
}
