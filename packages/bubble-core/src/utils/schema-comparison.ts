import { z } from 'zod';

/**
 * Represents the difference between actual data and a Zod schema
 */
export interface SchemaDifference {
  /** Fields present in data but not defined in schema */
  extraFields: FieldInfo[];
  /** Fields defined in schema but missing from data (and are required) */
  missingRequiredFields: FieldInfo[];
  /** Fields defined in schema but missing from data (optional fields) */
  missingOptionalFields: FieldInfo[];
  /** Fields with type mismatches */
  typeMismatches: TypeMismatch[];
  /** Nested object differences */
  nestedDifferences: Record<string, SchemaDifference>;
  /** Summary statistics */
  summary: {
    totalExtraFields: number;
    totalMissingRequired: number;
    totalMissingOptional: number;
    totalTypeMismatches: number;
    isCompatible: boolean;
  };
}

export interface FieldInfo {
  path: string;
  value?: unknown;
  type?: string;
}

export interface TypeMismatch {
  path: string;
  expectedType: string;
  actualType: string;
  actualValue: unknown;
}

/**
 * Get the type name of a value for display purposes
 */
function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Extract field names and their optionality from a Zod object schema
 */
function extractSchemaFields(
  schema: z.ZodTypeAny
): Map<string, { schema: z.ZodTypeAny; isOptional: boolean }> {
  const fields = new Map<
    string,
    { schema: z.ZodTypeAny; isOptional: boolean }
  >();

  // Unwrap the schema to get to the core type
  let currentSchema = schema;

  // Handle ZodEffects (transforms, refinements)
  while (currentSchema instanceof z.ZodEffects) {
    currentSchema = currentSchema._def.schema;
  }

  // Handle ZodOptional
  if (currentSchema instanceof z.ZodOptional) {
    currentSchema = currentSchema._def.innerType;
  }

  // Handle ZodNullable
  if (currentSchema instanceof z.ZodNullable) {
    currentSchema = currentSchema._def.innerType;
  }

  // Handle ZodDefault
  if (currentSchema instanceof z.ZodDefault) {
    currentSchema = currentSchema._def.innerType;
  }

  // Now check if it's an object
  if (currentSchema instanceof z.ZodObject) {
    const shape = currentSchema._def.shape();
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const zodSchema = fieldSchema as z.ZodTypeAny;
      const isOptional =
        zodSchema.isOptional() || zodSchema instanceof z.ZodDefault;
      fields.set(key, { schema: zodSchema, isOptional });
    }
  }

  return fields;
}

/**
 * Get expected type description from a Zod schema
 */
function getExpectedType(schema: z.ZodTypeAny): string {
  // Unwrap optional/nullable/default
  let currentSchema = schema;

  const wrappers: string[] = [];

  if (currentSchema instanceof z.ZodOptional) {
    wrappers.push('optional');
    currentSchema = currentSchema._def.innerType;
  }

  if (currentSchema instanceof z.ZodNullable) {
    wrappers.push('nullable');
    currentSchema = currentSchema._def.innerType;
  }

  if (currentSchema instanceof z.ZodDefault) {
    wrappers.push('default');
    currentSchema = currentSchema._def.innerType;
  }

  let baseType: string;

  if (currentSchema instanceof z.ZodString) {
    baseType = 'string';
  } else if (currentSchema instanceof z.ZodNumber) {
    baseType = 'number';
  } else if (currentSchema instanceof z.ZodBoolean) {
    baseType = 'boolean';
  } else if (currentSchema instanceof z.ZodArray) {
    baseType = 'array';
  } else if (currentSchema instanceof z.ZodObject) {
    baseType = 'object';
  } else if (currentSchema instanceof z.ZodEnum) {
    baseType = `enum(${currentSchema._def.values.join('|')})`;
  } else if (currentSchema instanceof z.ZodUnion) {
    baseType = 'union';
  } else if (currentSchema instanceof z.ZodLiteral) {
    baseType = `literal(${JSON.stringify(currentSchema._def.value)})`;
  } else if (currentSchema instanceof z.ZodAny) {
    baseType = 'any';
  } else if (currentSchema instanceof z.ZodUnknown) {
    baseType = 'unknown';
  } else {
    baseType = 'unknown';
  }

  if (wrappers.length > 0) {
    return `${wrappers.join(' ')} ${baseType}`;
  }

  return baseType;
}

