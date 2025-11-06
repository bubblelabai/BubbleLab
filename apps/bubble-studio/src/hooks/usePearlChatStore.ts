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

import { useCallback } from 'react';
import type { StreamingEvent } from '@bubblelab/shared-schemas';
import {
  ParsedBubbleWithInfo,
  cleanUpObjectForDisplayAndStorage,
} from '@bubblelab/shared-schemas';
import { usePearlStream } from './usePearl';
import { getPearlChatStore, type DisplayEvent } from '../stores/pearlChatStore';
import type { ChatMessage } from '../components/ai/type';
import { useEditor } from './useEditor';
import { useBubbleDetail } from './useBubbleDetail';
import { getExecutionStore } from '../stores/executionStore';
import { trackAIAssistant } from '../services/analytics';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { simplifyObjectForContext } from '../utils/executionLogsFormatUtils';

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

    case 'think':
      state.addEventToCurrentTurn({
        type: 'think',
        content: event.data.content,
      });
      break;

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
  // Mutation for API calls - must be called unconditionally
  const pearlMutation = usePearlStream();

  // Gather dependencies - must be called unconditionally
  const { editor } = useEditor();
  const bubbleDetail = useBubbleDetail(flowId);

  // Get store instance - always returns a valid store (creates fallback for null)
  // This ensures hooks are called in consistent order
  const store = getPearlChatStore(flowId ?? -1);

  // Subscribe to state using the store as a hook
  // Store is guaranteed to exist (never null)
  const messages = store((s) => s.messages);
  const eventsList = store((s) => s.eventsList);
  const activeToolCallIds = store((s) => s.activeToolCallIds);

  // ===== Main Generation Function =====
  const startGeneration = useCallback(
    (
      prompt: string,
      uploadedFiles: Array<{ name: string; content: string }> = []
    ) => {
      if (!store || !flowId) return;

      // Build user message
      let userContent = prompt.trim();
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
      const storeState = store.getState();
      storeState.addMessage(userMessage);
      storeState.startNewTurn();
      storeState.clearToolCalls();

      // Build conversation history from current messages
      const conversationHistory = storeState.messages.map((msg) => ({
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

      // Call mutation
      pearlMutation.mutate(
        {
          userRequest: userMessage.content,
          userName: 'User',
          conversationHistory,
          availableVariables: [],
          currentCode: fullCode,
          model: 'openrouter/z-ai/glm-4.6',
          additionalContext: context,
          onEvent: (event: StreamingEvent) => {
            handleStreamingEvent(event, store);
          },
        },
        {
          onSuccess: (result) => {
            const assistantMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              type: 'assistant',
              content: result.message || '',
              code:
                result.type === 'code' && result.snippet
                  ? result.snippet
                  : undefined,
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
        }
      );
    },
    [store, flowId, pearlMutation, editor, bubbleDetail]
  );

  // ===== Clear messages =====
  const clearMessages = useCallback(() => {
    store?.getState().clearMessages();
  }, [store]);

  // ===== Reset =====
  const reset = useCallback(() => {
    store?.getState().reset();
  }, [store]);

  return {
    // State (components can subscribe)
    messages,
    eventsList,
    activeToolCallIds,

    // Actions
    startGeneration,
    clearMessages,
    reset,

    // Mutation state (for loading indicators)
    isPending: pearlMutation.isPending,
    isError: pearlMutation.isError,
    error: pearlMutation.error,
  };
}
