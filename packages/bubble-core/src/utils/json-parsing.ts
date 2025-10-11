/**
 * JSON parsing utilities extracted from AI Agent for reusability and testing
 */

/**
 * Strip markdown code fences and return inner content.
 */
function stripCodeFences(input: string): string {
  let s = input.trim();
  // Remove fenced blocks entirely, keep inner JSON
  s = s.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, '$1');
  s = s.replace(/^```json\s*/, '').replace(/\s*```[^\n]*$/, '');
  return s.trim();
}

/**
 * Extract the first top-level JSON object/array from mixed text using a scanner
 * that respects quotes and escaping.
 */
function extractTopLevelJson(input: string): string | null {
  const s = input;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{' || ch === '[') {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const stack: Array<'object' | 'array'> = [];
  let insideString = false;
  let escapeNext = false;
  let end = -1;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (insideString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        insideString = false;
      }
    } else {
      if (ch === '"') {
        insideString = true;
      } else if (ch === '{') {
        stack.push('object');
      } else if (ch === '[') {
        stack.push('array');
      } else if (ch === '}') {
        if (stack[stack.length - 1] === 'object') stack.pop();
        if (stack.length === 0) {
          end = i;
          break;
        }
      } else if (ch === ']') {
        if (stack[stack.length - 1] === 'array') stack.pop();
        if (stack.length === 0) {
          end = i;
          break;
        }
      }
    }
  }

  if (end !== -1) {
    return s.slice(start, end + 1);
  }

  // If not properly closed, return from start to end and let post-processing fix it
  return s.slice(start);
}

/**
 * State-machine pass to escape problematic quotes and control chars inside strings.
 * Heuristic: inside a string, a quote is considered an end if the next non-WS
 * char is a valid JSON delimiter for the string type; otherwise, we escape it.
 */
function escapeProblematicQuotesAndControlChars(input: string): string {
  const out: string[] = [];
  const scope: Array<'object' | 'array'> = [];
  let insideString = false;
  let escapeNext = false;
  let isKeyString = false;
  let prevNonWS: string | null = null;

  const isWhitespace = (c: string) => /\s/.test(c);

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (!insideString) {
      if (ch === '{') {
        scope.push('object');
        out.push(ch);
        prevNonWS = ch;
        continue;
      }
      if (ch === '[') {
        scope.push('array');
        out.push(ch);
        prevNonWS = ch;
        continue;
      }
      if (ch === '}' || ch === ']') {
        scope.pop();
        out.push(ch);
        prevNonWS = ch;
        continue;
      }
      if (ch === '"') {
        // Determine key vs value string
        if (prevNonWS === ':') {
          isKeyString = false;
        } else if (
          scope[scope.length - 1] === 'object' &&
          (prevNonWS === '{' || prevNonWS === ',' || prevNonWS === null)
        ) {
          isKeyString = true;
        } else {
          // In arrays or after colon, consider as value string
          isKeyString = false;
        }
        insideString = true;
        out.push('"');
        continue;
      }
      if (!isWhitespace(ch)) {
        prevNonWS = ch;
      }
      out.push(ch);
      continue;
    }

    // inside string
    if (escapeNext) {
      out.push(ch);
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      out.push('\\');
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      // Peek next non-whitespace char
      let j = i + 1;
      let nextNonWS: string | undefined;
      while (j < input.length) {
        const c = input[j];
        if (!isWhitespace(c)) {
          nextNonWS = c;
          break;
        }
        j++;
      }
      const validTerminator = isKeyString
        ? nextNonWS === ':'
        : nextNonWS === ',' ||
          nextNonWS === ']' ||
          nextNonWS === '}' ||
          nextNonWS === undefined;
      if (validTerminator) {
        insideString = false;
        out.push('"');
        continue;
      }
      // Treat as literal quote inside value string
      out.push('\\"');
      continue;
    }
    if (ch === '\n') {
      out.push('\\n');
      continue;
    }
    if (ch === '\r') {
      out.push('\\r');
      continue;
    }
    if (ch === '\t') {
      out.push('\\t');
      continue;
    }
    out.push(ch);
  }

  if (insideString) {
    // Close any unterminated string
    out.push('"');
  }
  return out.join('');
}

