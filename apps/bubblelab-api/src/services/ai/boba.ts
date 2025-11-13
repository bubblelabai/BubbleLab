/**
 * Boba - BubbleFlow Code Generation Service
 *
 * A service that wraps BubbleFlowGeneratorWorkflow to generate BubbleFlow code
 * from natural language prompts with streaming support.
 */

import {
  type GenerationResult,
  CREDENTIAL_ENV_MAP,
  CredentialType,
} from '@bubblelab/shared-schemas';
import { BubbleLogger, type StreamingCallback } from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { env } from 'src/config/env.js';
import { BubbleFlowGeneratorWorkflow } from './bubbleflow-generator.workflow.js';
import { getBubbleFactory } from '../bubble-factory-instance.js';

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
  const logger = new BubbleLogger('BubbleFlowGeneratorWorkflow');

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
      prompt,
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
    bubbleParameters: validationResult.bubbleParameters,
  };

  console.log('[Boba] Generation result:', generationResult);

  return generationResult;
}
