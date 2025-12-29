import { BubbleRunner } from '@bubblelab/bubble-runtime';
import { BubbleFactory, LogLevel } from '@bubblelab/bubble-core';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CredentialType } from '@bubblelab/shared-schemas';
import { config } from 'dotenv';
// Load environment variables from .env file
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Step 1: Create a BubbleFactory and register defaults
  const bubbleFactory = new BubbleFactory();
  await bubbleFactory.registerDefaults();

  // Step 2: Read the flow code as a string
  const flowCode = readFileSync(
    join(__dirname, 'reddit-news-flow.ts'),
    'utf-8'
  );

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
  const subreddit = 'worldnews';
  const limit = 10;

  // Step 5: Set the credentials
  runner.injector.injectCredentials([], {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
  });

  const result = await runner.runAll({
    subreddit,
    limit,
  });

  if (result.error) {
    console.error('❌ Error:', result.error);
    process.exit(1);
  } else {
    console.log('✅ Reddit scraper executed successfully');
    console.log(JSON.stringify(result.data, null, 2));
  }

  const summary = runner.getLogger()?.getExecutionSummary();
  if (summary) {
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
