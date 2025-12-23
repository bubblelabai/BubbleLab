import { AvailableModels } from '@bubblelab/shared-schemas';
import type {
  BubbleParameter,
  ParsedBubbleWithInfo,
  AvailableModel,
} from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';
import { isModelParam } from '@/config/bubbleInlineParams';

/**
 * Find all related bubble variable IDs (original and all clones).
 * When a bubble is edited, all related bubbles share the same code location,
 * so their cached parameters should be updated together.
 *
 * @param bubble - The bubble being edited
 * @param bubbleParameters - All bubble parameters keyed by some identifier
 * @returns Array of variableIds for all related bubbles (includes the input bubble)
 */
export function getRelatedBubbleVariableIds(
  bubble: ParsedBubbleWithInfo,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>
): number[] {
  const relatedIds: number[] = [bubble.variableId];
  const allBubbles = Object.values(bubbleParameters);

  // Case 1: This is a clone - find the original and all sibling clones
  if (bubble.clonedFromVariableId !== undefined) {
    const originalVariableId = bubble.clonedFromVariableId;

    for (const otherBubble of allBubbles) {
      if (otherBubble.variableId === bubble.variableId) continue;

      // Add the original
      if (otherBubble.variableId === originalVariableId) {
        relatedIds.push(otherBubble.variableId);
      }
      // Add sibling clones (other clones from the same original)
      else if (otherBubble.clonedFromVariableId === originalVariableId) {
        relatedIds.push(otherBubble.variableId);
      }
    }
  }
  // Case 2: This is an original - find all clones
  else {
    for (const otherBubble of allBubbles) {
      if (otherBubble.variableId === bubble.variableId) continue;

      // Add all clones of this original
      if (otherBubble.clonedFromVariableId === bubble.variableId) {
        relatedIds.push(otherBubble.variableId);
      }
    }
  }

  return relatedIds;
}
interface NestedParamResult {
  value: string | number | boolean;
  isTemplateLiteral: boolean;
}

/**
 * Get a nested value from a param using dot notation (e.g., "model.model")
 * Returns the string value at that path along with whether it was a template literal
 */
function getNestedParamValue(
  param: BubbleParameter | undefined,
  path: string
): NestedParamResult | undefined {
  if (param?.value === undefined || param?.value === null) return undefined;

  const parts = path.split('.');

  // If path is just the param name (e.g., "systemPrompt" or "limit"), return value directly
  if (parts.length === 1) {
    // Handle number/boolean values (return as-is, serializeValue will handle them)
    if (typeof param.value === 'number' || typeof param.value === 'boolean') {
      return { value: param.value, isTemplateLiteral: false };
    }
    // Handle string values
    if (typeof param.value === 'string') {
      // If the param.type is NUMBER or BOOLEAN, parse the string to native type
      // This handles cases where parser stores "15" but we need 15 for serialization
      if (param.type === BubbleParameterType.NUMBER) {
        const numValue = Number(param.value);
        if (!isNaN(numValue)) {
          return { value: numValue, isTemplateLiteral: false };
        }
      }
      if (param.type === BubbleParameterType.BOOLEAN) {
        if (param.value === 'true') {
          return { value: true, isTemplateLiteral: false };
        }
        if (param.value === 'false') {
          return { value: false, isTemplateLiteral: false };
        }
      }
      // Regular string handling
      let value: string = param.value;
      let isTemplateLiteral = false;
      // Strip template literal backticks if present (e.g., `Hello ${name}` -> Hello ${name})
      if (value.startsWith('`') && value.endsWith('`')) {
        value = value.slice(1, -1);
        isTemplateLiteral = true;
      }
      return { value, isTemplateLiteral };
    }
    return undefined;
  }

  // For nested paths like "model.model", we need to parse the string representation
  // The param.value is a string like "{ model: 'google/gemini-2.5-pro' }"
  if (typeof param.value === 'string') {
    const attrName = parts[1]; // e.g., "model" from "model.model"
    // Escape regex special characters in attrName to avoid malformed patterns
    const escapedAttrName = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = param.value.match(
      new RegExp(`${escapedAttrName}:\\s*['"]([^'"]+)['"]`)
    );
    if (match) {
      return { value: match[1], isTemplateLiteral: false };
    }
  }

  // If value is an actual object
  if (typeof param.value === 'object') {
    const attrName = parts[1];
    const obj = param.value as Record<string, unknown>;
    if (typeof obj[attrName] === 'string') {
      return { value: obj[attrName] as string, isTemplateLiteral: false };
    }
  }

  return undefined;
}

