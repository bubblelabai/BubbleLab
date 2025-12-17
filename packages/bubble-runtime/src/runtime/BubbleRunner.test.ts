import { BubbleRunner } from './BubbleRunner';
import { getFixture, getUserCredential } from '../../tests/fixtures/index.js';
import { BubbleFactory, WorkflowNode } from '@bubblelab/bubble-core';
import { BubbleInjector } from '../injection/BubbleInjector';
import { validateBubbleFlow } from '../validation/index';
describe('BubbleRunner correctly runs and plans', () => {
  const bubbleFactory = new BubbleFactory();
  const redditLeadFinderScript = getFixture('reddit-lead-finder');
  const imageGenerationFlowScript = getFixture('image-generation-flow');
  const multipleActionCallsScript = getFixture('mulitple-action-calls');
  const helloWorldScript = getFixture('hello-world');
  const helloWorldMultipleScript = getFixture('hello-world-multiple');
  const researchWeatherScript = getFixture('research-weather');
  const simpleHttpScript = getFixture('simple-http');
  const helloWorldNoPayloadScript = getFixture('hello-world-no-payload');
  const methodInsideHandlerScript = getFixture('method-inside-handler');
  beforeEach(async () => {
    await bubbleFactory.registerDefaults();
  });

  describe('Simple Execution', () => {
    it('should execute a simple bubble flow', async () => {
      const runner = new BubbleRunner(helloWorldScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result).toBeDefined();
    });
    it('should execute multiple bubble flows', async () => {
      const runner = new BubbleRunner(simpleHttpScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll({
        url: 'https://example.com',
      });
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result.success).toBe(true);
    }, 300000); // 5 minutes timeout

    it('should execute a simple http bubble flow', async () => {
      const runner = new BubbleRunner(simpleHttpScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result).toBeDefined();
    });

    it('should inject logger and modify bubble parameters', async () => {
      const runner = new BubbleRunner(helloWorldScript, bubbleFactory, {
        pricingTable: {},
      });

      // Test parameter modification
      const bubbles = runner.getParsedBubbles();
      const bubbleIds = Object.keys(bubbles).map(Number);
      expect(bubbleIds.length).toBeGreaterThan(0);
      // print original script
      // Modify a bubble parameter using BubbleInjector
      const injector = new BubbleInjector(runner.bubbleScript);
      injector.changeBubbleParameters(
        bubbleIds[0],
        'message',
        'Modified Hello Message!'
      );
      // Check that the bubble parameters have been modified
      expect(bubbles[bubbleIds[0]].parameters[0].value).toBe(
        'Modified Hello Message!'
      );

      // Execute with the modified script
      const result = await runner.runAll();
      // Contains logger in any of the lines
      expect(
        runner.bubbleScript.bubblescript
          .split('\n')
          .some((line) => line.includes('logger'))
      ).toBe(true);
      const logs = runner.getLogger()?.getLogs();
      console.log(result);
      console.log('Logs:', logs);

      expect(result).toBeDefined();
    });
  });

  describe('Execution With Edge Cases', () => {
    it('should execute a flow with a parameter as a variable', async () => {
      const testScript = getFixture('param-as-var');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      let result = await runner.runAll();
      expect(result).toBeDefined();
      expect(result.success || result.error?.includes('credentials')).toBe(
        true
      );
      // Inject credentials
      runner.injector.injectCredentials([], getUserCredential());
      result = await runner.runAll();
      expect(result).toBeDefined();
      expect(result.success || result.error?.includes('credentials')).toBe(
        true
      );
    });
    it('should execute a webhook flow', async () => {
      const testWebhookScript = getFixture('test-webhook');
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a webhook flow with no payload', async () => {
      const testWebhookScript = getFixture('hello-world-no-payload');
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a flow with multiple bubble instantiations (multi-line params) and preserve structure', async () => {
      const testScript = getFixture('hello-world-multiple');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      const code = runner.bubbleScript.bubblescript;
      // Should have exactly the same number of instantiations as source (1 var + 2 anonymous + 1 in loop body)
      const occurrences = (code.match(/new\s+HelloWorldBubble\(/g) || [])
        .length;
      expect(occurrences).toBe(4);
      // No stray duplicated parameter lines like a standalone "{ name: 'World' }" after replacement
      expect(code).not.toMatch(/^\s*\{\s*name:\s*'World'\s*\}\s*$/m);
    });
    it('should execute a webhook flow with multi-line parameters', async () => {
      const testWebhookScript = getFixture('hello-world-multi-line-para');
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a flow with a starter flow', async () => {
      const testScript = getFixture('starter-flow');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      runner.injector.injectCredentials([], getUserCredential());
      const result = await runner.runAll();
      expect(result).toBeDefined();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(
        result.success || result.error?.includes('Failed to scrape Reddit')
      ).toBe(true);
    });
    it('should run reddit-lead-finder flow', async () => {
      const testScript = getFixture('reddit-lead-finder');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });

      runner.injector.injectCredentials([], getUserCredential());
      const result = await runner.runAll({
        spreadsheetId: '1234567890',
        subreddit: 'n8n',
        limit: 10,
      });

      console.log(result);
      expect(result).toBeDefined();
      expect(
        result.error?.includes('Google Sheets API error') ||
          result.success === false
      ).toBe(true);
      console.log('Logs:', runner.getLogger()?.getLogs());
    });
    it('should execute a techweek-scrape flow', async () => {
      const testScript = getFixture('techweek-scrape');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
    });
    it('should execute a flow with a parameter with a comment', async () => {
      const testScript = getFixture('para-with-comment');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      // inject credentials
      const bubbles = runner.getParsedBubbles();
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a flow with a bubble inside promise', async () => {
      const testScript = getFixture('bubble-inside-promise');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();

      // IF success is true or no resend error, then test is successful
      expect(
        result.success ||
          result.error?.includes('resend credential') ||
          result.error?.includes('API')
      ).toBe(true);
    });
    it('should execute a flow with a class method and log', async () => {
      const testScript = getFixture('flow-with-class-method-and-log');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll({
        email: 'test@example.com',
        job_description: 'test job description',
      });
      expect(result).toBeDefined();
      expect(
        result.success ||
          result.error?.includes('Both scraping and search failed')
      ).toBe(true);
    });
    it('should execute a flow with a method inside the handler', async () => {
      const testScript = getFixture('method-inside-handler');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should execute a flow with a function outside the handler', async () => {
      const testScript = getFixture('function-outside-flow');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a flow with a google drive complex', async () => {
      const testScript = getFixture('google-drive-complex');
      const runner = new BubbleRunner(testScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      expect(result).toBeDefined();
      console.log(result.error);
      expect(result.success || result.error?.includes('credentials')).toBe(
        true
      );
    });
    describe('Parameter parsing and formatting - final script checks', () => {
      it('case 1: single variable parameter (new Bubble(params)) formats with spread when credentials injected', async () => {
        const testScript = getFixture('param-as-var');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        // Inject any available user credentials to trigger credential insertion
        runner.injector.injectCredentials([], getUserCredential());
        // Normalize instantiations and logging to update script string
        runner.injector.injectBubbleLoggingAndReinitializeBubbleParameters();
        const code = runner.bubbleScript.bubblescript;
        // Expect GoogleDriveBubble to use spread of the params variable + credentials
        expect(code).toMatch(
          /new\s+GoogleDriveBubble\(\{\s*\.\.\.[A-Za-z_$][\w$]*,\s*credentials:\s*\{/
        );
      });

      it('case 2: object literal properties (new Bubble({ fe: fee })) remain as name: value, not spread', async () => {
        const testScript = getFixture('para-with-variable-alias');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        // Normalize to single-line instantiations
        runner.injector.injectBubbleLoggingAndReinitializeBubbleParameters();
        const code = runner.bubbleScript.bubblescript;
        // Should render inline object with properties and no spreads
        expect(code).not.toContain('...ycUrl');
      });

      it('case 3: spread and parameter (new Bubble({ fe: fee, ...something })) preserves spread', async () => {
        const testScript = getFixture('flow-with-spread-and-para');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        runner.injector.injectBubbleLoggingAndReinitializeBubbleParameters();
        // expect ..({ operation: 'send_message', channel: channel, ...slackMessage }
        expect(runner.bubbleScript.bubblescript).toContain(
          "({ operation: 'send_message', channel: channel, ...slackMessage }"
        );
      });
    });

    describe('Function call logging', () => {
      it('should inject function call logging with await', async () => {
        const testScript = getFixture('categorizer-step-flow');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();
        // expect schema validation error
        expect(
          result.success || result.error?.includes('credentials')
        ).toBeTruthy();
        expect(runner.bubbleScript.bubblescript).toContain(
          '__bubbleFlowSelf.logger?.logFunctionCallComplete'
        );
        // SHould preserve agent response
        expect(runner.bubbleScript.bubblescript).toContain(
          'agentResponse = __functionCallResult'
        );

        // Make sure formatouput inside the tree also has the same variable id

        const workflow = runner.bubbleScript.getWorkflow();
        const findFormatOutputNode = (
          nodes: WorkflowNode[]
        ): WorkflowNode | null => {
          for (const node of nodes) {
            if (
              node.type === 'transformation_function' &&
              'functionName' in node &&
              node.functionName === 'formatOutput'
            ) {
              return node;
            }
            if ('children' in node && Array.isArray(node.children)) {
              const found = findFormatOutputNode(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const formatOutputNode = findFormatOutputNode(workflow?.root || []);
        console.log('Format output node:', formatOutputNode);
        if (formatOutputNode && 'variableId' in formatOutputNode) {
          expect(formatOutputNode.variableId).toBe(212544);
        }

        // Should have injected logging for the formatOutput function
        expect(runner.bubbleScript.bubblescript).toContain(
          "__bubbleFlowSelf.logger?.logFunctionCallComplete(212544, 'formatOutput',"
        );
      });
      it('should inject function call logging', async () => {
        const testScript = getFixture('reddit-flow-step');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });

        // print code before it runs
        const result = await runner.runAll();
        // expect schema validation error
        expect(
          result.success || result.error?.includes('validation failed')
        ).toBeTruthy();

        // Expect final exeucting script to contain the injection of the logger;
        console.log('Final script:', runner.bubbleScript.bubblescript);
        expect(runner.bubbleScript.bubblescript).toContain(
          '__bubbleFlowSelf.logger?.logFunctionCallComplete'
        );
      });
      it('should execute a flow with a linkedin gen step flow', async () => {
        const testScript = getFixture('linkedin-gen-step-flow');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();

        // Make sure the script passes parsing (final script)
        const code = runner.bubbleScript.bubblescript;
        const parseResult = await validateBubbleFlow(code, false);
        expect(parseResult.valid).toBe(true);
        expect(result).toBeDefined();
        expect(
          result.success || result.error?.includes('credential')
        ).toBeTruthy();
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
      it('should execute a flow with a content creation step', async () => {
        const testScript = getFixture('content-creation-step');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();

        // console.log('Result:', runner.bubbleScript.bubblescript);
        // Check validation result
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          true
        );
        // console.log('Parse result:', parseResult);
        expect(parseResult.valid).toBe(true);
        console.log(result.error);
        expect(result).toBeDefined();
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
      it('should execute a flow with a for and promises flow', async () => {
        const testScript = getFixture('for-and-promises-flow');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        runner.injector.injectBubbleLoggingAndReinitializeBubbleParameters();
        //Check script is valid
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          true
        );
        expect(parseResult.valid).toBe(true);
        // expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
      it('should execute a flow with a research agent step', async () => {
        const testScript = getFixture('research-agent-step');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();
        expect(result).toBeDefined();
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          false
        );
        if (!parseResult.valid) {
          console.log(runner.bubbleScript.bubblescript);
          console.log(parseResult.errors);
        }
        expect(parseResult.valid).toBe(true);

        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
      it('should correctly inject logging for method calls inside if-body (not condition)', async () => {
        const testScript = getFixture('weather-deep-research');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();
        expect(result).toBeDefined();
        // validate script
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          true
        );
        expect(parseResult.valid).toBe(true);
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
      it('should execute a flow with a nested condition handle', async () => {
        const testScript = getFixture('nested-condition-hanlde');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        expect(runner.bubbleScript.bubblescript).toContain('rowsToSave.push');
        const result = await runner.runAll({
          subreddits: [],
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          limit: 5,
        });
        expect(result).toBeDefined();
        //script to be valid
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          true
        );
        expect(parseResult.valid).toBe(true);
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
        // Expect saveToSheet to be called
        expect(runner.bubbleScript.bubblescript).toContain('rowsToSave.push');
        console.log(runner.bubbleScript.bubblescript);
      });
      it.skip('should execute a flow with a batch process loop', async () => {
        const testScript = getFixture('batch-process-loop');
        const runner = new BubbleRunner(testScript, bubbleFactory, {
          pricingTable: {},
        });
        const result = await runner.runAll();
        expect(result).toBeDefined();
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
        const parseResult = await validateBubbleFlow(
          runner.bubbleScript.bubblescript,
          true
        );
        expect(parseResult.valid).toBe(true);
        expect(runner.bubbleScript.parsingErrors.length).toBe(0);
      });
    });

    it('should inject logger with credentials and modify bubble parameters', async () => {
      const runner = new BubbleRunner(researchWeatherScript, bubbleFactory, {
        pricingTable: {},
      });
      const bubbles = runner.getParsedBubbles();
      const bubbleIds = Object.keys(bubbles).map(Number);
      expect(bubbleIds.length).toBeGreaterThan(0);
      const city = 'New York';
      runner.injector.changeBubbleParameters(
        bubbleIds[0],
        'message',
        `What is the weather in ${city}? Find info from web.`
      );
      runner.injector.injectCredentials([], getUserCredential());
      console.log('Final script:', runner.bubbleScript.bubblescript);
      const result = await runner.runAll();
      expect(result).toBeDefined();
      const logger = runner.getLogger();
      // Should not include credentials in the logs
      expect(
        logger
          ?.getLogs()
          ?.some((log) => log.message.includes('test-openai-key'))
      ).toBe(false);
      expect(result.success).toBe(true);
    }, 300000); // 5 minutes timeout
  });
});
