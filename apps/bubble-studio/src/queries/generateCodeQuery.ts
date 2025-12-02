import {
  queryOptions,
  experimental_streamedQuery as streamedQuery,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { sseToAsyncIterable } from '@/utils/sseStream';
import type { GenerationStreamingEvent } from '@/types/generation';

export interface GenerateCodeParams {
  prompt: string;
}

/**
 * Creates a streamedQuery for code generation that handles SSE streaming.
 * Events are accumulated in an array as they arrive from the server.
 *
 * @param params - Generation parameters including the prompt
 * @returns TanStack Query options for the code generation stream
 */
// Helper to wrap AsyncIterable with retry logic
async function* retryableStream(
  params: GenerateCodeParams,
  maxRetries: number = 2
): AsyncGenerator<GenerationStreamingEvent> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.postStream('/bubble-flow/generate', {
        prompt: params.prompt.trim(),
      });

      // Consume the entire stream, yielding each event
      for await (const event of sseToAsyncIterable(response)) {
        yield event;
      }

      // If we got here, stream completed successfully
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Stream failed');

      console.error(
        `❌ Stream attempt ${attempt + 1} failed:`,
        lastError.message
      );

      // Don't retry on auth errors or client errors
      if (
        lastError.message.includes('Authentication failed') ||
        /HTTP 4\d{2}/.test(lastError.message)
      ) {
        throw lastError;
      }

      // If we have retries left, wait and try again
      if (attempt < maxRetries) {
        const delayMs = Math.min(5000 * Math.pow(2, attempt), 4000);
        console.log(
          `🔄 Retrying in ${delayMs}ms... (attempt ${attempt + 2}/${maxRetries + 1})`
        );

        // Yield a retry event so it shows in the UI
        yield {
          type: 'retry_attempt',
          data: {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delay: delayMs,
            error: lastError.message,
          },
        };

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Stream failed after all retries');
}

export const createGenerateCodeQuery = (params: GenerateCodeParams) => {
  return queryOptions({
    queryKey: ['generate-code', params.prompt],
    queryFn: streamedQuery({
      streamFn: async () => {
        // Return the retryable stream wrapper
        return retryableStream(params);
      },
      // Accumulate all events into an array
      reducer: (
        events: GenerationStreamingEvent[],
        newEvent: GenerationStreamingEvent
      ) => {
        return [...events, newEvent];
      },
      // Start with empty array
      initialValue: [] as GenerationStreamingEvent[],
      // On refetch, reset and start fresh (don't append to old generation)
      refetchMode: 'reset',
    }),
    // Retry is handled inside streamFn for better control
    retry: false,
    // Keep data fresh
    staleTime: 0,
    // Clear cached data immediately to prevent showing old events
    gcTime: 0,
    // Don't refetch on window focus during generation
    refetchOnWindowFocus: false,
  });
};
