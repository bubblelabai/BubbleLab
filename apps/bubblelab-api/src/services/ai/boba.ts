/**
 * Boba - BubbleFlow Code Generation Service
 *
 * A service that wraps BubbleFlowGeneratorWorkflow to generate BubbleFlow code
 * from natural language prompts with streaming support.
 */

import {
  type GenerationResult,
  BubbleName,
  CREDENTIAL_ENV_MAP,
  CredentialType,
  TOOL_CALL_TO_DISCARD,
} from '@bubblelab/shared-schemas';
import { BubbleLogger, type StreamingCallback } from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { env } from 'src/config/env.js';
import { getPricingTable } from 'src/config/pricing.js';
import { getBubbleFactory } from '../bubble-factory-instance.js';
import { BubbleFlowGeneratorWorkflow } from './bubbleflow-generator.workflow.js';

export interface BobaRequest {
  prompt: string;
  credentials?: Partial<Record<CredentialType, string>>;
  /** Messages from the planning phase (Coffee) for context */
  messages?: Array<Record<string, unknown>>;
  /** Plan context string from the planning phase */
  planContext?: string;
}

export interface BobaResponse extends GenerationResult {
  // Extends GenerationResult with any additional fields if needed
}

/**
 * Build full context string from messages including clarification, context, and plan.
 * This provides Boba with all the information gathered during the planning phase.
 */
export function buildFullContextFromMessages(
  messages?: Array<Record<string, unknown>>,
  planContext?: string
): string {
  if (!messages || messages.length === 0) {
    return planContext
      ? `[Implementation Plan from Planning Phase]:\n${planContext}`
      : '';
  }

  const contextParts: string[] = [];

  // Extract all context requests and responses (database schema, file listings, etc.)
  const contextRequests = messages.filter(
    (msg) => msg.type === 'context_request'
  );
  const contextResponses = messages.filter(
    (msg) => msg.type === 'context_response'
  );

  if (contextRequests.length > 0 || contextResponses.length > 0) {
    contextParts.push('=== CONTEXT GATHERING INFORMATION ===');

    // Process all context request/response pairs
    // Match them by index order or process independently
    const maxPairs = Math.max(contextRequests.length, contextResponses.length);
    for (let i = 0; i < maxPairs; i++) {
      const request = contextRequests[i];
      const response = contextResponses[i];

      if (request) {
        const requestData = request.request as {
          flowId?: string;
          flowCode?: string;
          requiredCredentials?: string[];
          description?: string;
        };
        if (requestData.description) {
          contextParts.push(`Purpose: ${requestData.description}`);
        }
      }

      if (response) {
        const answer = response.answer as {
          flowId?: string;
          status?: string;
          result?: unknown;
          error?: string;
          originalRequest?: {
            flowId?: string;
            flowCode?: string;
            requiredCredentials?: string[];
            description?: string;
          };
        };

        // Include the flow code that was executed for context gathering
        if (answer.originalRequest?.flowCode) {
          contextParts.push('Context Gathering Flow Code:');
          contextParts.push('```typescript');
          contextParts.push(answer.originalRequest.flowCode);
          contextParts.push('```');
        }

        if (answer.status === 'success' && answer.result) {
          contextParts.push('Context Result:');
          contextParts.push(JSON.stringify(answer.result, null, 2));
        } else if (answer.error) {
          contextParts.push(`Context Error: ${answer.error}`);
        }
      }

      if (request || response) {
        contextParts.push(''); // Empty line between pairs
      }
    }
  }

  // Extract all clarification requests and responses (user's answers to questions)
  const clarificationRequests = messages.filter(
    (msg) => msg.type === 'clarification_request'
  );
  const clarificationResponses = messages.filter(
    (msg) => msg.type === 'clarification_response'
  );

  if (clarificationRequests.length > 0 || clarificationResponses.length > 0) {
    contextParts.push('=== CLARIFICATION QUESTIONS AND ANSWERS ===');

    // Collect all questions from all clarification requests
    const allQuestions: Array<{
      id: string;
      question: string;
      choices?: Array<{ id: string; label: string; description?: string }>;
      context?: string;
    }> = [];

    clarificationRequests.forEach((req) => {
      const questions = req.questions as Array<{
        id: string;
        question: string;
        choices?: Array<{ id: string; label: string; description?: string }>;
        context?: string;
      }>;
      allQuestions.push(...questions);
    });

    // Merge all answers from all clarification responses
    const allAnswers: Record<string, string[]> = {};
    clarificationResponses.forEach((resp) => {
      const answers = resp.answers as Record<string, string[]>;
      Object.entries(answers).forEach(([questionId, answerIds]) => {
        if (!allAnswers[questionId]) {
          allAnswers[questionId] = [];
        }
        allAnswers[questionId].push(...answerIds);
      });
    });

    // Process all questions with their corresponding answers
    allQuestions.forEach((q) => {
      const userAnswers = allAnswers[q.id] || [];
      const selectedChoices = q.choices
        ?.filter((choice) => userAnswers.includes(choice.id))
        .map(
          (choice) =>
            `${choice.label}${choice.description ? ` (${choice.description})` : ''}`
        )
        .join(', ');

      contextParts.push(`Q: ${q.question}`);
      if (q.context) {
        contextParts.push(`   Context: ${q.context}`);
      }
      if (selectedChoices) {
        contextParts.push(`A: ${selectedChoices}`);
      } else if (userAnswers.length > 0) {
        // Fallback if choices aren't available
        contextParts.push(`A: ${userAnswers.join(', ')}`);
      }
      contextParts.push(''); // Empty line between Q&A pairs
    });
  }

  // Extract all tool results (successful tool calls during planning)
  const toolResults = messages.filter((msg) => msg.type === 'tool_result');

  if (toolResults.length > 0) {
    contextParts.push('=== TOOL CALL RESULTS FROM PLANNING PHASE ===');

    toolResults.forEach((toolResult) => {
      if (TOOL_CALL_TO_DISCARD.includes(toolResult.toolName as BubbleName)) {
        return;
      }
      const result = toolResult as {
        toolName?: string;
        toolCallId?: string;
        input?: unknown;
        output?: unknown;
        duration?: number;
        success?: boolean;
      };

      contextParts.push(`Tool: ${result.toolName || 'unknown'}`);
      if (result.input) {
        contextParts.push(`Input: ${JSON.stringify(result.input, null, 2)}`);
      }
      if (result.output) {
        contextParts.push(`Output: ${JSON.stringify(result.output, null, 2)}`);
      }
      contextParts.push(
        `Status: ${result.success ? 'Success' : 'Failed'} (${result.duration || 0}ms)`
      );
      contextParts.push(''); // Empty line between tool results
    });
  }

  // Add plan context if available
  if (planContext) {
    contextParts.push('=== IMPLEMENTATION PLAN FROM PLANNING PHASE ===');
    contextParts.push(planContext);
  }

  return contextParts.join('\n');
}

