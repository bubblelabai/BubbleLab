/**
 * Utility functions for parsing BubbleFlow code
 */

/**
 * Extracts the class name from BubbleFlow code
 * Looks for pattern: export class ClassName extends BubbleFlow
 *
 * @param code - The TypeScript code containing the BubbleFlow class
 * @returns The class name or null if not found
 */
export function extractClassName(code: string): string | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  // Remove comments and clean up the code for better parsing
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Pattern to match: export class ClassName extends BubbleFlow
  // This handles various spacing and optional generic parameters
  const classPattern =
    /export\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+extends\s+BubbleFlow/;

  const match = cleanCode.match(classPattern);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Generates a default flow name based on timestamp if class name extraction fails
 *
 * @returns A default flow name with timestamp
 */
export function generateDefaultFlowName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `Flow_${timestamp}`;
}

/**
 * Gets a meaningful flow name from code, with fallback to default name
 *
 * @param code - The TypeScript code containing the BubbleFlow class
 * @returns A meaningful flow name
 */
export function getFlowNameFromCode(code: string): string {
  const className = extractClassName(code);
  return className || generateDefaultFlowName();
}

export function cleanupFlattenedKeys(
  inputsState: Record<string, unknown>
): Record<string, unknown> {
  // Remove any flattened keys that should be nested in arrays
  const cleanedInputs = { ...inputsState };
  const keysToRemove: string[] = [];

  Object.keys(cleanedInputs).forEach((key) => {
    // Check if this key looks like a flattened array property (e.g., "images[0].data")
    if (key.includes('[') && key.includes(']')) {
      keysToRemove.push(key);
    }
  });

  keysToRemove.forEach((key) => {
    delete cleanedInputs[key];
  });

  return cleanedInputs;
}
