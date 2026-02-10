/**
 * Utility functions for formatting bubble parameters
 */

import {
  BubbleParameter,
  ParsedBubbleWithInfo,
  // Import shared formatting utilities
  containsFunctionLiteral,
  formatParameterValue,
  condenseToSingleLine,
  stripCommentsOutsideStrings,
} from '@bubblelab/shared-schemas';

// Re-export shared functions for backwards compatibility
export { containsFunctionLiteral, formatParameterValue, condenseToSingleLine };

const INVOCATION_KEY_EXPR =
  '__bubbleFlowSelf?.__getInvocationCallSiteKey?.() ?? ""';

function buildInvocationOverrideReference(
  variableId: number | undefined
): string | undefined {
  if (typeof variableId !== 'number') {
    return undefined;
  }
  return `globalThis["__bubbleInvocationDependencyGraphs"]?.[${INVOCATION_KEY_EXPR}]?.[${JSON.stringify(
    String(variableId)
  )}]`;
}

function buildDependencyGraphExpression(
  dependencyGraphLiteral: string,
  overrideRef?: string
): string {
  if (overrideRef) {
    return `${overrideRef} ?? ${dependencyGraphLiteral}`;
  }
  return dependencyGraphLiteral;
}

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

  const dependencyGraphLiteralSafe =
    dependencyGraphLiteral && dependencyGraphLiteral.length > 0
      ? dependencyGraphLiteral
      : undefined;
  const invocationOverrideRef = buildInvocationOverrideReference(variableId);
  const dependencyGraphExpr =
    dependencyGraphLiteralSafe !== undefined
      ? buildDependencyGraphExpression(
          dependencyGraphLiteralSafe,
          invocationOverrideRef
        )
      : (invocationOverrideRef ?? undefined);
  const currentUniqueIdLiteral = JSON.stringify(currentUniqueId);
  const currentUniqueIdExpr =
    invocationOverrideRef !== undefined
      ? `${invocationOverrideRef}?.uniqueId ?? ${currentUniqueIdLiteral}`
      : currentUniqueIdLiteral;

  // Handle single variable parameter case (e.g., new GoogleDriveBubble(params))
  if (parameters.length === 1 && parameters[0].type === 'variable') {
    const paramValue = formatParameterValue(
      parameters[0].value,
      parameters[0].type
    );

    if (includeLoggerConfig) {
      const variableIdExpr =
        typeof variableId === 'number'
          ? `(__bubbleFlowSelf?.__computeInvocationVariableId?.(${variableId}) ?? ${variableId})`
          : 'undefined';
      const depGraphPart =
        dependencyGraphExpr !== undefined
          ? `, dependencyGraph: ${dependencyGraphExpr}`
          : '';
      const currentIdPart = `, currentUniqueId: ${currentUniqueIdExpr}`;
      const invocationKeyPart =
        ', invocationCallSiteKey: __bubbleFlowSelf?.__getInvocationCallSiteKey?.()';
      return `${paramValue}, {logger: __bubbleFlowSelf.logger, variableId: ${variableIdExpr}${depGraphPart}${currentIdPart}${invocationKeyPart}, executionMeta: __bubbleFlowSelf?.__executionMeta__, triggerConversationHistory: __bubbleFlowSelf?.__triggerConversationHistory__}`;
    }

    return paramValue;
  }

  const nonCredentialParams = parameters.filter(
    (p) => p.name !== 'credentials'
  );
  const credentialsParam = parameters.find(
    (p) => p.name === 'credentials' && p.type === 'object'
  );

  // Separate spreads from regular properties
  const spreadParams = nonCredentialParams.filter((p) => p.source === 'spread');
  const regularParams = nonCredentialParams.filter(
    (p) => p.source !== 'spread'
  );

  // Handle single variable parameter + credentials case (existing logic)
  if (
    credentialsParam &&
    nonCredentialParams.length === 1 &&
    nonCredentialParams[0].type === 'variable'
  ) {
    const paramsParam = nonCredentialParams[0];

    // Only spread if the parameter source is 'first-arg' (represents entire first argument),
    // or if source is undefined (backward compatibility) and name is 'arg0' (parser's fallback).
    const shouldSpread =
      paramsParam.source === 'first-arg' ||
      (paramsParam.source === undefined && paramsParam.name === 'arg0');

    if (shouldSpread) {
      const paramsValue = formatParameterValue(
        paramsParam.value,
        paramsParam.type
      );
      const credentialsValue = formatParameterValue(
        credentialsParam.value,
        credentialsParam.type
      );

      if (includeLoggerConfig) {
        const variableIdExpr =
          typeof variableId === 'number'
            ? `(__bubbleFlowSelf?.__computeInvocationVariableId?.(${variableId}) ?? ${variableId})`
            : 'undefined';
        const depGraphPart =
          dependencyGraphExpr !== undefined
            ? `, dependencyGraph: ${dependencyGraphExpr}`
            : '';
        const currentIdPart = `, currentUniqueId: ${currentUniqueIdExpr}`;
        const invocationKeyPart =
          ', invocationCallSiteKey: __bubbleFlowSelf?.__getInvocationCallSiteKey?.()';
        return `{...${paramsValue}, credentials: ${credentialsValue}}, {logger: __bubbleFlowSelf.logger, variableId: ${variableIdExpr}${depGraphPart}${currentIdPart}${invocationKeyPart}, executionMeta: __bubbleFlowSelf?.__executionMeta__, triggerConversationHistory: __bubbleFlowSelf?.__triggerConversationHistory__}`;
      }

      return `{...${paramsValue}, credentials: ${credentialsValue}}`;
    }
  }

  // Build parameter entries: regular properties first, then spreads
  const regularEntries = regularParams.map((param) => {
    const value = formatParameterValue(param.value, param.type);
    return `${param.name}: ${value}`;
  });

  const spreadEntries = spreadParams.map((param) => {
    const value = formatParameterValue(param.value, param.type);
    return `...${value}`;
  });

  // Combine all entries: regular properties, spreads, then credentials
  const allEntries = [...regularEntries, ...spreadEntries];
  if (credentialsParam) {
    const credentialsValue = formatParameterValue(
      credentialsParam.value,
      credentialsParam.type
    );
    allEntries.push(`credentials: ${credentialsValue}`);
  }

  const paramsString = `{\n    ${allEntries.join(',\n    ')}\n  }`;

  // Only add the logger configuration if explicitly requested
  if (includeLoggerConfig) {
    const variableIdExpr =
      typeof variableId === 'number'
        ? `(__bubbleFlowSelf?.__computeInvocationVariableId?.(${variableId}) ?? ${variableId})`
        : 'undefined';
    const depGraphPart =
      dependencyGraphExpr !== undefined
        ? `, dependencyGraph: ${dependencyGraphExpr}`
        : '';
    const currentIdPart = `, currentUniqueId: ${currentUniqueIdExpr}`;
    const invocationKeyPart =
      ', invocationCallSiteKey: __bubbleFlowSelf?.__getInvocationCallSiteKey?.()';
    return `${paramsString}, {logger: __bubbleFlowSelf.logger, variableId: ${variableIdExpr}${depGraphPart}${currentIdPart}${invocationKeyPart}, executionMeta: __bubbleFlowSelf?.__executionMeta__, triggerConversationHistory: __bubbleFlowSelf?.__triggerConversationHistory__}`;
  }

  return paramsString;
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
 * Replace lines in an array, handling both single-line and multi-line replacements.
 * Returns the number of lines that were effectively added or removed.
 */
