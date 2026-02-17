/**
 * SIMPLE BUBBLEFLOW GENERATOR WORKFLOW
 *
 * A simplified BubbleFlow generator that uses AI agent with tools to generate
 * and validate BubbleFlow code from natural language prompts.
 *
 * Much simpler than the complex workflow - just AI + validation tool!
 */

import { z } from 'zod';
import { WorkflowBubble } from '@bubblelab/bubble-core';
import type { BubbleContext } from '@bubblelab/bubble-core';
import {
  CredentialType,
  GenerationResultSchema,
  type GenerationResult,
  type ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import {
  CRITICAL_INSTRUCTIONS,
  BUBBLE_SPECIFIC_INSTRUCTIONS,
  AI_AGENT_BEHAVIOR_INSTRUCTIONS,
  BUBBLE_STUDIO_INSTRUCTIONS,
  INPUT_SCHEMA_INSTRUCTIONS,
} from '../../config/bubbleflow-generation-prompts.js';
import {
  AIAgentBubble,
  parseJsonWithFallbacks,
  type StreamingCallback,
  type ToolHookContext,
  type ToolHookBefore,
  type ToolHookAfter,
  type AfterLLMCallHook,
  type AvailableTool,
  HumanMessage,
} from '@bubblelab/bubble-core';
import {
  validateAndExtract,
  ValidationAndExtractionResult,
} from '@bubblelab/bubble-runtime';
import { EditBubbleFlowTool } from '@bubblelab/bubble-core';
import { BubbleFactory } from '@bubblelab/bubble-core';

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

type BubbleFlowGeneratorParamsParsed = BubbleFlowGeneratorParams & {
  streamingCallback?: StreamingCallback;
};

const MAX_ITERATIONS = 50;

const TOOL_NAMES = {
  VALIDATION: 'bubbleflow-validation-tool',
  BUBBLE_DETAILS: 'get-bubble-details-tool',
  TRIGGER_DETAILS: 'get-trigger-detail-tool',
  LIST_BUBBLES: 'list-bubbles-tool',
} as const;

const SYSTEM_PROMPT_BASE = `You are an expert TypeScript developer who specializes in creating BubbleFlow workflows. Generate clean, well-structured code that follows best practices.

WORKFLOW:
1. First identify bubbles needed using list-bubbles-tool
2. Use get-bubble-details-tool for each bubble to understand proper usage
3. If user requests a specific trigger (Slack, cron, etc), use get-trigger-detail-tool to get the payload schema and setup instructions
4. Write complete code using exact patterns from bubble details
5. Call createWorkflow with your complete code - it will validate and return errors if any
6. If validation fails, use editWorkflow to fix the errors iteratively, DO NOT use createWorkflow as it is not very efficient after the first call.
7. Keep calling editWorkflow until validation passes
8. Do not provide a response until your code is fully validated


IMPORTANT TOOL USAGE:
- ALWAYS start with createWorkflow (not editWorkflow) to create the initial code
- Use editWorkflow ONLY to fix validation errors from createWorkflow
- When using editWorkflow, provide the exact text to find (old_string) and its replacement (new_string).
- old_string must be an EXACT match of text in the current code, including whitespace and indentation.
- The edit will FAIL if old_string is not unique in the code. Provide a larger string with more surrounding context to make it unique, or set replace_all to true to change every instance.
- new_string replaces the ENTIRE old_string — include all lines that should remain.
- To ADD new code: set old_string to the line(s) above/below where you want to insert, and include those lines in new_string along with your new code.
- To DELETE code: set new_string to empty string "".
- Use replace_all for renaming variables or strings across the file.
- KEEP EDITS MINIMAL — one logical change per editWorkflow call.
- editWorkflow will return both the updated code AND new validation errors.
`;

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
  private streamingCallback: StreamingCallback | undefined;

  constructor(
    params: BubbleFlowGeneratorParamsParsed,
    bubbleFactory: BubbleFactory,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
    this.bubbleFactory = bubbleFactory;
    this.streamingCallback = params.streamingCallback;
  }

  private async runSummarizeAgent(
    validatedCode: string,
    credentials?: Partial<Record<CredentialType, string>>,
    streamingCallback?: StreamingCallback
  ): Promise<{
    summary: string;
    inputsSchema: string;
  }> {
    const summarizeAgent = new AIAgentBubble(
      {
        name: 'Flow Summary Agent',
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
          backupModel: {
            model: 'anthropic/claude-haiku-4-5',
          },
        },
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
        systemPrompt: `You MUST follow the exact summary pattern provided. Focus on the UI testing perspective - users will fill in a form, not make HTTP requests. For inputsSchema, extract from CustomWebhookPayload interface (exclude WebhookEvent base fields).

Return strict JSON with keys "summary" and "inputsSchema". No markdown wrapper. The summary must include all sections: Flow Title, Description, Required Credentials, Setup Before Testing, To Test This Flow, What Happens When You Run, and Output You'll See with example JSON.`,
        tools: [],
        maxIterations: 5,
        credentials,
        streamingCallback: streamingCallback,
      },
      this.context,
      'summarizeAgent'
    );

    console.log('[BubbleFlowGenerator] Starting summarizeAgent...');
    const summarizeRun = await summarizeAgent.action();
    let summary = '';
    let inputsSchema = '';

    console.log('[BubbleFlowGenerator] SummarizeAgent result:', {
      success: summarizeRun.success,
      hasResponse: !!('response' in summarizeRun
        ? summarizeRun.response
        : summarizeRun.data?.response),
      error: summarizeRun.error,
    });

    const response = summarizeRun.data?.response;

    if (summarizeRun.success && response) {
      try {
        const raw = response.trim();
        const parseResult = parseJsonWithFallbacks(raw);

        if (!parseResult.success || parseResult.error || !parseResult.parsed) {
          console.error(
            '[BubbleFlowGenerator] Failed to parse summarizeAgent response:',
            parseResult.error
          );
          summary = '';
          inputsSchema = '';
        } else {
          const parsed = parseResult.parsed as {
            summary?: string;
            inputsSchema?: string;
          };
          summary = typeof parsed.summary === 'string' ? parsed.summary : '';
          inputsSchema =
            typeof parsed.inputsSchema === 'string' ? parsed.inputsSchema : '';

          console.log('[BubbleFlowGenerator] Extracted summary and schema:', {
            summary,
            inputsSchema,
          });
        }
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

${INPUT_SCHEMA_INSTRUCTIONS}

${AI_AGENT_BEHAVIOR_INSTRUCTIONS}`;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<GenerationResult> {
    void context;

    console.log('[BubbleFlowGenerator] Starting generation process...');
    console.log('[BubbleFlowGenerator] Prompt:', this.params.prompt);

    try {
      // State to preserve current code and validation results across hook calls
      let currentCode: string | undefined;
      let savedValidationResult:
        | {
            valid: boolean;
            errors: string[];
            bubbleParameters?: Record<number, ParsedBubbleWithInfo>;
          }
        | undefined;

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

      // Create hooks for the custom tools
      const beforeToolCall: ToolHookBefore = async (
        context: ToolHookContext
      ) => {
        if (context.toolName === ('createWorkflow' as AvailableTool)) {
          const code = (context.toolInput as { code?: string })?.code;
          if (code) {
            currentCode = code;
          }
          console.debug(
            '[BubbleFlowGenerator] Pre-hook: createWorkflow called with code:',
            code
          );
        } else if (context.toolName === ('editWorkflow' as AvailableTool)) {
          console.debug('[BubbleFlowGenerator] Pre-hook: editWorkflow called');
          const input = context.toolInput as {
            old_string?: string;
            new_string?: string;
            replace_all?: boolean;
          };
          console.debug(
            '[BubbleFlowGenerator] EditWorkflow old_string:',
            input.old_string
          );
          console.debug(
            '[BubbleFlowGenerator] EditWorkflow new_string:',
            input.new_string
          );
        }

        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, unknown>,
        };
      };

      const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
        if (context.toolName === ('createWorkflow' as AvailableTool)) {
          console.log('[BubbleFlowGenerator] Post-hook: createWorkflow result');

          try {
            console.log(
              '[BubbleFlowGenerator] Tool output data for create tool call hooks:',
              context.toolOutput
            );
            const validationResult: ValidationAndExtractionResult =
              context.toolOutput as unknown as ValidationAndExtractionResult;
            console.log(
              '[BubbleFlowGenerator] Validation result after create tool call hooks:',
              validationResult
            );
            if (validationResult.valid === true) {
              console.debug(
                '[BubbleFlowGenerator] Validation passed! Signaling completion.'
              );

              // Save validation result for later use
              savedValidationResult = {
                valid: validationResult.valid || false,
                errors: validationResult.errors || [],
                bubbleParameters: validationResult.bubbleParameters,
              };

              return {
                messages: context.messages,
                shouldStop: true,
              };
            }

            console.debug(
              '[BubbleFlowGenerator] Validation failed, agent will retry'
            );
            console.debug(
              '[BubbleFlowGenerator] Validation errors:',
              validationResult.errors
            );
          } catch (error) {
            console.warn(
              '[BubbleFlowGenerator] Failed to parse validation result:',
              error
            );
          }
        } else if (context.toolName === ('editWorkflow' as AvailableTool)) {
          console.log('[BubbleFlowGenerator] Post-hook: editWorkflow result');

          try {
            const editResult = context.toolOutput?.data as {
              mergedCode?: string;
              applied?: boolean;
              validationResult?: {
                valid: boolean;
                errors: string[];
                bubbleParameters?: Record<number, ParsedBubbleWithInfo>;
              };
            };

            if (editResult.mergedCode) {
              currentCode = editResult.mergedCode;
            }

            if (editResult.validationResult?.valid === true) {
              console.debug(
                '[BubbleFlowGenerator] Edit successful and validation passed!'
              );

              // Save validation result for later use
              savedValidationResult = {
                valid: editResult.validationResult.valid || false,
                errors: editResult.validationResult.errors || [],
                bubbleParameters: editResult.validationResult.bubbleParameters,
              };
            } else {
              console.debug(
                '[BubbleFlowGenerator] Edit applied, validation failed, will retry'
              );
              console.debug(
                '[BubbleFlowGenerator] Validation errors:',
                editResult.validationResult?.errors
              );
            }
          } catch (error) {
            console.warn(
              '[BubbleFlowGenerator] Failed to parse edit result:',
              error
            );
          }
        }

        return { messages: context.messages };
      };

      // Hook that runs after entire agent completes - retry if no tool was called
      let afterLLMCallRetryCount = 0;
      const maxAfterLLMCallRetries = 3;

      const afterLLMCall: AfterLLMCallHook = async (context) => {
        // If we already have code (tool was called), no need to retry
        if (currentCode) {
          return { messages: context.messages };
        }

        // Check if we've exceeded retry limit
        if (afterLLMCallRetryCount >= maxAfterLLMCallRetries) {
          console.log(
            '[BubbleFlowGenerator] Max afterLLMCall retries reached, stopping'
          );
          return { messages: context.messages };
        }

        afterLLMCallRetryCount++;
        console.log(
          `[BubbleFlowGenerator] No tool called, requesting retry (attempt ${afterLLMCallRetryCount}/${maxAfterLLMCallRetries})`
        );

        // Append a message telling the agent to call the tool
        const retryMessage = new HumanMessage(
          `You MUST call the createWorkflow tool to generate the BubbleFlow code. Do not just provide text responses - you must use the createWorkflow tool with your complete TypeScript code. Please call createWorkflow now with the full BubbleFlow implementation.`
        );

        return {
          messages: [...context.messages, retryMessage],
          continueToAgent: true,
        };
      };

      // Create AI agent with custom tools
      console.log(
        '[BubbleFlowGenerator] Creating AI agent with custom tools...'
      );
      const aiAgent = new AIAgentBubble(
        {
          name: 'Bubble Flow Generator Agent',
          message: `Generate a complete BubbleFlow TypeScript class based on this request: "${this.params.prompt}"`,

          systemPrompt: this.createSystemPrompt(
            boilerplate,
            bubbleDescriptions
          ),

          model: {
            reasoningEffort: 'medium',
            model: 'google/gemini-3-flash-preview',
            temperature: 0.3,
            backupModel: {
              model: 'anthropic/claude-sonnet-4-5',
              temperature: 0.3,
            },
          },
          tools: [
            {
              name: TOOL_NAMES.BUBBLE_DETAILS,
              credentials: this.params.credentials || {},
              config: { includeLongDescription: true },
            },
            {
              name: TOOL_NAMES.TRIGGER_DETAILS,
              credentials: this.params.credentials || {},
            },
            {
              name: TOOL_NAMES.LIST_BUBBLES,
              credentials: this.params.credentials || {},
            },
          ],

          customTools: [
            {
              name: 'createWorkflow',
              description:
                'Create and validate a complete BubbleFlow workflow. This tool validates your TypeScript code and returns validation results. ALWAYS use this tool first before editWorkflow. Returns validation errors if code is invalid.',
              schema: z.object({
                code: z
                  .string()
                  .describe(
                    'Complete TypeScript workflow code to validate (must include imports, class definition, and handle method)'
                  ),
              }),
              func: async (input: Record<string, unknown>) => {
                const code = input.code as string;

                console.log('[BubbleFlowGenerator] Validating code:', code);
                const validationResult = await validateAndExtract(
                  code,
                  this.bubbleFactory
                );
                console.log(
                  '[BubbleFlowGenerator] Validation result after create:',
                  validationResult
                );
                return validationResult;
              },
            },
            {
              name: 'editWorkflow',
              description:
                'Edit existing workflow code using find-and-replace. Use this ONLY after createWorkflow has been called. Provide the exact text to find (old_string) and its replacement (new_string). The edit FAILS if old_string is not unique — provide more surrounding context to disambiguate. Use replace_all for renaming. Returns both the updated code AND new validation errors.',
              schema: z.object({
                old_string: z
                  .string()
                  .describe(
                    'The exact text to replace. Must be unique in the code — if not unique, provide more surrounding context to disambiguate.'
                  ),
                new_string: z
                  .string()
                  .describe(
                    'The replacement text. Must be different from old_string.'
                  ),
                replace_all: z
                  .boolean()
                  .default(false)
                  .optional()
                  .describe(
                    'Replace all occurrences of old_string (default false). Use for renaming variables/strings across the file.'
                  ),
              }),
              func: async (input: Record<string, unknown>) => {
                const old_string = input.old_string as string;
                const new_string = input.new_string as string;
                const replace_all = (input.replace_all as boolean) || false;

                // Use the EditBubbleFlowTool to apply edits
                const editTool = new EditBubbleFlowTool(
                  {
                    initialCode: currentCode,
                    old_string,
                    new_string,
                    replace_all,
                  },
                  this.context
                );

                const editResult = await editTool.action();

                if (!editResult.success || !editResult.data) {
                  return {
                    data: {
                      mergedCode: currentCode,
                      applied: false,
                      validationResult: {
                        valid: false,
                        errors: [editResult.error || 'Edit failed'],
                      },
                    },
                  };
                }

                const mergedCode = editResult.data.mergedCode;
                currentCode = mergedCode;

                // Validate the merged code
                const validationResult = await validateAndExtract(
                  mergedCode,
                  this.bubbleFactory
                );

                return {
                  data: {
                    mergedCode,
                    applied: editResult.data.applied,
                    validationResult: {
                      valid: validationResult.valid,
                      errors: validationResult.errors,
                      bubbleParameters: validationResult.bubbleParameters as
                        | Record<number, ParsedBubbleWithInfo>
                        | undefined,
                    },
                  },
                };
              },
            },
          ],

          maxIterations: MAX_ITERATIONS,
          credentials: this.params.credentials,
          beforeToolCall,
          afterToolCall,
          afterLLMCall,
          streamingCallback: this.streamingCallback,
        },
        this.context,
        'aiAgent'
      );

      // Generate the code
      const result = await aiAgent.action();

      console.log('[BubbleFlowGenerator] AI agent execution completed');
      console.log('[BubbleFlowGenerator] Result success:', result.success);
      console.log('[BubbleFlowGenerator] Result error:', result.error);

      if (!result.success || !currentCode) {
        console.log('[BubbleFlowGenerator] AI agent failed');
        return {
          toolCalls: [],
          generatedCode: '',
          isValid: false,
          success: false,
          error: result.error || 'Failed to generate code',
          summary: '',
          inputsSchema: '',
        };
      }

      // Get the generated code from currentCode (set by hooks)
      const generatedCode = currentCode || '';
      const isValid = savedValidationResult?.valid ?? false;
      const validationError = savedValidationResult?.errors.join('; ') ?? '';

      // Run summarize agent if validation passed
      const { summary, inputsSchema } = isValid
        ? await this.runSummarizeAgent(
            generatedCode,
            this.params.credentials,
            this.streamingCallback
          )
        : { summary: '', inputsSchema: '' };

      return {
        toolCalls: result.data?.toolCalls || [],
        generatedCode,
        isValid,
        success: true,
        error: validationError,
        summary,
        inputsSchema,
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
      };
    }
  }
}
