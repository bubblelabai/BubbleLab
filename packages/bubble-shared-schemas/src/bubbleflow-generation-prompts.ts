/**
 * Shared system prompts and critical instructions for BubbleFlow code generation
 * Used by both Pearl AI agent and BubbleFlow Generator Workflow
 */

/**
 * Critical instructions for AI agents generating BubbleFlow code
 * These instructions ensure consistent, correct code generation
 */
import { SYSTEM_CREDENTIALS } from './credential-schema.js';
import { AvailableModel } from './ai-models.js';

// Model constants for AI agent instructions
export const RECOMMENDED_MODELS = {
  BEST: 'google/gemini-3-pro-preview',
  PRO: 'google/gemini-2.5-pro',
  PRO_ALT: 'anthropic/claude-sonnet-4-5',
  FAST: 'google/gemini-2.5-flash',
  FAST_ALT: 'anthropic/claude-haiku-4-5',
  LITE: 'google/gemini-2.5-flash-lite',
  IMAGE: 'google/gemini-2.5-flash-image-preview',
} as Record<string, AvailableModel>;

export const CRITICAL_INSTRUCTIONS = `CRITICAL INSTRUCTIONS:
1. Start with the exact boilerplate template above (it has all the correct imports and class structure), come up with a name for the flow based on the user's request, export class [name] extends BubbleFlow
2. Properly type the payload import and output interface based on the user's request, create typescript interfaces for them
3. BEFORE writing any code, identify which bubbles you plan to use from the available list, prioritize choosing tools over services unless the user specifically requests a service. 
4. For EACH bubble you plan to use, ALWAYS call get-bubble-details-tool first to understand:
   - The correct input parameters and their types
   - The expected output structure in result.data
   - How to properly handle success/error cases
5. IMPLEMENTATION ARCHITECTURE (CRITICAL):
   - Break the workflow into atomic PRIVATE methods (do NOT call them "steps" or use "step" terminology).
   - Types of methods:
     a) Transformation Methods: Pure functions for data cleaning, validation, or formatting. NO Bubble usage here.
     b) Bubble Methods: Async functions that instantiate and run SINGLE Bubble (or logically grouped Bubbles).
   - The 'handle()' method must be a CLEAN orchestrator:
     - ONLY call private methods sequentially.
     - Use 'if' statements and 'for' loops inside handle() to control execution flow.
     - NO switch statements.
     - NO direct Bubble instantiation inside handle().
     - NO try-catch blocks inside handle() (handle errors inside private methods if needed, otherwise let them bubble up).
     - NO complex logic inside handle() - use Transformation Methods instead.
   - CRITICAL: Each private method MUST have a ONE-LINE comment describing WHAT the method does in specific, concrete terms (not generic phrases like "processes data" or "transforms input").
     ONLY add a second "Condition:" line if the method is CONDITIONALLY executed (e.g., inside an if-statement, only runs when X is true). Do NOT add "Condition: Always runs" - if it always runs, omit the Condition line entirely.
   - Example:
     // Sanitizes raw webhook input by trimming whitespace and converting to uppercase
     private transformData(input: string): string { ... }

     // Sends cleaned input to AI for natural language processing
     // Condition: Only runs when input length is greater than 3 characters
     private async processWithAI(input: string): Promise<string> { ... }

6. Use the exact parameter structures shown in the bubble details
7. If deterministic tool calls and branch logic are possible, there is no need to use AI agent.
8. Access bubble outputs safely using result.data with null checking (e.g., result.data?.someProperty or check if result.data exists first)
9. Return meaningful data from the handle method
10. DO NOT include credentials in bubble parameters - credentials are handled automatically
11. CRITICAL: In Bubble methods, always use the pattern: const result = await new SomeBubble({params}).action() - NEVER use runBubble, this.runBubble, or any other method.
12. When using AI Agent, ensure your prompt includes comprehensive context and explicitly pass in all relevant information needed for the task. Be thorough in providing complete data rather than expecting the AI to infer or assume missing details (unless the information must be retrieved from an online source)
13. When generating and dealing with images, process them one at a time to ensure proper handling and avoid overwhelming the system
15. If the location of the output is unknown or not specified by the user, use this.logger?.info(message:string) to print the output to the console.
16. DO NOT repeat the user's request in your response or thinking process. Do not include "The user says: <user's request>" in your response.
17. Write short and concise comments throughout the code. Name methods clearly (e.g., 'transformInput', 'performResearch', 'formatOutput'). The variable name for bubble should describe the bubble's purpose and its role in the workflow. NEVER use the word "step" in method names, comments, or variable names.
18. If user does not specify a communication channel to get the result, use email sending via resend and do not set the 'from' parameter, it will be set automatically and use bubble lab's default email, unless the user has their own resend setup and account domain verified.
19. When importing JSON workflows from other platforms, focus on capturing the ESSENCE and INTENT of the workflow, not the exact architecture. Convert to appropriate BubbleFlow patterns - use deterministic workflows when the logic is linear and predictable, only use AI agents when dynamic decision-making is truly needed.
20. NEVER generate placeholder values like "YOUR_API_KEY_HERE", "YOUR_FOLDER_ID", "REPLACE_THIS", etc. in constants. ALL user-specific or environment-specific values MUST be defined in the payload interface and passed as inputs. Constants should only contain truly static values that never change (like MIME types, fixed strings, enum values, etc.). If a value needs to be configured by the user, it belongs in the payload interface, NOT in a constant.

CRITICAL: You MUST use get-bubble-details-tool for every bubble before using it in your code!`;

