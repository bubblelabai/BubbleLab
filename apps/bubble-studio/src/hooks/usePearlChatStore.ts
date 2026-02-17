/**
 * usePearlChatStore - Combines Pearl chat state with mutation and context gathering
 *
 * Messages are the source of truth for Coffee state.
 * Special message types (clarification_request, context_request, plan) are stored
 * as messages in history and rendered as widgets when pending.
 */

import { useCallback } from 'react';
import type {
  StreamingEvent,
  StreamingLogEvent,
  ClarificationQuestion,
  CoffeePlanEvent,
  CoffeeRequestExternalContextEvent,
  CredentialType,
} from '@bubblelab/shared-schemas';
import type { GenerationStreamingEvent } from '../types/generation';
import {
  ParsedBubbleWithInfo,
  cleanUpObjectForDisplayAndStorage,
  PEARL_DEFAULT_MODEL,
} from '@bubblelab/shared-schemas';
import { usePearlStream } from './usePearlStream';
import { useIsMutating } from '@tanstack/react-query';
import { getPearlChatStore, type DisplayEvent } from '../stores/pearlChatStore';
import type {
  ChatMessage,
  ClarificationRequestMessage,
  ClarificationResponseMessage,
  ContextRequestMessage,
  ContextResponseMessage,
  PlanChatMessage,
  PlanApprovalMessage,
  AssistantChatMessage,
  UserChatMessage,
  SystemChatMessage,
  ToolResultChatMessage,
} from '../components/ai/type';
import {
  getPendingClarificationRequest,
  getPendingContextRequest,
  getPendingPlan,
} from '../components/ai/type';
import { useEditor } from './useEditor';
import { useBubbleDetail } from './useBubbleDetail';
import { getExecutionStore } from '../stores/executionStore';
import { trackAIAssistant } from '../services/analytics';
import { simplifyObjectForContext } from '../utils/executionLogsFormatUtils';
import { api } from '../lib/api';
import { sseToAsyncIterable } from '../utils/sseStream';
import { messagesToConversationHistory } from '../utils/pearlConversation';

/** Backend message format */
type BackendCoffeeMessage = {
  id: string;
  timestamp: string;
  type: string;
  [key: string]: unknown;
};

/**
 * Convert frontend ChatMessage to backend message format
 */
function toBackendMessage(msg: ChatMessage): BackendCoffeeMessage {
  const base = { id: msg.id, timestamp: msg.timestamp.toISOString() };

  switch (msg.type) {
    case 'user':
      return { ...base, type: 'user', content: msg.content };
    case 'assistant':
      return {
        ...base,
        type: 'assistant',
        content: msg.content,
        code: msg.code,
        resultType: msg.resultType,
        bubbleParameters: msg.bubbleParameters as Record<string, unknown>,
      };
    case 'clarification_request':
      return {
        ...base,
        type: 'clarification_request',
        questions: msg.questions,
      };
    case 'clarification_response':
      return {
        ...base,
        type: 'clarification_response',
        answers: msg.answers,
        originalQuestions: msg.originalQuestions,
      };
    case 'context_request':
      return { ...base, type: 'context_request', request: msg.request };
    case 'context_response':
      return {
        ...base,
        type: 'context_response',
        answer: msg.answer,
        credentialTypes: msg.credentialTypes,
      };
    case 'plan':
      return { ...base, type: 'plan', plan: msg.plan };
    case 'plan_approval':
      return {
        ...base,
        type: 'plan_approval',
        approved: msg.approved,
        comment: msg.comment,
      };
    case 'system':
      return { ...base, type: 'system', content: msg.content };
    case 'tool_result':
      return {
        ...base,
        type: 'tool_result',
        toolName: msg.toolName,
        toolCallId: msg.toolCallId,
        input: msg.input,
        output: msg.output,
        duration: msg.duration,
        success: msg.success,
      };
  }
}

/**
 * Build additional context from execution state
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

  const executionState = flowId ? getExecutionStore(flowId) : null;
  const allEvents = executionState?.events || [];

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
 * Options for handleStreamingEvent
 */
export interface HandleStreamingEventOptions {
  /** Called when generation_complete event is received with the generated code and summary */
  onGenerationComplete?: (data: {
    generatedCode: string;
    summary: string;
    bubbleParameters?: Record<string, unknown>;
  }) => void;
}

/**
 * Process streaming events and update store state
 * Exported for use by startGenerationStream in usePearl.ts
 *
 * The callback is stored in the store when generation starts, so we don't need to pass it around.
 */
