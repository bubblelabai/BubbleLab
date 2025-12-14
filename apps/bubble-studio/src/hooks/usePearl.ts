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
import { getPearlChatStore } from '../stores/pearlChatStore';
import {
  handleStreamingEvent,
  type HandleStreamingEventOptions,
} from './usePearlChatStore';

/**
 * React Query mutation hook for Pearl AI chat
 * This is for general workflow assistance without a specific bubble
 */
export function usePearl() {
  return useMutation({
    mutationFn: async (request: PearlRequest): Promise<PearlResponse> => {
      const state = useEditorStore.getState();
      const fullCode = state.editorInstance?.getModel()?.getValue() || '';
      const codeContext = await getCodeContextForPearl();

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
      const result = await api.post<PearlResponse>('/ai/pearl', fullRequest);
      return result;
    },
  });
}

export interface UsePearlStreamOptions {
  flowId?: number | null;
  onSuccess?: (result: PearlResponse) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: StreamingEvent) => void;
}

/**
 * React Query mutation hook for Pearl AI chat with streaming
 */
export function usePearlStream(options?: UsePearlStreamOptions) {
  const { flowId, onSuccess, onError, onEvent } = options ?? {};

  return useMutation({
    mutationKey: ['pearlStream', flowId ?? -1],
    mutationFn: async (request: PearlRequest): Promise<PearlResponse> => {
      const pearlRequest = request;
      const state = useEditorStore.getState();
      const fullCode = state.editorInstance?.getModel()?.getValue() || '';
      const codeContext = await getCodeContextForPearl();

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
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as StreamingEvent;
                onEvent?.(event);

                if (event.type === 'complete') {
                  finalResult = event.data.result as PearlResponse;
                }

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
      onSuccess?.(result);
    },
    onError: (error) => {
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
 * Starts a generation stream for a flow and stores events in pearlChatStore.
 * All events are processed through handleStreamingEvent for unified handling.
 */
async function startGenerationStream(
  params: GenerateCodeParams,
  options?: HandleStreamingEventOptions,
  maxRetries: number = 2
): Promise<void> {
  const { flowId } = params;
  if (!flowId) return;

  const pearlStore = getPearlChatStore(flowId);
  const storeState = pearlStore.getState();

  // Check if already generating or completed
  if (
    storeState.hasActiveGenerationStream() ||
    storeState.generationCompleted
  ) {
    console.log(
      `[startGenerationStream] Stream already active or completed for flow ${flowId}`
    );
    return;
  }

  // Store the callback in the store so it can be used during building phase
  if (options?.onGenerationComplete) {
    storeState.setOnGenerationComplete(options.onGenerationComplete);
  }

  const abortController = new AbortController();
  storeState.registerGenerationStream(abortController);
  storeState.setIsGenerating(true);
  storeState.setCoffeeOriginalPrompt(params.prompt.trim());
  storeState.setIsCoffeeLoading(true);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortController.signal.aborted) {
      console.log(`[startGenerationStream] Stream aborted for flow ${flowId}`);
      return;
    }

    try {
      const response = await api.postStream(
        '/bubble-flow/generate?phase=planning',
        {
          prompt: params.prompt.trim(),
          flowId: params.flowId,
          messages: pearlStore.getState().messages.map((msg) => ({
            id: msg.id,
            timestamp: msg.timestamp.toISOString(),
            type: msg.type,
            ...('content' in msg ? { content: msg.content } : {}),
            ...('questions' in msg ? { questions: msg.questions } : {}),
            ...('answers' in msg ? { answers: msg.answers } : {}),
            ...('request' in msg ? { request: msg.request } : {}),
            ...('answer' in msg ? { answer: msg.answer } : {}),
            ...('plan' in msg ? { plan: msg.plan } : {}),
            ...('approved' in msg ? { approved: msg.approved } : {}),
          })),
        },
        { signal: abortController.signal }
      );

      for await (const event of sseToAsyncIterable(response)) {
        if (abortController.signal.aborted) {
          console.log(
            `[startGenerationStream] Stream aborted during iteration for flow ${flowId}`
          );
          return;
        }

        // All events go through unified handleStreamingEvent
        handleStreamingEvent(event, pearlStore);

        // Stop coffee loading indicator when coffee phase is complete
        if (event.type === 'coffee_complete') {
          console.log(
            `[startGenerationStream] Coffee planning completed for flow ${flowId}`
          );
          pearlStore.getState().setIsCoffeeLoading(false);
        }

        // generation_complete and error are handled by handleStreamingEvent
        // which sets generationCompleted and isGenerating appropriately
      }

      console.log(
        `[startGenerationStream] Stream completed successfully for flow ${flowId}`
      );
      pearlStore.getState().setIsCoffeeLoading(false);
      return;
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log(
          `[startGenerationStream] Stream aborted during error handling for flow ${flowId}`
        );
        return;
      }

      lastError = error instanceof Error ? error : new Error('Stream failed');
      console.error(
        `[startGenerationStream] Stream attempt ${attempt + 1} failed:`,
        lastError.message
      );

      // Non-recoverable errors
      if (
        lastError.message.includes('Authentication failed') ||
        /HTTP 4\d{2}/.test(lastError.message)
      ) {
        handleStreamingEvent(
          {
            type: 'error',
            data: { error: lastError.message, recoverable: false },
          },
          pearlStore
        );
        pearlStore.getState().setIsCoffeeLoading(false);
        return;
      }

      // Retry logic
      if (attempt < maxRetries) {
        const delayMs = Math.min(5000 * Math.pow(2, attempt), 4000);
        console.log(
          `[startGenerationStream] Retrying in ${delayMs}ms... (attempt ${attempt + 2}/${maxRetries + 1})`
        );

        handleStreamingEvent(
          {
            type: 'retry_attempt',
            data: {
              attempt: attempt + 1,
              maxRetries: maxRetries + 1,
              delay: delayMs,
              error: lastError.message,
            },
          },
          pearlStore
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Final error after all retries
  const errorMsg = lastError?.message || 'Stream failed after all retries';
  handleStreamingEvent(
    { type: 'error', data: { error: errorMsg, recoverable: false } },
    pearlStore
  );
  pearlStore.getState().setIsCoffeeLoading(false);
}

/**
 * Starts the building phase after Coffee planning is complete.
 * Uses pearlChatStore for all event handling.
 */
export async function startBuildingPhase(
  flowId: number,
  prompt: string,
  planContext?: string,
  _clarificationAnswers?: Record<string, string[]>
): Promise<void> {
  const pearlStore = getPearlChatStore(flowId);
  const storeState = pearlStore.getState();

  const abortController = new AbortController();
  storeState.registerGenerationStream(abortController);
  storeState.setIsGenerating(true);
  storeState.setIsCoffeeLoading(true);

  try {
    const response = await api.postStream(
      '/bubble-flow/generate?phase=building',
      {
        prompt: prompt.trim(),
        flowId,
        planContext,
        messages: pearlStore.getState().messages.map((msg) => ({
          id: msg.id,
          timestamp: msg.timestamp.toISOString(),
          type: msg.type,
          ...('content' in msg ? { content: msg.content } : {}),
          ...('questions' in msg ? { questions: msg.questions } : {}),
          ...('answers' in msg ? { answers: msg.answers } : {}),
          ...('request' in msg ? { request: msg.request } : {}),
          ...('answer' in msg ? { answer: msg.answer } : {}),
          ...('plan' in msg ? { plan: msg.plan } : {}),
          ...('approved' in msg ? { approved: msg.approved } : {}),
        })),
      },
      { signal: abortController.signal }
    );

    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[startBuildingPhase] Stream aborted during iteration for flow ${flowId}`
        );
        return;
      }

      // All events go through unified handleStreamingEvent
      handleStreamingEvent(event, pearlStore);
    }

    console.log(
      `[startBuildingPhase] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Build failed';
    console.error(`[startBuildingPhase] Error:`, errorMsg);

    handleStreamingEvent(
      { type: 'error', data: { error: errorMsg, recoverable: false } },
      pearlStore
    );
  } finally {
    pearlStore.getState().setIsCoffeeLoading(false);
  }
}

/**
 * Submits clarification answers and continues the Coffee planning phase.
 * Uses pearlChatStore for all event handling.
 */
export async function submitClarificationAndContinue(
  flowId: number,
  prompt: string,
  answers: Record<string, string[]>
): Promise<void> {
  const { getPendingClarificationRequest } = await import(
    '../components/ai/type'
  );
  const pearlStore = getPearlChatStore(flowId);
  const storeState = pearlStore.getState();

  // Get pending clarification for originalQuestions
  const pending = getPendingClarificationRequest(storeState.messages);

  // Add response message
  storeState.addMessage({
    id: `clarification-response-${Date.now()}`,
    type: 'clarification_response',
    answers,
    originalQuestions: pending?.questions,
    timestamp: new Date(),
  });

  const abortController = new AbortController();
  storeState.registerGenerationStream(abortController);
  storeState.setIsCoffeeLoading(true);

  // Get updated state after adding the clarification response message
  const updatedState = pearlStore.getState();

  try {
    const response = await api.postStream(
      '/bubble-flow/generate?phase=planning',
      {
        prompt: prompt.trim(),
        flowId,
        messages: updatedState.messages.map((msg) => ({
          id: msg.id,
          timestamp: msg.timestamp.toISOString(),
          type: msg.type,
          ...('content' in msg ? { content: msg.content } : {}),
          ...('questions' in msg ? { questions: msg.questions } : {}),
          ...('answers' in msg ? { answers: msg.answers } : {}),
          ...('originalQuestions' in msg
            ? { originalQuestions: msg.originalQuestions }
            : {}),
          ...('request' in msg ? { request: msg.request } : {}),
          ...('answer' in msg ? { answer: msg.answer } : {}),
          ...('plan' in msg ? { plan: msg.plan } : {}),
          ...('approved' in msg ? { approved: msg.approved } : {}),
        })),
      },
      { signal: abortController.signal }
    );

    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[submitClarificationAndContinue] Stream aborted for flow ${flowId}`
        );
        return;
      }

      // All events go through unified handleStreamingEvent
      handleStreamingEvent(event, pearlStore);

      if (event.type === 'coffee_complete') {
        console.log(
          `[submitClarificationAndContinue] Coffee planning completed for flow ${flowId}`
        );
        storeState.setIsCoffeeLoading(false);
      }
    }

    console.log(
      `[submitClarificationAndContinue] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Planning failed';
    console.error(`[submitClarificationAndContinue] Error:`, errorMsg);

    handleStreamingEvent(
      { type: 'error', data: { error: errorMsg, recoverable: false } },
      pearlStore
    );
  } finally {
    storeState.setIsCoffeeLoading(false);
  }
}

/**
 * Hook to initiate code generation for a flow.
 * Uses pearlChatStore for state management and event handling.
 *
 * @param params.onGenerationComplete - Callback when generation completes (for editor update, refetch, etc.)
 */
export const useGenerateInitialFlow = (
  params: GenerateCodeParams & {
    onGenerationComplete?: HandleStreamingEventOptions['onGenerationComplete'];
  }
) => {
  return useQuery({
    queryKey: ['generate-code', params.prompt, params.flowId],
    enabled: params.enabled,
    queryFn: async (): Promise<boolean> => {
      const { flowId } = params;
      if (!flowId) return false;

      const pearlStore = getPearlChatStore(flowId);
      const storeState = pearlStore.getState();

      if (
        !storeState.hasActiveGenerationStream() &&
        !storeState.generationCompleted
      ) {
        startGenerationStream(params, {
          onGenerationComplete: params.onGenerationComplete,
        }).catch((err) => {
          console.error('[useGenerateInitialFlow] Stream error:', err);
        });
      }

      return storeState.generationCompleted;
    },
    refetchInterval: () => {
      const flowId = params.flowId;
      if (!flowId) return false;

      const pearlStore = getPearlChatStore(flowId);
      const storeState = pearlStore.getState();
      if (storeState.hasActiveGenerationStream()) {
        return 100;
      }
      return false;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
