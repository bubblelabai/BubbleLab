/**
 * Milk Tea AI Agent
 *
 * An AI agent that helps users configure bubble parameters through conversation.
 * Named "Milk Tea" - a friendly builder agent that can:
 * - Generate code snippets for bubble configuration
 * - Ask clarifying questions when needed
 * - Reject infeasible requests (e.g., multi-bubble requests)
 * - Apply logic (loops, conditions, data manipulation) to configure parameters
 */

import {
  type MilkTeaRequest,
  type MilkTeaResponse,
  type MilkTeaAgentOutput,
  MilkTeaAgentOutputSchema,
  CredentialType,
  BubbleResult,
} from '@bubblelab/shared-schemas';
import {
  AIAgentBubble,
  type ToolHookContext,
  type ToolHookBefore,
  type ToolHookAfter,
  BubbleFactory,
  BubbleFlowValidationTool,
  HumanMessage,
  AIMessage,
  type BaseMessage,
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';

/**
 * Type for BubbleFlow validation result - inferred from the validation tool's result schema
 */
type ValidationToolResult = z.infer<
  typeof BubbleFlowValidationTool.resultSchema
>;

/**
 * Build the system prompt for Milk Tea agent
 */
function buildSystemPrompt(
  bubbleName: string,
  bubbleSchema: Record<string, unknown>,
  availableCredentials: string[],
  userName: string
): string {
  return `You are Milk Tea, a Builder Agent specializing in the "${bubbleName}" bubble.

YOUR ROLE:
- Expert in configuring bubble parameters
- Expert in automation and applying logic (loops, conditions, data manipulation)
- Understand user's high-level goals and translate them into proper bubble configuration
- Ask clarifying questions when request is unclear
- Reject requests that are infeasible or involve multiple bubbles

DECISION PROCESS:
1. Analyze the user's request carefully
2. Check if request mentions or requires MULTIPLE bubbles � If yes, REJECT immediately
3. Check the bubble's inputSchema for REQUIRED parameters:
   - Look at each required field in the inputSchema
   - Verify the user's request provides enough information for EACH required parameter
   - If ANY required parameter is missing or unclear from the request � ASK QUESTION immediately
   - DO NOT make assumptions or use placeholder values like "Hello World"
   - DO NOT proceed with code generation if required information is missing
4. If request is clear and feasible � GENERATE CODE snippet and call validation tool

OUTPUT FORMAT (JSON):
You MUST respond in JSON format with one of these structures:

Rejection (when infeasible or multi-bubble):
{
  "type": "reject",
  "message": "Clear explanation of why this request cannot be fulfilled with ${bubbleName}"
}

Question (when clarification needed):
{
  "type": "question",
  "message": "Specific question to ask the user"
}

Code (when ready to generate):
{
  "type": "code",
  "message": "Brief explanation of what the code does",
}

CRITICAL CODE GENERATION RULES:
1. Generate ONLY the minimal code snippet needed
4. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
5. Access data from context variables that would be available in the workflow
6. DO NOT include credentials in the snippet - they are injected automatically, DO NOT INCLUDE THE ENTIRE code ! ONLY INCLUDE THE SNIPPET 
7. When you generate code (type: "code"), you MUST immediately call the validation tool with the snippet
8. The validation tool will validate your snippet inserted into the full code
9. If validation fails, fix the snippet and try again with SNIPPET only until validation passes

CONTEXT:
User: ${userName}
Bubble: ${bubbleName}
Available Credentials: ${availableCredentials.join(', ') || 'None'}

Bubble Schema:
${JSON.stringify(bubbleSchema, null, 2)}

EXAMPLES OF GOOD SNIPPETS:
- const emailResult = await new EmailBubble({ to: users.map(u => u.email), subject: "Welcome!", body: "Hello!" }).action();
- const searchResults = await new WebSearchBubble({ query: userInput, maxResults: 5 }).action();
- const validUsers = users.filter(u => u.verified);
  const slackResult = await new SlackBubble({ channel: "#general", message: \`Found \${validUsers.length} verified users\` }).action();

Remember: You are an expert builder. Apply logic and transformations to make the parameters work correctly!`;
}

/**
 * Build the conversation message from request and history
 */
function buildConversationMessages(request: MilkTeaRequest): BaseMessage[] {
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

  // Add current request
  const contextInfo = request.currentCode
    ? `\n\nCurrent workflow code:\n\`\`\`typescript\n${request.currentCode}\n\`\`\``
    : '';

  const locationInfo = request.insertLocation
    ? `\n\nInsert location: ${request.insertLocation}`
    : '';

  messages.push(
    new HumanMessage(`${request.userRequest}${contextInfo}${locationInfo}`)
  );

  return messages;
}

/**
 * Insert snippet at the specified location in the code
 */
function insertSnippetAtLocation(
  currentCode: string | undefined,
  snippet: string,
  insertLocation: string | undefined
): string {
  if (!currentCode) {
    // If no current code, just return the snippet wrapped in a basic workflow
    return `import { BubbleFlow } from '@bubblelab/bubble-core';

export class GeneratedFlow extends BubbleFlow {
  async handle() {
    ${snippet}
    return result;
  }
}`;
  }

  // If we have an insert location, try to insert at that location
  if (insertLocation) {
    // Simple insertion - look for the location marker or line
    // This is a basic implementation - could be enhanced with AST manipulation
    if (currentCode.includes(insertLocation)) {
      return currentCode.replace(
        insertLocation,
        `${insertLocation}\n    ${snippet}`
      );
    }
  }

  // Fallback: try to insert before the last closing brace of the handle method
  const handleMethodRegex = /async\s+handle\s*\([^)]*\)\s*\{([\s\S]*)\}/;
  const match = currentCode.match(handleMethodRegex);

  if (match) {
    const lastBraceIndex = currentCode.lastIndexOf('}');

    if (lastBraceIndex !== -1) {
      return (
        currentCode.slice(0, lastBraceIndex) +
        `\n    ${snippet}\n` +
        currentCode.slice(lastBraceIndex)
      );
    }
  }

  // Ultimate fallback: append to end
  return currentCode + `\n\n${snippet}`;
}
/**
 * Main Milk Tea service function
 */
