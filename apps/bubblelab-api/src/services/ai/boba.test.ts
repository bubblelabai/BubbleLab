// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { validateBubbleFlow } from '@bubblelab/bubble-runtime';
import { runBoba } from './boba.js';

const PROMPT_LISTS = {
  'email-workflow': `Create a workflow that sends an email to user@example.com with subject "Hello" and body "Welcome to our platform!"`,
  'fiverr client outreach': `Proposal: Fiverr Client Outreach Automation via n8n (Manual Form Trigger)
Date: 2025-11-06

Objective: Automate and streamline Fiverr client handling for two key goals:
1. Hook new customers with data-driven, competitive, and personalized replies.
2. Maintain a structured backend for consistent logging, insight, and scalability.

Workflow Overview:
Trigger: Manual form (Webhook-based)
• A custom n8n Form acts as the trigger point.
• Fields: Client Name, Website URL, Message Snippet.
• Submission instantly starts the workflow pipeline.

Pipeline Stages:
1. Input Normalization – Clean and standardize submitted data.
2. Research Stage – Fetch target site data, extract titles/headings, and identify top competitors.
3. AI Draft Generation – Generate personalized reply drafts via GPT (non-repetitive, concise, contextual).
4. Brief Generation – Create structured Excel/CSV briefs for content production.
5. Logging & Storage – Append complete run data to a central log (Google Sheets + Database).
6. Notification – Send final draft and summary via email/Telegram with run link.

Backend Architecture:
1. Data Logging
• Primary Log: Google Sheets for easy access and editing.
• Secondary Log: PostgreSQL/Database for long-term structured storage.
• Backup Artifacts: Google Drive (CSV briefs, prompt JSONs, site snapshots).

2. Fields Logged
run_id, lead_id, trigger_ts, source, client_name, website_url, client_message, cleaned_message, research_results, competitors_json, keywords_json, llm_model, prompt_version, tokens, reply_draft, brief_link, status, execution_url, and other metadata.

3. Audit and Retention
• Google Sheets: Keep last 90 days of active data.
• Database: Full archive for 1–2 years.
• Monthly n8n Cron job exports old rows to Drive as CSV.

Technology Stack:
• n8n (Workflow Automation)
• Google Sheets API (Log Storage)
• Google Drive API (File Storage)
• PostgreSQL (Optional Structured DB)
• Telegram/Email (Notifications)
• OpenAI API (LLM Drafting)
• HTTP Requests (Site Data + Competitor Lookup)

Advantages:
• Completely Fiverr ToS-safe (manual trigger, no direct message automation).
• Simple one-click manual form trigger for you/team.
• Centralized, queryable log of all outreach activity.
• Automated briefing, competitor extraction, and AI responses.
• Scalable structure for future trigger upgrades (Gmail, Telegram, API).

Deliverables:
1. n8n Workflow (Webhook form → Research → AI → Log → Notify)
2. Google Sheets integration for run tracking
3. PostgreSQL schema (for structured long-term storage)
4. Template Google Drive folders for briefs and artifacts
5. Documentation on prompt versioning and archiving

Outcome: A semi-automated, ToS-compliant Fiverr outreach system that saves time, keeps data organized, and provides data-driven personalization at scale.
-- End of Proposal --`,
  'json-flowwise': `Convert the following JSON file to a workflow: {
  "nodes": [
    {
      "id": "startAgentflow_0",
      "type": "agentFlow",
      "position": { "x": -63.5, "y": 95 },
      "data": {
        "id": "startAgentflow_0",
        "label": "Start",
        "version": 1.1,
        "name": "startAgentflow",
        "type": "Start",
        "color": "#7EE787",
        "hideInput": true,
        "baseClasses": ["Start"],
        "category": "Agent Flows",
        "description": "Starting point of the agentflow",
        "inputParams": [
          {
            "label": "Input Type",
            "name": "startInputType",
            "type": "options",
            "options": [
              { "label": "Chat Input", "name": "chatInput", "description": "Start the conversation with chat input" },
              { "label": "Form Input", "name": "formInput", "description": "Start the workflow with form inputs" }
            ],
            "default": "chatInput",
            "id": "startAgentflow_0-input-startInputType-options",
            "display": true
          },
          {
            "label": "Ephemeral Memory",
            "name": "startEphemeralMemory",
            "type": "boolean",
            "description": "Start fresh for every execution without past chat history",
            "optional": true,
            "id": "startAgentflow_0-input-startEphemeralMemory-boolean",
            "display": true
          },
          {
            "label": "Flow State",
            "name": "startState",
            "description": "Runtime state during the execution of the workflow",
            "type": "array",
            "optional": true,
            "array": [
              { "label": "Key", "name": "key", "type": "string", "placeholder": "Foo" },
              { "label": "Value", "name": "value", "type": "string", "placeholder": "Bar", "optional": true }
            ],
            "id": "startAgentflow_0-input-startState-array",
            "display": true
          },
          {
            "label": "Persist State",
            "name": "startPersistState",
            "type": "boolean",
            "description": "Persist the state in the same session",
            "optional": true,
            "id": "startAgentflow_0-input-startPersistState-boolean",
            "display": true
          }
        ],
        "inputAnchors": [],
        "inputs": {
          "startInputType": "chatInput",
          "startEphemeralMemory": "",
          "startState": "",
          "startPersistState": ""
        },
        "outputAnchors": [
          { "id": "startAgentflow_0-output-startAgentflow", "label": "Start", "name": "startAgentflow" }
        ],
        "outputs": {},
        "selected": false
      },
      "width": 103,
      "height": 66,
      "selected": false,
      "positionAbsolute": { "x": -63.5, "y": 95 },
      "dragging": false
    },
    {
      "id": "agentAgentflow_0",
      "position": { "x": 128.5, "y": 79.75 },
      "data": {
        "id": "agentAgentflow_0",
        "label": "Agent 0",
        "version": 2.2,
        "name": "agentAgentflow",
        "type": "Agent",
        "color": "#4DD0E1",
        "baseClasses": ["Agent"],
        "category": "Agent Flows",
        "description": "Dynamically choose and utilize tools during runtime, enabling multi-step reasoning",
        "inputParams": [
          {
            "label": "Model",
            "name": "agentModel",
            "type": "asyncOptions",
            "loadMethod": "listModels",
            "loadConfig": true,
            "id": "agentAgentflow_0-input-agentModel-asyncOptions",
            "display": true
          },
          {
            "label": "Messages",
            "name": "agentMessages",
            "type": "array",
            "optional": true,
            "acceptVariable": true,
            "array": [
              {
                "label": "Role",
                "name": "role",
                "type": "options",
                "options": [
                  { "label": "System", "name": "system" },
                  { "label": "Assistant", "name": "assistant" },
                  { "label": "Developer", "name": "developer" },
                  { "label": "User", "name": "user" }
                ]
              },
              {
                "label": "Content",
                "name": "content",
                "type": "string",
                "acceptVariable": true,
                "generateInstruction": true,
                "rows": 4
              }
            ],
            "id": "agentAgentflow_0-input-agentMessages-array",
            "display": true
          },
          {
            "label": "Gemini Built-in Tools",
            "name": "agentToolsBuiltInGemini",
            "type": "multiOptions",
            "optional": true,
            "options": [
              { "label": "URL Context", "name": "urlContext", "description": "Extract content from given URLs" },
              { "label": "Google Search", "name": "googleSearch", "description": "Search real-time web content" }
            ],
            "show": { "agentModel": "chatGoogleGenerativeAI" },
            "id": "agentAgentflow_0-input-agentToolsBuiltInGemini-multiOptions",
            "display": true
          },
          {
            "label": "Tools",
            "name": "agentTools",
            "type": "array",
            "optional": true,
            "array": [
              {
                "label": "Tool",
                "name": "agentSelectedTool",
                "type": "asyncOptions",
                "loadMethod": "listTools",
                "loadConfig": true
              },
              {
                "label": "Require Human Input",
                "name": "agentSelectedToolRequiresHumanInput",
                "type": "boolean",
                "optional": true
              }
            ],
            "id": "agentAgentflow_0-input-agentTools-array",
            "display": true
          },
          {
            "label": "Enable Memory",
            "name": "agentEnableMemory",
            "type": "boolean",
            "description": "Enable memory for the conversation thread",
            "default": true,
            "optional": true,
            "id": "agentAgentflow_0-input-agentEnableMemory-boolean",
            "display": true
          },
          {
            "label": "Memory Type",
            "name": "agentMemoryType",
            "type": "options",
            "options": [
              { "label": "All Messages", "name": "allMessages", "description": "Retrieve all messages from the conversation" },
              { "label": "Window Size", "name": "windowSize", "description": "Uses a fixed window size to surface the last N messages" },
              { "label": "Conversation Summary", "name": "conversationSummary", "description": "Summarizes the whole conversation" },
              { "label": "Conversation Summary Buffer", "name": "conversationSummaryBuffer", "description": "Summarize conversations once token limit is reached. Default to 2000" }
            ],
            "optional": true,
            "default": "allMessages",
            "show": { "agentEnableMemory": true },
            "id": "agentAgentflow_0-input-agentMemoryType-options",
            "display": true
          },
          {
            "label": "Return Response As",
            "name": "agentReturnResponseAs",
            "type": "options",
            "options": [
              { "label": "User Message", "name": "userMessage" },
              { "label": "Assistant Message", "name": "assistantMessage" }
            ],
            "default": "userMessage",
            "id": "agentAgentflow_0-input-agentReturnResponseAs-options",
            "display": true
          }
        ],
        "inputAnchors": [],
        "inputs": {
          "agentModel": "chatGoogleGenerativeAI",
          "agentMessages": [
            {
              "role": "system",
              "content": "<p>You are an expert AI Talent Acquisition Specialist. Your task is to evaluate a candidate's profile against the specific job they selected, using the full job description and requirements retrieved from the Google Sheet of open jobs. You must analyze the candidate only in the context of the job row that matches their chosen job title.</p><p>After generating the structured JSON output, update the same Google Sheet title \"Candidates Info\" with this data, matching on the candidate's email address. If the email already exists, update the row. If it does not exist, append a new row.</p><p>---</p><p>### Critical Analysis Principles ###</p><p>1. <strong>Evidence Over Claims:</strong> Only consider concrete, verifiable details as strengths. A <code>key_strength</code> must reference a specific skill, tool, technology (e.g., \"Python\", \"Jira\"), methodology (e.g., \"Agile\"), or a quantifiable achievement (e.g., \"increased sales by 20%\").</p><p>2. <strong>Scrutinize Vague Language:</strong> Treat buzzwords, jargon, or generic claims (e.g., \"drove synergy\") as weak unless supported by evidence.</p><p>3. <strong>Vagueness is a Red Flag:</strong> Any description lacking tangible details should be flagged in <code>potential_red_flags</code>.</p><p>---</p><p>### Instructions ###</p><p>1. <strong>Holistic Analysis:</strong> Review all candidate details together with the job description row from the Google Sheet that matches the candidate's selected job title.</p><p>2. <strong>Suitability Score:</strong> Assign a <code>suitability_score</code> from 1–10, based on how well the candidate's profile aligns with the job's required skills, experience level, and responsibilities. Penalize vague or unsupported claims.</p><p>3. <strong>Seniority Level:</strong> Based on \"Years of Experience,\" assign a <code>suggested_level</code>:</p><p>- 0–2 years: Junior</p><p>- 3–5 years: Mid-level</p><p>- 6–10 years: Senior</p><p>- 11+ years: Lead / Principal</p><p>4. <strong>Strengths &amp; Red Flags:</strong></p><p>- <code>key_strengths</code>: List 2–4 strong, evidence-based qualifications that directly match the job requirements from the Google Sheet.</p><p>- <code>potential_red_flags</code>: List any concerns (e.g., vagueness, missing evidence, or mismatches with the job requirements). If none, return an empty array <code>[]</code>.</p><p>5. <strong>Professional Summary:</strong> Write a concise 2–3 sentence summary that reflects the candidate's fit for the specific job. If the profile is vague or mismatched, explicitly note that.</p><p>6. <strong>Strict Output Format:</strong> Return only a single valid JSON object that conforms exactly to this schema:</p><p>{</p><p>\"candidate_name\": \"string\",</p><p>\"candidate_email\": \"string\",</p><p>\"suitability_score\": \"integer (1–10)\",</p><p>\"suggested_role\": \"string\",</p><p>\"suggested_level\": \"Junior | Mid-level | Senior | Lead / Principal\",</p><p>\"key_strengths\": [\"string\", \"string\"],</p><p>\"potential_red_flags\": [\"string\", \"string\"],</p><p>\"summary\": \"string\"</p><p>}</p><p>7. <strong>Update Google Sheet:</strong> Write this JSON output into the Google Sheet named \"Candidates Info\". Use the candidate's email as the unique key:</p><p>- If the email exists, update the row with the new values.</p><p>- If the email does not exist, append a new row with the candidate's data.</p><p>Do not include any conversational text, explanations, or markdown formatting outside of this JSON and the update action.</p>"
            }
          ],
          "agentToolsBuiltInGemini": "",
          "agentTools": [
            {
              "agentSelectedTool": "googleSheetsTool",
              "agentSelectedToolRequiresHumanInput": "",
              "agentSelectedToolConfig": {
                "sheetsType": "spreadsheet",
                "spreadsheetId": "1qfK2tyPL2FXAbuKGSQnkWByKNC24xlLGHw-eNhDmgzs",
                "agentSelectedTool": "googleSheetsTool",
                "spreadsheetActions": "[\"createSpreadsheet\"]",
                "title": "Jobs"
              }
            },
            {
              "agentSelectedTool": "googleSheetsTool",
              "agentSelectedToolRequiresHumanInput": "",
              "agentSelectedToolConfig": {
                "sheetsType": "spreadsheet",
                "spreadsheetActions": "[\"updateSpreadsheet\"]",
                "spreadsheetId": "1qfK2tyPL2FXAbuKGSQnkWByKNC24xlLGHw-eNhDmgzs",
                "agentSelectedTool": "googleSheetsTool",
                "title": "Candidates Info"
              }
            }
          ],
          "agentKnowledgeDocumentStores": "",
          "agentKnowledgeVSEmbeddings": "",
          "agentEnableMemory": true,
          "agentMemoryType": "allMessages",
          "agentUserMessage": "",
          "agentReturnResponseAs": "userMessage",
          "agentUpdateState": "",
          "agentModelConfig": {
            "cache": "",
            "modelName": "gemini-2.5-flash",
            "customModelName": "",
            "temperature": "0.4",
            "streaming": true,
            "maxOutputTokens": "",
            "topP": "",
            "topK": "",
            "safetySettings": "",
            "baseUrl": "",
            "allowImageUploads": "",
            "agentModel": "chatGoogleGenerativeAI"
          }
        },
        "outputAnchors": [
          { "id": "agentAgentflow_0-output-agentAgentflow", "label": "Agent", "name": "agentAgentflow" }
        ],
        "outputs": {},
        "selected": false
      },
      "type": "agentFlow",
      "width": 199,
      "height": 100,
      "selected": false,
      "positionAbsolute": { "x": 128.5, "y": 79.75 },
      "dragging": false
    }
  ],
  "edges": [
    {
      "source": "startAgentflow_0",
      "sourceHandle": "startAgentflow_0-output-startAgentflow",
      "target": "agentAgentflow_0",
      "targetHandle": "agentAgentflow_0",
      "data": {
        "sourceColor": "#7EE787",
        "targetColor": "#4DD0E1",
        "isHumanInput": false
      },
      "type": "agentFlow",
      "id": "startAgentflow_0-startAgentflow_0-output-startAgentflow-agentAgentflow_0-agentAgentflow_0"
    }
  ]
}`,
};

