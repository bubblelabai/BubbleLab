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
      // If already quoted, return as-is
      if (
        (stringValue.startsWith("'") && stringValue.endsWith("'")) ||
        (stringValue.startsWith('"') && stringValue.endsWith('"'))
      ) {
        return stringValue;
      }
      // Escape single quotes and return single-quoted string
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
 * Replace a bubble instantiation with updated parameters
 */
export function replaceBubbleInstantiation(
  lines: string[],
  bubble: ParsedBubbleWithInfo
) {
  const { location, className, parameters } = bubble;

  // Build the new instantiation code
  // Only include logger config for bubbles that need it (typically those with logging capabilities)
  const dependencyGraphLiteral = JSON.stringify(
    bubble.dependencyGraph || { name: bubble.bubbleName, dependencies: [] }
  ).replace(/</g, '\u003c');
  const parametersObject = buildParametersObject(
    parameters,
    bubble.variableId,
    true,
    dependencyGraphLiteral,
    String(bubble.variableId)
  );
  const newInstantiationBase = `new ${className}(${parametersObject})`;

  // Find the bubble instantiation lines and replace them
  for (let i = location.startLine - 1; i <= location.endLine - 1; i++) {
    if (i < lines.length) {
      const line = lines[i];

      // Replace the bubble instantiation
      if (line.includes(`new ${className}`)) {
        // Pattern 1: variableName = new BubbleClass(...)
        const variableMatch = line.match(
          /^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*/
        );
        if (variableMatch) {
          const [, indentation, declaration, variableName] = variableMatch;
          const hadAwait = /\bawait\b/.test(line);
          const actionCall = bubble.hasActionCall ? '.action()' : '';
          const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;
          const replacement = `${indentation}${declaration} ${variableName} = ${newExpression};`;
          lines[i] = replacement;

          // Delete only the parameter lines, not the entire block
          // Find the actual end of the bubble parameters by looking for the closing paren
          // Look for patterns: });  or })  or }).action();
          let actualEndLine = i;
          const startIndentation = lines[i].match(/^(\s*)/)?.[1] || '';

          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            const trimmedLine = line.trim();
            
            // Look for various closing patterns:
            // 1. '});' - object parameter closing with semicolon
            // 2. '})' - object parameter closing without semicolon
            // 3. '}).action();' - with action call
            const endsWithClosing = 
              trimmedLine === '});' || 
              trimmedLine === '})' ||
              trimmedLine.includes('}).action();');

            if (endsWithClosing) {
              const lineIndentation = line.match(/^(\s*)/)?.[1] || '';
              // If this line has the same or less indentation than the start line, it's likely the end
              if (lineIndentation.length <= startIndentation.length) {
                actualEndLine = j;
                break;
              }
            }
          }

          const deleteCount = Math.max(0, actualEndLine - i);

          if (deleteCount > 0) {
            lines.splice(i + 1, deleteCount);
          }
        } else {
          // Pattern 2: Anonymous bubbles like "await new BubbleClass(...).action()"
          // Check if this is an anonymous bubble (synthetic variable name)
          if (bubble.variableName.startsWith('_anonymous_')) {
            // For anonymous bubbles, we need to replace the new expression part only
            // while preserving the await and adding .action() if needed
            const beforePattern = line.substring(
              0,
              line.indexOf(`new ${className}`)
            );

            const hadAwait = /\bawait\b/.test(beforePattern);
            const actionCall = bubble.hasActionCall ? '.action()' : '';
            const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;

            // Construct the new single-line expression; ensure it ends with semicolon
            const beforeClean = beforePattern.replace(/\bawait\s*$/, '');
            const replacement = `${beforeClean}${newExpression};`;
            console.debug(
              `Anonymous replacement: "${lines[i]}" -> "${replacement}"`
            );
            lines[i] = replacement;

            // Delete only the parameter lines, not the entire block
            // Find the actual end of the bubble parameters by looking for the closing paren
            // Look for patterns: });  or })  or }).action();
            let actualEndLine = i;
            const startIndentation = lines[i].match(/^(\s*)/)?.[1] || '';

            for (let j = i + 1; j < lines.length; j++) {
              const line = lines[j];
              const trimmedLine = line.trim();
              
              // Look for various closing patterns:
              // 1. '});' - object parameter closing with semicolon
              // 2. '})' - object parameter closing without semicolon
              // 3. '}).action();' - with action call
              const endsWithClosing = 
                trimmedLine === '});' || 
                trimmedLine === '})' ||
                trimmedLine.includes('}).action();');

              if (endsWithClosing) {
                const lineIndentation = line.match(/^(\s*)/)?.[1] || '';
                // If this line has the same or less indentation than the start line, it's likely the end
                if (lineIndentation.length <= startIndentation.length) {
                  actualEndLine = j;
                  break;
                }
              }
            }

            const deleteCount = Math.max(0, actualEndLine - i);
            console.debug(
              `Anonymous: Deleting ${deleteCount} lines starting from line ${i + 1} (actualEndLine: ${actualEndLine}, original endLine: ${location.endLine})`
            );
            if (deleteCount > 0) {
              const deletedLines = lines.slice(i + 1, i + 1 + deleteCount);
              console.debug(`Anonymous deleted lines:`, deletedLines);
              lines.splice(i + 1, deleteCount);
            }
          }
        }
        break;
      }
    }
  }
}
