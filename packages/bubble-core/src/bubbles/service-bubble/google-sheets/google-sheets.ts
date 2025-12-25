import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  GoogleSheetsParamsSchema,
  GoogleSheetsResultSchema,
  type GoogleSheetsParams,
  type GoogleSheetsParamsInput,
  type GoogleSheetsResult,
} from './google-sheets.schema.js';
import { enhanceErrorMessage } from './google-sheets.utils.js';

/**
 * Google Sheets Service Bubble
 *
 * Comprehensive Google Sheets integration for spreadsheet data management.
 *
 * Features:
 * - Automatic range normalization (quotes sheet names with spaces)
 * - Automatic value sanitization (converts null/undefined to empty strings)
 * - Enhanced error messages with helpful hints
 * - Support for all major Google Sheets operations
 *
 * Use cases:
 * - Read and write spreadsheet data with flexible ranges
 * - Batch operations for efficient data processing
 * - Create and manage spreadsheets and sheets
 * - Clear and append data with various formatting options
 * - Handle formulas, formatted values, and raw data
 *
 * Security Features:
 * - OAuth 2.0 authentication with Google
 * - Scoped access permissions for Google Sheets
 * - Secure data validation and sanitization
 * - User-controlled access to spreadsheet data
 */
export class GoogleSheetsBubble<
  T extends GoogleSheetsParamsInput = GoogleSheetsParamsInput,
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
    
    Features:
    - Automatic range normalization (sheet names with spaces are automatically quoted)
    - Automatic value sanitization (null/undefined converted to empty strings)
    - Enhanced error messages with helpful hints
    - Support for all major Google Sheets operations
    
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
    headers: Record<string, string> = {},
    spreadsheetId?: string,
    range?: string
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
      // Extract spreadsheet ID from endpoint if not provided
      const extractedSpreadsheetId =
        spreadsheetId ||
        endpoint.match(/\/spreadsheets\/([^/]+)/)?.[1] ||
        undefined;
      const enhancedError = enhanceErrorMessage(
        errorText,
        response.status,
        response.statusText,
        extractedSpreadsheetId,
        range
      );
      throw new Error(enhancedError);
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
        // Cast to output type since base class already parsed input through Zod
        const parsedParams = this.params as GoogleSheetsParams;
        switch (operation) {
          case 'read_values':
            return await this.readValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'read_values' }
              >
            );
          case 'write_values':
            return await this.writeValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'write_values' }
              >
            );
          case 'update_values':
            return await this.updateValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'update_values' }
              >
            );
          case 'append_values':
            return await this.appendValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'append_values' }
              >
            );
          case 'clear_values':
            return await this.clearValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'clear_values' }
              >
            );
          case 'batch_read_values':
            return await this.batchReadValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'batch_read_values' }
              >
            );
          case 'batch_update_values':
            return await this.batchUpdateValues(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'batch_update_values' }
              >
            );
          case 'get_spreadsheet_info':
            return await this.getSpreadsheetInfo(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'get_spreadsheet_info' }
              >
            );
          case 'create_spreadsheet':
            return await this.createSpreadsheet(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'create_spreadsheet' }
              >
            );
          case 'add_sheet':
            return await this.addSheet(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'add_sheet' }
              >
            );
          case 'delete_sheet':
            return await this.deleteSheet(
              parsedParams as Extract<
                GoogleSheetsParams,
                { operation: 'delete_sheet' }
              >
            );
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
      `/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}?${queryParams.toString()}`,
      'GET',
      undefined,
      {},
      undefined,
      range
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
      body,
      {},
      undefined,
      range
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
      body,
      {},
      undefined,
      range
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
      body,
      {},
      undefined,
      range
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
      {},
      {},
      undefined,
      range
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