describe('Pearl AI Agent Code Generation Repeated test', () => {
  it.skip('should generate a simple email workflow with Gemini 2.5 pro', async () => {
    const testPrompt = PROMPT_LISTS['email-workflow'];
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
    const testPrompt = PROMPT_LISTS['fiverr client outreach'];
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

  it('should generate AI Talent Acquisition workflow from JSON', async () => {
    const testPrompt = PROMPT_LISTS['json-flowwise'];
    const totalRuns = 1;
    const requiredPasses = 1;

    // Run all tests in parallel
    const promises = Array.from({ length: totalRuns }, async (_, index) => {
      const result = await runBoba({ prompt: testPrompt });
      const validationResult = await validateBubbleFlow(result.generatedCode);
      const passed = validationResult.valid;
      console.log(
        `JSON Workflow Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`
      );
      if (!passed) {
        console.log(
          `Validation errors: ${JSON.stringify(validationResult.errors)}`
        );
      }
      const numTimeEditWorkflowUsed = result.toolCalls.filter(
        (call) => (call as any).tool === 'editWorkflow'
      ).length;
      const numTimeCreate = result.toolCalls.filter(
        (call) => (call as any).tool === 'createWorkflow'
      ).length;
      console.log(
        `Edit workflow tool used ${numTimeEditWorkflowUsed} times in test ${index + 1}`
      );
      return {
        success: passed,
        numTimeEditWorkflowUsed,
        numTimeCreate,
      };
    });

    const results = await Promise.all(promises);
    const passCount = results.filter((result) => result.success).length;
    // Number of times create workflow was used more than once
    const numTimeCreateMoreThanOnce = results.filter(
      (result) => result.numTimeCreate > 1
    ).length;
    console.log(
      `Number of times create workflow was used more than once: ${numTimeCreateMoreThanOnce}`
    );
    console.log(
      `\nJSON Workflow Results: ${passCount}/${totalRuns} tests passed`
    );
    expect(passCount).toBeGreaterThanOrEqual(requiredPasses);
  }, 400000);
});
