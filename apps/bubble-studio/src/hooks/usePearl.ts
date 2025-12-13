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
 * Now supports Coffee planning phase:
 * 1. First calls with ?phase=planning to get clarification questions/plan
 * 2. Coffee events are stored in pearlChatStore for the flow
 * 3. Building phase is triggered separately after user approves plan
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

  // Get the pearlChatStore for Coffee state
  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortController.signal.aborted) {
      console.log(`[generateCodeQuery] Stream aborted for flow ${flowId}`);
      return;
    }

    try {
      // Start with planning phase to get clarification questions
      const response = await api.postStream(
        '/bubble-flow/generate?phase=planning',
        {
          prompt: params.prompt.trim(),
          flowId: params.flowId,
        },
        { signal: abortController.signal }
      );

      // Store original prompt for later use
      pearlStore.getState().setCoffeeOriginalPrompt(params.prompt.trim());
      pearlStore.getState().setCoffeePhase('clarifying');

      // Consume the stream and handle Coffee events
      for await (const event of sseToAsyncIterable(response)) {
        if (abortController.signal.aborted) {
          console.log(
            `[generateCodeQuery] Stream aborted during iteration for flow ${flowId}`
          );
          return;
        }

        // Handle Coffee-specific events
        if (event.type === 'coffee_clarification') {
          // Store clarification questions in pearlChatStore
          const data = event.data as {
            questions: ClarificationQuestion[];
          };
          pearlStore.getState().setCoffeeQuestions(data.questions);
          pearlStore.getState().setCoffeePhase('clarifying');
          // Add event to generation store for UI visibility
          useGenerationEventsStore.getState().addEvent(flowId, event);
          // Pause here - user needs to answer questions
          // The stream will complete, and building will be triggered by user action
          continue;
        }

        if (event.type === 'coffee_request_context') {
          // Store context request in pearlChatStore
          const data = event.data as CoffeeRequestExternalContextEvent;
          pearlStore.getState().setCoffeeContextRequest(data);
          pearlStore.getState().setCoffeePhase('awaiting_context');
          // Add event to generation store for UI visibility
          useGenerationEventsStore.getState().addEvent(flowId, event);
          // Pause here - user needs to provide credentials and approve context flow
          continue;
        }

        if (event.type === 'coffee_plan') {
          // Store the plan in pearlChatStore
          const data = event.data as {
            summary: string;
            steps: Array<{
              title: string;
              description: string;
              bubblesUsed?: string[];
            }>;
            estimatedBubbles: string[];
          };
          pearlStore.getState().setCoffeePlan(data);
          pearlStore.getState().setCoffeePhase('ready');
          // Add event to generation store for UI visibility
          useGenerationEventsStore.getState().addEvent(flowId, event);
          // Pause here - user needs to approve the plan
          continue;
        }

        if (event.type === 'coffee_complete') {
          // Coffee phase completed - user will trigger building phase
          console.log(
            `[generateCodeQuery] Coffee planning completed for flow ${flowId}`
          );
          // Don't mark as completed yet - building phase will follow
          continue;
        }

        // Add regular events to store
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
 * Starts the building phase after Coffee planning is complete.
 * Called when user approves the plan or skips planning.
 *
 * @param flowId - The flow ID
 * @param prompt - Original prompt
 * @param planContext - Optional plan context from Coffee (if approved)
 * @param clarificationAnswers - Optional answers to clarification questions
 */
export async function startBuildingPhase(
  flowId: number,
  prompt: string,
  planContext?: string,
  clarificationAnswers?: Record<string, string[]>
): Promise<void> {
  const store = useGenerationEventsStore.getState();

  // Create abort controller for this stream
  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  // Get the pearlChatStore for Coffee state
  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  // Clear Coffee state since we're moving to building
  pearlStore.getState().setCoffeePhase('idle');

  try {
    const response = await api.postStream(
      '/bubble-flow/generate?phase=building',
      {
        prompt: prompt.trim(),
        flowId,
        planContext,
        clarificationAnswers,
      },
      { signal: abortController.signal }
    );

    // Consume the stream and store events
    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[startBuildingPhase] Stream aborted during iteration for flow ${flowId}`
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
  }
}

/**
 * Submits clarification answers and continues the Coffee planning phase.
 * This will resume the Coffee agent with the user's answers to generate a plan.
 *
 * @param flowId - The flow ID
 * @param prompt - Original prompt
 * @param answers - User's answers to clarification questions
 */
export async function submitClarificationAndContinue(
  flowId: number,
  prompt: string,
  answers: Record<string, string[]>
): Promise<void> {
  const store = useGenerationEventsStore.getState();

  // Create abort controller for this stream
  const abortController = new AbortController();
  store.registerStream(flowId, abortController);

  // Get the pearlChatStore for Coffee state
  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  // Update phase to planning
  pearlStore.getState().setCoffeePhase('planning');
  pearlStore.getState().setCoffeeAnswers(answers);
  pearlStore.getState().setCoffeeQuestions(null); // Clear questions

  try {
    const response = await api.postStream(
      '/bubble-flow/generate?phase=planning',
      {
        prompt: prompt.trim(),
        flowId,
        clarificationAnswers: answers,
      },
      { signal: abortController.signal }
    );

    // Consume the stream and handle Coffee events
    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[submitClarificationAndContinue] Stream aborted for flow ${flowId}`
        );
        return;
      }

      // Handle Coffee-specific events
      if (event.type === 'coffee_clarification') {
        // Store clarification questions in pearlChatStore
        const data = event.data as {
          questions: ClarificationQuestion[];
        };
        pearlStore.getState().setCoffeeQuestions(data.questions);
        pearlStore.getState().setCoffeePhase('clarifying');
        // Add event to generation store for UI visibility
        useGenerationEventsStore.getState().addEvent(flowId, event);
        // Pause here - user needs to answer questions
        continue;
      }

      if (event.type === 'coffee_request_context') {
        // Store context request in pearlChatStore
        const data = event.data as CoffeeRequestExternalContextEvent;
        pearlStore.getState().setCoffeeContextRequest(data);
        pearlStore.getState().setCoffeePhase('awaiting_context');
        // Add event to generation store for UI visibility
        useGenerationEventsStore.getState().addEvent(flowId, event);
        // Pause here - user needs to provide credentials and approve context flow
        continue;
      }

      if (event.type === 'coffee_plan') {
        // Store the plan in pearlChatStore
        const data = event.data as {
          summary: string;
          steps: Array<{
            title: string;
            description: string;
            bubblesUsed?: string[];
          }>;
          estimatedBubbles: string[];
        };
        pearlStore.getState().setCoffeePlan(data);
        pearlStore.getState().setCoffeePhase('ready');
        // Add event to generation store for UI visibility
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_complete') {
        console.log(
          `[submitClarificationAndContinue] Coffee planning completed for flow ${flowId}`
        );
        continue;
      }

      // Add regular events to store
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
    pearlStore.getState().setCoffeePhase('idle');
  }
}

