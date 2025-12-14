/**
 * usePearlChatStore - Combines Pearl chat state with mutation and context gathering
 *
 * This hook provides a clean API for components to trigger Pearl chat generation
 * without needing to subscribe to state changes (unless they want to render the chat).
 *
 * Usage:
 * ```typescript
 * // In a chat UI component (with subscription):
 * const pearl = usePearlChatStore(flowId);
 * return <div>{pearl.messages.map(...)}</div>;
 *
 * // In a button component (no subscription):
 * const pearl = usePearlChatStore(flowId);
 * onClick={() => pearl.startGeneration("Fix errors")}
 * ```
 */

import { useCallback, useState } from 'react';
import type {
  StreamingEvent,
  StreamingLogEvent,
  ClarificationQuestion,
  CoffeePlanEvent,
  CoffeeRequestExternalContextEvent,
  CredentialType,
} from '@bubblelab/shared-schemas';
import {
  ParsedBubbleWithInfo,
  cleanUpObjectForDisplayAndStorage,
  PEARL_DEFAULT_MODEL,
} from '@bubblelab/shared-schemas';
import {
  usePearlStream,
  submitContextAndContinue,
  rejectContextAndContinue,
} from './usePearl';
import { useIsMutating } from '@tanstack/react-query';
import {
  getPearlChatStore,
  type DisplayEvent,
  type CoffeePhase,
} from '../stores/pearlChatStore';
import type { ChatMessage } from '../components/ai/type';
import { useEditor } from './useEditor';
import { useBubbleDetail } from './useBubbleDetail';
import { getExecutionStore } from '../stores/executionStore';
import { trackAIAssistant } from '../services/analytics';
import { simplifyObjectForContext } from '../utils/executionLogsFormatUtils';
import { api } from '../lib/api';
import { sseToAsyncIterable } from '../utils/sseStream';

/**
 * Build additional context from execution state, errors, outputs, credentials
 */
function buildAdditionalContext(
  flowId: number | null,
  bubbleDetail: ReturnType<typeof useBubbleDetail>
): string {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: userTimezone,
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const timeZoneContext = `\n\nUser's timezone: ${userTimezone}`;
  const currentTimeContext = `\n\nCurrent time: ${currentTime}`;

  // Get execution state (non-reactive)
  const executionState = flowId ? getExecutionStore(flowId) : null;
  const allEvents = executionState?.events || [];

  // Error logs context
  const errorLogs = allEvents.filter(
    (e) => e.type === 'error' || e.type === 'fatal'
  );

  const errorContext =
    errorLogs.length > 0
      ? `\n\nRecent Execution Errors (${errorLogs.length} errors):\n${errorLogs
          .map((log: StreamingLogEvent, idx: number) => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            return `${idx + 1}. [${timestamp}] ${log.type.toUpperCase()}: ${log.message}${
              log.additionalData
                ? `\n   Additional Info: ${JSON.stringify(log.additionalData)}`
                : ''
            }`;
          })
          .join('\n')}`
      : '';

  // Bubble output logs
  const outputLogs = allEvents.filter(
    (e) => e.type === 'bubble_execution_complete'
  );

  const outputContext =
    outputLogs.length > 0
      ? `\n\nBubble Outputs (${outputLogs.length} bubbles executed):\n${outputLogs
          .map((log: StreamingLogEvent, idx: number) => {
            const variableId = log.variableId;
            const bubbleName = variableId
              ? bubbleDetail.getVariableNameForDisplay(variableId, allEvents)
              : 'unknown';
            const result = log.additionalData?.result;
            const simplifiedResult = simplifyObjectForContext(result);
            return `${idx + 1}. ${bubbleName}: ${simplifiedResult}`;
          })
          .join('\n')}`
      : '';

  // Execution inputs
  const executionInputs = Object.fromEntries(
    Object.entries(executionState?.executionInputs || {}).map(
      ([key, value]) => [key, value]
    )
  );

  const truncatedExecutionInputs = Object.fromEntries(
    Object.entries(executionInputs).map(([key, value]) => [
      key,
      cleanUpObjectForDisplayAndStorage(value, 100),
    ])
  );

  const inputSchemaContext = executionState?.executionInputs
    ? `\n\nUser's provided input:\n ${JSON.stringify(truncatedExecutionInputs, null, 2)}`
    : '';

  // Credentials context
  const pendingCredentials = executionState?.pendingCredentials;
  const credentialsContext =
    pendingCredentials && Object.keys(pendingCredentials).length > 0
      ? `\n\nAvailable Credentials/Integrations:\n${Object.keys(
          pendingCredentials
        )
          .map((key) => `- ${key}`)
          .join('\n')}`
      : '';

  return `${timeZoneContext}${currentTimeContext}${errorContext}${outputContext}${inputSchemaContext}${credentialsContext}`;
}

