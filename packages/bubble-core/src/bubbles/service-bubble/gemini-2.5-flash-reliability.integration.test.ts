import { describe, it, expect } from 'vitest';
import { AIAgentBubble } from '../../index.js';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Integration test for Gemini 2.5 Flash reliability
 * Tests the exact scenario that was failing with candidateContent.parts.reduce error
 * Runs 20 times to ensure consistent success
 */
describe('Gemini 2.5 Flash Reliability Test', () => {
  const testMessage = `Here is a list of my upcoming calendar events for the next 7 day(s): [{"id":"_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g6114acq26h1jce1l6ksk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g6p0j2dpn8l14cci46ko42e9k8d144gq18h348e1i84r4cdho692g","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=XzYwcTMwYzFnNjBvMzBlMWk2MG80YWMxZzYwcmo4Z3BsODhyajJjMWg4NHMzNGg5ZzYwczMwYzFnNjBvMzBjMWc2MTE0YWNxMjZoMWpjZTFsNmtzazhncGc2NG8zMGMxZzYwbzMwYzFnNjBvMzBjMWc2MG8zMmMxZzYwbzMwYzFnNnAwajJkcG44bDE0Y2NpNDZrbzQyZTlrOGQxNDRncTE4aDM0OGUxaTg0cjRjZGhvNjkyZyBzZWxpbmFsaUBidWJibGVsYWIuYWk","created":"2025-11-19T18:53:26.000Z","updated":"2025-11-20T17:45:00.539Z","summary":"Selina<>Ani | Catchup//Intro","description":"Hi Selina - pls use this zoom link:\n\nhttps://northwestern.zoom.us/j/95437428899\n\n\n\nTalk soon!\n\n\n\nAni\n","start":{"dateTime":"2025-11-20T14:30:00-08:00","timeZone":"America/Chicago"},"end":{"dateTime":"2025-11-20T14:40:00-08:00","timeZone":"America/Chicago"},"attendees":[{"email":"selinali@bubblelab.ai","responseStatus":"needsAction"},{"email":"aniruddh.singh@kellogg.northwestern.edu","responseStatus":"accepted","displayName":"Aniruddh Singh"}],"organizer":{"email":"aniruddh.singh@kellogg.northwestern.edu","displayName":"Aniruddh Singh"},"kind":"calendar#event","etag":"\"3527321401078622\"","creator":{"email":"selinali@bubblelab.ai","self":true},"iCalUID":"040000008200E00074C5B7101A82E008000000000BE3B4C68559DC010000000000000000100000006A177EBF2D50A94CBBCADFD82A6F682E","sequence":1,"guestsCanInviteOthers":false,"privateCopy":true,"reminders":{"useDefault":true},"eventType":"default"},{"id":"ag336flo1nnrfba6sep5le5uvc","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=YWczMzZmbG8xbm5yZmJhNnNlcDVsZTV1dmMgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-12T04:15:20.000Z","updated":"2025-11-14T02:33:55.143Z","summary":"Ava x Selina","description":"Follow up on Bubble Lab and Rho :)","start":{"dateTime":"2025-11-21T11:00:00-08:00","timeZone":"America/Los_Angeles"},"end":{"dateTime":"2025-11-21T11:30:00-08:00","timeZone":"America/Los_Angeles"},"attendees":[{"email":"selinali@bubblelab.ai","responseStatus":"needsAction"},{"email":"ava.gueits@rho.co","responseStatus":"accepted"}],"organizer":{"email":"ava.gueits@rho.co"},"conferenceData":{"entryPoints":[{"entryPointType":"video","uri":"https://rho-co.zoom.us/j/83815239874?pwd=QJGa04AKjAB3wiwSugualEn3t4j6pI.1&jst=2","label":"rho-co.zoom.us/j/83815239874?pwd=QJGa04AKjAB3wiwSugualEn3t4j6pI.1&jst=2","meetingCode":"83815239874","passcode":"296305"},{"regionCode":"US","entryPointType":"phone","uri":"tel:+13017158592,,83815239874#","label":"+1 301-715-8592","passcode":"296305"},{"entryPointType":"more","uri":"https://www.google.com/url?q=https://applications.zoom.us/addon/invitation/detail?meetingUuid%3D3jUImutiTVGW%252Bep5flT%252B%252Bw%253D%253D%26signature%3D20c51af573b419f9f3d80064717488b54a2c817d01f30e8fcc6a2ef136375217%26v%3D1&sa=D&source=calendar&usg=AOvVaw3GIewkNVExALqq7OpyMe1r"}],"conferenceSolution":{"key":{"type":"addOn"},"name":"Zoom Meeting","iconUri":"https://lh3.googleusercontent.com/pw/AM-JKLUkiyTEgH-6DiQP85RGtd_BORvAuFnS9katNMgwYQBJUTiDh12qtQxMJFWYH2Dj30hNsNUrr-kzKMl7jX-Qd0FR7JmVSx-Fhruf8xTPPI-wdsMYez6WJE7tz7KmqsORKBEnBTiILtMJXuMvphqKdB9X=s128-no"},"conferenceId":"83815239874","notes":"Meeting host: ava.gueits@rho.co\n\n\n\nJoin Zoom Meeting: \n\nhttps://rho-co.zoom.us/j/83815239874?pwd=QJGa04AKjAB3wiwSugualEn3t4j6pI.1&jst=2","parameters":{"addOnParameters":{"parameters":{"scriptId":"1O_9DeEljSH2vrECr8XeFYYRxFFiowFKOivqSDz316BlBcDXrF00BXrkO","realMeetingId":"83815239874","creatorUserId":"Tp36nVAITdCLdoih9VdTmA","meetingUuid":"3jUImutiTVGW+ep5flT++w==","meetingType":"2","originalEventId":"ag336flo1nnrfba6sep5le5uvc"}}}},"kind":"calendar#event","etag":"\"3526175270287294\"","creator":{"email":"ava.gueits@rho.co"},"iCalUID":"ag336flo1nnrfba6sep5le5uvc@google.com","sequence":2,"extendedProperties":{"shared":{"meetingId":"83815239874","zmMeetingNum":"83815239874","meetingParams":"{\"topic\":\"Ava x Selina\",\"type\":2,\"start_time\":\"2025-11-21T11:00:00-08:00\",\"duration\":30,\"timezone\":\"America/Los_Angeles\",\"invitees_hash\":\"le59dCFwGDjydgujs1Qc0A==\",\"all_day\":false}"}},"reminders":{"useDefault":true},"eventType":"default"},{"id":"8bqs4cocc1aar9nd60mqni9cf0","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=OGJxczRjb2NjMWFhcjluZDYwbXFuaTljZjAgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-10-29T05:34:50.000Z","updated":"2025-11-14T16:20:39.106Z","summary":"Selina Li and Robin Lim Fang Min","description":"Event Name\n\n30 min chat with Robin\n\n\n\nLocation: This is a Google Meet web conference.\n\nYou can join this meeting from your computer, tablet, or smartphone.\n\nhttps://calendly.com/events/c2cba2a2-6425-4343-af66-c700c403bf00/google_meet\n\n\n\nNeed to make changes to this event?\n\nCancel: https://calendly.com/cancellations/116c52e8-9da4-4c84-82d7-fbbd7319773c\n\nReschedule: https://calendly.com/reschedulings/116c52e8-9da4-4c84-82d7-fbbd7319773c\n\n\n\nPowered by Calendly.com\n","location":"Google Meet (instructions in description)","start":{"dateTime":"2025-11-21T11:30:00-08:00","timeZone":"Europe/Lisbon"},"end":{"dateTime":"2025-11-21T12:00:00-08:00","timeZone":"Europe/Lisbon"},"attendees":[{"email":"selinali@bubblelab.ai","responseStatus":"needsAction"},{"email":"robinlim.fm@gmail.com","responseStatus":"accepted"},{"email":"georgi@axy.digital","responseStatus":"needsAction"},{"email":"robin@axy.digital","responseStatus":"accepted"}],"organizer":{"email":"robinlim.fm@gmail.com"},"hangoutLink":"https://meet.google.com/oib-bpxf-zec","conferenceData":{"createRequest":{"requestId":"aea8f0d5-6f9d-4a22-9462-6ddbe2c200df","conferenceSolutionKey":{"type":"hangoutsMeet"},"status":{"statusCode":"success"}},"entryPoints":[{"entryPointType":"video","uri":"https://meet.google.com/oib-bpxf-zec","label":"meet.google.com/oib-bpxf-zec"}],"conferenceSolution":{"key":{"type":"hangoutsMeet"},"name":"Google Meet","iconUri":"https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png"},"conferenceId":"oib-bpxf-zec"},"kind":"calendar#event","etag":"\"3526274478213022\"","creator":{"email":"robinlim.fm@gmail.com"},"iCalUID":"8bqs4cocc1aar9nd60mqni9cf0@google.com","sequence":1,"reminders":{"useDefault":true},"eventType":"default"},{"id":"1nq9m5hbsjsh5lseqs4vvk976d","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=MW5xOW01aGJzanNoNWxzZXFzNHZ2azk3NmQgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-10T19:03:04.000Z","updated":"2025-11-10T19:03:04.665Z","summary":"Edward Lunch","start":{"date":"2025-11-22"},"end":{"date":"2025-11-23"},"organizer":{"email":"selinali@bubblelab.ai"},"kind":"calendar#event","etag":"\"3525602769330206\"","creator":{"email":"selinali@bubblelab.ai","self":true},"transparency":"transparent","iCalUID":"1nq9m5hbsjsh5lseqs4vvk976d@google.com","sequence":0,"reminders":{"useDefault":false},"eventType":"default"},{"id":"quvlgdrsl1j0bdtsfu731mjflc","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=cXV2bGdkcnNsMWowYmR0c2Z1NzMxbWpmbGMgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-19T00:36:36.000Z","updated":"2025-11-19T00:36:36.740Z","start":{"date":"2025-11-22"},"end":{"date":"2025-11-23"},"organizer":{"email":"selinali@bubblelab.ai"},"kind":"calendar#event","etag":"\"3527025193480574\"","creator":{"email":"selinali@bubblelab.ai","self":true},"transparency":"transparent","iCalUID":"quvlgdrsl1j0bdtsfu731mjflc@google.com","sequence":0,"reminders":{"useDefault":false},"eventType":"default"},{"id":"_clr78baj8pp4cobhb8pk8hb19926cq20clr6arjkecn6ot9edlgg","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=X2Nscjc4YmFqOHBwNGNvYmhiOHBrOGhiMTk5MjZjcTIwY2xyNmFyamtlY242b3Q5ZWRsZ2cgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-17T22:48:20.000Z","updated":"2025-11-17T22:48:21.427Z","summary":"AGI, Inc. x OpenAI x Lovable REAL Agent Challenge - Open Registration","description":"Get up-to-date information at: https://luma.com/event/evt-SFrFaqZ3DEaJDfh?pk=g-ncvy3fZEBtebVVj\n\n\n\nAddress:\n\nFrontier Tower @ Spaceship 995 Market Street, San Francisco\n\n\n\n∞ REAL Agent Challenge \n\nHosted by AGI, Inc. in collaboration with OpenAI and Lovable\n\n\n\n★ Event Highlights:\n\n💰 $15,000+ in prizes\n\n💬 Fast-track interviews with AGI, Inc.\n\n🌍 Custom billboard in SF for the top winner\n\n🔥 Fireside chats with researchers from frontier AI labs\n\n🤝 VC scout referrals to a16z speedrun and Afore Capital\n\n\n\nThe REAL Agent Challenge is the world's first 3 month sprint dedicated to building frontier autonomous web and computer-use agents. We have a live global leaderboard and huge prizes.\n\nWe will be opening the challenge with a two-day hackathon in SF and we're selecting top…\n\n\n\nHosted by AGI Inc. & 4 others","location":"Frontier Tower @ Spaceship 995 Market Street, San Francisco","start":{"dateTime":"2025-11-22T10:00:00-08:00","timeZone":"UTC"},"end":{"dateTime":"2025-11-23T20:00:00-08:00","timeZone":"UTC"},"attendees":[{"email":"selinali@bubblelab.ai","responseStatus":"accepted"}],"organizer":{"email":"calendar-invite@lu.ma","displayName":"Frontier Tower SF"},"kind":"calendar#event","etag":"\"3526839402854014\"","creator":{"email":"selinali@bubblelab.ai","self":true},"transparency":"transparent","iCalUID":"evt-SFrFaqZ3DEaJDfh@events.lu.ma","sequence":185582897,"guestsCanInviteOthers":false,"privateCopy":true,"reminders":{"useDefault":true},"attachments":[{"fileUrl":"https://mail.google.com/?view=att&th=19a940134366d7e4&attid=0.1&disp=attd&zw","title":"AGI, Inc. x OpenAI x Lovable REAL Agent Challenge - Open Registration.pkpass","iconLink":""}],"eventType":"default"},{"id":"5shclj0qej7ao7jv37apodnvgt","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=NXNoY2xqMHFlajdhbzdqdjM3YXBvZG52Z3Qgc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-18T18:06:12.000Z","updated":"2025-11-18T18:06:12.351Z","summary":"Thomas (NEA) lunch","start":{"date":"2025-11-24"},"end":{"date":"2025-11-25"},"organizer":{"email":"selinali@bubblelab.ai"},"kind":"calendar#event","etag":"\"3526978344702142\"","creator":{"email":"selinali@bubblelab.ai","self":true},"transparency":"transparent","iCalUID":"5shclj0qej7ao7jv37apodnvgt@google.com","sequence":0,"reminders":{"useDefault":false},"eventType":"default"},{"id":"mk13hvulp7l9uqoa66acd8dn98","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=bWsxM2h2dWxwN2w5dXFvYTY2YWNkOGRuOTggc2VsaW5hbGlAYnViYmxlbGFiLmFp","created":"2025-11-17T04:29:57.000Z","updated":"2025-11-17T04:30:01.425Z","summary":"Selina Li <> Alex Rankin - 25 minutes","description":"\n\n  Meeting type: 25 minutes\n\n  N/A\n\n  \n\n  Location:\n\n  N/A\n\n  \n\n\n\n  Provided infos:\n\n  Website: bubblelab.ai\n\n  \n\n  Need to make changes to this meeting ?\n\n  Cancel\n\n  Reschedule\n\n  ","start":{"dateTime":"2025-11-24T17:00:00-08:00","timeZone":"Asia/Singapore"},"end":{"dateTime":"2025-11-24T17:25:00-08:00","timeZone":"Asia/Singapore"},"attendees":[{"email":"selinali@bubblelab.ai","responseStatus":"accepted"},{"email":"alex@january.capital","responseStatus":"accepted"}],"organizer":{"email":"alex@january.capital"},"kind":"calendar#event","etag":"\"3526707602851550\"","creator":{"email":"alex@january.capital"},"iCalUID":"mk13hvulp7l9uqoa66acd8dn98@google.com","sequence":0,"reminders":{"useDefault":true},"eventType":"default"}]

 Please create a summary email for me in HTML format.

 - Use a clean, professional design.

 - Group events by day if the range spans multiple days.

 - List events chronologically.

 - Highlight the time, summary, and location for each event.

 - If there are any overlapping events, flag them as potential conflicts.

 - Add a brief "At a Glance" summary at the top (e.g., "You have 5 events today, starting at 9:00 AM").

 - Do not include the raw JSON in the output, only the HTML content.

 `;

  const testConfig = {
    message: testMessage,
    images: [] as Array<never>,
    systemPrompt:
      'You are a helpful personal executive assistant. Your goal is to create clear, concise, and formatted daily briefings.',
    model: {
      model: 'google/gemini-2.5-flash',
      temperature: 1,
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
        [CredentialType.OPENAI_CRED]: process.env.OPENAI_API_KEY!,
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

      const numIterations = 20;
      // Create 20 parallel promises
      const promises = Array.from({ length: numIterations }, (_, i) => {
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
        `\n⏱️  All  parallel requests completed in ${overallExecutionTime}ms\n`
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
      expect(successful).toBe(numIterations);
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
});
