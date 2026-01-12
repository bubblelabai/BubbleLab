import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getExecutionStore, ProcessEventResult } from '@/stores/executionStore';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useUpdateBubbleFlow } from '@/hooks/useUpdateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useEditor } from '@/hooks/useEditor';
import { cleanupFlattenedKeys } from '@/utils/codeParser';
import { filterEmptyInputs } from '@/utils/inputUtils';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { api } from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
import { BubbleFlowDetailsResponse } from '@bubblelab/shared-schemas';
import { useUIStore } from '@/stores/uiStore';
import { getLiveOutputStore } from '@/stores/liveOutputStore';
import { useLiveOutput } from './useLiveOutput';
import {
  validateInputs,
  validateCredentials,
  validateFlow,
} from '@/utils/flowValidation';

/**
 * Cutoff date for forcing revalidation of flows.
 * Flows last updated before this date will be revalidated on run
 * to ensure bubble parameters are properly parsed with latest backend changes.
 */
const REVALIDATION_CUTOFF_DATE = new Date('2025-12-28T17:00:00Z');

/**
 * Check if a flow needs revalidation based on its updatedAt date.
 * Returns true if the flow was last updated before the cutoff date.
 */
function needsRevalidationByDate(
  flow: BubbleFlowDetailsResponse | undefined
): boolean {
  if (!flow?.updatedAt) return false;
  const flowUpdatedAt = new Date(flow.updatedAt);
  return flowUpdatedAt < REVALIDATION_CUTOFF_DATE;
}

interface RunExecutionOptions {
  validateCode?: boolean;
  updateCredentials?: boolean;
  inputs?: Record<string, unknown>;
}

interface RunExecutionResult {
  runFlow: (options?: RunExecutionOptions) => Promise<void>;
  isRunning: boolean;
  canExecute: () => { isValid: boolean; reasons: string[] };
  executionStatus: () => {
    isFormValid: boolean;
    isCredentialsValid: boolean;
    isRunnable: boolean;
  };
}

interface UseRunExecutionOptions {
  onComplete?: () => void;
  onError?: (
    error: string,
    isFatal?: boolean,
    errorVariableId?: number
  ) => void;
  onBubbleExecution?: (event: StreamingLogEvent) => void;
  onBubbleExecutionComplete?: (event: StreamingLogEvent) => void;
  onBubbleParametersUpdate?: () => void;
  onFocusBubble?: (bubbleVariableId: string) => void;
}

/**
 * Custom hook that orchestrates flow execution
 *
 * This hook:
 * 1. Manages all execution dependencies (mutations, streams, stores)
 * 2. Provides a clean API for running flows
 * 3. Handles validation, credential updates, and execution
 * 4. Provides execution status and validation methods
 */
