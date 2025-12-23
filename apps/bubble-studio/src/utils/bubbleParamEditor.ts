import { AvailableModels } from '@bubblelab/shared-schemas';
import type {
  BubbleParameter,
  ParsedBubbleWithInfo,
  AvailableModel,
} from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';
/**
 * Get a nested value from a param using dot notation (e.g., "model.model")
 * Returns the string value at that path
 */
function getNestedParamValue(
  param: BubbleParameter | undefined,
  path: string
): string | undefined {
  if (!param?.value) return undefined;

  const parts = path.split('.');

  // If path is just the param name (e.g., "systemPrompt"), return value directly
  if (parts.length === 1) {
    if (typeof param.value === 'string') {
      let value = param.value;
      // Strip template literal backticks if present (e.g., `Hello ${name}` -> Hello ${name})
      if (value.startsWith('`') && value.endsWith('`')) {
        value = value.slice(1, -1);
      }
      return value;
    }
    return undefined;
  }

  // For nested paths like "model.model", we need to parse the string representation
  // The param.value is a string like "{ model: 'google/gemini-2.5-pro' }"
  if (typeof param.value === 'string') {
    const attrName = parts[1]; // e.g., "model" from "model.model"
    const match = param.value.match(
      new RegExp(`${attrName}:\\s*['"]([^'"]+)['"]`)
    );
    if (match) {
      return match[1];
    }
  }

  // If value is an actual object
  if (typeof param.value === 'object') {
    const attrName = parts[1];
    const obj = param.value as Record<string, unknown>;
    if (typeof obj[attrName] === 'string') {
      return obj[attrName] as string;
    }
  }

  return undefined;
}

export function extractParamValue(
  param: BubbleParameter | undefined,
  path: string
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
  const value = getNestedParamValue(param, path);

  if (param.name === 'model') {
    const value = getNestedParamValue(param, 'model.model');
    if (!value || !AvailableModels.options.includes(value as AvailableModel)) {
      return { value: value, shouldBeEditable: false, type: param.type };
    }
    return { value: value, shouldBeEditable: true, type: param.type };
  }
  return {
    value: value,
    shouldBeEditable: param.type == BubbleParameterType.STRING,
    type: param.type,
  };
}

/**
 * Serialize a value to valid TypeScript code
 */
export function serializeValue(val: unknown): string {
  if (typeof val === 'string') {
    // Check if it looks like a template literal (contains ${)
    if (val.includes('${')) {
      return '`' + val.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
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
 * Pure function to update a bubble parameter in code
 * Supports nested paths like "model.model" for nested object attributes
 * newValue should be the raw value (string for strings, not wrapped in object)
 */
export function updateBubbleParamInCode(
  code: string,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  variableName: string,
  paramPath: string, // e.g., "systemPrompt" or "model.model"
  newValue: unknown
): { success: true; code: string } | { success: false; error: string } {
  const bubble = Object.values(bubbleParameters).find(
    (b) => b.variableName === variableName
  );

  if (!bubble) {
    return { success: false, error: `Could not find bubble: ${variableName}` };
  }

  // Parse the path - "model.model" -> baseParam="model", nested path
  const pathParts = paramPath.split('.');
  const baseParamName = pathParts[0];

  const param = bubble.parameters.find((p) => p.name === baseParamName);

  if (!param) {
    return {
      success: false,
      error: `Could not find parameter "${baseParamName}" in ${variableName}`,
    };
  }

  // Get current value using nested path
  const currentValue = getNestedParamValue(param, paramPath);
  if (currentValue === undefined) {
    return { success: false, error: `Could not get value for "${paramPath}"` };
  }

  // Serialize both values as strings (newValue should be the raw string, not wrapped)
  const currentValueSerialized = serializeValue(currentValue);
  const newValueSerialized = serializeValue(newValue);
  console.log(
    '[updateBubbleParam] currentValueSerialized:',
    currentValueSerialized
  );
  console.log('[updateBubbleParam] code:', code);
  // Simple string replacement
  const updatedCode = code.replace(currentValueSerialized, newValueSerialized);

  if (updatedCode === code) {
    return {
      success: false,
      error: `Could not find value to replace for "${paramPath}"`,
    };
  }

  return { success: true, code: updatedCode };
}
