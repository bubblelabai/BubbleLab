/**
 * Utility functions for parameter handling
 */

/**
 * Sanitizes parameters by removing credential-related fields
 * @param params - The parameters object to sanitize
 * @returns A new object with credentials removed
 */
export function sanitizeParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  // Remove credentials from params
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !key.startsWith('credentials'))
  );
}
