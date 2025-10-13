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
} from '@bubblelab/bubble-core';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

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
3. Check if request is unclear or missing critical information � If yes, ASK QUESTION
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
6. DO NOT include credentials in the snippet - they are injected automatically
7. When you generate code (type: "code"), you MUST immediately call the validation tool with the snippet
8. The validation tool will validate your snippet inserted into the full code
9. If validation fails, fix the snippet and try again until validation passes

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
 * Check if validation passed from tool calls
 */
function checkValidationSuccess(
  toolCalls: Array<{
    tool: string;
    input?: unknown;
    output?: unknown;
  }>
): { validated: boolean; errors?: string[] } {
  // Find the last validation tool call
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i];
    if (
      call.tool === 'bubbleflow-validation-tool' ||
      call.tool === 'bubbleflow-validation'
    ) {
      try {
        let outputContent: string;

        // Handle different output formats
        if (typeof call.output === 'string') {
          outputContent = call.output;
        } else if (
          call.output &&
          typeof call.output === 'object' &&
          'content' in call.output
        ) {
          const content = (call.output as { content: unknown }).content;
          outputContent =
            typeof content === 'string' ? content : JSON.stringify(content);
        } else {
          outputContent = JSON.stringify(call.output);
        }

        const validationResult = JSON.parse(outputContent);

        return {
          validated: validationResult.valid === true,
          errors: validationResult.errors || [],
        };
      } catch {
        // Failed to parse, assume not validated
        continue;
      }
    }
  }

  return { validated: false };
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
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.log('[MilkTea] Post-hook: Checking validation result');

        try {
          const validationResult: BubbleResult<ValidationToolResult> =
            context.toolOutput as BubbleResult<ValidationToolResult>;
          if (validationResult.data?.valid === true) {
            console.log('[MilkTea] Validation passed! Signaling completion.');

            // Extract the snippet directly from tool input
            const snippet = (context.toolInput as { code?: string })?.code;

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
                }
              }

              // Construct the JSON response
              const response = {
                type: 'code',
                message,
                snippet,
              };

              // Inject the response into the AI message
              lastAIMessage.content = JSON.stringify(response);
              console.log(
                '[MilkTea] Injected JSON response with snippet into AI message'
              );
            }

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

    // Create AI agent with hooks
    const agent = new AIAgentBubble({
      name: `Milk Tea - ${request.bubbleName} Builder`,
      message:
        (conversationMessages[conversationMessages.length - 1]
          ?.content as string) || request.userRequest,
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