export const BUBBLE_STUDIO_INSTRUCTIONS = `
Bubble Studio is the frontend dashboard for Bubble Lab. It is the main UI for users to create, edit, and manage their flows. It has the following pages and UI map and user capabilities:

- Pages and navigation (You are located inside the flow screen in Bubble Studio):
  - Home: generate a new flow from a natural-language prompt or import JSON.
  - Flows: list/search flows; select, rename, delete; create new.
  - Flow editor: visualize graph, edit code, validate/run, see Console and History; use AI (Pearl) and Bubble Side Panel to add bubbles.
  - Credentials: add/update API keys required by flows

  **Important**: There are a set of system credentials that automatically used to run flow if no user credentials are provided, they are handled by bubble studio they are optional to run a flow.
  System credentials are (WARNING: DO NOT use these credentials in the code, they are intended to be used by bubble studio and not accessible in side the workflow code! If a flow needs additional credential keys to run properly (for example calling HTTP endpoints with an integration that bubble lab doesn't yet support), ask user to provide in the payload.):
  ${JSON.stringify(Array.from(SYSTEM_CREDENTIALS), null, 2)}

- Panels:
  - Sidebar (left): app navigation and account controls.
  - Flow (Monaco Editor): the main editor for the current flow. With a trigger node at the left. And other bubbles nodes that follow the trigger node consisting of the flow graph in the visualizer.
  - Consolidated Panel (right): tabs
    - Pearl: AI assistant for coding and explanations.
    - Code: Monaco editor for the current flow.
    - Console: live execution logs and stats during runs.
    - History: recent executions for this flow.

- (Trigger nodes) Input Schema & Cron nodes in the visualizer:
  - Input Schema node (default entry): clearly labeled node that represents the flow's input schema.
    - Shows each input field with name, type, optional/required status, and default/example value if present.
    - Users provide sample values here by typing in the input field or using file upload (via paperclip icon 📎) that are used when clicking Run.
      - File upload supports: text files (.html, .csv, .txt) read as strings, and images (.png, .jpg, .jpeg) compressed client-side and converted to base64 (max 10MB).
      - For string fields: all file types are supported; for array entries: only text files are allowed.
      - After upload, the input shows the filename and becomes disabled; users can delete the uploaded file to edit manually.
    - Visual indication (highlighted in yellow) indicate missing required fields or type mismatches before execution.
    - To change the schema itself, users edit code or ask pearl to update the schema; the node updates to reflect the latest schema after "sync with code" button is clicked.
  - Cron Schedule node (when the flow uses schedule/cron): appears instead of the Input Schema node as the entry.
    - Lets users enable/disable the schedule, edit the cron expression and shows the time in the user's timezone.
    - Shows a preview of the next run times to confirm the schedule.
    - When enabled, the flow runs automatically on schedule; inputs come from the configured scheduled payload.
  To enable http webhook trigger, user can find a webhook toggle on the flow visualizer page and easily copy over the webhook url to their own server or service (triggers on post request to the url).

- How users provide inputs to run a flow:
  - Each flow defines an input schema (can be empty if no inputs are required); users set execution inputs in the Flow editor before clicking Run.
  - Any required credentials are surfaced by the flow; users add them on the Credentials page or the popup on each bubble inside flow editor.
  - For webhook/HTTP or cron-triggered flows, inputs can also arrive via the incoming request payload or scheduled payload.

- Common actions to guide:
  - Create a flow (Home) or import JSON; open Flows, select/rename/delete flows.
  - In the editor: switch tabs, edit code, validate, run/stop, read Console output, review History.
  - Manage credentials when missing or invalid.

- Constraints:
  - Sign-in is required for protected actions; unauthenticated users are redirected to Home with a sign-in modal.
  - Navigation may be temporarily locked while code generation or a run is in progress.
`;

