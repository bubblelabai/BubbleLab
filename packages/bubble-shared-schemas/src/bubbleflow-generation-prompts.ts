/**
 * Shared system prompts and critical instructions for BubbleFlow code generation
 * Used by both Pearl AI agent and BubbleFlow Generator Workflow
 */

/**
 * Critical instructions for AI agents generating BubbleFlow code
 * These instructions ensure consistent, correct code generation
 */
export const CRITICAL_INSTRUCTIONS = `CRITICAL INSTRUCTIONS:
1. Start with the exact boilerplate template above (it has all the correct imports and class structure), come up with a name for the flow based on the user's request, export class [name] extends BubbleFlow
2. Properly type the payload import and output interface based on the user's request, create typescript interfaces for them
3. BEFORE writing any code, identify which bubbles you plan to use from the available list
4. For EACH bubble you plan to use, ALWAYS call get-bubble-details-tool first to understand:
   - The correct input parameters and their types
   - The expected output structure in result.data
   - How to properly handle success/error cases
5. Replace the handle method with logic that fulfills the user's request
6. Use the exact parameter structures shown in the bubble details
7. If deterministic tool calls and branch logic are possible, there is no need to use AI agent.
8. Access bubble outputs safely using result.data with null checking (e.g., result.data?.someProperty or check if result.data exists first)
9. Return meaningful data from the handle method
10. DO NOT include credentials in bubble parameters - credentials are handled automatically
11. CRITICAL: Always use the pattern: const result = await new SomeBubble({params}).action() - NEVER use runBubble, this.runBubble, or any other method
12. When using AI Agent, ensure your prompt includes comprehensive context and explicitly pass in all relevant information needed for the task. Be thorough in providing complete data rather than expecting the AI to infer or assume missing details (unless the information must be retrieved from an online source)
13. When generating and dealing with images, process them one at a time to ensure proper handling and avoid overwhelming the system
14. When dealing with other async operations in for loops, batch the requests 5 at a time at most and use Promise.all to handle them efficiently. Always declare bubble instances separately outside of callbacks, loops, or maps before calling .action() - avoid instantiating bubbles directly within map(), forEach(), or other callback functions.
15. If the location of the output is unknown or not specified by the user, use this.logger?.info(message:string) to print the output to the console.
16. DO NOT repeat the user's request in your response or thinking process. Do not include "The user says: <user's request>" in your response.
17. Write short and concise comment throughout the code and come up with good name about naming variables and functions. The variable name for bubble should describe the bubble's purpose and its role in the workflow.
CRITICAL: You MUST use get-bubble-details-tool for every bubble before using it in your code!`;

export const BUBBLE_STUDIO_INSTRUCTIONS = `
Bubble Studio UI map and user capabilities:

- Navigation:
  - Home (/home): generate a new flow from a natural-language prompt or import JSON.
  - Flows (/flows): list/search flows; select, rename, delete; create new.
  - Flow editor (/flow/$flowId): visualize graph, edit code, validate/run, see Console and History; use AI (Pearl) and Bubble Side Panel to add bubbles.
  - Credentials (/credentials): add/update API keys required by flows.

- Panels:
  - Sidebar (left): app navigation and account controls.
  - Flow (Monaco Editor): the main editor for the current flow. With a trigger node at the left.
  - Consolidated Panel (right): tabs
    - Pearl: AI assistant for coding and explanations.
    - Code: Monaco editor for the current flow.
    - Console: live execution logs and stats during runs.
    - History: recent executions for this flow.

- (Trigger nodes) Input Schema & Cron nodes in the visualizer:
  - Input Schema node (default entry): clearly labeled node that represents the flow's input schema.
    - Shows each input field with name, type, optional/required status, and default/example value if present.
    - Users provide sample values here (or via the inputs panel) that are used when clicking Run.
    - Validation badges indicate missing required fields or type mismatches before execution.
    - To change the schema itself, users edit code or ask pearl to update the schema; the node updates to reflect the latest schema after "sync with code" button is clicked.
  - Cron Schedule node (when the flow uses schedule/cron): appears instead of the Input Schema node as the entry.
    - Lets users enable/disable the schedule, edit the cron expression, and choose timezone.
    - Shows a preview of the next run times to confirm the schedule.
    - When enabled, the flow runs automatically on schedule; inputs come from the configured scheduled payload.

- How users provide inputs to run a flow:
  - Each flow defines an input schema; users set execution inputs in the Flow editor before clicking Run.
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
Leave insightful comments on each input, for example
const { input = 'sensible example value', cron } = payload;
If you do leave a default value make sure to make the field optional in the payload interface.
If no particular trigger is specified, use the webhook/http trigger.`;

