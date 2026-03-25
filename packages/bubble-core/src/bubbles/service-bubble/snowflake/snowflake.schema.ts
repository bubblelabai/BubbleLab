import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Base credentials schema that all operations share
const BaseCredentialsSchema = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

// Column metadata schema for result sets
export const SnowflakeColumnSchema = z
  .object({
    name: z.string().describe('Column name'),
    type: z.string().describe('Snowflake data type'),
    nullable: z.boolean().optional().describe('Whether the column is nullable'),
  })
  .describe('Column metadata from Snowflake result set');

// Define the parameters schema for Snowflake operations
export const SnowflakeParamsSchema = z.discriminatedUnion('operation', [
  // Execute SQL operation
  z.object({
    operation: z
      .literal('execute_sql')
      .describe('Execute a SQL statement against Snowflake'),
    statement: z
      .string()
      .min(1, 'SQL statement is required')
      .describe('The SQL statement to execute'),
    database: z
      .string()
      .optional()
      .describe(
        'Database to use for this query (overrides credential default)'
      ),
    schema: z
      .string()
      .optional()
      .describe('Schema to use for this query (overrides credential default)'),
    warehouse: z
      .string()
      .optional()
      .describe(
        'Warehouse to use for this query (overrides credential default)'
      ),
    role: z
      .string()
      .optional()
      .describe('Role to use for this query (overrides credential default)'),
    timeout: z
      .number()
      .optional()
      .default(60)
      .describe('Query timeout in seconds (default 60)'),
    credentials: BaseCredentialsSchema,
  }),

  // List databases operation
  z.object({
    operation: z
      .literal('list_databases')
      .describe('List all databases in the Snowflake account'),
    credentials: BaseCredentialsSchema,
  }),

  // List schemas operation
  z.object({
    operation: z
      .literal('list_schemas')
      .describe('List all schemas in a database'),
    database: z
      .string()
      .min(1, 'Database name is required')
      .describe('Database to list schemas from'),
    credentials: BaseCredentialsSchema,
  }),

  // List tables operation
  z.object({
    operation: z.literal('list_tables').describe('List all tables in a schema'),
    database: z
      .string()
      .min(1, 'Database name is required')
      .describe('Database containing the schema'),
    schema: z
      .string()
      .min(1, 'Schema name is required')
      .describe('Schema to list tables from'),
    credentials: BaseCredentialsSchema,
  }),

  // Describe table operation
  z.object({
    operation: z
      .literal('describe_table')
      .describe('Get column definitions for a table'),
    database: z
      .string()
      .min(1, 'Database name is required')
      .describe('Database containing the table'),
    schema: z
      .string()
      .min(1, 'Schema name is required')
      .describe('Schema containing the table'),
    table: z
      .string()
      .min(1, 'Table name is required')
      .describe('Table to describe'),
    credentials: BaseCredentialsSchema,
  }),
]);

// Define result schemas for different operations
export const SnowflakeResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('execute_sql')
      .describe('Execute a SQL statement against Snowflake'),
    success: z.boolean().describe('Whether the operation was successful'),
    columns: z
      .array(SnowflakeColumnSchema)
      .optional()
      .describe('Column metadata for the result set'),
    rows: z
      .array(z.array(z.union([z.string(), z.null()])))
      .optional()
      .describe('Result rows as arrays of string values'),
    num_rows: z.number().optional().describe('Total number of rows returned'),
    statement_handle: z
      .string()
      .optional()
      .describe('Snowflake statement handle for the executed query'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('list_databases')
      .describe('List all databases in the Snowflake account'),
    success: z.boolean().describe('Whether the operation was successful'),
    databases: z
      .array(
        z.object({
          name: z.string().describe('Database name'),
          owner: z.string().optional().describe('Database owner'),
          created_on: z.string().optional().describe('Creation timestamp'),
        })
      )
      .optional()
      .describe('List of databases'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('list_schemas')
      .describe('List all schemas in a database'),
    success: z.boolean().describe('Whether the operation was successful'),
    schemas: z
      .array(
        z.object({
          name: z.string().describe('Schema name'),
          database_name: z.string().optional().describe('Parent database name'),
          owner: z.string().optional().describe('Schema owner'),
          created_on: z.string().optional().describe('Creation timestamp'),
        })
      )
      .optional()
      .describe('List of schemas'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('list_tables').describe('List all tables in a schema'),
    success: z.boolean().describe('Whether the operation was successful'),
    tables: z
      .array(
        z.object({
          name: z.string().describe('Table name'),
          database_name: z.string().optional().describe('Parent database name'),
          schema_name: z.string().optional().describe('Parent schema name'),
          kind: z
            .string()
            .optional()
            .describe('Table kind (TABLE, VIEW, etc.)'),
          rows: z.number().optional().describe('Approximate row count'),
          created_on: z.string().optional().describe('Creation timestamp'),
        })
      )
      .optional()
      .describe('List of tables'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('describe_table')
      .describe('Get column definitions for a table'),
    success: z.boolean().describe('Whether the operation was successful'),
    columns: z
      .array(
        z.object({
          name: z.string().describe('Column name'),
          type: z.string().describe('Data type'),
          nullable: z
            .boolean()
            .optional()
            .describe('Whether column is nullable'),
          default: z.string().nullable().optional().describe('Default value'),
          primary_key: z
            .boolean()
            .optional()
            .describe('Whether column is a primary key'),
          comment: z.string().nullable().optional().describe('Column comment'),
        })
      )
      .optional()
      .describe('Column definitions'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type SnowflakeResult = z.output<typeof SnowflakeResultSchema>;
export type SnowflakeParams = z.output<typeof SnowflakeParamsSchema>;
export type SnowflakeParamsInput = z.input<typeof SnowflakeParamsSchema>;
