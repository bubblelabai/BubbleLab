import { describe, it, expect } from 'vitest';
import { filterEmptyInputs } from './inputUtils';

describe('filterEmptyInputs', () => {
  it('should filter out undefined values', () => {
    const inputs = { a: 'value', b: undefined, c: 'other' };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 'value', c: 'other' });
  });

  it('should filter out empty strings', () => {
    const inputs = { a: 'value', b: '', c: 'other' };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 'value', c: 'other' });
  });

  it('should filter out whitespace-only strings', () => {
    const inputs = { a: 'value', b: '   ', c: '  \t  ', d: 'other' };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 'value', d: 'other' });
  });

  it('should filter out empty arrays', () => {
    const inputs = { a: 'value', b: [], c: [1, 2, 3] };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 'value', c: [1, 2, 3] });
  });

  it('should keep null values', () => {
    const inputs = { a: 'value', b: null };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 'value', b: null });
  });

  it('should keep non-empty strings with whitespace', () => {
    const inputs = { a: '  value  ', b: 'other' };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: '  value  ', b: 'other' });
  });

  it('should keep numeric values including zero', () => {
    const inputs = { a: 0, b: 123, c: -1 };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: 0, b: 123, c: -1 });
  });

  it('should keep boolean values including false', () => {
    const inputs = { a: true, b: false };
    const result = filterEmptyInputs(inputs);
    expect(result).toEqual({ a: true, b: false });
  });

  it('should handle empty input object', () => {
    const result = filterEmptyInputs({});
    expect(result).toEqual({});
  });

  it('should handle null/undefined input gracefully', () => {
    expect(filterEmptyInputs(null as any)).toEqual({});
    expect(filterEmptyInputs(undefined as any)).toEqual({});
  });
});
