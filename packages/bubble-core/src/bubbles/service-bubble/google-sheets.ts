import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define value range schema
const ValueRangeSchema = z
  .object({
    range: z.string().describe('The A1 notation range'),
    majorDimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .describe('Major dimension of the values'),
    values: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .describe('The data values as array of arrays'),
  })
  .describe('Range of values in a spreadsheet');

// Define spreadsheet info schema
const SpreadsheetInfoSchema = z
  .object({
    spreadsheetId: z.string().describe('Unique spreadsheet identifier'),
    properties: z
      .object({
        title: z.string().describe('Spreadsheet title'),
        locale: z.string().optional().describe('Spreadsheet locale'),
        autoRecalc: z.string().optional().describe('Auto recalc setting'),
        timeZone: z.string().optional().describe('Time zone'),
      })
      .optional()
      .describe('Spreadsheet properties'),
    sheets: z
      .array(
        z
          .object({
            properties: z
              .object({
                sheetId: z.number().describe('Sheet ID'),
                title: z.string().describe('Sheet title'),
                index: z.number().describe('Sheet index'),
                sheetType: z.string().optional().describe('Sheet type'),
                gridProperties: z
                  .object({
                    rowCount: z
                      .number()
                      .optional()
                      .describe('Number of rows in the sheet'),
                    columnCount: z
                      .number()
                      .optional()
                      .describe('Number of columns in the sheet'),
                  })
                  .optional()
                  .describe('Grid properties of the sheet'),
              })
              .describe('Sheet properties'),
          })
          .describe('Sheet information')
      )
      .optional()
      .describe('List of sheets in the spreadsheet'),
    spreadsheetUrl: z.string().optional().describe('URL to the spreadsheet'),
  })
  .describe('Google Sheets spreadsheet information');