/**
 * Compare data against a Zod schema and find all differences
 *
 * @param schema - The Zod schema to compare against
 * @param data - The actual data to compare
 * @param basePath - Base path for nested field names (used internally)
 * @returns Detailed comparison results showing all differences
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number().optional(),
 * });
 *
 * const data = {
 *   name: 'John',
 *   extraField: 'unexpected',
 * };
 *
 * const diff = compareWithSchema(schema, data);
 * // diff.extraFields = [{ path: 'extraField', value: 'unexpected', type: 'string' }]
 * // diff.missingOptionalFields = [{ path: 'age' }]
 * ```
 */
export function compareWithSchema(
  schema: z.ZodTypeAny,
  data: unknown,
  basePath = ''
): SchemaDifference {
  const result: SchemaDifference = {
    extraFields: [],
    missingRequiredFields: [],
    missingOptionalFields: [],
    typeMismatches: [],
    nestedDifferences: {},
    summary: {
      totalExtraFields: 0,
      totalMissingRequired: 0,
      totalMissingOptional: 0,
      totalTypeMismatches: 0,
      isCompatible: true,
    },
  };

  // If data is not an object, we can't compare fields
  if (typeof data !== 'object' || data === null) {
    return result;
  }

  const dataObj = data as Record<string, unknown>;
  const schemaFields = extractSchemaFields(schema);
  const dataKeys = new Set(Object.keys(dataObj));

  // Find extra fields (in data but not in schema)
  for (const key of dataKeys) {
    if (!schemaFields.has(key)) {
      const fullPath = basePath ? `${basePath}.${key}` : key;
      result.extraFields.push({
        path: fullPath,
        value: dataObj[key],
        type: getTypeName(dataObj[key]),
      });
    }
  }

  // Find missing fields and check types
  for (const [key, fieldInfo] of schemaFields) {
    const fullPath = basePath ? `${basePath}.${key}` : key;
    const hasField = dataKeys.has(key);
    const value = dataObj[key];

    if (!hasField || value === undefined) {
      if (fieldInfo.isOptional) {
        result.missingOptionalFields.push({ path: fullPath });
      } else {
        result.missingRequiredFields.push({ path: fullPath });
      }
      continue;
    }

    // Check for type mismatches using safeParse on the field
    const fieldResult = fieldInfo.schema.safeParse(value);
    if (!fieldResult.success) {
      // Unwrap the schema to get base type for comparison
      let baseSchema = fieldInfo.schema;
      if (baseSchema instanceof z.ZodOptional) {
        baseSchema = baseSchema._def.innerType;
      }
      if (baseSchema instanceof z.ZodNullable) {
        baseSchema = baseSchema._def.innerType;
      }
      if (baseSchema instanceof z.ZodDefault) {
        baseSchema = baseSchema._def.innerType;
      }

      const expectedBaseType = getExpectedType(baseSchema);
      const actualType = getTypeName(value);

      // Only report as type mismatch if the base types are actually different
      // For objects/arrays, structural issues will be caught in nested differences
      const isStructuralMismatch =
        (baseSchema instanceof z.ZodObject && actualType === 'object') ||
        (baseSchema instanceof z.ZodArray && actualType === 'array');

      if (!isStructuralMismatch) {
        result.typeMismatches.push({
          path: fullPath,
          expectedType: expectedBaseType,
          actualType: actualType,
          actualValue: value,
        });
      }
    }

    // Recursively check nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Unwrap the schema to check if it's an object
      let innerSchema = fieldInfo.schema;
      if (innerSchema instanceof z.ZodOptional) {
        innerSchema = innerSchema._def.innerType;
      }
      if (innerSchema instanceof z.ZodNullable) {
        innerSchema = innerSchema._def.innerType;
      }
      if (innerSchema instanceof z.ZodDefault) {
        innerSchema = innerSchema._def.innerType;
      }

      if (innerSchema instanceof z.ZodObject) {
        const nestedDiff = compareWithSchema(innerSchema, value, fullPath);
        if (
          nestedDiff.extraFields.length > 0 ||
          nestedDiff.missingRequiredFields.length > 0 ||
          nestedDiff.typeMismatches.length > 0
        ) {
          result.nestedDifferences[key] = nestedDiff;
        }
      }
    }

    // Check array items if it's an array schema
    if (Array.isArray(value)) {
      let innerSchema = fieldInfo.schema;
      if (innerSchema instanceof z.ZodOptional) {
        innerSchema = innerSchema._def.innerType;
      }
      if (innerSchema instanceof z.ZodNullable) {
        innerSchema = innerSchema._def.innerType;
      }

      if (innerSchema instanceof z.ZodArray) {
        const itemSchema = innerSchema._def.type;
        // Check first few items for differences
        for (let i = 0; i < Math.min(value.length, 3); i++) {
          const item = value[i];
          if (typeof item === 'object' && item !== null) {
            const itemPath = `${fullPath}[${i}]`;
            const itemDiff = compareWithSchema(itemSchema, item, itemPath);
            if (
              itemDiff.extraFields.length > 0 ||
              itemDiff.missingRequiredFields.length > 0 ||
              itemDiff.typeMismatches.length > 0
            ) {
              result.nestedDifferences[`${key}[${i}]`] = itemDiff;
            }
          }
        }
      }
    }
  }

  // Calculate summary
  result.summary.totalExtraFields = countAllExtraFields(result);
  result.summary.totalMissingRequired = countAllMissingRequired(result);
  result.summary.totalMissingOptional = countAllMissingOptional(result);
  result.summary.totalTypeMismatches = countAllTypeMismatches(result);
  result.summary.isCompatible =
    result.summary.totalMissingRequired === 0 &&
    result.summary.totalTypeMismatches === 0;

  return result;
}

