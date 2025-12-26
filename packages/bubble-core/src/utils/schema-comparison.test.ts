import { describe, it, expect } from 'vitest';
import { compareMultipleWithSchema } from './schema-comparison.js';
import { z } from 'zod';

describe('schema comparison', () => {
  it('should find missing required fields against a schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const data = [
      {
        names: 'John',
        age: 30,
      },
    ];
    const result = compareMultipleWithSchema(schema, data);
    expect(result).toBeDefined();
    expect(result.allMissingRequired.length).toBe(1);
    expect(result.allMissingRequired).toContainEqual({
      fieldName: 'name',
      index: 0,
    });
  });

  it('should find missing optional fields against a schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const data = [
      {
        name: 'John',
      },
    ];
    const result = compareMultipleWithSchema(schema, data);
    expect(result).toBeDefined();
    expect(result.allMissingRequired.length).toBe(0);
    expect(result.allMissingOptional.length).toBe(1);
    expect(result.allMissingOptional).toContainEqual({
      fieldName: 'age',
      index: 0,
    });
  });

  it('should find missing fields in multiple data items against a schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const data = [
      {
        name: 'John',
      },
      {
        age: 30,
      },
    ];
    const result = compareMultipleWithSchema(schema, data);
    expect(result).toBeDefined();
    expect(result.allMissingRequired).toContainEqual({
      fieldName: 'name',
      index: 1,
    });
    expect(result.allMissingOptional).toContainEqual({
      fieldName: 'age',
      index: 0,
    });
  });

  it('should include a human-readable summary with FAIL status', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string(),
    });
    const data = [
      {
        name: 'John',
        extraField: 'value',
      },
      {
        age: 30,
        email: 'test@example.com',
      },
    ];
    const result = compareMultipleWithSchema(schema, data);

    console.log('\n' + result.summary);

    expect(result.status).toBe('FAIL');
    expect(result.summary).toBeDefined();
    expect(result.summary).toContain('[FAIL]');
    expect(result.summary).toContain('Schema Comparison Summary');
    expect(result.summary).toContain('Missing REQUIRED fields:');
    expect(result.summary).toContain('Missing optional fields:');
    expect(result.summary).toContain('Extra fields');
    expect(result.summary).toContain('- email');
    expect(result.summary).toContain('- name');
    expect(result.summary).toContain('- age');
    expect(result.summary).toContain('+ extraField [0]');
  });

  it('should show PASS status when all items match the schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const data = [
      {
        name: 'John',
        age: 30,
      },
      {
        name: 'Jane',
        age: 25,
      },
    ];
    const result = compareMultipleWithSchema(schema, data);

    console.log('\n' + result.summary);

    expect(result.status).toBe('PASS');
    expect(result.summary).toContain('[PASS]');
    expect(result.summary).toContain('✓ All items match the schema perfectly');
  });
});
