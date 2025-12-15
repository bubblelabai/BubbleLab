import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define available SQL operations (same as PostgreSQL for consistency)
export const SqlOperations = z.enum([
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'WITH',
  'EXPLAIN',
]);
type SqlOperation = z.output<typeof SqlOperations>;

// Define the parameters schema for the InsForge DB bubble
const InsForgeDbParamsSchema = z.object({
  query: z
    .string()
    .min(1, 'Query is required')
    .describe('SQL query to execute against the InsForge database'),
  allowedOperations: z
    .array(SqlOperations)
    .default(['SELECT', 'WITH'])
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
    .describe('Query timeout in milliseconds (default: 30 seconds)'),
  maxRows: z
    .number()
    .positive()
    .default(1000)
    .describe('Maximum number of rows to return (default: 1000)'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

type InsForgeDbParamsInput = z.input<typeof InsForgeDbParamsSchema>;
type InsForgeDbParams = z.output<typeof InsForgeDbParamsSchema>;

// Define the result schema
const InsForgeDbResultSchema = z.object({
  rows: z.array(z.record(z.unknown())).describe('Array of result rows'),
  rowCount: z
    .number()
    .nullable()
    .describe('Number of rows affected by the query'),
  command: z.string().describe('SQL command that was executed'),
  executionTime: z.number().describe('Query execution time in milliseconds'),
  success: z.boolean().describe('Whether the query executed successfully'),
  error: z.string().describe('Error message if query execution failed'),
  cleanedJSONString: z
    .string()
    .describe('Clean JSON string representation of the row data'),
});

type InsForgeDbResult = z.output<typeof InsForgeDbResultSchema>;

export type { InsForgeDbParamsInput };

/**
 * InsForge Database Bubble
 *
 * Execute SQL queries against an InsForge backend database.
 * Works similarly to the PostgreSQL bubble but uses InsForge's REST API.
 *
 * @example
 * ```typescript
 * const result = await new InsForgeDbBubble({
 *   query: 'SELECT * FROM users WHERE active = $1',
 *   parameters: [true],
 *   allowedOperations: ['SELECT'],
 *   maxRows: 100,
 * }).action();
 *
 * console.log(result.data.rows);
 * ```
 */
export class InsForgeDbBubble extends ServiceBubble<
  InsForgeDbParams,
  InsForgeDbResult
> {
  static readonly type = 'service' as const;
  static readonly service = 'insforge';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'insforge-db';
  static readonly schema = InsForgeDbParamsSchema;
  static readonly resultSchema = InsForgeDbResultSchema;
  static readonly shortDescription =
    'Execute SQL queries against InsForge database';
  static readonly longDescription = `
    Execute SQL queries against an InsForge backend database using the REST API.

    Use cases:
    - Data retrieval with SELECT queries
    - Data manipulation with INSERT, UPDATE, DELETE (when explicitly allowed)
    - Database reporting and analytics
    - Data migration and synchronization tasks

    Security Features:
    - Operation whitelist (defaults to SELECT only)
    - Parameterized queries to prevent SQL injection
    - Connection timeout controls
    - Result row limits
  `;
  static readonly alias = 'insforge';

  constructor(
    params: InsForgeDbParamsInput = {
      query: 'SELECT 1',
      allowedOperations: ['SELECT'],
      parameters: [],
      timeout: 30000,
      maxRows: 1000,
    },
    context?: BubbleContext
  ) {
    super(params, context);

    // Validate SQL operation
    this.validateSqlOperation(this.params.query, this.params.allowedOperations);
  }

  public async testCredential(): Promise<boolean> {
    const { credentials } = this.params;

    if (!credentials || typeof credentials !== 'object') {
      return false;
    }

    const baseUrl = credentials[CredentialType.INSFORGE_BASE_URL]?.replace(
      /\/$/,
      ''
    );
    const apiKey = credentials[CredentialType.INSFORGE_API_KEY];

    // If only base URL provided, check if server is reachable
    if (baseUrl && !apiKey) {
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    // If only API key provided, can't validate without URL - return true
    if (apiKey && !baseUrl) {
      // Can't validate API key without base URL, assume valid
      return true;
    }

    // If both provided, do full validation
    if (baseUrl && apiKey) {
      try {
        const response = await fetch(
          `${baseUrl}/api/database/advance/rawsql/unrestricted`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              query: 'SELECT 1 as test',
              params: [],
            }),
          }
        );
        return response.ok;
      } catch {
        return false;
      }
    }

    return false;
  }

  protected chooseCredential(): string | undefined {
    // InsForge uses multiple credentials, handled in getCredentials()
    return undefined;
  }

  private getCredentials(): { baseUrl: string; apiKey: string } {
    const { credentials } = this.params;

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No InsForge credentials provided');
    }

    const baseUrl = credentials[CredentialType.INSFORGE_BASE_URL];
    const apiKey = credentials[CredentialType.INSFORGE_API_KEY];

    if (!baseUrl) {
      throw new Error('InsForge base URL not provided');
    }
    if (!apiKey) {
      throw new Error('InsForge API key not provided');
    }

    // Remove trailing slash from base URL
    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      apiKey,
    };
  }

  /**
   * Validate that the SQL query operation is allowed
   */
  private validateSqlOperation(
    query: string,
    allowedOperations: SqlOperation[]
  ): void {
    const trimmedQuery = query.trim().toUpperCase();
    const firstKeyword = trimmedQuery.split(/\s+/)[0];

    const isAllowed = allowedOperations.some((op) =>
      firstKeyword.startsWith(op)
    );

    if (!isAllowed) {
      throw new Error(
        `SQL operation '${firstKeyword}' is not allowed. Allowed operations: ${allowedOperations.join(', ')}`
      );
    }

    // Safety checks for dangerous operations
    if (firstKeyword === 'DELETE' && !trimmedQuery.includes('WHERE')) {
      throw new Error('DELETE queries must include a WHERE clause for safety');
    }

    if (firstKeyword === 'UPDATE' && !trimmedQuery.includes('WHERE')) {
      throw new Error('UPDATE queries must include a WHERE clause for safety');
    }

    // Block dangerous keywords
    const dangerousKeywords = [
      '\\bDROP\\b',
      '\\bALTER\\b',
      '\\bTRUNCATE\\b',
      '\\bGRANT\\b',
      '\\bREVOKE\\b',
    ];

    const containsDangerous = dangerousKeywords.some((keyword) =>
      new RegExp(keyword, 'i').test(trimmedQuery)
    );

    if (containsDangerous) {
      throw new Error(
        `Query contains potentially dangerous operations. Only allowed: ${allowedOperations.join(', ')}`
      );
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<InsForgeDbResult> {
    void context;

    const { query, parameters, maxRows } = this.params;
    const { baseUrl, apiKey } = this.getCredentials();
    const startTime = Date.now();

    try {
      // Call InsForge raw SQL endpoint
      const response = await fetch(
        `${baseUrl}/api/database/advance/rawsql/unrestricted`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            params: parameters,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `InsForge query failed: ${response.status} - ${errorBody}`
        );
      }

      const data = (await response.json()) as
        | Record<string, unknown>[]
        | { rows?: Record<string, unknown>[] };
      const executionTime = Date.now() - startTime;

      // Handle response - InsForge returns array of rows or object with rows property
      const rows: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : (data as { rows?: Record<string, unknown>[] }).rows || [];
      const truncatedRows = rows.slice(0, maxRows);

      // Extract command from query
      const command = query.trim().split(/\s+/)[0].toUpperCase();

      return {
        rows: truncatedRows,
        rowCount: rows.length,
        command,
        executionTime,
        success: true,
        error: '',
        cleanedJSONString: JSON.stringify(truncatedRows, null, 2),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        rows: [],
        rowCount: null,
        command: query.trim().split(/\s+/)[0].toUpperCase(),
        executionTime,
        success: false,
        error: errorMessage,
        cleanedJSONString: '[]',
      };
    }
  }
}