export async function runMilkTea(
  request: MilkTeaRequest,
  credentials?: Partial<Record<CredentialType, string>>
): Promise<MilkTeaResponse> {
  console.log('[MilkTea] Starting agent for bubble:', request.bubbleName);
  console.log('[MilkTea] User request:', request.userRequest);

  try {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();

    // Build system prompt and conversation messages
    const systemPrompt = buildSystemPrompt(
      request.bubbleName,
      request.bubbleSchema,
      request.availableCredentials,
      request.userName
    );

    const conversationMessages = buildConversationMessages(request);

    // State to preserve original snippet across hook calls
    // We use a simple string to store the most recent snippet (one tool call at a time)
    let savedOriginalSnippet: string | undefined;

    // Create hooks for validation tool
    const beforeToolCall: ToolHookBefore = async (context: ToolHookContext) => {
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.log('[MilkTea] Pre-hook: Intercepting validation tool call');
        // Extract snippet from tool input (where agent puts the code to validate)
        const snippet = (context.toolInput as { code?: string })?.code;

        if (!snippet) {
          console.warn('[MilkTea] No snippet found in tool input');
          return {
            messages: context.messages,
            toolInput: context.toolInput as Record<string, unknown>,
          };
        }

        console.log('[MilkTea] Extracted snippet from tool input:', snippet);

        // Save original snippet for restoration in afterToolCall
        savedOriginalSnippet = snippet;
        console.log('[MilkTea] Saved original snippet for restoration');

        // Insert snippet into full code
        const fullCode = insertSnippetAtLocation(
          request.currentCode,
          snippet,
          request.insertLocation
        );

        console.log('[MilkTea] Generated full code for validation', fullCode);

        // Modify tool input to validate full code
        return {
          messages: context.messages,
          toolInput: { code: fullCode },
        };
      }

      return {
        messages: context.messages,
        toolInput: context.toolInput as Record<string, unknown>,
      };
    };

    const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
      const reasoningContent = '';
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.log('[MilkTea] Post-hook: Checking validation result');

        // Restore original snippet in both tool message AND AIMessage tool_calls
        if (savedOriginalSnippet) {
          console.log('[MilkTea] Restoring original snippet in messages');

          // Find the last AIMessage with tool calls
          const lastAIMessageIndex = [...context.messages]
            .reverse()
            .findIndex(
              (msg) =>
                msg.constructor.name === 'AIMessage' &&
                'tool_calls' in msg &&
                Array.isArray(msg.tool_calls) &&
                msg.tool_calls.length > 0
            );

          if (lastAIMessageIndex !== -1) {
            const actualAIIndex =
              context.messages.length - 1 - lastAIMessageIndex;
            const aiMessage = context.messages[actualAIIndex] as AIMessage;

            // Restore original snippet in tool_calls args
            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
              const toolCall = aiMessage.tool_calls[0];
              if (toolCall.args && typeof toolCall.args === 'object') {
                toolCall.args = { code: savedOriginalSnippet };
              }
              console.log(
                '[MilkTea] Restored original snippet in AIMessage tool_calls'
              );
            }

            // Also preserve reasoning/thinking content if present
            const additionalKwargs = (
              aiMessage as unknown as {
                additional_kwargs?: Record<string, unknown>;
              }
            ).additional_kwargs;
            if (additionalKwargs?.__raw_response) {
              const rawResponse = additionalKwargs.__raw_response as {
                choices?: Array<{
                  message?: {
                    reasoning?: string;
                    reasoning_details?: Array<{ type: string; text: string }>;
                  };
                }>;
              };

              if (rawResponse.choices?.[0]?.message) {
                const messageData = rawResponse.choices[0].message;

                // Extract reasoning content
                let reasoningContent = '';
                if (messageData.reasoning) {
                  reasoningContent = messageData.reasoning;
                } else if (
                  messageData.reasoning_details &&
                  Array.isArray(messageData.reasoning_details)
                ) {
                  reasoningContent = messageData.reasoning_details
                    .map((detail) => detail.text)
                    .join('\n\n');
                }

                if (reasoningContent) {
                  // Store reasoning in a special field for later use
                  reasoningContent = reasoningContent;
                }
              }
            }
          }

          // Find the last ToolMessage in the messages array
          const lastToolMessageIndex = [...context.messages]
            .reverse()
            .findIndex((msg) => msg.constructor.name === 'ToolMessage');

          if (lastToolMessageIndex !== -1) {
            // Convert reversed index to actual index
            const actualIndex =
              context.messages.length - 1 - lastToolMessageIndex;
            const toolMessage = context.messages[actualIndex];

            // Replace tool message content with validation result containing original snippet
            // This way the agent sees the snippet it sent, not the full code
            const validationResult: BubbleResult<ValidationToolResult> =
              context.toolOutput as BubbleResult<ValidationToolResult>;

            toolMessage.content = JSON.stringify({
              ...validationResult,
              // Keep validation data but note that we validated the full code
              _note:
                'Validation was performed on full code with snippet inserted',
            });

            console.log('[MilkTea] Updated tool message with restored context');
          }
        }

        try {
          const validationResult: BubbleResult<ValidationToolResult> =
            context.toolOutput as BubbleResult<ValidationToolResult>;
          if (validationResult.data?.valid === true) {
            console.log('[MilkTea] Validation passed! Signaling completion.');

            // Use the saved original snippet (not the full code from toolInput)
            const snippet = savedOriginalSnippet || '';

            // Try to extract summary/message from AI message if available
            let message = 'Code snippet generated and validated successfully';
            const lastAIMessage = [...context.messages]
              .reverse()
              .find((msg) => msg.constructor.name === 'AIMessage');

            if (lastAIMessage) {
              const messageContent = lastAIMessage.content;

              // Try to extract message from various content formats
              if (typeof messageContent === 'string' && messageContent.trim()) {
                message = messageContent;
              } else if (Array.isArray(messageContent)) {
                // Find text block in array content
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
                  // Check is message is parsable JSON
                  if (
                    parseJsonWithFallbacks(message).success &&
                    parseJsonWithFallbacks(message).response
                  ) {
                    const parsed = parseJsonWithFallbacks(message);
                    if (
                      parsed.success &&
                      parsed.response &&
                      typeof parsed.response === 'object' &&
                      'message' in parsed.response
                    ) {
                      message = (parsed.response as { message: string })
                        .message;
                    }
                  }
                }
              }

              // Construct the JSON response with original snippet
              const response = {
                type: 'code',
                message: message + reasoningContent,
                snippet,
              };

              // Inject the response into the AI message
              lastAIMessage.content = JSON.stringify(response);
              console.log(
                '[MilkTea] Injected JSON response with original snippet into AI message'
              );
            }

            console.debug(
              '[MilkTea] Post tool call context for AI Agent:',
              JSON.stringify(context.messages, null, 2)
            );

            // Clear saved snippet after successful validation
            savedOriginalSnippet = undefined;

            return {
              messages: context.messages,
              shouldStop: true,
            };
          }
          console.log('[MilkTea] Validation failed, agent will retry');
          console.log('[MilkTea] Errors:', validationResult.data?.errors);
        } catch (error) {
          console.warn('[MilkTea] Failed to parse validation result:', error);
        }
      }

      return { messages: context.messages };
    };

    console.debug(
      '[MilkTea] Conversation messages:',
      JSON.stringify(conversationMessages, null, 2)
    );
    // Create AI agent with hooks
    const agent = new AIAgentBubble({
      name: `Milk Tea - ${request.bubbleName} Builder`,
      message: JSON.stringify(conversationMessages) || request.userRequest,
      systemPrompt,
      model: {
        model: request.model,
        temperature: 1,
        jsonMode: true,
      },
      tools: [
        {
          name: 'bubbleflow-validation-tool',
          credentials: credentials || {},
        },
      ],
      maxIterations: 10,
      credentials,
      beforeToolCall,
      afterToolCall,
    });

    console.log('[MilkTea] Executing agent...');
    const result = await agent.action();

    console.log('[MilkTea] Agent execution completed');
    console.log('[MilkTea] Success:', result.success);

    if (!result.success) {
      return {
        type: 'reject',
        message: result.error || 'Agent execution failed',
        success: false,
        error: result.error,
      };
    }

    // Parse the agent's JSON response
    let agentOutput: MilkTeaAgentOutput;
    try {
      const responseText = result.data?.response || '';
      agentOutput = MilkTeaAgentOutputSchema.parse(JSON.parse(responseText));
    } catch (error) {
      console.error('[MilkTea] Failed to parse agent output:', error);
      return {
        type: 'reject',
        message: 'Failed to parse agent response',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }

    console.log('[MilkTea] Agent output type:', agentOutput.type);

    // Handle different response types
    if (agentOutput.type === 'question' || agentOutput.type === 'reject') {
      return {
        type: agentOutput.type,
        message: agentOutput.message,
        success: true,
      };
    }

    // For code type, check validation status
    if (agentOutput.type === 'code') {
      return {
        type: 'code',
        message: agentOutput.message,
        snippet: agentOutput.snippet,
        success: true,
      };
    }

    // Should never reach here
    return {
      type: 'reject',
      message: 'Unexpected agent output format',
      success: false,
      error: 'Invalid response type',
    };
  } catch (error) {
    console.error('[MilkTea] Error during execution:', error);
    return {
      type: 'reject',
      message: 'An error occurred while processing your request',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
