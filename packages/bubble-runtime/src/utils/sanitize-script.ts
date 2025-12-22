/**
 * Sanitizes user script code by blocking access to process.env.
 * Transforms the code to replace process.env references with a throw statement.
 *
 * This prevents users from accessing sensitive environment variables
 * without affecting the global process.env used by the API server.
 *
 * @param code - The code to sanitize
 * @param _moduleIdentifier - A unique identifier for the module (unused, kept for API compatibility)
 */
export function sanitizeScript(
  code: string,
  _moduleIdentifier?: string
): string {
  // Use regex to replace process.env access patterns with a throw statement
  // This is simpler than trying to intercept at runtime and more reliable

  const throwError =
    "(() => { throw new Error('Access to process.env is not allowed in bubble flows for security reasons.'); })()";

  // Pattern 1: process.env.SOMETHING or process.env['SOMETHING'] or process.env["SOMETHING"]
  // Replace property access with throw
  let transformed = code.replace(
    /process\.env\s*(\[['"`]?[^'"`\]]+['"`]?\]|\.\w+)/g,
    throwError
  );

  // Pattern 2: Standalone process.env (without property access)
  // This handles cases like: const env = process.env; Object.keys(process.env); etc.
  // We use word boundaries to avoid matching inside strings or other contexts
  // The negative lookahead ensures we don't match if it's followed by . or [
  transformed = transformed.replace(
    /\bprocess\.env\b(?![.\["'`\w])/g,
    throwError
  );

  return transformed;
}