/**
 * Submits context flow execution and continues the Coffee planning phase.
 * This executes the context-gathering flow with provided credentials,
 * then resumes Coffee with the result.
 *
 * @param flowId - The flow ID
 * @param prompt - Original prompt
 * @param contextFlowCode - The flow code to execute for context gathering
 * @param credentials - Mapping of credential types to credential IDs
 */
export async function submitContextAndContinue(
  flowId: number,
  prompt: string,
  contextFlowCode: string,
  credentials: Record<string, number>
): Promise<void> {
  const store = useGenerationEventsStore.getState();

  // Get the pearlChatStore for Coffee state
  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  // Update phase to gathering
  pearlStore.getState().setCoffeePhase('gathering');

  try {
    // Step 1: Execute the context-gathering flow
    const contextResult = await api.post<{
      success: boolean;
      result?: unknown;
      error?: string;
    }>('/bubble-flow/generate/run-context-flow', {
      flowCode: contextFlowCode,
      credentials,
    });

    // Get the original context request before clearing it
    const originalContextRequest = pearlStore.getState().coffeeContextRequest;

    // Clear context request state
    pearlStore.getState().clearCoffeeContextRequest();

    // Step 2: Resume Coffee with context answer
    const abortController = new AbortController();
    store.registerStream(flowId, abortController);

    // Update phase to planning
    pearlStore.getState().setCoffeePhase('planning');

    const response = await api.postStream(
      '/bubble-flow/generate?phase=planning',
      {
        prompt: prompt.trim(),
        flowId,
        contextAnswer: {
          flowId: originalContextRequest?.flowId || '',
          status: contextResult.success ? 'success' : 'error',
          result: contextResult.result,
          error: contextResult.error,
          originalRequest: originalContextRequest || undefined,
        },
      },
      { signal: abortController.signal }
    );

    // Consume the stream and handle Coffee events
    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[submitContextAndContinue] Stream aborted for flow ${flowId}`
        );
        return;
      }

      // Handle Coffee-specific events
      if (event.type === 'coffee_clarification') {
        // Store clarification questions in pearlChatStore
        const data = event.data as {
          questions: ClarificationQuestion[];
        };
        pearlStore.getState().setCoffeeQuestions(data.questions);
        pearlStore.getState().setCoffeePhase('clarifying');
        // Add event to generation store for UI visibility
        useGenerationEventsStore.getState().addEvent(flowId, event);
        // Pause here - user needs to answer questions
        continue;
      }

      if (event.type === 'coffee_request_context') {
        // Store context request in pearlChatStore
        const data = event.data as CoffeeRequestExternalContextEvent;
        pearlStore.getState().setCoffeeContextRequest(data);
        pearlStore.getState().setCoffeePhase('awaiting_context');
        // Add event to generation store for UI visibility
        useGenerationEventsStore.getState().addEvent(flowId, event);
        // Pause here - user needs to provide credentials and approve context flow
        continue;
      }

      if (event.type === 'coffee_plan') {
        const data = event.data as {
          summary: string;
          steps: Array<{
            title: string;
            description: string;
            bubblesUsed?: string[];
          }>;
          estimatedBubbles: string[];
        };
        pearlStore.getState().setCoffeePlan(data);
        pearlStore.getState().setCoffeePhase('ready');
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_complete') {
        console.log(
          `[submitContextAndContinue] Coffee planning completed for flow ${flowId}`
        );
        continue;
      }

      useGenerationEventsStore.getState().addEvent(flowId, event);
    }

    console.log(
      `[submitContextAndContinue] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Context gathering failed';
    console.error(`[submitContextAndContinue] Error:`, errorMsg);

    useGenerationEventsStore.getState().addEvent(flowId, {
      type: 'error',
      data: { error: errorMsg, recoverable: false },
    });
    pearlStore.getState().setCoffeePhase('idle');
    pearlStore.getState().clearCoffeeContextRequest();
  }
}

