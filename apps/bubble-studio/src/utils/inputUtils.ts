/**
 * Filters out empty values from an inputs object.
 * Excludes: undefined, empty strings, and empty arrays.
 * This allows default values to be used when inputs are empty.
 */
export function filterEmptyInputs(
  inputs: Record<string, unknown>
): Record<string, unknown> {
  return Object.entries(inputs || {}).reduce(
    (acc, [key, value]) => {
      // Skip undefined values
      if (value === undefined) {
        return acc;
      }

      // Skip empty strings (trim to match backend behavior)
      if (typeof value === 'string' && value.trim() === '') {
        return acc;
      }

      // Skip empty arrays - let them use default values
      if (Array.isArray(value) && value.length === 0) {
        return acc;
      }

      acc[key] = value;
      return acc;
    },
    {} as Record<string, unknown>
  );
}
