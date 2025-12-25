import {
  BubbleFlow,
  GoogleSheetsBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  spreadsheetId: string;
  spreadsheetUrl: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Google Sheets Stress Test workflow.
 */
export interface SheetsStressTestPayload extends WebhookEvent {
  /**
   * The title for the test spreadsheet that will be created.
   * @canBeFile false
   */
  testTitle?: string;
}

export class GoogleSheetsStressTest extends BubbleFlow<'webhook/http'> {
  // Creates a new Google Spreadsheet with a specific title
  private async createTestSpreadsheet(title: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'create_spreadsheet',
      title: title,
      sheet_titles: ['InitialSheet'],
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_spreadsheet' ||
      !result.data.spreadsheet
    ) {
      throw new Error(`Failed to create spreadsheet: ${result.error}`);
    }

    return result.data.spreadsheet;
  }

  // Adds a sheet with spaces in the name - tests if bubble handles spaces without manual quoting
  private async createSheetWithSpaces(
    spreadsheetId: string,
    sheetName: string
  ) {
    const result = await new GoogleSheetsBubble({
      operation: 'add_sheet',
      spreadsheet_id: spreadsheetId,
      sheet_title: sheetName,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'add_sheet' ||
      result.data.sheet_id === undefined
    ) {
      throw new Error(`Failed to add sheet with spaces: ${result.error}`);
    }

    return result.data.sheet_id;
  }

  // Writes raw data with nulls/undefineds to test bubble's native null handling
  private async writeRawDataWithNulls(
    spreadsheetId: string,
    range: string,
    data: unknown[][]
  ) {
    const result = await new GoogleSheetsBubble({
      operation: 'write_values',
      spreadsheet_id: spreadsheetId,
      range: range,
      values: data as (string | number | boolean)[][],
      value_input_option: 'RAW',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to write stress test data: ${result.error}`);
    }

    return result.data;
  }

  // Reads data from a range with spaces in sheet name - tests bubble's range parsing
  private async readFromRangeWithSpaces(spreadsheetId: string, range: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: range,
      value_render_option: 'FORMATTED_VALUE',
    }).action();

    if (!result.success || result.data?.operation !== 'read_values') {
      throw new Error(`Failed to read verification data: ${result.error}`);
    }

    return result.data.values;
  }

  // Appends data to a range with spaces in sheet name
  private async appendToRangeWithSpaces(
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean)[][]
  ) {
    const result = await new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: range,
      values: values,
      insert_data_option: 'INSERT_ROWS',
      value_input_option: 'RAW',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to append data: ${result.error}`);
    }

    return result.data;
  }

  // Clears data from a range with spaces in sheet name
  private async clearRangeWithSpaces(spreadsheetId: string, range: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'clear_values',
      spreadsheet_id: spreadsheetId,
      range: range,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to clear data: ${result.error}`);
    }

    return result.data;
  }

  // Deletes a sheet by ID
  private async deleteSheet(spreadsheetId: string, sheetId: number) {
    const result = await new GoogleSheetsBubble({
      operation: 'delete_sheet',
      spreadsheet_id: spreadsheetId,
      sheet_id: sheetId,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to delete test sheet: ${result.error}`);
    }

    return result.data;
  }

  async handle(payload: SheetsStressTestPayload): Promise<Output> {
    const { testTitle = 'Integration Stress Test' } = payload;
    const results: Output['testResults'] = [];
    const sheetNameWithSpaces = 'Kaus Mode Landing zone';

    // 1. Create Spreadsheet
    const spreadsheet = await this.createTestSpreadsheet(testTitle);
    const spreadsheetId = spreadsheet.spreadsheetId;
    results.push({ operation: 'create_spreadsheet', success: true });

    // 2. Create Sheet with Spaces - NO HELPER
    const sheetId = await this.createSheetWithSpaces(
      spreadsheetId,
      sheetNameWithSpaces
    );
    results.push({ operation: 'add_sheet_with_spaces', success: true });

    // 3. Write Data - RAW DATA WITH NULLS/UNDEFINEDS, NO SANITIZATION
    const rawData = [
      ['Name', 'Age', 'Email', 'Department', 'Salary', 'Active'],
      ['John Doe', 28, 'john@example.com', 'Engineering', 95000, true],
      ['Jane Smith', 34, 'jane@example.com', 'Marketing', 78000, true],
      [null, undefined, 'Mixed', 'Sales', null, false],
      ['Bob Johnson', 42, 'bob@example.com', null, 120000, true],
      ['Alice Williams', 31, null, 'Engineering', 88000, undefined],
      ['End of', 'Test', null, 'HR', 65000, false],
    ];

    // RANGE WITH SPACES - NO QUOTE WRAPPING
    const writeRange = `${sheetNameWithSpaces}!A1:F7`;
    await this.writeRawDataWithNulls(spreadsheetId, writeRange, rawData);
    results.push({ operation: 'write_values_with_nulls', success: true });

    // 4. Read Verification - Multiple read operations to test different scenarios

    // 4a. Read entire written range
    const readRange = `${sheetNameWithSpaces}!A1:F7`;
    const readValues = await this.readFromRangeWithSpaces(
      spreadsheetId,
      readRange
    );
    results.push({
      operation: 'read_values_full_range',
      success: !!readValues && readValues.length > 0,
      details: `Read ${readValues?.length || 0} rows with ${readValues?.[0]?.length || 0} columns`,
    });

    // 4b. Read just headers
    const headerRange = `${sheetNameWithSpaces}!A1:F1`;
    const headerValues = await this.readFromRangeWithSpaces(
      spreadsheetId,
      headerRange
    );
    results.push({
      operation: 'read_headers_only',
      success: !!headerValues && headerValues.length > 0,
      details: `Read headers: ${headerValues?.[0]?.join(', ') || 'no headers'}`,
    });

    // 4c. Read single column
    const columnRange = `${sheetNameWithSpaces}!A:A`;
    const columnValues = await this.readFromRangeWithSpaces(
      spreadsheetId,
      columnRange
    );
    results.push({
      operation: 'read_single_column',
      success: !!columnValues && columnValues.length > 0,
      details: `Read ${columnValues?.length || 0} rows from Name column`,
    });

    // 4d. Read partial range (middle rows)
    const partialRange = `${sheetNameWithSpaces}!B3:E5`;
    const partialValues = await this.readFromRangeWithSpaces(
      spreadsheetId,
      partialRange
    );
    results.push({
      operation: 'read_partial_range',
      success: !!partialValues && partialValues.length > 0,
      details: `Read ${partialValues?.length || 0} rows from partial range`,
    });

    // 5. Append Data - RANGE WITH SPACES, NO QUOTE WRAPPING
    const appendRange = `${sheetNameWithSpaces}!A:A`;
    const appendValues = [
      ['Charlie Brown', 29, 'charlie@example.com', 'Finance', 72000, true],
    ];
    await this.appendToRangeWithSpaces(
      spreadsheetId,
      appendRange,
      appendValues
    );
    results.push({ operation: 'append_values', success: true });

    // 5a. Read after append to verify
    const postAppendRange = `${sheetNameWithSpaces}!A1:F8`;
    const postAppendValues = await this.readFromRangeWithSpaces(
      spreadsheetId,
      postAppendRange
    );
    results.push({
      operation: 'read_after_append',
      success: !!postAppendValues && postAppendValues.length === 8,
      details: `Read ${postAppendValues?.length || 0} rows after append (expected 8)`,
    });

    // 6. Clear Data - RANGE WITH SPACES, NO QUOTE WRAPPING
    const clearRange = `${sheetNameWithSpaces}!A1:F10`;
    await this.clearRangeWithSpaces(spreadsheetId, clearRange);
    results.push({ operation: 'clear_values', success: true });

    // 7. Delete Sheet
    await this.deleteSheet(spreadsheetId, sheetId);
    results.push({ operation: 'delete_sheet', success: true });

    return {
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl || '',
      testResults: results,
    };
  }
}
