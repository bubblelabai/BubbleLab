import {
  ChatGoogleGenerativeAI,
  type GoogleGenerativeAIChatInput,
} from '@langchain/google-genai';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { RECOMMENDED_MODELS } from '@bubblelab/shared-schemas';

/**
 * SafeGeminiChat: A wrapper around ChatGoogleGenerativeAI that gracefully handles
 * the candidateContent.parts.reduce error when Gemini returns blocked/empty content.
 *
 * Issue: When Gemini blocks content (safety filters, policy violations, etc.), it sometimes
 * returns candidates without a `content` field, causing `candidateContent.parts.reduce` to crash.
 *
 * Solution: This wrapper catches these errors and returns a structured error response instead
 * of crashing the entire agent workflow.
 */
export class SafeGeminiChat extends ChatGoogleGenerativeAI {
  constructor(fields: GoogleGenerativeAIChatInput) {
    super(fields);
  }

  /**
   * Override the _generate method to add null-safety checks
   */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    try {
      // Call the parent implementation
      return await super._generate(messages, options, runManager);
    } catch (error) {
      // Check if this is the candidateContent.parts error
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes('candidateContent') ||
        errorMessage.includes('parts') ||
        errorMessage.includes('reduce') ||
        errorMessage.includes('undefined is not an object')
      ) {
        // Log the error for debugging
        console.error(
          '[SafeGeminiChat] Gemini returned blocked/empty content:',
          errorMessage
        );

        // Return a structured error message instead of crashing
        const errorResponse = new AIMessage({
          content: `[Gemini Error] The model was unable to generate a response. This can happen when:
1. Content safety filters are triggered (despite BLOCK_NONE setting)
2. The model encounters policy violations
3. The response contains blocked content
4. Network or API issues occur

Original error: ${errorMessage}

Please try:
- Rephrasing your prompt
- Using a different model (e.g., ${RECOMMENDED_MODELS.FAST_ALT})
- Checking the Google AI Studio for more details`,
          additional_kwargs: {
            finishReason: 'SAFETY_BLOCKED',
            error: errorMessage,
          },
        });

        return {
          generations: [
            {
              text: errorResponse.content as string,
              message: errorResponse,
            },
          ],
          llmOutput: {
            error: 'GEMINI_CONTENT_BLOCKED',
            originalError: errorMessage,
          },
        };
      }

      // If it's a different error, rethrow it
      throw error;
    }
  }
}

/**
 * Utility function to check if an AIMessage contains a Gemini error
 */
export function isGeminiErrorResponse(message: AIMessage): boolean {
  const content = message.content;

  // Handle null/undefined content
  if (content == null) {
    return false;
  }

  const contentStr = content.toString();

  return (
    contentStr.includes('[Gemini Error]') ||
    contentStr.includes('[Gemini Response Error]') ||
    message.additional_kwargs?.finishReason === 'SAFETY_BLOCKED' ||
    message.additional_kwargs?.finishReason === 'ERROR'
  );
}

/**
 * Utility function to extract the original error from a Gemini error response
 */
export function getGeminiErrorDetails(message: AIMessage): string | undefined {
  return message.additional_kwargs?.error as string | undefined;
}
