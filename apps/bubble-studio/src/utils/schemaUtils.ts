import type { JsonSchema } from '@/hooks/useBubbleSchema';
import type { BubbleParameter } from '@bubblelab/shared-schemas';

/**
 * Represents a parameter merged from schema and runtime values
 */
export interface MergedParam {
  /** Parameter name */
  name: string;
  /** The JSON schema for this parameter */
  schema: JsonSchema;
  /** Current value from runtime (or default from schema if not set) */
  value: unknown;
  /** Whether this value came from runtime (true) or is just the default (false) */
  hasRuntimeValue: boolean;
  /** Whether this parameter is required */
  isRequired: boolean;
  /** Description from schema */
  description?: string;
  /** Default value from schema */
  defaultValue?: unknown;
  /** If this is an enum type, the available options */
  enumOptions?: (string | number | boolean | null)[];
  /** If this is an array type, the item schema */
  itemSchema?: JsonSchema;
  /** Parameter type as detected from schema */
  paramType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'enum'
    | 'unknown';
  /** Whether the param is editable (simple types only) */
  isEditable: boolean;
}

/**
 * Information about a discriminated union operation
 */
export interface OperationInfo {
  /** The operation name (e.g., "send_message", "list_channels") */
  operation: string;
  /** Description of this operation from schema */
  description?: string;
  /** The schema branch for this operation */
  schema: JsonSchema;
  /** Required parameters for this operation (excluding 'operation' itself) */
  requiredParams: string[];
}

/**
 * Detects if a schema is a discriminated union with 'operation' as discriminator
 */
export function isDiscriminatedUnionSchema(
  schema: JsonSchema | undefined
): boolean {
  if (!schema?.anyOf || !Array.isArray(schema.anyOf)) {
    return false;
  }

  // Check if all anyOf branches have an 'operation' property with an enum of exactly one value
  return schema.anyOf.every((branch) => {
    const opProp = branch.properties?.operation;
    return (
      opProp &&
      opProp.type === 'string' &&
      Array.isArray(opProp.enum) &&
      opProp.enum.length === 1
    );
  });
}

/**
 * Extracts operation options from a discriminated union schema
 */
export function getOperationOptions(
  schema: JsonSchema | undefined
): OperationInfo[] {
  if (!schema?.anyOf || !isDiscriminatedUnionSchema(schema)) {
    return [];
  }

  return schema.anyOf.map((branch) => {
    const opProp = branch.properties?.operation;
    const operation = (opProp?.enum?.[0] as string) || '';
    const description = opProp?.description;

    // Get required params excluding 'operation' and 'credentials'
    const requiredParams = (branch.required || []).filter(
      (name) => name !== 'operation' && name !== 'credentials'
    );

    return {
      operation,
      description,
      schema: branch,
      requiredParams,
    };
  });
}

/**
 * Gets the schema branch for a specific operation in a discriminated union
 */
export function getSchemaForOperation(
  schema: JsonSchema | undefined,
  operation: string
): JsonSchema | undefined {
  if (!schema?.anyOf || !isDiscriminatedUnionSchema(schema)) {
    return undefined;
  }

  return schema.anyOf.find((branch) => {
    const opProp = branch.properties?.operation;
    return opProp?.enum?.[0] === operation;
  });
}

/**
 * Detect parameter type from JSON Schema
 */
export function detectParamType(
  propSchema: JsonSchema
): MergedParam['paramType'] {
  // Check for enum first
  if (propSchema.enum && Array.isArray(propSchema.enum)) {
    return 'enum';
  }

  // Check explicit type
  const type = Array.isArray(propSchema.type)
    ? propSchema.type[0] // Use first type if array
    : propSchema.type;

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Check if a parameter is editable (simple types only)
 */
export function isParamEditable(paramType: MergedParam['paramType']): boolean {
  return ['string', 'number', 'boolean', 'enum'].includes(paramType);
}

/**
 * Merges JSON Schema with runtime parameter values
 * Returns an array of merged params with schema info + current values
 */
export function mergeSchemaWithParams(
  schema: JsonSchema | undefined,
  runtimeParams: BubbleParameter[]
): MergedParam[] {
  if (!schema) {
    // No schema - just return runtime params with minimal info
    return runtimeParams.map((param) => ({
      name: param.name,
      schema: {},
      value: param.value,
      hasRuntimeValue: true,
      isRequired: false,
      paramType: 'unknown' as const,
      isEditable: false,
    }));
  }

  // For discriminated union, we need the caller to select operation first
  // This function handles simple object schemas
  const properties = schema.properties || {};
  const required = schema.required || [];

  // Build runtime params lookup
  const runtimeLookup = new Map(runtimeParams.map((p) => [p.name, p]));

  // Process all schema properties
  const mergedParams: MergedParam[] = Object.entries(properties)
    .filter(([name]) => name !== 'credentials') // Exclude credentials
    .map(([name, propSchema]) => {
      const runtimeParam = runtimeLookup.get(name);
      const paramType = detectParamType(propSchema);

      // Check if runtime param is a variable/expression reference - these are not editable
      // because the value in code is a variable name, not a literal value
      const isVariableOrExpression =
        runtimeParam?.type === 'variable' ||
        runtimeParam?.type === 'expression';

      return {
        name,
        schema: propSchema,
        value: runtimeParam?.value ?? propSchema.default,
        hasRuntimeValue: runtimeParam !== undefined,
        isRequired: required.includes(name),
        description: propSchema.description,
        defaultValue: propSchema.default,
        enumOptions: propSchema.enum,
        itemSchema: propSchema.items as JsonSchema | undefined,
        paramType,
        isEditable: isParamEditable(paramType) && !isVariableOrExpression,
      };
    });

  // Sort: required params first, then by name
  return mergedParams.sort((a, b) => {
    if (a.isRequired !== b.isRequired) {
      return a.isRequired ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get parameters for a specific operation in a discriminated union
 */
export function getParamsForOperation(
  schema: JsonSchema | undefined,
  operation: string,
  runtimeParams: BubbleParameter[]
): MergedParam[] {
  const branchSchema = getSchemaForOperation(schema, operation);
  if (!branchSchema) {
    return [];
  }

  const merged = mergeSchemaWithParams(branchSchema, runtimeParams);

  // Filter out the 'operation' param itself (it's shown separately)
  return merged.filter((p) => p.name !== 'operation');
}

/**
 * Gets the current operation value from runtime params
 */
export function getCurrentOperation(
  runtimeParams: BubbleParameter[]
): string | undefined {
  const opParam = runtimeParams.find((p) => p.name === 'operation');
  if (!opParam) return undefined;

  const value = opParam.value;
  if (typeof value === 'string') {
    // Handle quoted strings like "'send_message'" or "\"send_message\""
    const trimmed = value.replace(/^['"]|['"]$/g, '');
    return trimmed;
  }
  return undefined;
}

/**
 * Format a value for display
 */
export function formatDisplayValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    // Remove surrounding quotes if present
    return value.replace(/^['"`]|['"`]$/g, '');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Parse a string value to its proper type based on schema
 */
export function parseValueForSchema(
  value: string,
  paramType: MergedParam['paramType']
): unknown {
  switch (paramType) {
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    case 'enum':
    case 'string':
      return value;
    default:
      return value;
  }
}
