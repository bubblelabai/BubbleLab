/**
 * BubbleLab Weather Agent Example
 *
 * This example demonstrates how to:
 * 1. Create and configure a BubbleRunner
 * 2. Register default bubble types
 * 3. Inject parameters dynamically
 * 4. Execute AI agent workflows
 * 5. Handle and display results
 */

import { BubbleRunner } from '@bubblelab/bubble-runtime';
import { BubbleFactory, LogLevel } from '@bubblelab/bubble-core';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { CredentialType } from '@bubblelab/shared-schemas';

// Load environment variables from .env file
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🫧 BubbleLab Weather Agent\n');

  // Step 1: Create a BubbleFactory and register defaults
  const bubbleFactory = new BubbleFactory();
  await bubbleFactory.registerDefaults();
  console.log('✅ BubbleFactory initialized\n');

  // Step 2: Read the flow code as a string
  const flowCode = readFileSync(join(__dirname, 'weather-flow.ts'), 'utf-8');

  // Step 3: Create a BubbleRunner with your flow code
  const runner = new BubbleRunner(flowCode, bubbleFactory, {
    pricingTable: {},
    useWebhookLogger: true,
    logLevel: LogLevel.INFO,
    streamCallback: (event) => {
      console.log('🔥 Streaming log event:', event);
    },
  });

  // Step 4: (Optional) Modify bubble parameters dynamically
  const bubbles = runner.getParsedBubbles();
  const bubbleIds = Object.keys(bubbles).map(Number);
  const city = process.env.CITY || 'New York';

  if (bubbleIds.length > 0) {
    console.log(`🌍 Researching weather for: ${city}\n`);

    runner.injector.changeBubbleParameters(
      bubbleIds[0],
      'message',
      `What is the current weather in ${city}? Find information from the web and provide a detailed report.`
    );
  }
  // Inject the credentials
  runner.injector.injectCredentials([], {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
    [CredentialType.FIRECRAWL_API_KEY]: process.env.FIRECRAWL_API_KEY,
  });

  // Step 5: Execute the flow
  console.log('🤖 Running AI agent...\n');
  const result = await runner.runAll({ city: city });

  // Step 6: Display results
  console.log('📊 Results:');
  console.log('─'.repeat(50));
  console.log(JSON.stringify(result, null, 2));
  console.log('─'.repeat(50));

  // Optional: View execution logs
  const logs = runner.getLogger()?.getLogs();
  if (logs && logs.length > 0) {
    console.log('\n📝 Execution Logs:');
    console.log(logs.slice(0, 5)); // Show first 5 logs
  }

  // Optional: View execution summary
  const summary = runner.getLogger()?.getExecutionSummary();
  if (summary) {
    console.log('\n📈 Execution Summary:');
    console.log(summary);
  }

  // Force exit to close any lingering connections (AI model HTTP clients, etc.)
  process.exit(0);
}

// Run the example
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
