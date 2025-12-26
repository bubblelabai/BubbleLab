import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getExecutionStore } from '@/stores/executionStore';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useUpdateBubbleFlow } from '@/hooks/useUpdateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useEditor } from '@/hooks/useEditor';
import { cleanupFlattenedKeys } from '@/utils/codeParser';
import { filterEmptyInputs } from '@/utils/inputUtils';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { api } from '@/lib/api';
import { findBubbleByVariableId } from '@/utils/bubbleUtils';
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
          `/bubble-flow/${flowId}/execute-stream`,
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

            // Update store with event
            getExecutionStore(flowId).addEvent(eventData);
            getExecutionStore(flowId).setCurrentLine(
              eventData.lineNumber || null
            );

            // Handle different event types with the logic from App.tsx
            if (eventData.type === 'bubble_execution') {
              if (eventData.variableId) {
                // Always use latest flow from React Query cache to avoid stale closure data
                // This is critical after validation updates bubbleParameters
                const latestFlow =
                  queryClient.getQueryData<BubbleFlowDetailsResponse>([
                    'bubbleFlow',
                    flowId,
                  ]);

                const bubble = findBubbleByVariableId(
                  latestFlow?.bubbleParameters ||
                    currentFlow?.bubbleParameters ||
                    {},
                  eventData.variableId
                );

                if (bubble) {
                  const bubbleId = String(bubble.variableId);

                  // Track this as the last executing bubble in the store
                  getExecutionStore(flowId).setLastExecutingBubble(bubbleId);

                  // Mark bubble as running
                  getExecutionStore(flowId).setBubbleRunning(bubbleId);
                  // Note: We intentionally don't call selectBubbleInConsole here
                  // to avoid jumping the tab on every bubble execution.
                  // Users can watch output stream in without jarring tab switches.

                  // Highlight the line range in the editor (validate line numbers)
                  if (
                    bubble.location.startLine > 0 &&
                    bubble.location.endLine > 0
                  ) {
                    setExecutionHighlight({
                      startLine: bubble.location.startLine,
                      endLine: bubble.location.endLine,
                    });
                  }

                  // Keep highlighting until manually deselected
                }
              }
              optionsRef.current.onBubbleExecution?.(eventData);
            }

            if (eventData.type === 'bubble_execution_complete') {
              if (eventData.variableId) {
                // Always use latest flow from React Query cache to avoid stale closure data
                const latestFlow =
                  queryClient.getQueryData<BubbleFlowDetailsResponse>([
                    'bubbleFlow',
                    flowId,
                  ]);

                const bubble = findBubbleByVariableId(
                  latestFlow?.bubbleParameters ||
                    currentFlow?.bubbleParameters ||
                    {},
                  eventData.variableId
                );

                if (bubble) {
                  const bubbleId = String(bubble.variableId);
                  getExecutionStore(flowId).setLastExecutingBubble(bubbleId);

                  // Mark bubble as completed with execution time
                  const executionTimeMs = eventData.executionTime ?? 0;
                  getExecutionStore(flowId).setBubbleCompleted(
                    bubbleId,
                    executionTimeMs
                  );

                  // Check if the bubble execution failed (result.success === false)
                  const result = eventData.additionalData?.result as
                    | { success?: boolean }
                    | undefined;
                  const success = result?.success !== false; // Default to true if not specified

                  // Update bubble result status in store
                  getExecutionStore(flowId).setBubbleResult(bubbleId, success);

                  // If failed, also mark it in bubbleWithError for error highlighting
                  if (!success) {
                    getExecutionStore(flowId).setBubbleError(bubbleId);
                  }

                  // Jump to this bubble's tab on completion (not on start)
                  // This shows users the output when it's ready, for maximum adrenaline
                  selectBubbleInConsole(bubbleId);
                }
              }
            }

            // Handle function call start events
            if (eventData.type === 'function_call_start') {
              if (eventData.variableId && eventData.functionName) {
                const functionId = String(eventData.variableId);

                // Track this as the last executing bubble in the store
                getExecutionStore(flowId).setLastExecutingBubble(functionId);

                // Mark function call as running
                getExecutionStore(flowId).setBubbleRunning(functionId);
                // Note: We intentionally don't call selectBubbleInConsole here
                // to avoid jumping the tab on every function call.
                // Users can watch output stream in without jarring tab switches.

                // Highlight the line range in the editor if line number is available
                if (eventData.lineNumber && eventData.lineNumber > 0) {
                  setExecutionHighlight({
                    startLine: eventData.lineNumber,
                    endLine: eventData.lineNumber,
                  });
                }
              }
            }

            // Handle function call complete events
            if (eventData.type === 'function_call_complete') {
              if (eventData.variableId && eventData.functionName) {
                const functionId = String(eventData.variableId);
                getExecutionStore(flowId).setLastExecutingBubble(functionId);

                // Mark function call as completed with execution time
                const executionTimeMs =
                  eventData.functionDuration ?? eventData.executionTime ?? 0;
                getExecutionStore(flowId).setBubbleCompleted(
                  functionId,
                  executionTimeMs
                );

                // Check if there was an error (functionOutput might contain error info)
                // For now, we'll assume success unless explicitly marked as error
                // This could be enhanced to check functionOutput for error indicators
                getExecutionStore(flowId).setBubbleResult(functionId, true);

                // Jump to this function's tab on completion (not on start)
                // This shows users the output when it's ready, for maximum adrenaline
                selectBubbleInConsole(functionId);
              }
            }

            if (
              eventData.type === 'bubble_parameters_update' &&
              eventData.bubbleParameters
            ) {
              getExecutionStore(flowId).clearHighlighting();
              optionsRef.current.onBubbleParametersUpdate?.();
            }

            if (eventData.type === 'execution_complete') {
              getExecutionStore(flowId).stopExecution();
              // Switch to Results tab and scroll to bottom
              selectResultsInConsole();
              optionsRef.current.onComplete?.();
              return true;
            }

            if (eventData.type === 'stream_complete') {
              getExecutionStore(flowId).stopExecution();
              // Switch to Results tab and scroll to bottom
              selectResultsInConsole();
              optionsRef.current.onComplete?.();
              return true;
            }

            // Handle fatal errors
            if (eventData.type === 'fatal') {
              getExecutionStore(flowId).setError(eventData.message);
              getExecutionStore(flowId).stopExecution();
              selectResultsInConsole();

              // First try to use the variableId from the error event
              if (eventData.variableId !== undefined) {
                const bubbleId = String(eventData.variableId);
                getExecutionStore(flowId).setBubbleError(bubbleId);
              } else {
                // Fallback to last executing bubble from store
                const storeState = getExecutionStore(flowId);
                const lastExecutingBubble = storeState.lastExecutingBubble;

                if (lastExecutingBubble) {
                  getExecutionStore(flowId).setBubbleError(lastExecutingBubble);
                } else {
                  console.warn(
                    '❌ Fatal error occurred but no bubble ID available'
                  );
                }
              }

              optionsRef.current.onError?.(
                eventData.message,
                true,
                eventData.variableId
              );
              return true;
            }

            // Handle non-fatal errors
            if (eventData.type === 'error') {
              getExecutionStore(flowId).setError(eventData.message);
              optionsRef.current.onError?.(eventData.message, false);
              return false;
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
        // 1. Validate code FIRST if it has changed (this syncs the schema)
        // This ensures we validate inputs against the UPDATED schema
        let flowToValidate = currentFlow;
        if (validateCode && editor.getCode() !== currentFlow?.code) {
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
        const inputValidation = validateInputs(flowId, flowToValidate);
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
          flowToValidate
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

  const validateInputs = (
    currentFlow: BubbleFlowDetailsResponse | undefined
  ) => {
    if (!flowId) {
      return { isValid: false, reasons: ['No flow selected'] };
    }
    const reasons: string[] = [];

    if (!currentFlow) {
      reasons.push('No flow selected');
      return { isValid: false, reasons };
    }
    try {
      let schema = currentFlow.inputSchema;
      if (typeof schema === 'string') {
        schema = JSON.parse(schema);
      }
      const requiredFields: string[] = Array.isArray(schema?.required)
        ? schema.required
        : [];

      requiredFields.forEach((fieldName: string) => {
        if (
          getExecutionStore(flowId).executionInputs[fieldName] === undefined ||
          getExecutionStore(flowId).executionInputs[fieldName] === ''
        ) {
          reasons.push(`Missing required input: ${fieldName}`);
        }
      });
    } catch {
      // If schema parsing fails, assume valid
      return { isValid: true, reasons: [] };
    }

    return { isValid: reasons.length === 0, reasons };
  };

  const validateCredentials = (currentFlow: BubbleFlowDetailsResponse) => {
    const reasons: string[] = [];
    let bubbleVariableId: string | null = null;

    if (!currentFlow || !flowId) {
      reasons.push('No flow selected');
      return { isValid: false, reasons, bubbleVariableId };
    }

    const required = currentFlow.requiredCredentials || {};
    const requiredEntries = Object.entries(required) as Array<
      [string, string[]]
    >;

    for (const [bubbleKey, credTypes] of requiredEntries) {
      for (const credType of credTypes) {
        if (SYSTEM_CREDENTIALS.has(credType as CredentialType)) continue;

        const selectedForBubble =
          getExecutionStore(flowId).pendingCredentials[bubbleKey] || {};
        const selectedId = selectedForBubble[credType];

        if (selectedId === undefined || selectedId === null) {
          reasons.push(`Missing credential for ${bubbleKey}: ${credType}`);

          // Capture the first bubble with missing credentials for navigation
          if (!bubbleVariableId) {
            bubbleVariableId = bubbleKey;
          }
        }
      }
    }

    return { isValid: reasons.length === 0, reasons, bubbleVariableId };
  };

  const canExecute = () => {
    return validateFlow(flowId, currentFlow, {
      checkRunning: true,
      checkValidating: true,
    });
  };

  const executionStatus = () => {
    if (!currentFlow) {
      return {
        isFormValid: false,
        isCredentialsValid: false,
        isRunnable: false,
      };
    }

    const inputValidation = validateInputs(flowId, currentFlow);
    const credentialValidation = validateCredentials(flowId, currentFlow);
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