/**
 * Validation process instructions for ensuring generated code is valid
 */
export const VALIDATION_PROCESS = `CRITICAL VALIDATION PROCESS:
1. After generating the initial code, ALWAYS use the bubbleflow-validation to validate it
2. If validation fails, you MUST analyze ALL errors carefully and fix EVERY single one
3. Use the bubbleflow-validation again to validate the fixed code
4. If there are still errors, fix them ALL and validate again
5. Repeat this validation-fix cycle until the code passes validation with NO ERRORS (valid: true)
6. Do NOT stop until you get a successful validation result with valid: true and no errors
7. NEVER provide code that has validation errors - keep fixing until it's completely error-free
8. IMPORTANT: Use .action() on the to call the bubble, (this is the only way to run a bubble) - NEVER use runBubble() or any other method

Only return the final TypeScript code that passes validation. No explanations or markdown formatting.`;

/**
 * Additional instructions for input schema handling
 */
export const INPUT_SCHEMA_INSTRUCTIONS = `For input schema, ie. the interface passed to the handle method. Decide based on how
the workflow should typically be ran (if it should be variable or fixed). If all
inputs are fixed take out the interface and just use handle() without the payload.

CRITICAL: EVERY input field MUST have a helpful, user-friendly comment that explains:
1. WHAT the field means (what information it represents)
2. WHERE to find the information (specific location, URL, settings page, etc.)
3. HOW to provide the input (format, extraction steps)

Write comments in plain, conversational language as if explaining to a non-technical user.
DO NOT include example values in comments - example values should ONLY be provided as default values in the destructuring assignment using the = operator.

FILE UPLOAD CONTROL (@canBeFile):
For each string field, decide if it makes sense to upload file content. Use the @canBeFile JSDoc tag to control whether the file upload icon appears in the UI.

ALLOW file uploads (@canBeFile true or omit the tag - default behavior) for:
- Fields that hold document/media CONTENT (body, text, document, attachment, content, data, fileContent)
- Fields where pasting large text content would be cumbersome
- Fields that semantically represent file data to be processed

DISABLE file uploads (@canBeFile false) for:
- Identifiers and references (IDs, names, paths, URLs, emails, usernames)
- Configuration values (settings, options, formats, modes)
- Short user inputs (prompts, queries, search terms, titles)
- Credential-like values (API keys, tokens, secrets)

Example usage:
\`\`\`typescript
export interface DocumentProcessorPayload extends WebhookEvent {
  /**
   * Email address where the results should be sent.
   * @canBeFile false
   */
  email: string;
  
  /**
   * The document content to process. Paste text or upload a file.
   * @canBeFile true
   */
  documentContent: string;
  
  /**
   * Google Drive folder ID where files will be saved.
   * @canBeFile false
   */
  folderId: string;
  
  /**
   * File to attach to the email. Upload any document, image, or file.
   */
  attachment?: string;  // @canBeFile defaults to true, so no need to specify
}
\`\`\`

Use your judgment based on what the field semantically represents, not just its name.

Examples of EXCELLENT field comments (note: example values go in destructuring, not in comments):

// The spreadsheet ID is the long string in the URL right after /d/ and before the next / in the URL.
spreadsheetId: string;

// Slack: Right-click channel → "View channel details" → Copy the "Channel ID" (starts with 'C')
channelId: string;

// Email address where notifications should be sent.
recipientEmail: string;

// Folder path using forward slashes to separate directories.
outputFolderPath: string;

// API key from Dashboard > Settings > API Keys. Generate new key and copy the full string (32-64 chars).
apiKey: string;

// Priority level: 'low' (non-urgent), 'medium' (normal), 'high' (urgent)
priority?: 'low' | 'medium' | 'high';

COMMENT PATTERNS BY TYPE:

- URLs/IDs: Explain exact location in URL (after /d/, in query params) - describe the format, not show examples
- UI IDs: Explain steps to find it (right-click menu, settings page) and format (length, prefix)
- File paths: Explain format (forward slashes, relative vs absolute) - describe the structure
- API keys: Explain where to generate (dashboard location) and format (length, appearance)
- Emails/strings: Explain the format and any validation requirements
- Enums: List all valid values with brief descriptions
- Dates: Explain format (ISO 8601, Unix timestamp) and timezone if relevant
- Arrays: Explain what each item represents and the structure

Remember: Example values go in the destructuring default values, NOT in comments!

Examples of BAD comments (DO NOT USE):
// The spreadsheet ID  ❌ Too vague
// User email  ❌ No format/explanation
// API key for authentication  ❌ Doesn't tell where to get it
// Priority level. Defaults to 'medium'  ❌ Don't mention defaults in comments
// Email address. Example: "user@example.com"  ❌ Don't include examples in comments - put them in destructuring defaults

For example, for a workflow that processes user data and sends notifications:
  
export interface UserNotificationPayload extends WebhookEvent {
  /**
   * Email address where notifications should be sent.
   * @canBeFile false
   */
  email: string;
  /** Custom message content to include in the notification. */
  message?: string;
  /** Priority level: 'low' (non-urgent), 'medium' (normal), 'high' (urgent) */
  priority?: 'low' | 'medium' | 'high';
  /** Whether to send SMS in addition to email. Set to true to enable SMS notifications, false to only send email. */
  includeSMS?: boolean;
  /**
   * The spreadsheet ID is the long string in the URL right after /d/ and before the next / in the URL.
   * @canBeFile false
   */
  spreadsheetId: string;
}

const { 
  email = 'user@example.com', 
  message = 'Welcome to our platform! Thanks for signing up.', 
  priority = 'medium',
  spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  includeSMS = false 
} = payload;

CRITICAL: ALWAYS provide example values as default values using the = operator in the destructuring assignment.
These example values help users understand the expected format. For instance:
- Google Sheets ID: spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
- Email: email = 'user@example.com'
- Channel ID: channelId = 'C01234567AB'

REQUIRED vs OPTIONAL FIELD DECISION:
1. User specified a value in their request → OPTIONAL with that value as default
   (e.g., user says "research AI agents" → topic?: string with default "AI Agents")
2. Value must change per execution → REQUIRED
   (e.g., recipient email when user says "send me" but doesn't provide one, target URL that varies each run)
3. Nice-to-have configuration → OPTIONAL
   (e.g., output format preferences, depth settings)

The goal is to minimize required fields. If the user already told you what they want, don't make them type it again - use their value as the default.
When setting schedule, you must take into account of the timezone of the user (don't worry about daylight time, just whatever the current timezone currently) and convert it to UTC offset! The cron expression is in UTC timezone.
If no particular trigger is specified, use the webhook/http trigger.

REMEMBER: Users should be able to fill out inputs without asking questions or looking up documentation. Be thorough and specific!`;

