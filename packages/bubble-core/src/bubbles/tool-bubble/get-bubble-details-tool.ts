import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleFactory } from '../../bubble-factory.js';
import type { BubbleName } from '@bubblelab/shared-schemas';

// Define the parameters schema
const GetBubbleDetailsToolParamsSchema = z.object({
  bubbleName: z
    .string()
    .min(1, 'Bubble name is required')
    .describe('The name of the bubble to get details about'),
  includeInputSchema: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include input parameter schema in the response'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

// Type definitions
type GetBubbleDetailsToolParamsInput = z.input<
  typeof GetBubbleDetailsToolParamsSchema
>;
type GetBubbleDetailsToolParams = z.output<
  typeof GetBubbleDetailsToolParamsSchema
>;

type GetBubbleDetailsToolResult = z.output<
  typeof GetBubbleDetailsToolResultSchema
>;

// Result schema for validation
const GetBubbleDetailsToolResultSchema = z.object({
  name: z.string().describe('Name of the bubble'),
  alias: z.string().optional().describe('Short alias for the bubble'),
  inputSchema: z
    .string()
    .optional()
    .describe('String representation of the input parameter schema types'),
  outputSchema: z
    .string()
    .describe('String representation of the output schema types'),
  usageExample: z
    .string()
    .describe('Code example showing how to use the bubble'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

export class GetBubbleDetailsTool extends ToolBubble<
  GetBubbleDetailsToolParams,
  GetBubbleDetailsToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'get-bubble-details-tool';
  static readonly schema = GetBubbleDetailsToolParamsSchema;
  static readonly resultSchema = GetBubbleDetailsToolResultSchema;
  static readonly shortDescription =
    'Provides detailed information about a specific bubble, including schema, parameters, and documentation';
  static readonly longDescription = `
    A tool bubble that retrieves comprehensive information about any registered bubble in the system.
    
    Returns detailed information including:
    - Complete schema with parameter types and descriptions
    - Result schema for expected outputs
    - Credential requirements
    - AI-formatted documentation
    - Usage examples
    
    Use cases:
    - AI agent understanding of specific bubble capabilities
    - Parameter validation before bubble instantiation
    - Documentation generation and help systems
    - Dynamic form generation for bubble configuration
  `;
  static readonly alias = 'details';
  private factory: BubbleFactory;

  constructor(
    params: GetBubbleDetailsToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
    this.factory = new BubbleFactory();
  }

  async performAction(
    context?: BubbleContext
  ): Promise<GetBubbleDetailsToolResult> {
    void context; // Context available but not currently used
    await this.factory.registerDefaults();
    const metadata = this.factory.getMetadata(
      this.params.bubbleName as BubbleName
    );

    if (!metadata) {
      throw new Error(
        `Bubble '${this.params.bubbleName}' not found in registry`
      );
    }

    // Get the actual bubble class to extract its class name
    const BubbleClass = this.factory.get(this.params.bubbleName as BubbleName);
    const className = BubbleClass
      ? (BubbleClass as unknown as { name: string }).name
      : this.toPascalCase(metadata.name) + 'Bubble'; // Fallback

    // Format schema for AI consumption
    // const schemaProperties = JSON.stringify(zodToJsonSchema(metadata.schema));

    // const resultSchemaProperties = JSON.stringify(
    //   zodToJsonSchema(metadata.resultSchema!)
    // );
    // Create formatted description for AI agents
    const usageExample = this.generateUsageExample({
      name: metadata.name,
      className,
      schema: metadata.schema,
      resultSchema: metadata.resultSchema,
    });

    // Generate string representation of output schema
    const outputSchemaString = this.generateOutputSchemaString(
      metadata.resultSchema
    );

    // Generate string representation of input schema if requested
    const inputSchemaString = this.params.includeInputSchema
      ? this.generateOutputSchemaString(metadata.schema)
      : undefined;

    return {
      name: metadata.name,
      alias: metadata.alias,
      inputSchema: inputSchemaString,
      outputSchema: outputSchemaString,
      usageExample,
      success: true,
      error: '',
    };
  }

  private generateOutputSchemaString(resultSchema: unknown): string {
    if (!resultSchema) {
      return 'No output schema defined';
    }

    try {
      if (
        resultSchema &&
        typeof resultSchema === 'object' &&
        'shape' in resultSchema
      ) {
        const shape = (resultSchema as any).shape;
        const outputFields: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          if (value && typeof value === 'object' && '_def' in value) {
            const zodType = value as z.ZodTypeAny;
            const typeInfo = this.generateTypeInfo(zodType, true); // Enable nested descriptions
            const description = this.getParameterDescription(zodType);

            if (typeInfo) {
              let fieldLine = `${key}: ${typeInfo}`;
              if (description) {
                fieldLine += ` // ${description}`;
              }
              outputFields.push(fieldLine);
            }
          }
        }

        if (outputFields.length > 0) {
          return `{\n  ${outputFields.join(',\n  ')}\n}`;
        }
      }

      return 'Complex schema - see usage example for structure';
    } catch {
      return 'Unable to parse output schema';
    }
  }

  private generateTypeInfo(
    zodType: z.ZodTypeAny,
    includeNestedDescriptions = false
  ): string | null {
    const def = zodType._def;

    if (def.typeName === 'ZodString') {
      return 'string';
    } else if (def.typeName === 'ZodNumber') {
      return 'number';
    } else if (def.typeName === 'ZodBoolean') {
      return 'boolean';
    } else if (def.typeName === 'ZodArray') {
      const elementType = def.type;
      if (elementType) {
        const elementTypeInfo = this.generateTypeInfo(
          elementType,
          includeNestedDescriptions
        );
        if (elementTypeInfo) {
          return `${elementTypeInfo}[]`;
        }
      }
      return 'unknown[]';
    } else if (def.typeName === 'ZodObject') {
      if ('shape' in zodType) {
        const shape = (zodType as z.ZodObject<z.ZodRawShape>).shape;
        const properties: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          if (this.isCredentialKey(key)) continue; // Skip credentials in nested objects

          if (value && typeof value === 'object' && '_def' in value) {
            const zodValue = value as z.ZodTypeAny;
            const typeInfo = this.generateTypeInfo(
              zodValue,
              includeNestedDescriptions
            );

            if (typeInfo) {
              let propertyLine = `${key}: ${typeInfo}`;

              // Include descriptions for nested properties if flag is set
              if (includeNestedDescriptions) {
                const description = this.getParameterDescription(zodValue);
                if (description) {
                  propertyLine += ` // ${description}`;
                }
              }

              properties.push(propertyLine);
            }
          }
        }

        if (properties.length > 0) {
          return `{ ${properties.join(', ')} }`;
        }
      }
      return 'object';
    } else if (def.typeName === 'ZodOptional') {
      const innerType = this.generateTypeInfo(
        def.innerType,
        includeNestedDescriptions
      );
      return innerType ? `${innerType} | undefined` : 'unknown | undefined';
    } else if (def.typeName === 'ZodNullable') {
      const innerType = this.generateTypeInfo(
        def.innerType,
        includeNestedDescriptions
      );
      return innerType ? `${innerType} | null` : 'unknown | null';
    } else if (def.typeName === 'ZodDefault') {
      return this.generateTypeInfo(def.innerType, includeNestedDescriptions);
    } else if (def.typeName === 'ZodEnum') {
      const enumValues = def.values as string[];
      return enumValues.map((v) => `"${v}"`).join(' | ');
    } else if (def.typeName === 'ZodLiteral') {
      return typeof def.value === 'string'
        ? `"${def.value}"`
        : String(def.value);
    } else if (def.typeName === 'ZodRecord') {
      const valueType = def.valueType;
      if (valueType) {
        const valueTypeInfo = this.generateTypeInfo(
          valueType,
          includeNestedDescriptions
        );
        if (valueTypeInfo) {
          return `Record<string, ${valueTypeInfo}>`;
        }
      }
      return 'Record<string, unknown>';
    } else if (def.typeName === 'ZodDiscriminatedUnion') {
      // Expand discriminated union to show all possible options
      const options = def.options as z.ZodTypeAny[];

      if (options.length === 0) {
        return 'DiscriminatedUnion';
      }

      // Generate type info for each option
      const optionTypes: string[] = [];
      for (const option of options) {
        if (option && typeof option === 'object' && 'shape' in option) {
          const shape = (option as z.ZodObject<z.ZodRawShape>).shape;
          const properties: string[] = [];

          for (const [key, value] of Object.entries(shape)) {
            if (this.isCredentialKey(key)) continue;

            if (value && typeof value === 'object' && '_def' in value) {
              const zodValue = value as z.ZodTypeAny;
              const typeInfo = this.generateTypeInfo(
                zodValue,
                includeNestedDescriptions
              );

              if (typeInfo) {
                let propertyLine = `${key}: ${typeInfo}`;

                // Include descriptions for nested properties if flag is set
                if (includeNestedDescriptions) {
                  const description = this.getParameterDescription(zodValue);
                  if (description) {
                    propertyLine += ` // ${description}`;
                  }
                }

                properties.push(propertyLine);
              }
            }
          }

          if (properties.length > 0) {
            optionTypes.push(`{ ${properties.join(', ')} }`);
          }
        }
      }

      if (optionTypes.length > 0) {
        // Show all discriminated union options
        return optionTypes.join(' | ');
      }

      return 'DiscriminatedUnion';
    }

    return 'unknown';
  }

  private generateUsageExample(metadata: {
    name: string;
    className: string;
    schema: unknown;
    resultSchema?: unknown;
  }): string {
    const lines: string[] = [];

    // Check if this is a discriminated union (multiple operations)
    const isDiscriminatedUnion = this.isDiscriminatedUnion(metadata.schema);

    if (isDiscriminatedUnion) {
      // Generate separate examples for each operation
      const operationExamples = this.generateOperationExamples(metadata);
      if (operationExamples.length > 0) {
        lines.push(...operationExamples);
      } else {
        // Fallback to original format if operation parsing fails
        lines.push(...this.generateSingleExample(metadata));
      }
    } else {
      // Generate single example for non-discriminated schemas
      lines.push(...this.generateSingleExample(metadata));
    }

    return lines.join('\n');
  }

  private isDiscriminatedUnion(schema: unknown): boolean {
    if (schema && typeof schema === 'object' && '_def' in schema) {
      const zodSchema = schema as z.ZodTypeAny;
      return zodSchema._def.typeName === 'ZodDiscriminatedUnion';
    }
    return false;
  }

  private generateOperationExamples(metadata: {
    name: string;
    className: string;
    schema: unknown;
    resultSchema?: unknown;
  }): string[] {
    const lines: string[] = [];

    if (
      metadata.schema &&
      typeof metadata.schema === 'object' &&
      '_def' in metadata.schema
    ) {
      const zodSchema = metadata.schema as z.ZodTypeAny;
      const def = zodSchema._def;

      if (def.typeName === 'ZodDiscriminatedUnion') {
        const options = def.options as z.ZodTypeAny[];
        const discriminatorKey = def.discriminator;
        // Limit to first 4 operations to avoid overwhelming output

        options.forEach((option, index) => {
          if (option && typeof option === 'object' && 'shape' in option) {
            const shape = (option as z.ZodObject<z.ZodRawShape>).shape;

            // Get the operation name from discriminator
            const discriminatorValue = shape[discriminatorKey];
            if (
              discriminatorValue &&
              typeof discriminatorValue === 'object' &&
              '_def' in discriminatorValue
            ) {
              const literalDef = discriminatorValue._def;
              if (literalDef.typeName === 'ZodLiteral') {
                const operationName = literalDef.value;

                // Add spacing between operations
                if (index > 0) {
                  lines.push('');
                }

                // Add operation-specific comment
                const operationComment =
                  this.formatOperationComment(operationName);
                lines.push(`// ${operationComment}`);

                // Create variable name with operation suffix
                const variableName = `${this.toCamelCase(metadata.name)}_${operationName.replace(/[^a-zA-Z0-9]/g, '_')}`;

                lines.push(
                  `const ${variableName} = new ${metadata.className}({`
                );

                // Generate parameters for this specific operation
                const operationParams: string[] = [];
                Object.entries(shape).forEach(([key, value]) => {
                  if (this.isCredentialKey(key)) return; // Skip credentials

                  if (value && typeof value === 'object' && '_def' in value) {
                    const zodType = value as z.ZodTypeAny;
                    const example = this.generateExampleValue(zodType);
                    const description = this.getParameterDescription(zodType);
                    if (example !== null) {
                      const paramLine = `  ${key}: ${example}`;
                      if (description) {
                        operationParams.push(`${paramLine}, // ${description}`);
                      } else {
                        operationParams.push(`${paramLine},`);
                      }
                    }
                  }
                });

                if (operationParams.length > 0) {
                  lines.push(...operationParams);
                } else {
                  lines.push('  // Add required parameters here');
                }

                lines.push('});');
                lines.push('');
                lines.push(`const result = await ${variableName}.action();`);
                // Inline output schema for this specific operation
                if (metadata.resultSchema) {
                  const optionSchema = this.getResultSchemaOption(
                    metadata.resultSchema,
                    String(operationName)
                  );
                  if (optionSchema) {
                    const outputSchemaStr =
                      this.generateOutputSchemaString(optionSchema);
                    if (outputSchemaStr) {
                      lines.push(
                        `// outputSchema for result.data when operation === '${String(operationName)}':`
                      );
                      outputSchemaStr
                        .split('\n')
                        .forEach((l) => lines.push(`// ${l}`));
                      lines.push('');
                    }
                  }
                }
              }
            }
          }
        });

        // Add common result handling code once at the end
        if (lines.length > 0) {
          lines.push('');
          lines.push('// Always check success status before using data');
          lines.push('if (!result.success) {');
          lines.push(
            `  throw new Error(\`${metadata.name} failed: \${result.error}\`);`
          );
          lines.push('}');
          lines.push('');

          // Output schema per operation is shown inline above.

          lines.push('// Access the actual data');
          lines.push('const actualData = result.data;');
          lines.push('console.log(actualData);');
        }
      }
    }

    return lines;
  }

  private generateSingleExample(metadata: {
    name: string;
    className: string;
    schema: unknown;
    resultSchema?: unknown;
  }): string[] {
    const lines: string[] = [];
    lines.push(`// Example usage of ${metadata.name} bubble`);

    // Try to extract example parameters from schema
    const exampleParams = this.generateExampleParams(metadata.schema);

    lines.push(
      `const ${this.toCamelCase(metadata.name)} = new ${metadata.className}({`
    );

    if (exampleParams.length > 0) {
      lines.push(...exampleParams.map((param) => `  ${param},`));
    } else {
      lines.push('  // Add required parameters here');
    }

    lines.push('});');
    lines.push('');
    lines.push(
      `const result = await ${this.toCamelCase(metadata.name)}.action();`
    );
    lines.push('');
    lines.push('// Always check success status before using data');
    lines.push('if (!result.success) {');
    lines.push(
      '  throw new Error(`${metadata.name} failed: ${result.error}`);'
    );
    lines.push('}');
    lines.push('');

    // Add output schema information
    if (metadata.resultSchema) {
      // If the result is a discriminated union, show the first option
      const optionSchema = this.getFirstResultSchemaOption(
        metadata.resultSchema
      );
      const schemaToRender = optionSchema ?? metadata.resultSchema;
      const outputSchemaStr = this.generateOutputSchemaString(schemaToRender);
      if (outputSchemaStr && outputSchemaStr !== 'No output schema defined') {
        lines.push('// outputSchema for result.data:');
        outputSchemaStr.split('\n').forEach((l) => lines.push(`// ${l}`));
        lines.push('');
      }
    }

    lines.push('// Access the actual data');
    lines.push('const actualData = result.data;');
    lines.push('console.log(actualData);');

    return lines;
  }

  private formatOperationComment(operationName: string): string {
    // Convert operation name to readable format
    return (
      operationName
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' example'
    );
  }

  // generateOutputExample was removed in favor of generateOutputSchemaString with per-operation rendering

  private getResultSchemaOption(
    resultSchema: unknown,
    operationName: string
  ): z.ZodTypeAny | null {
    try {
      if (
        resultSchema &&
        typeof resultSchema === 'object' &&
        '_def' in resultSchema
      ) {
        const zodSchema = resultSchema as z.ZodTypeAny;
        const def = zodSchema._def;
        if (def.typeName === 'ZodDiscriminatedUnion') {
          const options = def.options as z.ZodTypeAny[];
          for (const option of options) {
            if (option && typeof option === 'object' && 'shape' in option) {
              const shape = (option as z.ZodObject<z.ZodRawShape>).shape;
              const discriminatorValue = shape[def.discriminator];
              if (
                discriminatorValue &&
                typeof discriminatorValue === 'object' &&
                '_def' in discriminatorValue &&
                discriminatorValue._def.typeName === 'ZodLiteral' &&
                String(discriminatorValue._def.value) === operationName
              ) {
                return option;
              }
            }
          }
        } else if ('shape' in zodSchema) {
          return zodSchema;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private getFirstResultSchemaOption(
    resultSchema: unknown
  ): z.ZodTypeAny | null {
    try {
      if (
        resultSchema &&
        typeof resultSchema === 'object' &&
        '_def' in resultSchema
      ) {
        const zodSchema = resultSchema as z.ZodTypeAny;
        const def = zodSchema._def;
        if (def.typeName === 'ZodDiscriminatedUnion') {
          const options = def.options as z.ZodTypeAny[];
          return options?.[0] ?? null;
        } else if ('shape' in zodSchema) {
          return zodSchema;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts the description from a Zod schema type
   */
  private getParameterDescription(zodType: z.ZodTypeAny): string | null {
    try {
      const def = zodType._def;

      // Check if the schema has a description
      if (def.description) {
        return def.description;
      }

      // For optional types, check the inner type
      if (def.typeName === 'ZodOptional' && def.innerType) {
        return this.getParameterDescription(def.innerType);
      }

      // For default types, check the inner type
      if (def.typeName === 'ZodDefault' && def.innerType) {
        return this.getParameterDescription(def.innerType);
      }

      return null;
    } catch {
      return null;
    }
  }

  private generateExampleParams(schema: unknown): string[] {
    const params: string[] = [];

    if (schema && typeof schema === 'object' && '_def' in schema) {
      const zodSchema = schema as z.ZodTypeAny;
      const def = zodSchema._def;

      // Handle discriminated unions
      if (def.typeName === 'ZodDiscriminatedUnion') {
        // For discriminated unions, show examples for all operations
        const options = def.options as z.ZodTypeAny[];
        const discriminatorKey = def.discriminator;

        options.forEach((option, index) => {
          if (option && typeof option === 'object' && 'shape' in option) {
            const shape = (option as z.ZodObject<z.ZodRawShape>).shape;

            // Get the discriminator value for this option
            const discriminatorValue = shape[discriminatorKey];
            if (
              discriminatorValue &&
              typeof discriminatorValue === 'object' &&
              '_def' in discriminatorValue
            ) {
              const literalDef = discriminatorValue._def;
              if (literalDef.typeName === 'ZodLiteral') {
                const operationName = literalDef.value;

                // Add operation header
                if (index > 0) params.push(''); // Add spacing between operations
                params.push(`// Operation: ${operationName}`);

                // Add parameters for this operation
                Object.entries(shape).forEach(([key, value]) => {
                  if (this.isCredentialKey(key) || key === discriminatorKey)
                    return; // Skip credentials and discriminator

                  if (value && typeof value === 'object' && '_def' in value) {
                    const zodType = value as z.ZodTypeAny;
                    const example = this.generateExampleValue(zodType);
                    const description = this.getParameterDescription(zodType);
                    if (example !== null) {
                      const paramLine = `  ${key}: ${example}`;
                      if (description) {
                        params.push(`${paramLine}, // ${description}`);
                      } else {
                        params.push(`${paramLine},`);
                      }
                    }
                  }
                });
              }
            }
          }
        });
      }
      // Handle regular objects
      else if ('shape' in schema) {
        const zodSchema = schema as z.ZodObject<z.ZodRawShape>;
        const shape = zodSchema.shape;

        Object.entries(shape).forEach(([key, value]) => {
          if (this.isCredentialKey(key)) return; // Skip credentials in examples

          if (value && typeof value === 'object' && '_def' in value) {
            const zodType = value as z.ZodTypeAny;
            const example = this.generateExampleValue(zodType);
            const description = this.getParameterDescription(zodType);
            if (example !== null) {
              const paramLine = `${key}: ${example}`;
              if (description) {
                params.push(`${paramLine}, // ${description}`);
              } else {
                params.push(`${paramLine},`);
              }
            }
          }
        });
      }
    }

    return params;
  }

  private generateExampleValue(zodType: z.ZodTypeAny): string | null {
    const def = zodType._def;

    if (def.typeName === 'ZodString') {
      return '"example string"';
    } else if (def.typeName === 'ZodNumber') {
      return '42';
    } else if (def.typeName === 'ZodBoolean') {
      return 'true';
    } else if (def.typeName === 'ZodArray') {
      // Generate example for array element type
      const elementType = def.type;
      if (elementType) {
        const elementExample = this.generateExampleValue(elementType);
        if (elementExample) {
          return `[${elementExample}]`;
        }
      }
      return '[]';
    } else if (def.typeName === 'ZodObject') {
      // Generate example object with its properties
      if ('shape' in zodType) {
        const shape = (zodType as z.ZodObject<z.ZodRawShape>).shape;
        const properties: string[] = [];

        // Limit properties to avoid too verbose examples
        let count = 0;

        for (const [key, value] of Object.entries(shape)) {
          if (this.isCredentialKey(key)) continue; // Skip credentials in nested objects

          if (value && typeof value === 'object' && '_def' in value) {
            const zodValue = value as z.ZodTypeAny;
            const exampleValue = this.generateExampleValue(zodValue);
            const description = this.getParameterDescription(zodValue);

            if (exampleValue !== null) {
              let propertyLine = `${key}: ${exampleValue}`;
              if (description) {
                propertyLine += ` // ${description}`;
              }
              properties.push(propertyLine);
              count++;
            }
          }
        }

        if (properties.length > 0) {
          return `{ ${properties.join(', ')} }`;
        }
      }
      return '{}';
    } else if (def.typeName === 'ZodOptional') {
      return this.generateExampleValue(def.innerType);
    } else if (def.typeName === 'ZodNullable') {
      return this.generateExampleValue(def.innerType);
    } else if (def.typeName === 'ZodDefault') {
      // For defaults, show the example structure of the inner type if it's complex, otherwise show default
      const innerExample = this.generateExampleValue(def.innerType);
      const defaultValue = def.defaultValue();

      // If the default is an empty array but the inner type is complex, show example
      if (
        Array.isArray(defaultValue) &&
        defaultValue.length === 0 &&
        innerExample &&
        innerExample !== '[]'
      ) {
        return `${innerExample} // example for array`;
      }

      // If the default is a complex object and we have a meaningful inner example, show structure
      if (
        typeof defaultValue === 'object' &&
        defaultValue !== null &&
        !Array.isArray(defaultValue) &&
        innerExample &&
        innerExample !== '{}' &&
        innerExample.includes(':') // Has properties
      ) {
        return `${innerExample} // structure`;
      }

      // If the inner type is an enum with multiple options, show the enum options instead of just default
      if (
        def.innerType &&
        def.innerType._def &&
        def.innerType._def.typeName === 'ZodEnum'
      ) {
        return innerExample; // This will include the enum options
      }

      // If the inner type is ZodOptional containing an enum, drill down further
      if (
        def.innerType &&
        def.innerType._def &&
        def.innerType._def.typeName === 'ZodOptional'
      ) {
        const optionalInner = def.innerType._def.innerType;
        if (
          optionalInner &&
          optionalInner._def &&
          optionalInner._def.typeName === 'ZodEnum'
        ) {
          return this.generateExampleValue(optionalInner); // Generate example for the enum
        }
      }

      return `${JSON.stringify(defaultValue)} // default`;
    } else if (def.typeName === 'ZodEnum') {
      // Show all enum options, not just the first one
      const enumValues = def.values as string[];
      if (enumValues.length > 1) {
        // Show first value as primary with all options listed
        return `"${enumValues[0]}" // options: ${enumValues.map((v) => `"${v}"`).join(', ')}`;
      }
      return `"${enumValues[0]}"`;
    } else if (def.typeName === 'ZodUnion') {
      // For unions, try to find the most descriptive option
      const options = def.options as z.ZodTypeAny[];
      if (options.length === 0) {
        return null;
      }

      // Prefer objects, then arrays, then other complex types over primitives
      const optionPriority = (option: z.ZodTypeAny): number => {
        const optionDef = option._def;
        if (optionDef.typeName === 'ZodObject') return 4;
        if (optionDef.typeName === 'ZodArray') return 3;
        if (optionDef.typeName === 'ZodAny') return 2; // z.any() can represent schemas
        if (optionDef.typeName === 'ZodString') return 1;
        return 0;
      };

      // Sort options by priority (highest first)
      const sortedOptions = [...options].sort(
        (a, b) => optionPriority(b) - optionPriority(a)
      );

      // Try each option in priority order
      for (const option of sortedOptions) {
        const example = this.generateExampleValue(option);
        if (example !== null) {
          // For z.any(), show a simple schema example
          if (option._def.typeName === 'ZodAny') {
            return `z.object({ result: z.array(z.object({ trend: z.string().describe('An array of trends') })) }) // Zod schema object or JSON schema string`;
          }
          // For other types, just show the example without internal Zod type names
          return example;
        }
      }

      // Fallback: show first option as string representation
      return `"example" // union type`;
    } else if (def.typeName === 'ZodDiscriminatedUnion') {
      // For discriminated unions, generate a proper example object from the first option
      const options = def.options as z.ZodTypeAny[];
      if (options.length > 0) {
        const firstOption = options[0];
        if (
          firstOption &&
          typeof firstOption === 'object' &&
          '_def' in firstOption &&
          'shape' in firstOption
        ) {
          const firstOptionDef = firstOption._def;
          if (firstOptionDef.typeName === 'ZodObject') {
            const shape = (firstOption as z.ZodObject<z.ZodRawShape>).shape;
            const properties: string[] = [];

            for (const [key, value] of Object.entries(shape)) {
              if (this.isCredentialKey(key)) continue; // Skip credentials

              if (value && typeof value === 'object' && '_def' in value) {
                const zodValue = value as z.ZodTypeAny;
                const exampleValue = this.generateExampleValue(zodValue);
                if (exampleValue !== null) {
                  properties.push(`${key}: ${exampleValue}`);
                }
              }
            }

            if (properties.length > 0) {
              return `{ ${properties.join(', ')} }`;
            }
          }
        }
      }
      return '"first_option" // discriminated union';
    } else if (def.typeName === 'ZodLiteral') {
      return JSON.stringify(def.value);
    } else if (def.typeName === 'ZodRecord') {
      // For records, check if value type is a discriminated union
      const valueType = def.valueType;
      if (
        valueType &&
        valueType._def &&
        valueType._def.typeName === 'ZodDiscriminatedUnion'
      ) {
        // For discriminated unions, show the type structure instead of multiple examples
        const typeInfo = this.generateTypeInfo(valueType, true);
        if (typeInfo) {
          return `{ "PUT_PROPERTY_TYPE_HERE": ${typeInfo} }`;
        }
      } else if (valueType) {
        // For non-discriminated union records, show single example
        const valueExample = this.generateExampleValue(valueType);
        if (valueExample) {
          return `{ "example_key": ${valueExample} }`;
        }
      }
      return '{}';
    }

    return null;
  }

  /**
   * Checks if a key represents a credential parameter that should be omitted from examples
   */
  private isCredentialKey(key: string): boolean {
    // Check for exact match or case-insensitive variations
    const lowerKey = key.toLowerCase();
    return lowerKey === 'credentials' || lowerKey === 'credential';
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }
}
