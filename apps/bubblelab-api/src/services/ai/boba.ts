/**
 * Boba - BubbleFlow Code Generation Service
 *
 * A service that wraps BubbleFlowGeneratorWorkflow to generate BubbleFlow code
 * from natural language prompts with streaming support.
 */

import {
  type GenerationResult,
  CredentialType,
} from '@bubblelab/shared-schemas';
import {
  BubbleFlowGeneratorWorkflow,
  BubbleLogger,
  type StreamingCallback,
} from '@bubblelab/bubble-core';
import { validateBubbleFlow } from '../validation.js';

export interface BobaRequest {
  prompt: string;
  credentials?: Partial<Record<CredentialType, string>>;
}

export interface BobaResponse extends GenerationResult {
  // Extends GenerationResult with any additional fields if needed
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
  const { prompt, credentials } = request;

  // Create logger for token tracking
  const logger = new BubbleLogger('BubbleFlowGeneratorWorkflow');

  // Merge provided credentials with default Google Gemini credential
  const mergedCredentials: Partial<Record<CredentialType, string>> = {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
    [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',
    ...credentials,
  };

  // Create BubbleFlowGeneratorWorkflow instance
  const generator = new BubbleFlowGeneratorWorkflow(
    {
      prompt,
      credentials: mergedCredentials,
      streamingCallback: apiStreamingCallback,
    },
    {
      logger: logger,
    }
  );

  // Generate the code with streaming
  const result = await generator.action();

  // Validate the generated code
  let actualIsValid = result.data.isValid;
  const validationResult = await validateBubbleFlow(result.data.generatedCode);

  if (result.data.generatedCode && result.data.generatedCode.trim()) {
    try {
      result.data.inputsSchema = JSON.stringify(validationResult.inputSchema);

      if (validationResult.valid && validationResult.bubbleParameters) {
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

  // Get token usage from logger
  const tokenUsage = logger.getTokenUsage();

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
    tokenUsage,
    codeLength: result.data.generatedCode.length,
  };

  console.log('[Boba] Generation result:', generationResult);

  return generationResult;
}