/**
 * Main Boba service function - generates BubbleFlow code from natural language
 *
 * @param request - The request containing prompt and optional credentials
 * @param apiStreamingCallback - Optional callback for streaming events
 * @returns Promise<GenerationResult> - The generation result with code, validation, and metadata
 */
export async function runBoba(
  request: BobaRequest,
  apiStreamingCallback?: StreamingCallback
): Promise<GenerationResult> {
  const { prompt, credentials, messages, planContext } = request;

  // Build full context from messages (clarification, context gathering, tool results)
  const fullContext = buildFullContextFromMessages(messages, planContext);

  // Combine the original prompt with the full context
  const enrichedPrompt = fullContext ? `${prompt}\n\n${fullContext}` : prompt;

  if (!env.OPENROUTER_API_KEY) {
    return {
      summary: '',
      inputsSchema: '',
      toolCalls: [],
      generatedCode: '',
      isValid: false,
      success: false,
      error: `OpenRouter API key is required to run (for apply model), please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.OPENROUTER_CRED]} is set, please obtain one https://openrouter.ai/settings/keys.`,
    };
  } else if (!env.GOOGLE_API_KEY) {
    return {
      summary: '',
      inputsSchema: '',
      toolCalls: [],
      generatedCode: '',
      isValid: false,
      success: false,
      error: `Google API key is required to run (for main generation model), please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.GOOGLE_GEMINI_CRED]} is set, please obtain one https://console.cloud.google.com/apis/credentials.`,
    };
  }

  // Create logger for token tracking
  const logger = new BubbleLogger('BubbleFlowGeneratorWorkflow', {
    pricingTable: getPricingTable(),
  });

  // Merge provided credentials with default Google Gemini credential
  const mergedCredentials: Partial<Record<CredentialType, string>> = {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
    [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',

    ...credentials,
  };
  const bubbleFactory = await getBubbleFactory();

  // Create BubbleFlowGeneratorWorkflow instance
  const generator = new BubbleFlowGeneratorWorkflow(
    {
      prompt: enrichedPrompt,
      credentials: mergedCredentials,
      streamingCallback: apiStreamingCallback,
    },
    bubbleFactory,
    {
      logger,
    }
  );

  // Generate the code with streaming
  const result = await generator.action();

  // Validate the generated code
  let actualIsValid = result.data.isValid;
  const validationResult = await validateAndExtract(
    result.data.generatedCode,
    bubbleFactory
  );

  if (result.data.generatedCode && result.data.generatedCode.trim()) {
    try {
      result.data.inputsSchema = JSON.stringify(validationResult.inputSchema);

      if (validationResult.valid && validationResult) {
        actualIsValid = true;
      } else {
        // Keep the AI's validation result if our parsing failed
        actualIsValid = result.data.isValid;
      }
    } catch (parseError) {
      console.error('[Boba] Error parsing bubble parameters:', parseError);
      // Keep the AI's validation result if our parsing failed
      actualIsValid = result.data.isValid;
    }
  }

  // Get service usage from logger execution summary
  const executionSummary = logger.getExecutionSummary();
  const serviceUsage = executionSummary.serviceUsage;

  // Build and return final generation result

  const generationResult: GenerationResult = {
    generatedCode: result.data.generatedCode,
    summary: result.data.summary,
    inputsSchema: result.data.inputsSchema,
    isValid: actualIsValid,
    success: result.success,
    error: result.error,
    toolCalls: result.data.toolCalls,
    bubbleCount: Object.keys(validationResult.bubbleParameters ?? {}).length,
    serviceUsage,
    codeLength: result.data.generatedCode.length,
    bubbleParameters: validationResult.bubbleParameters,
  };

  return generationResult;
}
