import { BubbleRunner } from './BubbleRunner';
import { getFixture, getUserCredential } from '../../tests/fixtures/index.js';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { BubbleInjector } from '../injection/BubbleInjector';

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
  beforeEach(async () => {
    await bubbleFactory.registerDefaults();
  });

  describe('Plan Generation', () => {
    it('should run a simple bubble flow', async () => {
      new BubbleRunner(redditLeadFinderScript, bubbleFactory);
    });
    it('should fail if no bubble factory is initalized correctly', async () => {
      expect(
        () => new BubbleRunner(redditLeadFinderScript, new BubbleFactory())
      ).toThrow(
        'Failed to trace bubble dependencies: No bubbles found in BubbleFactory'
      );
    });
    it.skip('should run a flow with multiple action calls', async () => {
      const runner = new BubbleRunner(multipleActionCallsScript, bubbleFactory);
      const plan = runner.getPlan();
      console.log(JSON.stringify(plan, null, 2));
      expect(plan.steps).toHaveLength(7);
    });

    // skip this test
    it.skip('should run an image generation flow', async () => {
      const runner = new BubbleRunner(imageGenerationFlowScript, bubbleFactory);
      const plan = runner.getPlan();

      // Test setup step
      const setupStep = plan.steps[0];
      expect(setupStep.id).toBe('setup');
      expect(setupStep.type).toBe('setup');
      expect(setupStep.startLine).toBe(1);
      expect(setupStep.endLine).toBe(64);

      // Test control flow step
      const controlStep = plan.steps[1];
      expect(controlStep.id).toBe('for_64_109');
      expect(controlStep.type).toBe('control_flow');
      expect(controlStep.startLine).toBe(64);
      expect(controlStep.endLine).toBe(109);
      expect(controlStep.controlType).toBe('for');

      // Test control flow mini steps
      console.log(
        'Control step mini-steps:',
        JSON.stringify(controlStep.miniSteps, null, 2)
      );
      expect(controlStep.miniSteps).toHaveLength(6);
      if (!controlStep.miniSteps) {
        throw new Error('Control step mini-steps are undefined');
      }

      const miniStep1 = controlStep.miniSteps[0];
      expect(miniStep1.id).toBe('AIAgentBubble_new_65_70');
      expect(miniStep1.type).toBe('bubble_instantiation');
      expect(miniStep1.startLine).toBe(65);
      expect(miniStep1.endLine).toBe(70);
      expect(miniStep1.operation).toEqual({
        type: 'new_bubble',
        bubbleName: 'AIAgentBubble',
      });

      const miniStep2 = controlStep.miniSteps[1];
      expect(miniStep2.id).toBe('AIAgentBubble_action_72_72');
      expect(miniStep2.type).toBe('bubble_execution');
      expect(miniStep2.startLine).toBe(72);
      expect(miniStep2.endLine).toBe(72);
      expect(miniStep2.operation).toEqual({ type: 'await_action' });

      const miniStep3 = controlStep.miniSteps[2];
      expect(miniStep3.id).toBe('script_74_90');
      expect(miniStep3.type).toBe('script');
      expect(miniStep3.startLine).toBe(74);
      expect(miniStep3.endLine).toBe(90);
      expect(miniStep3.operation).toEqual({
        type: 'assign',
        expression: 'result processing',
      });

      const miniStep4 = controlStep.miniSteps[3];
      expect(miniStep4.id).toBe('GoogleDriveBubble_new_92_97');
      expect(miniStep4.type).toBe('bubble_instantiation');
      expect(miniStep4.startLine).toBe(92);
      expect(miniStep4.endLine).toBe(97);
      expect(miniStep4.operation).toEqual({
        type: 'new_bubble',
        bubbleName: 'GoogleDriveBubble',
      });

      const miniStep5 = controlStep.miniSteps[4];
      expect(miniStep5.id).toBe('GoogleDriveBubble_action_99_99');
      expect(miniStep5.type).toBe('bubble_execution');
      expect(miniStep5.startLine).toBe(99);
      expect(miniStep5.endLine).toBe(99);
      expect(miniStep5.operation).toEqual({ type: 'await_action' });

      const miniStep6 = controlStep.miniSteps[5];
      expect(miniStep6.id).toBe('script_98_109');
      expect(miniStep6.type).toBe('script');
      expect(miniStep6.startLine).toBe(98);
      expect(miniStep6.endLine).toBe(109);

      // Test finalization step
      const finalStep = plan.steps[2];
      expect(finalStep.id).toBe('finalization');
      expect(finalStep.type).toBe('finalization');
      expect(finalStep.startLine).toBe(110);
      expect(finalStep.endLine).toBe(123);
    });
  });

  describe('Execution', () => {
    it('should execute a simple bubble flow', async () => {
      const runner = new BubbleRunner(helloWorldScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result).toBeDefined();
    });
    it('should execute multiple bubble flows', async () => {
      const runner = new BubbleRunner(simpleHttpScript, bubbleFactory);
      const result = await runner.runAll({
        url: 'https://example.com',
      });
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result.success).toBe(true);
    }, 300000); // 5 minutes timeout

    it('should execute a simple http bubble flow', async () => {
      const runner = new BubbleRunner(simpleHttpScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result).toBeDefined();
    });

    it('should inject logger and modify bubble parameters', async () => {
      const runner = new BubbleRunner(helloWorldScript, bubbleFactory);

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

  describe('Webhook Execution', () => {
    it('should execute a webhook flow', async () => {
      const testWebhookScript = getFixture('test-webhook');
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    it('should execute a webhook flow with no payload', async () => {
      const testWebhookScript = getFixture('hello-world-no-payload');
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should execute a flow with multiple bubble instantiations (multi-line params) and preserve structure', async () => {
      const testScript = getFixture('hello-world-multiple');
      const runner = new BubbleRunner(testScript, bubbleFactory);
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
      const runner = new BubbleRunner(testWebhookScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should run reddit-lead-finder flow', async () => {
      const testScript = getFixture('reddit-lead-finder');
      const runner = new BubbleRunner(testScript, bubbleFactory);

      const bubbles = runner.getParsedBubbles();
      runner.injector.injectCredentials(bubbles, [], getUserCredential());
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
      const runner = new BubbleRunner(testScript, bubbleFactory);
      const result = await runner.runAll();
      console.log(result);
      console.log('Logs:', runner.getLogger()?.getLogs());
    });

    it('should inject logger with credentials and modify bubble parameters', async () => {
      const runner = new BubbleRunner(researchWeatherScript, bubbleFactory);
      const bubbles = runner.getParsedBubbles();
      const bubbleIds = Object.keys(bubbles).map(Number);
      expect(bubbleIds.length).toBeGreaterThan(0);
      const city = 'New York';
      runner.injector.changeBubbleParameters(
        bubbleIds[0],
        'message',
        `What is the weather in ${city}? Find info from web.`
      );
      runner.injector.injectCredentials(bubbles, [], getUserCredential());
      console.log('Final script:', runner.bubbleScript.bubblescript);
      const result = await runner.runAll();
      expect(result).toBeDefined();
      const logger = runner.getLogger();
      console.log('Logger:', logger?.getLogs());
      expect(result.success).toBe(true);
    }, 300000); // 5 minutes timeout
  });
});
