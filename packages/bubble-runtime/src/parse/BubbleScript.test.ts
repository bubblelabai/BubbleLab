import { describe, it, expect } from 'vitest';
import { BubbleScript } from './BubbleScript';
import { getFixture } from '../../tests/fixtures';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { MockDataGenerator } from '@bubblelab/shared-schemas';
import { buildParametersObject } from '../utils/parameter-formatter';
import { BubbleInjector } from '../injection/BubbleInjector';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  validateCronExpression,
  describeCronExpression,
} from '@bubblelab/shared-schemas';

describe('BubbleAnalyzer', () => {
  let analyzer: BubbleScript;
  let bubbleFactory: BubbleFactory;
  beforeEach(async () => {
    const imageGenerationFlowScript = getFixture('image-generation-flow');
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
    analyzer = new BubbleScript(imageGenerationFlowScript, bubbleFactory);
  });

  describe('can find variables and precise locations', () => {
    it('should find variables and precise locations', () => {
      const vars = analyzer.getAllVariableLocations();
      expect(vars).toBeDefined();
    });
  });

  describe('with image generation flow fixture', () => {
    describe('should parse variables and bubbles correctly', () => {
      it('works for basic bubble parsing', () => {
        const parsedBubbles = analyzer.getParsedBubbles();
        const scriptVariables = analyzer.getAllVariablesWithIds();

        for (const parsedBubble of Object.values(parsedBubbles)) {
          expect(parsedBubbles[parsedBubble.variableId]).toBeDefined();
          expect(scriptVariables[parsedBubble.variableId]).toBeDefined();
          expect(scriptVariables[parsedBubble.variableId].name).toBe(
            parsedBubble.variableName
          );
          for (const parameter of parsedBubble.parameters) {
            //If it is a variable, check if the variable is defined
            if (parameter.type === 'variable') {
              expect(parameter.variableId).toBeDefined();
              // Expect the variable name to equal the parameter name
              expect(parameter.value).toContain(
                scriptVariables[parameter.variableId!].name
              );
            }
          }
        }
      });
      it('works for annotated bubble parsing', () => {
        const annoynmousScript = `
        await new PostgreSQLBubble({
          query: "SELECT * FROM users",
          ignoreSSL: true,
        }).action();
        await new SlackBubble({
          channel: 'general',
          text: 'Database query completed'
        }).action();
        `;
        const analyzer = new BubbleScript(annoynmousScript, bubbleFactory);
        const parsedBubbles = analyzer.getParsedBubbles();
        console.log(JSON.stringify(parsedBubbles, null, 2));
        expect(parsedBubbles[-1]).toBeDefined();
        expect(parsedBubbles[-1].variableId).toBe(-1);
        expect(parsedBubbles[-1].className).toBe('PostgreSQLBubble');
        expect(parsedBubbles[-1].hasAwait).toBe(true);
        expect(parsedBubbles[-1].hasActionCall).toBe(true);
      });
    });

    it('should identify all user variables in the script', () => {
      const allVars = analyzer.getAllUserVariables();

      expect(allVars).toContain('image');
      expect(allVars).toContain('mimeType');
      expect(allVars).toContain('fileIds');
      expect(allVars).toContain('prompts');
      expect(allVars).toContain('i');
      expect(allVars).toContain('generateImageAgent');
      expect(allVars).toContain('generationResult');
      expect(allVars).toContain('base64Data');
      expect(allVars).toContain('uploadBubble');
      expect(allVars).toContain('uploadResult');
    });

    it('should return correct variables at payload destructuring line', () => {
      // Line where const { image, mimeType } = payload; occurs
      const vars = analyzer.getVarsForLine(52).map((v) => v.name);

      expect(vars).toContain('image');
      expect(vars).toContain('mimeType');
      expect(vars).not.toContain('fileIds'); // Not declared yet
    });

    it('should return correct variables after fileIds initialization', () => {
      // Line after const fileIds = [];
      const vars = analyzer.getVarsForLine(60).map((v) => v.name);
      const a = 3;

      expect(vars).toContain('image');
      expect(vars).toContain('mimeType');
      expect(vars).toContain('fileIds');
      expect(vars).toContain('prompts');
    });

    it('should return correct variables inside for loop', () => {
      // Line inside the for loop where bubble is instantiated
      const vars = analyzer.getVarsForLine(66).map((v) => v.name);
      console.log(vars);

      expect(vars).toContain('i'); // Loop variable
      expect(vars).toContain('generateImageAgent');
    });

    it('should return correct variables after bubble action call', () => {
      // Line after await generateImageAgent.action()
      const vars = analyzer.getVarsForLine(72).map((v) => v.name);

      expect(vars).toContain('i');
      expect(vars).toContain('generateImageAgent');
      expect(vars).toContain('generationResult');
      expect(vars).toContain('fileIds');
      expect(vars).toContain('prompts');
    });

    it('should return correct variables in nested if block', () => {
      // Line inside the if block where base64Data is extracted
      const vars = analyzer.getVarsForLine(84).map((v) => v.name);

      expect(vars).toContain('base64Data');
      expect(vars).toContain('generationResult');
      expect(vars).toContain('i');
      expect(vars).toContain('fileIds');
    });

    it('should return correct variables after upload bubble instantiation', () => {
      // Line after GoogleDriveBubble instantiation
      const vars = analyzer.getVarsForLine(97).map((v) => v.name);

      expect(vars).toContain('uploadBubble');
      expect(vars).toContain('base64Data');
      expect(vars).toContain('generationResult');
      expect(vars).toContain('i');
    });

    it('should return correct variables after upload action call', () => {
      // Line after await uploadBubble.action()
      const vars = analyzer.getVarsForLine(99).map((v) => v.name);

      expect(vars).toContain('uploadResult');
      expect(vars).toContain('uploadBubble');
      expect(vars).toContain('base64Data');
      expect(vars).toContain('fileIds');
    });

    it('should provide correct scope information', () => {
      const scopeInfo = analyzer.getScopeInfoForLine(65);

      expect(scopeInfo).toBeDefined();
      expect(scopeInfo?.scopeType).toBe('for');
      expect(scopeInfo?.variables).toContain('i');
    });

    it('should not return global/built-in variables', () => {
      const vars = analyzer.getVarsForLine(70).map((v) => v.name);

      expect(vars).not.toContain('console');
      expect(vars).not.toContain('Error');
      expect(vars).not.toContain('Array');
      expect(vars).not.toContain('Object');
    });

    it('should handle variables declared at different times correctly', () => {
      // Before fileIds is declared
      const varsBeforeFileIds = analyzer.getVarsForLine(56).map((v) => v.name);
      expect(varsBeforeFileIds).not.toContain('fileIds');

      // After fileIds is declared
      const varsAfterFileIds = analyzer.getVarsForLine(59).map((v) => v.name);
      expect(varsAfterFileIds).toContain('fileIds');
    });

    it('should correctly identify scope types at different lines', () => {
      // Module scope
      const moduleScopeInfo = analyzer.getScopeInfoForLine(58);
      expect(moduleScopeInfo?.scopeType).toBe('function');

      // For loop scope
      const forScopeInfo = analyzer.getScopeInfoForLine(65);
      expect(forScopeInfo?.scopeType).toBe('for');

      // Block scope (if statement)
      const blockScopeInfo = analyzer.getScopeInfoForLine(84);
      expect(blockScopeInfo?.scopeType).toBe('for');

      const blockScopeInfo2 = analyzer.getScopeInfoForLine(86);
      expect(blockScopeInfo2?.scopeType).toBe('block');
    });
  });

  describe('with simple script', () => {
    const simpleScript = `
      const a = 1;
      let b = 2;
      
      for (let i = 0; i < 5; i++) {
        const c = a + b + i;
        console.log(c);
      }
      
      const d = a + b;
    `;

    it('should handle simple variable scoping', () => {
      // Line 2: only 'a' should be available
      const analyzer = new BubbleScript(simpleScript, bubbleFactory);

      const varsLine2 = analyzer.getVarsForLine(2).map((v) => v.name);
      expect(varsLine2).toEqual(['a']);

      // Line 3: 'a' and 'b' should be available
      const varsLine3 = analyzer.getVarsForLine(3).map((v) => v.name);
      expect(varsLine3).toContain('a');
      expect(varsLine3).toContain('b');

      // Line 6: 'a', 'b', 'i', and 'c' should be available
      const varsLine6 = analyzer.getVarsForLine(6).map((v) => v.name);
      expect(varsLine6).toContain('a');
      expect(varsLine6).toContain('b');
      expect(varsLine6).toContain('i');
      expect(varsLine6).toContain('c');

      // Line 9: 'a', 'b', and 'd' should be available (not 'i' or 'c')
      const varsLine9 = analyzer.getVarsForLine(11).map((v) => v.name);
      expect(varsLine9).toContain('a');
      expect(varsLine9).toContain('b');
      expect(varsLine9).toContain('d');
      expect(varsLine9).not.toContain('i');
      expect(varsLine9).not.toContain('c');
    });

    it('should inject lines at particular locations', () => {
      const analyzer = new BubbleScript(simpleScript, bubbleFactory);

      // Find location of c
      const scriptVariables = analyzer.getAllVariablesWithIds();
      const cVariable = Object.values(scriptVariables).find(
        (v) => v.name === 'c'
      );
      const cLocation = analyzer.getVariableLocation(cVariable!.$id);
      console.log(cLocation);
      analyzer.injectLines(['let z = 2;'], cLocation!.startLine);
      console.log(analyzer.bubblescript);
      // Check line 6 is z=2
      const line6 = analyzer.bubblescript.split('\n')[5];
      expect(line6).toBe('let z = 2;');
    });

    it('should reassign value for b and line 4 should contain b=99', () => {
      const analyzer = new BubbleScript(simpleScript, bubbleFactory);
      // Find the variable b
      const bVariable = Object.values(analyzer.getAllVariablesWithIds()).find(
        (v) => v.name === 'b'
      )?.$id;
      analyzer.reassignVariable(bVariable!, '99');
      const line4 = analyzer.bubblescript.split('\n')[2].trim();
      expect(line4).toBe('let b = 99;');
    });
  });

  describe('parameter parsing with expressions', () => {
    const scriptWithExpressions = `
import { BubbleFlow, HelloWorldBubble } from '@bubblelab/bubble-core';
import type { WebhookEvent } from '@bubblelab/bubble-core';

interface HelloWorldPayload extends WebhookEvent {
  message: string;
  name: string;
}

export class HelloWorldFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: HelloWorldPayload) {
    console.log('Starting HelloWorld bubble with timeout...');

    const helloWorldBubble = new HelloWorldBubble({
      name: payload.name || 'Test',
      message: payload.message || 'Hello from timeout test!'
    });

    const result = await helloWorldBubble.action();

    console.log('HelloWorld result:', result);

    return result;
  }
}
`;

    it('should correctly identify expression parameters vs string literals', () => {
      const analyzer = new BubbleScript(scriptWithExpressions, bubbleFactory);
      const parsedBubbles = analyzer.getParsedBubbles();

      // Get the HelloWorldBubble instance
      const helloBubble = Object.values(parsedBubbles).find(
        (bubble) => bubble.className === 'HelloWorldBubble'
      );

      expect(helloBubble).toBeDefined();
      expect(helloBubble!.parameters).toHaveLength(2);

      // Find name parameter
      const nameParam = helloBubble!.parameters.find((p) => p.name === 'name');
      expect(nameParam).toBeDefined();

      // Find message parameter
      const messageParam = helloBubble!.parameters.find(
        (p) => p.name === 'message'
      );
      expect(messageParam).toBeDefined();

      console.log('Name parameter:', nameParam);
      console.log('Message parameter:', messageParam);

      // Reconstruct the parameters
      const reconstructedParameters = buildParametersObject(
        helloBubble!.parameters,
        helloBubble!.variableId,
        false // Don't include logger config for this test
      );

      // Reconstructed parameters should not contain quotes around expressions
      expect(reconstructedParameters).toContain("name: payload.name || 'Test'");
      expect(reconstructedParameters).toContain(
        "message: payload.message || 'Hello from timeout test!'"
      );
      expect(reconstructedParameters).not.toContain(
        '"payload.name || \'Test\'"'
      );
      expect(reconstructedParameters).not.toContain(
        '"payload.message || \'Hello from timeout test!\'"'
      );
    });

    it('should demonstrate the current incorrect behavior', () => {
      const analyzer = new BubbleScript(scriptWithExpressions, bubbleFactory);
      const parsedBubbles = analyzer.getParsedBubbles();

      // Get the HelloWorldBubble instance
      const helloBubble = Object.values(parsedBubbles).find(
        (bubble) => bubble.className === 'HelloWorldBubble'
      );

      expect(helloBubble).toBeDefined();

      const nameParam = helloBubble!.parameters.find((p) => p.name === 'name');
      const messageParam = helloBubble!.parameters.find(
        (p) => p.name === 'message'
      );

      console.log('Current parsing results:');
      console.log(
        'Name param type:',
        nameParam!.type,
        'value:',
        nameParam!.value
      );
      console.log(
        'Message param type:',
        messageParam!.type,
        'value:',
        messageParam!.value
      );

      // Document the current incorrect behavior - these will likely pass showing the bug
      // The parser probably treats these as strings when they should be expressions
    });
  });

  describe('should parse bubbles from cron schedule trigger correctly', () => {
    it('should parse bubbles from cron schedule trigger correctly', () => {
      const cronTestScript = getFixture('cron-test');
      const analyzer = new BubbleScript(cronTestScript, bubbleFactory);
      const triggerEventType = analyzer.getBubbleTriggerEventType();
      expect(triggerEventType).toStrictEqual({
        type: 'schedule/cron',
        cronSchedule: '0 0 * * *',
      });
      const payloadJsonSchema = analyzer.getPayloadJsonSchema();
      expect(payloadJsonSchema).toBeDefined();
      expect(payloadJsonSchema).toEqual({
        type: 'object',
        properties: {
          message: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['name', 'message'],
      });
      // Succesfully validates cron
      const cronValidation = validateCronExpression(
        analyzer.getBubbleTriggerEventType()?.cronSchedule as string
      );
      expect(cronValidation.valid).toBe(true);
      const cronDescription = describeCronExpression(
        analyzer.getBubbleTriggerEventType()?.cronSchedule as string
      );
      expect(cronDescription).toBe('Daily at midnight');
    });
  });
  describe('should get payload zod schema string', () => {
    it('should get payload zod schema string from image generation flow script', () => {
      const imageGenerationFlowScript = getFixture('image-generation-flow');
      const analyzer = new BubbleScript(
        imageGenerationFlowScript,
        bubbleFactory
      );
      const payloadZodSchemaString = analyzer.getPayloadJsonSchema();
      const triggerEventType = analyzer.getBubbleTriggerEventType();
      expect(triggerEventType?.type).toBe('webhook/http');
      expect(payloadZodSchemaString).toBeDefined();
      expect(payloadZodSchemaString).toEqual({
        type: 'object',
        properties: { image: { type: 'string' }, mimeType: { type: 'string' } },
        required: ['image', 'mimeType'],
      });
      const payloadMock = MockDataGenerator.generateMockFromJsonSchema(
        payloadZodSchemaString!
      );
      expect(payloadMock).toBeDefined();
      expect(payloadMock.image).toBeDefined();
      expect(payloadMock.mimeType).toBeDefined();
    });

    it('should get payload zod schema string from reddit scraper script', () => {
      const redditScraperScript = getFixture('reddit-scraper');
      const analyzer = new BubbleScript(redditScraperScript, bubbleFactory);
      const payloadZodSchemaString = analyzer.getPayloadJsonSchema();
      const triggerEventType = analyzer.getBubbleTriggerEventType();
      expect(triggerEventType?.type).toBe('webhook/http');
      expect(payloadZodSchemaString).toBeDefined();
      expect(payloadZodSchemaString).toEqual({
        type: 'object',
        properties: { spreadsheetId: { type: 'string' } },
        required: ['spreadsheetId'],
      });
      const payloadMock = MockDataGenerator.generateMockFromJsonSchema(
        payloadZodSchemaString!
      );
      expect(payloadMock).toBeDefined();
      expect(payloadMock.spreadsheetId).toBeDefined();
    });

    it('should get payload zod schema string from data assistant script', () => {
      const dataAssistantScript = getFixture('data-assistant');
      const analyzer = new BubbleScript(dataAssistantScript, bubbleFactory);
      const payloadZodSchemaString = analyzer.getPayloadJsonSchema();
      const triggerEventType = analyzer.getBubbleTriggerEventType();
      expect(triggerEventType?.type).toBe('slack/bot_mentioned');
      expect(payloadZodSchemaString).toBeDefined();
      expect(payloadZodSchemaString).toEqual({
        type: 'object',
        properties: {
          text: { type: 'string' },
          channel: { type: 'string' },
          thread_ts: { type: 'string' },
          user: { type: 'string' },
          slack_event: { type: 'object' },
          monthlyLimitError: {},
        },
        required: ['text', 'channel', 'user', 'slack_event'],
      });
    });
  });

  describe('should show detailed bubble parameters and dependencies', () => {
    it('should show detailed bubble parameters and dependencies', () => {
      const weatherBubbleScript = getFixture('research-weather');
      const analyzer = new BubbleScript(weatherBubbleScript, bubbleFactory);
      const parsedBubbles = analyzer.getParsedBubbles();
      console.log(JSON.stringify(parsedBubbles, null, 2));
    });

    it('should show detailed bubble parameters and dependencies for slack-data-assistant', () => {
      const slackDataAssistantBubbleScript = getFixture('data-assistant');
      const analyzer = new BubbleScript(
        slackDataAssistantBubbleScript,
        bubbleFactory
      );
      const parsedBubbles = analyzer.getParsedBubbles();
      console.log(JSON.stringify(parsedBubbles, null, 2));
    });
  });
  describe('should get payload json schema with defaults', () => {
    it('works for annotated bubble parsing with defaults', () => {
      const contentCreationTrendsScript = getFixture('content-creation');
      const analyzer = new BubbleScript(
        contentCreationTrendsScript,
        bubbleFactory
      );
      const inputSchema = analyzer.getPayloadJsonSchema();
      console.log(JSON.stringify(inputSchema, null, 2));
      expect(inputSchema).toBeDefined();
      expect(inputSchema).toEqual({
        type: 'object',
        properties: {
          email: {
            type: 'string',
          },
          productName: {
            type: 'string',
          },
          industry: {
            type: 'string',
            default: 'general',
          },
          targetAudience: {
            type: 'string',
            default: 'general audience',
          },
          subreddits: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: ['ContentCreator', 'InstagramMarketing', 'NewTubers'],
          },
        },
        required: ['email', 'productName'],
      });
    });
    it('works for yfinance flow', () => {
      const yfinanceScript = getFixture('yfinance');
      const analyzer = new BubbleScript(yfinanceScript, bubbleFactory);
      analyzer.getParsedBubbles();
      const inputSchema = analyzer.getPayloadJsonSchema();
      console.log(JSON.stringify(inputSchema, null, 2));
      expect(inputSchema).toBeDefined();
      expect(inputSchema).toEqual({
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['ticker', 'email'],
      });
    });
  });

  it('does not spread single-property object literal for PostgreSQLBubble', async () => {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();

    const script = `
import {z} from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  PostgreSQLBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output { response: string }
export interface CustomWebhookPayload extends WebhookEvent { message: string }

export class ChatWithPostgres extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { message } = payload;
    const runQuery = async (input: Record<string, unknown>) => {
      const { query } = input as { query: string };
      const pgBubble = new PostgreSQLBubble({ query: query });
      const result = await pgBubble.action();
      if (result.success && result.data) {
        return result.data.cleanedJSONString;
      } else {
        return \`Error executing query: \${result.error}\`;
      }
    };
    const customTools = [
      { name: 'run_sql_query', description: 'Executes a SQL query', schema: { query: z.string() }, func: runQuery },
    ];
    const agent = new AIAgentBubble({ message, customTools, model: { model: 'google/gemini-2.5-pro' } });
    const result = await agent.action();
    if (!result.success || !result.data) throw new Error('failed');
    return { response: result.data.response };
  }
}
`;

    const analyzer = new BubbleScript(script, bubbleFactory);
    const injector = new BubbleInjector(analyzer);
    const parsed = analyzer.getParsedBubbles();

    const injection = injector.injectCredentials(parsed, [], {
      [CredentialType.DATABASE_CRED]:
        'postgresql://user:pass@localhost:5432/db',
    });

    expect(injection.success).toBe(true);
    expect(injection.code).toBeDefined();

    const transformed = injection.code as string;
    // Should NOT spread the variable 'query' (because original was an object literal { query: query })
    expect(transformed).not.toContain('{...query,');
    // Should keep explicit property form
    expect(transformed).toContain('query: query');
  });
});
