// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  prepareForStorage,
  cleanUpObjectForDisplayAndStorage,
  type StorableValue,
} from '@bubblelab/shared-schemas';

describe('Storage Utils', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let consoleLogCalls: any[];
  let consoleWarnCalls: any[];

  beforeEach(() => {
    // Mock console.log and console.warn to capture calls
    consoleLogCalls = [];
    consoleWarnCalls = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = (...args: any[]) => {
      consoleLogCalls.push(args);
      originalConsoleLog(...args);
    };
    console.warn = (...args: any[]) => {
      consoleWarnCalls.push(args);
      originalConsoleWarn(...args);
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  describe('prepareForStorage', () => {
    it('should return untruncated value for small objects', () => {
      const smallObject = { name: 'Test', value: 123 };
      const result = prepareForStorage(smallObject);

      expect(result).toEqual({
        truncated: false,
        preview: smallObject,
        sizeBytes: 0,
      });
    });

    it('should truncate large objects when exceeding maxBytes', () => {
      // Create a large string that exceeds 100 bytes
      const largeString = 'x'.repeat(20000);
      const result = prepareForStorage(largeString, { maxBytes: 100 });

      expect(result.truncated).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(100);
      expect(typeof result.preview).toBe('string');
      expect((result.preview as string).length).toBeLessThanOrEqual(5000);
    });

    it('should use custom previewBytes option', () => {
      const largeString = 'x'.repeat(1000);
      const result = prepareForStorage(largeString, {
        maxBytes: 100,
        previewBytes: 10,
      });

      expect(result.truncated).toBe(true);
      expect((result.preview as string).length).toBeLessThanOrEqual(50);
    });

    it('should handle empty objects', () => {
      const result = prepareForStorage({});

      expect(result).toEqual({
        truncated: false,
        preview: {},
        sizeBytes: 0,
      });
    });

    it('should handle null values', () => {
      const result = prepareForStorage(null);

      expect(result).toEqual({
        truncated: false,
        preview: null,
        sizeBytes: 0,
      });
    });

    it('should handle arrays', () => {
      const array = [1, 2, 3, 'test'];
      const result = prepareForStorage(array);

      expect(result).toEqual({
        truncated: false,
        preview: array,
        sizeBytes: 0,
      });
    });

    it('should handle strings', () => {
      const str = 'Hello, World!';
      const result = prepareForStorage(str);

      expect(result).toEqual({
        truncated: false,
        preview: str,
        sizeBytes: 0,
      });
    });

    it('should handle numbers', () => {
      const num = 42;
      const result = prepareForStorage(num);

      expect(result).toEqual({
        truncated: false,
        preview: num,
        sizeBytes: 0,
      });
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        user: {
          name: 'John',
          age: 30,
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
        items: [1, 2, 3],
      };

      const result = prepareForStorage(complexObject);

      expect(result).toEqual({
        truncated: false,
        preview: complexObject,
        sizeBytes: 0,
      });
    });
  });
});
