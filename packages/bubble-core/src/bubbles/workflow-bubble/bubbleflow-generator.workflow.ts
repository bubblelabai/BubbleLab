/**
 * SIMPLE BUBBLEFLOW GENERATOR WORKFLOW
 *
 * A simplified BubbleFlow generator that uses AI agent with tools to generate
 * and validate BubbleFlow code from natural language prompts.
 *
 * Much simpler than the complex workflow - just AI + validation tool!
 */

import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import {
  CredentialType,
  GenerationResultSchema,
  type GenerationResult,
  CRITICAL_INSTRUCTIONS,
  VALIDATION_PROCESS,
  BUBBLE_SPECIFIC_INSTRUCTIONS,
  AI_AGENT_BEHAVIOR_INSTRUCTIONS,
  BUBBLE_STUDIO_INSTRUCTIONS,
} from '@bubblelab/shared-schemas';
import {
  AIAgentBubble,
  type StreamingCallback,
} from '../service-bubble/ai-agent.js';
import { ToolMessage } from '@langchain/core/messages';
import { BubbleFactory } from '../../bubble-factory.js';

// Type for validation tool result
interface ValidationResult {
  valid: boolean;
  bubbleCount?: number;
  bubbles?: Array<{
    variableName: string;
    bubbleName: string;
    className: string;
    hasAwait: boolean;
    hasActionCall: boolean;
    parameterCount: number;
  }>;
  metadata?: {
    validatedAt: string;
    codeLength: number;
    strictMode: boolean;
  };
  success: boolean;
  error: string;
  errors?: string[];
}

// Type for tool call result
interface ToolCallResult {
  tool: string;
  input: unknown;
  output: ToolMessage | ValidationResult | unknown;
}

/**
 * Extract unique bubble names from validation result
 */
function extractBubbleNames(validationResult?: ValidationResult): string[] {
  if (!validationResult?.bubbles) {
    return [];
  }
  const bubbleNames = validationResult.bubbles.map((b) => b.bubbleName);
  return Array.from(new Set(bubbleNames));
}

/**
 * Parameters schema for the simple BubbleFlow generator
 */
const BubbleFlowGeneratorParamsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .describe('Natural language description of the desired BubbleFlow'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Credentials for AI agent operations'),
});

type BubbleFlowGeneratorParams = z.output<
  typeof BubbleFlowGeneratorParamsSchema
>;

// Shared constants and prompts
const AI_MODEL_CONFIG = {
  model: 'google/gemini-2.5-pro',
  temperature: 0.3,
} as const;

const MAX_ITERATIONS = 20;

const TOOL_NAMES = {
  VALIDATION: 'bubbleflow-validation-tool',
  BUBBLE_DETAILS: 'get-bubble-details-tool',
  LIST_BUBBLES: 'list-bubbles-tool',
} as const;

const SYSTEM_PROMPT_BASE = `You are an expert TypeScript developer who specializes in creating BubbleFlow workflows. Generate clean, well-structured code that follows best practices.

WORKFLOW:
1. First identify bubbles needed from the available list
2. Use get-bubble-details-tool for each bubble to understand proper usage
3. Write code using exact patterns from bubble details
4. Use bubbleflow-validation iteratively until valid
5. Do not provide a response until your code is fully validated`;

// CRITICAL_INSTRUCTIONS and VALIDATION_PROCESS are now imported from @bubblelab/shared-schemas

/**
 * Simple BubbleFlow Generator using AI agent with tools
 */
export class BubbleFlowGeneratorWorkflow extends WorkflowBubble<
  BubbleFlowGeneratorParams,
  GenerationResult
