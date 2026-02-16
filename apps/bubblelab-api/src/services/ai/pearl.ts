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
  CREDENTIAL_ENV_MAP,
  BubbleName,
  TOOL_CALL_TO_DISCARD,
} from '@bubblelab/shared-schemas';
import {
  INPUT_SCHEMA_INSTRUCTIONS,
  BUBBLE_SPECIFIC_INSTRUCTIONS,
  BUBBLE_STUDIO_INSTRUCTIONS,
  COMMON_DEBUGGING_INSTRUCTIONS,
  DEBUGGING_INSTRUCTIONS,
  AI_AGENT_BEHAVIOR_INSTRUCTIONS,
} from '../../config/bubbleflow-generation-prompts.js';
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
  ToolMessage,
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../bubble-factory-instance.js';
import { env } from 'src/config/env.js';
/**
 * Build the system prompt for General Chat agent
 */
async function buildSystemPrompt(userName: string): Promise<string> {
  const bubbleFactory = await getBubbleFactory();
  const availableBubbles = bubbleFactory.listBubblesForCodeGenerator();

  const bubbleDescriptions = availableBubbles
    .map((name) => {
      const metadata = bubbleFactory.getMetadata(name);
      return `- ${name}: ${metadata?.shortDescription || 'No description'}`;
    })
    .join('\n');

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
- Use the web-scrape-tool to scrape the web for information when the user provides a URL or mentions a website, or useful if you need to understand a site's structure or content.

Available Bubbles:
${bubbleDescriptions}

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
   - DO NOT ask user to provide credentials, it will be handled automatically through bubble studio's credential management system.
   - If request is clear and feasible → PROPOSE workflow changes and call editWorkflow tool to validate it

OUTPUT FORMAT (JSON):
You MUST respond in JSON format with one of these structures. DO NOT include these in the <think> block. Include them in the response message:

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

Call editWorkflow tool until validation passes, then respond with the code snippet of the editWorkflow tool's response
then, respond with the code snippet of the editWorkflow tool's response
{
  "type": "code",
  "message": 'Code snippet of the editWorkflow tool\'s response',
}

Rejection (when infeasible):
{
  "type": "reject",
  "message": "Clear explanation of why this request cannot be fulfilled"
}

WHEN TO USE EACH TYPE:
- Use "question" when you need MORE information from the user to proceed with code generation
- Use "answer" when providing helpful information, explanations, or guidance WITHOUT generating code
  Examples: explaining features, listing available bubbles, providing usage guidance, answering how-to questions
- Use editWorkflow tool when you have enough information to PROPOSE a complete workflow (you are NOT editing/executing, only suggesting for user review)
- Use "reject" when the request is infeasible or outside your capabilities

CRITICAL CODE EDIT RULES:
2. For each bubble, use the get-bubble-details-tool with the bubble name (not class name) in order to understand the proper usage. ALWAYS call this tool for each bubble you plan to use or modify so you know the correct parameters and output!!!!!
3. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
4. Access data from context variables and parameters
5. The editWorkflow tool will validate your complete workflow code and return validation errors if any
6. If validation fails, use editWorkflow to fix the errors iteratively
7. Keep calling editWorkflow until validation passes
8. Do not provide a response until your code is fully validated

CRITICAL DEBUGGING INSTRUCTIONS (when output is provided and user asks for help fixing the workflow):
${DEBUGGING_INSTRUCTIONS}

IMPORTANT TOOL USAGE:
- When using editWorkflow, provide the exact text to find (old_string) and its replacement (new_string).
- old_string must be an EXACT match of text in the current code, including whitespace and indentation.
- The edit will FAIL if old_string is not unique in the code. Provide a larger string with more surrounding context to make it unique, or set replace_all to true to change every instance.
- new_string replaces the ENTIRE old_string — include all lines that should remain.
- To ADD new code: set old_string to the line(s) above/below where you want to insert, and include those lines in new_string along with your new code.
- To DELETE code: set new_string to empty string "".
- Use replace_all for renaming variables or strings across the file.
- KEEP EDITS MINIMAL — one logical change per editWorkflow call.
- editWorkflow will return both the updated code AND new validation errors.


# INFORMATION FOR INPUT SCHEMA:
${INPUT_SCHEMA_INSTRUCTIONS}

# BUBBLE SPECIFIC INSTRUCTIONS:
${BUBBLE_SPECIFIC_INSTRUCTIONS}


# DEBUGGING INSTRUCTIONS:
${COMMON_DEBUGGING_INSTRUCTIONS}

# MODEL SELECTION GUIDE:
${AI_AGENT_BEHAVIOR_INSTRUCTIONS} 

# CONTEXT:
User: ${userName}

# TEMPLATE CODE:
${bubbleFactory.generateBubbleFlowBoilerplate()}
`;
}

/**
 * Build the conversation messages from request and history
 * Returns both messages and images for multimodal support
 */
function buildConversationMessages(request: PearlRequest): {
  messages: BaseMessage[];
  images: Array<{
    type: 'base64';
    data: string;
    mimeType: string;
    description?: string;
  }>;
} {
  const messages: BaseMessage[] = [];
  const images: Array<{
    type: 'base64';
    data: string;
    mimeType: string;
    description?: string;
  }> = [];

  // Add conversation history if available
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    for (const msg of request.conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'tool') {
        if (TOOL_CALL_TO_DISCARD.includes(msg.name as BubbleName)) {
          continue;
        }
        messages.push(
          new ToolMessage({
            content: msg.content,
            tool_call_id: msg.toolCallId || '',
            name: msg.name || '',
          })
        );
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }
  }

  // Process uploaded files - separate images from text files
  const textFileContents: string[] = [];
  if (request.uploadedFiles && request.uploadedFiles.length > 0) {
    for (const file of request.uploadedFiles) {
      // Check fileType field to differentiate
      const fileType = (file as { fileType?: 'image' | 'text' }).fileType;

      if (fileType === 'text') {
        // Text files: add content to message context
        textFileContents.push(`\n\nContent of ${file.name}:\n${file.content}`);
      } else {
        // Images: add to images array for vision API
        const fileName = file.name.toLowerCase();
        let mimeType = 'image/png'; // default
        if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (fileName.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (fileName.endsWith('.gif')) {
          mimeType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          mimeType = 'image/webp';
        }

        images.push({
          type: 'base64',
          data: file.content,
          mimeType,
          description: file.name,
        });
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

  // Add text file contents to the message
  const textFilesInfo =
    textFileContents.length > 0 ? textFileContents.join('') : '';

  messages.push(
    new HumanMessage(
      `REQUEST FROM USER:${request.userRequest} Context:${contextInfo}${additionalContextInfo}${textFilesInfo}`
    )
  );

  return { messages, images };
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
  if (!env.OPENROUTER_API_KEY) {
    return {
      type: 'reject',
      message: `OpenRouter API key is required to run Pearl, please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.OPENROUTER_CRED]} is set, please obtain one https://openrouter.ai/settings/keys to run Pearl.`,
      success: false,
    };
  }
  const MAX_RETRIES = maxRetries || 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.debug(`[Pearl] Attempt ${attempt}/${MAX_RETRIES}`);

    try {
      const bubbleFactory = new BubbleFactory();
      await bubbleFactory.registerDefaults();

      // Build system prompt and conversation messages
      const systemPrompt = await buildSystemPrompt(request.userName);
      const { messages: conversationMessages, images } =
        buildConversationMessages(request);

      // State to preserve current code and validation results across hook calls
      let currentCode: string | undefined = request.currentCode;
      let editHistory: string[] = [];
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

          const input = context.toolInput as {
            old_string?: string;
            new_string?: string;
            replace_all?: boolean;
          };
          editHistory.push(
            `Replaced: ${(input.old_string || '').substring(0, 80)}...`
          );
          console.debug('[Pearl] EditWorkflow old_string:', input.old_string);
          console.debug('[Pearl] EditWorkflow new_string:', input.new_string);
        }

        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, unknown>,
        };
      };

      const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
        if (context.toolName === ('editWorkflow' as AvailableTool)) {
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
              let message = 'Changes applied successfully.';
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
          provider: ['fireworks', 'cerebras'],
        },
        images: images.length > 0 ? images : undefined,
        tools: [
          {
            name: 'list-bubbles-tool',
            credentials: credentials || {},
          },
          {
            name: 'get-bubble-details-tool',
            credentials: credentials || {},
            config: { includeLongDescription: true },
          },
          {
            name: 'get-trigger-detail-tool',
            credentials: credentials || {},
          },
          {
            name: 'web-scrape-tool',
            credentials: credentials || {},
          },
        ],
        customTools: [
          {
            name: 'editWorkflow',
            description:
              'Edit existing workflow code using find-and-replace. Provide the exact text to find (old_string) and its replacement (new_string). The edit FAILS if old_string is not unique — provide more surrounding context to disambiguate. Use replace_all for renaming. Returns both the updated code AND new validation errors.',
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
              // If no currentCode exists, this is an error
              const initialCode = currentCode;
              if (!initialCode) {
                return {
                  data: {
                    mergedCode: '',
                    applied: false,
                    validationResult: {
                      valid: false,
                      errors: [
                        'No current code to edit. The workflow must have code before using editWorkflow.',
                      ],
                      bubbleParameters: {},
                      inputSchema: {},
                    },
                  },
                };
              }

              const editTool = new EditBubbleFlowTool(
                {
                  initialCode,
                  old_string,
                  new_string,
                  replace_all,
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

      // If response is not empty and agent execution failed, return answer type
      if (
        !result.success &&
        result.data?.response &&
        result.data?.response.trim() !== ''
      ) {
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
          if (
            editHistory.length == 0 ||
            !finalCode ||
            finalCode.trim() === ''
          ) {
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
          if (!agentOutput.message || agentOutput.message.trim() === '') {
            console.error('[Pearl] Did not generate any code');
            continue;
          }
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
