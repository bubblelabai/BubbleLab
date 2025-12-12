// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import {
  reconstructBubbleFlow,
  parseBubbleFlow,
} from './bubble-flow-parser.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';

describe('BubbleFlow Parser', () => {
  describe('parseBubbleFlow', () => {
    it('should parse simple bubble instantiation', async () => {
      const code = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new PostgreSQLBubble({
      connectionString: process.env.BUBBLE_CONNECTING_STRING_URL!,
      query: "SELECT * FROM users",
      ignoreSSL: true,
      allowedOps: ["SELECT"]
    }).action();
    
    return { data: result };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(1);

      const bubble = result.bubbles['result'];
      expect(bubble).toBeDefined();
      expect(bubble.bubbleName).toBe('postgresql');
      expect(bubble.className).toBe('PostgreSQLBubble');
      expect(bubble.parameters).toHaveLength(4);

      // Check specific parameters
      const connectionParam = bubble.parameters.find(
        (p: any) => p.name === 'connectionString'
      );
      expect(connectionParam).toBeDefined();
      expect(connectionParam!.value).toBe(
        'process.env.BUBBLE_CONNECTING_STRING_URL!'
      );
      expect(connectionParam!.type).toBe('env');

      const queryParam = bubble.parameters.find((p: any) => p.name === 'query');
      expect(queryParam).toBeDefined();
      expect(queryParam!.value).toBe('"SELECT * FROM users"');
      expect(queryParam!.type).toBe('string');

      const sslParam = bubble.parameters.find(
        (p: any) => p.name === 'ignoreSSL'
      );
      expect(sslParam).toBeDefined();
      expect(sslParam!.value).toBe('true');
      expect(sslParam!.type).toBe('boolean');

      const opsParam = bubble.parameters.find(
        (p: any) => p.name === 'allowedOps'
      );
      expect(opsParam).toBeDefined();
      expect(opsParam!.value).toBe('["SELECT"]');
      expect(opsParam!.type).toBe('array');
    });

    it('should fail parsing unregistered class (DataAnalystWorkflow)', async () => {
      const code = `
import { BubbleFlow, DataAnalystWorkflow } from '@bubblelab/bubble-core';

export class TestDataAnalystFlow extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: any) {
    const userQuestion = "How many users do we have?";
    const dataSourceType = "postgresql";
    
    // DataAnalystWorkflow is not registered in the bubble factory
    const dataAnalyst = new DataAnalystWorkflow({
      userQuestion,  // shorthand for userQuestion: userQuestion
      dataSourceType,  // shorthand for dataSourceType: dataSourceType
      analysisDepth: 'comprehensive',
      targetAudience: 'business',
      aiPersonality: 'analytical',
      includeInsights: true,
      maxQueries: 7,
      queryTimeout: 45000,
      ignoreSSLErrors: true,
      aiModel: {
        model: 'google/gemini-2.5-pro',
        temperature: 0.2,
        maxTokens: 100000,
      },
    });

    return await dataAnalyst.action();
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain(
        "Class 'DataAnalystWorkflow' is not registered"
      );
      expect(Object.keys(result.bubbles)).toHaveLength(0);
    });

    it('should parse ES6 shorthand property assignments with SlackDataAssistantWorkflow', async () => {
      const code = `
import { BubbleFlow, SlackDataAssistantWorkflow } from '@bubblelab/bubble-core';

export class TestSlackDataAssistantFlow extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: any) {
    const slackChannel = payload.channel;
    const userQuestion = payload.text.replace(/<@[^>]+>/g, '').trim();
    const userName = payload.user;
    const dataSourceType = 'postgresql';
    
    // Using ES6 shorthand syntax with registered class
    const workflow = new SlackDataAssistantWorkflow({
      slackChannel,  // shorthand for slackChannel: slackChannel
      userQuestion,  // shorthand for userQuestion: userQuestion
      userName,      // shorthand for userName: userName  
      dataSourceType, // shorthand for dataSourceType: dataSourceType
      ignoreSSLErrors: true,
      aiModel: 'google/gemini-2.5-pro',
      temperature: 0.3,
      verbosity: '1',
      technicality: '1',
      includeQuery: true,
      includeExplanation: true,
    });

    return await workflow.action();
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(1);

      const bubble = result.bubbles['workflow'];
      expect(bubble).toBeDefined();
      expect(bubble.bubbleName).toBe('slack-data-assistant');
      expect(bubble.className).toBe('SlackDataAssistantWorkflow');
      expect(bubble.hasAwait).toBe(false);
      expect(bubble.hasActionCall).toBe(false); // Variable instantiation doesn't detect .action() calls

      // Check that ES6 shorthand properties were parsed correctly
      const slackChannelParam = bubble.parameters.find(
        (p) => p.name === 'slackChannel'
      );
      expect(slackChannelParam).toBeDefined();
      expect(slackChannelParam!.value).toBe('slackChannel');
      expect(slackChannelParam!.type).toBe('unknown');

      const userQuestionParam = bubble.parameters.find(
        (p) => p.name === 'userQuestion'
      );
      expect(userQuestionParam).toBeDefined();
      expect(userQuestionParam!.value).toBe('userQuestion');
      expect(userQuestionParam!.type).toBe('unknown');

      const userNameParam = bubble.parameters.find(
        (p) => p.name === 'userName'
      );
      expect(userNameParam).toBeDefined();
      expect(userNameParam!.value).toBe('userName');
      expect(userNameParam!.type).toBe('unknown');

      const dataSourceTypeParam = bubble.parameters.find(
        (p) => p.name === 'dataSourceType'
      );
      expect(dataSourceTypeParam).toBeDefined();
      expect(dataSourceTypeParam!.value).toBe('dataSourceType');
      expect(dataSourceTypeParam!.type).toBe('unknown');

      // Check that regular properties were also parsed
      const aiModelParam = bubble.parameters.find((p) => p.name === 'aiModel');
      expect(aiModelParam).toBeDefined();
      expect(aiModelParam!.value).toBe("'google/gemini-2.5-pro'");
      expect(aiModelParam!.type).toBe('string');

      const ignoreSSLParam = bubble.parameters.find(
        (p) => p.name === 'ignoreSSLErrors'
      );
      expect(ignoreSSLParam).toBeDefined();
      expect(ignoreSSLParam!.value).toBe('true');
      expect(ignoreSSLParam!.type).toBe('boolean');
    });

    it('should parse userQuestion parameter with shorthand syntax using SlackDataAssistantWorkflow', async () => {
      // This test specifically addresses the original bug report about userQuestion not being parsed
      const code = `
import { BubbleFlow, SlackDataAssistantWorkflow } from '@bubblelab/bubble-core';

export class DataAnalystFlow extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: any) {
    const userQuestion = payload.text.replace(/<@[^>]+>/g, '').trim();
    const slackChannel = payload.channel;
    const userName = payload.user;
    
    const dataAnalyst = new SlackDataAssistantWorkflow({
      slackChannel,
      userQuestion,  // This should be parsed correctly now
      userName,
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      aiModel: 'google/gemini-2.5-pro',
      temperature: 0.3,
      verbosity: '1',
      technicality: '1',
      includeQuery: true,
      includeExplanation: true,
    });

    return await dataAnalyst.action();
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(1);

      const bubble = result.bubbles['dataAnalyst'];
      expect(bubble).toBeDefined();
      expect(bubble.bubbleName).toBe('slack-data-assistant');
      expect(bubble.className).toBe('SlackDataAssistantWorkflow');

      // Verify that userQuestion parameter is correctly parsed
      const userQuestionParam = bubble.parameters.find(
        (p) => p.name === 'userQuestion'
      );
      expect(userQuestionParam).toBeDefined();
      expect(userQuestionParam!.value).toBe('userQuestion');
      expect(userQuestionParam!.type).toBe('unknown'); // It's a variable reference

      // Verify shorthand parameters are also correctly parsed
      const slackChannelParam = bubble.parameters.find(
        (p) => p.name === 'slackChannel'
      );
      expect(slackChannelParam).toBeDefined();
      expect(slackChannelParam!.value).toBe('slackChannel');
      expect(slackChannelParam!.type).toBe('unknown'); // It's a variable reference

      const userNameParam = bubble.parameters.find(
        (p) => p.name === 'userName'
      );
      expect(userNameParam).toBeDefined();
      expect(userNameParam!.value).toBe('userName');
      expect(userNameParam!.type).toBe('unknown'); // It's a variable reference

      // Verify literal parameters are correctly parsed
      const dataSourceParam = bubble.parameters.find(
        (p) => p.name === 'dataSourceType'
      );
      expect(dataSourceParam).toBeDefined();
      expect(dataSourceParam!.value).toBe("'postgresql'");
      expect(dataSourceParam!.type).toBe('string');

      const aiModelParam = bubble.parameters.find((p) => p.name === 'aiModel');
      expect(aiModelParam).toBeDefined();
      expect(aiModelParam!.value).toBe("'google/gemini-2.5-pro'");
      expect(aiModelParam!.type).toBe('string');
    });

    it('should parse multiple bubble types', async () => {
      const code = `
import { BubbleFlow, SlackBubble, AIAgentBubble } from '@bubblelab/bubble-core';

export class MultiFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const aiResult = await new AIAgentBubble({
      message: "Hello world",
      model: { model: "google/gemini-2.5-flash" }
    }).action();
    
    const slackResult = await new SlackBubble({
      operation: 'send_message',
      token: process.env.SLACK_TOKEN!,
      channel: 'general',
      text: 'Test message'
    }).action();
    
    return { ai: aiResult, slack: slackResult };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(2);

      const aiBubble = result.bubbles['aiResult'];
      expect(aiBubble.bubbleName).toBe('ai-agent');
      expect(aiBubble.className).toBe('AIAgentBubble');

      const slackBubble = result.bubbles['slackResult'];
      expect(slackBubble.bubbleName).toBe('slack');
      expect(slackBubble.className).toBe('SlackBubble');

      const tokenParam = slackBubble.parameters.find((p) => p.name === 'token');
      expect(tokenParam!.type).toBe('env');
    });

    it('should handle bubbles without parameters', async () => {
      const code = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class SimpleFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const greeting = await new HelloWorldBubble({
      name: "Test"
    }).action();
    
    return { greeting };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      const bubble = result.bubbles['greeting'];
      expect(bubble.bubbleName).toBe('hello-world');
      expect(bubble.parameters).toHaveLength(1);
    });

    it('should ignore non-bubble instantiations', async () => {
      const code = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

class CustomClass {
  constructor(params: any) {}
}

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const custom = new CustomClass({ value: 123 });
    const result = await new PostgreSQLBubble({
      connectionString: process.env.BUBBLE_CONNECTING_STRING_URL!,
      query: "SELECT 1"
    }).action();
    
    return { result };
  }
}`;

      const result = await parseBubbleFlow(code);

      if (!result.success) {
        console.log('Parse errors:', result.errors);
      }

      expect(result.success).toBe(false);
      expect(Object.keys(result.bubbles)).toHaveLength(1);
      expect(result.bubbles['custom']).toBeUndefined();
      expect(result.bubbles['result']).toBeDefined();
    });

    it('should handle complex parameter types', async () => {
      const code = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class ComplexFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const aiResult = await new AIAgentBubble({
      message: \`Hello \${payload.name}\`,
      systemPrompt: "You are helpful",
      model: { 
        model: "google/gemini-2.5-pro",
        temperature: 0.7,
        maxTokens: 1000
      },
      tools: [
        { name: "search", enabled: true },
        { name: "calculator", enabled: false }
      ],
      maxIterations: 5
    }).action();
    
    return { result: aiResult };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      const bubble = result.bubbles['aiResult'];
      expect(bubble.parameters).toHaveLength(5);

      const modelParam = bubble.parameters.find((p) => p.name === 'model');
      expect(modelParam!.type).toBe('object');

      const toolsParam = bubble.parameters.find((p) => p.name === 'tools');
      expect(toolsParam!.type).toBe('array');

      const maxIterParam = bubble.parameters.find(
        (p) => p.name === 'maxIterations'
      );
      expect(maxIterParam!.type).toBe('number');
    });

    it('should return errors for invalid code', async () => {
      const code = `
This is not valid TypeScript code
      `;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should parse bubbles with import aliases', async () => {
      const code = `
import { BubbleFlow, ResearchAgentTool as ResearchAgent } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new ResearchAgent({
      query: "What is TypeScript?",
      maxIterations: 3
    }).action();
    
    return { data: result };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(1);

      const bubble = result.bubbles['result'];
      expect(bubble).toBeDefined();
      expect(bubble.bubbleName).toBe('research-agent-tool');
      expect(bubble.className).toBe('ResearchAgentTool');
      expect(bubble.parameters).toHaveLength(2);

      const queryParam = bubble.parameters.find((p) => p.name === 'query');
      expect(queryParam).toBeDefined();
      expect(queryParam!.value).toBe('"What is TypeScript?"');
      expect(queryParam!.type).toBe('string');

      const maxIterParam = bubble.parameters.find(
        (p) => p.name === 'maxIterations'
      );
      expect(maxIterParam).toBeDefined();
      expect(maxIterParam!.value).toBe('3');
      expect(maxIterParam!.type).toBe('number');
    });

    it('should parse multiple bubbles with different import aliases', async () => {
      const code = `
import { BubbleFlow, ResearchAgentTool as ResearchAgent, AIAgentBubble as AIAgent } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const research = await new ResearchAgent({
      query: "Search query"
    }).action();
    
    const ai = await new AIAgent({
      message: "Process the results"
    }).action();
    
    return { research, ai };
  }
}`;

      const result = await parseBubbleFlow(code);

      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(2);

      const researchBubble = result.bubbles['research'];
      expect(researchBubble).toBeDefined();
      expect(researchBubble.bubbleName).toBe('research-agent-tool');
      expect(researchBubble.className).toBe('ResearchAgentTool');

      const aiBubble = result.bubbles['ai'];
      expect(aiBubble).toBeDefined();
      expect(aiBubble.bubbleName).toBe('ai-agent');
      expect(aiBubble.className).toBe('AIAgentBubble');
    });
  });

  describe('reconstructBubbleFlow', () => {
    it('should reconstruct simple bubble with modified parameters', async () => {
      const originalCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new PostgreSQLBubble({
      connectionString: process.env.BUBBLE_CONNECTING_STRING_URL!,
      query: "SELECT * FROM users",
      ignoreSSL: false
    }).action();
    
    return { data: result };
  }
}`;

      const newParameters: Record<string, ParsedBubble> = {
        result: {
          variableName: 'result',
          bubbleName: 'postgresql',
          className: 'PostgreSQLBubble',
          hasAwait: true,
          hasActionCall: true,
          parameters: [
            {
              name: 'connectionString',
              value: 'process.env.NEW_DB_URL!',
              type: BubbleParameterType.ENV,
            },
            {
              name: 'query',
              value: '"SELECT * FROM customers"',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'ignoreSSL',
              value: 'true',
              type: BubbleParameterType.BOOLEAN,
            },
            {
              name: 'allowedOps',
              value: '["SELECT", "INSERT"]',
              type: BubbleParameterType.ARRAY,
            },
          ],
        },
      };

      const result = await reconstructBubbleFlow(originalCode, newParameters);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toContain('process.env.NEW_DB_URL!');
      expect(result.code).toContain('"SELECT * FROM customers"');
      expect(result.code).toContain('ignoreSSL: true');
      expect(result.code).toContain('allowedOps: ["SELECT", "INSERT"]');
    });

    it('should handle multiple bubble reconstructions', async () => {
      const originalCode = `
import { BubbleFlow, AIAgentBubble, SlackBubble } from '@bubblelab/bubble-core';

export class MultiFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const aiResult = await new AIAgentBubble({
      message: "Old message"
    }).action();
    
    const slackResult = await new SlackBubble({
      operation: 'send_message',
      token: process.env.OLD_TOKEN!,
      channel: 'old-channel'
    }).action();
    
    return { ai: aiResult, slack: slackResult };
  }
}`;

      const newParameters: Record<string, ParsedBubble> = {
        aiResult: {
          variableName: 'aiResult',
          bubbleName: 'ai-agent',
          hasAwait: true,
          hasActionCall: true,
          className: 'AIAgentBubble',
          parameters: [
            {
              name: 'message',
              value: '"New AI message"',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'model',
              value: '{ model: "google/gemini-2.5-flash" }',
              type: BubbleParameterType.OBJECT,
            },
          ],
        },
        slackResult: {
          variableName: 'slackResult',
          hasAwait: true,
          hasActionCall: true,
          bubbleName: 'slack',
          className: 'SlackBubble',
          parameters: [
            {
              name: 'operation',
              value: "'send_message'",
              type: BubbleParameterType.STRING,
            },
            {
              name: 'token',
              value: 'process.env.NEW_SLACK_TOKEN!',
              type: BubbleParameterType.ENV,
            },
            {
              name: 'channel',
              value: "'new-channel'",
              type: BubbleParameterType.STRING,
            },
            {
              name: 'text',
              value: '"Updated message"',
              type: BubbleParameterType.STRING,
            },
          ],
        },
      };

      const result = await reconstructBubbleFlow(originalCode, newParameters);

      expect(result.success).toBe(true);
      expect(result.code).toContain('"New AI message"');
      expect(result.code).toContain('process.env.NEW_SLACK_TOKEN!');
      expect(result.code).toContain("'new-channel'");
    });

    it('should return error for bubble name mismatch', async () => {
      const originalCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const result = await new PostgreSQLBubble({
      connectionString: process.env.BUBBLE_CONNECTING_STRING_URL!
    }).action();
    
    return { data: result };
  }
}`;

      const wrongParameters: Record<string, ParsedBubble> = {
        result: {
          hasAwait: true,
          hasActionCall: true,
          variableName: 'result',
          bubbleName: 'slack', // Wrong bubble name - should be 'postgresql'
          className: 'SlackBubble',
          parameters: [],
        },
      };

      const result = await reconstructBubbleFlow(originalCode, wrongParameters);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Bubble name mismatch');
      expect(result.errors![0]).toContain("expected 'postgresql'");
      expect(result.errors![0]).toContain("got 'slack'");
    });

    it('should handle edge case with no modifications needed', async () => {
      const originalCode = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class SimpleFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    return { message: "No bubbles here" };
  }
}`;

      const result = await reconstructBubbleFlow(originalCode, {});

      expect(result.success).toBe(true);
      expect(result.code).toBe(originalCode);
    });

    it('should preserve code structure and formatting', async () => {
      const originalCode = `import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    // This is a comment
    const greeting = await new HelloWorldBubble({
      name: "World"
    }).action();
    
    console.log("Processing...");
    return { greeting };
  }
}`;

      const newParameters: Record<string, ParsedBubble> = {
        greeting: {
          variableName: 'greeting',
          bubbleName: 'hello-world',
          hasAwait: true,
          hasActionCall: true,
          className: 'HelloWorldBubble',
          parameters: [
            {
              name: 'name',
              value: '"Universe"',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'message',
              value: '"Greetings from NodeX!"',
              type: BubbleParameterType.STRING,
            },
          ],
        },
      };

      const result = await reconstructBubbleFlow(originalCode, newParameters);

      expect(result.success).toBe(true);
      expect(result.code).toContain('// This is a comment');
      expect(result.code).toContain('console.log("Processing...");');
      expect(result.code).toContain('"Universe"');
      expect(result.code).toContain('"Greetings from NodeX!"');
    });

    it('should successfully parse anonymous bubble calls with synthetic variable names', async () => {
      const code = `