/**
 * Extract JSON from mixed text/JSON responses with robust cleanup
 */
export function extractAndCleanJSON(input: string): string | null {
  const stripped = stripCodeFences(input);

  // Preferred: scan/extract top-level JSON
  const scanned = extractTopLevelJson(stripped);
  if (scanned) {
    const cleaned = postProcessJSON(scanned);
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // continue
    }
  }

  const trimmed = stripped.trim();

  // Fallback: regex match for object/array
  const jsonMatch = trimmed.match(
    /({[^{}]*(?:{[^{}]*}[^{}]*)*}|\[[^[\]]*(?:\[[^[\]]*\][^[\]]*)*\])/
  );
  if (jsonMatch) {
    const candidate = jsonMatch[1];
    const cleaned = postProcessJSON(candidate);
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Continue to other strategies
    }
  }

  // Last fallback: slice from first brace/bracket and try to fix
  const firstBracketIdx = trimmed.search(/[[{]/);
  if (firstBracketIdx !== -1) {
    const candidate = trimmed.slice(firstBracketIdx);
    const cleaned = postProcessJSON(candidate);
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Continue to other strategies
    }
  }

  return null;
}

/**
 * Post-process potentially malformed JSON string to fix common issues
 */
export function postProcessJSON(jsonString: string): string {
  let processed = jsonString.trim();

  // Remove markdown code blocks if present
  processed = stripCodeFences(processed);

  // Remove trailing backslashes and other non-JSON characters after closing braces/brackets
  processed = processed.replace(/([}\]])\s*\\+[^\n]*$/g, '$1');

  // Remove common prefixes that AI might add
  processed = processed
    .replace(/^(?:Here's|Here is|The JSON is|Result:|Answer:)\s*:?\s*/i, '')
    .replace(/^(?:the result|the response|response|result)\s*:?\s*/i, '')
    .replace(/^["']?\s*/, '') // Remove leading quotes/spaces
    .replace(/\s*["']?$/, ''); // Remove trailing quotes/spaces

  // Fix unquoted keys first (before dealing with quotes)
  processed = processed.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*):/g,
    '$1"$2"$3:'
  );

  // Remove trailing commas before closing brackets/braces
  processed = processed.replace(/,\s*(?=[}\]])/g, '');

  // Only convert single-quoted strings to double-quoted strings if the ENTIRE JSON uses single quotes
  // We detect this by checking if there are more single-quoted keys/values than double-quoted ones
  const singleQuotedPattern = /:\s*'[^']*'/g;
  const doubleQuotedPattern = /:\s*"[^"]*"/g;
  const singleQuoteCount = (processed.match(singleQuotedPattern) || []).length;
  const doubleQuoteCount = (processed.match(doubleQuotedPattern) || []).length;

  // Only do global single-quote replacement if it looks like the JSON is using single quotes throughout
  if (singleQuoteCount > doubleQuoteCount && singleQuoteCount > 2) {
    processed = processed.replace(
      /(^|:|\[|,|\{)\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      '$1"$2"'
    );
  }

  // Escape problematic quotes and control chars in strings via state machine
  processed = escapeProblematicQuotesAndControlChars(processed);

  // Remove trailing commas before closing brackets/braces again after quote fixes
  processed = processed.replace(/,\s*(?=[}\]])/g, '');

  // Remove control characters that can break JSON
  // eslint-disable-next-line no-control-regex
  processed = processed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Remove any trailing non-JSON content (like explanatory text after JSON)
  const lastObj = processed.lastIndexOf('}');
  const lastArr = processed.lastIndexOf(']');
  const lastClose = Math.max(lastObj, lastArr);
  if (lastClose !== -1) {
    processed = processed.slice(0, lastClose + 1);
  }

  // Attempt to balance brackets and braces more intelligently
  const openBraces = (processed.match(/{/g) || []).length;
  const closeBraces = (processed.match(/}/g) || []).length;
  const openBrackets = (processed.match(/\[/g) || []).length;
  const closeBrackets = (processed.match(/]/g) || []).length;

  // Add missing closing braces/brackets, but only if the string looks like it should have them
  if (openBraces > closeBraces && processed.includes('{')) {
    // Only add closing braces if the string starts with { or contains proper object structure
    if (processed.trim().startsWith('{') || processed.includes('":')) {
      // For nested structures, we need to be more careful about the order
      // First close inner structures, then outer ones
      const missingBraces = openBraces - closeBraces;
      const missingBrackets = openBrackets - closeBrackets;

      // If we have both missing braces and brackets, close brackets first (inner structures)
      if (missingBrackets > 0 && processed.includes('[')) {
        processed += ']'.repeat(missingBrackets);
      }

      // Then close braces
      processed += '}'.repeat(missingBraces);
    }
  } else if (openBrackets > closeBrackets && processed.includes('[')) {
    // Only add closing brackets if the string starts with [ or contains array structure
    if (processed.trim().startsWith('[') || processed.includes('[')) {
      processed += ']'.repeat(openBrackets - closeBrackets);
    }
  }

  // Remove excess closing braces/brackets
  if (closeBraces > openBraces) {
    const excess = closeBraces - openBraces;
    for (let i = 0; i < excess; i++) {
      processed = processed.replace(/}\s*$/, '');
    }
  }
  if (closeBrackets > openBrackets) {
    const excess = closeBrackets - openBrackets;
    for (let i = 0; i < excess; i++) {
      processed = processed.replace(/]\s*$/, '');
    }
  }

  return processed;
}

