import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { MockDataGenerator } from './mock-data-generator.js';

describe('MockDataGenerator', () => {
  describe('generateMockValue', () => {
    test('should generate mock string values', () => {
      const stringSchema = z.string();
      const result = MockDataGenerator.generateMockValue(stringSchema);
      expect(typeof result).toBe('string');
      expect(result).toBe('mock string');
    });

    test('should generate mock email values', () => {
      const emailSchema = z.string().email();
      const result = MockDataGenerator.generateMockValue(emailSchema);
      expect(typeof result).toBe('string');
      expect(result).toBe('test@example.com');
    });

    test('should generate mock URL values', () => {
      const urlSchema = z.string().url();
      const result = MockDataGenerator.generateMockValue(urlSchema);
      expect(typeof result).toBe('string');
      expect(result).toBe('https://example.com');
    });

    test('should generate mock UUID values', () => {
      const uuidSchema = z.string().uuid();
      const result = MockDataGenerator.generateMockValue(uuidSchema);
      expect(typeof result).toBe('string');
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('should generate mock number values', () => {
      const numberSchema = z.number();
      const result = MockDataGenerator.generateMockValue(numberSchema);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    test('should generate mock boolean values', () => {
      const booleanSchema = z.boolean();
      const result = MockDataGenerator.generateMockValue(booleanSchema);
      expect(typeof result).toBe('boolean');
    });

    test('should generate mock array values', () => {
      const arraySchema = z.array(z.string());
      const result = MockDataGenerator.generateMockValue(arraySchema);
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBeGreaterThan(0);
      expect(
        (result as unknown[]).every((item) => typeof item === 'string')
      ).toBe(true);
    });

    test('should generate mock object values', () => {
      const objectSchema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean(),
      });
      const result = MockDataGenerator.generateMockValue(objectSchema);
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('age');
      expect(result).toHaveProperty('isActive');
      expect(typeof (result as any).name).toBe('string');
      expect(typeof (result as any).age).toBe('number');
      expect(typeof (result as any).isActive).toBe('boolean');
    });

    test('should handle optional fields', () => {
      const optionalSchema = z.string().optional();
      const result = MockDataGenerator.generateMockValue(optionalSchema);
      expect(result === undefined || typeof result === 'string').toBe(true);
    });

    test('should handle enum values', () => {
      const enumSchema = z.enum(['option1', 'option2', 'option3']);
      const result = MockDataGenerator.generateMockValue(enumSchema);
      expect(['option1', 'option2', 'option3']).toContain(result);
    });

    test('should handle literal values', () => {
      const literalSchema = z.literal('exact_value');
      const result = MockDataGenerator.generateMockValue(literalSchema);
      expect(result).toBe('exact_value');
    });
  });

  describe('generateMockFromSchema', () => {
    test('should generate mock data from complex schema', () => {
      const complexSchema = z.object({
        id: z.string().uuid(),
        user: z.object({
          name: z.string(),
          email: z.string().email(),
          age: z.number().min(18).max(100),
        }),
        tags: z.array(z.string()),
        isActive: z.boolean(),
        metadata: z.record(z.string()),
        success: z.boolean(), // Should be skipped
        error: z.string(), // Should be skipped
      });

      const result = MockDataGenerator.generateMockFromSchema(complexSchema);

      // Verify structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('metadata');

      // Should not include success/error as they're skipped
      expect(result).not.toHaveProperty('success');
      expect(result).not.toHaveProperty('error');

      // Verify types
      expect(typeof result.id).toBe('string');
      expect(typeof result.user).toBe('object');
      expect(Array.isArray(result.tags)).toBe(true);
      expect(typeof result.isActive).toBe('boolean');
      expect(typeof result.metadata).toBe('object');

      // Verify nested user object
      const user = result.user as any;
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('age');
      expect(typeof user.name).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(typeof user.age).toBe('number');
      expect(user.age).toBeGreaterThanOrEqual(18);
      expect(user.age).toBeLessThanOrEqual(100);
    });
  });

  describe('generateMockResult', () => {
    test('should generate complete BubbleResult', () => {
      const resultSchema = z.object({
        greeting: z.string(),
        count: z.number(),
        success: z.boolean(),
        error: z.string(),
      });

      const result = MockDataGenerator.generateMockResult(resultSchema);

      // Verify BubbleResult structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('timestamp');

      expect(result.success).toBe(true);
      expect(typeof result.executionId).toBe('string');
      expect(result.error).toBe('');
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify data structure
      const data = result.data as any;
      expect(data).toHaveProperty('greeting');
      expect(data).toHaveProperty('count');
      expect(typeof data.greeting).toBe('string');
      expect(typeof data.count).toBe('number');
    });
  });

  describe('generateMockWithSeed', () => {
    test('should generate reproducible results with same seed', () => {
      const resultSchema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const result1 = MockDataGenerator.generateMockWithSeed(
        resultSchema,
        12345
      );
      const result2 = MockDataGenerator.generateMockWithSeed(
        resultSchema,
        12345
      );

      expect(result1.data).toEqual(result2.data);
    });

    test('should generate different results with different seeds', () => {
      const resultSchema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const result1 = MockDataGenerator.generateMockWithSeed(
        resultSchema,
        12345
      );
      const result2 = MockDataGenerator.generateMockWithSeed(
        resultSchema,
        54321
      );

      // Results should have same structure but different values
      expect(result1.data).not.toEqual(result2.data);
      expect(typeof (result1.data as any).name).toBe('string');
      expect(typeof (result1.data as any).value).toBe('number');
      expect(typeof (result2.data as any).name).toBe('string');
      expect(typeof (result2.data as any).value).toBe('number');
    });
  });
});
