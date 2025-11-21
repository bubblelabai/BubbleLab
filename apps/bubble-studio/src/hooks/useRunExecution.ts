import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getExecutionStore } from '@/stores/executionStore';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useUpdateBubbleFlow } from '@/hooks/useUpdateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useEditor } from '@/hooks/useEditor';
import { cleanupFlattenedKeys } from '@/utils/codeParser';
import {
  SYSTEM_CREDENTIALS,
  validateCredentialSelection,
} from '@bubblelab/shared-schemas';
import type {
  CredentialType,
  StreamingLogEvent,
} from '@bubblelab/shared-schemas';
import { api } from '@/lib/api';
import { findBubbleByVariableId } from '@/utils/bubbleUtils';
import { useSubscription } from '@/hooks/useSubscription';
import { BubbleFlowDetailsResponse } from '@bubblelab/shared-schemas';
import { useUIStore } from '@/stores/uiStore';
import { useLiveOutput } from './useLiveOutput';

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
  const queryClient = useQueryClient();
  const validateCodeMutation = useValidateCode({ flowId });
  const updateBubbleFlowMutation = useUpdateBubbleFlow(flowId);
  const { data: currentFlow } = useBubbleFlow(flowId);
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

      useUIStore.getState().setConsolidatedPanelTab('output');
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
                  selectBubbleInConsole(bubbleId);

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
              options.onBubbleExecution?.(eventData);
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

                  // Extract and store result success status for error styling
                  const result = eventData.additionalData?.result as
                    | { success?: boolean }
                    | undefined;
                  if (result && typeof result.success === 'boolean') {
                    getExecutionStore(flowId).setBubbleResult(
                      bubbleId,
                      result.success
                    );
                    console.log(
                      'Bubble result:',
                      bubbleId,
                      result.success ? '✓' : '✗'
                    );
                  }

                  console.log('Bubble completed:', bubbleId, executionTimeMs);
                }
              }
              options.onBubbleExecutionComplete?.(eventData);
            }

            if (
              eventData.type === 'bubble_parameters_update' &&
              eventData.bubbleParameters
            ) {
              getExecutionStore(flowId).clearHighlighting();
              options.onBubbleParametersUpdate?.();
            }

            if (eventData.type === 'execution_complete') {
              getExecutionStore(flowId).stopExecution();
              // Switch to Results tab and scroll to bottom
              selectResultsInConsole();
              options.onComplete?.();
              return true;
            }

            if (eventData.type === 'stream_complete') {
              getExecutionStore(flowId).stopExecution();
              // Switch to Results tab and scroll to bottom
              selectResultsInConsole();
              options.onComplete?.();
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

              options.onError?.(eventData.message, true, eventData.variableId);
              return true;
            }

            // Handle non-fatal errors
            if (eventData.type === 'error') {
              getExecutionStore(flowId).setError(eventData.message);
              options.onError?.(eventData.message, false);
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
          options.onError?.(errorMessage, true);
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
      options,
      queryClient,
      setExecutionHighlight,
      selectBubbleInConsole,
      selectResultsInConsole,
    ]
  );

  const runFlow = useCallback(
    async (options: RunExecutionOptions = {}) => {
      if (!flowId || !currentFlow) {
        console.error('Cannot execute: No flow ID or flow data');
        return;
      }

      const {
        validateCode = true,
        updateCredentials = true,
        inputs = {},
      } = options;

      // Start execution
      getExecutionStore(flowId).startExecution();

      try {
        // 1. Validate inputs
        const inputValidation = validateInputs(currentFlow);
        if (!inputValidation.isValid) {
          toast.error(
            `Please fill all required inputs: ${inputValidation.reasons.join(', ')}`
          );
          getExecutionStore(flowId).stopExecution();
          return;
        }

        // 2. Validate credentials
        const credentialValidation = validateCredentials(currentFlow);
        if (!credentialValidation.isValid) {
          toast.error(
            `Please select all required credentials: ${credentialValidation.reasons.join(', ')}`
          );
          getExecutionStore(flowId).stopExecution();
          return;
        }

        // 3. Update credentials if needed
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

        // 4. Validate code if needed
        if (validateCode && editor.getCode() !== currentFlow?.code) {
          try {
            const isValid = await validateCodeMutation.mutateAsync({
              code: editor.getCode(),
              flowId: flowId,
              credentials: getExecutionStore(flowId).pendingCredentials,
              syncInputsWithFlow: true,
            });
            if (!isValid) {
              getExecutionStore(flowId).stopExecution();
              return;
            }
            // After validation, bubbleParameters have changed - clear old execution state
            getExecutionStore(flowId).clearHighlighting();
            getExecutionStore(flowId).setBubbleError(null);
          } catch {
            toast.error('Code validation failed');
            getExecutionStore(flowId).stopExecution();
            return;
          }
        }

        // 6. Clean up inputs
        const cleanedInputs = cleanupFlattenedKeys(
          inputs || getExecutionStore(flowId).executionInputs
        );

        // 7. Execute with streaming
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

    if (!currentFlow || !flowId) {
      reasons.push('No flow selected');
      return { isValid: false, reasons };
    }

    const required = currentFlow.requiredCredentials || {};
    const requiredEntries = Object.entries(required) as Array<
      [string, string[]]
    >;

    for (const [bubbleKey, credTypes] of requiredEntries) {
      const selectedForBubble =
        getExecutionStore(flowId).pendingCredentials[bubbleKey] || {};

      const validation = validateCredentialSelection(
        credTypes.map((t) => t as CredentialType),
        selectedForBubble,
        SYSTEM_CREDENTIALS
      );

      if (!validation.isValid) {
        for (const missing of validation.missing) {
          reasons.push(`Missing credential for ${bubbleKey}: ${missing}`);
        }
      }
    }

    return { isValid: reasons.length === 0, reasons };
  };

  const canExecute = () => {
    if (!flowId) {
      return { isValid: false, reasons: ['No flow selected'] };
    }
    const reasons: string[] = [];

    if (!currentFlow) reasons.push('No flow selected');
    if (getExecutionStore(flowId).isRunning) reasons.push('Already executing');
    if (getExecutionStore(flowId).isValidating)
      reasons.push('Currently validating');

    const inputValidation = validateInputs(currentFlow);
    if (!inputValidation.isValid) {
      reasons.push(...inputValidation.reasons);
    }

    if (currentFlow) {
      const credentialValidation = validateCredentials(currentFlow!);
      if (!credentialValidation.isValid) {
        reasons.push(...credentialValidation.reasons);
      }
    }

    return { isValid: reasons.length === 0, reasons };
  };

  const executionStatus = () => {
    if (!currentFlow) {
      return {
        isFormValid: false,
        isCredentialsValid: false,
        isRunnable: false,
      };
    }

    const inputValidation = validateInputs(currentFlow);
    const credentialValidation = validateCredentials(currentFlow);
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
