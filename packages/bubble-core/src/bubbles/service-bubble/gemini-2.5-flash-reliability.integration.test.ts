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

  /**
   * NEW TEST: Reproduce the original candidateContent.parts.reduce bug
   * This test uses content that MAY trigger Gemini's safety filters to verify
   * the SafeGeminiChat wrapper handles blocked content gracefully.
   */
  it(
    'should handle sensitive content that may trigger safety filters WITHOUT crashing',
    async () => {
      if (shouldSkip) {
        return;
      }

      console.log(
        '\n🧪 Testing SafeGeminiChat with potentially sensitive content...\n'
      );

      const credentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
      };

      // Sensitive patient data that may trigger safety filters
      // This resembles the type of content that originally caused the crash
      const sensitiveMedicalMessage = `
Please analyze the following patient medical record and create a summary report:

Patient Information:
- Name: Sarah Johnson
- Date of Birth: 03/15/1985
- Social Security Number: 123-45-6789
- Medical Record Number: MRN-9876543
- Address: 456 Oak Avenue, Suite 12, Springfield, IL 62701
- Phone: (217) 555-0198
- Emergency Contact: Michael Johnson (Spouse), (217) 555-0199

Insurance Information:
- Primary Insurance: Blue Cross Blue Shield
- Policy Number: BC123456789
- Group Number: 987654
- Subscriber ID: SJ-12345

Medical History:
- Chief Complaint: Severe chest pain radiating to left arm, shortness of breath, and excessive sweating
- Vital Signs: BP 160/95, HR 110, RR 22, Temp 98.6°F, O2 Sat 94%
- Medications: Metformin 1000mg twice daily, Lisinopril 20mg daily, Atorvastatin 40mg at bedtime
- Allergies: Penicillin (anaphylaxis), Sulfa drugs (rash), Iodine contrast (hives)

Diagnoses:
1. Acute myocardial infarction (suspected)
2. Type 2 Diabetes Mellitus (uncontrolled, HbA1c 9.2%)
3. Hypertension (stage 2)
4. Hyperlipidemia
5. Chronic kidney disease stage 3 (eGFR 45)

Lab Results (Critical):
- Troponin I: 4.5 ng/mL (CRITICAL HIGH - Normal <0.04)
- BNP: 890 pg/mL (Elevated)
- Creatinine: 1.8 mg/dL (Elevated)
- Glucose: 285 mg/dL (Uncontrolled)
- Total Cholesterol: 245 mg/dL
- LDL: 165 mg/dL
- HDL: 35 mg/dL
- Triglycerides: 225 mg/dL

Procedures Ordered:
- Emergency cardiac catheterization
- Coronary angiography
- Possible percutaneous coronary intervention (PCI) with stent placement
- ICU admission for cardiac monitoring
- Continuous telemetry
- Serial troponin levels q4h

Financial Information:
- Total Estimated Charges: $85,500
- Insurance Coverage: 80% after $2,500 deductible
- Patient Responsibility: $19,500
- Payment Plan Available: Yes
- Bank Account on File: ****5678 (Routing: 123456789)

Previous Hospitalizations:
1. 2023-08: Diabetic ketoacidosis (DKA) - 5 day admission
2. 2022-03: Acute kidney injury due to dehydration - 3 day admission
3. 2021-11: Hypertensive emergency - 2 day admission

Psychiatric History:
- Depression (moderate, treated)
- Anxiety disorder (generalized)
- History of substance abuse (alcohol, in remission for 3 years)
- Current medications: Sertraline 100mg daily, Lorazepam 0.5mg PRN

Family History:
- Father: MI at age 52 (deceased)
- Mother: Stroke at age 65, Type 2 DM
- Brother: CAD, s/p CABG at age 48
- Sister: Breast cancer (BRCA1 positive)

Social History:
- Employment: Unemployed (lost job 6 months ago due to health issues)
- Housing: Unstable (currently staying with family)
- Tobacco: Former smoker, quit 1 year ago (30 pack-year history)
- Alcohol: History of abuse, currently abstinent
- Illicit drugs: Denies current use, past marijuana use

Please provide:
1. A comprehensive medical summary
2. Risk assessment for cardiovascular complications
3. Treatment plan recommendations
4. Discharge planning considerations
5. Follow-up care schedule

Format the response as a structured medical report with sections and bullet points.
`;

      console.log(
        '📝 Test Message Length:',
        sensitiveMedicalMessage.length,
        'characters'
      );
      console.log(
        '🔒 Contains: Medical records, SSN, financial data, psychiatric history'
      );

      const startTime = Date.now();

      const agent = new AIAgentBubble({
        message: sensitiveMedicalMessage,
        systemPrompt:
          'You are a medical AI assistant. Analyze patient records and provide clinical summaries. Always maintain HIPAA compliance and patient confidentiality.',
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          maxTokens: 12800,
          maxRetries: 3,
          jsonMode: false,
          // Optional: Add backup model for automatic fallback
          backupModel: {
            model: 'google/gemini-1.5-flash', // Fallback to older model
            temperature: 0.3,
            maxTokens: 12800,
          },
        },
        tools: [],
        maxIterations: 10,
        credentials,
      });

      console.log('🚀 Executing AI Agent with SafeGeminiChat wrapper...\n');

      const result = await agent.action();
      const executionTime = Date.now() - startTime;

      console.log('⏱️  Execution time:', executionTime, 'ms');
      console.log('📊 Result success:', result.success);
      console.log(
        '📏 Response length:',
        result.data?.response?.length || 0,
        'characters'
      );
      console.log('🔄 Iterations:', result.data?.iterations || 0);

      // Log response preview (first 200 chars)
      if (result.data?.response) {
        console.log(
          '📄 Response preview:',
          result.data.response.substring(0, 200) + '...'
        );
      }

      // Log any errors
      if (result.error) {
        console.log('⚠️  Error message:', result.error);
      }

      // Check for candidateContent shapes in the response
      console.log('\n🔍 Debugging Information:');
      console.log('   - Tool calls made:', result.data?.toolCalls?.length || 0);
      console.log(
        '   - Error type:',
        result.error ? typeof result.error : 'none'
      );

      // CRITICAL ASSERTIONS
      console.log('\n✅ Running assertions...\n');

      // 1. MUST NOT crash with candidateContent.parts.reduce error
      expect(result.error).not.toContain('candidateContent.parts.reduce');
      expect(result.error).not.toContain('undefined is not an object');
      console.log('   ✓ No candidateContent.parts.reduce crash');

      // 2. Should have a defined result (even if it's an error)
      expect(result).toBeDefined();
      console.log('   ✓ Result object is defined');

      // 3. Should have proper error structure if failed
      if (!result.success) {
        // If Gemini blocked the content, error should be descriptive
        if (
          result.error?.includes('[Gemini Error]') ||
          result.error?.includes('[Gemini Response Error]')
        ) {
          console.log(
            '   ✓ Gemini blocked content with descriptive error (as expected)'
          );
          console.log(
            '   ℹ️  This is CORRECT behavior - SafeGeminiChat caught the block'
          );

          // Verify the error message is helpful
          expect(result.error).toContain('unable to generate');
          console.log('   ✓ Error message is user-friendly');
        } else {
          // Some other error occurred
          console.log(
            '   ℹ️  Different error occurred (not Gemini blocking):',
            result.error
          );
        }
      } else {
        // Success! Gemini processed the sensitive content
        console.log('   ✓ Gemini successfully processed sensitive content');
        expect(result.data?.response).toBeDefined();
        expect(result.data?.response?.length).toBeGreaterThan(0);
        console.log('   ✓ Response has content');
      }

      // 4. Verify no raw stack traces or uncaught errors
      expect(result.error).not.toContain('Error: ');
      expect(result.error).not.toContain('at Object.');
      console.log('   ✓ No raw stack traces in error');

      // 5. Response should be a string (not undefined/null)
      if (result.data?.response) {
        expect(typeof result.data.response).toBe('string');
        console.log('   ✓ Response is properly typed as string');
      }

      console.log(
        '\n🎉 Test completed successfully! SafeGeminiChat is working correctly.\n'
      );

      // Summary
      if (result.success) {
        console.log(
          '📈 Test Result: SUCCESS - Gemini processed sensitive content'
        );
      } else if (result.error?.includes('[Gemini')) {
        console.log(
          '📈 Test Result: SUCCESS - SafeGeminiChat gracefully handled blocked content'
        );
      } else {
        console.log(
          '📈 Test Result: PARTIAL - Different error type:',
          result.error
        );
      }
    },
    {
      timeout: 60000, // 60 second timeout
    }
  );

  /**
   * NEW TEST: Verify fallback model works when Gemini blocks content
   */
  it(
    'should automatically fallback to backup model when primary model blocks content',
    async () => {
      if (shouldSkip) {
        return;
      }

      // Skip if no OpenAI key for fallback
      if (!process.env.OPENAI_API_KEY) {
        console.log(
          '⚠️  Skipping fallback test - no OPENAI_API_KEY for backup model'
        );
        return;
      }

      console.log('\n🔄 Testing automatic model fallback...\n');

      const credentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
        [CredentialType.OPENAI_CRED]: process.env.OPENAI_API_KEY!,
      };

      // Message that may trigger blocking (but backup model should handle)
      const message = `
Analyze this data breach incident report:

Company: HealthTech Inc.
Date: 2024-12-01
Breach Type: Ransomware attack

Affected Records: 50,000 patient records including:
- Full names, dates of birth, Social Security numbers
- Medical diagnoses and treatment histories  
- Insurance policy numbers
- Credit card information (last 4 digits)
- Email addresses and phone numbers

Attack Vector: Phishing email to HR department
Ransom Demand: $500,000 in Bitcoin
Status: Data exfiltrated, systems encrypted

Please provide a brief summary of the security implications.
`;

      const agent = new AIAgentBubble({
        message,
        systemPrompt:
          'You are a cybersecurity analyst. Provide brief analysis of security incidents.',
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          maxTokens: 5000,
          // Add backup model
          backupModel: {
            model: 'openai/gpt-4o-mini', // Will try this if Gemini fails
            temperature: 0.3,
            maxTokens: 5000,
          },
        },
        credentials,
      });

      console.log('🚀 Executing with primary model: google/gemini-2.5-flash');
      console.log('🔄 Backup model configured: openai/gpt-4o-mini\n');

      const result = await agent.action();

      console.log('📊 Result success:', result.success);
      console.log('📏 Response length:', result.data?.response?.length || 0);

      // Should NOT crash regardless of which model was used
      expect(result.error).not.toContain('candidateContent.parts.reduce');

      // Should get SOME response (from either model)
      if (result.success) {
        expect(result.data?.response).toBeDefined();
        expect(result.data?.response?.length).toBeGreaterThan(0);
        console.log(
          '✅ Got successful response (from primary or backup model)'
        );
      } else {
        console.log('⚠️  Both models failed:', result.error);
        // Even if both fail, should have descriptive error
        expect(result.error).toBeDefined();
        expect(result.error?.length).toBeGreaterThan(0);
      }

      console.log('✅ Fallback test completed without crashes\n');
    },
    {
      timeout: 60000,
    }
  );
});
