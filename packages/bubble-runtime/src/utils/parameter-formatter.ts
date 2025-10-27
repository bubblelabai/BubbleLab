/**
 * Utility functions for formatting bubble parameters
 */

/**
 * Build parameters object string from bubble parameters
 */
import {
  BubbleParameter,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';

export function buildParametersObject(
  parameters: BubbleParameter[],
  variableId?: number,
  includeLoggerConfig: boolean = true,
  dependencyGraphLiteral?: string,
  currentUniqueId: string = ''
): string {
  if (!parameters || parameters.length === 0) {
    return '{}';
  }

  // Handle single variable parameter case (e.g., new GoogleDriveBubble(params))
  if (parameters.length === 1 && parameters[0].type === 'variable') {
    const paramValue = formatParameterValue(
      parameters[0].value,
      parameters[0].type
    );

    if (includeLoggerConfig) {
      const depGraphPart =
        dependencyGraphLiteral && dependencyGraphLiteral.length > 0
          ? `, dependencyGraph: ${dependencyGraphLiteral}`
          : '';
      const currentIdPart = `, currentUniqueId: ${JSON.stringify(currentUniqueId)}`;
      return `${paramValue}, {logger: this.logger, variableId: ${variableId}${depGraphPart}${currentIdPart}}`;
    }

    return paramValue;
  }

  // Handle single variable parameter + credentials case (e.g., new GoogleDriveBubble(params) with injected credentials)
  if (
    parameters.length === 2 &&
    parameters.some((p) => p.type === 'variable') &&
    parameters.some((p) => p.name === 'credentials' && p.type === 'object')
  ) {
    const paramsParam = parameters.find((p) => p.type === 'variable');
    const credentialsParam = parameters.find(
      (p) => p.name === 'credentials' && p.type === 'object'
    );
    if (paramsParam && credentialsParam) {
      const paramsValue = formatParameterValue(
        paramsParam.value,
        paramsParam.type
      );
      const credentialsValue = formatParameterValue(
        credentialsParam.value,
        credentialsParam.type
      );

      if (includeLoggerConfig) {
        const depGraphPart =
          dependencyGraphLiteral && dependencyGraphLiteral.length > 0
            ? `, dependencyGraph: ${dependencyGraphLiteral}`
            : '';
        const currentIdPart = `, currentUniqueId: ${JSON.stringify(currentUniqueId)}`;
        return `{...${paramsValue}, credentials: ${credentialsValue}}, {logger: this.logger, variableId: ${variableId}${depGraphPart}${currentIdPart}}`;
      }

      return `{...${paramsValue}, credentials: ${credentialsValue}}`;
    }
  }

  const paramEntries = parameters.map((param) => {
    const value = formatParameterValue(param.value, param.type);
    return `${param.name}: ${value}`;
  });

  const paramsString = `{\n    ${paramEntries.join(',\n    ')}\n  }`;

  // Only add the logger configuration if explicitly requested
  if (includeLoggerConfig) {
    const depGraphPart =
      dependencyGraphLiteral && dependencyGraphLiteral.length > 0
        ? `, dependencyGraph: ${dependencyGraphLiteral}`
        : '';
    const currentIdPart = `, currentUniqueId: ${JSON.stringify(currentUniqueId)}`;
    return `${paramsString}, {logger: this.logger, variableId: ${variableId}${depGraphPart}${currentIdPart}}`;
  }

  return paramsString;
}

/**
 * Format a parameter value based on its type
 */
export function formatParameterValue(value: unknown, type: string): string {
  switch (type) {
    case 'string': {
      const stringValue = String(value);
      // If it's a template literal, pass through unchanged
      if (stringValue.startsWith('`') && stringValue.endsWith('`')) {
        return stringValue;
      }
      // Always properly quote strings, regardless of input format
      // This ensures consistent quoting that survives condensation
      const escapedValue = stringValue.replace(/'/g, "\\'");
      return `'${escapedValue}'`;
    }
    case 'number':
      return String(value);
    case 'boolean':
      return String(value);
    case 'object':
      // If caller provided a source literal string, keep it as code
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          trimmed.startsWith('new ')
        ) {
          return value as string;
        }
      }
      return JSON.stringify(value, null, 2);
    case 'array':
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          return value as string;
        }
      }
      return JSON.stringify(value);
    case 'env':
      return `process.env.${String(value)}`;
    case 'variable':
      return String(value); // Reference to another variable
    case 'expression':
      return String(value); // Return expressions unquoted so they can be evaluated
    default:
      return JSON.stringify(value);
  }
}

/**
 * Try to parse a tools parameter that may be provided as JSON or a JS-like array literal.
 * Returns an array of objects with at least a name field, or null if parsing fails.
 */
