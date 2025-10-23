import { parseJsonWithFallbacks } from './json-parsing';

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