/**
 * Multi-stage JSON parsing approach with various fallback strategies
 */
export function parseJsonWithFallbacks(finalResponse: string): {
  response: string;
  success: boolean;
  error?: string;
} {
  const attempts = [
    // Attempt 1: Try parsing the original response as-is
    () => {
      JSON.parse(finalResponse);
      return finalResponse;
    },
    // Attempt 2: Strip code fences, scan-extract, then post-process
    () => {
      const stripped = stripCodeFences(finalResponse);
      const scanned = extractTopLevelJson(stripped);
      if (!scanned) throw new Error('No valid JSON found');
      const cleaned = postProcessJSON(scanned);
      JSON.parse(cleaned);
      return cleaned;
    },
    // Attempt 3: Try basic post-processing on original
    () => {
      const processed = postProcessJSON(finalResponse);
      JSON.parse(processed);
      return processed;
    },
    // Attempt 4: Last resort - try to wrap in object if it looks like key-value content
    () => {
      const trimmed = finalResponse.trim();
      if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        // If it contains key-like patterns, try wrapping in object
        if (trimmed.includes(':') && !trimmed.includes('\n\n')) {
          const wrapped = `{${trimmed}}`;
          const processed = postProcessJSON(wrapped);
          JSON.parse(processed);
          return processed;
        }
      }
      throw new Error('Cannot convert to valid JSON');
    },
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = attempts[i]();
      if (i > 0) {
        console.log(`[JSON Parser] Parsing successful on attempt ${i + 1}`);
      }
      return { response: result, error: undefined, success: true };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unknown parsing error');
      console.warn(
        `[JSON Parser] Parsing attempt ${i + 1} failed:`,
        lastError.message
      );
    }
  }

  // All attempts failed
  console.warn('[JSON Parser] All JSON parsing attempts failed');
  console.warn('[JSON Parser] Original response:', finalResponse);

  // Try to provide the best available response even if not valid JSON
  const lastAttempt =
    extractAndCleanJSON(finalResponse) || postProcessJSON(finalResponse);

  return {
    response: lastAttempt,
    error: `AI Agent failed to generate valid JSON. Post-processing attempted but JSON is still malformed: ${lastError?.message || 'Unknown error'}`,
    success: false,
  };
}