function countAllExtraFields(diff: SchemaDifference): number {
  let count = diff.extraFields.length;
  for (const nested of Object.values(diff.nestedDifferences)) {
    count += countAllExtraFields(nested);
  }
  return count;
}

function countAllMissingRequired(diff: SchemaDifference): number {
  let count = diff.missingRequiredFields.length;
  for (const nested of Object.values(diff.nestedDifferences)) {
    count += countAllMissingRequired(nested);
  }
  return count;
}

function countAllMissingOptional(diff: SchemaDifference): number {
  let count = diff.missingOptionalFields.length;
  for (const nested of Object.values(diff.nestedDifferences)) {
    count += countAllMissingOptional(nested);
  }
  return count;
}

function countAllTypeMismatches(diff: SchemaDifference): number {
  let count = diff.typeMismatches.length;
  for (const nested of Object.values(diff.nestedDifferences)) {
    count += countAllTypeMismatches(nested);
  }
  return count;
}

/**
 * Format schema differences as a human-readable string
 */
export function formatSchemaDifference(
  diff: SchemaDifference,
  indent = 0
): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  if (diff.extraFields.length > 0) {
    lines.push(`${pad}Extra fields (not in schema):`);
    for (const field of diff.extraFields) {
      const valuePreview =
        typeof field.value === 'object'
          ? JSON.stringify(field.value).slice(0, 100)
          : String(field.value).slice(0, 50);
      lines.push(`${pad}  - ${field.path}: ${field.type} = ${valuePreview}`);
    }
  }

  if (diff.missingRequiredFields.length > 0) {
    lines.push(`${pad}Missing required fields:`);
    for (const field of diff.missingRequiredFields) {
      lines.push(`${pad}  - ${field.path}`);
    }
  }

  if (diff.missingOptionalFields.length > 0) {
    lines.push(`${pad}Missing optional fields:`);
    for (const field of diff.missingOptionalFields) {
      lines.push(`${pad}  - ${field.path}`);
    }
  }

  if (diff.typeMismatches.length > 0) {
    lines.push(`${pad}Type mismatches:`);
    for (const mismatch of diff.typeMismatches) {
      lines.push(
        `${pad}  - ${mismatch.path}: expected ${mismatch.expectedType}, got ${mismatch.actualType}`
      );
    }
  }

  for (const [key, nestedDiff] of Object.entries(diff.nestedDifferences)) {
    lines.push(`${pad}Nested differences in '${key}':`);
    lines.push(formatSchemaDifference(nestedDiff, indent + 1));
  }

  if (lines.length === 0) {
    lines.push(`${pad}No differences found - data matches schema perfectly`);
  }

  return lines.join('\n');
}

