import { describe, it, expect } from 'vitest';
import { AIAgentBubble } from '../../index.js';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Integration test for Gemini 2.5 Flash reliability
 * Tests the exact scenario that was failing with candidateContent.parts.reduce error
 * Runs 20 times to ensure consistent success
 */
describe('Gemini 2.5 Flash Reliability Test', () => {
  const testMessage = `Here is a list of my upcoming calendar events for the next 1 day(s): [{"id":"395ms8fs5jlkqujnk46vnoeils","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=Mzk1bXM4ZnM1amxrcXVqbms0NnZub2VpbHMgemFjaHpob25nQGJ1YmJsZWxhYi5haQ","created":"2025-10-24T02:31:52.000Z","updated":"2025-10-24T02:31:53.007Z","summary":"LA Clippers @ Magic","location":"Kia Center","start":{"dateTime":"2025-11-20T16:00:00-08:00","timeZone":"America/Los_Angeles"},"end":{"dateTime":"2025-11-20T19:00:00-08:00","timeZone":"America/Los_Angeles"},"attendees":[{"email":"zzyzsy0516321@gmail.com","responseStatus":"needsAction"}],"organizer":{"email":"zachzhong@bubblelab.ai"},"kind":"calendar#event","etag":"\"3522546226014142\"","creator":{"email":"zachzhong@bubblelab.ai","self":true},"iCalUID":"395ms8fs5jlkqujnk46vnoeils@google.com","sequence":0,"reminders":{"useDefault":true},"eventType":"default"}] Please create a summary email for me in HTML format. - Use a clean, professional design. - Group events by day if the range spans multiple days. - List events chronologically. - Highlight the time, summary, and location for each event. - If there are any overlapping events, flag them as potential conflicts. - Add a brief "At a Glance" summary at the top (e.g., "You have 5 events today, starting at 9:00 AM"). - Do not include the raw JSON in the output, only the HTML content.`;

  const testConfig = {
    message: testMessage,
    images: [] as Array<never>,
    systemPrompt:
      'You are a helpful personal executive assistant. Your goal is to create clear, concise, and formatted daily briefings.',
    model: {
      model: 'google/gemini-2.5-flash' as const,
      temperature: 0.3,
      maxTokens: 12800,
      maxRetries: 3,
      jsonMode: false,
    },
    tools: [] as Array<never>,
    maxIterations: 10,
  };

  // Skip if no API key
  const shouldSkip = !process.env.GOOGLE_API_KEY;

  if (shouldSkip) {
    console.log(
      '⚠️  Skipping Gemini 2.5 Flash reliability test - no GOOGLE_API_KEY environment variable'
    );
  }

  it(
    'should successfully generate HTML calendar summary 20 times without candidateContent.parts.reduce errors',
    async () => {
      if (shouldSkip) {
        return;
      }

      const credentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
      };

      const results: Array<{
        attempt: number;
        success: boolean;
        hasResponse: boolean;
        responseLength: number;
        error?: string;
        iterations?: number;
        executionTime?: number;
      }> = [];

      console.log(
        '🚀 Starting 20-iteration PARALLEL reliability test for Gemini 2.5 Flash...\n'
      );

      const overallStartTime = Date.now();

      // Create 20 parallel promises
      const promises = Array.from({ length: 20 }, (_, i) => {
        const attemptNumber = i + 1;
        const startTime = Date.now();

        return new AIAgentBubble({
          ...testConfig,
          credentials,
        })
          .action()
          .then((result) => {
            const executionTime = Date.now() - startTime;

            const testResult = {
              attempt: attemptNumber,
              success: result.success,
              hasResponse: !!result.data?.response,
              responseLength: result.data?.response?.length || 0,
              error: result.error,
              iterations: result.data?.iterations,
              executionTime,
            };

            // Check for the specific candidateContent.parts.reduce error
            if (result.error?.includes('candidateContent.parts.reduce')) {
              throw new Error(
                `❌ Attempt ${attemptNumber} failed with candidateContent.parts.reduce error: ${result.error}`
              );
            }

            // Verify success
            if (!result.success) {
              throw new Error(
                `❌ Attempt ${attemptNumber} failed: ${result.error || 'Unknown error'}`
              );
            }

            // Verify response exists
            if (!result.data?.response) {
              throw new Error(
                `❌ Attempt ${attemptNumber} returned no response`
              );
            }

            // Check if response contains HTML-like content
            const hasHtmlContent =
              result.data.response.includes('<') ||
              result.data.response.includes('html') ||
              result.data.response.length > 100;

            if (!hasHtmlContent) {
              console.warn(
                `⚠️  Attempt ${attemptNumber} response may not contain HTML: ${result.data.response.substring(0, 100)}...`
              );
            }

            console.log(
              `✅ Attempt ${attemptNumber}/20: Success (${executionTime}ms, ${result.data?.iterations || 0} iterations, ${result.data?.response?.length || 0} chars)`
            );

            return testResult;
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            console.error(
              `❌ Attempt ${attemptNumber}/20 failed: ${errorMessage}`
            );

            return {
              attempt: attemptNumber,
              success: false,
              hasResponse: false,
              responseLength: 0,
              error: errorMessage,
              executionTime: Date.now() - startTime,
            };
          });
      });

      // Wait for all promises to complete in parallel
      const allResults = await Promise.all(promises);

      const overallExecutionTime = Date.now() - overallStartTime;
      console.log(
        `\n⏱️  All 20 parallel requests completed in ${overallExecutionTime}ms\n`
      );

      // Sort results by attempt number for consistent reporting
      results.push(...allResults.sort((a, b) => a.attempt - b.attempt));

      // Summary statistics
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const avgResponseLength =
        results.reduce((sum, r) => sum + r.responseLength, 0) / results.length;
      const avgIterations =
        results.reduce((sum, r) => sum + (r.iterations || 0), 0) /
        results.length;

      console.log('\n📊 Test Summary:');
      console.log(`   ✅ Successful: ${successful}/20`);
      console.log(`   ❌ Failed: ${failed}/20`);
      console.log(
        `   📝 Avg Response Length: ${Math.round(avgResponseLength)} chars`
      );
      console.log(`   🔄 Avg Iterations: ${avgIterations.toFixed(1)}`);
      console.log('');

      // Final assertions
      expect(successful).toBe(20);
      expect(failed).toBe(0);

      // Verify no candidateContent.parts.reduce errors occurred
      const hasCandidateContentError = results.some((r) =>
        r.error?.includes('candidateContent.parts.reduce')
      );
      expect(hasCandidateContentError).toBe(false);

      // Verify all responses have content
      const allHaveResponse = results.every((r) => r.hasResponse);
      expect(allHaveResponse).toBe(true);

      // Verify average response length is reasonable (should be > 100 chars for HTML)
      expect(avgResponseLength).toBeGreaterThan(100);
    },
    {
      timeout: 300000, // 5 minutes timeout for 20 parallel iterations (should be much faster)
    }
  );

  it('should handle the exact calendar summary scenario once', async () => {
    if (shouldSkip) {
      return;
    }

    const credentials = {
      [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
    };

    const agent = new AIAgentBubble({
      ...testConfig,
      credentials,
    });

    const result = await agent.action();

    // Should not have the candidateContent.parts.reduce error
    expect(result.error).not.toContain('candidateContent.parts.reduce');
    expect(result.success).toBe(true);
    expect(result.data?.response).toBeDefined();
    expect(result.data?.response?.length).toBeGreaterThan(0);

    // Response should contain HTML-like content
    const response = result.data?.response || '';
    expect(
      response.includes('<') ||
        response.includes('html') ||
        response.length > 100
    ).toBe(true);

    console.log(
      `✅ Single test passed: ${response.length} chars, ${result.data?.iterations || 0} iterations`
    );
  });
});
