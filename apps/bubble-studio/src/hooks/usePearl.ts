import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCodeContextForPearl } from '../utils/editorContext';
import { useEditorStore } from '../stores/editorStore';
import {
  PearlRequest,
  PearlResponse,
  type StreamingEvent,
} from '@bubblelab/shared-schemas';

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