/**
 * Process streaming events and update store state
 */
function handleStreamingEvent(
  event: StreamingEvent,
  store: NonNullable<ReturnType<typeof getPearlChatStore>>
) {
  const state = store.getState();

  switch (event.type) {
    case 'llm_start':
      if (state.activeToolCallIds.size === 0) {
        state.addEventToCurrentTurn({ type: 'llm_thinking' });
      }
      break;

    case 'llm_complete':
      state.updateLastEvent((events: DisplayEvent[]) =>
        events.filter((e: DisplayEvent) => e.type !== 'llm_thinking')
      );
      break;

    case 'tool_start':
      state.addToolCall(event.data.callId);
      state.updateLastEvent((events: DisplayEvent[]) =>
        events.filter((e: DisplayEvent) => e.type !== 'llm_thinking')
      );
      state.addEventToCurrentTurn({
        type: 'tool_start',
        tool: event.data.tool,
        input: event.data.input,
        callId: event.data.callId,
        startTime: Date.now(),
      });
      break;

    case 'tool_complete':
      state.removeToolCall(event.data.callId);
      state.updateLastEvent((events: DisplayEvent[]) =>
        events.map((e: DisplayEvent) =>
          e.type === 'tool_start' && e.callId === event.data.callId
            ? {
                type: 'tool_complete',
                tool: event.data.tool,
                output: event.data.output,
                duration: event.data.duration,
                callId: event.data.callId,
              }
            : e
        )
      );
      break;

    case 'think': {
      // Clean up thinking content by removing any JSON response at the end
      let thinkingContent = event.data.content;

      // Try to detect and remove JSON objects from thinking content
      // The LLM sometimes includes the final JSON response in the thinking
      try {
        // Look for JSON patterns like {"type": "answer", "message": "..."}
        const jsonMatch = thinkingContent.match(
          /\{[\s\S]*"type"[\s\S]*"message"[\s\S]*\}/
        );
        if (jsonMatch) {
          // Remove the JSON and any trailing content
          thinkingContent = thinkingContent
            .substring(0, jsonMatch.index)
            .trim();
        }
      } catch {
        // If parsing fails, use the content as-is
      }

      // Only add thinking event if there's actual content after cleanup
      if (thinkingContent) {
        state.addEventToCurrentTurn({
          type: 'think',
          content: thinkingContent,
        });
      }
      break;
    }

    case 'token':
      state.updateLastEvent((events: DisplayEvent[]) => {
        const lastEvent = events[events.length - 1];
        if (lastEvent?.type === 'token') {
          return [
            ...events.slice(0, -1),
            { type: 'token', content: lastEvent.content + event.data.content },
          ];
        }
        return [...events, { type: 'token', content: event.data.content }];
      });
      break;

    case 'complete':
    case 'error':
      // These are handled by mutation callbacks
      break;
  }
}

/**
 * Main hook - combines store state with mutation and provides simple API
 */