export interface FieldWithIndex {
  fieldName: string;
  index: number;
}

/**
 * Compare multiple data items against a schema and aggregate differences
 * Useful for analyzing API responses with multiple items
 */
export function compareMultipleWithSchema(
  schema: z.ZodTypeAny,
  items: unknown[],
  maxItems = 10
): {
  itemCount: number;
  status: 'PASS' | 'FAIL';
  allExtraFields: FieldWithIndex[];
  allMissingRequired: FieldWithIndex[];
  allMissingOptional: FieldWithIndex[];
  allTypeMismatches: Map<string, Set<string>>;
  sampleDifferences: SchemaDifference[];
  summary: string;
} {
  const allExtraFields: FieldWithIndex[] = [];
  const allMissingRequired: FieldWithIndex[] = [];
  const allMissingOptional: FieldWithIndex[] = [];
  const allTypeMismatches = new Map<string, Set<string>>();
  const sampleDifferences: SchemaDifference[] = [];

  const itemsToCheck = items.slice(0, maxItems);

  for (let index = 0; index < itemsToCheck.length; index++) {
    const item = itemsToCheck[index];
    const diff = compareWithSchema(schema, item);
    sampleDifferences.push(diff);

    // Collect extra fields
    collectExtraFieldsWithIndex(diff, allExtraFields, index);

    // Collect missing required
    for (const field of diff.missingRequiredFields) {
      allMissingRequired.push({
        fieldName: field.path,
        index,
      });
    }

    // Collect missing optional
    for (const field of diff.missingOptionalFields) {
      allMissingOptional.push({
        fieldName: field.path,
        index,
      });
    }

    // Collect type mismatches
    for (const mismatch of diff.typeMismatches) {
      if (!allTypeMismatches.has(mismatch.path)) {
        allTypeMismatches.set(mismatch.path, new Set());
      }
      allTypeMismatches
        .get(mismatch.path)!
        .add(`expected ${mismatch.expectedType}, got ${mismatch.actualType}`);
    }
  }

  // Determine PASS/FAIL status
  // Only FAIL if there are missing REQUIRED fields or type mismatches
  // Missing optional fields are informational only
  const status: 'PASS' | 'FAIL' =
    allMissingRequired.length === 0 && allTypeMismatches.size === 0
      ? 'PASS'
      : 'FAIL';

  const result = {
    itemCount: items.length,
    status,
    allExtraFields,
    allMissingRequired,
    allMissingOptional,
    allTypeMismatches,
    sampleDifferences,
    summary: '', // Will be populated below
  };

  // Generate the summary
  result.summary = generateSummary({
    ...result,
    schema,
    sampleDifferences,
    items,
  });

  return result;
}

/**
 * Generate expected schema structure as a string
 */
