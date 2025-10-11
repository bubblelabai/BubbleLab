/**
 * Database Definition Schema
 *
 * This schema is designed to store database table definitions and metadata
 */

import { z } from '@hono/zod-openapi';

// Database connection types for frontend display
export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'bigquery' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username?: string;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  lastUsed: string;
  description?: string;
}

export type DatabaseStatus = 'connected' | 'disconnected' | 'error';
export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'bigquery'
  | 'sqlite';

// Database schema types for table structure display
export interface DatabaseColumn {
  name: string;
  type: string;
  isNullable: boolean;
  defaultValue?: string;
  constraints?: string[];
}

export interface DatabaseTable {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
  rowCount?: number;
  size?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  totalTables: number;
  totalSize?: string;
}

// Schema for database metadata that can be stored in credentials
export const databaseMetadataSchema = z.object({
  // Core database definition - mapping of table names to column definitions
  // Format: { [tableName]: { [columnName]: columnType } }
  tables: z.record(
    z.string(), // table name
    z.record(
      z.string(), // column name
      z.string() // notes about it
    )
  ),
  // Table-level notes - mapping of table names to notes about the entire table
  tableNotes: z.record(z.string(), z.string()).optional(),
  // Optional metadata
  databaseName: z.string().optional(),
  databaseType: z
    .enum(['postgresql', 'mysql', 'sqlite', 'mssql', 'oracle'])
    .optional(),
  // Rules and constraints - simplified to match frontend
  rules: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        enabled: z.boolean(),
        createdAt: z.string(), // ISO string
        updatedAt: z.string(), // ISO string
      })
    )
    .optional(),
  // Additional context
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type DatabaseMetadata = z.infer<typeof databaseMetadataSchema>;
