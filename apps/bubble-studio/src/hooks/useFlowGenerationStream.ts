import { useQuery, useQueryClient } from '@tanstack/react-query';
import { experimental_streamedQuery as streamedQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { sseToAsyncIterable } from '@/utils/sseStream';
import type { GenerationStreamingEvent } from '@/types/generation';
import { useEffect, useRef } from 'react';

export interface FlowGenerationStreamParams {
  flowId: number;
  prompt: string;
}

/**
 * Helper to wrap AsyncIterable with retry logic for flow-specific generation
 */
async function* retryableFlowStream(
  params: FlowGenerationStreamParams,
  maxRetries: number = 2
): AsyncGenerator<GenerationStreamingEvent> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.postStream('/bubble-flow/generate', {
        prompt: params.prompt.trim(),
        flowId: params.flowId,
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

/**
 * Creates a query for flow-specific code generation streaming
 */
export const createFlowGenerationQuery = (
  params: FlowGenerationStreamParams
) => {
  return {
    queryKey: ['flow-generation', params.flowId, params.prompt],
    queryFn: streamedQuery({
      streamFn: async () => {
        return retryableFlowStream(params);
      },
      reducer: (
        events: GenerationStreamingEvent[],
        newEvent: GenerationStreamingEvent
      ) => {
        return [...events, newEvent];
      },
      initialValue: [] as GenerationStreamingEvent[],
      refetchMode: 'reset' as const,
    }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  };
};

/**
 * Hook for streaming code generation for a specific flow
 * Automatically invalidates the flow query when generation completes
 *
 * @param params - Flow ID and prompt for generation
 * @param options - Query options including enabled flag
 */
export function useFlowGenerationStream(
  params: FlowGenerationStreamParams | null,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();
  const generationStartTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef(false);

  const query = useQuery({
    ...createFlowGenerationQuery(params!),
    enabled: !!params && (options?.enabled ?? true),
  });

  // Track generation start time
  useEffect(() => {
    if (params && query.isLoading && !hasCompletedRef.current) {
      generationStartTimeRef.current = Date.now();
      hasCompletedRef.current = false;
    }
  }, [params, query.isLoading]);

  // Handle generation completion
  useEffect(() => {
    if (!params || !query.data || hasCompletedRef.current) return;

    // Check if the last event is generation_complete
    const events = query.data;
    const lastEvent = events[events.length - 1];

    if (lastEvent?.type === 'generation_complete') {
      hasCompletedRef.current = true;
      const duration = Date.now() - generationStartTimeRef.current;

      console.log(
        `[useFlowGenerationStream] Generation completed for flow ${params.flowId} in ${duration}ms`
      );

      // Invalidate flow query to refetch with updated code
      void queryClient.invalidateQueries({
        queryKey: ['bubbleFlow', params.flowId],
      });

      // Also invalidate the flow list to show updated metadata
      void queryClient.invalidateQueries({
        queryKey: ['bubbleFlowList'],
      });
    }
  }, [params, query.data, queryClient]);

  // Check for timeout (5 minutes)
  useEffect(() => {
    if (!params || !query.isLoading || hasCompletedRef.current) return;

    const timeoutDuration = 5 * 60 * 1000; // 5 minutes
    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - generationStartTimeRef.current;
      if (elapsed >= timeoutDuration && !hasCompletedRef.current) {
        console.warn(
          `[useFlowGenerationStream] Generation timeout for flow ${params.flowId} after ${elapsed}ms`
        );
      }
    }, timeoutDuration);

    return () => clearTimeout(timeoutId);
  }, [params, query.isLoading]);

  return {
    events: query.data || [],
    error: query.error,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
  };
}
