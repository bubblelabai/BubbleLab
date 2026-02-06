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
    error?: string;
  }[];
}

/**
 * Payload for the Wide Columns Test workflow.
 * Tests reading/writing data beyond column Z (26+ columns).
 */
export interface WideColumnsTestPayload extends WebhookEvent {
  /**
   * The title for the test spreadsheet.
   * @canBeFile false
   */
  testTitle?: string;

  /**
   * Number of columns to test (default 50, which goes up to column AX).
   * @canBeFile false
   */
  columnCount?: number;
}

/**
 * Helper to convert column index to letter(s).
 * 0 = A, 25 = Z, 26 = AA, 27 = AB, etc.
 */
function columnIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Integration test that verifies Google Sheets can read/write beyond column Z.
 * This tests the fix for the "24 row" issue which was actually a column limitation.
 */
export class GoogleSheetsWideColumnsTest extends BubbleFlow<'webhook/http'> {
  // Creates a test spreadsheet
  private async createTestSpreadsheet(title: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'create_spreadsheet',
      title: title,
      sheet_titles: ['WideData'],
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

  // Generates test data with many columns
  private generateWideData(columnCount: number, rowCount: number) {
    const headers: string[] = [];
    for (let i = 0; i < columnCount; i++) {
      const letter = columnIndexToLetter(i);
      headers.push(`Column_${letter}`);
    }

    const rows: (string | number | boolean)[][] = [headers];

    for (let row = 0; row < rowCount; row++) {
      const rowData: (string | number | boolean)[] = [];
      for (let col = 0; col < columnCount; col++) {
        // Mix of data types
        if (col % 3 === 0) {
          rowData.push(`R${row + 1}_C${col + 1}`);
        } else if (col % 3 === 1) {
          rowData.push(row * columnCount + col);
        } else {
          rowData.push(row % 2 === 0);
        }
      }
      rows.push(rowData);
    }

    return rows;
  }

  // Writes data to the entire sheet (no column restriction)
  private async writeWideData(
    spreadsheetId: string,
    sheetName: string,
    data: (string | number | boolean)[][]
  ) {
    const result = await new GoogleSheetsBubble({
      operation: 'write_values',
      spreadsheet_id: spreadsheetId,
      range: sheetName, // Just sheet name - no column restriction!
      values: data,
      value_input_option: 'RAW',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to write wide data: ${result.error}`);
    }

    return result.data;
  }

  // Reads entire sheet (no column restriction)
  private async readEntireSheet(spreadsheetId: string, sheetName: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: sheetName, // Just sheet name - reads ALL columns
      value_render_option: 'FORMATTED_VALUE',
    }).action();

    if (!result.success || result.data?.operation !== 'read_values') {
      throw new Error(`Failed to read entire sheet: ${result.error}`);
    }

    return result.data.values;
  }

  // Reads with explicit wide range (A:ZZ pattern)
  private async readWithWideRange(spreadsheetId: string, sheetName: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: `${sheetName}!A:ZZ`, // Explicit wide range beyond Z
      value_render_option: 'FORMATTED_VALUE',
    }).action();

    if (!result.success || result.data?.operation !== 'read_values') {
      throw new Error(`Failed to read with wide range: ${result.error}`);
    }

    return result.data.values;
  }

  // Reads with old limited range (A:Z) to show the problem
  private async readWithLimitedRange(spreadsheetId: string, sheetName: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: `${sheetName}!A:Z`, // LIMITED to 26 columns - will miss data!
      value_render_option: 'FORMATTED_VALUE',
    }).action();

    if (!result.success || result.data?.operation !== 'read_values') {
      throw new Error(`Failed to read with limited range: ${result.error}`);
    }

    return result.data.values;
  }

  // Reads specific columns beyond Z (e.g., AA:AC)
  private async readBeyondZ(spreadsheetId: string, sheetName: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: `${sheetName}!AA:AC`, // Columns 27-29
      value_render_option: 'FORMATTED_VALUE',
    }).action();

    if (!result.success || result.data?.operation !== 'read_values') {
      throw new Error(`Failed to read beyond Z: ${result.error}`);
    }

    return result.data.values;
  }

  async handle(payload: WideColumnsTestPayload): Promise<Output> {
    const {
      testTitle = 'Wide Columns Test',
      columnCount = 50, // Default to 50 columns (A to AX)
    } = payload;
    const results: Output['testResults'] = [];
    const sheetName = 'WideData';
    const rowCount = 10;

    // 1. Create Spreadsheet
    const spreadsheet = await this.createTestSpreadsheet(testTitle);
    const spreadsheetId = spreadsheet.spreadsheetId;
    results.push({
      operation: 'create_spreadsheet',
      success: true,
      details: `Created spreadsheet: ${spreadsheet.spreadsheetUrl}`,
    });

    // 2. Generate wide test data
    const lastColumn = columnIndexToLetter(columnCount - 1);
    const testData = this.generateWideData(columnCount, rowCount);
    results.push({
      operation: 'generate_test_data',
      success: true,
      details: `Generated ${rowCount + 1} rows x ${columnCount} columns (A to ${lastColumn})`,
    });

    // 3. Write wide data using just sheet name (no column restriction)
    await this.writeWideData(spreadsheetId, sheetName, testData);
    results.push({
      operation: 'write_wide_data',
      success: true,
      details: `Wrote ${testData.length} rows with ${columnCount} columns`,
    });

    // 4. Read using just sheet name (should get ALL columns)
    const entireSheetData = await this.readEntireSheet(
      spreadsheetId,
      sheetName
    );
    const entireSheetCols = entireSheetData?.[0]?.length || 0;
    results.push({
      operation: 'read_entire_sheet',
      success: entireSheetCols === columnCount,
      details: `Read ${entireSheetData?.length || 0} rows x ${entireSheetCols} columns (expected ${columnCount})`,
      error:
        entireSheetCols !== columnCount
          ? `Missing ${columnCount - entireSheetCols} columns!`
          : undefined,
    });

    // 5. Read using A:ZZ (explicit wide range)
    const wideRangeData = await this.readWithWideRange(
      spreadsheetId,
      sheetName
    );
    const wideRangeCols = wideRangeData?.[0]?.length || 0;
    results.push({
      operation: 'read_with_A:ZZ_range',
      success: wideRangeCols === columnCount,
      details: `Read ${wideRangeData?.length || 0} rows x ${wideRangeCols} columns (expected ${columnCount})`,
      error:
        wideRangeCols !== columnCount
          ? `Missing ${columnCount - wideRangeCols} columns!`
          : undefined,
    });

    // 6. Read using A:Z (LIMITED - demonstrates the problem)
    const limitedData = await this.readWithLimitedRange(
      spreadsheetId,
      sheetName
    );
    const limitedCols = limitedData?.[0]?.length || 0;
    const expectedLimited = Math.min(26, columnCount);
    results.push({
      operation: 'read_with_A:Z_range_LIMITED',
      success: limitedCols === expectedLimited,
      details: `Read ${limitedData?.length || 0} rows x ${limitedCols} columns (ONLY 26 max with A:Z!)`,
      error:
        columnCount > 26
          ? `A:Z range only reads 26 columns - MISSING ${columnCount - 26} columns! Use sheet name or A:ZZ instead.`
          : undefined,
    });

    // 7. Read specific columns beyond Z (AA:AC)
    if (columnCount > 28) {
      const beyondZData = await this.readBeyondZ(spreadsheetId, sheetName);
      const beyondZCols = beyondZData?.[0]?.length || 0;
      results.push({
        operation: 'read_columns_AA_to_AC',
        success: beyondZCols === 3,
        details: `Read columns AA-AC: ${beyondZCols} columns, first header: ${beyondZData?.[0]?.[0]}`,
      });
    }

    // 8. Verify data integrity - check last column value
    const lastColHeader = entireSheetData?.[0]?.[columnCount - 1];
    const expectedLastHeader = `Column_${lastColumn}`;
    results.push({
      operation: 'verify_last_column',
      success: lastColHeader === expectedLastHeader,
      details: `Last column header: "${lastColHeader}" (expected "${expectedLastHeader}")`,
      error:
        lastColHeader !== expectedLastHeader
          ? `Data integrity issue: last column mismatch`
          : undefined,
    });

    return {
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl || '',
      testResults: results,
    };
  }
}
