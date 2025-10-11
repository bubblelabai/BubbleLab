import { BubbleFlowValidationTool } from './bubbleflow-validation-tool.js';
import { BubbleFactory } from '../../bubble-factory.js';

describe('BubbleFlowValidationTool', () => {
  let bubbleFactory: BubbleFactory;

  beforeAll(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  describe('BubbleFactory Boilerplate Template', () => {
    it('should generate valid boilerplate template', async () => {
      const boilerplate = bubbleFactory.generateBubbleFlowBoilerplate();

      expect(boilerplate).toContain('import {');
      expect(boilerplate).toContain('BubbleFlow,');
      expect(boilerplate).toContain('AIAgentBubble,');
      expect(boilerplate).toContain('PostgreSQLBubble,');
      expect(boilerplate).toContain('SlackBubble,');
      expect(boilerplate).toContain(
        'export class GeneratedFlow extends BubbleFlow'
      );

      // Test that the boilerplate validates
      const tool = new BubbleFlowValidationTool({
        code: boilerplate,
        options: { includeDetails: true },
      });

      const result = await tool.action();
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toBeUndefined();
    });
  });
  describe('valid BubbleFlow code', () => {
    it('should validate correct BubbleFlow with PostgreSQL bubble', async () => {
      const validCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new PostgreSQLBubble({
      query: "SELECT * FROM users WHERE id = $1",
      parameters: [payload.userId],
      allowedOperations: ["SELECT"],
    }).action();
    
    return { data: result };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: validCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toBeUndefined();
      expect(result.data?.bubbleCount).toBeGreaterThan(0);
      expect(result.data?.bubbles).toBeDefined();
      expect(result.data?.bubbles!.length).toBe(1);
      expect(result.data?.bubbles![0].bubbleName).toBe('postgresql');
      expect(result.data?.bubbles![0].className).toBe('PostgreSQLBubble');
      expect(result.data?.bubbles![0].hasAwait).toBe(true);
      expect(result.data?.bubbles![0].hasActionCall).toBe(true);
      expect(result.data?.bubbles![0].parameterCount).toBe(3); // query, parameters, allowedOperations
    });

    it('should validate correct BubbleFlow with multiple bubbles', async () => {
      const validCode = `
import { BubbleFlow, AIAgentBubble, SlackBubble } from '@bubblelab/bubble-core';

export class MultiFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const aiResult = await new AIAgentBubble({
      message: "Analyze this data",
      model: { model: "google/gemini-2.5-flash" }
    }).action();
    
    const slackResult = await new SlackBubble({
      operation: 'send_message',
      channel: 'general',
      text: 'Analysis complete',
    }).action();
    
    return { ai: aiResult, slack: slackResult };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: validCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.bubbleCount).toBe(2);
      expect(result.data?.bubbles).toBeDefined();
      expect(result.data?.bubbles!.length).toBe(2);

      const aiBubble = result.data?.bubbles!.find(
        (b) => b.bubbleName === 'ai-agent'
      );
      const slackBubble = result.data?.bubbles!.find(
        (b) => b.bubbleName === 'slack'
      );

      expect(aiBubble).toBeDefined();
      expect(slackBubble).toBeDefined();
      expect(aiBubble!.parameterCount).toBe(2);
      expect(slackBubble!.parameterCount).toBe(3); // operation, channel, text
    });
  });

  describe('syntax errors', () => {
    it('should detect TypeScript syntax errors', async () => {
      const syntaxErrorCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    // Missing closing brace and invalid syntax
    const result = await new PostgreSQLBubble({
      query: "SELECT * FROM users",
      credentials: { DATABASE_CRED: process.env.DB_URL }
      // Missing closing brace
    
    return { data: result };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: syntaxErrorCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(result.data?.errors!.length).toBeGreaterThan(0);
      expect(result.data?.errors![0]).toContain('Line');
      expect(result.data?.bubbleCount).toBeUndefined();
      expect(result.data?.bubbles).toBeUndefined();
    });

    it('should detect missing imports', async () => {
      const missingImportCode = `
// Missing import for BubbleFlow
export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    return { message: 'hello' };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: missingImportCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(
        result.data?.errors!.some(
          (error) =>
            error.includes('BubbleFlow') || error.includes('Cannot find name')
        )
      ).toBe(true);
    });

    it('should detect malformed class structure', async () => {
      const malformedCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

// Missing extends clause
export class TestFlow {
  async handle(payload: any) {
    return { message: 'hello' };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: malformedCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(
        result.data?.errors!.some((error) =>
          error.includes('extends BubbleFlow')
        )
      ).toBe(true);
    });
  });

  describe('structure validation errors', () => {
    it('should require class to extend BubbleFlow', async () => {
      const noBubbleFlowCode = `
import { SomeOtherClass } from '@bubblelab/bubble-core';

export class TestFlow extends SomeOtherClass {
  async handle(payload: any) {
    return { message: 'hello' };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: noBubbleFlowCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(
        result.data?.errors!.some(
          (error) =>
            error.includes('SomeOtherClass') ||
            error.includes('no exported member')
        )
      ).toBe(true);
    });

    it('should require handle method', async () => {
      const noHandleMethodCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async process(payload: any) {
    // Wrong method name - should be 'handle'
    return { message: 'hello' };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: noHandleMethodCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(
        result.data?.errors!.some(
          (error) =>
            error.includes('does not implement') && error.includes('handle')
        )
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty code', async () => {
      const tool = new BubbleFlowValidationTool({
        code: '',
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(result.data?.errors![0]).toBe('Code cannot be empty');
    });

    it('should handle whitespace-only code', async () => {
      const tool = new BubbleFlowValidationTool({
        code: '   \n\t   ',
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toBeDefined();
      expect(result.data?.errors![0]).toBe('Code cannot be empty');
    });

    it('should work without includeDetails option', async () => {
      const validCode = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new HelloWorldBubble({
      name: "World"
    }).action();
    
    return { greeting: result };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: validCode,
        options: { includeDetails: false },
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.bubbleCount).toBe(0); // No details requested
      expect(result.data?.bubbles).toBeUndefined();
    });
  });

  describe('metadata validation', () => {
    it('should include correct metadata in successful validation', async () => {
      const validCode = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    return { message: 'hello' };
  }
}`;

      const tool = new BubbleFlowValidationTool({
        code: validCode,
        options: { includeDetails: true, strictMode: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.validatedAt).toBeDefined();
      expect(result.data?.metadata.codeLength).toBe(validCode.length);
      expect(result.data?.metadata.strictMode).toBe(true);
      expect(
        result.data?.metadata.validatedAt &&
          new Date(result.data.metadata.validatedAt)
      ).toBeInstanceOf(Date);
    });

    it('should include metadata even in failed validation', async () => {
      const invalidCode = 'invalid typescript code {{{';

      const tool = new BubbleFlowValidationTool({
        code: invalidCode,
        options: { strictMode: false },
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.codeLength).toBe(invalidCode.length);
      expect(result.data?.metadata.strictMode).toBe(false);
    });
  });
});
