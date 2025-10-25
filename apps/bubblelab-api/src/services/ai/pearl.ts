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
  return `You are Pearl, an AI Builder Agent specializing in creating complete BubbleLab workflows.

YOUR ROLE:
- Expert in building end-to-end workflows with multiple bubbles/integrations
- Good at explaining your thinking process to the user in a clear and concise manner.
- Expert in automation, logic, loops, conditions, and data manipulation
- Understand user's high-level goals and translate them into complete workflow code
- Ask clarifying questions when requirements are unclear
- Help users build workflows that can include multiple bubbles and complex logic

DECISION PROCESS:
1. Analyze the user's request carefully
2. Identify all the bubbles/integrations needed
3. Check if all required information is provided:
   - If ANY critical information is missing � ASK QUESTION immediately
   - DO NOT make assumptions or use placeholder values
4. If request is clear and feasible � GENERATE COMPLETE WORKFLOW CODE and call validation tool

OUTPUT FORMAT (JSON):
You MUST respond in JSON format with one of these structures:

Question (when clarification needed):
{
  "type": "question",
  "message": "Specific question to ask the user"
}

Code (when ready to generate):
{
  "type": "code",
  "message": "Brief explanation of what the workflow does"
}

Then call the validation tool with the code

Rejection (when infeasible):
{
  "type": "reject",
  "message": "Clear explanation of why this request cannot be fulfilled"
}

CRITICAL CODE GENERATION RULES:
1. Generate COMPLETE workflow code including:
   - All necessary imports from @bubblelab/bubble-core
   - A class that extends BubbleFlow<'webhook/http'>
   - A handle() method with the workflow logic
   - Proper error handling and return values
2. Find available bubbles using the list-bubbles-tool
3. For each bubble, use the get-bubble-details-tool to understand the proper usage
4. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
5. Access data from context variables and parameters
6. DO NOT include credentials in code - they are injected automatically
7. When you generate code (type: "code"), you MUST immediately call the validation tool
8. The validation tool will validate your complete workflow code
9. If validation fails, fix the code and try again until validation passes
10. If the location of the output is unknown or not specified by the user, use this.logger?.info(message:string) to print the output to the console.
11. DO NOT repeat the user's request in your response or thinking process. Do not include "The user says: <user's request>" in your response.

For input schema, ie. the interface passed to the handle method. Decide based on how
the workflow should typically be ran (if it should be variable or fixed). If all
inputs are fixed take out the interface and just use handle() without the payload.

If no particular trigger is specified, use the webhook/http trigger.

CONTEXT:
User: ${userName}

Template Code:
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
    const beforeToolCall: ToolHookBefore = async (context: ToolHookContext) => {
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.debug(
          '[GeneralChat] Pre-hook: Intercepting validation tool call'
        );

        // Extract code from tool input
        const code = (context.toolInput as { code?: string })?.code;

        if (!code) {
          console.warn('[GeneralChat] No code found in tool input');
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
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.log('[GeneralChat] Post-hook: Checking validation result');

        try {
          const validationResult: ValidationAndExtractionResult = context
            .toolOutput?.data as ValidationAndExtractionResult;

          if (validationResult.valid === true) {
            console.debug(
              '[GeneralChat] Validation passed! Signaling completion.'
            );

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
            let message = 'Workflow code generated and validated successfully';
            const lastAIMessage = [...context.messages]
              .reverse()
              .find(
                (msg) =>
                  msg.constructor.name === 'AIMessage' ||
                  msg.constructor.name === 'AIMessageChunk'
              );
            if (lastAIMessage) {
              const messageContent = lastAIMessage.content;

              if (typeof messageContent === 'string' && messageContent.trim()) {
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

          console.debug('[GeneralChat] Validation failed, agent will retry');
          console.log('[GeneralChat] Errors:', validationResult.errors);
        } catch (error) {
          console.warn(
            '[GeneralChat] Failed to parse validation result:',
            error
          );
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
          name: 'bubbleflow-validation-tool',
          description: 'Calculates sales tax for a given amount',
          schema: {
            code: z.string().describe('Code to validate'),
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
      } else {
        return {
          type: 'reject',
          message: agentOutput.message,
          success: true,
        };
      }
    } catch (error) {
      console.error('[Pearl] Failed to parse agent output:', error);
      return {
        type: 'reject',
        message: 'Failed to parse agent response',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  } catch (error) {
    console.error('[GeneralChat] Error during execution:', error);
    return {
      type: 'reject',
      message: 'An error occurred while processing your request',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
