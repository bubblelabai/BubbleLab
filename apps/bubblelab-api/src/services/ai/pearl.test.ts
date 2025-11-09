// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { runPearl } from './pearl.js';
import type { AvailableModel, PearlRequest } from '@bubblelab/shared-schemas';
import { CredentialType } from '@bubblelab/shared-schemas';
import { env } from '../../config/env.js';

/**
 * Test case structure for Pearl AI agent
 */

/**
 * General test case interface for Pearl (expects code generation)
 */
interface PearlTestCase {
  request: PearlRequest;
  snippetContains: string[];
  snippetMatches: RegExp[];
  numberOfRuns?: number;
  requiredPasses?: number;
  maxRetries?: number;
  expectedType: 'code' | 'question' | 'answer' | 'reject';
}

/**
 * Validation result for a single test run
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a Pearl result against test case expectations
 * Returns validation errors instead of throwing
 */
function validateResult(
  result: unknown,
  testCase: PearlTestCase
): ValidationResult {
  const validationErrors: string[] = [];

  // Type guard to check if result has expected structure
  const pearlResult = result as {
    success?: boolean;
    type?: string;
    message?: string;
    snippet?: string;
  };

  // Validate basic fields
  if (!pearlResult.success) {
    validationErrors.push(
      `Expected success to be true, got: ${pearlResult.success}`
    );
  }

  if (pearlResult.type !== testCase.expectedType) {
    validationErrors.push(
      `Expected type to be "${testCase.expectedType}", got: "${pearlResult.type}"`
    );
  }

  if (!pearlResult.message) {
    validationErrors.push('Expected message to be defined');
  }

  // Validate snippetContains
  for (const text of testCase.snippetContains) {
    if (testCase.expectedType === 'code') {
      if (!pearlResult.snippet) {
        validationErrors.push('Expected snippet to be defined for code type');
        break; // No point checking further if snippet is undefined
      } else if (!pearlResult.snippet.includes(text)) {
        validationErrors.push(`Expected snippet to contain "${text}"`);
      }
    } else {
      if (pearlResult.message && !pearlResult.message.includes(text)) {
        validationErrors.push(`Expected message to contain "${text}"`);
      }
    }
  }

  // Validate snippetMatches patterns
  for (const pattern of testCase.snippetMatches) {
    if (testCase.expectedType === 'code') {
      if (!pearlResult.snippet) {
        validationErrors.push('Expected snippet to be defined for code type');
        break; // No point checking further if snippet is undefined
      } else if (!pattern.test(pearlResult.snippet)) {
        validationErrors.push(`Expected snippet to match pattern: ${pattern}`);
      }
    } else {
      if (pearlResult.message && !pattern.test(pearlResult.message)) {
        validationErrors.push(`Expected message to match pattern: ${pattern}`);
      }
    }
  }

  return {
    isValid: validationErrors.length === 0,
    errors: validationErrors,
  };
}

/**
 * Test helper to execute and validate a test case
 */