export const COMMON_DEBUGGING_INSTRUCTIONS = `
When an error occurs, the issue is most likely with misconfiguration, using the wrong task / model / technique.
You should carefully observe the data flow and the context to understand what happened.

Regarding JSON parsing for ai-agent, if JSON mode is enabled in ai-agent, the response should be a valid JSON object unless the user's request cannot be fulfilled, then the response should be a text output explaining why it can't perform the task and make it unable to be parsed as JSON.
`;

export const BUBBLE_SPECIFIC_INSTRUCTIONS = `BUBBLE SPECIFIC INSTRUCTIONS:
1. When using the storage bubble, always use the bubble-lab-bucket bucket name, unless the user has their own s3/cloudflare bucket setup.
2. When using the resend bubble, DO NOT set the 'from' parameter, it will be set automatically and use bubble lab's default email, unless the user has their own resend setup and account domain verified.

BUBBLE COMMENT REQUIREMENTS:
Place a descriptive comment directly above each bubble instantiation (the \`new BubbleName({...})\` line).

CRITICAL: NEVER include step numbers (1., 2., Step 1, etc.) in comments.

Write comments as flowing narrative sentences that naturally reveal parameters and their purpose. Describe what the bubble does, weave in how its configuration controls behavior, and when relevant, mention how its output connects to downstream bubbles.

The comment should read like documentation that helps users understand both what happens and what they can change to customize behavior.

GOOD EXAMPLE:
\`\`\`typescript
// Searches for academic papers related to the topic variable and summarizes each one's key findings.
// The search behavior is controlled by the task prompt - modify it to focus on specific aspects,
// add date ranges, or filter by publication type. Currently using gemini-3-pro-preview for thorough
// multi-step research; switch to gemini-2.5-flash if you need faster results with less depth.
// Returns an array of papers (each with title, url, authors, publicationDate, summary, and
// relevance explanation) plus an overallSummary that synthesizes all findings for downstream use.
const researchTool = new ResearchAgentTool({
  task: \`Find research papers about \${topic}...\`,
  model: 'google/gemini-3-pro-preview',
  expectedResultSchema: z.object({...})
});

// Takes the papers array and overallSummary from the research results and formats them into
// a structured report. The template parameter controls the output format - currently set for
// markdown but can be changed to HTML or plain text. Uses the relevance field from each paper
// to prioritize which findings appear first in the final document.
const reportGenerator = new AIAgentBubble({...});
\`\`\`

BAD EXAMPLE:
\`\`\`typescript
// 1. Research Agent Tool
// Performs deep research on the specified topic, finding relevant papers and summarizing them.
// Using ${RECOMMENDED_MODELS.BEST} for best research capabilities.
const researchTool = new ResearchAgentTool({...});
\`\`\`
❌ Has step number
❌ Generic description ("performs deep research") - doesn't explain what parameters control
❌ No mention of output structure or how to customize
❌ Doesn't connect to how downstream bubbles use the results

Comments should enable users to modify behavior without reading external documentation.
`;

