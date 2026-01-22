import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';
import { normalizeRange, sanitizeValues } from './google-sheets.utils.js';

// Define value range schema
export const ValueRangeSchema = z
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
export const SpreadsheetInfoSchema = z
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

// Helper to create a range field with automatic normalization
// Uses transform instead of preprocess to preserve string input type
const createRangeField = (description: string) =>
  z
    .string()
    .min(1, 'Range is required')
    .transform((val) => normalizeRange(val))
    .describe(description);

// Helper to create a values field with automatic sanitization
// Uses transform instead of preprocess to preserve array input type
// Input accepts any cell values (string, number, boolean, null, undefined, Date, etc.)
// Output is sanitized to only string, number, or boolean
const createValuesField = (description: string) =>
  z
    .array(z.array(z.unknown()))
    .min(1, 'Values array cannot be empty')
    .transform((val) => sanitizeValues(val))
    .describe(description);

// Helper to create a ranges array field with automatic normalization
// Uses transform instead of preprocess to preserve string[] input type
const createRangesField = (description: string) =>
  z
    .array(z.string())
    .min(1, 'At least one range is required')
    .transform((val) => val.map((r) => normalizeRange(r)))
    .describe(description);

// Define the parameters schema for Google Sheets operations
export const GoogleSheetsParamsSchema = z.discriminatedUnion('operation', [
  // Read values operation
  z.object({
    operation: z.literal('read_values').describe('Read values from a range'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    range: createRangeField(
      'A1 notation range (e.g., "Sheet1!A1:B10" or "Tab Name!A:G" - tab names with spaces are automatically quoted)'
    ),
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
    range: createRangeField(
      'A1 notation range (e.g., "Sheet1!A1:B10" or "Tab Name!A:G" - tab names with spaces are automatically quoted)'
    ),
    values: createValuesField(
      'Data to write as array of arrays (null/undefined automatically converted to empty strings)'
    ),
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
    range: createRangeField(
      'A1 notation range (e.g., "Sheet1!A1:B10" or "Tab Name!A:G" - tab names with spaces are automatically quoted)'
    ),
    values: createValuesField(
      'Data to update as array of arrays (null/undefined automatically converted to empty strings)'
    ),
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
    range: createRangeField(
      'A1 notation range to search for table (e.g., "Sheet1!A:A" or "Tab Name!A:G" - tab names with spaces are automatically quoted)'
    ),
    values: createValuesField(
      'Data to append as array of arrays (null/undefined automatically converted to empty strings)'
    ),
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
    range: createRangeField(
      'A1 notation range (e.g., "Sheet1!A1:B10" or "Tab Name!A:G" - tab names with spaces are automatically quoted)'
    ),
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
    ranges: createRangesField(
      'Array of A1 notation ranges (tab names with spaces are automatically quoted)'
    ),
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
          range: z
            .string()
            .transform((val) => normalizeRange(val))
            .describe(
              'A1 notation range (tab names with spaces are automatically quoted)'
            ),
          values: z
            .array(z.array(z.unknown()))
            .transform((val) => sanitizeValues(val))
            .describe(
              'Data values (null/undefined automatically converted to empty strings)'
            ),
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
      .describe(
        'Tab names for the initial tabs (these are the tabs at the bottom of a spreadsheet, not the spreadsheet name)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Add sheet operation
  z.object({
    operation: z.literal('add_sheet').describe('Add a new tab to spreadsheet'),
    spreadsheet_id: z
      .string()
      .min(1, 'Spreadsheet ID is required')
      .describe('Google Sheets spreadsheet ID'),
    sheet_title: z
      .string()
      .min(1, 'Tab name is required')
      .describe(
        'Tab name for the new tab (this is the tab at the bottom of a spreadsheet, not the spreadsheet name)'
      ),
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
      .describe('Delete a tab from spreadsheet'),
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
export const GoogleSheetsResultSchema = z.discriminatedUnion('operation', [
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
    operation: z.literal('add_sheet').describe('Add a new tab to spreadsheet'),
    success: z.boolean().describe('Whether the operation was successful'),
    sheet_id: z.number().optional().describe('ID of the added sheet'),
    sheet_title: z.string().optional().describe('Tab name of the added tab'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('delete_sheet')
      .describe('Delete a tab from spreadsheet'),
    success: z.boolean().describe('Whether the operation was successful'),
    deleted_sheet_id: z.number().optional().describe('ID of the deleted sheet'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type GoogleSheetsResult = z.output<typeof GoogleSheetsResultSchema>;
// Use output type for params since preprocessing converts input to output
// This ensures range, values, etc. have correct types (string, not unknown)
export type GoogleSheetsParams = z.output<typeof GoogleSheetsParamsSchema>;

// Export the input type for external usage
export type GoogleSheetsParamsInput = z.input<typeof GoogleSheetsParamsSchema>;