export function handleStreamingEvent(
  event: StreamingEvent | GenerationStreamingEvent,
  store: NonNullable<ReturnType<typeof getPearlChatStore>>
) {
  const state = store.getState();

  switch (event.type) {
    case 'llm_start':
      if (state.activeToolCallIds.size === 0) {
        state.addEvent({ type: 'llm_thinking' });
      }
      break;

    case 'llm_complete':
      // Remove llm_thinking indicator
      state.removeLastTimelineEventIf((e) => e.type === 'llm_thinking');
      // If there's content, add it as an event (similar to think events)
      if (event.data.content && event.data.content.trim()) {
        state.addEvent({
          type: 'llm_complete_content',
          content: event.data.content,
        });
      }
      break;

    case 'tool_call_start':
      state.addToolCall(event.data.callId);
      state.removeLastTimelineEventIf((e) => e.type === 'llm_thinking');
      state.addEvent({
        type: 'tool_start',
        tool: event.data.tool,
        input: event.data.input,
        callId: event.data.callId,
        startTime: Date.now(),
      });
      break;

    case 'tool_call_complete': {
      state.removeToolCall(event.data.callId);
      state.updateTimelineEventByCallId(event.data.callId, (e) => ({
        type: 'tool_complete' as const,
        tool: event.data.tool,
        output: event.data.output,
        duration: event.data.duration,
        callId: event.data.callId,
        timestamp: e.timestamp, // Preserve original timestamp
      }));

      // Check if tool call succeeded (no error in output)
      const isError =
        event.data.output &&
        typeof event.data.output === 'object' &&
        'error' in event.data.output &&
        (event.data.output as { error?: string }).error !== '';

      // Persist tool result as a message (for backend context)
      const toolResultMsg: ToolResultChatMessage = {
        id: `tool-result-${event.data.callId}`,
        type: 'tool_result',
        toolName: event.data.tool,
        toolCallId: event.data.callId,
        input: event.data.input,
        output: event.data.output,
        duration: event.data.duration,
        success: !isError,
        timestamp: new Date(),
      };

      // Debug: Log editWorkflow tool results
      if (event.data.tool === 'editWorkflow') {
        console.debug(
          '[Pearl tool_call_complete] editWorkflow raw output:',
          JSON.stringify(event.data.output, null, 2)?.substring(0, 500)
        );
        console.debug('[Pearl tool_call_complete] success:', !isError);
      }

      state.addMessage(toolResultMsg);
      break;
    }

    case 'think': {
      const thinkingContent = event.data.content;
      if (thinkingContent) {
        state.addEvent({
          type: 'think',
          content: thinkingContent,
        });
      }
      break;
    }

    case 'token':
      state.appendToLastTokenOrAdd(event.data.content);
      break;

    case 'coffee_clarification': {
      const data = event.data as { questions: ClarificationQuestion[] };
      const clarificationMsg: ClarificationRequestMessage = {
        id: `clarification-${Date.now()}`,
        type: 'clarification_request',
        questions: data.questions,
        timestamp: new Date(),
      };
      state.addMessage(clarificationMsg);
      break;
    }

    case 'coffee_request_context': {
      const data = event.data as CoffeeRequestExternalContextEvent;
      const contextMsg: ContextRequestMessage = {
        id: `context-${Date.now()}`,
        type: 'context_request',
        request: data,
        timestamp: new Date(),
      };
      state.addMessage(contextMsg);
      break;
    }

    case 'coffee_plan': {
      const data = event.data as CoffeePlanEvent;
      const planMsg: PlanChatMessage = {
        id: `plan-${Date.now()}`,
        type: 'plan',
        plan: data,
        timestamp: new Date(),
      };
      state.addMessage(planMsg);
      break;
    }

    // Generation-specific events (unified from generationEventsStore)
    case 'generation_complete': {
      const data = event.data;
      const summary = data.summary || 'Workflow generated successfully';
      const generatedCode = data.generatedCode || '';

      // Add generation_complete event to the timeline
      state.addEvent({
        type: 'generation_complete',
        summary,
        code: generatedCode,
      });

      // Add assistant message with the summary
      const assistantMessage: AssistantChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I've generated your workflow:\n\n${summary}`,
        resultType: 'answer',
        timestamp: new Date(),
      };
      state.addMessage(assistantMessage);

      // Mark generation as complete
      state.setGenerationCompleted(true);

      // Call the callback from store (for editor update, query refetch, etc.)
      state.onGenerationComplete?.({
        generatedCode,
        summary,
        bubbleParameters: data.bubbleParameters,
      });
      break;
    }

    case 'retry_attempt': {
      const data = event.data;
      state.addEvent({
        type: 'retry_attempt',
        attempt: data.attempt,
        maxRetries: data.maxRetries,
        delay: data.delay,
      });
      break;
    }

    case 'error': {
      // Handle error event - add error display event
      const errorMessage =
        'data' in event && event.data && typeof event.data === 'object'
          ? (event.data as { error?: string }).error || 'An error occurred'
          : 'An error occurred';
      state.addEvent({
        type: 'generation_error',
        message: errorMessage,
      });
      state.setGenerationCompleted(true);
      break;
    }

    case 'complete':
    case 'coffee_complete':
    case 'heartbeat':
    case 'stream_complete':
      // Ignore these events - they're control signals, not display events
      break;
  }
}