export function usePearlChatStore(flowId: number | null) {
  // IMPORTANT: Always call hooks in the same order (React Rules of Hooks)
  // Gather dependencies - must be called unconditionally
  const { editor } = useEditor();
  const bubbleDetail = useBubbleDetail(flowId);

  // Get store instance - always returns a valid store (creates fallback for null)
  // This ensures hooks are called in consistent order
  const store = getPearlChatStore(flowId ?? -1);

  // Mutation for API calls with built-in success/error handling
  const pearlMutation = usePearlStream({
    flowId,
    onEvent: (event: StreamingEvent) => {
      if (store) {
        handleStreamingEvent(event, store);
      }
    },
    onSuccess: (result) => {
      if (!store) return;

      const storeState = store.getState();

      // Sometimes the backend returns a JSON string in the message field
      // Try to parse it and extract the actual message
      let messageContent = result.message || '';
      try {
        const parsed = JSON.parse(messageContent.trim());
        if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          messageContent = parsed.message;
        }
      } catch {
        // Not a JSON string, use as-is
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: messageContent,
        code:
          result.type === 'code' && result.snippet ? result.snippet : undefined,
        resultType: result.type,
        timestamp: new Date(),
        bubbleParameters: result.bubbleParameters as Record<
          string,
          ParsedBubbleWithInfo
        >,
      };

      storeState.addMessage(assistantMessage);
      storeState.clearToolCalls();

      trackAIAssistant({
        action: 'receive_response',
        message: assistantMessage.content,
      });
    },
    onError: (error) => {
      if (!store) return;

      const storeState = store.getState();
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content:
          error instanceof Error
            ? error.message
            : 'Failed to generate response',
        resultType: 'reject',
        timestamp: new Date(),
      };

      storeState.addMessage(errorMessage);
      storeState.clearToolCalls();
    },
  });

  // Subscribe to state using the store as a hook
  // Store is guaranteed to exist (never null)
  const messages = store((s) => s.messages);
  const eventsList = store((s) => s.eventsList);
  const activeToolCallIds = store((s) => s.activeToolCallIds);
  const prompt = store((s) => s.prompt);
  const selectedBubbleContext = store((s) => s.selectedBubbleContext);
  const selectedTransformationContext = store(
    (s) => s.selectedTransformationContext
  );
  const selectedStepContext = store((s) => s.selectedStepContext);

  // Coffee state subscriptions
  const coffeePhase = store((s) => s.coffeePhase);
  const coffeeQuestions = store((s) => s.coffeeQuestions);
  const coffeeAnswers = store((s) => s.coffeeAnswers);
  const coffeePlan = store((s) => s.coffeePlan);
  const coffeeOriginalPrompt = store((s) => s.coffeeOriginalPrompt);
  const coffeeContextRequest = store((s) => s.coffeeContextRequest);
  const coffeeContextCredentials = store((s) => s.coffeeContextCredentials);
  const isCoffeeLoading = store((s) => s.isCoffeeLoading);

  // ===== Main Generation Function =====
  const startGeneration = (
    promptText: string,
    uploadedFiles: Array<{ name: string; content: string }> = []
  ) => {
    if (!store || !flowId) return;

    const storeState = store.getState();

    // Build user message with bubble, transformation, or step context injection
    let userContent = promptText.trim();

    // Inject bubble context if any bubbles are selected
    if (storeState.selectedBubbleContext.length > 0) {
      const bubbleContextText = storeState.selectedBubbleContext
        .map((variableId) => {
          const bubbleInfo = bubbleDetail.getBubbleInfo(variableId);
          const variableName =
            bubbleInfo?.variableName || `Bubble ${variableId}`;
          return `For the selected bubble: ${variableName}, please do the following: \n `;
        })
        .join(', ');

      // Prepend bubble context to the user's prompt
      userContent = `${bubbleContextText}${userContent ? '\n\n' + userContent : ''}`;
    }
    // Inject step context if a step is selected
    else if (storeState.selectedStepContext) {
      const stepContextText = `For the selected step: ${storeState.selectedStepContext}, please do the following: \n `;
      userContent = `${stepContextText}${userContent ? '\n\n' + userContent : ''}`;
    }
    // Inject transformation context if a transformation is selected
    else if (storeState.selectedTransformationContext) {
      const transformationContextText = `For the selected transformation function: ${storeState.selectedTransformationContext}, please do the following: \n `;
      userContent = `${transformationContextText}${userContent ? '\n\n' + userContent : ''}`;
    }

    if (uploadedFiles.length > 0) {
      const fileInfo = uploadedFiles
        .map((f) => {
          const fileType = f.name.toLowerCase().endsWith('.png')
            ? 'image (base64)'
            : 'text';
          return `${f.name} (${fileType})`;
        })
        .join(', ');

      userContent = userContent
        ? `${userContent}\n\n[Attached files: ${fileInfo}]`
        : `[Processing attached files: ${fileInfo}]`;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    // Update store state
    storeState.addMessage(userMessage);
    storeState.startNewTurn();
    storeState.clearToolCalls();
    storeState.clearPrompt(); // Clear prompt after sending
    // Note: We keep selectedBubbleContext for now, will clear it after successful generation

    // Build conversation history from current messages
    const conversationMessages = storeState.messages.map((msg) => ({
      role: msg.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    // Build context (timezone, errors, outputs, credentials)
    const context = buildAdditionalContext(flowId, bubbleDetail);

    // Get editor code
    const fullCode = editor?.getCode() || '';

    // Track analytics
    trackAIAssistant({
      action: 'send_message',
      message: userMessage.content,
    });

    // Call mutation (onSuccess/onError handled by usePearlStream)
    pearlMutation.mutate({
      userRequest: userMessage.content,
      userName: 'User',
      conversationHistory: conversationMessages,
      availableVariables: [],
      currentCode: fullCode,
      model: PEARL_DEFAULT_MODEL,
      additionalContext: context,
    });
  };

  // ===== Clear messages =====
  const clearMessages = useCallback(() => {
    store?.getState().clearMessages();
  }, [store]);

  // ===== Reset =====
  const reset = useCallback(() => {
    store?.getState().reset();
  }, [store]);

  // Derive shared pending based on mutationKey so multiple components stay in sync
  const isMutating = useIsMutating({
    mutationKey: ['pearlStream', flowId ?? -1],
  });
  const isPending = isMutating > 0;
  const isError = pearlMutation.isError;
  const error = pearlMutation.error;

  // ===== Prompt management =====
  const setPrompt = useCallback(
    (newPrompt: string) => {
      store?.getState().setPrompt(newPrompt);
    },
    [store]
  );

  const clearPrompt = useCallback(() => {
    store?.getState().clearPrompt();
  }, [store]);

  // ===== Bubble context management =====
  const addBubbleToContext = useCallback(
    (variableId: number) => {
      store?.getState().addBubbleToContext(variableId);
    },
    [store]
  );

  const removeBubbleFromContext = useCallback(
    (variableId: number) => {
      store?.getState().removeBubbleFromContext(variableId);
    },
    [store]
  );

  const toggleBubbleInContext = useCallback(
    (variableId: number) => {
      store?.getState().toggleBubbleInContext(variableId);
    },
    [store]
  );

  const clearBubbleContext = useCallback(() => {
    store?.getState().clearBubbleContext();
  }, [store]);

  // ===== Transformation context management =====
  const addTransformationToContext = useCallback(
    (functionName: string) => {
      store?.getState().addTransformationToContext(functionName);
    },
    [store]
  );

  const clearTransformationContext = useCallback(() => {
    store?.getState().clearTransformationContext();
  }, [store]);

  // ===== Step context management =====
  const addStepToContext = useCallback(
    (functionName: string) => {
      store?.getState().addStepToContext(functionName);
    },
    [store]
  );

  const clearStepContext = useCallback(() => {
    store?.getState().clearStepContext();
  }, [store]);

  // ===== Coffee Agent Functions =====

  /**
   * Start Coffee planning phase - asks clarification questions
   */
  const startCoffeePlanning = useCallback(
    async (promptText: string) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      storeState.setIsCoffeeLoading(true);

      // Store the original prompt for later use
      storeState.setCoffeeOriginalPrompt(promptText);
      storeState.setCoffeePhase('clarifying');

      try {
        const response = await api.postStream(
          '/bubble-flow/generate?phase=planning',
          {
            prompt: promptText,
            flowId,
          }
        );

        // Process SSE stream
        for await (const event of sseToAsyncIterable(response)) {
          if (event.type === 'coffee_clarification') {
            const data = event.data as { questions: ClarificationQuestion[] };
            storeState.setCoffeeQuestions(data.questions);
            storeState.setCoffeePhase('clarifying');
          } else if (event.type === 'coffee_plan') {
            const data = event.data as CoffeePlanEvent;
            storeState.setCoffeePlan(data);
            storeState.setCoffeePhase('ready');
          } else if (event.type === 'coffee_complete') {
            // Planning complete
          } else if (event.type === 'stream_complete') {
            // Stream finished
          }
        }
      } catch (error) {
        console.error('[Coffee] Planning error:', error);
        storeState.setCoffeePhase('idle');
      } finally {
        storeState.setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  /**
   * Submit clarification answers and continue planning
   */
  const submitClarificationAnswers = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      storeState.setIsCoffeeLoading(true);

      // Update store with answers
      storeState.setCoffeeAnswers(answers);
      storeState.setCoffeePhase('planning');
      storeState.setCoffeeQuestions(null); // Clear questions

      try {
        const response = await api.postStream(
          '/bubble-flow/generate?phase=planning',
          {
            prompt: storeState.coffeeOriginalPrompt || '',
            flowId,
            clarificationAnswers: answers,
          }
        );

        // Process SSE stream
        for await (const event of sseToAsyncIterable(response)) {
          if (event.type === 'coffee_plan') {
            const data = event.data as CoffeePlanEvent;
            storeState.setCoffeePlan(data);
            storeState.setCoffeePhase('ready');
          } else if (event.type === 'coffee_complete') {
            // Planning complete
          }
        }
      } catch (error) {
        console.error('[Coffee] Submit answers error:', error);
        storeState.setCoffeePhase('idle');
      } finally {
        storeState.setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  /**
   * Approve the plan and start building (code generation)
   */
  const approvePlanAndBuild = useCallback(
    async (comment?: string) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      const plan = storeState.coffeePlan;
      const originalPrompt = storeState.coffeeOriginalPrompt;

      if (!plan || !originalPrompt) return;

      storeState.setIsCoffeeLoading(true);

      // Build plan context string for Boba
      const planContext = [
        `Summary: ${plan.summary}`,
        'Steps:',
        ...plan.steps.map(
          (step, i) =>
            `${i + 1}. ${step.title}: ${step.description}${step.bubblesUsed ? ` (Using: ${step.bubblesUsed.join(', ')})` : ''}`
        ),
        `Bubbles to use: ${plan.estimatedBubbles.join(', ')}`,
        ...(comment ? [`\nAdditional user comments: ${comment}`] : []),
      ].join('\n');

      // Clear coffee state (but keep loading state until operation completes)
      const currentLoadingState = storeState.isCoffeeLoading;
      storeState.clearCoffeeState();
      storeState.setIsCoffeeLoading(currentLoadingState);

      // Add a user message about the plan approval
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: `[Plan Approved] ${originalPrompt}`,
        timestamp: new Date(),
      };
      storeState.addMessage(userMessage);
      storeState.startNewTurn();

      try {
        // Start building phase with plan context
        // This will use the existing generation flow
        const response = await api.postStream(
          '/bubble-flow/generate?phase=building',
          {
            prompt: originalPrompt,
            flowId,
            planContext,
          }
        );

        // Process events similar to initial generation
        for await (const event of sseToAsyncIterable(response)) {
          handleStreamingEvent(event as StreamingEvent, store);
        }
      } catch (error) {
        console.error('[Coffee] Build error:', error);
      } finally {
        store.getState().setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  /**
   * Skip Coffee planning and go directly to building
   */
  const skipCoffeeAndBuild = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!originalPrompt) return;

    // Mark as skipped and clear coffee state
    storeState.setCoffeePhase('skipped');
    storeState.clearCoffeeState();

    // Add a user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: originalPrompt,
      timestamp: new Date(),
    };
    storeState.addMessage(userMessage);
    storeState.startNewTurn();

    storeState.setIsCoffeeLoading(true);

    try {
      const response = await api.postStream(
        '/bubble-flow/generate?phase=building',
        {
          prompt: originalPrompt,
          flowId,
        }
      );

      for await (const event of sseToAsyncIterable(response)) {
        handleStreamingEvent(event as StreamingEvent, store);
      }
    } catch (error) {
      console.error('[Coffee] Skip and build error:', error);
    } finally {
      store.getState().setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  /**
   * Retry Coffee planning with the same prompt
   */
  const retryCoffeePlanning = useCallback(async () => {
    if (!store) return;

    const storeState = store.getState();
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!originalPrompt) return;

    // Clear current state and restart
    storeState.setCoffeeQuestions(null);
    storeState.setCoffeePlan(null);
    storeState.setCoffeeAnswers({});

    // Restart planning
    await startCoffeePlanning(originalPrompt);
  }, [store, startCoffeePlanning]);

  /**
   * Clear Coffee state and return to idle
   */
  const clearCoffeeState = useCallback(() => {
    store?.getState().clearCoffeeState();
  }, [store]);

  /**
   * Set a credential for context request
   */
  const setCoffeeContextCredential = useCallback(
    (credType: CredentialType, credId: number | null) => {
      store?.getState().setCoffeeContextCredential(credType, credId);
    },
    [store]
  );

  /**
   * Submit context credentials and execute the context-gathering flow
   */
  const submitContext = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const contextRequest = storeState.coffeeContextRequest;
    const credentials = storeState.coffeeContextCredentials;
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!contextRequest || !originalPrompt) return;

    storeState.setIsCoffeeLoading(true);
    storeState.setCoffeePhase('gathering');

    try {
      await submitContextAndContinue(
        flowId,
        originalPrompt,
        contextRequest.flowCode,
        credentials as Record<string, number>
      );
    } catch (error) {
      console.error('[Coffee] Context submission error:', error);
      storeState.setCoffeePhase('idle');
    } finally {
      storeState.setIsCoffeeLoading(false);
      // Only clear context request if we're not awaiting a new context request
      // (A new context request may have been set during stream processing)
      const currentPhase = store.getState().coffeePhase;
      if (currentPhase !== 'awaiting_context') {
        storeState.clearCoffeeContextRequest();
      }
    }
  }, [store, flowId]);

  /**
   * Reject context request and continue without context
   */
  const rejectContext = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!originalPrompt) return;

    storeState.setIsCoffeeLoading(true);
    storeState.setCoffeePhase('planning');
    storeState.clearCoffeeContextRequest();

    try {
      await rejectContextAndContinue(flowId, originalPrompt);
    } catch (error) {
      console.error('[Coffee] Context rejection error:', error);
      storeState.setCoffeePhase('idle');
    } finally {
      storeState.setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  return {
    // State (components can subscribe)
    messages,
    eventsList,
    activeToolCallIds,
    prompt,
    selectedBubbleContext,
    selectedTransformationContext,
    selectedStepContext,

    // Coffee state
    coffeePhase,
    coffeeQuestions,
    coffeeAnswers,
    coffeePlan,
    coffeeOriginalPrompt,
    coffeeContextRequest,
    coffeeContextCredentials,
    isCoffeeLoading,

    // Actions
    startGeneration,
    clearMessages,
    reset,
    setPrompt,
    clearPrompt,
    addBubbleToContext,
    removeBubbleFromContext,
    toggleBubbleInContext,
    clearBubbleContext,
    addTransformationToContext,
    clearTransformationContext,
    addStepToContext,
    clearStepContext,

    // Coffee actions
    startCoffeePlanning,
    submitClarificationAnswers,
    approvePlanAndBuild,
    skipCoffeeAndBuild,
    retryCoffeePlanning,
    clearCoffeeState,
    setCoffeeContextCredential,
    submitContext,
    rejectContext,

    // Mutation state (for loading indicators)
    isPending,
    isError,
    error,

    pearlMutation,
  };
}