/**
 * Rejects the context request and continues Coffee planning without external context.
 * Coffee will proceed with generating a plan using the available information.
 *
 * @param flowId - The flow ID
 * @param prompt - Original prompt
 */
export async function rejectContextAndContinue(
  flowId: number,
  prompt: string
): Promise<void> {
  const store = useGenerationEventsStore.getState();

  // Get the pearlChatStore for Coffee state
  const { getPearlChatStore } = await import('../stores/pearlChatStore');
  const pearlStore = getPearlChatStore(flowId);

  // Get the original context request before clearing it
  const originalContextRequest = pearlStore.getState().coffeeContextRequest;
  const contextFlowId = originalContextRequest?.flowId || '';

  // Clear context request state
  pearlStore.getState().clearCoffeeContextRequest();
  pearlStore.getState().setCoffeePhase('planning');

  try {
    // Resume Coffee with rejection status
    const abortController = new AbortController();
    store.registerStream(flowId, abortController);

    const response = await api.postStream(
      '/bubble-flow/generate?phase=planning',
      {
        prompt: prompt.trim(),
        flowId,
        contextAnswer: {
          flowId: contextFlowId,
          status: 'rejected',
          originalRequest: originalContextRequest || undefined,
        },
      },
      { signal: abortController.signal }
    );

    // Consume the stream and handle Coffee events
    for await (const event of sseToAsyncIterable(response)) {
      if (abortController.signal.aborted) {
        console.log(
          `[rejectContextAndContinue] Stream aborted for flow ${flowId}`
        );
        return;
      }

      // Handle Coffee-specific events
      if (event.type === 'coffee_plan') {
        const data = event.data as {
          summary: string;
          steps: Array<{
            title: string;
            description: string;
            bubblesUsed?: string[];
          }>;
          estimatedBubbles: string[];
        };
        pearlStore.getState().setCoffeePlan(data);
        pearlStore.getState().setCoffeePhase('ready');
        useGenerationEventsStore.getState().addEvent(flowId, event);
        continue;
      }

      if (event.type === 'coffee_complete') {
        console.log(
          `[rejectContextAndContinue] Coffee planning completed for flow ${flowId}`
        );
        continue;
      }

      useGenerationEventsStore.getState().addEvent(flowId, event);
    }

    console.log(
      `[rejectContextAndContinue] Stream completed successfully for flow ${flowId}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Planning failed';
    console.error(`[rejectContextAndContinue] Error:`, errorMsg);

    useGenerationEventsStore.getState().addEvent(flowId, {
      type: 'error',
      data: { error: errorMsg, recoverable: false },
    });
    pearlStore.getState().setCoffeePhase('idle');
  }
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