/**
 * Extract a parameter value and determine if it should be editable.
 *
 * @param param - The bubble parameter
 * @param path - The path to extract (e.g., "systemPrompt" or "model.model")
 * @param bubbleName - Optional bubble name to enable config-based model detection
 */
export function extractParamValue(
  param: BubbleParameter | undefined,
  path: string,
  bubbleName?: string
):
  | {
      value: unknown;
      shouldBeEditable: boolean;
      type: BubbleParameterType;
    }
  | undefined {
  if (!param) {
    return undefined;
  }

  // Check if this param is configured as a model selector
  const modelConfig = isModelParam(bubbleName, param.name);
  if (modelConfig) {
    const modelResult = getNestedParamValue(param, modelConfig.paramPath);
    const modelValue = modelResult?.value;
    if (
      !modelValue ||
      !AvailableModels.options.includes(modelValue as AvailableModel)
    ) {
      return { value: modelValue, shouldBeEditable: false, type: param.type };
    }
    return { value: modelValue, shouldBeEditable: true, type: param.type };
  }

  // Standard param extraction
  const result = getNestedParamValue(param, path);
  return {
    value: result?.value,
    shouldBeEditable:
      param.type == BubbleParameterType.STRING ||
      param.type == BubbleParameterType.NUMBER ||
      param.type == BubbleParameterType.BOOLEAN,
    type: param.type,
  };
}

/**
 * Serialize a value to valid TypeScript code
 * @param val - The value to serialize
 * @param forceTemplateLiteral - If true, use backticks even if the value doesn't contain ${}
 */