function generateExpectedSchemaStructure(
  schema: z.ZodTypeAny,
  indent = 0
): string {
  const lines: string[] = [];
  const pad = '  '.repeat(indent);
  const schemaFields = extractSchemaFields(schema);

  if (schemaFields.size === 0) {
    return '';
  }

  for (const [fieldName, fieldInfo] of schemaFields) {
    const expectedType = getExpectedType(fieldInfo.schema);
    const marker = fieldInfo.isOptional ? '(optional)' : '(required)';

    // Check if it's a nested object
    let innerSchema = fieldInfo.schema;
    if (innerSchema instanceof z.ZodOptional) {
      innerSchema = innerSchema._def.innerType;
    }
    if (innerSchema instanceof z.ZodNullable) {
      innerSchema = innerSchema._def.innerType;
    }
    if (innerSchema instanceof z.ZodDefault) {
      innerSchema = innerSchema._def.innerType;
    }

    if (innerSchema instanceof z.ZodObject) {
      lines.push(`${pad}${fieldName}: object ${marker} {`);
      lines.push(generateExpectedSchemaStructure(innerSchema, indent + 1));
      lines.push(`${pad}}`);
    } else {
      lines.push(`${pad}${fieldName}: ${expectedType} ${marker}`);
    }
  }

  return lines.join('\n');
}

/**
 * Infer schema structure from actual data samples
 */
function inferSchemaFromData(
  items: unknown[],
  maxSamples = 10
): Map<string, Set<string>> {
  const fieldTypes = new Map<string, Set<string>>();

  const samplesToCheck = items.slice(0, maxSamples);

  for (const item of samplesToCheck) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const collectFieldsRecursive = (
      obj: Record<string, unknown>,
      prefix = ''
    ) => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        if (!fieldTypes.has(fieldPath)) {
          fieldTypes.set(fieldPath, new Set());
        }

        const typeName = getTypeName(value);
        fieldTypes.get(fieldPath)!.add(typeName);

        // Recursively process nested objects
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          collectFieldsRecursive(value as Record<string, unknown>, fieldPath);
        }
      }
    };

    collectFieldsRecursive(item as Record<string, unknown>);
  }

  return fieldTypes;
}

/**
 * Generate actual data structure from samples with proper nesting
 */
function generateActualSchemaStructure(
  items: unknown[],
  maxSamples = 10
): string {
  const fieldTypes = inferSchemaFromData(items, maxSamples);

  if (fieldTypes.size === 0) {
    return '  (no fields found)';
  }

  const lines: string[] = [];

  // Build a tree structure from the flat field paths
  interface FieldNode {
    name: string;
    types: Set<string>;
    children: Map<string, FieldNode>;
    isObject: boolean;
  }

  const root: FieldNode = {
    name: '',
    types: new Set(),
    children: new Map(),
    isObject: true,
  };

  // Build the tree
  for (const [fieldPath, types] of fieldTypes) {
    const parts = fieldPath.split('.');
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          name: part,
          types: new Set(),
          children: new Map(),
          isObject: false,
        });
      }

      const node = currentNode.children.get(part)!;

      // If this is the last part, set the types
      if (i === parts.length - 1) {
        node.types = types;
        // Check if any child fields exist for this path
        const hasChildren = Array.from(fieldTypes.keys()).some(
          (key) => key.startsWith(fieldPath + '.') && key !== fieldPath
        );
        node.isObject = hasChildren || types.has('object');
      } else {
        node.isObject = true;
      }

      currentNode = node;
    }
  }

  // Render the tree
  function renderNode(node: FieldNode, indent: number, parentPath = ''): void {
    const pad = '  '.repeat(indent);
    const currentPath = parentPath ? `${parentPath}.${node.name}` : node.name;

    if (node.name === '') {
      // Root node, just render children
      for (const child of node.children.values()) {
        renderNode(child, indent, '');
      }
      return;
    }

    if (node.children.size > 0) {
      // This is an object with nested fields
      const typeStr =
        node.types.size > 0 ? Array.from(node.types).join(' | ') : 'object';
      lines.push(`${pad}${node.name}: ${typeStr} {`);

      // Render children
      for (const child of Array.from(node.children.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        renderNode(child, indent + 1, currentPath);
      }

      lines.push(`${pad}}`);
    } else {
      // Leaf node
      const typeStr =
        node.types.size > 0 ? Array.from(node.types).join(' | ') : 'unknown';
      lines.push(`${pad}${node.name}: ${typeStr}`);
    }
  }

  renderNode(root, 1);

  return lines.join('\n');
}

