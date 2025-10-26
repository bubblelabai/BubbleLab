import { HelloWorldBubble } from './hello-world.js';
import { BubbleFactory } from '../../bubble-factory.js';

const factory = new BubbleFactory();

beforeAll(async () => {
  await factory.registerDefaults();
});

describe('HelloWorldBubble', () => {
  describe('basic properties', () => {
    test('should have correct metadata', () => {
      const bubble = new HelloWorldBubble({ name: 'test' });
      expect(bubble.name).toBe('hello-world');
      expect(bubble.type).toBe('service');
      expect(bubble.alias).toBe('hello');
      expect(bubble.shortDescription).toContain('hello world');
    });

    test('should have longDescription with use cases', () => {
      const bubble = new HelloWorldBubble({ name: 'test' });
      expect(bubble.longDescription).toContain('Use cases:');
      expect(bubble.longDescription).toContain('Testing');
      expect(bubble.longDescription).toContain('NodeX integration');
    });
  });

  describe('parameter validation', () => {
    test('should validate required name parameter', () => {
      expect(() => {
        // @ts-expect-error testing invalid input
        new HelloWorldBubble({});
      }).toThrow('Input Schema validation failed');
    });

    test('should validate empty name', () => {
      expect(() => {
        new HelloWorldBubble({ name: '' });
      }).toThrow('Name is required');
    });

    test('should use default message when not provided', async () => {
      const bubble = new HelloWorldBubble({ name: 'Test' });
      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data?.greeting).toBe('Hello from NodeX! Test!');
    });
  });

  describe('action execution', () => {
    test('should execute successfully with valid parameters', async () => {
      const params = {
        name: 'NodeX',
        message: 'Welcome to',
      };

      const bubble = new HelloWorldBubble(params);
      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data?.greeting).toBe('Welcome to NodeX!');
      expect(result.executionId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBe('');
    });

    test('should generate unique execution IDs', async () => {
      const params = { name: 'Test' };

      const bubble1 = new HelloWorldBubble(params);
      const bubble2 = new HelloWorldBubble(params);

      const result1 = await bubble1.action();
      const result2 = await bubble2.action();

      expect(result1.executionId).not.toBe(result2.executionId);
    });

    test('should handle custom messages', async () => {
      const params = {
        name: 'Developer',
        message: 'Greetings',
      };

      const bubble = new HelloWorldBubble(params);
      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data?.greeting).toBe('Greetings Developer!');
    });
  });

  describe('error handling', () => {
    test('should handle invalid parameter types gracefully', () => {
      const params = {
        name: 123, // Invalid type
      };

      expect(() => {
        // @ts-expect-error testing invalid input
        new HelloWorldBubble(params);
      }).toThrow('Input Schema validation failed');
    });
  });
});

describe('BubbleRegistry', () => {
  test('should register HelloWorldBubble class automatically', async () => {
    const registeredBubbleClass = factory.get('hello-world');

    expect(registeredBubbleClass).toBeDefined();
    expect(registeredBubbleClass).toBe(HelloWorldBubble);
  });

  test('should list registered bubbles', () => {
    const bubbleList = factory.list();

    expect(bubbleList).toContain('hello-world');
  });

  test('should contain proper schema', () => {
    const registeredBubbleClass = factory.get('hello-world');

    expect(registeredBubbleClass?.schema).toBeDefined();
    // Check if schema has shape property (ZodObject)
    if (
      registeredBubbleClass?.schema &&
      'shape' in registeredBubbleClass.schema
    ) {
      expect(registeredBubbleClass.schema.shape.name).toBeDefined();
      expect(registeredBubbleClass.schema.shape.message).toBeDefined();
    }
  });

  test('should get bubble metadata including params schema', () => {
    const metadata = factory.getMetadata('hello-world');

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('hello-world');
    expect(metadata?.shortDescription).toContain('hello world');
    expect(metadata?.alias).toBe('hello');
    expect(metadata?.params).toBeDefined();
    expect(metadata?.params?.name).toBeDefined(); // name field exists
    expect(metadata?.params?.message).toBeDefined(); // message field exists
  });

  test('should get all registered bubbles', () => {
    const allBubbles = factory.getAll();

    expect(allBubbles.length).toBeGreaterThan(0);
    expect(allBubbles.some((b) => b === HelloWorldBubble)).toBe(true);
  });
});
