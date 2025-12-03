/**
 * Shared hashing utilities for generating deterministic variable IDs
 */

/**
 * Generate a deterministic non-negative integer ID from a string input.
 * Uses FNV-1a hash algorithm for better distribution and fewer collisions.
 *
 * This is used to generate variableIds that remain consistent across:
 * - Bubble parsing (BubbleParser)
 * - Logger injection (LoggerInjector)
 *
 * @param input - String to hash (e.g., method name, uniqueId)
 * @returns A 6-digit integer in the range [100000, 999999]
 */
export function hashToVariableId(input: string): number {
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // unsigned 32-bit
  }
  // Map to 6-digit range to avoid colliding with small AST ids while readable
  const mapped = 100000 + (hash % 900000);
  return mapped;
}

/**
 * Build a call site key from method name and invocation order.
 * Using the ordinal position of the invocation within the method keeps the key
 * stable even if lines shift after instrumentation.
 *
 * @param methodName - Name of the instance method being called
 * @param invocationIndex - 1-based invocation index within that method
 * @returns A string key in the format "methodName#invocationIndex"
 */
export function buildCallSiteKey(
  methodName: string,
  invocationIndex: number
): string {
  return `${methodName}#${invocationIndex}`;
}
