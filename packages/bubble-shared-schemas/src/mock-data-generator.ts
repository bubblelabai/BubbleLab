import { z } from 'zod';

/**
 * Generate a UUID v4 compatible with both Node.js and browser environments
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Base interface that all bubble operation results must extend, at individual bubble level
export interface BubbleOperationResult {
  success: boolean;
  error: string;
}

// Final bubble execution result
export interface BubbleResult<T> extends BubbleOperationResult {
  data: T;
  executionId: string;
  timestamp: Date;
}

/**
 * Utility class for generating mock data from Zod schemas
 * Useful for testing, development, and creating sample data
 */
export class MockDataGenerator {
  /**
   * Generate a complete mock BubbleResult from a result schema
   */
  static generateMockResult<TResult extends BubbleOperationResult>(
    resultSchema: z.ZodObject<z.ZodRawShape>
  ): BubbleResult<TResult> {
    const mockData = this.generateMockFromSchema(resultSchema);

    return {
      success: true,
      data: mockData as TResult,
      executionId: generateUUID(),
      error: '',
      timestamp: new Date(),
    };
  }

  /**
   * Generate mock data from JSON Schema
   * Converts JSON Schema to mock data with realistic values
   */
  static generateMockFromJsonSchema(
    jsonSchema: Record<string, unknown>
  ): Record<string, unknown> {
    const mockData: Record<string, unknown> = {};

    if (!jsonSchema || typeof jsonSchema !== 'object') {
      return mockData;
    }

    // Handle object type with properties
    if (jsonSchema.type === 'object' && jsonSchema.properties) {
      const properties = jsonSchema.properties as Record<string, unknown>;

      for (const [key, propertySchema] of Object.entries(properties)) {
        if (propertySchema && typeof propertySchema === 'object') {
          const value = this.generateMockValueFromJsonSchema(
            propertySchema as Record<string, unknown>
          );
          if (value !== undefined) {
            mockData[key] = value;
          }
        }
      }
    }

    return mockData;
  }

  /**
   * Generate a mock value for a specific JSON Schema property
   */
  static generateMockValueFromJsonSchema(
    schema: Record<string, unknown>
  ): unknown {
    const type = schema.type as string;

    switch (type) {
      case 'string': {
        if (schema.enum && Array.isArray(schema.enum)) {
          return schema.enum[Math.floor(Math.random() * schema.enum.length)];
        }
        if (schema.format === 'email') {
          return 'test@example.com';
        }
        if (schema.format === 'date-time') {
          return new Date().toISOString();
        }
        if (schema.format === 'uuid') {
          return generateUUID();
        }
        const minLength =
          typeof schema.minLength === 'number' ? schema.minLength : 1;
        const maxLength =
          typeof schema.maxLength === 'number' ? schema.maxLength : 10;
        const length =
          Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        return (
          'sample_' +
          Math.random()
            .toString(36)
            .substring(2, 2 + length)
        );
      }

      case 'number':
      case 'integer': {
        const min = typeof schema.minimum === 'number' ? schema.minimum : 0;
        const max = typeof schema.maximum === 'number' ? schema.maximum : 100;
        const value = Math.random() * (max - min) + min;
        return type === 'integer'
          ? Math.floor(value)
          : Math.round(value * 100) / 100;
      }

      case 'boolean': {
        return Math.random() > 0.5;
      }

      case 'array': {
        const items = schema.items as Record<string, unknown>;
        if (items) {
          const minItems =
            typeof schema.minItems === 'number' ? schema.minItems : 1;
          const maxItems =
            typeof schema.maxItems === 'number' ? schema.maxItems : 3;
          const length =
            Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

          return Array.from({ length }, () =>
            this.generateMockValueFromJsonSchema(items)
          );
        }
        return [];
      }

      case 'object': {
        return this.generateMockFromJsonSchema(schema);
      }

      default: {
        return null;
      }
    }
  }

  /**
   * Generate mock data object from a Zod schema
   * Recursively handles nested objects, arrays, and primitive types
   */
  static generateMockFromSchema(
    schema: z.ZodObject<z.ZodRawShape>
  ): Record<string, unknown> {
    const mockData: Record<string, unknown> = {};

    if (!schema || typeof schema !== 'object' || !('shape' in schema)) {
      return mockData;
    }

    const shape = schema.shape;

    for (const [key, zodType] of Object.entries(shape)) {
      if (key === 'success' || key === 'error') {
        // Skip these as they're handled by the wrapper
        continue;
      }

      if (zodType && typeof zodType === 'object' && '_def' in zodType) {
        const value = this.generateMockValue(zodType as z.ZodTypeAny);
        if (value !== undefined) {
          mockData[key] = value;
        }
      }
    }

    return mockData;
  }

