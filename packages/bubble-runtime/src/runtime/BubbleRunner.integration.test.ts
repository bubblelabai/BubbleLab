import { BubbleRunner } from './BubbleRunner.js';
import { getFixture, getUserCredential } from '../../tests/fixtures/index.js';
import {
  BubbleFactory,
  defineCapability,
  registerCapability,
} from '@bubblelab/bubble-core';
import { CredentialType } from '@bubblelab/shared-schemas';
import { z } from 'zod';
import { BubbleInjector } from '../injection/BubbleInjector';

describe('BubbleRunner correctly runs and plans', () => {
  const bubbleFactory = new BubbleFactory();
  const redditLeadFinderScript = getFixture('reddit-lead-finder');
  const imageGenerationFlowScript = getFixture('image-generation-flow');
  const multipleActionCallsScript = getFixture('mulitple-action-calls');
  const helloWorldScript = getFixture('hello-world');
  const helloWorldMultipleScript = getFixture('hello-world-multiple');
  const researchWeatherScript = getFixture('research-weather');
  const customToolSpreadParamScript = getFixture('custom-tool-spread-param');
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

    it('should execute custom tool with spread params (Stripe)', async () => {
      const runner = new BubbleRunner(
        customToolSpreadParamScript,
        bubbleFactory,
        {
          pricingTable: {},
        }
      );

      // Inject credentials including Stripe
      const credentials = {
        ...getUserCredential(),
        STRIPE_CRED: 'test-stripe-key',
      };
      runner.injector.injectCredentials([], credentials);

      // Get the script after injection
      const injectedScript = runner.bubbleScript.bubblescript;

      // Verify no arg0 wrapping - this was a bug where TSAsExpression wasn't unwrapped
      expect(injectedScript).not.toContain('arg0:');
      expect(injectedScript).not.toContain('{ arg0:');

      // Verify the operation is at top level, not nested in arg0
      expect(injectedScript).toContain("operation: 'create_invoice'");
      expect(injectedScript).toContain("operation: 'list_invoices'");
      expect(injectedScript).toContain("operation: 'retrieve_invoice'");
      expect(injectedScript).toContain("operation: 'finalize_invoice'");

      // Verify spread params are present
      expect(injectedScript).toContain('...params');
    }, 300000); // 5 minutes timeout

    it('should execute AI agent with capability and pass Google Drive credential', async () => {
      // Register the capability
      registerCapability(
        defineCapability({
          id: 'google-doc-knowledge-base',
          name: 'Google Doc Knowledge Base',
          description:
            'Read and update a Google Doc as a persistent knowledge base',
          requiredCredentials: [CredentialType.GOOGLE_DRIVE_CRED],
          inputs: [
            {
              name: 'docId',
              type: 'string',
              description: 'Google Doc ID',
              required: true,
            },
          ],
          tools: [
            {
              name: 'read-knowledge-base',
              description: 'Reads the knowledge base',
              schema: z.object({}),
              func: () => async () => ({ success: true, content: 'mock KB' }),
            },
          ],
          systemPrompt: 'You have access to a knowledge base.',
        })
      );

      const script = getFixture('agent-with-capability');
      const runner = new BubbleRunner(script, bubbleFactory, {
        pricingTable: {},
      });

      runner.injector.injectCredentials([], {
        ...getUserCredential(),
        [CredentialType.GOOGLE_DRIVE_CRED]: 'fake-google-drive-token-xyz',
      });

      console.log('Final script:', runner.bubbleScript.bubblescript);

      const result = await runner.runAll({
        text: 'What is our refund policy?',
        channel: '#general',
      });
      console.log('Result:', result);
      expect(result).toBeDefined();
      // Should fail with credential error (fake token) but not a parsing/injection error
      expect(
        result.success ||
          result.error?.includes('credentials') ||
          result.error?.includes('Google')
      ).toBe(true);
    }, 300000);
  });
});
