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
  // Note: The error message uses "process" + ".env" split to avoid the replacement pattern
  // matching itself when subsequent patterns run
  const throwError =
    "(() => { throw new Error('Access to process' + '.env is not allowed in bubble flows for security reasons.'); })()";

  // Step 1: First replace process['env'] and process["env"] patterns BEFORE protecting strings
  // This is necessary because the string protection would match "env" as a string literal
  // e.g., process['env'].FOO, process['env']['FOO'], process["env"].BAR
  let transformedCode = code.replace(
    /process\s*\[\s*['"]env['"]\s*\](\s*(\[['"`]?[^'"`\]]+['"`]?\]|\.\w+))*/g,
    throwError
  );

  // Step 2: Use a marker-based approach to avoid replacing process.env in strings and comments
  const PLACEHOLDER_PREFIX = '__SANITIZE_PLACEHOLDER_';
  const placeholders: string[] = [];

  // Temporarily replace string literals and comments with placeholders
  // This prevents matching process.env inside strings or comments
  const stringAndCommentPattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

  let protectedCode = transformedCode.replace(
    stringAndCommentPattern,
    (match) => {
      const index = placeholders.length;
      placeholders.push(match);
      return `${PLACEHOLDER_PREFIX}${index}__`;
    }
  );

  // Step 3: Now safely replace remaining process.env patterns (strings/comments are protected)

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
