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
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';
import {
  validateAndExtract,
  ValidationAndExtractionResult,
} from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../bubble-factory-instance.js';
/**
 * Build the system prompt for General Chat agent
 */
async function buildSystemPrompt(userName: string): Promise<string> {
  const bubbleFactory = await getBubbleFactory();
  return `You are Pearl, an AI Builder Agent specializing in creating editing completed Bubble Lab workflows (called BubbleFlow).
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
   - If request is clear and feasible → GENERATE COMPLETE WORKFLOW CODE and call validation tool

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

Then call validate-and-suggest-workflow tool with your generated code to validate it and suggest it to the user

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

CRITICAL CODE GENERATION RULES:
1. Generate COMPLETE workflow code including:
   - All necessary imports from @bubblelab/bubble-core, and any additional bubble imports if needed
   - A class that extends BubbleFlow<'webhook/http'> or BubbleFlow<'cron/schedule'> depending on the user's request or whether the task is suitable for a cron schedule.
   - A handle() method with the workflow logic
   - Proper error handling and return values
2. Find available bubbles using the list-bubbles-tool, this will contain the bubble identifiers and descriptions.
3. For each bubble, use the get-bubble-details-tool with the bubble identifier to understand the proper usage
4. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
5. Access data from context variables and parameters
6. When you generate code (type: "code"), you MUST immediately call the validation tool
7. The validation tool will validate your complete workflow code
8. If validation fails, fix the code and try again until validation passes


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


\`\`\`

Remember: You are building COMPLETE workflows that can include multiple integrations and complex logic!`;
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
  apiStreamingCallback?: StreamingCallback
): Promise<PearlResponse> {
  console.debug('[Pearl] User request:', request.userRequest);

  const MAX_RETRIES = 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.debug(`[Pearl] Attempt ${attempt}/${MAX_RETRIES}`);

    try {
      const bubbleFactory = new BubbleFactory();
      await bubbleFactory.registerDefaults();

      // Build system prompt and conversation messages
      const systemPrompt = await buildSystemPrompt(request.userName);
      const conversationMessages = buildConversationMessages(request);

      // State to preserve original code and validation results across hook calls
      let savedOriginalCode: string | undefined;
      let savedValidationResult:
        | {
            valid: boolean;
            errors: string[];
            bubbleParameters: Record<number, ParsedBubbleWithInfo>;
            inputSchema: Record<string, unknown>;
            requiredCredentials?: Record<string, CredentialType[]>;
          }
        | undefined;

      // Create hooks for validation tool
      const beforeToolCall: ToolHookBefore = async (
        context: ToolHookContext
      ) => {
        if (
          context.toolName ===
          ('validate-and-suggest-workflow' as AvailableTool)
        ) {
          console.debug(
            '[Pearl] Pre-hook: Intercepting validate-and-suggest-workflow tool call'
          );

          // Extract code from tool input
          const code = (context.toolInput as { code?: string })?.code;

          if (!code) {
            console.warn('[Pearl] No code found in tool input');
            return {
              messages: context.messages,
              toolInput: context.toolInput as Record<string, unknown>,
            };
          }
          savedOriginalCode = code;
          return {
            messages: context.messages,
            toolInput: { code },
          };
        }

        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, unknown>,
        };
      };

      const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
        if (
          context.toolName ===
          ('validate-and-suggest-workflow' as AvailableTool)
        ) {
          console.log('[Pearl] Post-hook: Checking validation result');

          try {
            const validationResult: ValidationAndExtractionResult = context
              .toolOutput?.data as ValidationAndExtractionResult;

            if (validationResult.valid === true) {
              console.debug('[Pearl] Validation passed! Signaling completion.');

              const code = savedOriginalCode || '';

              // Save validation result for later use
              savedValidationResult = {
                valid: validationResult.valid || false,
                errors: validationResult.errors || [],
                bubbleParameters: validationResult.bubbleParameters || [],
                inputSchema: validationResult.inputSchema || {},
                requiredCredentials: validationResult.requiredCredentials,
              };

              // Extract message from AI
              let message =
                'Workflow code generated and validated successfully';
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
                    if (result.success && result.response) {
                      const parsed = result.parsed;
                      message = (parsed as { message: string }).message;
                    }
                  }
                }

                // Construct the JSON response
                const response = {
                  type: 'code',
                  message,
                  snippet: code,
                };

                // Inject the response into the AI message
                lastAIMessage.content = JSON.stringify(response);
              }

              savedOriginalCode = undefined;

              return {
                messages: context.messages,
                shouldStop: true,
              };
            }

            console.debug('[Pearl] Validation failed, agent will retry');
            console.log('[Pearl] Errors:', validationResult.errors);
          } catch (error) {
            console.warn('[Pearl] Failed to parse validation result:', error);
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
            name: 'validate-and-suggest-workflow',
            description:
              'Validates your generated BubbleFlow workflow code and suggests it to the user for review. This tool checks code correctness (syntax, structure, bubble usage) and prepares it for user approval. You are PROPOSING changes, not executing them - the user will review and decide whether to accept your suggested workflow. Returns validation results including errors, bubble parameters, input schema, and required credentials. If validation passes, your code suggestion will be presented to the user.',
            schema: {
              code: z
                .string()
                .describe(
                  'Complete TypeScript workflow code to validate and suggest (must include imports, class definition, and handle method)'
                ),
            },
            func: async (input: Record<string, unknown>) => {
              const validationResult = await validateAndExtract(
                input.code as string,
                bubbleFactory
              );
              return {
                data: {
                  valid: validationResult.valid,
                  errors: validationResult.errors,
                  bubbleParameters: validationResult.bubbleParameters,
                  inputSchema: validationResult.inputSchema,
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
      if (!result.success) {
        return {
          type: 'reject',
          message: result.error || 'Agent execution failed',
          success: false,
          error: result.error,
        };
      }

      // Parse the agent's JSON response
      let agentOutput: PearlAgentOutput;
      try {
        const responseText = result.data?.response || '';
        agentOutput = PearlAgentOutputSchema.parse(JSON.parse(responseText));

        if (!agentOutput.type || !agentOutput.message) {
          console.error('[Pearl] Error parsing agent response:', responseText);
          lastError = 'Error parsing agent response';

          if (attempt < MAX_RETRIES) {
            console.warn(`[Pearl] Retrying... (${attempt}/${MAX_RETRIES})`);
            continue;
          }

          return {
            type: 'reject',
            message: 'Error parsing agent response',
            success: false,
          };
        }
        if (agentOutput.type === 'code' && agentOutput.snippet) {
          return {
            type: 'code',
            message: agentOutput.message,
            snippet: agentOutput.snippet,
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
        } else if (agentOutput.type === 'answer') {
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
        console.error('[Pearl] Failed to parse agent output:', error);
        lastError =
          error instanceof Error ? error.message : 'Unknown parsing error';

        if (attempt < MAX_RETRIES) {
          console.warn(`[Pearl] Retrying... (${attempt}/${MAX_RETRIES})`);
          continue;
        }

        return {
          type: 'reject',
          message: 'Failed to parse agent response',
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown parsing error',
        };
      }
    } catch (error) {
      console.error('[Pearl] Error during execution:', error);
      lastError = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < MAX_RETRIES) {
        console.warn(`[Pearl] Retrying... (${attempt}/${MAX_RETRIES})`);
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
