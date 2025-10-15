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
 * Type for BubbleFlow validation result
 */
type ValidationToolResult = z.infer<
  typeof BubbleFlowValidationTool.resultSchema
>;

/**
 * Build the system prompt for General Chat agent
 */
function buildSystemPrompt(userName: string): string {
  return `You are Pearl, an AI Builder Agent specializing in creating complete BubbleLab workflows.

YOUR ROLE:
- Expert in building end-to-end workflows with multiple bubbles/integrations
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

Rejection (when infeasible):
{
  "type": "reject",
  "message": "Clear explanation of why this request cannot be fulfilled"
}

CRITICAL CODE GENERATION RULES:
1. Generate COMPLETE workflow code including:
   - All necessary imports from @bubblelab/bubble-core
   - A class that extends BubbleFlow
   - A handle() method with the workflow logic
   - Proper error handling and return values
2. Use available bubbles: EmailBubble, SlackBubble, WebhookBubble, HttpRequestBubble, etc.
3. Apply proper logic: use array methods (.map, .filter), loops, conditionals as needed
4. Access data from context variables and parameters
5. DO NOT include credentials in code - they are injected automatically
6. When you generate code (type: "code"), you MUST immediately call the validation tool
7. The validation tool will validate your complete workflow code
8. If validation fails, fix the code and try again until validation passes

CONTEXT:
User: ${userName}

EXAMPLES OF GOOD WORKFLOWS:

Example 1 - Email to multiple users:
\`\`\`typescript
import { BubbleFlow } from '@bubblelab/bubble-core';
import { EmailBubble } from '@bubblelab/bubble-core';

export class SendEmailsFlow extends BubbleFlow {
  async handle() {
    const users = [
      { email: 'user1@example.com', name: 'User 1' },
      { email: 'user2@example.com', name: 'User 2' },
    ];

    const results = [];
    for (const user of users) {
      const result = await new EmailBubble({
        to: user.email,
        subject: \`Hello \${user.name}\`,
        body: 'Welcome to our platform!',
      }).action();
      results.push(result);
    }

    return { success: true, count: results.length };
  }
}
\`\`\`

Example 2 - Fetch data and send to Slack:
\`\`\`typescript
import { BubbleFlow } from '@bubblelab/bubble-core';
import { HttpRequestBubble, SlackBubble } from '@bubblelab/bubble-core';

export class FetchAndNotifyFlow extends BubbleFlow {
  async handle() {
    // Fetch data
    const fetchResult = await new HttpRequestBubble({
      url: 'https://api.example.com/data',
      method: 'GET',
    }).action();

    if (!fetchResult.success) {
      throw new Error('Failed to fetch data');
    }

    // Send to Slack
    const slackResult = await new SlackBubble({
      channel: '#notifications',
      message: \`Received data: \${JSON.stringify(fetchResult.data)}\`,
    }).action();

    return { success: true, data: fetchResult.data };
  }
}
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
    ? `\n\nCurrent workflow code:\n\`\`\`typescript\n${request.currentCode}\n\`\`\` Available Variables:${request.availableVariables.join(', ')}`
    : '';

  messages.push(
    new HumanMessage(
      `REQUEST FROM USER:${request.userRequest} Context:${contextInfo}`
    )
  );

  return messages;
}

/**
 * Main General Chat service function
 */
export async function runPearl(
  request: PearlRequest,
  credentials?: Partial<Record<CredentialType, string>>
): Promise<PearlResponse> {
  console.log('[GeneralChat] Starting agent');
  console.log('[GeneralChat] User request:', request.userRequest);

  try {
    const bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();

    // Build system prompt and conversation messages
    const systemPrompt = buildSystemPrompt(request.userName);
    const conversationMessages = buildConversationMessages(request);

    // State to preserve original code across hook calls
    let savedOriginalCode: string | undefined;

    // Create hooks for validation tool
    const beforeToolCall: ToolHookBefore = async (context: ToolHookContext) => {
      if (context.toolName === 'bubbleflow-validation-tool') {
        console.log(
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

        console.log('[GeneralChat] Code to validate:', code);
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
          const validationResult: BubbleResult<ValidationToolResult> =
            context.toolOutput as BubbleResult<ValidationToolResult>;

          if (validationResult.data?.valid === true) {
            console.log(
              '[GeneralChat] Validation passed! Signaling completion.'
            );

            const code = savedOriginalCode || '';

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

          console.log('[GeneralChat] Validation failed, agent will retry');
          console.log('[GeneralChat] Errors:', validationResult.data?.errors);
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
        {
          name: 'list-bubbles-tool',
          credentials: credentials || {},
        },
        {
          name: 'get-bubble-details-tool',
          credentials: credentials || {},
        },
      ],
      maxIterations: 10,
      credentials,
      beforeToolCall,
      afterToolCall,
    });

    console.log('[GeneralChat] Executing agent...');
    const result = await agent.action();

    console.log('[GeneralChat] Agent execution completed');
    console.log('[GeneralChat] Success:', result.success);

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
      // if type is code and no snippet, return reject
      if (agentOutput.type === 'code' && !agentOutput.snippet) {
        return {
          type: 'reject',
          message: 'No snippet found in agent response',
          success: false,
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

    // Handle different response types
    if (agentOutput.type === 'question' || agentOutput.type === 'reject') {
      return {
        type: agentOutput.type,
        message: agentOutput.message,
        success: true,
      };
    }

    // For code type, return the complete workflow
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
    console.error('[GeneralChat] Error during execution:', error);
    return {
      type: 'reject',
      message: 'An error occurred while processing your request',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
