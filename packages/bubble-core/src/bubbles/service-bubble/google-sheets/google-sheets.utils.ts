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

  // If already quoted, return as-is
  if (sheetPart.startsWith("'") && sheetPart.endsWith("'")) {
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
  const rangePattern = /^([^!]*!)?[A-Z]+\d*(:[A-Z]+\d*)?$/;
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
 * @returns Enhanced error message with helpful hints
 */
export function enhanceErrorMessage(
  errorText: string,
  status: number,
  statusText: string
): string {
  let errorMessage = `Google Sheets API error: ${status} ${statusText}`;

  try {
    const errorJson = JSON.parse(errorText);
    const apiError = errorJson.error;

    if (apiError?.message) {
      errorMessage = apiError.message;

      // Provide helpful hints for common errors
      if (apiError.message.includes('Unable to parse range')) {
        errorMessage +=
          '. Tip: Sheet names with spaces must be quoted, e.g., "Sheet Name!A1" should be "\'Sheet Name\'!A1". The bubble automatically handles this for you.';
      } else if (apiError.message.includes('INVALID_ARGUMENT')) {
        errorMessage +=
          '. Please check that all values are strings, numbers, or booleans (not null/undefined). The bubble automatically converts null/undefined to empty strings.';
      } else if (apiError.message.includes('PERMISSION_DENIED')) {
        errorMessage +=
          '. Please ensure your credentials have access to this spreadsheet.';
      } else if (apiError.message.includes('NOT_FOUND')) {
        errorMessage +=
          '. The spreadsheet or sheet may not exist, or you may not have access to it.';
      }
    }
  } catch {
    // If parsing fails, use the raw error text
    errorMessage += ` - ${errorText}`;
  }

  return errorMessage;
}
