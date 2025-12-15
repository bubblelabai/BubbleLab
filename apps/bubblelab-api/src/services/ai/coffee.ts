/**
 * Coffee - Planning Agent for BubbleFlow Generation
 *
 * Coffee runs BEFORE Boba to gather clarification questions and generate
 * an implementation plan. This helps reduce ambiguity in user requests
 * and provides better context for code generation.
 *
 * Phase 1 Features:
 * - Ask clarification questions via multiple-choice
 * - Generate implementation plan with steps and bubble suggestions
 * - runBubbleFlow tool (mocked - returns NOT_AVAILABLE)
 *
 * Phase 2 Features:
 * - runBubbleFlow tool validates code and requests credentials from user
 * - Context gathering via actual BubbleFlow execution
 */

import {
  type CoffeeRequest,
  type CoffeeResponse,
  type CoffeePlanEvent,
  type ClarificationQuestion,
  type CoffeeRequestExternalContextEvent,
  CoffeePlanEventSchema,
  ClarificationQuestionSchema,
  CoffeeContextRequestInfoSchema,
  COFFEE_MAX_ITERATIONS,
  COFFEE_MAX_QUESTIONS,
  COFFEE_DEFAULT_MODEL,
  CREDENTIAL_ENV_MAP,
  CredentialType,
  CRITICAL_INSTRUCTIONS,
  TOOL_CALL_TO_DISCARD,
  BubbleName,
} from '@bubblelab/shared-schemas';
import {
  AIAgentBubble,
  type StreamingCallback,
  ListBubblesTool,
  type ToolHookAfter,
  type ToolHookContext,
} from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';
import { env } from 'src/config/env.js';
import { getBubbleFactory } from '../bubble-factory-instance.js';
import { ConversationMessage } from '@bubblelab/shared-schemas';

// Max retries for parsing agent output (separate from agent iterations)
const COFFEE_MAX_PARSE_RETRIES = 3;

// Coffee agent output schema for JSON mode
const CoffeeAgentOutputSchema = z.object({
  action: z
    .enum(['askClarification', 'generatePlan', 'requestContext'])
    .describe('The action to take'),
  questions: z
    .array(ClarificationQuestionSchema)
    .optional()
    .describe('Clarification questions (when action is askClarification)'),
  plan: CoffeePlanEventSchema.optional().describe(
    'Implementation plan (when action is generatePlan)'
  ),
  contextRequest: CoffeeContextRequestInfoSchema.optional().describe(
    'Context request info (when action is requestContext) - the agent will then call runBubbleFlow tool'
  ),
});

/**
 * Build the system prompt for Coffee agent
 */