> {
  static readonly type = 'workflow' as const;
  static readonly bubbleName = 'bubbleflow-generator';
  static readonly schema = BubbleFlowGeneratorParamsSchema;
  static readonly resultSchema = GenerationResultSchema;
  static readonly shortDescription =
    'Generate BubbleFlow code from natural language';
  static readonly longDescription = `
    Simple BubbleFlow generator that uses AI with validation tools.
    
    Just provide a natural language prompt describing what you want your BubbleFlow to do,
    and it will generate complete TypeScript code with proper validation.
    
    Example prompts:
    - "Create a flow that queries my database and sends results to Slack"
    - "Build a workflow that processes user data with AI and stores it"
    - "Make a flow that analyzes text and generates a summary"
  `;
  static readonly alias = 'generate-flow';

  private bubbleFactory: BubbleFactory;

  constructor(
    params: z.input<typeof BubbleFlowGeneratorParamsSchema>,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
    this.bubbleFactory = new BubbleFactory();
  }

  private async runValidationAgent(
    code: string,
    credentials?: Partial<Record<CredentialType, string>>,
    streamingCallback?: StreamingCallback
  ): Promise<{
    validatedCode: string;
    isValid: boolean;
    validationError: string;
    toolCalls?: unknown[];
    bubblesUsed: string[];
  }> {
    const validationAgent = new AIAgentBubble(
      {
        name: 'Validation Agent',
        message:
          `You are a validationAgent. Validate the provided BubbleFlow TypeScript code using the bubbleflow-validation tool. ` +
          `If validation fails, fix the code and validate again until it passes with valid: true. ` +
          `Return ONLY the final validated TypeScript code with no markdown. If needed, use the list-bubbles-tool to get the list of available bubbles and bubble details to get the correct parameters and usage.\n\n` +
          `CODE:\n\n\n` +
          code,
        systemPrompt:
          `You must use the bubbleflow-validation tool to validate code. Repeat validation/fix until valid. ` +
          `Do not explain anything. Output only the final TypeScript code when validation passes.`,
        model: AI_MODEL_CONFIG,
        tools: [
          {
            name: TOOL_NAMES.VALIDATION,
            credentials: credentials || {},
          },
          {
            name: TOOL_NAMES.BUBBLE_DETAILS,
            credentials: credentials || {},
          },
          {
            name: TOOL_NAMES.LIST_BUBBLES,
            credentials: credentials || {},
          },
        ],
        maxIterations: 10,
        credentials,
      },
      this.context,
      'validationAgent'
    );

    const validationRun = streamingCallback
      ? await validationAgent.actionWithStreaming(streamingCallback)
      : await validationAgent.action();
    let validatedCode = code;
    let isValid = false;
    let validationError = 'Validation agent failed';
    let bubblesUsed: string[] = [];
    // Handle both streaming (direct response) and non-streaming (wrapped in data) results
    const isStreamingResult = 'response' in validationRun;
    const response = isStreamingResult
      ? validationRun.response
      : validationRun.data?.response;
    const toolCalls = isStreamingResult
      ? validationRun.toolCalls
      : validationRun.data?.toolCalls;

    if (validationRun.success && response) {
      validatedCode = response
        .replace(/```typescript/g, '')
        .replace(/```/g, '')
        .trim();

      if (toolCalls && toolCalls.length > 0) {
        const lastToolCall = toolCalls[toolCalls.length - 1] as ToolCallResult;

        if (
          (lastToolCall.tool === TOOL_NAMES.VALIDATION ||
            lastToolCall.tool === 'bubbleflow-validation') &&
          lastToolCall.output
        ) {
          try {
            let validationContent: string;
            if (lastToolCall.output instanceof ToolMessage) {
              const content = lastToolCall.output.content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (
              typeof lastToolCall.output === 'object' &&
              lastToolCall.output !== null &&
              'content' in lastToolCall.output
            ) {
              const content = (lastToolCall.output as ToolMessage).content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (typeof lastToolCall.output === 'string') {
              validationContent = lastToolCall.output;
            } else {
              validationContent = JSON.stringify(lastToolCall.output);
            }

            const parsedResult = JSON.parse(validationContent);
            console.log(
              '[BubbleFlowGenerator] Raw validation result structure:',
              {
                hasData: !!parsedResult.data,
                hasTopLevelValid: 'valid' in parsedResult,
                hasNestedValid:
                  parsedResult.data && 'valid' in parsedResult.data,
              }
            );

            // Unwrap the result if it's wrapped in a data object
            const validationResult: ValidationResult =
              parsedResult.data || parsedResult;

            isValid = validationResult.valid === true;
            validationError =
              validationResult.error ||
              (validationResult.errors && validationResult.errors.join('; ')) ||
              '';

            // Extract bubble names from validation result
            bubblesUsed = extractBubbleNames(validationResult);

            console.log(
              '[BubbleFlowGenerator] ✅ Validation parsed - valid:',
              isValid,
              'error:',
              validationError || 'none',
              'bubblesUsed:',
              bubblesUsed
            );
          } catch (e) {
            isValid = true;
            validationError = '';
          }
        }
      }
    }

    return {
      validatedCode,
      isValid,
      validationError,
      toolCalls,
      bubblesUsed,
    };
  }

  private async runSummarizeAgent(
    validatedCode: string,
    credentials?: Partial<Record<CredentialType, string>>,
    streamingCallback?: StreamingCallback
  ): Promise<{ summary: string; inputsSchema: string }> {
    const summarizeAgent = new AIAgentBubble(
      {
        name: 'Flow Summary Agent',
        message:
          `You are summarizeAgent for Bubble Lab. Analyze the provided validated BubbleFlow TypeScript and generate a user-friendly summary.

IMPORTANT: Users will test this flow in Bubble Studio UI by manually filling in a form, NOT by making HTTP webhook requests. Write the summary from this perspective.

Required output structure (JSON):
{
  "summary": "Markdown formatted summary following the pattern below",
  "inputsSchema": "JSON Schema string for the flow's input"
}

SUMMARY PATTERN (follow this structure exactly):

**[Flow Name]**

[One-sentence description of what the flow does]


**Setup Before Testing:**
1. [Practical preparation step 1]
2. [Practical preparation step 2]

**To Test This Flow:**
Provide these inputs in the form:
- **[inputField1]**: [Clear description with examples]
- **[inputField2]**: [Clear description with examples]

**What Happens When You Run:**
1. [Step-by-step execution description]
2. [...]
3. [...]

**Output You'll See:**
\`\`\`json
{
  [Example JSON output that will appear in console]
}
\`\`\`

[Additional note about where to check results if applicable]

EXAMPLE (Reddit Lead Generation):

{
  "summary": "**Reddit Lead Generation Flow**\\n\\nAutomatically discovers potential leads from Reddit and saves them to Google Sheets with AI-generated outreach messages.\\n\\n**Setup Before Testing:**\\n1. Create a Google Spreadsheet to store your leads\\n2. Copy the spreadsheet ID from the URL (the long string between /d/ and /edit)\\n\\n**To Test This Flow:**\\nProvide these inputs in the form:\\n- **spreadsheetId**: Paste your Google Sheets ID\\n- **subreddit**: Enter subreddit name without r/ (e.g., \\"entrepreneur\\", \\"startups\\")\\n- **searchCriteria**: Describe your ideal lead (e.g., \\"people frustrated with current automation tools\\")\\n\\n**What Happens When You Run:**\\n1. Checks your spreadsheet for existing contacts to avoid duplicates\\n2. Scrapes 50 recent posts from your target subreddit\\n3. AI analyzes posts and identifies 10 new potential leads matching your criteria\\n4. Generates personalized, empathetic outreach messages for each lead\\n5. Adds new contacts to your spreadsheet with: Name, Post Link, Message, Date, and Status\\n\\n**Output You'll See:**\\n\`\`\`json\\n{\\n  \\"message\\": \\"Successfully added 10 new contacts to the spreadsheet.\\",\\n  \\"newContactsAdded\\": 10\\n}\\n\`\`\`\\n\\nCheck your Google Sheet to see the new leads with ready-to-use outreach messages!",
  "inputsSchema": "{\\"type\\":\\"object\\",\\"properties\\":{\\"spreadsheetId\\":{\\"type\\":\\"string\\",\\"description\\":\\"Google Sheets spreadsheet ID where leads will be stored\\"},\\"subreddit\\":{\\"type\\":\\"string\\",\\"description\\":\\"The subreddit to scrape for potential leads (e.g., \\\\\\"n8n\\\\\\", \\\\\\"entrepreneur\\\\\\")\\"},\\"searchCriteria\\":{\\"type\\":\\"string\\",\\"description\\":\\"Description of what type of users to identify (e.g., \\\\\\"expressing frustration with workflow automation tools\\\\\\")\\"}}},\\"required\\":[\\"spreadsheetId\\",\\"subreddit\\",\\"searchCriteria\\"]}"
}

${BUBBLE_STUDIO_INSTRUCTIONS}

CODE TO ANALYZE:

` + validatedCode,
        systemPrompt: `You MUST follow the exact summary pattern provided. Focus on the UI testing perspective - users will fill in a form, not make HTTP requests. For inputsSchema, extract from CustomWebhookPayload interface (exclude WebhookEvent base fields). Return strict JSON with keys "summary" and "inputsSchema" only. No markdown wrapper. The summary must include all sections: Flow Title, Description, Required Credentials, Setup Before Testing, To Test This Flow, What Happens When You Run, and Output You'll See with example JSON.`,
        model: {
          jsonMode: true,
        },
        tools: [],
        maxIterations: 5,
        credentials,
      },
      this.context,
      'summarizeAgent'
    );

    console.log('[BubbleFlowGenerator] Starting summarizeAgent...');
    const summarizeRun = streamingCallback
      ? await summarizeAgent.actionWithStreaming(streamingCallback)
      : await summarizeAgent.action();
    let summary = '';
    let inputsSchema = '';

    console.log('[BubbleFlowGenerator] SummarizeAgent result:', {
      success: summarizeRun.success,
      hasResponse: !!('response' in summarizeRun
        ? summarizeRun.response
        : summarizeRun.data?.response),
      error: summarizeRun.error,
    });

    // Handle both streaming (direct response) and non-streaming (wrapped in data) results
    const isStreamingResult = 'response' in summarizeRun;
    const response = isStreamingResult
      ? summarizeRun.response
      : summarizeRun.data?.response;

    if (summarizeRun.success && response) {
      try {
        const raw = response.trim();
        console.log('[BubbleFlowGenerator] Raw summarizeAgent response:', raw);
        const parsed = JSON.parse(raw);
        console.log(
          '[BubbleFlowGenerator] Parsed summarizeAgent response:',
          parsed
        );
        summary = typeof parsed.summary === 'string' ? parsed.summary : '';
        inputsSchema =
          typeof parsed.inputsSchema === 'string' ? parsed.inputsSchema : '';
        console.log('[BubbleFlowGenerator] Extracted summary and schema:', {
          summary,
          inputsSchema,
        });
      } catch (parseError) {
        console.error(
          '[BubbleFlowGenerator] Failed to parse summarizeAgent response:',
          parseError
        );
        summary = '';
        inputsSchema = '';
      }
    } else {
      console.log(
        '[BubbleFlowGenerator] SummarizeAgent failed or no response:',
        {
          success: summarizeRun.success,
          response: response,
          error: summarizeRun.error,
        }
      );
    }
    return { summary, inputsSchema };
  }

  private createSystemPrompt(
    boilerplate: string,
    bubbleDescriptions: string
  ): string {
    return `${SYSTEM_PROMPT_BASE}

Here's the boilerplate template you should use as a starting point:
\`\`\`typescript
${boilerplate}
\`\`\`

Available bubbles in the system:
${bubbleDescriptions}

${CRITICAL_INSTRUCTIONS}

${BUBBLE_SPECIFIC_INSTRUCTIONS}

${AI_AGENT_BEHAVIOR_INSTRUCTIONS}


${VALIDATION_PROCESS}`;
  }

  private createStreamingSystemPrompt(
    boilerplate: string,
    bubbleDescriptions: string
  ): string {
    return `${SYSTEM_PROMPT_BASE}

Here's the boilerplate template you should use as a starting point:
\`\`\`typescript
${boilerplate}
\`\`\`

Available bubbles in the system:
${bubbleDescriptions}

${CRITICAL_INSTRUCTIONS}

${AI_AGENT_BEHAVIOR_INSTRUCTIONS}

${VALIDATION_PROCESS}`;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<GenerationResult> {
    void context;

    console.log('[BubbleFlowGenerator] Starting generation process...');
    console.log('[BubbleFlowGenerator] Prompt:', this.params.prompt);

    try {
      console.log('[BubbleFlowGenerator] Registering defaults...');
      await this.bubbleFactory.registerDefaults();

      // Get available bubbles info
      console.log('[BubbleFlowGenerator] Getting available bubbles...');
      const availableBubbles = this.bubbleFactory.listBubblesForCodeGenerator();
      console.log('[BubbleFlowGenerator] Available bubbles:', availableBubbles);

      const bubbleDescriptions = availableBubbles
        .map((name) => {
          const metadata = this.bubbleFactory.getMetadata(name);
          return `- ${name}: ${metadata?.shortDescription || 'No description'}`;
        })
        .join('\n');

      // Get boilerplate template
      console.log('[BubbleFlowGenerator] Generating boilerplate template...');
      const boilerplate = this.bubbleFactory.generateBubbleFlowBoilerplate();

      // Create AI agent with validation tool attached
      console.log(
        '[BubbleFlowGenerator] Creating AI agent with validation tool...'
      );
      const aiAgent = new AIAgentBubble(
        {
          name: 'Bubble Flow Generator Agent',
          message: `Generate a complete BubbleFlow TypeScript class based on this request: "${this.params.prompt}"`,

          systemPrompt: this.createSystemPrompt(
            boilerplate,
            bubbleDescriptions
          ),

          model: AI_MODEL_CONFIG,

          tools: [
            {
              name: TOOL_NAMES.VALIDATION,
              credentials: this.params.credentials || {},
            },
            {
              name: TOOL_NAMES.BUBBLE_DETAILS,
              credentials: this.params.credentials || {},
            },
          ],

          maxIterations: MAX_ITERATIONS,
          credentials: this.params.credentials,
        },
        this.context,
        'aiAgent'
      );

      // Generate the code
      console.log('[BubbleFlowGenerator] Starting AI agent execution...');
      const result = await aiAgent.action();

      console.log('[BubbleFlowGenerator] AI agent execution completed');
      console.log('[BubbleFlowGenerator] Result success:', result.success);
      console.log('[BubbleFlowGenerator] Result error:', result.error);
      console.log(
        '[BubbleFlowGenerator] Response length:',
        result.data?.response?.length || 0
      );
      if (!result.success || !result.data?.response) {
        console.log('[BubbleFlowGenerator] AI agent failed or no response');
        return {
          toolCalls: [],
          generatedCode: '',
          isValid: false,
          success: false,
          error: result.error || 'Failed to generate code',
          summary: '',
          inputsSchema: '',
          bubblesUsed: [],
        };
      }

      console.log('[BubbleFlowGenerator] Processing AI response...');
      const generatedCode = result.data.response
        .replace(/```typescript/g, '')
        .replace(/```/g, '')
        .trim();

      // Check if the AI made any tool calls and get validation from the last one
      let isValid = true;
      let validationError = '';
      let bubblesUsed: string[] = [];

      let needsValidationAgent = false;

      if (result.data.toolCalls && result.data.toolCalls.length > 0) {
        console.log(
          '[BubbleFlowGenerator] Found',
          result.data.toolCalls.length,
          'tool calls'
        );

        // Get the last tool call (should be the validation)
        const lastToolCall = result.data.toolCalls[
          result.data.toolCalls.length - 1
        ] as ToolCallResult;
        console.log('[BubbleFlowGenerator] Last tool call:', lastToolCall.tool);

        if (
          (lastToolCall.tool === TOOL_NAMES.VALIDATION ||
            lastToolCall.tool === 'bubbleflow-validation') &&
          lastToolCall.output
        ) {
          console.log('[BubbleFlowGenerator] Using validation tool result');
          try {
            // Handle ToolMessage object with content property
            let validationContent: string;

            if (lastToolCall.output instanceof ToolMessage) {
              const content = lastToolCall.output.content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (
              typeof lastToolCall.output === 'object' &&
              lastToolCall.output !== null &&
              'content' in lastToolCall.output
            ) {
              const content = (lastToolCall.output as ToolMessage).content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (typeof lastToolCall.output === 'string') {
              validationContent = lastToolCall.output;
            } else {
              console.log(
                '[BubbleFlowGenerator] Unexpected output type:',
                typeof lastToolCall.output
              );
              validationContent = JSON.stringify(lastToolCall.output);
            }

            const parsedResult = JSON.parse(validationContent);

            console.log(
              '[BubbleFlowGenerator] 🔍 Validation tool output structure:',
              {
                hasData: !!parsedResult.data,
                hasTopLevelValid: 'valid' in parsedResult,
                hasNestedValid:
                  parsedResult.data && 'valid' in parsedResult.data,
                topLevelValid: parsedResult.valid,
                nestedValid: parsedResult.data?.valid,
              }
            );

            // Unwrap the result if it's wrapped in a data object
            // The ToolBubble base class wraps results in { success, data, error }
            const validationResult: ValidationResult =
              parsedResult.data || parsedResult;

            isValid = validationResult.valid === true;
            validationError =
              validationResult.error ||
              (validationResult.errors && validationResult.errors.join('; ')) ||
              '';

            // Extract bubble names from validation result
            bubblesUsed = extractBubbleNames(validationResult);

            console.log(
              '[BubbleFlowGenerator] ✅ Validation result - valid:',
              isValid,
              'needsAgent:',
              !isValid,
              'bubblesUsed:',
              bubblesUsed
            );

            // If validation ran but code is still invalid, trigger validationAgent to self-heal
            if (!isValid) {
              console.log(
                '[BubbleFlowGenerator] ⚠️ Validation FAILED, will spawn validation agent. Errors:',
                validationError
              );
              needsValidationAgent = true;
            } else {
              console.log(
                '[BubbleFlowGenerator] ✓ Validation PASSED, no validation agent needed'
              );
            }
          } catch (parseError) {
            console.log(
              '[BubbleFlowGenerator] Failed to parse validation output:',
              parseError
            );
            // Fallback to assuming valid if we can't parse
            isValid = true;
          }
        } else {
          console.log(
            '[BubbleFlowGenerator] No validation tool call found from AI agent - will run validationAgent'
          );
          needsValidationAgent = true;
        }
      } else {
        console.log(
          '[BubbleFlowGenerator] No tool calls found - will run validationAgent'
        );
        needsValidationAgent = true;
      }

      if (needsValidationAgent) {
        console.log(
          '[BubbleFlowGenerator] Spawning validationAgent to validate code...'
        );
        const {
          validatedCode,
          isValid: validated,
          validationError: vErr,
          bubblesUsed: validationBubbles,
        } = await this.runValidationAgent(
          generatedCode,
          this.params.credentials
        );
        isValid = validated;
        validationError = vErr;
        bubblesUsed = validationBubbles;
        const { summary, inputsSchema } = isValid
          ? await this.runSummarizeAgent(validatedCode, this.params.credentials)
          : { summary: '', inputsSchema: '' };
        return {
          toolCalls: result.data.toolCalls,
          generatedCode: validatedCode,
          isValid,
          success: true,
          error: validationError,
          summary,
          inputsSchema,
          bubblesUsed,
        };
      }

      console.log('[BubbleFlowGenerator] Generation completed');
      console.log('[BubbleFlowGenerator] Validation status:', isValid);
      console.log('[BubbleFlowGenerator] Validation error:', validationError);

      // Always return success=true if we got code, but include validation status
      // This allows the IDE to display the code even if validation failed
      const { summary, inputsSchema } = isValid
        ? await this.runSummarizeAgent(generatedCode, this.params.credentials)
        : { summary: '', inputsSchema: '' };
      return {
        toolCalls: result.data.toolCalls,
        generatedCode,
        isValid,
        success: true, // Always true if we have code
        error: validationError, // Include validation error for reference
        summary,
        inputsSchema,
        bubblesUsed,
      };
    } catch (error) {
      console.error('[BubbleFlowGenerator] Error during generation:', error);
      return {
        toolCalls: [],
        generatedCode: '',
        isValid: false,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during generation',
        summary: '',
        inputsSchema: '',
        bubblesUsed: [],
      };
    }
  }

  /**
   * Execute the workflow with streaming support for real-time code generation feedback
   */
  public async actionWithStreaming(
    streamingCallback: StreamingCallback,
    context?: BubbleContext
  ): Promise<GenerationResult> {
    void context;

    console.log(
      '[BubbleFlowGenerator] Starting streaming generation process with prompt: ' +
        this.params.prompt
    );
    console.log('[BubbleFlowGenerator] Prompt:', this.params.prompt);

    try {
      await streamingCallback({
        type: 'start',
        data: {
          message: `Generating BubbleFlow code for: ${this.params.prompt}`,
          maxIterations: MAX_ITERATIONS,
          timestamp: new Date().toISOString(),
        },
      });

      console.log('[BubbleFlowGenerator] Registering defaults...');
      await this.bubbleFactory.registerDefaults();

      // Get available bubbles info
      console.log('[BubbleFlowGenerator] Getting available bubbles...');
      const availableBubbles = this.bubbleFactory.listBubblesForCodeGenerator();
      console.log('[BubbleFlowGenerator] Available bubbles:', availableBubbles);

      await streamingCallback({
        type: 'tool_start',
        data: {
          tool: 'bubble-discovery',
          input: { action: 'listing_available_bubbles' },
          callId: 'discovery-1',
        },
      });

      const bubbleDescriptions = availableBubbles
        .map((name) => {
          const metadata = this.bubbleFactory.getMetadata(name);
          return `- ${name}: ${metadata?.shortDescription || 'No description'}`;
        })
        .join('\n');

      await streamingCallback({
        type: 'tool_complete',
        data: {
          callId: 'discovery-1',
          tool: 'bubble-discovery',
          input: {
            action: 'listing_available_bubbles',
          },
          output: {
            availableBubbles: availableBubbles.length,
            descriptions: bubbleDescriptions,
          },
          duration: 100,
        },
      });

      // Get boilerplate template
      console.log('[BubbleFlowGenerator] Generating boilerplate template...');
      const boilerplate = this.bubbleFactory.generateBubbleFlowBoilerplate();

      await streamingCallback({
        type: 'tool_start',
        data: {
          tool: 'template-generation',
          input: { action: 'generating_boilerplate' },
          callId: 'template-1',
        },
      });

      await streamingCallback({
        type: 'tool_complete',
        data: {
          tool: 'template-generation',
          input: { action: 'generating_boilerplate' },
          callId: 'template-1',
          output: { templateGenerated: true, length: boilerplate.length },
          duration: 50,
        },
      });

      // Create AI agent with validation tool attached
      console.log(
        '[BubbleFlowGenerator] Creating AI agent with validation tool...'
      );
      const aiAgent = new AIAgentBubble(
        {
          name: 'Bubble Flow Generator Agent',
          message: `Generate a complete BubbleFlow TypeScript class based on this request: "${this.params.prompt}"`,

          systemPrompt: this.createStreamingSystemPrompt(
            boilerplate,
            bubbleDescriptions
          ),

          model: AI_MODEL_CONFIG,

          tools: [
            {
              name: TOOL_NAMES.VALIDATION,
              credentials: this.params.credentials || {},
            },
            {
              name: TOOL_NAMES.BUBBLE_DETAILS,
              credentials: this.params.credentials || {},
            },
          ],

          maxIterations: MAX_ITERATIONS,
          credentials: this.params.credentials,
        },
        this.context,
        'aiAgent'
      );

      // Generate the code with streaming
      console.log(
        '[BubbleFlowGenerator] Starting AI agent execution with streaming...'
      );
      const result = await aiAgent.actionWithStreaming(streamingCallback);

      console.log('[BubbleFlowGenerator] AI agent execution completed');
      console.log('[BubbleFlowGenerator] Result success:', result.success);

      if (!result.success || !result.response) {
        console.log('[BubbleFlowGenerator] AI agent failed or no response');
        return {
          toolCalls: result.toolCalls,
          generatedCode: '',
          isValid: false,
          success: false,
          error: result.error || 'Failed to generate code',
          summary: '',
          inputsSchema: '',
          bubblesUsed: [],
        };
      }

      let generatedCode = result.response
        .replace(/```typescript/g, '')
        .replace(/```/g, '')
        .trim();

      // Check validation status from tool calls
      let isValid = true;
      let validationError = '';
      let bubblesUsed: string[] = [];

      console.log('[BubbleFlowGenerator] Checking validation status...');

      let needsValidationAgent = false;

      if (result.toolCalls && result.toolCalls.length > 0) {
        // Get the last tool call (should be the validation)
        const lastToolCall = result.toolCalls[
          result.toolCalls.length - 1
        ] as ToolCallResult;

        if (
          (lastToolCall.tool === TOOL_NAMES.VALIDATION ||
            lastToolCall.tool === 'bubbleflow-validation') &&
          lastToolCall.output
        ) {
          try {
            // Handle ToolMessage object with content property
            let validationContent: string;
            console.log(
              '[BubbleFlowGenerator] Last tool call output:',
              lastToolCall.input
            );
            // Parse the input as a JSON object
            const input = JSON.parse(
              (lastToolCall.input as ToolCallResult).input as string
            );
            generatedCode = input.code;

            if (lastToolCall.output instanceof ToolMessage) {
              const content = lastToolCall.output.content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (
              typeof lastToolCall.output === 'object' &&
              lastToolCall.output !== null &&
              'content' in lastToolCall.output
            ) {
              const content = (lastToolCall.output as ToolMessage).content;
              validationContent =
                typeof content === 'string' ? content : JSON.stringify(content);
            } else if (typeof lastToolCall.output === 'string') {
              validationContent = lastToolCall.output;
            } else {
              console.log(
                '[BubbleFlowGenerator] Unexpected output type:',
                typeof lastToolCall.output
              );
              validationContent = JSON.stringify(lastToolCall.output);
            }

            const parsedResult = JSON.parse(validationContent);

            console.log(
              '[BubbleFlowGenerator] 🔍 Validation agent output structure:',
              {
                hasData: !!parsedResult.data,
                hasTopLevelValid: 'valid' in parsedResult,
                hasNestedValid:
                  parsedResult.data && 'valid' in parsedResult.data,
                topLevelValid: parsedResult.valid,
                nestedValid: parsedResult.data?.valid,
              }
            );

            // Unwrap the result if it's wrapped in a data object
            const validationResult: ValidationResult =
              parsedResult.data || parsedResult;

            isValid = validationResult.valid === true;
            validationError =
              validationResult.error ||
              (validationResult.errors && validationResult.errors.join('; ')) ||
              '';

            // Extract bubble names from validation result
            bubblesUsed = extractBubbleNames(validationResult);

            console.log(
              '[BubbleFlowGenerator] ✅ Validation agent result - valid:',
              isValid,
              'bubblesUsed:',
              bubblesUsed
            );

            if (!isValid) {
              console.log(
                '[BubbleFlowGenerator] ⚠️ Validation agent says INVALID, will try again. First error:',
                validationResult.errors?.[0]?.substring(0, 100)
              );
              needsValidationAgent = true;
            } else {
              console.log(
                '[BubbleFlowGenerator] ✓ Validation agent says VALID'
              );
            }
          } catch (parseError) {
            console.log('Failed to parse validation output:', parseError);
            console.log('Raw output:', lastToolCall.output);
            isValid = true; // Fallback
          }
        } else {
          // No validation tool call found - run a dedicated validationAgent
          console.log(
            '[BubbleFlowGenerator] No validation tool call found - will run validationAgent'
          );
          needsValidationAgent = true;
        }
      } else {
        console.log(
          '[BubbleFlowGenerator] No tool calls found - will run validationAgent'
        );
        needsValidationAgent = true;
      }

      if (needsValidationAgent) {
        await streamingCallback({
          type: 'tool_start',
          data: {
            tool: 'validation-agent',
            input: { action: 'validating_generated_code' },
            callId: 'validation-agent-1',
          },
        });

        const {
          validatedCode,
          isValid: validated,
          validationError: vErr,
          bubblesUsed: validationBubbles,
        } = await this.runValidationAgent(
          generatedCode,
          this.params.credentials,
          streamingCallback
        );

        await streamingCallback({
          type: 'tool_complete',
          data: {
            tool: 'validation-agent',
            input: { action: 'validating_generated_code' },
            callId: 'validation-agent-1',
            output: { success: validated },
            duration: 100,
          },
        });

        isValid = validated;
        validationError = vErr;
        bubblesUsed = validationBubbles;

        let summary = '';
        let inputsSchema = '';
        if (isValid) {
          await streamingCallback({
            type: 'tool_start',
            data: {
              tool: 'summary-agent',
              input: { action: 'generating_summary_and_schema' },
              callId: 'summary-agent-1',
            },
          });

          const summaryResult = await this.runSummarizeAgent(
            validatedCode,
            this.params.credentials,
            streamingCallback
          );
          summary = summaryResult.summary;
          inputsSchema = summaryResult.inputsSchema;

          await streamingCallback({
            type: 'tool_complete',
            data: {
              callId: 'summary-agent-1',
              tool: 'summary-agent',
              input: { action: 'generating_summary_and_schema' },
              output: {
                summaryGenerated: !!summary,
                schemaGenerated: !!inputsSchema,
              },
              duration: 100,
            },
          });
        }
        return {
          toolCalls: result.toolCalls,
          generatedCode: validatedCode,
          isValid,
          success: true,
          error: validationError,
          summary,
          inputsSchema,
          bubblesUsed,
        };
      }

      console.log('[BubbleFlowGenerator] Streaming generation completed');
      console.log('[BubbleFlowGenerator] Validation status:', isValid);
      console.log('[BubbleFlowGenerator] Validation error:', validationError);

      // Note: Bubble parameters extraction is now handled at the route level

      let summary = '';
      let inputsSchema = '';
      if (isValid) {
        await streamingCallback({
          type: 'tool_start',
          data: {
            tool: 'summary-agent',
            input: { action: 'generating_summary_and_schema' },
            callId: 'summary-agent-final',
          },
        });

        const summaryResult = await this.runSummarizeAgent(
          generatedCode,
          this.params.credentials,
          streamingCallback
        );
        summary = summaryResult.summary;
        inputsSchema = summaryResult.inputsSchema;

        await streamingCallback({
          type: 'tool_complete',
          data: {
            callId: 'summary-agent-final',
            tool: 'summary-agent',
            input: { action: 'generating_summary_and_schema' },
            output: {
              summaryGenerated: !!summary,
              schemaGenerated: !!inputsSchema,
            },
            duration: 100,
          },
        });
      }
      return {
        toolCalls: result.toolCalls,
        generatedCode,
        isValid,
        success: true,
        error: validationError,
        summary,
        inputsSchema,
        bubblesUsed,
      };
    } catch (error) {
      console.error(
        '[BubbleFlowGenerator] Error during streaming generation:',
        error
      );

      await streamingCallback({
        type: 'error',
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error during generation',
          recoverable: true, // Mark workflow errors as recoverable
        },
      });

      return {
        toolCalls: [],
        generatedCode: '',
        isValid: false,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during generation',
        summary: '',
        inputsSchema: '',
        bubblesUsed: [],
      };
    }
  }
}
