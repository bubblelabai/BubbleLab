import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  SnowflakeParamsSchema,
  SnowflakeResultSchema,
  type SnowflakeParams,
  type SnowflakeParamsInput,
  type SnowflakeResult,
} from './snowflake.schema.js';
import {
  parseSnowflakeCredential,
  generateSnowflakeJWT,
  getSnowflakeBaseUrl,
  getCellByName,
  type SnowflakeCredentials,
} from './snowflake.utils.js';

/**
 * Snowflake Service Bubble
 *
 * Snowflake data warehouse integration using the SQL REST API with key-pair authentication.
 *
 * Features:
 * - Execute arbitrary SQL statements
 * - List databases, schemas, and tables
 * - Describe table column definitions
 * - Key-pair (RSA) JWT authentication — no token expiry
 *
 * Credential fields (multi-field):
 * - account (required): Account identifier (ORGNAME-ACCOUNTNAME from URL)
 * - username (required): Snowflake login username
 * - privateKey (required): RSA private key in PEM format
 * - privateKeyPassword (optional): Passphrase if key is encrypted
 * - warehouse (optional): Default warehouse
 * - database (optional): Default database
 * - schema (optional): Default schema
 * - role (optional): Default role
 */
export class SnowflakeBubble<
  T extends SnowflakeParamsInput = SnowflakeParamsInput,
