import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { sseToAsyncIterable } from '@/utils/sseStream';
import type { GenerationStreamingEvent } from '@/types/generation';
import { useGenerationEventsStore } from '@/stores/generationEventsStore';

export interface GenerateCodeParams {
  prompt: string;
  flowId?: number;
}

/**
 * Starts a generation stream for a flow and stores events in the persistent store.
 * This function runs independently of React component lifecycle.
 *
 * @param params - Generation parameters
 * @param maxRetries - Maximum retry attempts for failed streams
 */
async function startGenerationStream(
  params: GenerateCodeParams,
  maxRetries: number = 2
): Promise<void> {
  const { flowId } = params;
  if (!flowId) return;

  const store = useGenerationEventsStore.getState();

  // Don't start if already streaming or completed
  if (store.hasActiveStream(flowId) || store.isCompleted(flowId)) {
    console.log(
      `[generateCodeQuery] Stream already active or completed for flow ${flowId}`
    );
    return;
  }

  // Create abort controller for this stream
  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortController.signal.aborted) {
      console.log(`[generateCodeQuery] Stream aborted for flow ${flowId}`);
      return;
    }

    try {
      const response = await api.postStream(
        '/bubble-flow/generate',
        {
          prompt: params.prompt.trim(),
          flowId: params.flowId,
        },
        { signal: abortController.signal }
      );

      // Consume the stream and store events
      for await (const event of sseToAsyncIterable(response)) {
        if (abortController.signal.aborted) {
          console.log(
            `[generateCodeQuery] Stream aborted during iteration for flow ${flowId}`
          );
          return;
        }

        // Add event to store
        useGenerationEventsStore.getState().addEvent(flowId, event);

        // Mark as completed if this is the final event
        if (event.type === 'generation_complete' || event.type === 'error') {
          useGenerationEventsStore.getState().markCompleted(flowId);
        }
      }

      // Stream completed successfully
      console.log(
        `[generateCodeQuery] Stream completed successfully for flow ${flowId}`
      );
      return;
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log(
          `[generateCodeQuery] Stream aborted during error handling for flow ${flowId}`
        );
        return;
      }

      lastError = error instanceof Error ? error : new Error('Stream failed');

      console.error(
        `[generateCodeQuery] Stream attempt ${attempt + 1} failed:`,
        lastError.message
      );

      // Don't retry on auth errors or client errors
      if (
        lastError.message.includes('Authentication failed') ||
        /HTTP 4\d{2}/.test(lastError.message)
      ) {
        useGenerationEventsStore.getState().addEvent(flowId, {
          type: 'error',
          data: { error: lastError.message, recoverable: false },
        });
        useGenerationEventsStore.getState().markCompleted(flowId);
        return;
      }

      // If we have retries left, wait and try again
      if (attempt < maxRetries) {
        const delayMs = Math.min(5000 * Math.pow(2, attempt), 4000);
        console.log(
          `[generateCodeQuery] Retrying in ${delayMs}ms... (attempt ${attempt + 2}/${maxRetries + 1})`
        );

        // Add a retry event
        useGenerationEventsStore.getState().addEvent(flowId, {
          type: 'retry_attempt',
          data: {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delay: delayMs,
            error: lastError.message,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  const errorMsg = lastError?.message || 'Stream failed after all retries';
  useGenerationEventsStore.getState().addEvent(flowId, {
    type: 'error',
    data: { error: errorMsg, recoverable: false },
  });
  useGenerationEventsStore.getState().markCompleted(flowId);
}

/**
 * Creates a query for code generation that reads from the persistent events store.
 * The actual streaming happens independently via startGenerationStream.
 *
 * @param params - Generation parameters including the prompt
 * @returns TanStack Query options for reading generation events
 */
export const createGenerateCodeQuery = (params: GenerateCodeParams) => {
  return queryOptions({
    queryKey: ['generate-code', params.prompt, params.flowId],
    queryFn: async (): Promise<GenerationStreamingEvent[]> => {
      const { flowId } = params;
      if (!flowId) return [];

      const store = useGenerationEventsStore.getState();

      // Start the stream if not already running and not completed
      if (!store.hasActiveStream(flowId) && !store.isCompleted(flowId)) {
        // Start stream in background (don't await)
        startGenerationStream(params).catch((err) => {
          console.error('[generateCodeQuery] Stream error:', err);
        });
      }

      // Return current events from store
      return store.getEvents(flowId);
    },
    // Re-run query periodically to pick up new events while streaming
    refetchInterval: () => {
      const flowId = params.flowId;
      if (!flowId) return false;

      const store = useGenerationEventsStore.getState();
      // Keep polling while stream is active
      if (store.hasActiveStream(flowId)) {
        return 100; // Poll every 100ms while streaming
      }
      return false;
    },
    // Keep data fresh while streaming
    staleTime: 0, // Always consider stale so refetchInterval works
    // Keep cached data for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Refetch on mount to get latest events
    refetchOnMount: true,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Don't refetch on reconnect
    refetchOnReconnect: false,
  });
};