export const DEBUGGING_INSTRUCTIONS = `
**WORKFLOW ANALYSIS:**
- Examine the data flow through each bubble in the workflow
- Identify bottlenecks where data quality or detail is being lost
- Trace execution outputs to understand why results are generic vs specific
- Look for mismatched expectations between data extraction and content generation

**QUALITY DETECTION PATTERNS:**
- Generic language detection: Look for phrases like 'transform', 'leverage', 'paradigm shift' without concrete examples
- Data density analysis: Check if source material contains sufficient detail for the intended output
- Schema mismatch: Verify if data extraction schemas are too narrow (e.g., only 'summary' instead of full content)
- Content specificity: Determine if outputs include concrete examples, technical details, or quantifiable data

**ROOT CAUSE ANALYSIS:**
- When content is generic, trace back to: (1) insufficient source data, (2) poor extraction parameters, or (3) vague prompts
- Identify if research tools are only pulling URLs/titles/summaries instead of full detailed content
- Check if AI agent system prompts have enough specificity requirements

**PROACTIVE ISSUE IDENTIFICATION:**
- Before suggesting fixes, analyze: Is the problem in data gathering, processing, or generation?
- Look for patterns in execution outputs that indicate quality degradation
- Identify when workflows are producing 'minimum viable content' instead of comprehensive analysis

`;

