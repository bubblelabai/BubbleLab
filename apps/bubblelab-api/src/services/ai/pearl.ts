/**
 * General Chat AI Agent
 *
 * An AI agent that helps users build complete workflows with multiple integrations.
 * Unlike MilkTea which focuses on a single bubble, General Chat can:
 * - Generate complete workflow code with multiple bubbles
 * - Apply logic, loops, and conditions
 * - Work with various integrations
 * - Replace entire workflow code
 */

import {
  type PearlRequest,
  type PearlResponse,
  type PearlAgentOutput,
  PearlAgentOutputSchema,
  CredentialType,
  ParsedBubbleWithInfo,
  INPUT_SCHEMA_INSTRUCTIONS,
  BUBBLE_SPECIFIC_INSTRUCTIONS,
  BUBBLE_STUDIO_INSTRUCTIONS,
  COMMON_DEBUGGING_INSTRUCTIONS,
} from '@bubblelab/shared-schemas';
import {
  AIAgentBubble,
  type ToolHookContext,
  type ToolHookBefore,
  type ToolHookAfter,
  BubbleFactory,
  HumanMessage,
  AIMessage,
  type BaseMessage,
  StreamingCallback,
  AvailableTool,
  EditBubbleFlowTool,
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../bubble-factory-instance.js';
/**
 * Build the system prompt for General Chat agent
 */
async function buildSystemPrompt(userName: string): Promise<string> {
  const bubbleFactory = await getBubbleFactory();
  return `You are Pearl, an AI Builder Agent specializing in editing completed Bubble Lab workflows (called BubbleFlow).
  You reside inside bubblelab-studio, the frontend of Bubble Lab.
  ${BUBBLE_STUDIO_INSTRUCTIONS}

YOUR ROLE:
- Expert in building end-to-end workflows with multiple bubbles/integrations
- Good at explaining your thinking process to the user in a clear and concise manner.
- Expert in automation, logic, loops, conditions, and data manipulation
- Understand user's high-level goals and translate them into complete workflow code
- Ask clarifying questions when requirements are unclear
- Help users build workflows that can include multiple bubbles and complex logic

DECISION PROCESS:
1. Analyze the user's request carefully
2. Determine the user's intent:
   - Are they asking for information/guidance? → Use ANSWER
   - Are they requesting workflow code generation? → Use CODE
   - Is critical information missing? → Use QUESTION
   - Is the request infeasible? → Use REJECT
3. For code generation:
   - Identify all the bubbles/integrations needed
   - Check if all required information is provided
   - If ANY critical information is missing → ASK QUESTION immediately
   - DO NOT make assumptions or use placeholder values
   - If request is clear and feasible → PROPOSE workflow changes and call editWorkflow tool to validate it

OUTPUT FORMAT (JSON):
You MUST respond in JSON format with one of these structures:

Question (when you need MORE information from user):
{
  "type": "question",
  "message": "Specific question to ask the user to clarify their requirements"
}

Answer (when providing information or guidance WITHOUT generating code):
{
  "type": "answer",
  "message": "Detailed explanation, guidance, or answer to the user's question"
}

Code (when ready to PROPOSE workflow changes):
{
  "type": "code",
  "message": "Brief explanation of what the workflow does and what changes you are proposing"
}

Then call editWorkflow tool with your generated code to validate it and suggest it to the user

Rejection (when infeasible):
{
  "type": "reject",
  "message": "Clear explanation of why this request cannot be fulfilled"
}

WHEN TO USE EACH TYPE:
- Use "question" when you need MORE information from the user to proceed with code generation
- Use "answer" when providing helpful information, explanations, or guidance WITHOUT generating code
  Examples: explaining features, listing available bubbles, providing usage guidance, answering how-to questions
- Use "code" when you have enough information to PROPOSE a complete workflow (you are NOT editing/executing, only suggesting for user review)
- Use "reject" when the request is infeasible or outside your capabilities

CRITICAL CODE EDIT RULES:
1. Find available bubbles using the list-bubbles-tool, this will contain the bubble identifiers and descriptions.
2. For each bubble, use the get-bubble-details-tool with the bubble identifier to understand the proper usage
3. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
4. Access data from context variables and parameters
5. The editWorkflow tool will validate your complete workflow code and return validation errors if any
6. If validation fails, use editWorkflow to fix the errors iteratively
7. Keep calling editWorkflow until validation passes
8. Do not provide a response until your code is fully validated

IMPORTANT TOOL USAGE:
- When using editWorkflow, highlight the changes necessary and adds comments to indicate where unchanged code has been skipped. For example:
// ... existing code ...
{{ edit_1 }}
// ... existing code ...
{{ edit_2 }}
// ... existing code ...
Often this will mean that the start/end of the file will be skipped, but that's okay! Rewrite the entire file ONLY if specifically requested. Always provide a brief explanation of the updates, unless the user specifically requests only the code.
These edit codeblocks are also read by a less intelligent language model, colloquially called the apply model, to update the file. To help specify the edit to the apply model, you will be very careful when generating the codeblock to not introduce ambiguity. You will specify all unchanged regions (code and comments) of the file with "// ... existing code ..." comment markers. This will ensure the apply model will not delete existing unchanged code or comments when editing the file.
- KEEP THE EDIT MINIMAL
- editWorkflow will return both the updated code AND new validation errors


# INFORMATION FOR INPUT SCHEMA:
${INPUT_SCHEMA_INSTRUCTIONS}

# BUBBLE SPECIFIC INSTRUCTIONS:
${BUBBLE_SPECIFIC_INSTRUCTIONS}


# DEBUGGING INSTRUCTIONS:
${COMMON_DEBUGGING_INSTRUCTIONS}

# CONTEXT:
User: ${userName}

# TEMPLATE CODE:
${bubbleFactory.generateBubbleFlowBoilerplate()}
`;
}

/**
 * Build the conversation messages from request and history
 */
function buildConversationMessages(request: PearlRequest): BaseMessage[] {
  const messages: BaseMessage[] = [];

  // Add conversation history if available
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    for (const msg of request.conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else {
        messages.push(new AIMessage(msg.content));
      }
    }
  }
  // Add current request with code context if available
  const contextInfo = request.currentCode
    ? `\n\nCurrent workflow code:\n\`\`\`typescript\n${request.currentCode}\n\`\`\` Available Variables:${JSON.stringify(request.availableVariables)}`
    : '';

  // Add additional context if provided (e.g., timezone information)
  const additionalContextInfo = request.additionalContext
    ? `\n\nAdditional Context:\n${request.additionalContext}`
    : '';

  messages.push(
    new HumanMessage(
      `REQUEST FROM USER:${request.userRequest} Context:${contextInfo}${additionalContextInfo}`
    )
  );

  return messages;
}

