/**
 * Code Generation Streaming Helper Service
 *
 * Separates code generation streaming logic into a reusable helper
 * that can be used by both the generate route and async flow generation.
 */

import {
  type GenerationResult,
  CredentialType,
  type StreamingEvent,
} from '@bubblelab/shared-schemas';
import { runBoba } from './boba.js';

export interface StreamingCallbacks {
  onEvent?: (event: StreamingEvent) => Promise<void>;
  onComplete?: (result: GenerationResult) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface CodeGenerationOptions {
  flowId?: number;
  userId: string;
  credentials: Record<CredentialType, string>;
}

/**
 * Stream code generation with callbacks for events, completion, and errors
 *
 * @param prompt - The natural language prompt to generate code from
 * @param options - Generation options including flowId, userId, and credentials
 * @param callbacks - Optional callbacks for streaming events, completion, and errors
 * @returns Promise<GenerationResult> - The generation result with code, validation, and metadata
 */
export async function streamCodeGeneration(
  prompt: string,
  options: CodeGenerationOptions,
  callbacks?: StreamingCallbacks
): Promise<GenerationResult> {
  const { credentials } = options;

  try {
    // Use runBoba to generate the code with streaming
    const generationResult = await runBoba(
      {
        prompt,
        credentials,
      },
      async (event: StreamingEvent) => {
        // Forward event to callback if provided
        if (callbacks?.onEvent) {
          await callbacks.onEvent(event);
        }
      }
    );

    // Call completion callback if provided
    if (callbacks?.onComplete) {
      await callbacks.onComplete(generationResult);
    }

    return generationResult;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Call error callback if provided
    if (callbacks?.onError) {
      await callbacks.onError(errorObj);
    }

    // Re-throw to let caller handle it
    throw errorObj;
  }
}