async function buildCoffeeSystemPrompt(): Promise<string> {
  const listBubblesTool = new ListBubblesTool({});
  const listBubblesResult = await listBubblesTool.action();

  const boilerplate = (
    await getBubbleFactory()
  ).generateBubbleFlowBoilerplate();
  const bubbleList = listBubblesResult.data.bubbles
    .map(
      (bubble) =>
        `- ${bubble.name}: ${bubble.shortDescription || 'No description'}`
    )
    .join('\n');

  return `You are Coffee, a Planning Agent for Bubble Lab workflows.
Your role is to understand the user's workflow requirements, ask clarifying questions, gather external context when needed, and generate an implementation plan BEFORE code generation begins.

## YOUR RESPONSIBILITIES:
1. Analyze the user's natural language request
2. Understand the bubbles implementation details and capabilities using get-bubble-detail tool
3. If is is helpful to gather external data context (e.g., database schemas, file listings, google sheet files, etc.), use the tool runBubbleFlow to gather it, ex: spreadsheet names, table names, file names, schemas.
4. Identify any ambiguities or missing information
5. Ask 1-${COFFEE_MAX_QUESTIONS} targeted clarification questions with multiple-choice options
6. Generate a clear implementation plan once you have enough information

Here's the boilerplate template you should use as a starting point:
\`\`\`typescript
${boilerplate}
\`\`\`

Available bubbles in the system:
${bubbleList}

${CRITICAL_INSTRUCTIONS}

## 

## CLARIFICATION QUESTIONS GUIDELINES:
- Ask questions ONLY when there's genuine ambiguity
- Each question should have 2-4 clear choices
- Questions should be actionable and help determine the implementation
- Focus on:
  - Data sources (where does the data come from?)
  - Output destinations (where should results go?)
  - Specific integrations to use
  - Processing logic (filtering, transforming, etc.)
  - Trigger type (manual, scheduled, webhook)

## CONTEXT GATHERING WITH WEB TOOLS:
When the user mentions a website URL, wants to scrape/extract data from a site, or asks about vague topics that would benefit from web research, use the web tools to gather context:

- **web-search-tool**: Use this to search the web for information when the user asks about vague topics, wants to find something, or needs current information. Examples:
  - User asks "help me scrape job listings" → search for popular job listing sites
  - User asks about "best APIs for weather data" → search for weather API options
  - User mentions a topic you need more context on → search for relevant information

- **web-scrape-tool**: Use this to scrape content from a specific URL when the user provides a website or you need to understand a site's structure. Examples:
  - User provides a URL and wants to extract data → scrape to understand page structure
  - User asks to "scrape this site: example.com" → scrape to see what content is available
  - After web-search-tool returns results → scrape specific pages for more detail

IMPORTANT: Always gather web context BEFORE asking clarification questions when:
- The user provides a URL
- The user mentions scraping, extracting, or crawling a website
- The request involves external websites or APIs you're not familiar with
- The topic is vague and would benefit from web research

## CONTEXT GATHERING WITH runBubbleFlow:
Use the runBubbleFlow tool when you need external context from integrated services:
- Database schema information (table names, columns, relationships)
- File listings from cloud storage (Google Drive, etc.)
- API endpoint information from connected services
- Any other external data from user's connected accounts

IMPORTANT: When using runBubbleFlow:
- The flow code must be valid BubbleFlow TypeScript code
- The flow should NOT have any input parameters (inputSchema must be empty)
- The flow will be validated and the user will be asked to provide credentials
- Keep context-gathering flows simple - just fetch the minimal context needed

## PLAN GENERATION GUIDELINES:
When generating a plan, include:
- A brief summary of what the workflow will do
- Step-by-step breakdown with clear descriptions
- Which bubbles will be used in each step
- List of all estimated bubbles needed

## OUTPUT FORMAT (JSON):
You MUST respond in valid JSON with one of these structures:

When you need clarification:
{
  "action": "askClarification",
  "questions": [
    {
      "id": "unique_id",
      "question": "Clear question text?",
      "choices": [
        { "id": "choice_1", "label": "Option A", "description": "What this option means" },
        { "id": "choice_2", "label": "Option B", "description": "What this option means" }
      ],
      "context": "Why this question is important (optional)"
    }
  ]
}

When you have enough information to generate a plan:
{
  "action": "generatePlan",
  "plan": {
    "summary": "Brief overview of what the workflow will accomplish",
    "steps": [
      {
        "title": "Step title",
        "description": "Detailed description of what this step does",
        "bubblesUsed": ["BubbleName1", "BubbleName2"]
      }
    ],
    "estimatedBubbles": ["BubbleName1", "BubbleName2", "BubbleName3"]
  }
}

IMPORTANT: When you need external context, DO NOT output JSON. Instead, DIRECTLY CALL the runBubbleFlow tool with proper BubbleFlow code. The tool will handle pausing for user credentials.

## DECISION PROCESS:
1. Read the user's request carefully
2. Check if clarification answers or context answers are provided (previous round)
3. If this is the first interaction AND there's ambiguity → get-bubble-details-tool to understand the bubbles implementation details and capabilities
4. If the user provides a URL or mentions a website → use web-scrape-tool to understand the site structure
5. If the request is vague or involves topics you need more context on → use web-search-tool to research
6. Run bubbleflow to get external context from integrated services if needed (database schema, file listings, etc.)
7. Then ask clarification questions if needed based on additional context gathered.
8. If clarification answers are provided OR request is clear → Generate the plan
9. If additional context is needed, gather it using appropriate tools
10. ALWAYS prefer generating a plan over asking more questions when possible

## TOOLS AVAILABLE:
- askClarification: Ask the user multiple-choice questions (handled via JSON output)
- runBubbleFlow: Run a mini flow to gather context from integrated services (e.g., fetch database schema, list files from connected accounts, find the right apify actor to use)
- get-bubble-details-tool: Get the details of a bubble (e.g., input parameters, output structure), always run to check api for the bubble before running the bubbleFlow.
- web-search-tool: Search the web for information on topics, find relevant sites, or research vague requests. Use this when the user asks about things you need more context on.
- web-scrape-tool: Scrape content from a specific URL to understand its structure and available data. Use this when the user provides a website URL or wants to extract data from a site.

Remember: Your goal is to understand the user's intent well enough to create a solid implementation plan. Don't over-question - if the request is reasonably clear, proceed with plan generation.`;
}