export function serializeValue(
  val: unknown,
  forceTemplateLiteral = false
): string {
  if (typeof val === 'string') {
    // Check if it looks like a template literal (contains ${) or if forced
    if (val.includes('${') || forceTemplateLiteral) {
      // For template literals, only escape backticks which would break the literal.
      // Backslashes should be preserved as-is since they form valid escape sequences
      // (e.g., \n for newline, \t for tab) that the user intends to keep.
      return '`' + val.replace(/`/g, '\\`') + '`';
    }
    // Use single quotes for regular strings
    return `'${val
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')}'`;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (val === null) {
    return 'null';
  }
  if (val === undefined) {
    return 'undefined';
  }
  if (Array.isArray(val)) {
    const elements = val.map((item) => serializeValue(item));
    return `[${elements.join(', ')}]`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    const props = entries.map(([key, value]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
      return `${safeKey}: ${serializeValue(value)}`;
    });
    return `{ ${props.join(', ')} }`;
  }
  return String(val);
}

/**
 * Get the source location for a bubble or a specific parameter.
 * If the bubble is a clone, finds and returns the original bubble's location
 * since clones share the same source code location.
 *
 * @param bubble - The bubble to get location from
 * @param bubbleParameters - All bubble parameters (needed to find original if clone)
 * @param paramName - Optional parameter name to get that param's location instead
 */
function getSourceLocation(
  bubble: ParsedBubbleWithInfo,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  paramName?: string
): ParsedBubbleWithInfo['location'] {
  // If this is a clone, find the original bubble
  let targetBubble = bubble;
  if (bubble.clonedFromVariableId !== undefined) {
    const originalBubble = Object.values(bubbleParameters).find(
      (b) => b.variableId === bubble.clonedFromVariableId
    );
    if (originalBubble) {
      targetBubble = originalBubble;
    }
  }

  // If paramName provided and param has location, return param's location
  if (paramName) {
    const param = targetBubble.parameters.find((p) => p.name === paramName);
    if (param?.location) {
      return param.location;
    }
  }

  return targetBubble.location;
}

/**
 * Pure function to update a bubble parameter in code
 * Supports nested paths like "model.model" for nested object attributes
 * newValue should be the raw value (string for strings, not wrapped in object)
 *
 * The replacement is restricted to the bubble's line range to avoid
 * accidentally replacing values elsewhere in the code.
 *
 * Returns the updated code and a list of all related variable IDs (original + clones)
 * that should have their cached parameters updated.
 */
export function updateBubbleParamInCode(
  code: string,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  variableId: number,
  paramPath: string, // e.g., "systemPrompt" or "model.model"
  newValue: unknown
):
  | {
      success: true;
      code: string;
      relatedVariableIds: number[];
      isTemplateLiteral: boolean;
      lineDiff: number;
      editedBubbleEndLine: number;
      editedParamEndLine: number | undefined;
    }
  | { success: false; error: string } {
  const bubble = Object.values(bubbleParameters).find(
    (b) => b.variableId === variableId
  );

  if (!bubble) {
    return { success: false, error: `Could not find bubble: ${variableId}` };
  }

  // Parse the path - "model.model" -> baseParam="model", nested path
  const pathParts = paramPath.split('.');
  const baseParamName = pathParts[0];

  const param = bubble.parameters.find((p) => p.name === baseParamName);

  if (!param) {
    return {
      success: false,
      error: `Updating is not currently supported for ${bubble.variableName}`,
    };
  }

  // Get current value using nested path
  const currentValueResult = getNestedParamValue(param, paramPath);
  if (currentValueResult === undefined) {
    return { success: false, error: `Could not get value for "${paramPath}"` };
  }

  const { value: currentValue, isTemplateLiteral } = currentValueResult;

  // Serialize both values as strings (newValue should be the raw string, not wrapped)
  // Preserve the original format (template literal vs regular string)
  // For currentValue, use isFromSourceCode=true since it already has proper escape sequences
  const currentValueSerialized = serializeValue(
    currentValue,
    isTemplateLiteral
  );
  const newValueSerialized = serializeValue(newValue, isTemplateLiteral);

  // Get the source location (uses original's location if this is a clone)
  // Use param location if available for more precise line range
  const location = getSourceLocation(bubble, bubbleParameters, baseParamName);
  const bubbleLocation = getSourceLocation(bubble, bubbleParameters);

  // Split code into lines and do replacement only within the param/bubble's line range
  const lines = code.split('\n');
  const startLineIndex = location.startLine - 1; // Convert to 0-based index
  const endLineIndex = location.endLine - 1;

  // Validate line range
  if (startLineIndex < 0 || endLineIndex >= lines.length) {
    return {
      success: false,
      error: `Visual Editing is not currently supported for this parameter: Invalid location: lines ${location.startLine}-${location.endLine} in code with ${lines.length} lines`,
    };
  }

  // Extract the code section (param location or bubble location)
  const sectionLines = lines.slice(startLineIndex, endLineIndex + 1);
  const sectionCode = sectionLines.join('\n');

  // Replace only the last occurrence of the value within the section
  // This is safer when using param location as it targets the specific value
  const lastIndex = sectionCode.lastIndexOf(currentValueSerialized);
  if (lastIndex === -1) {
    return {
      success: false,
      error: `Visual Editing is not currently supported for this parameter: No value to replace for "${paramPath}"`,
    };
  }

  const updatedSectionCode =
    sectionCode.substring(0, lastIndex) +
    newValueSerialized +
    sectionCode.substring(lastIndex + currentValueSerialized.length);

  // Reconstruct the full code with the updated section
  const updatedSectionLines = updatedSectionCode.split('\n');
  const updatedCode = [
    ...lines.slice(0, startLineIndex),
    ...updatedSectionLines,
    ...lines.slice(endLineIndex + 1),
  ].join('\n');

  // Get all related bubble variable IDs (original + clones) for cache updates
  const relatedVariableIds = getRelatedBubbleVariableIds(
    bubble,
    bubbleParameters
  );

  // Calculate line diff for location updates
  const oldLineCount = currentValueSerialized.split('\n').length;
  const newLineCount = newValueSerialized.split('\n').length;
  const lineDiff = newLineCount - oldLineCount;

  return {
    success: true,
    code: updatedCode,
    relatedVariableIds,
    isTemplateLiteral,
    lineDiff,
    editedBubbleEndLine: bubbleLocation.endLine,
    editedParamEndLine: param.location?.endLine,
  };
}

/**
 * Update the cached bubble parameters after a code update.
 * This function updates the parameter values in memory so subsequent edits
 * will find the correct current value.
 *
 * IMPORTANT: For template literal parameters, the cached value must preserve
 * the backtick wrapping so that `getNestedParamValue` can detect it as a
 * template literal on subsequent updates.
 *
 * Also handles line shift updates: when a value changes from multi-line to
 * single-line (or vice versa), all bubble locations need to be adjusted.
 *
 * @param bubbleParameters - The current bubble parameters cache
 * @param relatedVariableIds - Variable IDs of bubbles to update (for param values)
 * @param paramPath - The parameter path (e.g., "systemPrompt" or "model.model")
 * @param newValue - The new value to cache
 * @param isTemplateLiteral - Whether the original value was a template literal
 * @param lineDiff - Number of lines added (positive) or removed (negative)
 * @param editedBubbleEndLine - The original endLine of the edited bubble (before the edit)
 * @param editedParamEndLine - The original endLine of the edited parameter (for shifting params within same bubble)
 * @returns Updated bubble parameters cache with adjusted locations
 */
export function updateCachedBubbleParameters(
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  relatedVariableIds: number[],
  paramPath: string,
  newValue: unknown,
  isTemplateLiteral: boolean,
  lineDiff: number,
  editedBubbleEndLine: number,
  editedParamEndLine?: number
): Record<string, ParsedBubbleWithInfo> {
  const updatedBubbleParameters = { ...bubbleParameters };
  const pathParts = paramPath.split('.');
  const baseParamName = pathParts[0];

  // Create a set of variable IDs that need their param values updated
  const relatedVariableIdSet = new Set(relatedVariableIds);

  // Update all bubbles
  for (const [key, bubbleToUpdate] of Object.entries(updatedBubbleParameters)) {
    const updatedBubble = { ...bubbleToUpdate };
    const isRelatedBubble = relatedVariableIdSet.has(bubbleToUpdate.variableId);

    // Update parameter values for related bubbles
    if (isRelatedBubble) {
      updatedBubble.parameters = updatedBubble.parameters.map((p) => {
        if (p.name !== baseParamName) return p;

        // For nested paths like "model.model", use regex to update the specific key
        // This avoids using `new Function()` which would execute arbitrary code
        //
        // Limitations: This regex handles flat object literals with simple values
        // (strings, numbers, booleans). It does NOT support:
        // - Nested objects or arrays as values
        // - Template literals as values
        // For the current use cases (model names, numbers), this is sufficient.
        if (pathParts.length > 1 && typeof p.value === 'string') {
          const keyToUpdate = pathParts[1];
          const serializedNewValue =
            typeof newValue === 'string' ? `'${newValue}'` : String(newValue);

          // Match the key followed by its value:
          // - Single-quoted strings (with escaped quotes): '(?:[^'\\]|\\.)*'
          // - Double-quoted strings (with escaped quotes): "(?:[^"\\]|\\.)*"
          // - Primitives (numbers, booleans, null, undefined): [^,}\\s]+
          const keyPattern = new RegExp(
            `(${keyToUpdate}:\\s*)('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|[^,}\\s]+)`
          );

          if (keyPattern.test(p.value)) {
            // Replace existing key's value
            const updatedValue = p.value.replace(
              keyPattern,
              `$1${serializedNewValue}`
            );
            return { ...p, value: updatedValue };
          }
          // Key not found - return unchanged (shouldn't happen in normal usage)
          console.warn(`Key "${keyToUpdate}" not found in cached param value`);
          return p;
        }

        // For simple paths, replace the whole value
        // IMPORTANT: Preserve template literal format by wrapping with backticks
        if (isTemplateLiteral && typeof newValue === 'string') {
          return { ...p, value: '`' + newValue + '`' };
        }
        return { ...p, value: newValue as typeof p.value };
      });
    }

    // Update locations based on line diff
    if (lineDiff !== 0) {
      const location = updatedBubble.location;

      if (isRelatedBubble) {
        // This is the edited bubble (or its clone) - update endLine
        updatedBubble.location = {
          ...location,
          endLine: location.endLine + lineDiff,
        };
        // Also update parameter locations within this bubble
        // Shift params that come AFTER the edited param's original endLine
        updatedBubble.parameters = updatedBubble.parameters.map((p) => {
          if (!p.location) return p;
          // Shift params that start after the edited param's original endLine
          if (
            editedParamEndLine !== undefined &&
            p.location.startLine > editedParamEndLine
          ) {
            return {
              ...p,
              location: {
                ...p.location,
                startLine: p.location.startLine + lineDiff,
                endLine: p.location.endLine + lineDiff,
              },
            };
          }
          return p;
        });
      } else if (location.startLine > editedBubbleEndLine) {
        // This bubble comes AFTER the edited bubble - shift both start and end
        updatedBubble.location = {
          ...location,
          startLine: location.startLine + lineDiff,
          endLine: location.endLine + lineDiff,
        };
        // Also shift all parameter locations within this bubble
        updatedBubble.parameters = updatedBubble.parameters.map((p) => {
          if (!p.location) return p;
          return {
            ...p,
            location: {
              ...p.location,
              startLine: p.location.startLine + lineDiff,
              endLine: p.location.endLine + lineDiff,
            },
          };
        });
      }
      // Bubbles that come BEFORE the edited bubble don't need location updates
    }

    updatedBubbleParameters[key] = updatedBubble;
  }

  return updatedBubbleParameters;
}
