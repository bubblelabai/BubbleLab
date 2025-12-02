import { BubbleRunner } from './BubbleRunner.js';
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
  beforeEach(async () => {
    await bubbleFactory.registerDefaults();
  });

  describe('Execution', () => {
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
      const runner = new BubbleRunner(helloWorldMultipleScript, bubbleFactory, {
        pricingTable: {},
      });
      const result = await runner.runAll();
      console.log(runner.getLogger()?.getExecutionSummary());
      console.log(runner.getLogger()?.getLogs());
      console.log(result);
      expect(result).toBeDefined();
    }, 300000); // 5 minutes timeout

    it('should inject logger and modify bubble parameters', async () => {
      const runner = new BubbleRunner(researchWeatherScript, bubbleFactory, {
        pricingTable: {},
      });

      // Test parameter modification
      const bubbles = runner.getParsedBubbles();
      const bubbleIds = Object.keys(bubbles).map(Number);
      expect(bubbleIds.length).toBeGreaterThan(0);
      const city = 'New York';
      runner.injector.changeBubbleParameters(
        bubbleIds[0],
        'message',
        `What is the weather in ${city}? Find info from web.`
      );
      // runner.injector.changeCredentials(bubbleIds[0], getUserCredential());
      runner.injector.injectCredentials([], getUserCredential());
      // runner.injector.injectCredentialsIntoBubble(
      //   bubbles[bubbleIds[0]],
      //   getUserCredential()
      // );
      // Execute with the modified script
      const result = await runner.runAll();
      const logs = runner.getLogger()?.getLogs();
      console.log(result);
      console.log('Logs:', logs);

      expect(result).toBeDefined();
    }, 300000); // 5 minutes timeout
  });
});
