import type { MessageContent } from '@langchain/core/messages';
import { parseJsonWithFallbacks } from './json-parsing.js';
import type { LLMResult, Generation } from '@langchain/core/outputs';

/**
 * Detect garbage/empty responses from models after heavy tool use.
 * Returns true if the content is empty or matches common garbage patterns
 * that models produce when they fail to synthesize a proper summary.
 */
export function isGarbageResponse(content: MessageContent): boolean {
  if (!content) return true;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  const garbagePatterns = ['[]', '{}', '""', "''", 'null', 'undefined'];
  return garbagePatterns.includes(trimmed);
}

/**
 * Extract content from a generation's message.
 * Handles both:
 * - Class instances (BaseMessage with .content property)
 * - Serialized form (object with .kwargs.content from LLMResult callbacks)
 */
function extractMessageContent(message: unknown): MessageContent | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const msg = message as Record<string, unknown>;

  // Check for direct .content property (BaseMessage class instance)
  if ('content' in msg && msg.content !== undefined) {
    return msg.content as MessageContent;
  }

  // Check for serialized form: message.kwargs.content
  if (
    'kwargs' in msg &&
    msg.kwargs &&
    typeof msg.kwargs === 'object' &&
    'content' in (msg.kwargs as Record<string, unknown>)
  ) {
    return (msg.kwargs as Record<string, unknown>).content as MessageContent;
  }

  return undefined;
}

/**
 * Type guard to check if a Generation has a message property
 */
function hasMessage(gen: Generation): gen is Generation & { message: unknown } {
  return 'message' in gen && gen.message !== undefined;
}

/**
 * Convert LangChain Generation[] to MessageContent for use with formatFinalResponse.
 * Handles both simple Generation (with text) and ChatGeneration (with message).
 *
 * This is useful when processing LLMResult from callbacks like handleLLMEnd,
 * where you have generations but want to use the unified formatFinalResponse.
 *
 * @param generations - Array of Generation objects (typically from LLMResult.generations.flat())
 * @returns MessageContent that can be passed to formatFinalResponse
 */
export function generationsToMessageContent(
  generations: Generation[]
): MessageContent {
  if (generations.length === 0) {
    return '';
  }

  // If there's only one generation, try to extract content directly
  if (generations.length === 1) {
    const gen = generations[0];

    // Try to extract message content (handles both class and serialized form)
    if (hasMessage(gen)) {
      const content = extractMessageContent(gen.message);
      if (content !== undefined) {
        return content;
      }
    }

    // Otherwise use the text property
    return gen.text;
  }

  // Multiple generations - collect all content
  const contentParts: Array<{ type: 'text'; text: string }> = [];

  for (const gen of generations) {
    if (hasMessage(gen)) {
      const msgContent = extractMessageContent(gen.message);

      if (typeof msgContent === 'string') {
        if (msgContent.trim()) {
          contentParts.push({ type: 'text', text: msgContent });
        }
      } else if (Array.isArray(msgContent)) {
        // Message content is already an array of content blocks
        for (const block of msgContent) {
          if (
            typeof block === 'object' &&
            block !== null &&
            'type' in block &&
            block.type === 'text' &&
            'text' in block &&
            typeof block.text === 'string' &&
            block.text.trim()
          ) {
            contentParts.push({ type: 'text', text: block.text });
          }
        }
      }
    } else if (gen.text && gen.text.trim()) {
      // Simple Generation - use text property
      contentParts.push({ type: 'text', text: gen.text });
    }
  }

  // If we only have one part, return just the string
  if (contentParts.length === 1) {
    return contentParts[0].text;
  }

  // Return as array of content blocks
  return contentParts;
}

/**
 * Extract and stream thinking tokens from different model providers
 */
/**
 * Extract thinking from message content blocks (Claude extended thinking format).
 * Use when you have MessageContent directly (e.g., AIMessage.content).
 */
export function extractThinkingFromContent(
  content: MessageContent
): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const parts = (content as Array<Record<string, unknown>>)
    .filter((b) => b.type === 'thinking' && typeof b.thinking === 'string')
    .map((b) => b.thinking as string);
  if (parts.length === 0) return undefined;
  return parts
    .join('')
    .replace(/<think>/gi, '')
    .replace(/<\/think>/gi, '')
    .trim();
}

/**
 * Extract thinking/reasoning tokens from an LLM response.
 * Handles all provider formats in one place:
 * - Claude: thinking blocks in message content array
 * - Grok/OpenRouter: reasoning in raw response choices
 */
export function extractThinking(output: LLMResult): string | undefined {
  try {
    const gen = output.generations?.flat()?.[0];

    // 1. Claude format: thinking blocks in message content
    if (gen && hasMessage(gen)) {
      const content = extractMessageContent(gen.message);
      const thinking = extractThinkingFromContent(content ?? '');
      if (thinking) return thinking;
    }

    // 2. Grok/OpenRouter: reasoning in raw response
    const outputAny = output as Record<string, unknown>;
    const possiblePaths = [
      (outputAny.generations as Array<Array<Record<string, unknown>>>)?.[0]?.[0]
        ?.message,
      (
        (
          outputAny.generations as Array<Array<Record<string, unknown>>>
        )?.[0]?.[0]?.message as Record<string, unknown>
      )?.kwargs,
      (
        outputAny.generations as Array<Array<Record<string, unknown>>>
      )?.[0]?.[0],
    ];

    for (const base of possiblePaths) {
      const rawResponse = (
        (base as Record<string, unknown>)?.additional_kwargs as Record<
          string,
          unknown
        >
      )?.__raw_response;
      if (
        rawResponse &&
        typeof rawResponse === 'object' &&
        'choices' in rawResponse &&
        Array.isArray((rawResponse as Record<string, unknown>).choices)
      ) {
        for (const choice of (
          rawResponse as { choices: Array<Record<string, unknown>> }
        ).choices) {
          const reasoning =
            (choice.delta as Record<string, unknown>)?.reasoning ??
            choice.reasoning;
          if (typeof reasoning === 'string') {
            return reasoning
              .replace(/<think>/gi, '')
              .replace(/<\/think>/gi, '')
              .trim();
          }
        }
      }
    }

    return undefined;
  } catch (error) {
    console.warn('[AIAgent] Error extracting thinking tokens:', error);
    return undefined;
  }
}

/** @deprecated Use `extractThinking` instead */
export const extractAndStreamThinkingTokens = extractThinking;
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

    // Array had no extractable text (e.g. only tool_use/thinking blocks) —
    // return empty string instead of raw JSON.stringify
    return { response: '' };
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
