import { describe, test, expect } from 'vitest';
import { HelloWorldBubble } from '../bubbles/service-bubble/hello-world.js';

describe('Mock Data Integration Tests', () => {
  describe('HelloWorldBubble mock generation', () => {
    test('should generate mock results for HelloWorld bubble', () => {
      const bubble = new HelloWorldBubble({
        name: 'Test User',
        message: 'Hello World!',
      });

      const mockResult = bubble.generateMockResult();

      // Verify BubbleResult structure
      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('data');
      expect(mockResult).toHaveProperty('executionId');
      expect(mockResult).toHaveProperty('error');
      expect(mockResult).toHaveProperty('timestamp');

      expect(mockResult.success).toBe(true);
      expect(typeof mockResult.executionId).toBe('string');
      expect(mockResult.error).toBe('');
      expect(mockResult.timestamp).toBeInstanceOf(Date);

      // Verify HelloWorld-specific data structure
      const data = mockResult.data as any;
      expect(data).toHaveProperty('greeting');
      expect(typeof data.greeting).toBe('string');
      expect(data.greeting).toBe('mock string');
    });

    test('should generate reproducible mock results with seed', () => {
      const bubble = new HelloWorldBubble({
        name: 'Test User',
        message: 'Hello World!',
      });

      const mockResult1 = bubble.generateMockResultWithSeed(12345);
      const mockResult2 = bubble.generateMockResultWithSeed(12345);

      // Data should be the same due to same seed
      expect(mockResult1.data).toEqual(mockResult2.data);

      // But execution IDs should be different (they use randomUUID which isn't affected by our seed)
      expect(mockResult1.executionId).not.toBe(mockResult2.executionId);

      // Timestamps might be the same if called quickly, but the structure should be correct
      expect(mockResult1.timestamp).toBeInstanceOf(Date);
      expect(mockResult2.timestamp).toBeInstanceOf(Date);
    });

    test('should match the actual result schema structure', () => {
      const bubble = new HelloWorldBubble({
        name: 'Test User',
        message: 'Hello World!',
      });

      const mockResult = bubble.generateMockResult();

      // Verify that mock result can be parsed by the actual schema
      expect(() => {
        bubble.resultSchema.parse({
          ...mockResult.data,
          success: mockResult.success,
          error: mockResult.error,
        });
      }).not.toThrow();
    });
  });

  describe('Schema validation with mock data', () => {
    test('should generate valid data that passes schema validation', () => {
      const bubble = new HelloWorldBubble({
        name: 'Test User',
        message: 'Hello World!',
      });

      // Generate multiple mock results to test consistency
      for (let i = 0; i < 10; i++) {
        const mockResult = bubble.generateMockResult();

        // Each mock result should be valid according to the schema
        const validationResult = bubble.resultSchema.safeParse({
          ...mockResult.data,
          success: mockResult.success,
          error: mockResult.error,
        });

        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          expect(validationResult.data).toHaveProperty('greeting');
          expect(typeof validationResult.data.greeting).toBe('string');
        }
      }
    });
  });
});