/**
 * Generate a human-readable diff-style summary
 */
function generateSummary(result: {
  itemCount: number;
  status: 'PASS' | 'FAIL';
  allExtraFields: FieldWithIndex[];
  allMissingRequired: FieldWithIndex[];
  allMissingOptional: FieldWithIndex[];
  allTypeMismatches: Map<string, Set<string>>;
  sampleDifferences: SchemaDifference[];
  schema: z.ZodTypeAny;
  items: unknown[];
}): string {
  const lines: string[] = [];

  // First line shows PASS/FAIL status prominently
  lines.push(
    `[${result.status}] Schema Comparison Summary (${result.itemCount} items)`
  );
  lines.push('='.repeat(60));
  lines.push('');

  // Show expected schema structure
  lines.push('Expected Schema:');
  lines.push(generateExpectedSchemaStructure(result.schema));
  lines.push('');

  // Show actual schema from data
  lines.push('Actual Schema:');
  lines.push(generateActualSchemaStructure(result.items));
  lines.push('');

  lines.push('='.repeat(60));
  lines.push('');

  if (result.allMissingRequired.length > 0) {
    lines.push('Missing REQUIRED fields:');
    const grouped = new Map<string, number[]>();
    for (const field of result.allMissingRequired) {
      if (!grouped.has(field.fieldName)) {
        grouped.set(field.fieldName, []);
      }
      grouped.get(field.fieldName)!.push(field.index);
    }
    for (const [fieldName, indices] of grouped) {
      const indexList =
        indices.length > 5
          ? `[${indices.slice(0, 5).join(', ')}... and ${indices.length - 5} more]`
          : `[${indices.join(', ')}]`;
      lines.push(`  - ${fieldName} ${indexList}`);
    }
    lines.push('');
  }

  if (result.allMissingOptional.length > 0) {
    lines.push('Missing optional fields:');
    const grouped = new Map<string, number[]>();
    for (const field of result.allMissingOptional) {
      if (!grouped.has(field.fieldName)) {
        grouped.set(field.fieldName, []);
      }
      grouped.get(field.fieldName)!.push(field.index);
    }
    for (const [fieldName, indices] of grouped) {
      const indexList =
        indices.length > 5
          ? `[${indices.slice(0, 5).join(', ')}... and ${indices.length - 5} more]`
          : `[${indices.join(', ')}]`;
      lines.push(`  - ${fieldName} ${indexList}`);
    }
    lines.push('');
  }

  if (result.allExtraFields.length > 0) {
    lines.push(
      'Extra fields (not in schema): Permitted, if these fields are not relevant to the functionality of the bubble'
    );
    const grouped = new Map<string, number[]>();
    for (const field of result.allExtraFields) {
      if (!grouped.has(field.fieldName)) {
        grouped.set(field.fieldName, []);
      }
      grouped.get(field.fieldName)!.push(field.index);
    }
    for (const [fieldName, indices] of grouped) {
      const indexList =
        indices.length > 5
          ? `[${indices.slice(0, 5).join(', ')}... and ${indices.length - 5} more]`
          : `[${indices.join(', ')}]`;
      lines.push(`  + ${fieldName} ${indexList}`);
    }
    lines.push('');
  }

  if (result.allTypeMismatches.size > 0) {
    lines.push('Type mismatches:');
    for (const [path, mismatches] of result.allTypeMismatches) {
      lines.push(`  ! ${path}: ${[...mismatches].join(', ')}`);
    }
    lines.push('');
  }

  if (result.status === 'PASS') {
    lines.push('✓ All items match the schema perfectly');
  }

  return lines.join('\n');
}