  /**
   * Generate a mock value for a specific Zod type
   */
  static generateMockValue(zodType: z.ZodTypeAny): unknown {
    const def = zodType._def;

    switch (def.typeName) {
      case 'ZodString': {
        return this.generateMockString(def);
      }

      case 'ZodNumber': {
        return this.generateMockNumber(def);
      }

      case 'ZodBoolean': {
        return Math.random() > 0.5;
      }

      case 'ZodDate': {
        return new Date();
      }

      case 'ZodArray': {
        const elementType = def.type;
        if (elementType) {
          const arrayLength = Math.floor(Math.random() * 3) + 1; // 1-3 elements
          return Array.from({ length: arrayLength }, () =>
            this.generateMockValue(elementType)
          );
        }
        return [];
      }

      case 'ZodObject': {
        if ('shape' in zodType) {
          const nestedMock: Record<string, unknown> = {};
          const shape = (zodType as z.ZodObject<z.ZodRawShape>).shape;

          for (const [key, value] of Object.entries(shape)) {
            if (value && typeof value === 'object' && '_def' in value) {
              const nestedValue = this.generateMockValue(value as z.ZodTypeAny);
              if (nestedValue !== undefined) {
                nestedMock[key] = nestedValue;
              }
            }
          }

          return nestedMock;
        }
        return {};
      }

      case 'ZodOptional': {
        // 70% chance to include optional fields
        if (Math.random() > 0.3) {
          return this.generateMockValue(def.innerType);
        }
        return undefined;
      }

      case 'ZodDefault': {
        // 50% chance to use default, 50% to generate mock value
        if (Math.random() > 0.5) {
          return def.defaultValue();
        }
        return this.generateMockValue(def.innerType);
      }

      case 'ZodEnum': {
        const values = def.values as readonly unknown[];
        return values[Math.floor(Math.random() * values.length)];
      }

      case 'ZodLiteral': {
        return def.value;
      }

      case 'ZodUnion': {
        const options = def.options as z.ZodTypeAny[];
        const randomOption =
          options[Math.floor(Math.random() * options.length)];
        return this.generateMockValue(randomOption);
      }

      case 'ZodDiscriminatedUnion': {
        const discriminatedOptions = def.options as z.ZodTypeAny[];
        const randomDiscriminatedOption =
          discriminatedOptions[
            Math.floor(Math.random() * discriminatedOptions.length)
          ];
        return this.generateMockValue(randomDiscriminatedOption);
      }

      case 'ZodRecord': {
        const recordMock: Record<string, unknown> = {};
        const numKeys = Math.floor(Math.random() * 3) + 1; // 1-3 keys

        for (let i = 0; i < numKeys; i++) {
          const key = `key${i + 1}`;
          const value = this.generateMockValue(def.valueType);
          if (value !== undefined) {
            recordMock[key] = value;
          }
        }

        return recordMock;
      }

      case 'ZodNullable': {
        // 80% chance to have value, 20% chance to be null
        if (Math.random() > 0.2) {
          return this.generateMockValue(def.innerType);
        }
        return null;
      }

      default: {
        // For unknown types, return a generic value
        console.warn(`Unknown Zod type for mock generation: ${def.typeName}`);
        return `mock_${def.typeName}`;
      }
    }
  }

  /**
   * Generate mock string values with format-specific handling
   */
  private static generateMockString(def: Record<string, unknown>): string {
    if (def.checks) {
      for (const check of def.checks as Array<Record<string, unknown>>) {
        switch (check.kind) {
          case 'email': {
            return 'test@example.com';
          }
          case 'url': {
            return 'https://example.com';
          }
          case 'uuid': {
            return generateUUID();
          }
          case 'regex': {
            // For regex patterns, try to generate simple matching strings
            const pattern = check.regex as RegExp;
            if (pattern.source.includes('\\d+')) {
              return '12345';
            }
            if (pattern.source.includes('[a-z]')) {
              return 'abcde';
            }
            return 'mock_regex_match';
          }
          case 'min': {
            return 'a'.repeat(check.value as number);
          }
          case 'max': {
            return 'mock'.substring(0, check.value as number);
          }
        }
      }
    }
    return 'mock string';
  }

  /**
   * Generate mock number values respecting constraints
   */
  private static generateMockNumber(def: Record<string, unknown>): number {
    let min = 0;
    let max = 100;
    let isInt = false;

    if (def.checks) {
      for (const check of def.checks as Array<Record<string, unknown>>) {
        switch (check.kind) {
          case 'min': {
            min = check.value as number;
            break;
          }
          case 'max': {
            max = check.value as number;
            break;
          }
          case 'int': {
            isInt = true;
            break;
          }
        }
      }
    }

    const value = Math.random() * (max - min) + min;
    return isInt ? Math.floor(value) : Math.round(value * 100) / 100;
  }

  /**
   * Generate mock data with custom seed for reproducible results
   */
  static generateMockWithSeed<TResult extends BubbleOperationResult>(
    resultSchema: z.ZodObject<z.ZodRawShape>,
    seed: number
  ): BubbleResult<TResult> {
    // Simple seeded random number generator
    let currentSeed = seed;
    const seededRandom = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };

    // Temporarily override Math.random
    const originalRandom = Math.random;
    Math.random = seededRandom;

    try {
      const mockData = this.generateMockFromSchema(resultSchema);

      // Generate executionId using crypto (not affected by seeded random)
      // to ensure execution IDs are always unique even with the same seed
      const executionId = generateUUID();

      return {
        success: true,
        data: mockData as TResult,
        executionId,
        error: '',
        timestamp: new Date(),
      };
    } finally {
      // Restore original Math.random
      Math.random = originalRandom;
    }
  }
}