export function parseToolsParamValue(
  raw: unknown
): Array<Record<string, unknown>> | null {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw !== 'string') return null;

  // 1) Try strict JSON first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  } catch {
    // Handle JSON parse error gracefully
  }

  // 2) Coerce common JS-like literal into valid JSON and parse
  const coerced = coerceJsArrayLiteralToJson(raw);
  if (coerced) {
    try {
      const parsed = JSON.parse(coerced);
      if (Array.isArray(parsed))
        return parsed as Array<Record<string, unknown>>;
    } catch {
      // Handle JSON parse error gracefully
    }
  }

  return null;
}

function coerceJsArrayLiteralToJson(input: string): string | null {
  let s = input.trim();
  if (!s.startsWith('[')) return null;

  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // Quote unquoted object keys: { name: 'x' } -> { "name": 'x' }
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');

  // Replace single-quoted strings with double-quoted strings
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  return s;
}

/**
 * Strip // line comments and /* block comments *\/ that are outside of string and template literals.
 * This is used before we condense parameters into a single line so inline comments don't swallow code.
 */
function stripCommentsOutsideStrings(input: string): string {
  let result = '';
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = i + 1 < input.length ? input[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++; // skip '/'
      }
      continue;
    }

    if (inSingle) {
      if (escapeNext) {
        result += ch;
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escapeNext = true;
        continue;
      }
      result += ch;
      if (ch === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      if (escapeNext) {
        result += ch;
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escapeNext = true;
        continue;
      }
      result += ch;
      if (ch === '"') inDouble = false;
      continue;
    }

    if (inTemplate) {
      if (escapeNext) {
        result += ch;
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escapeNext = true;
        continue;
      }
      result += ch;
      if (ch === '`') inTemplate = false;
      continue;
    }

    // Not in any string/comment
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++; // skip next '/'
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++; // skip next '*'
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      result += ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      result += ch;
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Replace a bubble instantiation with updated parameters
 *
 * This function:
 * 1. Replaces the bubble instantiation line with a single-line version
 * 2. Deletes all lines that were part of the original multi-line parameters
 * 3. Uses bubble.location.endLine to know exactly where to stop deleting
 */
export function replaceBubbleInstantiation(
  lines: string[],
  bubble: ParsedBubbleWithInfo
) {
  const { location, className, parameters } = bubble;

  // Build the new single-line instantiation
  const dependencyGraphLiteral = JSON.stringify(
    bubble.dependencyGraph || { name: bubble.bubbleName, dependencies: [] }
  ).replace(/</g, '\u003c');

  let parametersObject = buildParametersObject(
    parameters,
    bubble.variableId,
    true,
    dependencyGraphLiteral,
    String(bubble.variableId)
  );

  // Remove JS/TS comments that would otherwise break single-line formatting
  parametersObject = stripCommentsOutsideStrings(parametersObject);

  // Condense to single line
  parametersObject = parametersObject
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .replace(/\s*,\s*/g, ', ')
    .trim();

  const newInstantiationBase = `new ${className}(${parametersObject})`;

  // Find the line with the bubble instantiation
  for (let i = location.startLine - 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(`new ${className}`)) {
      // Pattern 1: Variable assignment (const foo = new Bubble(...))
      const variableMatch = line.match(
        /^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*/
      );

      if (variableMatch) {
        const [, indentation, declaration, variableName] = variableMatch;
        const hadAwait = /\bawait\b/.test(line);
        const actionCall = bubble.hasActionCall ? '.action()' : '';
        const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;
        const replacement = `${indentation}${declaration} ${variableName} = ${newExpression}`;

        lines[i] = replacement;

        // Delete all lines that were part of the old multi-line parameters
        const linesToDelete = location.endLine - (i + 1);
        if (linesToDelete > 0) {
          lines.splice(i + 1, linesToDelete);
        }
      }
      // Pattern 2: Anonymous bubble (await new Bubble(...).action())
      else if (bubble.variableName.startsWith('_anonymous_')) {
        const beforePattern = line.substring(
          0,
          line.indexOf(`new ${className}`)
        );
        const hadAwait = /\bawait\b/.test(beforePattern);
        const actionCall = bubble.hasActionCall ? '.action()' : '';
        const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;
        const beforeClean = beforePattern.replace(/\bawait\s*$/, '');
        const replacement = `${beforeClean}${newExpression}`;

        lines[i] = replacement;

        // Delete all lines that were part of the old multi-line parameters
        const linesToDelete = location.endLine - (i + 1);
        if (linesToDelete > 0) {
          lines.splice(i + 1, linesToDelete);
        }
      }
      break;
    }
  }
}