function collectExtraFieldsWithIndex(
  diff: SchemaDifference,
  collection: FieldWithIndex[],
  index: number
): void {
  for (const field of diff.extraFields) {
    collection.push({
      fieldName: field.path,
      index,
    });
  }
  for (const nested of Object.values(diff.nestedDifferences)) {
    collectExtraFieldsWithIndex(nested, collection, index);
  }
}

/**
 * Format aggregated differences from multiple items in a git-diff style
 */
export function formatAggregatedDifferences(
  result: ReturnType<typeof compareMultipleWithSchema>
): string {
  const lines: string[] = [];

  lines.push(`Schema Comparison Summary (${result.itemCount} items)`);
  lines.push('='.repeat(50));
  lines.push('');

  if (result.allMissingRequired.length > 0) {
    lines.push('Missing REQUIRED fields:');
    for (const field of result.allMissingRequired) {
      lines.push(`  - ${field.fieldName} [missing at index ${field.index}]`);
    }
    lines.push('');
  }

  if (result.allMissingOptional.length > 0) {
    lines.push('Missing optional fields:');
    for (const field of result.allMissingOptional) {
      lines.push(`  - ${field.fieldName} [missing at index ${field.index}]`);
    }
    lines.push('');
  }

  if (result.allExtraFields.length > 0) {
    lines.push('Extra fields (not in schema):');
    for (const field of result.allExtraFields) {
      lines.push(`  + ${field.fieldName} [found at index ${field.index}]`);
    }
    lines.push('');
  }

  if (result.allTypeMismatches.size > 0) {
    lines.push('Type mismatches:');
    for (const [path, mismatches] of result.allTypeMismatches) {
      lines.push(`  ! ${path}: ${[...mismatches].join(', ')}`);
    }
    lines.push('');
  }

  if (
    result.allExtraFields.length === 0 &&
    result.allMissingRequired.length === 0 &&
    result.allTypeMismatches.size === 0
  ) {
    lines.push('✓ All items match the schema perfectly');
  }

  return lines.join('\n');
}

/**
 * Format aggregated differences with per-item breakdown
 */
export function formatAggregatedDifferencesDetailed(
  result: ReturnType<typeof compareMultipleWithSchema>,
  schema: z.ZodTypeAny
): string {
  const lines: string[] = [];
  const schemaFields = extractSchemaFields(schema);

  lines.push(`Schema Comparison Summary (${result.itemCount} items)`);
  lines.push('='.repeat(50));
  lines.push('');

  // Show per-item breakdown
  for (let i = 0; i < result.sampleDifferences.length; i++) {
    const diff = result.sampleDifferences[i];
    lines.push(`Item ${i}:`);

    // Show all schema fields with their status
    for (const [fieldName, fieldInfo] of schemaFields) {
      const isMissing =
        diff.missingRequiredFields.some((f) => f.path === fieldName) ||
        diff.missingOptionalFields.some((f) => f.path === fieldName);
      const hasTypeMismatch = diff.typeMismatches.some(
        (m) => m.path === fieldName
      );
      const fieldType = fieldInfo.isOptional ? 'optional' : 'required';

      if (isMissing) {
        lines.push(`  - ${fieldName} (${fieldType}) MISSING`);
      } else if (hasTypeMismatch) {
        const mismatch = diff.typeMismatches.find((m) => m.path === fieldName);
        lines.push(
          `  ! ${fieldName} (${fieldType}) TYPE MISMATCH: ${mismatch?.expectedType} vs ${mismatch?.actualType}`
        );
      } else {
        lines.push(`  + ${fieldName} (${fieldType}) ✓`);
      }
    }

    // Show extra fields
    if (diff.extraFields.length > 0) {
      for (const extra of diff.extraFields) {
        lines.push(`  + ${extra.path} (extra field)`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