import { BubbleFlow, PostgreSQLBubble, SlackBubble } from '@bubblelab/bubble-core';

export class AnonymousCallFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    // Anonymous call without variable assignment
    await new PostgreSQLBubble({
      query: "SELECT * FROM users",
      ignoreSSL: true,
    }).action();

    // Another anonymous call
    new SlackBubble({
      channel: 'general',
      text: 'Database query completed'
    }).action();
    
    return { message: 'Both bubbles executed anonymously' };
  }
}`;

      const result = await parseBubbleFlow(code);

      // Anonymous calls should now be detected with synthetic names
      expect(result.success).toBe(true);
      expect(Object.keys(result.bubbles)).toHaveLength(2);

      // Check that synthetic variable names are generated
      const bubbleKeys = Object.keys(result.bubbles);
      const postgresBubble = bubbleKeys.find((key) =>
        key.includes('PostgreSQLBubble')
      );
      const slackBubble = bubbleKeys.find((key) => key.includes('SlackBubble'));

      expect(postgresBubble).toBeDefined();
      expect(slackBubble).toBeDefined();

      // Verify bubble details
      expect(result.bubbles[postgresBubble!].bubbleName).toBe('postgresql');
      expect(result.bubbles[postgresBubble!].className).toBe(
        'PostgreSQLBubble'
      );
      expect(result.bubbles[postgresBubble!].hasAwait).toBe(true);
      expect(result.bubbles[postgresBubble!].hasActionCall).toBe(true);

      expect(result.bubbles[slackBubble!].bubbleName).toBe('slack');
      expect(result.bubbles[slackBubble!].className).toBe('SlackBubble');
      expect(result.bubbles[slackBubble!].hasAwait).toBe(false);
      expect(result.bubbles[slackBubble!].hasActionCall).toBe(true);

      // Verify parameters are extracted
      const postgresParams = result.bubbles[postgresBubble!].parameters;
      expect(postgresParams.find((p) => p.name === 'query')?.value).toBe(
        '"SELECT * FROM users"'
      );
      expect(postgresParams.find((p) => p.name === 'ignoreSSL')?.value).toBe(
        'true'
      );

      const slackParams = result.bubbles[slackBubble!].parameters;
      expect(slackParams.find((p) => p.name === 'channel')?.value).toBe(
        "'general'"
      );
      expect(slackParams.find((p) => p.name === 'text')?.value).toBe(
        "'Database query completed'"
      );
    });
  });
});
