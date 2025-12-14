import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCodeContextForPearl } from '../utils/editorContext';
import { useEditorStore } from '../stores/editorStore';
import {
  PearlRequest,
  PearlResponse,
  type StreamingEvent,
  type CoffeeRequestExternalContextEvent,
  type ClarificationQuestion,
  type CoffeePlanEvent,
} from '@bubblelab/shared-schemas';
import { sseToAsyncIterable } from '@/utils/sseStream';
import type { GenerationStreamingEvent } from '@/types/generation';
import { useGenerationEventsStore } from '@/stores/generationEventsStore';
import type {
  ClarificationRequestMessage,
  ContextRequestMessage,
  PlanChatMessage,
} from '../components/ai/type';

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
        uploadedFiles: pearlRequest.uploadedFiles,
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
 * Starts a generation stream for a flow and stores events in the persistent store.
 * Uses message-based approach for Coffee state.
 */
async function startGenerationStream(
  params: GenerateCodeParams,
  maxRetries: number = 2
): Promise<void> {
  const { flowId } = params;
  if (!flowId) return;

  const store = useGenerationEventsStore.getState();

  if (store.hasActiveStream(flowId) || store.isCompleted(flowId)) {
    console.log(
      `[generateCodeQuery] Stream already active or completed for flow ${flowId}`
    );
    return;
  }

  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortController.signal.aborted) {
      console.log(`[generateCodeQuery] Stream aborted for flow ${flowId}`);
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

      pearlStore.getState().setCoffeeOriginalPrompt(params.prompt.trim());
      pearlStore.getState().setIsCoffeeLoading(true);

      for await (const event of sseToAsyncIterable(response)) {
        if (abortController.signal.aborted) {
          console.log(
            `[generateCodeQuery] Stream aborted during iteration for flow ${flowId}`
          );
          return;
        }

        // Handle Coffee events - add messages to store
        if (event.type === 'coffee_clarification') {
          const data = event.data as { questions: ClarificationQuestion[] };
          const msg: ClarificationRequestMessage = {
            id: `clarification-${Date.now()}`,
            type: 'clarification_request',
            questions: data.questions,
            timestamp: new Date(),
          };
          pearlStore.getState().addMessage(msg);
          useGenerationEventsStore.getState().addEvent(flowId, event);
          continue;
        }

        if (event.type === 'coffee_request_context') {
          const data = event.data as CoffeeRequestExternalContextEvent;
          const msg: ContextRequestMessage = {
            id: `context-${Date.now()}`,
            type: 'context_request',
            request: data,
            timestamp: new Date(),
          };
          pearlStore.getState().addMessage(msg);
          useGenerationEventsStore.getState().addEvent(flowId, event);
          continue;
        }

        if (event.type === 'coffee_plan') {
          const data = event.data as CoffeePlanEvent;
          const msg: PlanChatMessage = {
            id: `plan-${Date.now()}`,
            type: 'plan',
            plan: data,
            timestamp: new Date(),
          };
          pearlStore.getState().addMessage(msg);
          useGenerationEventsStore.getState().addEvent(flowId, event);
          continue;
        }

        if (event.type === 'coffee_complete') {
          console.log(
            `[generateCodeQuery] Coffee planning completed for flow ${flowId}`
          );
          pearlStore.getState().setIsCoffeeLoading(false);
          continue;
        }

        useGenerationEventsStore.getState().addEvent(flowId, event);

        if (event.type === 'generation_complete' || event.type === 'error') {
          useGenerationEventsStore.getState().markCompleted(flowId);
          pearlStore.getState().setIsCoffeeLoading(false);
        }
      }

      console.log(
        `[generateCodeQuery] Stream completed successfully for flow ${flowId}`
      );
      pearlStore.getState().setIsCoffeeLoading(false);
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

      if (
        lastError.message.includes('Authentication failed') ||
        /HTTP 4\d{2}/.test(lastError.message)
      ) {
        useGenerationEventsStore.getState().addEvent(flowId, {
          type: 'error',
          data: { error: lastError.message, recoverable: false },
        });
        useGenerationEventsStore.getState().markCompleted(flowId);
        pearlStore.getState().setIsCoffeeLoading(false);
        return;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(5000 * Math.pow(2, attempt), 4000);
        console.log(
          `[generateCodeQuery] Retrying in ${delayMs}ms... (attempt ${attempt + 2}/${maxRetries + 1})`
        );

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

  const errorMsg = lastError?.message || 'Stream failed after all retries';
  useGenerationEventsStore.getState().addEvent(flowId, {
    type: 'error',
    data: { error: errorMsg, recoverable: false },
  });
  useGenerationEventsStore.getState().markCompleted(flowId);
}

/**
 * Starts the building phase after Coffee planning is complete.
 */
export async function startBuildingPhase(
  flowId: number,
  prompt: string,
  planContext?: string,
  _clarificationAnswers?: Record<string, string[]>
): Promise<void> {
  const store = useGenerationEventsStore.getState();
  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  pearlStore.getState().setIsCoffeeLoading(true);

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

      useGenerationEventsStore.getState().addEvent(flowId, event);

      if (event.type === 'generation_complete' || event.type === 'error') {
        useGenerationEventsStore.getState().markCompleted(flowId);
      }
    }

    console.log(
      `[startBuildingPhase] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Build failed';
    console.error(`[startBuildingPhase] Error:`, errorMsg);

    useGenerationEventsStore.getState().addEvent(flowId, {
      type: 'error',
      data: { error: errorMsg, recoverable: false },
    });
    useGenerationEventsStore.getState().markCompleted(flowId);
  } finally {
    pearlStore.getState().setIsCoffeeLoading(false);
  }
}

/**
 * Submits clarification answers and continues the Coffee planning phase.
 */
export async function submitClarificationAndContinue(
  flowId: number,
  prompt: string,
  answers: Record<string, string[]>
): Promise<void> {
  const store = useGenerationEventsStore.getState();
  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  const { getPearlChatStore } = await import('../stores/pearlChatStore');
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

      if (event.type === 'coffee_clarification') {
        const data = event.data as { questions: ClarificationQuestion[] };
        storeState.addMessage({
          id: `clarification-${Date.now()}`,
          type: 'clarification_request',
          questions: data.questions,
          timestamp: new Date(),
        });
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_request_context') {
        const data = event.data as CoffeeRequestExternalContextEvent;
        storeState.addMessage({
          id: `context-${Date.now()}`,
          type: 'context_request',
          request: data,
          timestamp: new Date(),
        });
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_plan') {
        const data = event.data as CoffeePlanEvent;
        storeState.addMessage({
          id: `plan-${Date.now()}`,
          type: 'plan',
          plan: data,
          timestamp: new Date(),
        });
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_complete') {
        console.log(
          `[submitClarificationAndContinue] Coffee planning completed for flow ${flowId}`
        );
        continue;
      }

      useGenerationEventsStore.getState().addEvent(flowId, event);
    }

    console.log(
      `[submitClarificationAndContinue] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Planning failed';
    console.error(`[submitClarificationAndContinue] Error:`, errorMsg);

    useGenerationEventsStore.getState().addEvent(flowId, {
      type: 'error',
      data: { error: errorMsg, recoverable: false },
    });
  } finally {
    storeState.setIsCoffeeLoading(false);
  }
}

/**
 * Creates a query for code generation that reads from the persistent events store.
 */
export const useGenerateInitialFlow = (params: GenerateCodeParams) => {
  return useQuery({
    queryKey: ['generate-code', params.prompt, params.flowId],
    enabled: params.enabled,
    queryFn: async (): Promise<GenerationStreamingEvent[]> => {
      const { flowId } = params;
      if (!flowId) return [];

      const store = useGenerationEventsStore.getState();

      if (!store.hasActiveStream(flowId) && !store.isCompleted(flowId)) {
        startGenerationStream(params).catch((err) => {
          console.error('[generateCodeQuery] Stream error:', err);
        });
      }

      return store.getEvents(flowId);
    },
    refetchInterval: () => {
      const flowId = params.flowId;
      if (!flowId) return false;

      const store = useGenerationEventsStore.getState();
      if (store.hasActiveStream(flowId)) {
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
