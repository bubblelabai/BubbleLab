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
 */

import {
  type CoffeeRequest,
  type CoffeeResponse,
  type CoffeePlanEvent,
  type ClarificationQuestion,
  CoffeePlanEventSchema,
  ClarificationQuestionSchema,
  COFFEE_MAX_ITERATIONS,
  COFFEE_MAX_QUESTIONS,
  COFFEE_DEFAULT_MODEL,
  CREDENTIAL_ENV_MAP,
  CredentialType,
} from '@bubblelab/shared-schemas';
import {
  AIAgentBubble,
  type StreamingCallback,
  ListBubblesTool,
  HumanMessage,
  type BaseMessage,
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { parseJsonWithFallbacks } from '@bubblelab/bubble-core';
import { env } from 'src/config/env.js';

// Coffee agent output schema for JSON mode
const CoffeeAgentOutputSchema = z.object({
  action: z
    .enum(['askClarification', 'generatePlan'])
    .describe('The action to take'),
  questions: z
    .array(ClarificationQuestionSchema)
    .optional()
    .describe('Clarification questions (when action is askClarification)'),
  plan: CoffeePlanEventSchema.optional().describe(
    'Implementation plan (when action is generatePlan)'
  ),
});

/**
 * Build the system prompt for Coffee agent
 */
async function buildCoffeeSystemPrompt(): Promise<string> {
  const listBubblesTool = new ListBubblesTool({});
  const listBubblesResult = await listBubblesTool.action();

  const bubbleList = listBubblesResult.data.bubbles
    .map(
      (bubble) =>
        `- ${bubble.name}: ${bubble.shortDescription || 'No description'}`
    )
    .join('\n');

  return `You are Coffee, a Planning Agent for Bubble Lab workflows.
Your role is to understand the user's workflow requirements, ask clarifying questions, and generate an implementation plan BEFORE code generation begins.

## YOUR RESPONSIBILITIES:
1. Analyze the user's natural language request
2. Identify any ambiguities or missing information
3. Ask 1-${COFFEE_MAX_QUESTIONS} targeted clarification questions with multiple-choice options
4. Generate a clear implementation plan once you have enough information

## AVAILABLE BUBBLES (integrations/tools):
${bubbleList}

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

## DECISION PROCESS:
1. Read the user's request carefully
2. Check if clarification answers are provided (previous round)
3. If this is the first interaction AND there's ambiguity → Ask clarification questions
4. If clarification answers are provided OR request is clear → Generate the plan
5. ALWAYS prefer generating a plan over asking more questions when possible

## TOOLS AVAILABLE:
- askClarification: Ask the user multiple-choice questions (handled via JSON output)
- runBubbleFlow: Run a mini flow to gather context (e.g., fetch database schema, list files) - Currently NOT AVAILABLE in Phase 1

Remember: Your goal is to understand the user's intent well enough to create a solid implementation plan. Don't over-question - if the request is reasonably clear, proceed with plan generation.`;
}

/**
 * Build conversation messages from request
 */
function buildConversationMessages(request: CoffeeRequest): BaseMessage[] {
  const messages: BaseMessage[] = [];

  let messageContent = `User's workflow request: "${request.prompt}"`;

  // Include clarification answers if provided
  if (
    request.clarificationAnswers &&
    Object.keys(request.clarificationAnswers).length > 0
  ) {
    messageContent += "\n\nUser's answers to clarification questions:";
    for (const [questionId, answerIds] of Object.entries(
      request.clarificationAnswers
    )) {
      messageContent += `\n- Question ${questionId}: Selected option(s): ${answerIds.join(', ')}`;
    }
    messageContent +=
      '\n\nBased on these answers, please generate the implementation plan.';
  }

  messages.push(new HumanMessage(messageContent));
  return messages;
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

  try {
    // Build system prompt and conversation messages
    const systemPrompt = await buildCoffeeSystemPrompt();
    const conversationMessages = buildConversationMessages(request);

    // Merge credentials
    const mergedCredentials: Partial<Record<CredentialType, string>> = {
      [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
      [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',
      ...credentials,
    };

    // Create AI agent
    const agent = new AIAgentBubble({
      name: 'Coffee - Planning Agent',
      message: JSON.stringify(conversationMessages),
      systemPrompt,
      streaming: true,
      streamingCallback: (event) => {
        return apiStreamingCallback?.(event);
      },
      model: {
        model: COFFEE_DEFAULT_MODEL,
        temperature: 0.7,
        jsonMode: true,
      },
      customTools: [
        {
          name: 'runBubbleFlow',
          description:
            'Run a mini bubble flow to gather context (e.g., fetch database schema, list available files). Currently NOT AVAILABLE in Phase 1.',
          schema: z.object({
            purpose: z.string().describe('What context you want to gather'),
            flowDescription: z
              .string()
              .describe('Description of the mini flow to run'),
          }),
          func: async (input: Record<string, unknown>) => {
            // Mocked for Phase 1 - always returns NOT_AVAILABLE
            console.log('[Coffee] runBubbleFlow called (mocked):', input);

            // Send context gathering event to frontend
            if (apiStreamingCallback) {
              await apiStreamingCallback({
                type: 'coffee_context_gathering',
                data: {
                  status: 'complete',
                  miniFlowDescription: input.flowDescription as string,
                  result: 'NOT_AVAILABLE',
                },
              });
            }

            return {
              data: {
                status: 'NOT_AVAILABLE',
                message:
                  'Context gathering via runBubbleFlow is not yet available. Please proceed with the information you have.',
              },
            };
          },
        },
      ],
      maxIterations: COFFEE_MAX_ITERATIONS,
      credentials: mergedCredentials,
    });

    // Execute the agent
    const result = await agent.action();

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

    try {
      const parseResult = parseJsonWithFallbacks(responseText);
      if (!parseResult.success || !parseResult.parsed) {
        throw new Error('Failed to parse JSON response');
      }

      const agentOutput = CoffeeAgentOutputSchema.parse(parseResult.parsed);

      if (agentOutput.action === 'askClarification' && agentOutput.questions) {
        // Validate and limit questions
        const questions: ClarificationQuestion[] = agentOutput.questions.slice(
          0,
          COFFEE_MAX_QUESTIONS
        );

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
      } else {
        // Invalid action or missing data
        return {
          type: 'error',
          error: 'Invalid agent response: missing action or data',
          success: false,
        };
      }
    } catch (parseError) {
      console.error('[Coffee] Error parsing agent response:', parseError);
      return {
        type: 'error',
        error: `Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        success: false,
      };
    }
  } catch (error) {
    console.error('[Coffee] Error during execution:', error);
    return {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    };
  }
}