/**
 * Build conversation history from request - converts unified messages to ConversationMessage format.
 * This format enables KV cache optimization by sending messages as separate user/assistant turns
 * instead of serializing everything into a single message.
 */
function buildConversationHistory(
  request: CoffeeRequest
): ConversationMessage[] {
  const result: ConversationMessage[] = [];

  // If no messages, return empty - the initial prompt will be passed separately via `message` param
  if (!request.messages || request.messages.length === 0) {
    return result;
  }

  // Process each message in order to build the conversation history
  for (const msg of request.messages) {
    switch (msg.type) {
      case 'user':
        result.push({ role: 'user', content: msg.content });
        break;

      case 'assistant':
        // Include AI responses with their content
        result.push({ role: 'assistant', content: msg.content });
        break;

      case 'clarification_request': {
        // AI asked clarification questions - represent as assistant message
        const questionsText = msg.questions
          .map(
            (q) =>
              `${q.question}\n${q.choices.map((c) => `  - ${c.label}: ${c.description || ''}`).join('\n')}`
          )
          .join('\n\n');
        result.push({
          role: 'assistant',
          content: `I have some clarification questions:\n\n${questionsText}`,
        });
        break;
      }

      case 'clarification_response': {
        // User answered clarification questions - find original questions for context
        const clarificationRequest = request.messages?.find(
          (m) => m.type === 'clarification_request'
        );

        let answerText = 'Here are my answers:';
        for (const [questionId, answerIds] of Object.entries(msg.answers)) {
          const question =
            clarificationRequest?.type === 'clarification_request'
              ? clarificationRequest.questions.find((q) => q.id === questionId)
              : null;
          const answerLabels = answerIds.map(
            (aid) => question?.choices.find((c) => c.id === aid)?.label || aid
          );
          answerText += `\n- ${question?.question || questionId}: ${answerLabels.join(', ')}`;
        }
        result.push({ role: 'user', content: answerText });
        break;
      }

      case 'context_request':
        // AI requested external context
        result.push({
          role: 'assistant',
          content: `I need to gather some external context: ${msg.request.description}`,
        });
        break;

      case 'context_response': {
        // User provided context response
        const answer = msg.answer;
        let contextText = '';
        if (answer.status === 'success') {
          contextText = `Context gathered successfully:\n${JSON.stringify(answer.result, null, 2)}`;
        } else if (answer.status === 'rejected') {
          contextText = 'I chose to skip the context-gathering step.';
        } else if (answer.status === 'error') {
          contextText = `Context gathering failed: ${answer.error}`;
        }
        result.push({ role: 'user', content: contextText });
        break;
      }

      case 'plan': {
        // AI generated a plan
        const planText = `Here's my implementation plan:\n\n**Summary:** ${msg.plan.summary}\n\n**Steps:**\n${msg.plan.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n')}\n\n**Estimated Bubbles:** ${msg.plan.estimatedBubbles.join(', ')}`;
        result.push({ role: 'assistant', content: planText });
        break;
      }

      case 'plan_approval': {
        if (msg.approved) {
          const approvalText = msg.comment
            ? `I approve the plan. ${msg.comment}`
            : 'I approve the plan. Please proceed.';
          result.push({ role: 'user', content: approvalText });
        } else {
          const rejectionText = msg.comment
            ? `I would like to revise the plan. ${msg.comment}`
            : 'I would like to revise the plan.';
          result.push({ role: 'user', content: rejectionText });
        }
        break;
      }

      case 'system':
        // System messages (e.g., retry context, error feedback)
        result.push({ role: 'user', content: `[System]: ${msg.content}` });
        break;

      case 'tool_result': {
        // Tool call results from previous iterations - format as assistant message
        const toolResult = msg as {
          toolName?: string;
          toolCallId?: string;
          input?: unknown;
          output?: unknown;
          duration?: number;
          success?: boolean;
        };

        let toolResultText = `Tool call completed: ${toolResult.toolName || 'unknown'}\n`;
        if (toolResult.input) {
          toolResultText += `Input: ${JSON.stringify(toolResult.input, null, 2)}\n`;
        }
        if (toolResult.output) {
          toolResultText += `Output: ${JSON.stringify(toolResult.output, null, 2)}\n`;
        }
        toolResultText += `Status: ${toolResult.success ? 'Success' : 'Failed'} (${toolResult.duration || 0}ms)`;

        if (TOOL_CALL_TO_DISCARD.includes(toolResult.toolName as BubbleName)) {
          continue;
        }
        result.push({ role: 'tool', content: toolResultText });
        break;
      }
    }
  }

  return result;
}

