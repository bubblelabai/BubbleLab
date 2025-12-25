/**
 * Utility functions for Google Sheets bubble
 * Handles range normalization, value sanitization, and error handling
 */

/**
 * Normalizes A1 notation range to ensure sheet names with spaces/special chars are quoted
 *
 * Examples:
 *   "Sheet1!A1:B10" -> "Sheet1!A1:B10"
 *   "Kaus Mode Landing zone!A:G" -> "'Kaus Mode Landing zone'!A:G"
 *   "'Sheet Name'!A1" -> "'Sheet Name'!A1" (already quoted, no change)
 *   "Sheet1!A1" -> "Sheet1!A1" (no sheet name change needed)
 *
 * @param range - A1 notation range string
 * @returns Normalized range with proper quoting
 */
export function normalizeRange(range: string): string {
  // If range doesn't contain '!', it's just a cell/range reference, return as-is
  if (!range.includes('!')) {
    return range;
  }

  const [sheetPart, cellPart] = range.split('!', 2);

  // If already quoted, ensure inner quotes are properly escaped
  if (sheetPart.startsWith("'") && sheetPart.endsWith("'")) {
    const innerName = sheetPart.slice(1, -1);
    // Detect any single quote that is not part of a doubled-quote escape
    const hasUnescapedQuote = /(^|[^'])'([^']|$)/.test(innerName);
    if (hasUnescapedQuote) {
      // Re-escape all quotes - first undo any existing escaping, then escape properly
      const unescapedName = innerName.replace(/''/g, "'");
      const escapedInnerName = unescapedName.replace(/'/g, "''");
      return `'${escapedInnerName}'!${cellPart}`;
    }
    // Already quoted and correctly escaped
    return range;
  }

  // Check if sheet name needs quoting (contains spaces, special chars, or starts with number)
  const needsQuoting =
    sheetPart.includes(' ') ||
    /[^a-zA-Z0-9_]/.test(sheetPart) ||
    /^\d/.test(sheetPart);

  if (needsQuoting) {
    // Escape single quotes in sheet name and wrap in quotes
    const escapedSheetName = sheetPart.replace(/'/g, "''");
    return `'${escapedSheetName}'!${cellPart}`;
  }

  return range;
}

/**
 * Validates A1 notation range format
 * Returns normalized range or throws descriptive error
 *
 * @param range - A1 notation range string
 * @returns Normalized and validated range
 * @throws Error if range format is invalid
 */
export function validateAndNormalizeRange(range: string): string {
  if (!range || typeof range !== 'string') {
    throw new Error('Range must be a non-empty string');
  }

  const normalized = normalizeRange(range);

  // Basic validation: should contain at least one cell reference
  // Pattern: [SheetName!]A1[:B10] or [SheetName!]A[:G]
  // Handles both quoted ('Sheet Name'!) and unquoted (Sheet1!) sheet names
  const rangePattern = /^(('[^']*'|[^!]*?)!)?[A-Z]+\d*(:[A-Z]+\d*)?$/;
  if (!normalized.match(rangePattern)) {
    throw new Error(
      `Invalid range format: "${range}". Expected format: "SheetName!A1:B10" or "'Sheet Name'!A:G"`
    );
  }

  return normalized;
}

/**
 * Sanitizes values array by converting null/undefined to empty strings
 * This ensures Google Sheets API compatibility (only accepts string | number | boolean)
 *
 * Also handles Date objects by converting them to ISO strings
 *
 * @param values - Values array (may contain null/undefined/Date objects)
 * @returns Sanitized array with only string | number | boolean values
 */
export function sanitizeValues(
  values: unknown
): Array<Array<string | number | boolean>> {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((row) => {
    if (!Array.isArray(row)) {
      return [];
    }
    return row.map((cell) => {
      // Convert null/undefined to empty string
      if (cell === null || cell === undefined) {
        return '';
      }

      // Handle Date objects
      if (cell instanceof Date) {
        return cell.toISOString();
      }

      // Keep valid types as-is
      if (
        typeof cell === 'string' ||
        typeof cell === 'number' ||
        typeof cell === 'boolean'
      ) {
        return cell;
      }

      // Convert everything else to string
      return String(cell);
    });
  });
}

/**
 * Enhances Google Sheets API error messages with helpful hints
 *
 * @param errorText - Raw error text from API
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param spreadsheetId - Optional spreadsheet ID for generating helpful links
 * @returns Enhanced error message with helpful hints
 */
/**
 * Extracts sheet name from a range string
 * Examples:
 *   "Sheet1!A1:B10" -> "Sheet1"
 *   "'Sheet Name'!A1" -> "Sheet Name"
 *   "A1:B10" -> undefined (no sheet name)
 */
function extractSheetName(range: string): string | undefined {
  if (!range.includes('!')) {
    return undefined;
  }

  const [sheetPart] = range.split('!', 2);

  // Remove quotes if present
  if (sheetPart.startsWith("'") && sheetPart.endsWith("'")) {
    return sheetPart.slice(1, -1).replace(/''/g, "'");
  }

  return sheetPart;
}

export function enhanceErrorMessage(
  errorText: string,
  status: number,
  statusText: string,
  spreadsheetId?: string,
  range?: string
): string {
  let errorMessage = `Google Sheets API error: ${status} ${statusText}`;

  try {
    const errorJson = JSON.parse(errorText);
    const apiError = errorJson.error;

    if (apiError?.message) {
      errorMessage = apiError.message;

      // Provide helpful hints for common errors
      if (apiError.message.includes('Unable to parse range')) {
        const spreadsheetLink = spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
          : 'the spreadsheet';

        const sheetName = range ? extractSheetName(range) : undefined;
        const sheetNameInfo = sheetName ? ` "${sheetName}"` : '';

        errorMessage += range ? `\nRange: "${range}"` : '';
        errorMessage +=
          `\nPlease verify that the sheet name${sheetNameInfo} exists in ${spreadsheetLink}. ` +
          `Navigate to the spreadsheet and check the exact sheet name (case-sensitive). ` +
          `The sheet name in your range must match exactly, including any spaces or special characters.`;
      } else if (apiError.message.includes('INVALID_ARGUMENT')) {
        errorMessage +=
          '. Please check that all values are strings, numbers, or booleans (not null/undefined). The bubble automatically converts null/undefined to empty strings.';
      } else if (
        apiError.message.includes('PERMISSION_DENIED') ||
        apiError.message.includes('permission')
      ) {
        errorMessage +=
          '. Please ensure your credentials have access to this spreadsheet. The spreadsheet must be present on the same account you connected bubble lab to.';
      } else if (apiError.message.includes('NOT_FOUND')) {
        const spreadsheetLink = spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
          : 'the spreadsheet';

        const sheetName = range ? extractSheetName(range) : undefined;
        const sheetNameInfo = sheetName ? ` "${sheetName}"` : '';

        errorMessage += `. The spreadsheet or sheet may not exist, or you may not have access to it.`;
        if (range) {
          errorMessage += `\nRange: "${range}"`;
        }
        errorMessage += `\nPlease navigate to ${spreadsheetLink} and verify that the sheet name${sheetNameInfo} exists and matches exactly (case-sensitive).`;
      }
    }
  } catch {
    // If parsing fails, use the raw error text
    errorMessage += ` - ${errorText}`;
  }

  return errorMessage;
}