> extends ServiceBubble<
  T,
  Extract<SnowflakeResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'snowflake';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'snowflake';
  static readonly schema = SnowflakeParamsSchema;
  static readonly resultSchema = SnowflakeResultSchema;
  static readonly shortDescription =
    'Snowflake data warehouse integration for SQL queries and metadata';
  static readonly longDescription = `
    Snowflake data warehouse integration using the SQL REST API with key-pair authentication.

    Features:
    - Execute arbitrary SQL statements against Snowflake
    - List databases, schemas, and tables
    - Describe table column definitions
    - Key-pair (RSA) JWT authentication — no token expiry, no refresh needed

    Use cases:
    - Run SQL queries to fetch data from Snowflake warehouses
    - Explore database metadata (databases, schemas, tables, columns)
    - Automate data pipeline operations
    - Build reports from Snowflake data
  `;
  static readonly alias = 'snowflake';

  constructor(
    params: T = {
      operation: 'list_databases',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Snowflake credentials are required');
    }

    const creds = parseSnowflakeCredential(credential);
    const jwt = generateSnowflakeJWT(creds);
    const baseUrl = getSnowflakeBaseUrl(creds.account);

    // Test by running SELECT CURRENT_USER()
    const response = await fetch(`${baseUrl}/api/v2/statements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      },
      body: JSON.stringify({
        statement: 'SELECT CURRENT_USER()',
        timeout: 30,
        ...(creds.warehouse && { warehouse: creds.warehouse }),
        ...(creds.role && { role: creds.role }),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Snowflake credential validation failed (${response.status}): ${text}`
      );
    }
    return true;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.SNOWFLAKE_CRED];
  }

  /**
   * Execute a SQL statement via the Snowflake SQL API.
   */
  private async executeStatement(
    creds: SnowflakeCredentials,
    statement: string,
    options?: {
      database?: string;
      schema?: string;
      warehouse?: string;
      role?: string;
      timeout?: number;
    }
  ): Promise<{
    resultSetMetaData: {
      numRows: number;
      rowType: Array<{ name: string; type: string; nullable: boolean }>;
    };
    data: Array<Array<string | null>>;
    statementHandle: string;
  }> {
    const jwt = generateSnowflakeJWT(creds);
    const baseUrl = getSnowflakeBaseUrl(creds.account);

    const body: Record<string, unknown> = {
      statement,
      timeout: options?.timeout ?? 60,
    };

    // Apply context: explicit params > credential defaults
    const database = options?.database ?? creds.database;
    const schema = options?.schema ?? creds.schema;
    const warehouse = options?.warehouse ?? creds.warehouse;
    const role = options?.role ?? creds.role;

    if (database) body.database = database;
    if (schema) body.schema = schema;
    if (warehouse) body.warehouse = warehouse;
    if (role) body.role = role;

    const response = await fetch(`${baseUrl}/api/v2/statements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.message || errorJson.error || `HTTP ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }
      throw new Error(
        `Snowflake API error (${response.status}): ${errorMessage}`
      );
    }

    const result = await response.json();

    // Handle async execution (202 status)
    if (response.status === 202) {
      throw new Error(
        'Query is still executing asynchronously. Increase the timeout or use a simpler query.'
      );
    }

    return {
      resultSetMetaData: result.resultSetMetaData || {
        numRows: 0,
        rowType: [],
      },
      data: result.data || [],
      statementHandle: result.statementHandle || '',
    };
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SnowflakeResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const credential = this.chooseCredential();
      if (!credential) {
        throw new Error('Snowflake credentials are required');
      }
      const creds = parseSnowflakeCredential(credential);

      const result = await (async (): Promise<SnowflakeResult> => {
        const parsedParams = this.params as SnowflakeParams;
        switch (operation) {
          case 'execute_sql':
            return await this.executeSql(
              creds,
              parsedParams as Extract<
                SnowflakeParams,
                { operation: 'execute_sql' }
              >
            );
          case 'list_databases':
            return await this.listDatabases(creds);
          case 'list_schemas':
            return await this.listSchemas(
              creds,
              parsedParams as Extract<
                SnowflakeParams,
                { operation: 'list_schemas' }
              >
            );
          case 'list_tables':
            return await this.listTables(
              creds,
              parsedParams as Extract<
                SnowflakeParams,
                { operation: 'list_tables' }
              >
            );
          case 'describe_table':
            return await this.describeTable(
              creds,
              parsedParams as Extract<
                SnowflakeParams,
                { operation: 'describe_table' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<SnowflakeResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<SnowflakeResult, { operation: T['operation'] }>;
    }
  }

  private async executeSql(
    creds: SnowflakeCredentials,
    params: Extract<SnowflakeParams, { operation: 'execute_sql' }>
  ): Promise<Extract<SnowflakeResult, { operation: 'execute_sql' }>> {
    const result = await this.executeStatement(creds, params.statement, {
      database: params.database,
      schema: params.schema,
      warehouse: params.warehouse,
      role: params.role,
      timeout: params.timeout,
    });

    return {
      operation: 'execute_sql',
      success: true,
      columns: result.resultSetMetaData.rowType.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
      })),
      rows: result.data,
      num_rows: result.resultSetMetaData.numRows,
      statement_handle: result.statementHandle,
      error: '',
    };
  }

  private async listDatabases(
    creds: SnowflakeCredentials
  ): Promise<Extract<SnowflakeResult, { operation: 'list_databases' }>> {
    const result = await this.executeStatement(creds, 'SHOW DATABASES');
    const rowType = result.resultSetMetaData.rowType;

    const databases = result.data.map((row) => ({
      name: getCellByName(row, rowType, 'name') ?? '',
      owner: getCellByName(row, rowType, 'owner'),
      created_on: getCellByName(row, rowType, 'created_on'),
    }));

    return {
      operation: 'list_databases',
      success: true,
      databases,
      error: '',
    };
  }

  private async listSchemas(
    creds: SnowflakeCredentials,
    params: Extract<SnowflakeParams, { operation: 'list_schemas' }>
  ): Promise<Extract<SnowflakeResult, { operation: 'list_schemas' }>> {
    const result = await this.executeStatement(
      creds,
      `SHOW SCHEMAS IN DATABASE "${params.database}"`
    );
    const rowType = result.resultSetMetaData.rowType;

    const schemas = result.data.map((row) => ({
      name: getCellByName(row, rowType, 'name') ?? '',
      database_name: getCellByName(row, rowType, 'database_name'),
      owner: getCellByName(row, rowType, 'owner'),
      created_on: getCellByName(row, rowType, 'created_on'),
    }));

    return {
      operation: 'list_schemas',
      success: true,
      schemas,
      error: '',
    };
  }

  private async listTables(
    creds: SnowflakeCredentials,
    params: Extract<SnowflakeParams, { operation: 'list_tables' }>
  ): Promise<Extract<SnowflakeResult, { operation: 'list_tables' }>> {
    const result = await this.executeStatement(
      creds,
      `SHOW TABLES IN SCHEMA "${params.database}"."${params.schema}"`
    );
    const rowType = result.resultSetMetaData.rowType;

    const tables = result.data.map((row) => {
      const rowsStr = getCellByName(row, rowType, 'rows');
      return {
        name: getCellByName(row, rowType, 'name') ?? '',
        database_name: getCellByName(row, rowType, 'database_name'),
        schema_name: getCellByName(row, rowType, 'schema_name'),
        kind: getCellByName(row, rowType, 'kind'),
        rows: rowsStr ? parseInt(rowsStr, 10) : undefined,
        created_on: getCellByName(row, rowType, 'created_on'),
      };
    });

    return {
      operation: 'list_tables',
      success: true,
      tables,
      error: '',
    };
  }

  private async describeTable(
    creds: SnowflakeCredentials,
    params: Extract<SnowflakeParams, { operation: 'describe_table' }>
  ): Promise<Extract<SnowflakeResult, { operation: 'describe_table' }>> {
    const result = await this.executeStatement(
      creds,
      `DESCRIBE TABLE "${params.database}"."${params.schema}"."${params.table}"`
    );
    const rowType = result.resultSetMetaData.rowType;

    const columns = result.data.map((row) => {
      const nullableStr = getCellByName(row, rowType, 'null?');
      const pkStr = getCellByName(row, rowType, 'primary key');
      return {
        name: getCellByName(row, rowType, 'name') ?? '',
        type: getCellByName(row, rowType, 'type') ?? '',
        nullable: nullableStr ? nullableStr.toUpperCase() === 'Y' : undefined,
        default: getCellByName(row, rowType, 'default') ?? null,
        primary_key: pkStr ? pkStr.toUpperCase() === 'Y' : undefined,
        comment: getCellByName(row, rowType, 'comment') ?? null,
      };
    });

    return {
      operation: 'describe_table',
      success: true,
      columns,
      error: '',
    };
  }
}
