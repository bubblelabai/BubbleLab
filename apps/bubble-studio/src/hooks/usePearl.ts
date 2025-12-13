import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCodeContextForPearl } from '../utils/editorContext';
import { useEditorStore } from '../stores/editorStore';
import {
  PearlRequest,
  PearlResponse,
  type StreamingEvent,
} from '@bubblelab/shared-schemas';
import { sseToAsyncIterable } from '@/utils/sseStream';
import type { GenerationStreamingEvent } from '@/types/generation';
import { useGenerationEventsStore } from '@/stores/generationEventsStore';
/**
 * React Query mutation hook for Pearl AI chat
 * This is for general workflow assistance without a specific bubble
 *
 * Usage:
 * ```typescript
 * const pearlMutation = usePearl();
 *
 * const handleGenerate = async () => {
 *   pearlMutation.mutate({
 *     userRequest: 'Create a workflow that sends emails',
 *     userName: 'User',
 *     conversationHistory: [],
 *   }, {
 *     onSuccess: (result) => {
 *       if (result.type === 'code') {
 *         // Replace entire editor content with result.snippet
 *       }
 *     },
 *   });
 * };
 * ```
 */
export function usePearl() {
  return useMutation({
    mutationFn: async (request: PearlRequest): Promise<PearlResponse> => {
      // Get full code from editor
      const state = useEditorStore.getState();
      const fullCode = state.editorInstance?.getModel()?.getValue() || '';

      // Get available variables from editor
      const codeContext = await getCodeContextForPearl();

      // Build request payload for pearl
      const fullRequest = {
        userRequest: request.userRequest,
        currentCode: fullCode,
        userName: request.userName,
        conversationHistory: request.conversationHistory,
        availableVariables:
          request.availableVariables.length > 0
            ? request.availableVariables
            : codeContext?.availableVariables,
        model: request.model || 'google/gemini-2.5-pro',
        additionalContext: request.additionalContext,
      };

      console.log('fullRequest', JSON.stringify(fullRequest, null, 2));

      // Call pearl API endpoint
      const result = await api.post<PearlResponse>('/ai/pearl', fullRequest);

      return result;
    },
  });
}

/**
 * Options for configuring usePearlStream callbacks
 */
export interface UsePearlStreamOptions {
  flowId?: number | null;
  onSuccess?: (result: PearlResponse) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: StreamingEvent) => void;
}

/**
 * React Query mutation hook for Pearl AI chat with streaming
 * This provides real-time event streaming for all AI processing events
 * with built-in success/error handling
 *
 * Usage:
 * ```typescript
 * const pearlStreamMutation = usePearlStream({
 *   flowId,
 *   onEvent: (event) => {
 *     // Handle each streaming event chronologically
 *     console.log('Event:', event);
 *   },
 *   onSuccess: (result) => {
 *     // Handle successful completion
 *     console.log('Final result:', result);
 *   },
 *   onError: (error) => {
 *     // Handle errors
 *     console.error('Stream error:', error);
 *   }
 * });
 *
 * const handleGenerate = async () => {
 *   pearlStreamMutation.mutate({
 *     userRequest: 'Create a workflow that sends emails',
 *     userName: 'User',
 *     conversationHistory: [],
 *   });
 * };
 * ```
 */
export function usePearlStream(options?: UsePearlStreamOptions) {
  const { flowId, onSuccess, onError, onEvent } = options ?? {};

  return useMutation({
    mutationKey: ['pearlStream', flowId ?? -1],
    mutationFn: async (request: PearlRequest): Promise<PearlResponse> => {
      const pearlRequest = request;

      // Get full code from editor
      const state = useEditorStore.getState();
      const fullCode = state.editorInstance?.getModel()?.getValue() || '';

      // Get available variables from editor
      const codeContext = await getCodeContextForPearl();

      // Build request payload for pearl
      const fullRequest = {
        userRequest: pearlRequest.userRequest,
        currentCode: fullCode,
        userName: pearlRequest.userName,
        conversationHistory: pearlRequest.conversationHistory,
        availableVariables:
          pearlRequest.availableVariables.length > 0
            ? pearlRequest.availableVariables
            : codeContext?.availableVariables,
        model: pearlRequest.model || 'google/gemini-2.5-pro',
        additionalContext: pearlRequest.additionalContext,
        uploadedFiles: pearlRequest.uploadedFiles,
      };

      console.log('fullRequest', JSON.stringify(fullRequest, null, 2));

      // Call streaming pearl API endpoint
      const response = await api.postStream(
        '/ai/pearl?stream=true',
        fullRequest
      );

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: PearlResponse | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as StreamingEvent;

                // Emit all events to consumer in chronological order
                onEvent?.(event);

                // Handle complete event to capture final result
                if (event.type === 'complete') {
                  finalResult = event.data.result as PearlResponse;
                }

                // Handle error event
                if (event.type === 'error') {
                  throw new Error(event.data.error);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!finalResult) {
        throw new Error('No final result received from stream');
      }

      return finalResult;
    },
    onSuccess: (result) => {
      // Call the provided onSuccess callback if it exists
      onSuccess?.(result);
    },
    onError: (error) => {
      // Call the provided onError callback if it exists
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      onError?.(errorInstance);
    },
  });
}

export interface GenerateCodeParams {
  prompt: string;
  flowId?: number;
  enabled?: boolean;
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
export const useGenerateInitialFlow = (params: GenerateCodeParams) => {
  return useQuery({
    queryKey: ['generate-code', params.prompt, params.flowId],
    enabled: params.enabled,
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
