import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Airtable API base URL
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Define Airtable field value schema (supports multiple types)
const AirtableFieldValueSchema = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.unknown()),
    z.record(z.unknown()),
    z.null(),
  ])
  .describe(
    'Value for an Airtable field (string, number, boolean, array, object, or null)'
  );

// Define Airtable record schema
const AirtableRecordSchema = z
  .object({
    id: z.string().describe('Unique record identifier (starts with rec)'),
    createdTime: z
      .string()
      .datetime()
      .describe('ISO 8601 datetime when record was created'),
    fields: z
      .record(z.string(), AirtableFieldValueSchema)
      .describe('Record field values as key-value pairs'),
  })
  .describe('Airtable record with ID, creation time, and field data');

// Define sort direction
const SortDirectionSchema = z
  .enum(['asc', 'desc'])
  .describe('Sort direction: ascending or descending');

// Define sort specification
const SortSpecSchema = z
  .object({
    field: z.string().describe('Field name to sort by'),
    direction: SortDirectionSchema.optional()
      .default('asc')
      .describe('Sort direction (asc or desc)'),
  })
  .describe('Sort specification for ordering records');

// Define the parameters schema for different Airtable operations
const AirtableParamsSchema = z.discriminatedUnion('operation', [
  // List records operation
  z.object({
    operation: z
      .literal('list_records')
      .describe(
        'List records from an Airtable table with filtering and sorting'
      ),
    baseId: z
      .string()
      .min(1, 'Base ID is required')
      .describe('Airtable base ID (e.g., appXXXXXXXXXXXXXX)'),
    tableIdOrName: z
      .string()
      .min(1, 'Table ID or name is required')
      .describe('Table ID (e.g., tblXXXXXXXXXXXXXX) or table name'),
    fields: z
      .array(z.string())
      .optional()
      .describe(
        'Array of field names to include in results (returns all fields if not specified)'
      ),
    filterByFormula: z
      .string()
      .optional()
      .describe(
        'Airtable formula to filter records (e.g., "{Status} = \'Done\'")'
      ),
    maxRecords: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Maximum number of records to return (1-100, returns all if not specified)'
      ),
    pageSize: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Number of records per page for pagination (1-100)'),
    sort: z
      .array(SortSpecSchema)
      .optional()
      .describe('Array of sort specifications to order records'),
    view: z
      .string()
      .optional()
      .describe("View name or ID to use (includes view's filters and sorts)"),
    cellFormat: z
      .enum(['json', 'string'])
      .optional()
      .default('json')
      .describe(
        'Format for cell values: json (structured) or string (formatted)'
      ),
    timeZone: z
      .string()
      .optional()
      .describe('Time zone for date/time fields (e.g., "America/Los_Angeles")'),
    userLocale: z
      .string()
      .optional()
      .describe('Locale for formatting (e.g., "en-US")'),
    offset: z
      .string()
      .optional()
      .describe('Pagination offset from previous response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get record operation
  z.object({
    operation: z
      .literal('get_record')
      .describe('Retrieve a single record by its ID'),
    baseId: z
      .string()
      .min(1, 'Base ID is required')
      .describe('Airtable base ID (e.g., appXXXXXXXXXXXXXX)'),
    tableIdOrName: z
      .string()
      .min(1, 'Table ID or name is required')
      .describe('Table ID (e.g., tblXXXXXXXXXXXXXX) or table name'),
    recordId: z
      .string()
      .min(1, 'Record ID is required')
      .describe('Record ID to retrieve (starts with rec)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create records operation
  z.object({
    operation: z
      .literal('create_records')
      .describe('Create one or more new records in an Airtable table'),
    baseId: z
      .string()
      .min(1, 'Base ID is required')
      .describe('Airtable base ID (e.g., appXXXXXXXXXXXXXX)'),
    tableIdOrName: z
      .string()
      .min(1, 'Table ID or name is required')
      .describe('Table ID (e.g., tblXXXXXXXXXXXXXX) or table name'),
    records: z
      .array(
        z
          .object({
            fields: z
              .record(z.string(), AirtableFieldValueSchema)
              .describe('Field values for the new record'),
          })
          .describe('Record data to create')
      )
      .min(1, 'At least one record is required')
      .max(10, 'Maximum 10 records can be created at once')
      .describe('Array of records to create (max 10 per request)'),
    typecast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Automatically convert field values to the appropriate type'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update records operation
  z.object({
    operation: z
      .literal('update_records')
      .describe('Update existing records in an Airtable table'),
    baseId: z
      .string()
      .min(1, 'Base ID is required')
      .describe('Airtable base ID (e.g., appXXXXXXXXXXXXXX)'),
    tableIdOrName: z
      .string()
      .min(1, 'Table ID or name is required')
      .describe('Table ID (e.g., tblXXXXXXXXXXXXXX) or table name'),
    records: z
      .array(
        z
          .object({
            id: z
              .string()
              .min(1, 'Record ID is required')
              .describe('Record ID to update (starts with rec)'),
            fields: z
              .record(z.string(), AirtableFieldValueSchema)
              .describe(
                'Field values to update (only specified fields will be updated)'
              ),
          })
          .describe('Record data to update')
      )
      .min(1, 'At least one record is required')
      .max(10, 'Maximum 10 records can be updated at once')
      .describe('Array of records to update (max 10 per request)'),
    typecast: z
      .boolean()
      .optional()
      .default(false)
      .describe('Automatically convert field values to the appropriate type'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete records operation
  z.object({
    operation: z
      .literal('delete_records')
      .describe('Delete one or more records from an Airtable table'),
    baseId: z
      .string()
      .min(1, 'Base ID is required')
      .describe('Airtable base ID (e.g., appXXXXXXXXXXXXXX)'),
    tableIdOrName: z
      .string()
      .min(1, 'Table ID or name is required')
      .describe('Table ID (e.g., tblXXXXXXXXXXXXXX) or table name'),
    recordIds: z
      .array(z.string())
      .min(1, 'At least one record ID is required')
      .max(10, 'Maximum 10 records can be deleted at once')
      .describe('Array of record IDs to delete (max 10 per request)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const AirtableResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('list_records')
      .describe(
        'List records from an Airtable table with filtering and sorting'
      ),
    ok: z.boolean().describe('Whether the Airtable API call was successful'),
    records: z
      .array(AirtableRecordSchema)
      .optional()
      .describe('Array of record objects'),
    offset: z
      .string()
      .optional()
      .describe('Pagination offset for retrieving next page of results'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('get_record')
      .describe('Retrieve a single record by its ID'),
    ok: z.boolean().describe('Whether the Airtable API call was successful'),
    record: AirtableRecordSchema.optional().describe('Record object'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('create_records')
      .describe('Create one or more new records in an Airtable table'),
    ok: z.boolean().describe('Whether the Airtable API call was successful'),
    records: z
      .array(AirtableRecordSchema)
      .optional()
      .describe('Array of created record objects'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('update_records')
      .describe('Update existing records in an Airtable table'),
    ok: z.boolean().describe('Whether the Airtable API call was successful'),
    records: z
      .array(AirtableRecordSchema)
      .optional()
      .describe('Array of updated record objects'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  z.object({
    operation: z
      .literal('delete_records')
      .describe('Delete one or more records from an Airtable table'),
    ok: z.boolean().describe('Whether the Airtable API call was successful'),
    records: z
      .array(
        z
          .object({
            id: z.string().describe('ID of deleted record'),
            deleted: z.boolean().describe('Whether the record was deleted'),
          })
          .describe('Deletion confirmation object')
      )
      .optional()
      .describe('Array of deletion confirmation objects'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),
]);

type AirtableResult = z.output<typeof AirtableResultSchema>;
type AirtableParams = z.input<typeof AirtableParamsSchema>;
type AirtableParamsParsed = z.output<typeof AirtableParamsSchema>;

// Export the input type for external usage
export type AirtableParamsInput = z.input<typeof AirtableParamsSchema>;

// Helper type to get the result type for a specific operation
export type AirtableOperationResult<T extends AirtableParams['operation']> =
  Extract<AirtableResult, { operation: T }>;

// Airtable API error interface
interface AirtableApiError {
  error: {
    type: string;
    message: string;
  };
}

// Successful Airtable API response interface
interface AirtableApiResponse {
  records?: Array<{
    id: string;
    createdTime: string;
    fields: Record<string, unknown>;
  }>;
  offset?: string;
  [key: string]: unknown;
}

export class AirtableBubble<
  T extends AirtableParams = AirtableParams,
> extends ServiceBubble<
  T,
  Extract<AirtableResult, { operation: T['operation'] }>
> {
  public async testCredential(): Promise<boolean> {
    // Test credential by making a simple API call
    // We'll try to list bases which requires valid authentication
    try {
      const credential = this.chooseCredential();
      if (!credential) {
        return false;
      }

      const response = await fetch('https://api.airtable.com/v0/meta/bases', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  static readonly type = 'service' as const;
  static readonly service = 'airtable';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'airtable';
  static readonly schema = AirtableParamsSchema;
  static readonly resultSchema = AirtableResultSchema;
  static readonly shortDescription =
    'Airtable integration for managing records in bases and tables';
  static readonly longDescription = `
    Comprehensive Airtable integration bubble for managing records in your Airtable bases.
    Use cases:
    - List records with filtering, sorting, and pagination
    - Retrieve individual records by ID
    - Create new records in tables
    - Update existing records with new field values
    - Delete records from tables
    - Support for all Airtable field types (text, number, attachments, links, etc.)
    
    Security Features:
    - Personal Access Token authentication
    - Parameter validation and sanitization
    - Rate limiting awareness (5 requests per second per base)
    - Comprehensive error handling
  `;
  static readonly alias = 'airtable';

  constructor(
    params: T = {
      operation: 'list_records',
      baseId: '',
      tableIdOrName: '',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<AirtableResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<AirtableResult> => {
        switch (operation) {
          case 'list_records':
            return await this.listRecords(this.params);
          case 'get_record':
            return await this.getRecord(this.params);
          case 'create_records':
            return await this.createRecords(this.params);
          case 'update_records':
            return await this.updateRecords(this.params);
          case 'delete_records':
            return await this.deleteRecords(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<AirtableResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      return {
        success: false,
        ok: false,
        operation: failedOperation,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred in AirtableBubble',
      } as Extract<AirtableResult, { operation: T['operation'] }>;
    }
  }

  private async listRecords(
    params: Extract<AirtableParams, { operation: 'list_records' }>
  ): Promise<Extract<AirtableResult, { operation: 'list_records' }>> {
    // Parse params to apply defaults
    const parsed = AirtableParamsSchema.parse(params);
    const {
      baseId,
      tableIdOrName,
      fields,
      filterByFormula,
      maxRecords,
      pageSize,
      sort,
      view,
      cellFormat,
      timeZone,
      userLocale,
      offset,
    } = parsed as Extract<AirtableParamsParsed, { operation: 'list_records' }>;

    const queryParams = new URLSearchParams();

    if (fields && fields.length > 0) {
      fields.forEach((field) => queryParams.append('fields[]', field));
    }
    if (filterByFormula) queryParams.append('filterByFormula', filterByFormula);
    if (maxRecords) queryParams.append('maxRecords', maxRecords.toString());
    if (pageSize) queryParams.append('pageSize', pageSize.toString());
    if (sort && sort.length > 0) {
      sort.forEach((s, index) => {
        queryParams.append(`sort[${index}][field]`, s.field);
        queryParams.append(`sort[${index}][direction]`, s.direction);
      });
    }
    if (view) queryParams.append('view', view);
    if (cellFormat) queryParams.append('cellFormat', cellFormat);
    if (timeZone) queryParams.append('timeZone', timeZone);
    if (userLocale) queryParams.append('userLocale', userLocale);
    if (offset) queryParams.append('offset', offset);

    const response = await this.makeAirtableApiCall(
      `${baseId}/${encodeURIComponent(tableIdOrName)}?${queryParams.toString()}`,
      'GET'
    );

    if ('error' in response) {
      return {
        operation: 'list_records',
        ok: false,
        error: (response as AirtableApiError).error.message,
        success: false,
      };
    }

    return {
      operation: 'list_records',
      ok: true,
      records: response.records
        ? z.array(AirtableRecordSchema).parse(response.records)
        : undefined,
      offset: response.offset,
      error: '',
      success: true,
    };
  }

  private async getRecord(
    params: Extract<AirtableParams, { operation: 'get_record' }>
  ): Promise<Extract<AirtableResult, { operation: 'get_record' }>> {
    const { baseId, tableIdOrName, recordId } = params;

    const response = await this.makeAirtableApiCall(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      'GET'
    );

    if ('error' in response) {
      return {
        operation: 'get_record',
        ok: false,
        error: (response as AirtableApiError).error.message,
        success: false,
      };
    }

    return {
      operation: 'get_record',
      ok: true,
      record: AirtableRecordSchema.parse(response),
      error: '',
      success: true,
    };
  }

  private async createRecords(
    params: Extract<AirtableParams, { operation: 'create_records' }>
  ): Promise<Extract<AirtableResult, { operation: 'create_records' }>> {
    // Parse params to apply defaults
    const parsed = AirtableParamsSchema.parse(params);
    const { baseId, tableIdOrName, records, typecast } = parsed as Extract<
      AirtableParamsParsed,
      { operation: 'create_records' }
    >;

    const body = {
      records,
      typecast,
    };

    const response = await this.makeAirtableApiCall(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      'POST',
      body
    );

    if ('error' in response) {
      return {
        operation: 'create_records',
        ok: false,
        error: (response as AirtableApiError).error.message,
        success: false,
      };
    }

    return {
      operation: 'create_records',
      ok: true,
      records: response.records
        ? z.array(AirtableRecordSchema).parse(response.records)
        : undefined,
      error: '',
      success: true,
    };
  }

  private async updateRecords(
    params: Extract<AirtableParams, { operation: 'update_records' }>
  ): Promise<Extract<AirtableResult, { operation: 'update_records' }>> {
    // Parse params to apply defaults
    const parsed = AirtableParamsSchema.parse(params);
    const { baseId, tableIdOrName, records, typecast } = parsed as Extract<
      AirtableParamsParsed,
      { operation: 'update_records' }
    >;

    const body = {
      records,
      typecast,
    };

    const response = await this.makeAirtableApiCall(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      'PATCH',
      body
    );

    if ('error' in response) {
      return {
        operation: 'update_records',
        ok: false,
        error: (response as AirtableApiError).error.message,
        success: false,
      };
    }

    return {
      operation: 'update_records',
      ok: true,
      records: response.records
        ? z.array(AirtableRecordSchema).parse(response.records)
        : undefined,
      error: '',
      success: true,
    };
  }

  private async deleteRecords(
    params: Extract<AirtableParams, { operation: 'delete_records' }>
  ): Promise<Extract<AirtableResult, { operation: 'delete_records' }>> {
    const { baseId, tableIdOrName, recordIds } = params;

    // Airtable expects record IDs as query parameters for DELETE
    const queryParams = new URLSearchParams();
    recordIds.forEach((id) => queryParams.append('records[]', id));

    const response = await this.makeAirtableApiCall(
      `${baseId}/${encodeURIComponent(tableIdOrName)}?${queryParams.toString()}`,
      'DELETE'
    );

    if ('error' in response) {
      return {
        operation: 'delete_records',
        ok: false,
        error: (response as AirtableApiError).error.message,
        success: false,
      };
    }

    // For delete, response.records has a different structure
    const deleteRecords = response.records as unknown as Array<{
      id: string;
      deleted: boolean;
    }>;

    return {
      operation: 'delete_records',
      ok: true,
      records: deleteRecords,
      error: '',
      success: true,
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Airtable credentials provided');
    }

    return credentials[CredentialType.AIRTABLE_CRED];
  }

  private async makeAirtableApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<AirtableApiResponse | AirtableApiError> {
    const url = `${AIRTABLE_API_BASE}/${endpoint}`;

    const authToken = this.chooseCredential();

    if (!authToken) {
      throw new Error(
        'Airtable authentication token is required but was not provided'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    const fetchConfig: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      fetchConfig.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchConfig);
    const data = (await response.json()) as
      | AirtableApiResponse
      | AirtableApiError;

    if (!response.ok) {
      return data as AirtableApiError;
    }

    return data;
  }
}