export function useRunExecution(
  flowId: number | null,
  options: UseRunExecutionOptions = {}
): RunExecutionResult {
  // Use ref to capture latest options without causing re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const queryClient = useQueryClient();
  const validateCodeMutation = useValidateCode({ flowId });
  const updateBubbleFlowMutation = useUpdateBubbleFlow(flowId);
  const { data: currentFlow, updateDefaultInputs } = useBubbleFlow(flowId);
  const { refetch: refetchSubscriptionStatus } = useSubscription();
  const { setExecutionHighlight, editor } = useEditor(flowId || undefined);
  const { selectBubbleInConsole, selectResultsInConsole } =
    useLiveOutput(flowId);

  // Execute with streaming - merged from useExecutionStream
  const executeWithStreaming = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      if (!flowId) {
        console.error('[useRunExecution] Cannot execute: flowId is null');
        return;
      }

      // Start execution in store
      getExecutionStore(flowId).startExecution();

      // Open output panel and select first tab (index 0) at execution start
      // This gives users the "adrenaline rush" of seeing output stream in from the beginning
      useUIStore.getState().setConsolidatedPanelTab('output');
      // Reset to first tab - when first bubble event comes in, it will appear here
      getLiveOutputStore(flowId)
        ?.getState()
        .setSelectedTab({ kind: 'item', index: 0 });

      const abortController = new AbortController();
      getExecutionStore(flowId).setAbortController(abortController);

      try {
        const response = await api.postStream(
          `/bubble-flow/${flowId}/execute-stream?evalPerformance=true`,
          payload
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body for streaming');
        }

        getExecutionStore(flowId).setConnected(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Robust SSE parsing buffers
        let textBuffer = '';
        let currentDataLines: string[] = [];

        const flushEvent = () => {
          if (currentDataLines.length === 0) return;
          const dataStr = currentDataLines.join('');
          currentDataLines = [];
          try {
            const eventData: StreamingLogEvent = JSON.parse(dataStr);

            console.log('[useRunExecution] received event', eventData.type);

            // Always use latest flow from React Query cache to avoid stale closure data
            // This is critical after validation updates bubbleParameters
            const latestFlow =
              queryClient.getQueryData<BubbleFlowDetailsResponse>([
                'bubbleFlow',
                flowId,
              ]);

            const bubbleParameters =
              latestFlow?.bubbleParameters || currentFlow?.bubbleParameters;

            // Use shared event processor from store
            const result: ProcessEventResult = getExecutionStore(
              flowId
            ).processEvent(eventData, bubbleParameters);

            // Handle UI-specific actions based on event type
            switch (eventData.type) {
              case 'bubble_execution': {
                // Highlight the line range in the editor
                if (result.bubbleId && eventData.variableId) {
                  const bubble = bubbleParameters
                    ? Object.values(bubbleParameters).find(
                        (b) => b.variableId === eventData.variableId
                      )
                    : undefined;
                  if (
                    bubble &&
                    bubble.location.startLine > 0 &&
                    bubble.location.endLine > 0
                  ) {
                    setExecutionHighlight({
                      startLine: bubble.location.startLine,
                      endLine: bubble.location.endLine,
                    });
                  }
                }
                optionsRef.current.onBubbleExecution?.(eventData);
                break;
              }

              case 'bubble_execution_complete': {
                // Jump to this bubble's tab on completion
                if (result.bubbleId) {
                  selectBubbleInConsole(result.bubbleId);
                }
                break;
              }

              case 'function_call_start': {
                // Highlight the line in the editor
                if (eventData.lineNumber && eventData.lineNumber > 0) {
                  setExecutionHighlight({
                    startLine: eventData.lineNumber,
                    endLine: eventData.lineNumber,
                  });
                }
                break;
              }

              case 'function_call_complete': {
                // Jump to this function's tab on completion
                if (result.bubbleId) {
                  selectBubbleInConsole(result.bubbleId);
                }
                break;
              }

              case 'bubble_parameters_update': {
                optionsRef.current.onBubbleParametersUpdate?.();
                break;
              }

              case 'execution_complete': {
                // Switch to Results tab
                selectResultsInConsole();
                break;
              }

              case 'stream_complete': {
                // This is the final event - stop execution
                getExecutionStore(flowId).stopExecution();
                selectResultsInConsole();
                optionsRef.current.onComplete?.();
                return true;
              }

              case 'fatal': {
                selectResultsInConsole();
                optionsRef.current.onError?.(
                  eventData.message,
                  true,
                  eventData.variableId
                );
                break;
              }

              case 'error': {
                optionsRef.current.onError?.(eventData.message, false);
                break;
              }
            }
          } catch (parseError) {
            console.error('Failed to parse SSE data:', parseError, dataStr);
          }
          return false;
        };

        // SSE parsing loop
        while (true) {
          const { done, value } = await reader.read();

          if (done || abortController.signal.aborted) {
            flushEvent();
            break;
          }

          textBuffer += decoder.decode(value, { stream: true });
          const lines = textBuffer.split(/\r?\n/);
          textBuffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line === '') {
              const shouldStop = flushEvent();
              if (shouldStop) return;
              continue;
            }

            if (line.startsWith('event:')) {
              line.substring(6).trim();
              continue;
            }

            if (line.startsWith('data:')) {
              const after = line.substring(5);
              const content = after.startsWith(' ')
                ? after.substring(1)
                : after;
              currentDataLines.push(content);
              continue;
            }
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          getExecutionStore(flowId).setError(errorMessage);
          getExecutionStore(flowId).stopExecution();
          optionsRef.current.onError?.(errorMessage, true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          getExecutionStore(flowId).stopExecution();
        }
      }
    },
    [
      flowId,
      currentFlow,
      queryClient,
      setExecutionHighlight,
      selectBubbleInConsole,
      selectResultsInConsole,
    ]
  );

  const runFlow = useCallback(
    async (runFlowOptions: RunExecutionOptions = {}) => {
      if (!flowId || !currentFlow) {
        console.error('Cannot execute: No flow ID or flow data');
        return;
      }

      const {
        validateCode = true,
        updateCredentials = true,
        inputs = {},
      } = runFlowOptions;

      // Start execution
      getExecutionStore(flowId).startExecution();

      try {
        // 1. Validate code FIRST if it has changed OR flow needs revalidation (this syncs the schema)
        // This ensures we validate inputs against the UPDATED schema
        // Also revalidate flows that haven't been updated since backend parsing changes
        let flowToValidate = currentFlow;
        const codeChanged = editor.getCode() !== currentFlow?.code;
        const needsDateRevalidation = needsRevalidationByDate(currentFlow);
        if (validateCode && (codeChanged || needsDateRevalidation)) {
          try {
            const validationResult = await validateCodeMutation.mutateAsync({
              code: editor.getCode(),
              flowId: flowId,
              credentials: getExecutionStore(flowId).pendingCredentials,
              syncInputsWithFlow: true,
            });
            if (!validationResult || !validationResult.valid) {
              getExecutionStore(flowId).stopExecution();
              return;
            }
            // After validation, bubbleParameters have changed - clear old execution state
            getExecutionStore(flowId).clearHighlighting();
            getExecutionStore(flowId).setBubbleError(null);

            // Get the UPDATED flow from cache (schema is now synced)
            const updatedFlow =
              queryClient.getQueryData<BubbleFlowDetailsResponse>([
                'bubbleFlow',
                flowId,
              ]);
            if (updatedFlow) {
              flowToValidate = updatedFlow;
            }
          } catch {
            toast.error('Code validation failed');
            getExecutionStore(flowId).stopExecution();
            return;
          }
        }

        // 2. Validate inputs against the UPDATED schema (after code sync)
        const inputValidation = validateInputs(
          flowId,
          flowToValidate,
          inputs || getExecutionStore(flowId).executionInputs
        );
        if (!inputValidation.isValid) {
          toast.error(
            `Please fill all required inputs: ${inputValidation.reasons.join(', ')}`
          );
          getExecutionStore(flowId).stopExecution();
          return;
        }

        // 3. Validate credentials
        const credentialValidation = validateCredentials(
          flowId,
          flowToValidate,
          getExecutionStore(flowId).pendingCredentials
        );
        if (!credentialValidation.isValid) {
          toast.error(
            `Please select all required credentials: ${credentialValidation.reasons.join(', ')}`
          );
          getExecutionStore(flowId).stopExecution();

          // Navigate to the bubble with missing credential (using ref to get latest callback)
          if (
            credentialValidation.bubbleVariableId &&
            optionsRef.current.onFocusBubble
          ) {
            optionsRef.current.onFocusBubble(
              credentialValidation.bubbleVariableId
            );
          }

          return;
        }

        // 4. Update credentials if needed
        if (
          updateCredentials &&
          Object.keys(getExecutionStore(flowId).pendingCredentials).length > 0
        ) {
          try {
            await updateBubbleFlowMutation.mutateAsync({
              flowId,
              credentials: getExecutionStore(flowId).pendingCredentials,
            });
          } catch {
            toast.error('Failed to update credentials');
            getExecutionStore(flowId).stopExecution();
            return;
          }
        }

        // 6. Clean up inputs
        const cleanedInputs = cleanupFlattenedKeys(
          inputs || getExecutionStore(flowId).executionInputs
        );

        // 7. Optimistically update defaultInputs at the beginning of execution
        // Filter out empty values to match backend behavior
        const filteredInputs = filterEmptyInputs(cleanedInputs);
        if (Object.keys(filteredInputs).length > 0) {
          updateDefaultInputs(filteredInputs);
        }

        // 8. Execute with streaming
        await executeWithStreaming(cleanedInputs);
        refetchSubscriptionStatus();
        // Invalidate all execution history queries to ensure all pages are updated
        queryClient.invalidateQueries({
          queryKey: ['executionHistory', flowId],
        });
      } catch (error) {
        console.error('Error executing flow:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Execution failed: ${errorMessage}`);
        getExecutionStore(flowId).stopExecution();
        throw error;
      }
    },
    [
      flowId,
      currentFlow,
      validateCodeMutation,
      updateBubbleFlowMutation,
      executeWithStreaming,
      setExecutionHighlight,
      queryClient,
      refetchSubscriptionStatus,
      editor,
      updateDefaultInputs,
    ]
  );

  const canExecute = () => {
    return validateFlow(flowId, currentFlow, {
      checkRunning: true,
      checkValidating: true,
    });
  };

  const executionStatus = () => {
    if (!currentFlow || !flowId) {
      return {
        isFormValid: false,
        isCredentialsValid: false,
        isRunnable: false,
      };
    }

    const inputValidation = validateInputs(
      flowId,
      currentFlow,
      getExecutionStore(flowId).executionInputs
    );
    const credentialValidation = validateCredentials(
      flowId,
      currentFlow,
      getExecutionStore(flowId).pendingCredentials
    );
    const canExecuteResult = canExecute();

    return {
      isFormValid: inputValidation.isValid,
      isCredentialsValid: credentialValidation.isValid,
      isRunnable: canExecuteResult.isValid,
    };
  };

  return {
    runFlow,
    isRunning: getExecutionStore(flowId || -1).isRunning,
    canExecute,
    executionStatus,
  };
}