/**
 * Main Coffee service function - gathers clarification and generates plan
 */
export async function runCoffee(
  request: CoffeeRequest,
  credentials?: Partial<Record<CredentialType, string>>,
  apiStreamingCallback?: StreamingCallback
): Promise<CoffeeResponse> {
  // Check for required API keys
  if (!env.GOOGLE_API_KEY) {
    return {
      type: 'error',
      error: `Google API key is required to run Coffee, please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.GOOGLE_GEMINI_CRED]} is set.`,
      success: false,
    };
  }

  // Track context request state (will be set by runBubbleFlow tool if called)
  // Using an object wrapper because TypeScript can't track mutations inside closures
  const coffeeState: {
    contextRequest: CoffeeRequestExternalContextEvent | null;
  } = {
    contextRequest: null,
  };

  try {
    // Build system prompt and conversation history
    const systemPrompt = await buildCoffeeSystemPrompt();
    // Build conversation history for KV cache optimization
    // The history is passed as separate messages instead of a single serialized string
    const conversationHistory = buildConversationHistory(request);

    // Merge credentials
    const mergedCredentials: Partial<Record<CredentialType, string>> = {
      [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
      [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',
      [CredentialType.FIRECRAWL_API_KEY]: process.env.FIRE_CRAWL_API_KEY || '',
      ...credentials,
    };

    // Create afterToolCall hook to stop agent after runBubbleFlow is validated
    const afterToolCall: ToolHookAfter = async (context: ToolHookContext) => {
      if (context.toolName === ('runBubbleFlow' as unknown)) {
        console.log('[Coffee] Post-hook: runBubbleFlow completed');

        // Check if the tool returned AWAITING_USER_INPUT status
        const toolOutput = context.toolOutput?.data as {
          status?: string;
          flowId?: string;
        };

        if (toolOutput?.status === 'AWAITING_USER_INPUT') {
          console.log(
            '[Coffee] Post-hook: Context request validated, stopping agent execution'
          );
          // Stop the agent - we need user input before continuing
          return { messages: context.messages, shouldStop: true };
        }
      }

      return { messages: context.messages };
    };

    // Retry loop for agent execution and parsing
    let parseAttempt = 0;
    let lastParseError: string | null = null;
    // Track additional messages added during retries (for error feedback)
    const retryMessages: ConversationMessage[] = [];

    while (parseAttempt <= COFFEE_MAX_PARSE_RETRIES) {
      // If this is a retry, append the parse error as feedback
      if (parseAttempt > 0 && lastParseError) {
        console.log(
          `[Coffee] Parse retry attempt ${parseAttempt}/${COFFEE_MAX_PARSE_RETRIES}`
        );
        retryMessages.push({
          role: 'user',
          content: `[System]: Your previous response failed to parse. Error: ${lastParseError}\n\nPlease try again and ensure your response is valid JSON matching the expected schema.`,
        });
      }

      // Combine base conversation history with any retry messages
      const currentHistory = [...conversationHistory, ...retryMessages];

      // Create AI agent with separate conversation history for KV cache optimization
      // The 'message' param contains the current user request
      // The 'conversationHistory' param contains previous turns as separate messages
      const agent = new AIAgentBubble({
        name: 'Coffee - Planning Agent',
        message: `User's workflow request: "${request.prompt}"`,
        conversationHistory:
          currentHistory.length > 0 ? currentHistory : undefined,
        systemPrompt,
        streaming: true,
        streamingCallback: (event) => {
          return apiStreamingCallback?.(event);
        },

        model: {
          model: COFFEE_DEFAULT_MODEL,
          reasoningEffort: 'medium',
          temperature: 0.7,
          jsonMode: true,
        },
        tools: [
          {
            name: 'get-bubble-details-tool',
          },
          {
            name: 'web-search-tool',
          },
          {
            name: 'web-scrape-tool',
          },
        ],
        customTools: [
          {
            name: 'runBubbleFlow',
            description:
              'Run a mini bubble flow to gather context (e.g., fetch database schema, list available files). The flow code must be valid BubbleFlow TypeScript and should NOT have any input parameters.',
            schema: z.object({
              purpose: z
                .string()
                .describe('Why you need this context (displayed to user)'),
              flowDescription: z
                .string()
                .describe(
                  'User-friendly description of what the flow does (displayed to user)'
                ),
              flowCode: z
                .string()
                .describe(
                  'The complete BubbleFlow TypeScript code to execute. Must be valid code with no input parameters.'
                ),
            }),
            func: async (input: Record<string, unknown>) => {
              console.log('[Coffee] runBubbleFlow called:', {
                purpose: input.purpose,
                flowDescription: input.flowDescription,
              });

              const flowCode = input.flowCode as string;
              const flowDescription = input.flowDescription as string;

              // Validate the flow code
              const bubbleFactory = await getBubbleFactory();
              const validationResult = await validateAndExtract(
                flowCode,
                bubbleFactory,
                false // skipValidation
              );

              if (!validationResult.valid) {
                console.error(
                  '[Coffee] Flow validation failed:',
                  validationResult.errors
                );
                return {
                  data: {
                    status: 'error',
                    message: `Flow validation failed: ${validationResult.errors?.join(', ') || 'Unknown error'}`,
                  },
                };
              }

              // Extract required credentials from the validated flow
              // The validation result already has requiredCredentials extracted
              const requiredCredentialsMap =
                validationResult.requiredCredentials || {};

              // Flatten to unique credential types
              const requiredCredentials: CredentialType[] = [
                ...new Set(Object.values(requiredCredentialsMap).flat()),
              ];

              // Generate a unique flow ID for this context request
              const contextFlowId = `coffee-ctx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

              // Build the context request event
              const contextRequestEvent: CoffeeRequestExternalContextEvent = {
                flowId: contextFlowId,
                flowCode: flowCode,
                requiredCredentials,
                description: flowDescription,
              };

              // Emit the context request event to frontend
              if (apiStreamingCallback) {
                await apiStreamingCallback({
                  type: 'coffee_request_context',
                  data: contextRequestEvent,
                });
              }

              // Store the context request so the response handler knows we're waiting
              coffeeState.contextRequest = contextRequestEvent;

              // Return a special response to signal the agent to stop
              return {
                data: {
                  status: 'AWAITING_USER_INPUT',
                  message:
                    'Context request sent to user. Waiting for credentials and approval.',
                  flowId: contextFlowId,
                },
              };
            },
          },
        ],
        maxIterations: COFFEE_MAX_ITERATIONS,
        credentials: mergedCredentials,
        afterToolCall,
      });

      // Execute the agent
      const result = await agent.action();

      // Check if context request was triggered during tool execution
      // If so, return the context request response (the event was already sent)
      if (coffeeState.contextRequest) {
        console.log(
          '[Coffee] Context request triggered, awaiting user input:',
          coffeeState.contextRequest.flowId
        );
        return {
          type: 'context_request',
          contextRequest: coffeeState.contextRequest,
          success: true,
        };
      }

      if (!result.success || !result.data?.response) {
        console.error('[Coffee] Agent execution failed:', result.error);
        return {
          type: 'error',
          error: result.error || 'Coffee agent execution failed',
          success: false,
        };
      }

      // Parse the agent's JSON response
      const responseText = result.data.response;
      console.log('[Coffee] Agent response:', responseText);
      // Handle array responses - take the last element if it's an array
      let finalResponseText = responseText;
      try {
        const parsedArray = JSON.parse(responseText);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          const lastElement = parsedArray[parsedArray.length - 1];
          if (
            lastElement &&
            typeof lastElement === 'object' &&
            lastElement.text
          ) {
            finalResponseText = lastElement.text;
            console.log(
              '[Coffee] Extracted text from array response:',
              finalResponseText
            );
          }
        }
      } catch (e) {
        // Not an array, continue with original response
      }

      try {
        const parseResult = parseJsonWithFallbacks(finalResponseText);
        if (!parseResult.success || !parseResult.parsed) {
          throw new Error(
            `Failed to parse JSON response: ${parseResult.error || 'Unknown parse error'}`
          );
        }

        const agentOutput = CoffeeAgentOutputSchema.parse(parseResult.parsed);

        if (
          agentOutput.action === 'askClarification' &&
          agentOutput.questions
        ) {
          // Validate and limit questions
          const questions: ClarificationQuestion[] =
            agentOutput.questions.slice(0, COFFEE_MAX_QUESTIONS);

          // Send clarification event to frontend
          if (apiStreamingCallback) {
            await apiStreamingCallback({
              type: 'coffee_clarification',
              data: { questions },
            });
          }

          return {
            type: 'clarification',
            clarification: { questions },
            success: true,
          };
        } else if (agentOutput.action === 'generatePlan' && agentOutput.plan) {
          const plan: CoffeePlanEvent = agentOutput.plan;

          // Send plan event to frontend
          if (apiStreamingCallback) {
            await apiStreamingCallback({
              type: 'coffee_plan',
              data: plan,
            });
          }

          // Send completion event
          if (apiStreamingCallback) {
            await apiStreamingCallback({
              type: 'coffee_complete',
              data: { success: true },
            });
          }

          return {
            type: 'plan',
            plan,
            success: true,
          };
        } else if (
          agentOutput.action === 'requestContext' &&
          agentOutput.contextRequest
        ) {
          // The agent wants to request context but hasn't called runBubbleFlow yet
          // This is an intermediate state - the agent should call runBubbleFlow next
          // But if we reach here, return an error since the tool should have been called
          console.warn(
            '[Coffee] Agent returned requestContext action but runBubbleFlow was not called'
          );
          return {
            type: 'error',
            error:
              'Agent requested context but did not provide flow code. Please try again.',
            success: false,
          };
        } else {
          // Invalid action or missing data - this is a parse error, retry
          lastParseError =
            'Invalid action or missing required data in response';
          parseAttempt++;
          continue;
        }
      } catch (parseError) {
        // Store the error and retry
        lastParseError =
          parseError instanceof Error ? parseError.message : 'Unknown error';
        console.error(
          `[Coffee] Parse error (attempt ${parseAttempt + 1}/${COFFEE_MAX_PARSE_RETRIES + 1}):`,
          lastParseError
        );

        // Add the AI response to retry messages so the agent knows what it said
        retryMessages.push({ role: 'assistant', content: responseText });

        parseAttempt++;
        continue;
      }
    }

    // All retries exhausted
    console.error(
      '[Coffee] All parse retries exhausted. Last error:',
      lastParseError
    );
    if (apiStreamingCallback) {
      await apiStreamingCallback({
        type: 'error',
        data: {
          error: `Failed to parse agent response after ${COFFEE_MAX_PARSE_RETRIES + 1} attempts: ${lastParseError}`,
          recoverable: false,
        },
      });
    }
    return {
      type: 'error',
      error: `Failed to parse agent response after ${COFFEE_MAX_PARSE_RETRIES + 1} attempts: ${lastParseError}`,
      success: false,
    };
  } catch (error) {
    console.error('[Coffee] Error during execution:', error);
    if (apiStreamingCallback) {
      await apiStreamingCallback({
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        },
      });
    }
    return {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    };
  }
}
