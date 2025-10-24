import { parseJsonWithFallbacks } from './json-parsing';
import type { LLMResult } from '@langchain/core/outputs';
/**
 * Extract and stream thinking tokens from different model providers
 */
export function extractAndStreamThinkingTokens(
  output: LLMResult
): string | undefined {
  try {
    // Cast output to any to avoid TypeScript issues
    const outputAny = output as any;
    // Try multiple paths to find reasoning content
    const possiblePaths = [
      // Path 1: Direct generations
      outputAny.generations?.[0]?.[0]?.message?.additional_kwargs
        ?.__raw_response,
      // Path 2: Through kwargs
      outputAny.generations?.[0]?.[0]?.message?.kwargs?.additional_kwargs
        ?.__raw_response,
      // Path 3: Direct in message
      outputAny.generations?.[0]?.[0]?.message?.__raw_response,
      // Path 4: Alternative structure
      outputAny.generations?.[0]?.[0]?.additional_kwargs?.__raw_response,
      // Path 5: Deep nested structure
      outputAny.generations?.[0]?.[0]?.message?.additional_kwargs
        ?.__raw_response,
    ];

    let rawResponse: any = null;
    for (const path of possiblePaths) {
      if (path) {
        rawResponse = path;
        break;
      }
    }

    if (rawResponse) {
      if (rawResponse.choices && Array.isArray(rawResponse.choices)) {
        for (const choice of rawResponse.choices) {
          if (choice.delta?.reasoning) {
            // Stream thinking tokens for Grok models
            return choice.delta.reasoning;
          }
          // Also check for reasoning in the choice itself (not just delta)
          if (choice.reasoning) {
            return choice.reasoning;
          }
        }
      } else {
        console.log('No choices array found in rawResponse');
      }
    } else {
      console.log('No rawResponse found in any path');
    }

    return undefined;
  } catch (error) {
    console.warn('[AIAgent] Error extracting thinking tokens:', error);
    return undefined;
  }
}
/**
 * Format final response with special handling for Gemini image models and JSON mode
 */
export async function formatFinalResponse(
  response: string | unknown,
  modelName: string,
  jsonMode?: boolean
): Promise<{ response: string; error?: string }> {
  let finalResponse =
    typeof response === 'string' ? response : JSON.stringify(response);
  // If response is an array, look for first parsable JSON in text

  console.log(
    '[AIAgent] Checking if response is an array:',
    Array.isArray(response)
  );
  console.log('[AIAgent] Response:', response);
  if (Array.isArray(response)) {
    for (const item of response) {
      if (
        item &&
        typeof item === 'object' &&
        'type' in item &&
        item.type === 'text'
      ) {
        try {
          const result = parseJsonWithFallbacks(item.text);
          if (result.success) {
            return { response: result.response };
          }
        } catch {
          // Continue to next item if not valid JSON
          continue;
        }
      }
    }
  }

  // Special handling for Gemini image models that return images in inlineData format
  if (modelName.includes('gemini') && modelName.includes('image')) {
    finalResponse = formatGeminiImageResponse(finalResponse);
  } else if (jsonMode && typeof finalResponse === 'string') {
    // Handle JSON mode: use the improved utility function
    const result = parseJsonWithFallbacks(finalResponse);

    if (!result.success) {
      return {
        response: result.response,
        error: `AI Agent failed to generate valid JSON. Post-processing attempted but JSON is still malformed. Original response: ${finalResponse}`,
      };
    }

    return { response: result.response };
  }

  console.log('[AIAgent] Final response:', finalResponse);

  return { response: finalResponse };
}

/**
 * Convert Gemini's inlineData format to LangChain-compatible data URI format
 */
export function formatGeminiImageResponse(response: string | unknown): string {
  if (typeof response !== 'string') {
    return String(response);
  }

  try {
    console.log('[AIAgent] Formatting Gemini image response...');
    // Look for Gemini's inlineData format in the response
    const inlineDataRegex =
      /\{\s*"inlineData"\s*:\s*\{\s*"mimeType"\s*:\s*"([^"]+)"\s*,\s*"data"\s*:\s*"([^"]+)"\s*\}\s*\}/;

    const match = response.match(inlineDataRegex);

    if (match) {
      const [, mimeType, data] = match;
      const dataUri = `data:${mimeType};base64,${data}`;
      console.log(
        `[AIAgent] Extracted first data URI from Gemini inlineData: ${mimeType}`
      );
      return dataUri;
    }

    // Also check for the more complex format with text
    const complexInlineDataRegex =
      /\{\s*"inlineData"\s*:\s*\{\s*"mimeType"\s*:\s*"([^"]+)"\s*,\s*"data"\s*:\s*"([^"]+)"/;

    const complexMatch = response.match(complexInlineDataRegex);

    if (complexMatch) {
      const [, mimeType, data] = complexMatch;
      const dataUri = `data:${mimeType};base64,${data}`;
      console.log(
        `[AIAgent] Extracted first data URI from complex Gemini inlineData: ${mimeType}`
      );
      return dataUri;
    }

    // If no inlineData found, return original response
    return response;
  } catch (error) {
    console.warn('[AIAgent] Error formatting Gemini image response:', error);
    return response;
  }
}
