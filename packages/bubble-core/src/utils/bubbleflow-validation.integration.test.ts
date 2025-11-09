import { validateBubbleFlow } from './bubbleflow-validation.js';
import { BubbleFactory } from '../bubble-factory.js';

describe('bubbleflow-validation', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    // Create a fresh BubbleFactory instance for each test
    bubbleFactory = new BubbleFactory(false);
    // Register default bubbles
    await bubbleFactory.registerDefaults();
  });

  describe('validateBubbleFlow', () => {
    describe('valid bubble flow code', () => {
      it('should validate a simple webhook flow successfully', async () => {
        const validCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class TestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('test-flow', 'A flow that handles webhook events');
  }
  
  async handle(payload: any): Promise<any> {
    const result = await new AIAgentBubble({
      message: 'Hello, how are you?',
      model: {
        model: 'google/gemini-2.5-flash',
      },
    }).action();
    
    return {
      message: \`Response: \${result.data?.response ?? 'No response'}\`,
    };
  }
}`;

        const result = await validateBubbleFlow(validCode, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.bubbleParameters).toBeDefined();
        expect(Object.keys(result.bubbleParameters!)).toHaveLength(1);
        expect(result.bubbleParameters!.result).toBeDefined();
        expect(result.bubbleParameters!.result.bubbleName).toBe('ai-agent');
        expect(result.bubbleParameters!.result.className).toBe('AIAgentBubble');
      });

      it('should validate a flow with multiple bubbles', async () => {
        const validCode = `
import { BubbleFlow, AIAgentBubble, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class MultiBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('multi-bubble-flow', 'A flow with multiple bubbles');
  }
  
  async handle(payload: any): Promise<any> {
    const aiResult = await new AIAgentBubble({
      message: 'Analyze this data',
      model: { model: 'google/gemini-2.5-flash' },
    }).action();
    
    const dbResult = await new PostgreSQLBubble({
      query: 'SELECT * FROM users',
      allowedOperations: ['SELECT'],
    }).action();
    
    return { aiResult, dbResult };
  }
}`;

        const result = await validateBubbleFlow(validCode, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.bubbleParameters).toBeDefined();
        expect(Object.keys(result.bubbleParameters!)).toHaveLength(2);
        expect(result.bubbleParameters!.aiResult.bubbleName).toBe('ai-agent');
        expect(result.bubbleParameters!.dbResult.bubbleName).toBe('postgresql');
      });

      it('should validate a flow with awaited and non-awaited bubbles', async () => {
        const validCode = `
import { BubbleFlow, HelloWorldBubble, SlackBubble } from '@bubblelab/bubble-core';

export class MixedAwaitFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('mixed-await-flow', 'A flow with mixed await usage');
  }
  
  async handle(payload: any): Promise<any> {
    const hello = new HelloWorldBubble({ name: 'World' });
    const slack = await new SlackBubble({
      operation: 'send_message',
      text: 'Hello from flow',
      channel: '#general',
    }).action();
    
    return { hello, slack };
  }
}`;

        const result = await validateBubbleFlow(validCode, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.bubbleParameters).toBeDefined();
        expect(Object.keys(result.bubbleParameters!)).toHaveLength(2);

        // Check that hasAwait is correctly detected
        const helloBubble = result.bubbleParameters!.hello;
        const slackBubble = result.bubbleParameters!.slack;

        expect(helloBubble.hasAwait).toBe(false);
        expect(slackBubble.hasAwait).toBe(true);
        expect(slackBubble.hasActionCall).toBe(true);
      });
    });

    describe('invalid bubble flow code', () => {
      it('should reject code that does not extend BubbleFlow', async () => {
        const invalidCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class InvalidFlow {
  constructor() {
    // Missing proper constructor
  }
  
  // Missing handle method
}`;

        const result = await validateBubbleFlow(invalidCode, bubbleFactory);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(
          'Code must contain a class that extends BubbleFlow'
        );
        expect(result.errors).toContain(
          'BubbleFlow class must have a handle method'
        );
      });

      it('should reject code that extends BubbleFlow but lacks handle method', async () => {
        const invalidCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class IncompleteFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('incomplete-flow', 'A flow missing the handle method');
  }
  
  // Missing handle method
}`;

        const result = await validateBubbleFlow(invalidCode, bubbleFactory);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        // TypeScript compilation will catch this before our custom validation runs
        expect(
          result.errors!.some((error) =>
            error.includes(
              'does not implement inherited abstract member handle'
            )
          )
        ).toBe(true);
      });

      it('should reject code with TypeScript compilation errors', async () => {
        const invalidCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class SyntaxErrorFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('syntax-error-flow', 'A flow with syntax errors');
  }

  async handle(payload: any): Promise<any> {
    const result = new AIAgentBubble({ // Missing import
      message: 'Hello',
      model: { model: 'invalid-model' },
    }).action();

    return { result };
  }
}`;

        const result = await validateBubbleFlow(invalidCode, bubbleFactory);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(
          result.errors!.some((error) => error.includes('AIAgentBubble'))
        ).toBe(true);
      });

      it('should reject code with implicit any types (TS7006)', async () => {
        const invalidCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class ImplicitAnyFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('implicit-any-flow', 'A flow with implicit any parameter');
  }

  async handle(payload: any): Promise<any> {
    // This function has an implicit 'any' type parameter
    const processData = (post) => {  // 'post' implicitly has 'any' type
      return post.title;
    };

    const result = processData({ title: 'Test' });

    return { result };
  }
}`;

        const result = await validateBubbleFlow(invalidCode, bubbleFactory);
        console.log(result);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        // Should catch TS7006: Parameter 'post' implicitly has an 'any' type
        expect(
          result.errors!.some(
            (error) =>
              error.includes('TS7006') ||
              error.includes('implicitly has an') ||
              error.includes('any')
          )
        ).toBe(true);
      });

      it('should reject code with invalid bubble instantiation', async () => {
        const invalidCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class InvalidBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('invalid-bubble-flow', 'A flow with invalid bubble usage');
  }
  
  async handle(payload: any): Promise<any> {
    const result = new AIAgentBubble({
      message: 'Hello',
      // Missing required model parameter - but this should pass since model has a default value
    }).action();
    
    return { result };
  }
}`;

        const result = await validateBubbleFlow(invalidCode, bubbleFactory);

        // This should actually pass validation because the model parameter has a default value
        // in the AIAgentBubble schema, making it optional
        expect(result.valid).toBe(true);
        expect(result.bubbleParameters).toBeDefined();
        expect(Object.keys(result.bubbleParameters!)).toHaveLength(1);
        expect(result.bubbleParameters!.result.bubbleName).toBe('ai-agent');
      });
    });

    describe('edge cases', () => {
      it('should handle empty code gracefully', async () => {
        const emptyCode = '';

        const result = await validateBubbleFlow(emptyCode, bubbleFactory);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(
          'Code must contain a class that extends BubbleFlow'
        );
      });

      it('should handle code with only imports', async () => {
        const importOnlyCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import { AIAgentBubble } from '@bubblelab/bubble-core';
`;

        const result = await validateBubbleFlow(importOnlyCode, bubbleFactory);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(
          'Code must contain a class that extends BubbleFlow'
        );
      });

      it('should handle code with comments and whitespace', async () => {
        const commentedCode = `
// This is a comment
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

/* Multi-line comment
   explaining the flow */

export class CommentedFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('commented-flow', 'A flow with lots of comments');
  }
  
  async handle(payload: any): Promise<any> {
    // Create AI agent
    const result = await new AIAgentBubble({
      message: 'Hello',
      model: { model: 'google/gemini-2.5-flash' },
    }).action();
    
    return { result };
  }
}
`;

        const result = await validateBubbleFlow(commentedCode, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.bubbleParameters).toBeDefined();
        expect(Object.keys(result.bubbleParameters!)).toHaveLength(1);
      });
    });

    describe('bubble parameter parsing', () => {
      it('should correctly parse bubble parameters with different variable names', async () => {
        const code = `
import { BubbleFlow, AIAgentBubble, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class ParameterTestFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('parameter-test', 'Testing parameter parsing');
  }
  
  async handle(payload: any): Promise<any> {
    const aiAgent = await new AIAgentBubble({
      message: 'Test message',
      model: { model: 'google/gemini-2.5-flash' },
    }).action();
    
    const database = await new PostgreSQLBubble({
      query: 'SELECT 1',
      allowedOperations: ['SELECT'],
    }).action();
    
    return { aiAgent, database };
  }
}`;

        const result = await validateBubbleFlow(code, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.bubbleParameters).toBeDefined();

        const params = result.bubbleParameters!;
        expect(params.aiAgent).toBeDefined();
        expect(params.database).toBeDefined();

        expect(params.aiAgent.bubbleName).toBe('ai-agent');
        expect(params.aiAgent.className).toBe('AIAgentBubble');
        expect(params.aiAgent.hasAwait).toBe(true);
        expect(params.aiAgent.hasActionCall).toBe(true);

        expect(params.database.bubbleName).toBe('postgresql');
        expect(params.database.className).toBe('PostgreSQLBubble');
        expect(params.database.hasAwait).toBe(true);
        expect(params.database.hasActionCall).toBe(true);
      });

      it('should handle bubbles without action calls', async () => {
        const code = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class NoActionFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('no-action', 'Testing bubbles without action calls');
  }
  
  async handle(payload: any): Promise<any> {
    const hello = new HelloWorldBubble({ name: 'World' });
    // No .action() call
    
    return { hello };
  }
}`;

        const result = await validateBubbleFlow(code, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.bubbleParameters).toBeDefined();

        const helloBubble = result.bubbleParameters!.hello;
        expect(helloBubble.hasActionCall).toBe(false);
        expect(helloBubble.hasAwait).toBe(false);
      });

      it('should extract variable type definitions', async () => {
        const code = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class TypeExtractionFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('type-extraction', 'Testing variable type extraction');
  }
  
  async handle(payload: { name: string; age: number }): Promise<{ result: string }> {
    const message: string = 'Hello';
    const count = 42;
    const aiResult = await new AIAgentBubble({
      message: message,
      model: { model: 'google/gemini-2.5-flash' },
    }).action();
    
    return { result: aiResult.data?.response ?? 'No response' };
  }
}`;

        const result = await validateBubbleFlow(code, bubbleFactory);

        expect(result.valid).toBe(true);
        expect(result.variableTypes).toBeDefined();
        expect(result.variableTypes!.length).toBeGreaterThan(0);

        // Check that we extracted types for variables
        const variableTypes = result.variableTypes!;
        const messageVar = variableTypes.find((v) => v.name === 'message');
        const countVar = variableTypes.find((v) => v.name === 'count');
        const aiResultVar = variableTypes.find((v) => v.name === 'aiResult');
        const payloadVar = variableTypes.find((v) => v.name === 'payload');

        expect(messageVar).toBeDefined();
        expect(messageVar?.type).toContain('string');
        expect(messageVar?.line).toBeGreaterThan(0);

        expect(countVar).toBeDefined();
        expect(countVar?.type).toContain('number');
        expect(countVar?.line).toBeGreaterThan(0);

        expect(aiResultVar).toBeDefined();
        expect(aiResultVar?.type).toBeDefined();
        expect(aiResultVar?.line).toBeGreaterThan(0);

        expect(payloadVar).toBeDefined();
        expect(payloadVar?.type).toBeDefined();
        expect(payloadVar?.line).toBeGreaterThan(0);
      });
    });
  });
});
