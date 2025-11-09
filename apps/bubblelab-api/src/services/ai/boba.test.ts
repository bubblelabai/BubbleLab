// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { validateBubbleFlow } from '@bubblelab/bubble-runtime';
import { runBoba } from './boba.js';

describe('Pearl AI Agent Code Generation', () => {
  it.skip('should generate a simple email workflow with Gemini 2.5 pro', async () => {
    const testPrompt = `Create a workflow that sends an email to user@example.com with subject "Hello" and body "Welcome to our platform!"`;
    const result = await runBoba({ prompt: testPrompt });
    const validationResult = await validateBubbleFlow(result.generatedCode);
    expect(validationResult.valid).toBe(true);
    expect(result.generatedCode).toContain('BubbleFlow');
    expect(result.generatedCode).toContain('user@example.com');
    expect(result.generatedCode).toContain('Hello');
    expect(result.generatedCode).toContain('Welcome to our platform!');
    console.log(result.summary);
  }, 400000);
  it.skip('should generate complex workflow with multiple bubbles', async () => {
    // Require passing 9 out of 10 times
    const testPrompt = `Proposal: Fiverr Client Outreach Automation via n8n (Manual Form Trigger) Date: 2025-11-06 Objective: Automate and streamline Fiverr client handling for two key goals: 1. Hook new customers with data-driven, competitive, and personalized replies. 2. Maintain a structured backend for consistent logging, insight, and scalability. Workflow Overview: Trigger: Manual form (Webhook-based) • A custom n8n Form acts as the trigger point. • Fields: Client Name, Website URL, Message Snippet. • Submission instantly starts the workflow pipeline. Pipeline Stages: 1. Input Normalization – Clean and standardize submitted data. 2. Research Stage – Fetch target site data, extract titles/headings, and identify top competitors. 3. AI Draft Generation – Generate personalized reply drafts via GPT (non-repetitive, concise, contextual). 4. Brief Generation – Create structured Excel/CSV briefs for content production. 5. Logging & Storage – Append complete run data to a central log (Google Sheets + Database). 6. Notification – Send final draft and summary via email/Telegram with run link. Backend Architecture: 1. Data Logging • Primary Log: Google Sheets for easy access and editing. • Secondary Log: PostgreSQL/Database for long-term structured storage. • Backup Artifacts: Google Drive (CSV briefs, prompt JSONs, site snapshots). 2. Fields Logged run_id, lead_id, trigger_ts, source, client_name, website_url, client_message, cleaned_message, research_results, competitors_json, keywords_json, llm_model, prompt_version, tokens, reply_draft, brief_link, status, execution_url, and other metadata. 3. Audit and Retention • Google Sheets: Keep last 90 days of active data. • Database: Full archive for 1–2 years. • Monthly n8n Cron job exports old rows to Drive as CSV. Technology Stack: • n8n (Workflow Automation) • Google Sheets API (Log Storage) • Google Drive API (File Storage) • PostgreSQL (Optional Structured DB) • Telegram/Email (Notifications) • OpenAI API (LLM Drafting) • HTTP Requests (Site Data + Competitor Lookup) Advantages: • Completely Fiverr ToS-safe (manual trigger, no direct message automation). • Simple one-click manual form trigger for you/team. • Centralized, queryable log of all outreach activity. • Automated briefing, competitor extraction, and AI responses. • Scalable structure for future trigger upgrades (Gmail, Telegram, API). Deliverables: 1. n8n Workflow (Webhook form → Research → AI → Log → Notify) 2. Google Sheets integration for run tracking 3. PostgreSQL schema (for structured long-term storage) 4. Template Google Drive folders for briefs and artifacts 5. Documentation on prompt versioning and archiving Outcome: A semi-automated, ToS-compliant Fiverr outreach system that saves time, keeps data organized, and provides data-driven personalization at scale. -- End of Proposal --`;
    const totalRuns = 10;
    const requiredPasses = 9;

    // Run all tests in parallel
    const promises = Array.from({ length: totalRuns }, async (_, index) => {
      try {
        const result = await runBoba({ prompt: testPrompt });
        const validationResult = await validateBubbleFlow(result.generatedCode);
        const passed = validationResult.valid;
        console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
        return passed;
      } catch (error) {
        console.log(`Test ${index + 1}: FAIL (error: ${error})`);
        return false;
      }
    });
    const results = await Promise.all(promises);
    const passCount = results.filter(Boolean).length;
    console.log(`\nResults: ${passCount}/${totalRuns} tests passed`);
    expect(passCount).toBeGreaterThanOrEqual(requiredPasses);
  }, 4000000);
});
