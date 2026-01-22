/**
 * Frontend utilities for rebuilding bubble parameters in code.
 * Uses shared parameter formatting logic from @bubblelab/shared-schemas.
 */

import {
  buildParameterObjectLiteral,
  containsFunctionLiteral,
  condenseToSingleLine,
  stripCommentsOutsideStrings,
  BubbleParameter,
  BubbleParameterType,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { serializeValue } from './bubbleParamEditor';

/**
 * Result type for replaceBubbleInCode
 */
export type ReplaceBubbleResult =
  | { success: true; code: string; lineDiff: number }
  | { success: false; error: string };

/**
 * Replace entire bubble instantiation in code with new parameters.
 * This function:
 * 1. Finds the bubble instantiation in the code
 * 2. Rebuilds the parameters object using the shared formatter
 * 3. Replaces the entire instantiation line(s)
 *
 * @param code - The full source code
 * @param bubble - The bubble to replace
 * @param newParameters - The new parameters array
 * @returns Result with updated code and line diff, or error
 */
export function replaceBubbleInCode(
  code: string,
  bubble: ParsedBubbleWithInfo,
  newParameters: BubbleParameter[]
): ReplaceBubbleResult {
  // Don't modify invocation-specific clones
  if (bubble.invocationCallSiteKey) {
    return {
      success: false,
      error: 'Cannot modify invocation-specific bubble clones',
    };
  }

  const { location, className } = bubble;
  const lines = code.split('\n');

  // Validate location
  const startLineIndex = location.startLine - 1;
  const endLineIndex = location.endLine - 1;

  if (startLineIndex < 0 || endLineIndex >= lines.length) {
    return {
      success: false,
      error: `Invalid location: lines ${location.startLine}-${location.endLine} in code with ${lines.length} lines`,
    };
  }

  // Find the line with the bubble instantiation
  let foundLineIndex = -1;
  for (let i = startLineIndex; i < lines.length; i++) {
    if (lines[i].includes(`new ${className}`)) {
      foundLineIndex = i;
      break;
    }
  }

  if (foundLineIndex === -1) {
    return {
      success: false,
      error: `Could not find "new ${className}" in code`,
    };
  }

  // Build the parameters object string using shared formatter
  let parametersObject = buildParameterObjectLiteral(newParameters);

  // Strip comments and condense if no function literals
  parametersObject = stripCommentsOutsideStrings(parametersObject);
  if (!containsFunctionLiteral(parametersObject)) {
    parametersObject = condenseToSingleLine(parametersObject);
  }

  const newInstantiationBase = `new ${className}(${parametersObject})`;
  const line = lines[foundLineIndex];

  // Pattern 1: Variable assignment (const foo = new Bubble(...))
  const variableMatch = line.match(
    /^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*/
  );

  let replacement: string;

  if (variableMatch) {
    const [, indentation, declaration, variableName] = variableMatch;
    const hadAwait = /\bawait\b/.test(line);
    const actionCall = bubble.hasActionCall ? '.action()' : '';
    const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;
    replacement = `${indentation}${declaration} ${variableName} = ${newExpression}`;
  }
  // Pattern 2: Anonymous bubble (await new Bubble(...).action())
  else if (bubble.variableName.startsWith('_anonymous_')) {
    const beforePattern = line.substring(0, line.indexOf(`new ${className}`));
    const hadAwait = /\bawait\b/.test(beforePattern);
    const actionCall = bubble.hasActionCall ? '.action()' : '';
    const newExpression = `${hadAwait ? 'await ' : ''}${newInstantiationBase}${actionCall}`;
    const beforeClean = beforePattern.replace(/\bawait\s*$/, '');
    replacement = `${beforeClean}${newExpression}`;
  } else {
    // Fallback: just replace with new instantiation
    const indentation = line.match(/^(\s*)/)?.[1] || '';
    replacement = `${indentation}${newInstantiationBase}`;
  }

  // Calculate line diff
  const linesToDelete = location.endLine - (foundLineIndex + 1);
  const replacementLines = replacement.split('\n');
  const lineDiff = replacementLines.length - 1 - linesToDelete;

  // Apply replacement
  const updatedLines = [
    ...lines.slice(0, foundLineIndex),
    ...replacementLines,
    ...lines.slice(endLineIndex + 1),
  ];

  return {
    success: true,
    code: updatedLines.join('\n'),
    lineDiff,
  };
}

/**
 * Update or add a parameter to the parameters array.
 * If the parameter exists, updates its value. If not, adds it.
 *
 * @param parameters - The current parameters array
 * @param paramName - The parameter name to update or add
 * @param newValue - The new value for the parameter
 * @param paramType - The parameter type (defaults to STRING, required for new params)
 * @returns Updated parameters array
 */
export function updateOrAddParameter(
  parameters: BubbleParameter[],
  paramName: string,
  newValue: unknown,
  paramType?: BubbleParameterType
): BubbleParameter[] {
  // Find existing parameter
  const existingIndex = parameters.findIndex((p) => p.name === paramName);

  if (existingIndex !== -1) {
    // Update existing parameter
    const existingParam = parameters[existingIndex];
    const updatedParam: BubbleParameter = {
      ...existingParam,
      value: formatValueForStorage(newValue, existingParam.type),
    };
    return [
      ...parameters.slice(0, existingIndex),
      updatedParam,
      ...parameters.slice(existingIndex + 1),
    ];
  }

  // Add new parameter
  const type = paramType ?? BubbleParameterType.STRING;
  const newParam: BubbleParameter = {
    name: paramName,
    value: formatValueForStorage(newValue, type),
    type,
    source: 'object-property',
  };

  // Insert before credentials if present, otherwise append
  const credentialsIndex = parameters.findIndex(
    (p) => p.name === 'credentials'
  );
  if (credentialsIndex !== -1) {
    return [
      ...parameters.slice(0, credentialsIndex),
      newParam,
      ...parameters.slice(credentialsIndex),
    ];
  }

  return [...parameters, newParam];
}

/**
 * Format a value for storage in BubbleParameter based on its type.
 * This converts runtime values to the format expected by the parser/serializer.
 */
function formatValueForStorage(
  value: unknown,
  type: BubbleParameterType
): string | number | boolean | Record<string, unknown> | unknown[] {
  switch (type) {
    case BubbleParameterType.STRING:
      // For strings, store the raw value (serialization adds quotes later)
      return String(value);
    case BubbleParameterType.NUMBER:
      return typeof value === 'number' ? value : Number(value);
    case BubbleParameterType.BOOLEAN:
      return typeof value === 'boolean' ? value : value === 'true';
    case BubbleParameterType.OBJECT:
      // For objects, if value is a string that looks like code, preserve it
      if (typeof value === 'string') {
        return value;
      }
      // Otherwise serialize to code representation
      return serializeValue(value);
    case BubbleParameterType.ARRAY:
      if (typeof value === 'string') {
        return value;
      }
      return serializeValue(value);
    default:
      return String(value);
  }
}

/**
 * Delete a parameter from the parameters array.
 *
 * @param parameters - The current parameters array
 * @param paramName - The parameter name to delete
 * @returns Updated parameters array with the parameter removed
 */
export function deleteParameter(
  parameters: BubbleParameter[],
  paramName: string
): BubbleParameter[] {
  return parameters.filter((p) => p.name !== paramName);
}