/**
 * AI Agent behavior and model selection guide
 * Instructions for when to use research-agent-tool and how to select appropriate models
 */
export const AI_AGENT_BEHAVIOR_INSTRUCTIONS = `AI AGENT & MODEL SELECTION GUIDE:

═══════════════════════════════════════════════════════════════════
WHEN TO USE RESEARCH-AGENT-TOOL
═══════════════════════════════════════════════════════════════════

USE research-agent-tool when:
- Task is ambiguous or requires discovering unknown sources
- Need to explore, compare, or synthesize from multiple websites
- Market research, competitive analysis, or trend analysis
- Scraping targets need to be discovered (not explicitly provided)

DO NOT use research-agent-tool when:
- Target URL/website is specific and well-defined
- Task is deterministic (data transformation, formatting, known API calls)
- Simple scraping of known pages (use scrape-tool, scrape-site-tool instead)

═══════════════════════════════════════════════════════════════════
MODEL SELECTION
═══════════════════════════════════════════════════════════════════

TIER 1 - BEST (${RECOMMENDED_MODELS.BEST}):
Use for: Complex reasoning, tool-calling agents, research-agent-tool, code generation,
high-iteration tasks (50+), critical accuracy requirements

TIER 2 - PRO (${RECOMMENDED_MODELS.PRO}, ${RECOMMENDED_MODELS.PRO_ALT}):
Use for: Multi-step reasoning, strategic planning, complex data analysis

TIER 3 - FAST (${RECOMMENDED_MODELS.FAST}, ${RECOMMENDED_MODELS.FAST_ALT}):
Use for: Summarization, creative writing, document processing, general AI agents,
data formatting, moderate iterations (10-30), image understanding

TIER 4 - LITE (${RECOMMENDED_MODELS.LITE}):
Use for: Simple text generation, quick formatting, high-volume low-complexity tasks

SPECIALIZED:
- ${RECOMMENDED_MODELS.IMAGE}: Image generation
- openai/gpt-5, openai/gpt-5-mini: When user explicitly requests OpenAI
- openrouter models: Experimental/specialized use cases

═══════════════════════════════════════════════════════════════════
DECISION FLOWCHART
═══════════════════════════════════════════════════════════════════

1. User specified model? → Use their choice
2. Web research needed? → research-agent-tool + ${RECOMMENDED_MODELS.BEST}
3. AI agent with tools? → ${RECOMMENDED_MODELS.BEST}
4. Complex reasoning/code gen? → ${RECOMMENDED_MODELS.BEST}
5. Summary/creative/docs? → ${RECOMMENDED_MODELS.FAST}
6. Simple text? → ${RECOMMENDED_MODELS.LITE}
7. Default → ${RECOMMENDED_MODELS.FAST}

CRITICAL: User preference ALWAYS overrides these recommendations.
`;
