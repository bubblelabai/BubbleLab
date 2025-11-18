import { MessageContent } from '@langchain/core/messages';
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
      // Path 6: Generation info
      outputAny.generations?.[0]?.[0]?.generationInfo?.__raw_response,
      // Path 7: Direct generation info (LangGraph/some providers)
      outputAny.generations?.[0]?.[0]?.generationInfo,
    ];

    let rawResponse: unknown = null;
    for (const path of possiblePaths) {
      if (path) {
        rawResponse = path;
        break;
      }
    }

    console.log('rawResponse', JSON.stringify(rawResponse, null, 2));
    if (rawResponse) {
      if (
        typeof rawResponse === 'object' &&
        rawResponse !== null &&
        'choices' in rawResponse &&
        Array.isArray(rawResponse.choices)
      ) {
        for (const choice of rawResponse.choices) {
          let reasoning: string | undefined;
          if (choice.delta?.reasoning) {
            // Stream thinking tokens for Grok models
            reasoning = choice.delta.reasoning;
          }
          // Also check for reasoning in the choice itself (not just delta)
          else if (choice.reasoning) {
            reasoning = choice.reasoning;
          }
          // Check for reasoning inside the message object (DeepSeek/Fireworks format)
          else if (choice.message?.reasoning) {
            reasoning = choice.message.reasoning;
          }
          // Check for reasoning_details (DeepSeek/Fireworks alternative)
          else if (
            choice.message?.reasoning_details &&
            Array.isArray(choice.message.reasoning_details) &&
            choice.message.reasoning_details.length > 0
          ) {
            reasoning = choice.message.reasoning_details
              .map((detail: any) => detail.text || '')
              .join('');
          }
          // Check for <think> tags in content if reasoning is still missing
          else if (choice.message?.content) {
            const content = choice.message.content;
            const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              reasoning = thinkMatch[1];
            }
          }

          // Strip <think> and </think> tags from the reasoning content
          if (reasoning) {
            return reasoning
              .replace(/<think>/gi, '')
              .replace(/<\/think>/gi, '')
              .trim();
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
export function formatFinalResponse(
  response: MessageContent,
  modelName: string,
  jsonMode?: boolean
): { response: string; error?: string } {
  const finalResponse =
    typeof response === 'string' ? response : JSON.stringify(response);
  // If response is an array, look for first parsable JSON in text

  console.log(
    '[AIAgent] Checking if response is an array:',
    Array.isArray(response)
  );
  console.log(
    '[AIAgent] Response length:',
    typeof response === 'string' ? response.length : 'N/A (object)'
  );
  // Special handling for Gemini image models that return images in inlineData format
  if (modelName.includes('gemini') && modelName.includes('image')) {
    return { response: formatGeminiImageResponse(finalResponse) };
  } else if (jsonMode && typeof finalResponse === 'string') {
    // Handle JSON mode: use the improved utility function
    const result = parseJsonWithFallbacks(finalResponse);

    if (!result.success) {
      return {
        response: result.response,
        error: `${finalResponse}`,
      };
    }

    return { response: result.response };
  }
  if (Array.isArray(response)) {
    // Collect all text chunks from the array
    const textChunks: string[] = [];

    for (const item of response) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      let text: string | undefined;

      // Check for standard format: item.type === 'text' && item.text (more specific, check first)
      if (
        'type' in item &&
        item.type === 'text' &&
        'text' in item &&
        typeof item.text === 'string'
      ) {
        text = item.text;
      }
      // Check for direct text property (LangChain AIMessage format)
      else if ('text' in item && typeof item.text === 'string') {
        text = item.text;
      }
      // Check for nested LangChain message structure: item.message.kwargs.content[0].text
      else if (
        'message' in item &&
        item.message &&
        typeof item.message === 'object' &&
        'kwargs' in item.message &&
        item.message.kwargs &&
        typeof item.message.kwargs === 'object' &&
        'content' in item.message.kwargs &&
        Array.isArray(item.message.kwargs.content) &&
        item.message.kwargs.content.length > 0
      ) {
        const firstContent = item.message.kwargs.content[0];
        if (
          firstContent &&
          typeof firstContent === 'object' &&
          'type' in firstContent &&
          firstContent.type === 'text' &&
          'text' in firstContent &&
          typeof firstContent.text === 'string'
        ) {
          text = firstContent.text;
        }
      }

      if (text) {
        textChunks.push(text);
      }
    }

    // If we collected text chunks, combine them and try to parse
    if (textChunks.length > 0) {
      const combinedText = textChunks.join('');

      // If jsonMode is enabled, try to parse the combined text as JSON
      if (jsonMode) {
        try {
          const result = parseJsonWithFallbacks(combinedText);
          if (result.success) {
            return { response: result.response };
          }
        } catch {
          // Continue to return combined text if not valid JSON
        }
      }

      // Return the combined text (even if not JSON)
      return { response: combinedText };
    }
  }

  console.log(
    '[AIAgent] Final response length:',
    typeof finalResponse === 'string' ? finalResponse.length : 'N/A'
  );

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
