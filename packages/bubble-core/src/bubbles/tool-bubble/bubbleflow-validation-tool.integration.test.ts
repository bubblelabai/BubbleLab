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

  describe('complex workflow validation', () => {
    it('should validate Gmail categorization cron workflow with custom tools', async () => {
      const gmailCronCode = `
import {
  // Base classes
  BubbleFlow,
  BaseBubble,
  ServiceBubble,
  WorkflowBubble,
  ToolBubble,

  // Service Bubbles
  HelloWorldBubble,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
  ResendBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  HttpBubble,
  ApifyBubble,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
  InstagramTool,
  LinkedInTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleTriggerEvent,
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';
import { z } from 'zod';

export interface Output {
  categorizedEmails: {
    emailId: string;
    suggestedLabels: string[];
    agentResponse?: string;
  }[];
  errors: string[];
}

export interface CustomCronPayload extends CronEvent {
  // No custom payload needed for this cron job
}

export class GmailCategorizationCron extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '*/5 * * * *'; // Every 5 minutes

  async handle(payload: CustomCronPayload): Promise<Output> {
    const categorizedEmails: Output['categorizedEmails'] = [];
    const errors: string[] = [];

    const listEmailsBubble = new GmailBubble({
      operation: 'list_emails',
      query: 'is:unread',
      max_results: 5, // Process 5 emails at a time to avoid hitting limits
    });

    const listResult = await listEmailsBubble.action();

    if (!listResult.success || !listResult.data?.messages || listResult.data.messages.length === 0) {
      const errorMessage = listResult.error || 'No new messages found to process.';
      console.log(errorMessage);
      if (listResult.error) {
        errors.push(errorMessage);
      }
      return { categorizedEmails, errors };
    }

    const customTools: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
      func: (args: Record<string, unknown>) => Promise<unknown>;
    }[] = [
      {
        name: 'read_gmail_message_content',
        description: 'Reads the full content, subject, and sender of a specific email using its ID.',
        schema: {
          message_id: z.string().describe('The ID of the Gmail message to read.'),
        },
        func: async (args: Record<string, unknown>) => {
          const { message_id } = args as { message_id: string };
          const result = await new GmailBubble({ operation: 'get_email', message_id, format: 'full' }).action();
          if (result.success && result.data?.message) {
            return {
              snippet: result.data.message.snippet,
              headers: result.data.message.payload?.headers?.filter(h => ['From', 'To', 'Subject', 'Date'].includes(h.name)),
              body_snippet: result.data.message.payload?.body?.data?.substring(0, 500), // Return a snippet of the body
            };
          }
          return { error: result.error || 'Failed to retrieve email.' };
        },
      },
    ];

    const systemPrompt = \`
      Objective:
      Analyze an incoming email and suggest appropriate labels for categorization.

      Tool:
      - read_gmail_message_content: Use this tool with the email ID to get the full content, sender, and subject.

      Instructions:
      1. You will be given an email ID and a snippet.
      2. Use the 'read_gmail_message_content' tool to get the email's full details.
      3. Analyze the email's subject, sender, and content to determine the most relevant categories.
      4. Suggest a list of suitable labels. Try to use a consistent structure like "Parent/Child" or simple labels.
      5. Your final response must be a valid JSON object containing a single key "suggested_labels" which is an array of strings. For example: { "suggested_labels": ["Work/Projects/Alpha", "Finance/Receipts"] }.
    \`;

    for (const message of listResult.data.messages) {
      if (!message.id) continue;

      try {
        const agentBubble = new AIAgentBubble({
          message: \`Please suggest labels for the email with ID: \${message.id}. Snippet: \${message.snippet}\`,
          systemPrompt,
          customTools,
          model: {
            model: 'google/gemini-2.5-pro',
            jsonMode: true,
          },
        });

        const agentResult = await agentBubble.action();

        if (agentResult.success && agentResult.data?.response) {
          try {
            const responseJson = JSON.parse(agentResult.data.response);
            categorizedEmails.push({
              emailId: message.id,
              suggestedLabels: responseJson.suggested_labels || [],
              agentResponse: agentResult.data.response,
            });
          } catch (e) {
            const parseError = \`Failed to parse agent JSON response for email \${message.id}: \${agentResult.data.response}\`;
            console.error(parseError);
            errors.push(parseError);
          }
        } else {
          const agentError = \`Agent failed for email \${message.id}: \${agentResult.error}\`;
          console.error(agentError);
          errors.push(agentError);
        }

        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();

      } catch (error) {
        const errorMessage = \`An unexpected error occurred for email \${message.id}: \${error instanceof Error ? error.message : String(error)}\`;
        console.error(errorMessage);
        errors.push(errorMessage);
        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();
      }
    }

    return { categorizedEmails, errors };
  }
}
`;

      const tool = new BubbleFlowValidationTool({
        code: gmailCronCode,
        options: { includeDetails: true },
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toBeUndefined();
      expect(result.data?.bubbleCount).toBeGreaterThan(0);
      expect(result.data?.bubbles).toBeDefined();

      // Check that GmailBubble and AIAgentBubble are detected
      const gmailBubbles = result.data?.bubbles?.filter(
        (b) => b.bubbleName === 'gmail'
      );
      const aiAgentBubbles = result.data?.bubbles?.filter(
        (b) => b.bubbleName === 'ai-agent'
      );

      expect(gmailBubbles).toBeDefined();
      expect(aiAgentBubbles).toBeDefined();
      expect(gmailBubbles!.length).toBeGreaterThan(0);
      expect(aiAgentBubbles!.length).toBeGreaterThan(0);
    });
  });
});