function replaceLines(
  lines: string[],
  startIndex: number,
  deleteCount: number,
  replacement: string
): number {
  const replacementLines = replacement.split('\n');
  const isMultiLine = replacementLines.length > 1;

  if (isMultiLine) {
    // Multi-line replacement: replace first line, delete old lines, insert remaining
    lines[startIndex] = replacementLines[0];
    if (deleteCount > 0) {
      lines.splice(startIndex + 1, deleteCount);
    }
    if (replacementLines.length > 1) {
      lines.splice(startIndex + 1, 0, ...replacementLines.slice(1));
    }
    return replacementLines.length - 1 - deleteCount;
  } else {
    // Single-line replacement
    lines[startIndex] = replacement;
    if (deleteCount > 0) {
      lines.splice(startIndex + 1, deleteCount);
    }
    return -deleteCount;
  }
}

/**
 * Replace a bubble instantiation with updated parameters
 *
 * This function:
 * 1. Replaces the bubble instantiation line with updated parameters
 * 2. Preserves multi-line structure when function literals are present
 * 3. Condenses to single-line otherwise
 * 4. Uses bubble.location.endLine to know exactly where to stop deleting
 */
export function replaceBubbleInstantiation(
  lines: string[],
  bubble: ParsedBubbleWithInfo
) {
  if (bubble.invocationCallSiteKey) {
    // Invocation-specific clones are logical constructs and shouldn't rewrite source
    return;
  }
  const { location, className, parameters } = bubble;

  // Build the parameters object string
  const dependencyGraphLiteral = JSON.stringify(
    bubble.dependencyGraph || { name: bubble.bubbleName, dependencies: [] }
  ).replace(/</g, '\u003c');
  const currentUniqueIdValue =
    bubble.dependencyGraph?.uniqueId ?? String(bubble.variableId);

  let parametersObject = buildParametersObject(
    parameters,
    bubble.variableId,
    true,
    dependencyGraphLiteral,
    currentUniqueIdValue
  );

  // Remove JS/TS comments that would otherwise break formatting
  parametersObject = stripCommentsOutsideStrings(parametersObject);

  // Check if parameters contain function literals before condensing
  // Function literals cannot be safely condensed to single-line
  const hasFunctions = containsFunctionLiteral(parametersObject);

  if (!hasFunctions) {
    parametersObject = condenseToSingleLine(parametersObject);
  }

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

        const linesToDelete = location.endLine - (i + 1);
        replaceLines(lines, i, linesToDelete, replacement);
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

        const linesToDelete = location.endLine - (i + 1);
        replaceLines(lines, i, linesToDelete, replacement);
      }
      break;
    }
  }
}