/**
 * Main hook - combines store state with mutation and provides simple API
 */
export function usePearlChatStore(flowId: number | null) {
  const { editor } = useEditor();
  const bubbleDetail = useBubbleDetail(flowId);
  const store = getPearlChatStore(flowId ?? -1);

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

      const messageContent = result.message || '';
      let effectiveResultType = result.type;
      let code: string | undefined;
      let bubbleParameters: Record<string, ParsedBubbleWithInfo> | undefined;

      // Check tool call results for editWorkflow — extract code from last successful edit
      // Tool output shape: { data: { mergedCode, applied, validationResult } }
      // Only scan within the current turn (after the last user message)
      const messages = storeState.messages;
      console.debug(
        '[Pearl onSuccess] Backend result type:',
        result.type,
        'messages:',
        messages.length
      );

      // Find the last user message = start of current turn
      let turnStartIndex = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === 'user') {
          turnStartIndex = i;
          break;
        }
      }

      for (let i = messages.length - 1; i > turnStartIndex; i--) {
        const msg = messages[i];
        if (
          msg.type === 'tool_result' &&
          msg.toolName === 'editWorkflow' &&
          msg.success
        ) {
          // Tool returns { data: { mergedCode, applied, validationResult } }
          const rawOutput = msg.output as {
            data?: {
              mergedCode?: string;
              applied?: boolean;
              validationResult?: {
                valid: boolean;
                bubbleParameters?: Record<string, ParsedBubbleWithInfo>;
                inputSchema?: Record<string, unknown>;
                requiredCredentials?: Record<string, unknown>;
              };
            };
          };
          const editData = rawOutput?.data;
          console.debug('[Pearl onSuccess] editWorkflow output:', {
            hasData: !!editData,
            hasMergedCode: !!editData?.mergedCode,
            applied: editData?.applied,
            valid: editData?.validationResult?.valid,
            hasBubbleParams: !!editData?.validationResult?.bubbleParameters,
          });
          if (editData?.mergedCode && editData?.applied) {
            code = editData.mergedCode;
            effectiveResultType = 'code';
            if (editData.validationResult?.bubbleParameters) {
              bubbleParameters = editData.validationResult
                .bubbleParameters as Record<string, ParsedBubbleWithInfo>;
            }
            console.debug(
              '[Pearl onSuccess] Extracted code edit, resultType -> code'
            );
            break; // Take the last successful edit
          }
        }
      }

      console.debug('[Pearl onSuccess] Final:', {
        effectiveResultType,
        hasCode: !!code,
        hasBubbleParams: !!bubbleParameters,
      });

      const assistantMessage: AssistantChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: messageContent,
        code,
        resultType: effectiveResultType,
        timestamp: new Date(),
        bubbleParameters,
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
      const errorMessage: AssistantChatMessage = {
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

  // Subscribe to state
  const timeline = store((s) => s.timeline);
  const messages = store((s) => s.messages);
  const activeToolCallIds = store((s) => s.activeToolCallIds);
  const prompt = store((s) => s.prompt);
  const selectedBubbleContext = store((s) => s.selectedBubbleContext);
  const selectedTransformationContext = store(
    (s) => s.selectedTransformationContext
  );
  const selectedStepContext = store((s) => s.selectedStepContext);
  const coffeeOriginalPrompt = store((s) => s.coffeeOriginalPrompt);
  const coffeeContextCredentials = store((s) => s.coffeeContextCredentials);
  const isCoffeeLoading = store((s) => s.isCoffeeLoading);

  // Generation state (unified from generationEventsStore)
  const isGenerating = store((s) => s.isGenerating);
  const generationCompleted = store((s) => s.generationCompleted);

  // Derive pending state from messages
  const pendingClarification = getPendingClarificationRequest(messages);
  const pendingContextRequest = getPendingContextRequest(messages);
  const pendingPlan = getPendingPlan(messages);

  // ===== Main Generation Function =====
  const startGeneration = (
    promptText: string,
    uploadedFiles: Array<{
      name: string;
      content: string;
      fileType: 'image' | 'text';
    }> = []
  ) => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    let userContent = promptText.trim();

    if (storeState.selectedBubbleContext.length > 0) {
      const bubbleContextText = storeState.selectedBubbleContext
        .map((variableId) => {
          const bubbleInfo = bubbleDetail.getBubbleInfo(variableId);
          const variableName =
            bubbleInfo?.variableName || `Bubble ${variableId}`;
          return `For the selected bubble: ${variableName}, please do the following: \n `;
        })
        .join(', ');

      userContent = `${bubbleContextText}${userContent ? '\n\n' + userContent : ''}`;
    } else if (storeState.selectedStepContext) {
      const stepContextText = `For the selected step: ${storeState.selectedStepContext}, please do the following: \n `;
      userContent = `${stepContextText}${userContent ? '\n\n' + userContent : ''}`;
    } else if (storeState.selectedTransformationContext) {
      const transformationContextText = `For the selected transformation function: ${storeState.selectedTransformationContext}, please do the following: \n `;
      userContent = `${transformationContextText}${userContent ? '\n\n' + userContent : ''}`;
    }

    if (uploadedFiles.length > 0) {
      const fileInfo = uploadedFiles
        .map((f) => {
          const fileType = f.fileType === 'image' ? 'image (base64)' : 'text';
          return `${f.name} (${fileType})`;
        })
        .join(', ');

      userContent = userContent
        ? `${userContent}\n\n[Attached files: ${fileInfo}]`
        : `[Processing attached files: ${fileInfo}]`;
    }

    const userMessage: UserChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    storeState.addMessage(userMessage);
    storeState.clearToolCalls();
    storeState.clearPrompt();

    const conversationMessages = messagesToConversationHistory(
      storeState.messages
    );

    const context = buildAdditionalContext(flowId, bubbleDetail);
    const fullCode = editor?.getCode() || '';

    trackAIAssistant({
      action: 'send_message',
      message: userMessage.content,
    });

    pearlMutation.mutate({
      userRequest: userMessage.content,
      userName: 'User',
      conversationHistory: conversationMessages,
      availableVariables: [],
      currentCode: fullCode,
      model: PEARL_DEFAULT_MODEL,
      additionalContext: context,
      uploadedFiles: uploadedFiles,
    });
  };

  // ===== Coffee Planning =====
  const startCoffeePlanning = useCallback(
    async (promptText: string) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      storeState.setIsCoffeeLoading(true);
      storeState.setCoffeeOriginalPrompt(promptText);

      // Add user message
      const userMessage: UserChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: promptText,
        timestamp: new Date(),
      };
      storeState.addMessage(userMessage);

      // Get updated state after adding the user message
      const updatedState = store.getState();
      // Debug: Log all messages being sent to backend
      try {
        const response = await api.postStream(
          '/bubble-flow/generate?phase=planning',
          {
            prompt: promptText,
            flowId,
            messages: updatedState.messages.map(toBackendMessage),
          }
        );

        for await (const event of sseToAsyncIterable(response)) {
          handleStreamingEvent(event as StreamingEvent, store);
        }
      } catch (error) {
        console.error('[Coffee] Planning error:', error);
      } finally {
        storeState.setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  // ===== Submit Clarification Answers =====
  const submitClarificationAnswers = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      const pending = getPendingClarificationRequest(storeState.messages);

      // Add response message
      const responseMsg: ClarificationResponseMessage = {
        id: `clarification-response-${Date.now()}`,
        type: 'clarification_response',
        answers,
        originalQuestions: pending?.questions,
        timestamp: new Date(),
      };
      storeState.addMessage(responseMsg);
      storeState.setIsCoffeeLoading(true);

      // Get updated state after adding the clarification response message
      const updatedState = store.getState();

      try {
        const response = await api.postStream(
          '/bubble-flow/generate?phase=planning',
          {
            prompt: updatedState.coffeeOriginalPrompt || '',
            flowId,
            messages: updatedState.messages.map(toBackendMessage),
          }
        );

        for await (const event of sseToAsyncIterable(response)) {
          handleStreamingEvent(event as StreamingEvent, store);
        }
      } catch (error) {
        console.error('[Coffee] Submit answers error:', error);
      } finally {
        storeState.setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  // ===== Submit Context =====
  const submitContext = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const pending = getPendingContextRequest(storeState.messages);
    const credentials = storeState.coffeeContextCredentials;

    if (!pending) return;

    storeState.setIsCoffeeLoading(true);

    try {
      // Execute context flow
      const result = (await api.post('/bubble-flow/generate/run-context-flow', {
        flowCode: pending.request.flowCode,
        credentials,
      })) as { success: boolean; result?: unknown; error?: string };

      // Add response message (include originalRequest with flowCode for context)
      const responseMsg: ContextResponseMessage = {
        id: `context-response-${Date.now()}`,
        type: 'context_response',
        answer: {
          flowId: pending.request.flowId,
          status: result.success ? 'success' : 'error',
          result: result.result,
          error: result.error,
          originalRequest: pending.request,
        },
        credentialTypes: Object.keys(credentials),
        timestamp: new Date(),
      };
      storeState.addMessage(responseMsg);
      storeState.clearCoffeeContextCredentials();

      // Get updated state after adding the context response message
      const updatedState = store.getState();

      // Continue planning with context
      const response = await api.postStream(
        '/bubble-flow/generate?phase=planning',
        {
          prompt: updatedState.coffeeOriginalPrompt || '',
          flowId,
          messages: updatedState.messages.map(toBackendMessage),
        }
      );

      for await (const event of sseToAsyncIterable(response)) {
        handleStreamingEvent(event as StreamingEvent, store);
      }
    } catch (error) {
      console.error('[Coffee] Context submission error:', error);
    } finally {
      storeState.setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  // ===== Reject Context =====
  const rejectContext = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const pending = getPendingContextRequest(storeState.messages);

    if (!pending) return;

    // Add rejection response (include originalRequest with flowCode for context)
    const responseMsg: ContextResponseMessage = {
      id: `context-response-${Date.now()}`,
      type: 'context_response',
      answer: {
        flowId: pending.request.flowId,
        status: 'rejected',
        originalRequest: pending.request,
      },
      timestamp: new Date(),
    };
    storeState.addMessage(responseMsg);
    storeState.setIsCoffeeLoading(true);

    // Get updated state after adding the context rejection message
    const updatedState = store.getState();

    try {
      const response = await api.postStream(
        '/bubble-flow/generate?phase=planning',
        {
          prompt: updatedState.coffeeOriginalPrompt || '',
          flowId,
          messages: updatedState.messages.map(toBackendMessage),
        }
      );

      for await (const event of sseToAsyncIterable(response)) {
        handleStreamingEvent(event as StreamingEvent, store);
      }
    } catch (error) {
      console.error('[Coffee] Context rejection error:', error);
    } finally {
      storeState.setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  // ===== Approve Plan =====
  const approvePlanAndBuild = useCallback(
    async (comment?: string) => {
      if (!store || !flowId) return;

      const storeState = store.getState();
      const pending = getPendingPlan(storeState.messages);

      if (!pending) return;

      // Add approval message
      const approvalMsg: PlanApprovalMessage = {
        id: `plan-approval-${Date.now()}`,
        type: 'plan_approval',
        approved: true,
        comment,
        timestamp: new Date(),
      };
      storeState.addMessage(approvalMsg);
      storeState.setIsCoffeeLoading(true);

      // Get updated state after adding the plan approval message
      const updatedState = store.getState();

      try {
        const response = await api.postStream(
          '/bubble-flow/generate?phase=building',
          {
            prompt: updatedState.coffeeOriginalPrompt || '',
            flowId,
            messages: updatedState.messages.map(toBackendMessage),
          }
        );

        for await (const event of sseToAsyncIterable(response)) {
          handleStreamingEvent(event as StreamingEvent, store);
        }
      } catch (error) {
        console.error('[Coffee] Build error:', error);
      } finally {
        storeState.setIsCoffeeLoading(false);
      }
    },
    [store, flowId]
  );

  // ===== Skip Coffee =====
  const skipCoffeeAndBuild = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!originalPrompt) return;

    storeState.setIsCoffeeLoading(true);

    try {
      const response = await api.postStream(
        '/bubble-flow/generate?phase=building',
        {
          prompt: originalPrompt,
          flowId,
          messages: storeState.messages.map(toBackendMessage),
        }
      );

      for await (const event of sseToAsyncIterable(response)) {
        handleStreamingEvent(event as StreamingEvent, store);
      }
    } catch (error) {
      console.error('[Coffee] Skip and build error:', error);
    } finally {
      storeState.setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  // ===== Retry After Error =====
  const retryAfterError = useCallback(async () => {
    if (!store || !flowId) return;

    const storeState = store.getState();
    const originalPrompt = storeState.coffeeOriginalPrompt;

    if (!originalPrompt) {
      console.error('[Coffee] No original prompt to retry');
      return;
    }

    // Get error events from the timeline to include as context
    const errorEvents = storeState.timeline
      .filter(
        (item): item is { kind: 'event'; data: DisplayEvent } =>
          item.kind === 'event' && item.data.type === 'generation_error'
      )
      .map((item) => item.data);
    const errorContext = errorEvents
      .map((e) => (e.type === 'generation_error' ? e.message : ''))
      .filter(Boolean)
      .join('\n');

    // Add a system message with the error context
    const retryMessage: SystemChatMessage = {
      id: `retry-${Date.now()}`,
      type: 'system',
      content: `[Previous attempt failed with error: ${errorContext}]\n\nPlease try generating the response again.`,
      timestamp: new Date(),
    };
    storeState.addMessage(retryMessage);

    storeState.setIsCoffeeLoading(true);
    storeState.setGenerationCompleted(false);

    // Get updated state after adding the retry message
    const updatedState = store.getState();

    try {
      const response = await api.postStream(
        '/bubble-flow/generate?phase=planning',
        {
          prompt: originalPrompt,
          flowId,
          messages: updatedState.messages.map(toBackendMessage),
        }
      );

      for await (const event of sseToAsyncIterable(response)) {
        handleStreamingEvent(event as StreamingEvent, store);
      }
    } catch (error) {
      console.error('[Coffee] Retry error:', error);
    } finally {
      storeState.setIsCoffeeLoading(false);
    }
  }, [store, flowId]);

  // ===== Other Actions =====
  const clearMessages = useCallback(() => {
    store?.getState().clearMessages();
  }, [store]);

  const reset = useCallback(() => {
    store?.getState().reset();
  }, [store]);

  const isMutating = useIsMutating({
    mutationKey: ['pearlStream', flowId ?? -1],
  });
  const isPending = isMutating > 0;

  const setPrompt = useCallback(
    (newPrompt: string) => {
      store?.getState().setPrompt(newPrompt);
    },
    [store]
  );

  const clearPrompt = useCallback(() => {
    store?.getState().clearPrompt();
  }, [store]);

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

  const addTransformationToContext = useCallback(
    (functionName: string) => {
      store?.getState().addTransformationToContext(functionName);
    },
    [store]
  );

  const clearTransformationContext = useCallback(() => {
    store?.getState().clearTransformationContext();
  }, [store]);

  const addStepToContext = useCallback(
    (functionName: string) => {
      store?.getState().addStepToContext(functionName);
    },
    [store]
  );

  const clearStepContext = useCallback(() => {
    store?.getState().clearStepContext();
  }, [store]);

  const setCoffeeContextCredential = useCallback(
    (credType: CredentialType, credId: number | null) => {
      store?.getState().setCoffeeContextCredential(credType, credId);
    },
    [store]
  );

  return {
    // State
    timeline,
    messages,
    activeToolCallIds,
    prompt,
    selectedBubbleContext,
    selectedTransformationContext,
    selectedStepContext,

    // Derived pending state (from messages)
    pendingClarification,
    pendingContextRequest,
    pendingPlan,

    // Transient Coffee state
    coffeeOriginalPrompt,
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
    setCoffeeContextCredential,
    submitContext,
    rejectContext,
    retryAfterError,

    // Mutation state
    isPending,
    isError: pearlMutation.isError,
    error: pearlMutation.error,
    pearlMutation,

    // Generation state (unified from generationEventsStore)
    isGenerating,
    generationCompleted,
    hasActiveGenerationStream: () =>
      store.getState().hasActiveGenerationStream(),
    cancelGenerationStream: () => store.getState().cancelGenerationStream(),

    // Unified loading state - true when any generation/mutation is in progress
    isLoading: isPending || isGenerating || isCoffeeLoading,
  };
}