// Define the parameters schema for Google Sheets operations
const GoogleSheetsParamsSchema = z.discriminatedUnion('operation', [
  // Read values operation
  z.object({
    operation: z.literal('read_values').describe('Read values from a range'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: z
      .string()
      .min(1, 'Range is required')
      .describe('A1 notation range (e.g., "Sheet1!A1:B10")'),
    major_dimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .default('ROWS')
      .describe('Major dimension for the values'),
    value_render_option: z
      .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
      .optional()
      .default('FORMATTED_VALUE')
      .describe('How values should be represented in the output'),
    date_time_render_option: z
      .enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
      .optional()
      .default('SERIAL_NUMBER')
      .describe('How date/time values should be rendered'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Write values operation
  z.object({
    operation: z.literal('write_values').describe('Write values to a range'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: z
      .string()
      .min(1, 'Range is required')
      .describe('A1 notation range (e.g., "Sheet1!A1:B10")'),
    values: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .min(1, 'Values array cannot be empty')
      .describe('Data to write as array of arrays'),
    major_dimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .default('ROWS')
      .describe('Major dimension for the values'),
    value_input_option: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .default('USER_ENTERED')
      .describe('How input data should be interpreted'),
    include_values_in_response: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include updated values in response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update values operation
  z.object({
    operation: z
      .literal('update_values')
      .describe('Update values in a specific range'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: z
      .string()
      .min(1, 'Range is required')
      .describe('A1 notation range (e.g., "Sheet1!A1:B10")'),
    values: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .min(1, 'Values array cannot be empty')
      .describe('Data to update as array of arrays'),
    major_dimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .default('ROWS')
      .describe('Major dimension for the values'),
    value_input_option: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .default('USER_ENTERED')
      .describe('How input data should be interpreted'),
    include_values_in_response: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include updated values in response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Append values operation
  z.object({
    operation: z
      .literal('append_values')
      .describe('Append values to the end of a table'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: z
      .string()
      .min(1, 'Range is required')
      .describe('A1 notation range to search for table (e.g., "Sheet1!A:A")'),
    values: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .min(1, 'Values array cannot be empty')
      .describe('Data to append as array of arrays'),
    major_dimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .default('ROWS')
      .describe('Major dimension for the values'),
    value_input_option: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .default('USER_ENTERED')
      .describe('How input data should be interpreted'),
    insert_data_option: z
      .enum(['OVERWRITE', 'INSERT_ROWS'])
      .optional()
      .default('INSERT_ROWS')
      .describe('How data should be inserted'),
    include_values_in_response: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include appended values in response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Clear values operation
  z.object({
    operation: z.literal('clear_values').describe('Clear values from a range'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: z
      .string()
      .min(1, 'Range is required')
      .describe('A1 notation range (e.g., "Sheet1!A1:B10")'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Batch read values operation
  z.object({
    operation: z
      .literal('batch_read_values')
      .describe('Read multiple ranges at once'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    ranges: z
      .array(z.string())
      .min(1, 'At least one range is required')
      .describe('Array of A1 notation ranges'),
    major_dimension: z
      .enum(['ROWS', 'COLUMNS'])
      .optional()
      .default('ROWS')
      .describe('Major dimension for the values'),
    value_render_option: z
      .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
      .optional()
      .default('FORMATTED_VALUE')
      .describe('How values should be represented in the output'),
    date_time_render_option: z
      .enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
      .optional()
      .default('SERIAL_NUMBER')
      .describe('How date/time values should be rendered'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Batch update values operation
  z.object({
    operation: z
      .literal('batch_update_values')
      .describe('Update multiple ranges at once'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    value_ranges: z
      .array(
        z.object({
          range: z.string().describe('A1 notation range'),
          values: z
            .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
            .describe('Data values'),
          major_dimension: z
            .enum(['ROWS', 'COLUMNS'])
            .optional()
            .default('ROWS'),
        })
      )
      .min(1, 'At least one value range is required')
      .describe('Array of value ranges to update'),
    value_input_option: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .default('USER_ENTERED')
      .describe('How input data should be interpreted'),
    include_values_in_response: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include updated values in response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get spreadsheet info operation
  z.object({
    operation: z
      .literal('get_spreadsheet_info')
      .describe('Get spreadsheet metadata and properties'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    include_grid_data: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include grid data in response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create spreadsheet operation
  z.object({
    operation: z
      .literal('create_spreadsheet')
      .describe('Create a new spreadsheet'),
    title: z
      .string()
      .min(1, 'Spreadsheet title is required')
      .describe('Title for the new spreadsheet'),
    sheet_titles: z
      .array(z.string())
      .optional()
      .default(['Sheet1'])
      .describe('Titles for the initial sheets'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Add sheet operation
  z.object({
    operation: z
      .literal('add_sheet')
      .describe('Add a new sheet to spreadsheet'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    sheet_title: z
      .string()
      .min(1, 'Sheet title is required')
      .describe('Title for the new sheet'),
    row_count: z
      .number()
      .min(1)
      .optional()
      .default(1000)
      .describe('Number of rows in the new sheet'),
    column_count: z
      .number()
      .min(1)
      .optional()
      .default(26)
      .describe('Number of columns in the new sheet'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete sheet operation
  z.object({
    operation: z
      .literal('delete_sheet')
      .describe('Delete a sheet from spreadsheet'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    sheet_id: z
      .number()
      .min(0, 'Sheet ID must be non-negative')
      .describe('ID of the sheet to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const GoogleSheetsResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('read_values').describe('Read values from a range'),
    success: z.boolean().describe('Whether the operation was successful'),
    range: z.string().optional().describe('The range that was read'),
    values: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .optional()
      .describe('The values that were read'),
    major_dimension: z
      .string()
      .optional()
      .describe('Major dimension of the returned values'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('write_values').describe('Write values to a range'),
    success: z.boolean().describe('Whether the operation was successful'),
    updated_range: z.string().optional().describe('The range that was updated'),
    updated_rows: z.number().optional().describe('Number of rows updated'),
    updated_columns: z
      .number()
      .optional()
      .describe('Number of columns updated'),
    updated_cells: z.number().optional().describe('Number of cells updated'),
    updated_data: ValueRangeSchema.optional().describe(
      'Updated data if requested'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('update_values')
      .describe('Update values in a specific range'),
    success: z.boolean().describe('Whether the operation was successful'),
    updated_range: z.string().optional().describe('The range that was updated'),
    updated_rows: z.number().optional().describe('Number of rows updated'),
    updated_columns: z
      .number()
      .optional()
      .describe('Number of columns updated'),
    updated_cells: z.number().optional().describe('Number of cells updated'),
    updated_data: ValueRangeSchema.optional().describe(
      'Updated data if requested'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('append_values')
      .describe('Append values to the end of a table'),
    success: z.boolean().describe('Whether the operation was successful'),
    table_range: z
      .string()
      .optional()
      .describe('The table range values were appended to'),
    updated_range: z.string().optional().describe('The range that was updated'),
    updated_rows: z.number().optional().describe('Number of rows updated'),
    updated_columns: z
      .number()
      .optional()
      .describe('Number of columns updated'),
    updated_cells: z.number().optional().describe('Number of cells updated'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('clear_values').describe('Clear values from a range'),
    success: z.boolean().describe('Whether the operation was successful'),
    cleared_range: z.string().optional().describe('The range that was cleared'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('batch_read_values')
      .describe('Read multiple ranges at once'),
    success: z.boolean().describe('Whether the operation was successful'),
    value_ranges: z
      .array(ValueRangeSchema)
      .optional()
      .describe('Array of value ranges that were read'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('batch_update_values')
      .describe('Update multiple ranges at once'),
    success: z.boolean().describe('Whether the operation was successful'),
    total_updated_rows: z
      .number()
      .optional()
      .describe('Total number of rows updated across all ranges'),
    total_updated_columns: z
      .number()
      .optional()
      .describe('Total number of columns updated across all ranges'),
    total_updated_cells: z
      .number()
      .optional()
      .describe('Total number of cells updated across all ranges'),
    total_updated_sheets: z
      .number()
      .optional()
      .describe('Total number of sheets updated'),
    responses: z
      .array(
        z
          .object({
            updated_range: z
              .string()
              .optional()
              .describe('Range that was updated'),
            updated_rows: z
              .number()
              .optional()
              .describe('Number of rows updated in this range'),
            updated_columns: z
              .number()
              .optional()
              .describe('Number of columns updated in this range'),
            updated_cells: z
              .number()
              .optional()
              .describe('Number of cells updated in this range'),
          })
          .describe('Individual range update response')
      )
      .optional()
      .describe('Individual update responses'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('get_spreadsheet_info')
      .describe('Get spreadsheet metadata and properties'),
    success: z.boolean().describe('Whether the operation was successful'),
    spreadsheet: SpreadsheetInfoSchema.optional().describe(
      'Spreadsheet information'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('create_spreadsheet')
      .describe('Create a new spreadsheet'),
    success: z.boolean().describe('Whether the operation was successful'),
    spreadsheet: SpreadsheetInfoSchema.optional().describe(
      'Created spreadsheet information'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('add_sheet')
      .describe('Add a new sheet to spreadsheet'),
    success: z.boolean().describe('Whether the operation was successful'),
    sheet_id: z.number().optional().describe('ID of the added sheet'),
    sheet_title: z.string().optional().describe('Title of the added sheet'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('delete_sheet')
      .describe('Delete a sheet from spreadsheet'),
    success: z.boolean().describe('Whether the operation was successful'),
    deleted_sheet_id: z.number().optional().describe('ID of the deleted sheet'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

type GoogleSheetsResult = z.output<typeof GoogleSheetsResultSchema>;
type GoogleSheetsParams = z.input<typeof GoogleSheetsParamsSchema>;

// Helper type to get the result type for a specific operation
export type GoogleSheetsOperationResult<
  T extends GoogleSheetsParams['operation'],
> = Extract<GoogleSheetsResult, { operation: T }>;

// Export the input type for external usage
export type GoogleSheetsParamsInput = z.input<typeof GoogleSheetsParamsSchema>;

export class GoogleSheetsBubble<
  T extends GoogleSheetsParams = GoogleSheetsParams,
> extends ServiceBubble<
  T,
  Extract<GoogleSheetsResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'google-sheets';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'google-sheets';
  static readonly schema = GoogleSheetsParamsSchema;
  static readonly resultSchema = GoogleSheetsResultSchema;
  static readonly shortDescription =
    'Google Sheets integration for spreadsheet operations';
  static readonly longDescription = `
    Google Sheets service integration for comprehensive spreadsheet data management.
    Use cases:
    - Read and write spreadsheet data with flexible ranges
    - Batch operations for efficient data processing
    - Create and manage spreadsheets and sheets
    - Clear and append data with various formatting options
    - Handle formulas, formatted values, and raw data
    
    Security Features:
    - OAuth 2.0 authentication with Google
    - Scoped access permissions for Google Sheets
    - Secure data validation and sanitization
    - User-controlled access to spreadsheet data
  `;
  static readonly alias = 'sheets';

  constructor(
    params: T = {
      operation: 'read_values',
      spreadsheet_id: '',
      range: 'Sheet1!A1:B10',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Google Sheets credentials are required');
    }

    try {
      // Test the credentials by making a simple API call
      const response = await fetch(
        'https://sheets.googleapis.com/v4/spreadsheets/test',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // Even if the spreadsheet doesn't exist, a 404 with proper auth means credentials work
      return response.status === 404 || response.ok;
    } catch {
      return false;
    }
  }

  private async makeSheetsApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<any> {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://sheets.googleapis.com/v4${endpoint}`;

    const requestHeaders = {
      Authorization: `Bearer ${this.chooseCredential()}`,
      'Content-Type': 'application/json',
      ...headers,
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Sheets API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<GoogleSheetsResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<GoogleSheetsResult> => {
        switch (operation) {
          case 'read_values':
            return await this.readValues(this.params);
          case 'write_values':
            return await this.writeValues(this.params);
          case 'update_values':
            return await this.updateValues(this.params);
          case 'append_values':
            return await this.appendValues(this.params);
          case 'clear_values':
            return await this.clearValues(this.params);
          case 'batch_read_values':
            return await this.batchReadValues(this.params);
          case 'batch_update_values':
            return await this.batchUpdateValues(this.params);
          case 'get_spreadsheet_info':
            return await this.getSpreadsheetInfo(this.params);
          case 'create_spreadsheet':
            return await this.createSpreadsheet(this.params);
          case 'add_sheet':
            return await this.addSheet(this.params);
          case 'delete_sheet':
            return await this.deleteSheet(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<
        GoogleSheetsResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<GoogleSheetsResult, { operation: T['operation'] }>;
    }
  }

  private async readValues(
    params: Extract<GoogleSheetsParams, { operation: 'read_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'read_values' }>> {
    const {
      spreadsheet_id,
      range,
      major_dimension,
      value_render_option,
      date_time_render_option,
    } = params;

    const queryParams = new URLSearchParams({
      majorDimension: major_dimension || 'ROWS',
      valueRenderOption: value_render_option || 'FORMATTED_VALUE',
      dateTimeRenderOption: date_time_render_option || 'SERIAL_NUMBER',
    });

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}?${queryParams.toString()}`
    );

    return {
      operation: 'read_values',
      success: true,
      range: response.range,
      values: response.values || [],
      major_dimension: response.majorDimension,
      error: '',
    };
  }

  private async writeValues(
    params: Extract<GoogleSheetsParams, { operation: 'write_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'write_values' }>> {
    const {
      spreadsheet_id,
      range,
      values,
      major_dimension,
      value_input_option,
      include_values_in_response,
    } = params;

    const queryParams = new URLSearchParams({
      valueInputOption: value_input_option || 'USER_ENTERED',
      includeValuesInResponse:
        include_values_in_response?.toString() || 'false',
    });

    const body = {
      range,
      majorDimension: major_dimension,
      values,
    };

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}?${queryParams.toString()}`,
      'PUT',
      body
    );

    return {
      operation: 'write_values',
      success: true,
      updated_range: response.updatedRange,
      updated_rows: response.updatedRows,
      updated_columns: response.updatedColumns,
      updated_cells: response.updatedCells,
      updated_data: response.updatedData,
      error: '',
    };
  }

  private async updateValues(
    params: Extract<GoogleSheetsParams, { operation: 'update_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'update_values' }>> {
    const {
      spreadsheet_id,
      range,
      values,
      major_dimension,
      value_input_option,
      include_values_in_response,
    } = params;

    const queryParams = new URLSearchParams({
      valueInputOption: value_input_option || 'USER_ENTERED',
      includeValuesInResponse:
        include_values_in_response?.toString() || 'false',
    });

    const body = {
      range,
      majorDimension: major_dimension,
      values,
    };

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}?${queryParams.toString()}`,
      'PUT',
      body
    );

    return {
      operation: 'update_values',
      success: true,
      updated_range: response.updatedRange,
      updated_rows: response.updatedRows,
      updated_columns: response.updatedColumns,
      updated_cells: response.updatedCells,
      updated_data: response.updatedData,
      error: '',
    };
  }

  private async appendValues(
    params: Extract<GoogleSheetsParams, { operation: 'append_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'append_values' }>> {
    const {
      spreadsheet_id,
      range,
      values,
      major_dimension,
      value_input_option,
      insert_data_option,
      include_values_in_response,
    } = params;

    const queryParams = new URLSearchParams({
      valueInputOption: value_input_option || 'USER_ENTERED',
      insertDataOption: insert_data_option || 'INSERT_ROWS',
      includeValuesInResponse:
        include_values_in_response?.toString() || 'false',
    });

    const body = {
      range,
      majorDimension: major_dimension,
      values,
    };

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}:append?${queryParams.toString()}`,
      'POST',
      body
    );

    return {
      operation: 'append_values',
      success: true,
      table_range: response.tableRange,
      updated_range: response.updates?.updatedRange,
      updated_rows: response.updates?.updatedRows,
      updated_columns: response.updates?.updatedColumns,
      updated_cells: response.updates?.updatedCells,
      error: '',
    };
  }

  private async clearValues(
    params: Extract<GoogleSheetsParams, { operation: 'clear_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'clear_values' }>> {
    const { spreadsheet_id, range } = params;

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}:clear`,
      'POST',
      {}
    );

    return {
      operation: 'clear_values',
      success: true,
      cleared_range: response.clearedRange,
      error: '',
    };
  }

  private async batchReadValues(
    params: Extract<GoogleSheetsParams, { operation: 'batch_read_values' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'batch_read_values' }>> {
    const {
      spreadsheet_id,
      ranges,
      major_dimension,
      value_render_option,
      date_time_render_option,
    } = params;

    const queryParams = new URLSearchParams({
      majorDimension: major_dimension || 'ROWS',
      valueRenderOption: value_render_option || 'FORMATTED_VALUE',
      dateTimeRenderOption: date_time_render_option || 'SERIAL_NUMBER',
    });

    // Add multiple ranges
    ranges.forEach((range) => queryParams.append('ranges', range));

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values:batchGet?${queryParams.toString()}`
    );

    return {
      operation: 'batch_read_values',
      success: true,
      value_ranges: response.valueRanges || [],
      error: '',
    };
  }

  private async batchUpdateValues(
    params: Extract<GoogleSheetsParams, { operation: 'batch_update_values' }>
  ): Promise<
    Extract<GoogleSheetsResult, { operation: 'batch_update_values' }>
  > {
    const {
      spreadsheet_id,
      value_ranges,
      value_input_option,
      include_values_in_response,
    } = params;

    const body = {
      valueInputOption: value_input_option,
      includeValuesInResponse: include_values_in_response,
      data: value_ranges.map((vr) => ({
        range: vr.range,
        majorDimension: vr.major_dimension,
        values: vr.values,
      })),
    };

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}/values:batchUpdate`,
      'POST',
      body
    );

    return {
      operation: 'batch_update_values',
      success: true,
      total_updated_rows: response.totalUpdatedRows,
      total_updated_columns: response.totalUpdatedColumns,
      total_updated_cells: response.totalUpdatedCells,
      total_updated_sheets: response.totalUpdatedSheets,
      responses: response.responses?.map((r: any) => ({
        updated_range: r.updatedRange,
        updated_rows: r.updatedRows,
        updated_columns: r.updatedColumns,
        updated_cells: r.updatedCells,
      })),
      error: '',
    };
  }

  private async getSpreadsheetInfo(
    params: Extract<GoogleSheetsParams, { operation: 'get_spreadsheet_info' }>
  ): Promise<
    Extract<GoogleSheetsResult, { operation: 'get_spreadsheet_info' }>
  > {
    const { spreadsheet_id, include_grid_data } = params;

    const queryParams = new URLSearchParams();
    if (include_grid_data) {
      queryParams.set('includeGridData', 'true');
    }

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}?${queryParams.toString()}`
    );

    return {
      operation: 'get_spreadsheet_info',
      success: true,
      spreadsheet: response,
      error: '',
    };
  }

  private async createSpreadsheet(
    params: Extract<GoogleSheetsParams, { operation: 'create_spreadsheet' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'create_spreadsheet' }>> {
    const { title, sheet_titles } = params;

    if (!sheet_titles) {
      throw new Error('Sheet titles are required');
    }

    const body = {
      properties: {
        title,
      },
      sheets: sheet_titles.map((sheetTitle, index) => ({
        properties: {
          title: sheetTitle,
          index,
          sheetType: 'GRID',
          gridProperties: {
            rowCount: 1000,
            columnCount: 26,
          },
        },
      })),
    };

    const response = await this.makeSheetsApiRequest(
      '/spreadsheets',
      'POST',
      body
    );

    return {
      operation: 'create_spreadsheet',
      success: true,
      spreadsheet: response,
      error: '',
    };
  }

  private async addSheet(
    params: Extract<GoogleSheetsParams, { operation: 'add_sheet' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'add_sheet' }>> {
    const { spreadsheet_id, sheet_title, row_count, column_count } = params;

    const body = {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheet_title,
              sheetType: 'GRID',
              gridProperties: {
                rowCount: row_count,
                columnCount: column_count,
              },
            },
          },
        },
      ],
    };

    const response = await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}:batchUpdate`,
      'POST',
      body
    );

    const addSheetResponse = response.replies?.[0]?.addSheet;

    return {
      operation: 'add_sheet',
      success: true,
      sheet_id: addSheetResponse?.properties?.sheetId,
      sheet_title: addSheetResponse?.properties?.title,
      error: '',
    };
  }

  private async deleteSheet(
    params: Extract<GoogleSheetsParams, { operation: 'delete_sheet' }>
  ): Promise<Extract<GoogleSheetsResult, { operation: 'delete_sheet' }>> {
    const { spreadsheet_id, sheet_id } = params;

    const body = {
      requests: [
        {
          deleteSheet: {
            sheetId: sheet_id,
          },
        },
      ],
    };

    await this.makeSheetsApiRequest(
      `/spreadsheets/${spreadsheet_id}:batchUpdate`,
      'POST',
      body
    );

    return {
      operation: 'delete_sheet',
      success: true,
      deleted_sheet_id: sheet_id,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Google Sheets credentials provided');
    }

    // Google Sheets bubble uses GOOGLE_SHEETS_CRED credentials
    return credentials[CredentialType.GOOGLE_SHEETS_CRED];
  }
}