/**
 * Main General Chat service function
 */
export async function runPearl(
  request: PearlRequest,
  credentials?: Partial<Record<CredentialType, string>>,
  apiStreamingCallback?: StreamingCallback,
  maxRetries?: number
): Promise<PearlResponse> {
  const MAX_RETRIES = maxRetries || 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.debug(`[Pearl] Attempt ${attempt}/${MAX_RETRIES}`);

    try {
      const bubbleFactory = new BubbleFactory();
      await bubbleFactory.registerDefaults();

      // Build system prompt and conversation messages
      const systemPrompt = await buildSystemPrompt(request.userName);
      const conversationMessages = buildConversationMessages(request);

      // State to preserve current code and validation results across hook calls
      let currentCode: string | undefined = request.currentCode;
      let applyModelInstructions: string[] = [];
      let savedValidationResult:
        | {
            valid: boolean;
            errors: string[];
            bubbleParameters: Record<number, ParsedBubbleWithInfo>;
            inputSchema: Record<string, unknown>;
            requiredCredentials?: Record<string, CredentialType[]>;
          }
        | undefined;

      // Create hooks for editWorkflow tool
      const beforeToolCall: ToolHookBefore = async (
        context: ToolHookContext
      ) => {
        if (context.toolName === ('editWorkflow' as AvailableTool)) {
          console.debug('[Pearl] Pre-hook: editWorkflow called');

          // Update currentCode with the initial code from the tool input
          const input = context.toolInput as {
            codeEdit?: string;
            instructions?: string;
          };
          applyModelInstructions.push(
            input.instructions || 'No instructions provided'
          );
          console.debug('[Pearl] EditWorkflow codeEdit:', input.codeEdit);
          console.debug(
            '[Pearl] EditWorkflow instructions:',
            input.instructions
          );
        }

        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, unknown>,
        };
      };

      const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
        if (context.toolName === ('editWorkflow' as AvailableTool)) {
          console.log('[Pearl] Post-hook: editWorkflow result');

          try {
            const editResult = context.toolOutput?.data as {
              mergedCode?: string;
              applied?: boolean;
              validationResult?: {
                valid: boolean;
                errors: string[];
                bubbleParameters?: Record<number, ParsedBubbleWithInfo>;
                inputSchema?: Record<string, unknown>;
                requiredCredentials?: Record<string, CredentialType[]>;
              };
            };

            if (editResult.mergedCode) {
              currentCode = editResult.mergedCode;
            }

            if (editResult.validationResult?.valid === true) {
              console.debug('[Pearl] Edit successful and validation passed!');

              // Save validation result for later use
              savedValidationResult = {
                valid: editResult.validationResult.valid || false,
                errors: editResult.validationResult.errors || [],
                bubbleParameters:
                  editResult.validationResult.bubbleParameters || [],
                inputSchema: editResult.validationResult.inputSchema || {},
                requiredCredentials:
                  editResult.validationResult.requiredCredentials,
              };

              // Extract message from AI
              let message = applyModelInstructions.join('\n');
              const lastAIMessage = [...context.messages]
                .reverse()
                .find(
                  (msg) =>
                    msg.constructor.name === 'AIMessage' ||
                    msg.constructor.name === 'AIMessageChunk'
                );
              if (lastAIMessage) {
                const messageContent = lastAIMessage.content;

                if (
                  typeof messageContent === 'string' &&
                  messageContent.trim()
                ) {
                  // Check if message is parsable JSON
                  const result = parseJsonWithFallbacks(messageContent);
                  if (result.success && result.parsed) {
                    message = (result.parsed as { message: string }).message;
                  } else {
                    message = messageContent;
                  }
                } else if (Array.isArray(messageContent)) {
                  const textBlock = messageContent.find(
                    (block: unknown) =>
                      typeof block === 'object' &&
                      block !== null &&
                      'type' in block &&
                      block.type === 'text' &&
                      'text' in block
                  );

                  if (
                    textBlock &&
                    typeof textBlock === 'object' &&
                    'text' in textBlock
                  ) {
                    const text = (textBlock as { text: string }).text;
                    if (text.trim()) {
                      message = text;
                    }

                    // Check if message is parsable JSON
                    const result = parseJsonWithFallbacks(message);
                    if (result.success && result.parsed) {
                      message = (result.parsed as { message: string }).message;
                    }
                  }
                }

                // Construct the JSON response
                const response = {
                  type: 'code',
                  message,
                  snippet: currentCode || '',
                };

                // Inject the response into the AI message
                lastAIMessage.content = JSON.stringify(response);
              }

              return {
                messages: context.messages,
                shouldStop: true,
              };
            }

            console.debug(
              '[Pearl] Edit applied, validation failed, will retry'
            );
            console.log(
              '[Pearl] Validation errors:',
              editResult.validationResult?.errors
            );
          } catch (error) {
            console.warn('[Pearl] Failed to parse edit result:', error);
          }
        }

        return { messages: context.messages };
      };

      // Create AI agent with hooks
      const agent = new AIAgentBubble({
        name: 'Pearl - Workflow Builder',
        message: JSON.stringify(conversationMessages) || request.userRequest,
        systemPrompt,
        streaming: true,
        streamingCallback: (event) => {
          return apiStreamingCallback?.(event);
        },
        model: {
          model: request.model,
          temperature: 1,
          jsonMode: true,
        },
        tools: [
          {
            name: 'list-bubbles-tool',
            credentials: credentials || {},
          },
          {
            name: 'get-bubble-details-tool',
            credentials: credentials || {},
          },
        ],
        customTools: [
          {
            name: 'editWorkflow',
            description:
              'Edit existing workflow code using Morph Fast Apply. Provide precise edits with "// ... existing code ..." markers. Returns both the updated code AND new validation errors.',
            schema: z.object({
              instructions: z
                .string()
                .describe(
                  'A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Use the first person to describe what you are going to do. Use it to disambiguate uncertainty in the edit.'
                ),
              codeEdit: z
                .string()
                .describe(
                  "Specify ONLY the precise lines of code that you wish to edit. NEVER specify or write out unchanged code. Instead, represent all unchanged code using the comment of the language you're editing in - example: // ... existing code ... "
                ),
            }),
            func: async (input: Record<string, unknown>) => {
              const instructions = input.instructions as string;
              const codeEdit = input.codeEdit as string;

              // Use the EditBubbleFlowTool to apply edits
              // If no currentCode exists, use boilerplate as initial code
              const initialCode = currentCode;

              const editTool = new EditBubbleFlowTool(
                {
                  initialCode,
                  instructions,
                  codeEdit,
                  credentials: credentials,
                },
                undefined // context
              );

              const editResult = await editTool.action();

              if (!editResult.success || !editResult.data) {
                return {
                  data: {
                    mergedCode: currentCode || initialCode,
                    applied: false,
                    validationResult: {
                      valid: false,
                      errors: [editResult.error || 'Edit failed'],
                      bubbleParameters: {},
                      inputSchema: {},
                    },
                  },
                };
              }

              const mergedCode = editResult.data.mergedCode;
              currentCode = mergedCode;

              // Validate the merged code using validateAndExtract from runtime
              const validationResult = await validateAndExtract(
                mergedCode,
                bubbleFactory
              );

              return {
                data: {
                  mergedCode,
                  applied: editResult.data.applied,
                  validationResult: {
                    valid: validationResult.valid,
                    errors: validationResult.errors,
                    bubbleParameters: validationResult.bubbleParameters,
                    inputSchema: validationResult.inputSchema,
                    requiredCredentials: validationResult.requiredCredentials,
                  },
                },
              };
            },
          },
        ],
        maxIterations: 20,
        credentials,
        beforeToolCall,
        afterToolCall,
      });
      const result = await agent.action();

      if (!result.success && result.data?.response) {
        // Default to answer type if agent execution failed (likely due to JSON parsing error of response)
        return {
          type: 'answer',
          message: result.data?.response,
          success: true,
        };
      }

      // Parse the agent's JSON response
      let agentOutput: PearlAgentOutput;
      const responseText = result.data?.response || '';
      try {
        console.log('[Pearl] Agent response:', responseText);
        // Try to parse as object first, then as array (take first element)
        let parsedResponse = JSON.parse(responseText);
        if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
          parsedResponse = parsedResponse[0];
        }
        agentOutput = PearlAgentOutputSchema.parse(parsedResponse);

        if (!agentOutput.type || !agentOutput.message) {
          console.error('[Pearl] Error parsing agent response:', responseText);
          lastError = 'Error parsing agent response';

          if (attempt < MAX_RETRIES) {
            console.warn(`[Pearl] Retrying... (${attempt}/${MAX_RETRIES})`);
            continue;
          }

          return {
            type: 'reject',
            message:
              'Error parsing agent response, original response: ' +
              responseText,
            success: false,
          };
        }
        if (agentOutput.type === 'code') {
          const finalCode = currentCode;
          if (applyModelInstructions.length == 0) {
            console.error('[Pearl] Did not generate any code');
            continue;
          }
          return {
            type: 'code',
            message: agentOutput.message,
            snippet: finalCode,
            bubbleParameters: savedValidationResult?.bubbleParameters,
            inputSchema: savedValidationResult?.inputSchema,
            requiredCredentials: savedValidationResult?.requiredCredentials,
            success: true,
          };
        } else if (agentOutput.type === 'question') {
          return {
            type: 'question',
            message: agentOutput.message,
            success: true,
          };
        } else if (
          agentOutput.type === 'answer' ||
          agentOutput.type === 'text'
        ) {
          return {
            type: 'answer',
            message: agentOutput.message,
            success: true,
          };
        } else {
          return {
            type: 'reject',
            message: agentOutput.message,
            success: true,
          };
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : 'Unknown parsing error';

        if (attempt < MAX_RETRIES) {
          console.warn(
            `[Pearl] Retrying due to error: ${error instanceof Error ? error.message : 'Unknown error'} (${attempt}/${MAX_RETRIES})`
          );
          continue;
        }

        return {
          type: 'reject',
          message:
            'Failed to parse agent response, original response: ' +
            responseText,
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown parsing error',
        };
      }
    } catch (error) {
      console.error('[Pearl] Error during execution:', error);
      lastError = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < MAX_RETRIES) {
        console.warn(
          `[Pearl] Retrying due to error: ${error instanceof Error ? error.message : 'Unknown error'} (${attempt}/${MAX_RETRIES})`
        );
        continue;
      }

      return {
        type: 'reject',
        message: 'An error occurred while processing your request',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // If all retries failed, return with the last error
  return {
    type: 'reject',
    message: `Failed after ${MAX_RETRIES} attempts: ${lastError || 'Unknown error'}`,
    success: false,
    error: lastError,
  };
}