async function runTestCase(testCase: PearlTestCase) {
  if (!env.GOOGLE_API_KEY && !env.OPENAI_API_KEY) {
    return;
  }

  const numberOfRuns = testCase.numberOfRuns || 1;
  const requiredPasses = testCase.requiredPasses || numberOfRuns;
  const batchSize = 10;
  let passes = 0;
  let fails = 0;
  const latencies: number[] = [];
  const errors: string[] = [];
  const validationFailures: Array<{ runNumber: number; errors: string[] }> = [];

  console.log(
    `Running test case ${numberOfRuns} time(s), requiring ${requiredPasses} passes`
  );

  // Process runs in batches of 10
  for (let batchStart = 0; batchStart < numberOfRuns; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, numberOfRuns);
    const currentBatchSize = batchEnd - batchStart;

    console.log(
      `\n--- Batch ${Math.floor(batchStart / batchSize) + 1}: Running ${currentBatchSize} tests in parallel ---`
    );

    // Create promises for the current batch
    const batchPromises = Array.from(
      { length: currentBatchSize },
      async (_, index) => {
        const runNumber = batchStart + index + 1;
        const startTime = Date.now();

        try {
          // Execute Pearl agent
          const result = await runPearl(
            testCase.request,
            {
              [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
              [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
              [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
            },
            undefined,
            testCase.maxRetries || 3
          );

          const endTime = Date.now();
          const latency = endTime - startTime;

          console.log(`Pearl result for run ${runNumber}:`, result);
          console.log(
            `Latency for run ${runNumber}: ${(latency / 1000).toFixed(2)}s`
          );

          // Collect execution errors
          if (!result.success) {
            errors.push(result.message || 'Unknown error');
          }

          // Validate result and collect validation errors
          const validation = validateResult(result, testCase);

          if (!validation.isValid) {
            console.log(
              `⚠️  Run ${runNumber}/${numberOfRuns} had validation failures:`,
              validation.errors
            );
            return {
              success: false,
              latency,
              runNumber,
              validationErrors: validation.errors,
            };
          }

          console.log(`✅ Run ${runNumber}/${numberOfRuns} PASSED`);
          return { success: true, latency, runNumber };
        } catch (error) {
          const endTime = Date.now();
          const latency = endTime - startTime;

          console.log(
            `❌ Run ${runNumber}/${numberOfRuns} FAILED with exception:`,
            error
          );
          console.log(
            `Latency for run ${runNumber}: ${(latency / 1000).toFixed(2)}s`
          );
          return { success: false, latency, runNumber, error };
        }
      }
    );

    // Wait for all promises in the current batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Process batch results
    for (const result of batchResults) {
      latencies.push(result.latency);
      if (result.success) {
        passes++;
      } else {
        fails++;

        // Collect validation failures separately
        if ('validationErrors' in result && result.validationErrors) {
          validationFailures.push({
            runNumber: result.runNumber,
            errors: result.validationErrors,
          });
        } else if ('error' in result && result.error) {
          // Collect exception errors as validation failures
          const errorMessage =
            result.error instanceof Error
              ? result.error.message
              : String(result.error);
          validationFailures.push({
            runNumber: result.runNumber,
            errors: [`Exception: ${errorMessage}`],
          });
        }
      }
    }

    console.log(
      `Batch ${Math.floor(batchStart / batchSize) + 1} completed: ${batchResults.filter((r) => r.success).length}/${currentBatchSize} passed`
    );
  }

  // Calculate average latency in seconds
  const averageLatency =
    latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0;

  console.log(
    `\n📊 Final Result: ${passes}/${numberOfRuns} passes (required: ${requiredPasses})`
  );
  console.log(`📊 Statistics:`);
  console.log(`   - Passes: ${passes}`);
  console.log(`   - Fails: ${fails}`);
  console.log(`   - Average Latency: ${(averageLatency / 1000).toFixed(2)}s`);
  console.log(
    `   - Min Latency: ${(Math.min(...latencies) / 1000).toFixed(2)}s`
  );
  console.log(
    `   - Max Latency: ${(Math.max(...latencies) / 1000).toFixed(2)}s`
  );

  // Report validation failures
  if (validationFailures.length > 0) {
    console.log(`\n⚠️  Validation Failures: ${validationFailures.length}`);
    validationFailures.forEach(({ runNumber, errors: validationErrors }) => {
      console.log(`   Run ${runNumber}:`);
      validationErrors.forEach((err) => console.log(`     - ${err}`));
    });
  }

  return {
    passes,
    fails,
    errors: errors,
    validationFailures: validationFailures,
    averageLatency: averageLatency / 1000, // Return in seconds
    requiredPasses: requiredPasses,
  };
}

// ============================================================================
// TEST CASE DEFINITIONS
// Add new test cases here
// ============================================================================

/**
 * Simple test case: Generate a basic workflow that sends an email
 */
const simpleEmailWorkflowTestCase: PearlTestCase = {
  request: {
    availableVariables: [],
    userRequest:
      'Create a workflow that sends an email to user@example.com with subject "Hello" and body "Welcome to our platform!"',
    userName: 'Test User',
    conversationHistory: [],
    model: 'openrouter/z-ai/glm-4.6' as AvailableModel,
  },
  snippetContains: [
    'BubbleFlow',
    'user@example.com',
    'Hello',
    'Welcome to our platform!',
  ],
  snippetMatches: [/class.*extends BubbleFlow/i, /async handle/i],
  expectedType: 'code',
};

/**
 * Test case: User asking how to run an existing workflow
 */
const howToRunWorkflowTestCase: PearlTestCase = {
  request: {
    model: 'openrouter/z-ai/glm-4.6' as AvailableModel,
    availableVariables: [
      {
        name: 'WebhookEvent',
        type: '(alias) interface WebhookEvent\nimport WebhookEvent',
        kind: 'const',
      },
      {
        name: 'Output',
        type: 'interface Output',
        kind: 'const',
      },
      {
        name: 'CustomWebhookPayload',
        type: 'interface CustomWebhookPayload',
        kind: 'const',
      },
      {
        name: 'UntitledFlow',
        type: 'class UntitledFlow',
        kind: 'const',
      },
      {
        name: 'agent',
        type: 'AIAgentBubble',
        kind: 'const',
      },
      {
        name: 'result',
        type: 'const result: BubbleResult<{\n    response: string;\n    toolCalls: {\n        tool: string;\n        input?: unknown;\n        output?: unknown;\n    }[];\n    iterations: number;\n    error: string;\n    success: boolean;\n}>',
        kind: 'const',
      },
    ],
    userRequest: 'How do I run this flow?',
    userName: 'Test User',
    conversationHistory: [],
    currentCode: `import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;
    this.logger?.error("fdfd")
    // Simple AI agent that responds to user queries with web search
    const agent = new AIAgentBubble({
      message: query,
      systemPrompt: 'You are a helpful assistant.',
      tools: [
        {
          name: 'web-search-tool',
          config: {
            limit: 1,
          },
        },
      ],
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(\`AI Agent failed: \${result.error}\`);
    }

    return {
      response: result.data.response,
    };
  }
}
`,
    additionalContext:
      "\n\nUser's timezone: America/Los_Angeles\n\nCurrent time: Sunday, November 9, 2025 at 3:37:48 AM PST\n\nUser's provided input:\n {}",
  },
  expectedType: 'answer',
  snippetMatches: [],
  snippetContains: [],
  maxRetries: 2,
  numberOfRuns: 5,
  requiredPasses: 5,
};

const howToRunRedditFlowTestCase: PearlTestCase = {
  request: {
    userRequest: 'How do I run this flow?',
    currentCode: `import {
  BubbleFlow,
  GoogleSheetsBubble,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  newContactsAdded: number;
}

export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetId: string;
  subreddit: string;
  searchCriteria: string;
}

interface RedditPost {
    author: string;
    title: string;
    selftext: string;
    url: string;
    postUrl: string;
    createdUtc: number;
}

export class RedditFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId, subreddit, searchCriteria } = payload;

    // 1. Get existing contacts from Google Sheet to avoid duplicates
    const readSheet = new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:A', // Read the entire 'Name' column
    });
    const existingContactsResult = await readSheet.action();

    if (!existingContactsResult.success) {
      throw new Error(\`Failed to read from Google Sheet: \${existingContactsResult.error}\`);
    }

    const existingNames = existingContactsResult.data?.values
      ? existingContactsResult.data.values.flat()
      : [];

    // 2. Scrape Reddit for posts from the specified subreddit
    const redditScraper = new RedditScrapeTool({
      subreddit,
      sort: 'new',
      limit: 50,
    });
    const redditResult = await redditScraper.action();

    if (!redditResult.success || !redditResult.data?.posts) {
      throw new Error(\`Failed to scrape Reddit: \${redditResult.error}\`);
    }

    const posts: RedditPost[] = redditResult.data.posts.map((p: any) => ({
      author: p.author,
      title: p.title,
      selftext: p.selftext,
      url: p.postUrl,
      postUrl: p.postUrl,
      createdUtc: p.createdUtc,
    }));

    // 3. Use AI to find users matching the search criteria and generate outreach messages
    const systemPrompt = \`
      You are an expert analyst. Your task is to identify potential leads from a list of Reddit posts from the '\${subreddit}' subreddit.
      Your goal is to find exactly 10 new people who match the following criteria: \${searchCriteria}
      Do not select users who are already on the provided 'existing contacts' list.
      For each new lead, create a personalized, empathetic, and non-salesy outreach message. The message should acknowledge their specific problem or interest and gently suggest an alternative solution might exist, pointing them towards [product name].

      You MUST return the data as a JSON array of objects, with each object containing the following fields: "name", "link", "message".
      Example:
      [
        {
          "name": "some_redditor",
          "link": "https://reddit.com/r/\${subreddit}/...",
          "message": "Hey [Name], I saw your post about [specific topic]. [Personalized message based on their post]. If you're interested, you might find [product name] helpful. Hope this helps!"
        }
      ]
      Return ONLY the JSON array, with no other text or markdown.
    \`;

    const message = \`
      Existing Contacts:
      \${JSON.stringify(existingNames)}

      Reddit Posts:
      \${JSON.stringify(posts, null, 2)}

      Please analyze the posts and find me 10 new contacts matching the criteria: \${searchCriteria}
    \`;

    const aiAgent = new AIAgentBubble({
      message,
      systemPrompt,
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [],
    });

    const aiResult = await aiAgent.action();

    if (!aiResult.success || !aiResult.data?.response) {
      throw new Error(\`AI agent failed: \${aiResult.error}\`);
    }

    let newContacts: { name: string; link: string; message: string }[] = [];
    try {
      newContacts = JSON.parse(aiResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON.');
    }
    
    if (!Array.isArray(newContacts) || newContacts.length === 0) {
      return { message: 'No new contacts were found.', newContactsAdded: 0 };
    }

    // 4. Check for headers and add them if they are missing
    const headerCheck = new GoogleSheetsBubble({
        operation: 'read_values',
        spreadsheet_id: spreadsheetId,
        range: 'Sheet1!A1:E1',
    });
    const headerResult = await headerCheck.action();
    if (!headerResult.success) {
        throw new Error(\`Failed to read headers: \${headerResult.error}\`);
    }

    const headers = headerResult.data?.values?.[0];
    if (!headers || headers.length < 5) {
        const writeHeaders = new GoogleSheetsBubble({
            operation: 'write_values',
            spreadsheet_id: spreadsheetId,
            range: 'Sheet1!A1',
            values: [['Name', 'Link to Original Post', 'Message', 'Date', 'Status']],
        });
        const writeResult = await writeHeaders.action();
        if (!writeResult.success) {
            throw new Error(\`Failed to write headers: \${writeResult.error}\`);
        }
    }


    // 5. Format and append new contacts to the Google Sheet
    const rowsToAppend = newContacts.map(contact => {
        const post = posts.find((p: RedditPost) => p.url === contact.link);
        const postDate = post ? new Date(post.createdUtc * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return [
            contact.name,
            contact.link,
            contact.message,
            postDate,
            'Need to Reach Out',
        ];
    });

    const appendSheet = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:E',
      values: rowsToAppend,
    });

    const appendResult = await appendSheet.action();

    if (!appendResult.success) {
      throw new Error(\`Failed to append data to Google Sheet: \${appendResult.error}\`);
    }

    return {
      message: \`Successfully added \${newContacts.length} new contacts to the spreadsheet.\`,
      newContactsAdded: newContacts.length,
    };
  }
}`,
    userName: 'User',
    conversationHistory: [],
    availableVariables: [
      {
        name: 'WebhookEvent',
        type: '(alias) interface WebhookEvent\nimport WebhookEvent',
        kind: 'const',
      },
      {
        name: 'Output',
        type: 'interface Output',
        kind: 'const',
      },
      {
        name: 'CustomWebhookPayload',
        type: 'interface CustomWebhookPayload',
        kind: 'const',
      },
      {
        name: 'RedditPost',
        type: 'interface RedditPost',
        kind: 'const',
      },
      {
        name: 'RedditFlow',
        type: 'class RedditFlow',
        kind: 'const',
      },
    ],
    model: 'openrouter/z-ai/glm-4.6' as AvailableModel,
    additionalContext:
      "\n\nUser's timezone: America/Los_Angeles\n\nCurrent time: Sunday, November 9, 2025 at 6:13:54 AM PST\n\nUser's provided input:\n {}",
  },
  expectedType: 'answer',
  snippetMatches: [],
  snippetContains: [],
  maxRetries: 2,
  numberOfRuns: 5,
  requiredPasses: 5,
};

const convertToScheduledFlowTestCase: PearlTestCase = {
  request: {
    userRequest:
      'Help me convert this flow to run on a schedule, every day at 8am, spreadsheet id = 1dYZ_T2R1p9xo_Zsd7L4jkuGXC4IsRshj-kXdDjOJFhE, subreddit = n8n and serach for users who are frusted with the tool',
    currentCode: `import {
  BubbleFlow,
  GoogleSheetsBubble,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  newContactsAdded: number;
}

export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetId: string;
  subreddit: string;
  searchCriteria: string;
}

interface RedditPost {
    author: string;
    title: string;
    selftext: string;
    url: string;
    postUrl: string;
    createdUtc: number;
}

export class RedditFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId, subreddit, searchCriteria } = payload;

    // 1. Get existing contacts from Google Sheet to avoid duplicates
    const readSheet = new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:A', // Read the entire 'Name' column
    });
    const existingContactsResult = await readSheet.action();

    if (!existingContactsResult.success) {
      throw new Error(\`Failed to read from Google Sheet: \${existingContactsResult.error}\`);
    }

    const existingNames = existingContactsResult.data?.values
      ? existingContactsResult.data.values.flat()
      : [];

    // 2. Scrape Reddit for posts from the specified subreddit
    const redditScraper = new RedditScrapeTool({
      subreddit,
      sort: 'new',
      limit: 50,
    });
    const redditResult = await redditScraper.action();

    if (!redditResult.success || !redditResult.data?.posts) {
      throw new Error(\`Failed to scrape Reddit: \${redditResult.error}\`);
    }

    const posts: RedditPost[] = redditResult.data.posts.map((p: any) => ({
      author: p.author,
      title: p.title,
      selftext: p.selftext,
      url: p.postUrl,
      postUrl: p.postUrl,
      createdUtc: p.createdUtc,
    }));

    // 3. Use AI to find users matching the search criteria and generate outreach messages
    const systemPrompt = \`
      You are an expert analyst. Your task is to identify potential leads from a list of Reddit posts from the '\${subreddit}' subreddit.
      Your goal is to find exactly 10 new people who match the following criteria: \${searchCriteria}
      Do not select users who are already on the provided 'existing contacts' list.
      For each new lead, create a personalized, empathetic, and non-salesy outreach message. The message should acknowledge their specific problem or interest and gently suggest an alternative solution might exist, pointing them towards [product name].

      You MUST return the data as a JSON array of objects, with each object containing the following fields: "name", "link", "message".
      Example:
      [
        {
          "name": "some_redditor",
          "link": "https://reddit.com/r/\${subreddit}/...",
          "message": "Hey [Name], I saw your post about [specific topic]. [Personalized message based on their post]. If you're interested, you might find [product name] helpful. Hope this helps!"
        }
      ]
      Return ONLY the JSON array, with no other text or markdown.
    \`;

    const message = \`
      Existing Contacts:
      \${JSON.stringify(existingNames)}

      Reddit Posts:
      \${JSON.stringify(posts, null, 2)}

      Please analyze the posts and find me 10 new contacts matching the criteria: \${searchCriteria}
    \`;

    const aiAgent = new AIAgentBubble({
      message,
      systemPrompt,
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [],
    });

    const aiResult = await aiAgent.action();

    if (!aiResult.success || !aiResult.data?.response) {
      throw new Error(\`AI agent failed: \${aiResult.error}\`);
    }

    let newContacts: { name: string; link: string; message: string }[] = [];
    try {
      newContacts = JSON.parse(aiResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON.');
    }
    
    if (!Array.isArray(newContacts) || newContacts.length === 0) {
      return { message: 'No new contacts were found.', newContactsAdded: 0 };
    }

    // 4. Check for headers and add them if they are missing
    const headerCheck = new GoogleSheetsBubble({
        operation: 'read_values',
        spreadsheet_id: spreadsheetId,
        range: 'Sheet1!A1:E1',
    });
    const headerResult = await headerCheck.action();
    if (!headerResult.success) {
        throw new Error(\`Failed to read headers: \${headerResult.error}\`);
    }

    const headers = headerResult.data?.values?.[0];
    if (!headers || headers.length < 5) {
        const writeHeaders = new GoogleSheetsBubble({
            operation: 'write_values',
            spreadsheet_id: spreadsheetId,
            range: 'Sheet1!A1',
            values: [['Name', 'Link to Original Post', 'Message', 'Date', 'Status']],
        });
        const writeResult = await writeHeaders.action();
        if (!writeResult.success) {
            throw new Error(\`Failed to write headers: \${writeResult.error}\`);
        }
    }


    // 5. Format and append new contacts to the Google Sheet
    const rowsToAppend = newContacts.map(contact => {
        const post = posts.find((p: RedditPost) => p.url === contact.link);
        const postDate = post ? new Date(post.createdUtc * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return [
            contact.name,
            contact.link,
            contact.message,
            postDate,
            'Need to Reach Out',
        ];
    });

    const appendSheet = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:E',
      values: rowsToAppend,
    });

    const appendResult = await appendSheet.action();

    if (!appendResult.success) {
      throw new Error(\`Failed to append data to Google Sheet: \${appendResult.error}\`);
    }

    return {
      message: \`Successfully added \${newContacts.length} new contacts to the spreadsheet.\`,
      newContactsAdded: newContacts.length,
    };
  }
}`,
    userName: 'User',
    conversationHistory: [],
    availableVariables: [
      {
        name: 'WebhookEvent',
        type: '(alias) interface WebhookEvent\nimport WebhookEvent',
        kind: 'const',
      },
      {
        name: 'Output',
        type: 'interface Output',
        kind: 'const',
      },
      {
        name: 'CustomWebhookPayload',
        type: 'interface CustomWebhookPayload',
        kind: 'const',
      },
      {
        name: 'RedditPost',
        type: 'interface RedditPost',
        kind: 'const',
      },
      {
        name: 'RedditFlow',
        type: 'class RedditFlow',
        kind: 'const',
      },
    ],
    model: 'openrouter/z-ai/glm-4.6' as AvailableModel,
    additionalContext:
      "\n\nUser's timezone: America/Los_Angeles\n\nCurrent time: Sunday, November 9, 2025 at 7:12:21 AM PST\n\nUser's provided input:\n {}",
  },
  expectedType: 'code',
  snippetMatches: [
    /BubbleFlow<'schedule\/cron'>/,
    /extends BubbleFlow<'schedule\/cron'>/,
  ],
  snippetContains: ['schedule/cron', '0 16 * * *'],
  maxRetries: 2,
  numberOfRuns: 3,
  requiredPasses: 3,
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe.skip('Pearl Sanity Test', () => {
  afterAll(async () => {
    // Wait for logger to upload logs before test ends
    console.log('Waiting for logger to finish uploading logs...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('Logger upload complete, test ending');
  });

  it('should generate a simple email workflow with Gemini 2.5 pro', async () => {
    const testCase = simpleEmailWorkflowTestCase;
    await runTestCase(testCase);
  }, 60000);
});
describe('Pearl critical test', () => {
  const testResults: Array<{
    testName: string;
    passes: number;
    fails: number;
    errors: string[];
    validationFailures: Array<{ runNumber: number; errors: string[] }>;
    averageLatency: number;
    requiredPasses: number;
  }> = [];

  describe.skip('Question about workflow', () => {
    it('should answer the question when user asks how to run a workflow', async () => {
      const testCase = howToRunWorkflowTestCase;
      const result = await runTestCase(testCase);
      testResults.push({
        testName: 'How to run workflow',
        passes: result?.passes || 0,
        fails: result?.fails || 0,
        errors: result?.errors || [],
        validationFailures: result?.validationFailures || [],
        averageLatency: result?.averageLatency || 0,
        requiredPasses: result?.requiredPasses || 0,
      });
    }, 300000);

    it('should answer the question when user asks how to run a Reddit flow', async () => {
      const testCase = howToRunRedditFlowTestCase;
      const result = await runTestCase(testCase);
      testResults.push({
        testName: 'How to run Reddit flow',
        passes: result?.passes || 0,
        fails: result?.fails || 0,
        errors: result?.errors || [],
        validationFailures: result?.validationFailures || [],
        averageLatency: result?.averageLatency || 0,
        requiredPasses: result?.requiredPasses || 0,
      });
    }, 300000);
  });

  describe('Code Edit', () => {
    it('should generate a simple email workflow with Gemini 2.5 pro', async () => {
      const testCase = convertToScheduledFlowTestCase;
      const result = await runTestCase(testCase);
      testResults.push({
        testName: 'Convert to scheduled flow',
        passes: result?.passes || 0,
        fails: result?.fails || 0,
        errors: result?.errors || [],
        validationFailures: result?.validationFailures || [],
        averageLatency: result?.averageLatency || 0,
        requiredPasses: result?.requiredPasses || 0,
      });
    }, 300000);
  });

  afterAll(() => {
    console.log('\n🎯 PEARL CRITICAL TEST SUITE RESULTS');
    console.log('=====================================');

    let totalPasses = 0;
    let totalFails = 0;
    let totalRuns = 0;
    let totalLatency = 0;
    let totalRequiredPasses = 0;
    const allErrors: string[] = [];
    const allValidationErrors: string[] = [];

    testResults.forEach((result, index) => {
      const runs = result.passes + result.fails;
      totalPasses += result.passes;
      totalFails += result.fails;
      totalRuns += runs;
      totalRequiredPasses += result.requiredPasses;
      totalLatency += result.averageLatency * runs;
      allErrors.push(...result.errors);

      // Collect all validation errors
      result.validationFailures.forEach(({ errors: validationErrors }) => {
        allValidationErrors.push(...validationErrors);
      });

      console.log(`\n📊 Test ${index + 1}: ${result.testName}`);
      console.log(
        `   Passes: ${result.passes}/${runs} (${((result.passes / runs) * 100).toFixed(1)}%)`
      );
      console.log(`   Required: ${result.requiredPasses}/${runs}`);
      console.log(`   Fails: ${result.fails}/${runs}`);
      console.log(`   Avg Latency: ${result.averageLatency.toFixed(2)}s`);
      if (result.errors.length > 0) {
        console.log(`   Execution Errors: ${result.errors.length}`);
      }
      if (result.validationFailures.length > 0) {
        console.log(
          `   Validation Failures: ${result.validationFailures.length} runs`
        );
      }
    });

    const overallSuccessRate =
      totalRuns > 0 ? (totalPasses / totalRuns) * 100 : 0;
    const overallAvgLatency = totalRuns > 0 ? totalLatency / totalRuns : 0;

    console.log('\n🏆 OVERALL STATISTICS');
    console.log('=====================');
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Total Runs: ${totalRuns}`);
    console.log(`Total Passes: ${totalPasses}`);
    console.log(`Total Required Passes: ${totalRequiredPasses}`);
    console.log(`Total Fails: ${totalFails}`);
    console.log(`Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`Average Latency: ${overallAvgLatency.toFixed(2)}s`);
    console.log(`Unique Execution Errors: ${new Set(allErrors).size}`);
    console.log(
      `Unique Validation Errors: ${new Set(allValidationErrors).size}`
    );

    if (allErrors.length > 0) {
      console.log('\n❌ EXECUTION ERROR SUMMARY');
      console.log('==========================');
      const errorCounts = allErrors.reduce(
        (acc, error) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Show top 5 most common errors
        .forEach(([error, count]) => {
          console.log(`   ${count}x: ${error}`);
        });
    }

    if (allValidationErrors.length > 0) {
      console.log('\n⚠️  VALIDATION ERROR SUMMARY');
      console.log('============================');
      const validationErrorCounts = allValidationErrors.reduce(
        (acc, error) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      Object.entries(validationErrorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10) // Show top 10 most common validation errors
        .forEach(([error, count]) => {
          console.log(`   ${count}x: ${error}`);
        });
    }

    console.log('\n=====================================\n');

    // Fail the entire test suite if we don't have enough passes across all tests
    expect(totalPasses).toBeGreaterThanOrEqual(totalRequiredPasses);
  });
});
