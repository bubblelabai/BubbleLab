/**
 * Sanitizes user script code by blocking access to process.env.
 * Transforms the code to replace process.env references with a throw statement.
 *
 * This prevents users from accessing sensitive environment variables
 * without affecting the global process.env used by the API server.
 *
 * @param code - The code to sanitize
 */
export function sanitizeScript(code: string): string {
  // Use a marker-based approach to avoid replacing process.env in strings and comments
  const PLACEHOLDER_PREFIX = '__SANITIZE_PLACEHOLDER_';
  const placeholders: string[] = [];

  // Step 1: Temporarily replace string literals and comments with placeholders
  // This prevents matching process.env inside strings or comments

  // Match string literals (single, double, template) and comments
  const stringAndCommentPattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

  let protectedCode = code.replace(stringAndCommentPattern, (match) => {
    const index = placeholders.length;
    placeholders.push(match);
    return `${PLACEHOLDER_PREFIX}${index}__`;
  });

  // Step 2: Now safely replace process.env patterns in the code (strings/comments are protected)
  // Note: The error message uses "process" + ".env" split to avoid the replacement pattern
  // matching itself when Pattern 2 runs after Pattern 1
  const throwError =
    "(() => { throw new Error('Access to process' + '.env is not allowed in bubble flows for security reasons.'); })()";

  // Pattern 1: process.env.SOMETHING or process.env['SOMETHING'] or process.env["SOMETHING"]
  protectedCode = protectedCode.replace(
    /process\.env\s*(\[['"`]?[^'"`\]]+['"`]?\]|\.\w+)/g,
    throwError
  );

  // Pattern 2: Standalone process.env (without property access)
  protectedCode = protectedCode.replace(
    /\bprocess\.env\b(?![.["'`\w])/g,
    throwError
  );

  // Step 3: Restore the protected strings and comments
  let result = protectedCode;
  for (let i = 0; i < placeholders.length; i++) {
    result = result.replace(`${PLACEHOLDER_PREFIX}${i}__`, placeholders[i]);
  }

  return result;
}