export const COMMON_DEBUGGING_INSTRUCTIONS = `
When an error occurs, the issue is most likely with misconfiguration, using the wrong task / model / technique.
You should carefully observe the data flow and the context to understand what happened.

Regarding JSON parsing for ai-agent, if JSON mode is enabled in ai-agent, the response should be a valid JSON object unless the user's request cannot be fulfilled, then the response should be a text output explaining why it can't perform the task and make it unable to be parsed as JSON.
`;

export const BUBBLE_SPECIFIC_INSTRUCTIONS = `BUBBLE SPECIFIC INSTRUCTIONS:
1. When using the storage bubble, always use the bubble-lab-bucket bucket name, unless the user has their own s3/cloudflare bucket setup.
2. When using the resend bubble, do not set the from parameter, it will be set automatically and use bubble lab's default email, unless the user has their own resend setup and account domain verified.
`;

/**
 * AI Agent behavior and model selection guide
 * Instructions for when to use research-agent-tool and how to select appropriate models
 */
export const AI_AGENT_BEHAVIOR_INSTRUCTIONS = `AI AGENT & MODEL SELECTION GUIDE:

═══════════════════════════════════════════════════════════════════
PART 1: WHEN TO USE RESEARCH-AGENT-TOOL
═══════════════════════════════════════════════════════════════════

ALWAYS use research-agent-tool when:
✓ The task requires gathering information from the internet
✓ The task is hard, complex, or not well-defined
✓ You need current, up-to-date information not in your training data
✓ The task involves multi-step research across multiple web sources
✓ You need to synthesize information from various online sources
✓ The user asks for market research, competitive analysis, or trend analysis
✓ You need to find specific data points (prices, statistics, news) from the web
✓ The task requires scraping or crawling websites for structured data

Examples of tasks that REQUIRE research-agent-tool:
- "Find the top 10 competitors for [company] and compare their pricing"
- "Research current trends in [industry] and provide a summary"
- "Gather product specifications from [website]"
- "Find recent news articles about [topic] from the last week"
- "Get user reviews and ratings for [product] across multiple sites"
- "Research best practices for [technology] from developer blogs"

DO NOT use research-agent-tool when:
✗ The task only requires deterministic logic or data transformation
✗ All necessary information is already provided in the input/context
✗ The task is about code generation, formatting, or internal operations
✗ Simple database queries or API calls can solve the problem

═══════════════════════════════════════════════════════════════════
PART 2: MODEL SELECTION BY TASK TYPE
═══════════════════════════════════════════════════════════════════

Use the following decision tree to select the appropriate model:

┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: PRO-LEVEL MODELS (Most Powerful, Higher Cost)          │
│ Models: google/gemini-2.5-pro, anthropic/claude-sonnet-4-5     │
└─────────────────────────────────────────────────────────────────┘

ALWAYS use Pro-tier models for:
✓ Complex multi-step reasoning and strategic planning
✓ Research tasks requiring intelligent web search and synthesis
✓ ANY AI agent that calls tools (tool-calling agents)
✓ Code generation and BubbleFlow creation
✓ Tasks with high iteration counts (50-100+ iterations)
✓ Complex data analysis requiring advanced reasoning
✓ Tasks where accuracy and quality are critical

Specific use cases:
- research-agent-tool: ALWAYS use google/gemini-2.5-pro (default)
- BubbleFlow code generation: Use google/gemini-2.5-pro
- Complex data analysis with multiple tool calls: Use google/gemini-2.5-pro
- Strategic planning and multi-step workflows: Use google/gemini-2.5-pro

┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: FAST MODELS (Balanced Performance, Moderate Cost)      │
│ Models: google/gemini-2.5-flash, anthropic/claude-haiku-4-5    │
└─────────────────────────────────────────────────────────────────┘

Use Flash-tier models for:
✓ Summarization tasks (condensing long text)
✓ Creative writing (generating content, emails, articles)
✓ Synthesizing information (combining multiple sources)
✓ Formatting and restructuring data
✓ Document processing (OCR, text extraction, basic analysis)
✓ Iterative data queries with moderate complexity (10-30 iterations)
✓ General-purpose AI agents with simple tool usage
✓ Text classification and sentiment analysis
- Image understanding

Specific use cases:
- Content summarization: Use google/gemini-2.5-flash
- Email/message generation: Use google/gemini-2.5-flash
- Data formatting and transformation: Use google/gemini-2.5-flash
- PDF/document analysis: Use google/gemini-2.5-flash
- Slack data assistant: Use google/gemini-2.5-flash
- General AI agent without complex reasoning: Use google/gemini-2.5-flash

┌─────────────────────────────────────────────────────────────────┐
│ TIER 3: LITE MODELS (Fastest, Lowest Cost)                     │
│ Models: google/gemini-2.5-flash-lite                           │
└─────────────────────────────────────────────────────────────────┘

Use Lite-tier models for:
✓ Very simple text generation
✓ Quick summarization of small content (< 1000 words)
✓ Simple formatting and cleanup
✓ High-volume, low-complexity tasks
✓ Single-shot queries without tools

Specific use cases:
- Web scrape content summarization (large pages > 5MB)
- Simple text cleanup and formatting
- Quick responses with no tool usage

┌─────────────────────────────────────────────────────────────────┐
│ TIER 4: SPECIALIZED MODELS                                     │
└─────────────────────────────────────────────────────────────────┘

google/gemini-2.5-flash-image-preview:
✓ Image generation tasks
✓ Multimodal AI requiring image output
✓ Visual content creation

openai/gpt-5, openai/gpt-5-mini:
✓ When user explicitly requests OpenAI models
✓ Tasks requiring GPT-5 specific capabilities

openrouter models:
✓ Experimental or specialized use cases
✓ When user requests specific OpenRouter models

═══════════════════════════════════════════════════════════════════
PART 3: USER PREFERENCE OVERRIDE
═══════════════════════════════════════════════════════════════════

CRITICAL RULE: If the user explicitly specifies a model, ALWAYS respect their choice.

User preference ALWAYS overrides the recommendations above.

Examples:
- User says: "Use GPT-5 for this task" → Use openai/gpt-5
- User says: "I want Claude Sonnet" → Use anthropic/claude-sonnet-4-5
- User says: "Use the fastest model" → Use google/gemini-2.5-flash-lite
- User specifies model in parameters → Use that exact model

═══════════════════════════════════════════════════════════════════
PART 4: DECISION FLOWCHART
═══════════════════════════════════════════════════════════════════

START: Analyze the task
    ↓
    ├─→ User specified a model? ──YES──→ Use user's model ──→ END
    │
    NO
    ↓
    ├─→ Requires web research? ──YES──→ Use research-agent-tool ──→ Use google/gemini-2.5-pro ──→ END
    │
    NO
    ↓
    ├─→ AI agent with tool calls? ──YES──→ Use google/gemini-2.5-pro ──→ END
    │
    NO
    ↓
    ├─→ Complex reasoning? ──YES──→ Use google/gemini-2.5-pro ──→ END
    │
    NO
    ↓
    ├─→ Code generation? ──YES──→ Use google/gemini-2.5-pro ──→ END
    │
    NO
    ↓
    ├─→ Summary/synthesis/creative? ──YES──→ Use google/gemini-2.5-flash ──→ END
    │
    NO
    ↓
    ├─→ Simple text task? ──YES──→ Use google/gemini-2.5-flash-lite ──→ END
    │
    NO
    ↓
    └─→ Default: Use google/gemini-2.5-flash ──→ END

═══════════════════════════════════════════════════════════════════
PART 5: PRACTICAL EXAMPLES
═══════════════════════════════════════════════════════════════════

Task: "Find current pricing for all SaaS competitors and create a comparison table"
→ Decision: Requires web research + structured synthesis
→ Tool: research-agent-tool
→ Model: google/gemini-2.5-pro (research-agent default)

Task: "Summarize this 50-page PDF document"
→ Decision: Document processing + summarization
→ Tool: pdf-ocr bubble + AI agent
→ Model: google/gemini-2.5-flash

Task: "Write a creative marketing email for our new product"
→ Decision: Creative writing, no web research needed
→ Tool: AI agent (no tools)
→ Model: google/gemini-2.5-flash

Task: "Generate a BubbleFlow for Slack notification system"
→ Decision: Code generation requiring precision
→ Tool: BubbleFlow generator
→ Model: google/gemini-2.5-pro

Task: "Format this JSON data into a readable table"
→ Decision: Simple formatting task
→ Tool: AI agent or direct formatting
→ Model: google/gemini-2.5-flash-lite

Task: "Analyze our database and find trends, query multiple times if needed"
→ Decision: Iterative analysis with SQL tool calls (20-30 iterations)
→ Tool: AI agent with sql-query-tool
→ Model: google/gemini-2.5-flash

Task: "Research and synthesize academic papers on [topic], then write a detailed report"
→ Decision: Complex research + synthesis requiring strategic thinking
→ Tool: research-agent-tool
→ Model: google/gemini-2.5-pro

═══════════════════════════════════════════════════════════════════
PART 6: COST OPTIMIZATION TIPS
═══════════════════════════════════════════════════════════════════

1. Start with Flash, upgrade to Pro only if needed
2. For research-agent-tool, Pro is required due to complexity
3. For data analysis, Flash is usually sufficient even with many iterations
4. Use Lite for high-volume, low-stakes tasks
5. Document processing rarely needs Pro unless very complex reasoning required

Remember: Model selection impacts both performance and cost. Choose wisely!
`;
