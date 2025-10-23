import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useExecutionStore } from '@/stores/executionStore';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useUpdateBubbleFlow } from '@/hooks/useUpdateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { getEditorCode, useEditorStore } from '@/stores/editorStore';
import { cleanupFlattenedKeys } from '@/utils/codeParser';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import type {
  CredentialType,
  StreamingLogEvent,
} from '@bubblelab/shared-schemas';
import { api } from '@/lib/api';
import { findBubbleByVariableId } from '@/utils/bubbleUtils';
import { useSubscription } from '@/hooks/useSubscription';
import { useExecutionHistory } from './useExecutionHistory';

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
  const executionState = useExecutionStore(flowId);
  const validateCodeMutation = useValidateCode({ flowId });
  const updateBubbleFlowMutation = useUpdateBubbleFlow(flowId);
  const { data: currentFlow } = useBubbleFlow(flowId);
  const { refetch: refetchSubscriptionStatus } = useSubscription();
  const { refetch: refetchExecutionHistory } = useExecutionHistory(flowId);
  const { setExecutionHighlight } = useEditorStore();

  // Execute with streaming - merged from useExecutionStream
  const executeWithStreaming = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      if (!flowId) {
        console.error('[useRunExecution] Cannot execute: flowId is null');
        return;
      }

      // Start execution in store
      executionState.startExecution();

      const abortController = new AbortController();
      executionState.setAbortController(abortController);

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

        executionState.setConnected(true);

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
            executionState.addEvent(eventData);
            executionState.setCurrentLine(eventData.lineNumber || null);

            // Handle different event types with the logic from App.tsx
            if (eventData.type === 'bubble_execution') {
              if (eventData.variableId) {
                const bubble = findBubbleByVariableId(
                  currentFlow?.bubbleParameters || {},
                  eventData.variableId
                );
                if (bubble) {
                  const bubbleId = String(bubble.variableId);

                  // Track this as the last executing bubble in the store
                  executionState.setLastExecutingBubble(bubbleId);

                  // Highlight the bubble in the flow
                  executionState.highlightBubble(bubbleId);

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
                const bubble = findBubbleByVariableId(
                  currentFlow?.bubbleParameters || {},
                  eventData.variableId
                );
                if (bubble) {
                  const bubbleId = String(bubble.variableId);
                  executionState.setLastExecutingBubble(bubbleId);

                  // Mark bubble as completed with execution time
                  const executionTimeMs = eventData.executionTime ?? 0;
                  executionState.setBubbleCompleted(bubbleId, executionTimeMs);
                  console.log('Bubble completed:', bubbleId, executionTimeMs);
                }
              }
              refetchExecutionHistory();
              options.onBubbleExecutionComplete?.(eventData);
            }

            if (
              eventData.type === 'bubble_parameters_update' &&
              eventData.bubbleParameters
            ) {
              executionState.clearHighlighting();
              options.onBubbleParametersUpdate?.();
            }

            if (eventData.type === 'execution_complete') {
              executionState.stopExecution();
              options.onComplete?.();
              refetchSubscriptionStatus();
              refetchExecutionHistory();
              return true;
            }

            if (eventData.type === 'stream_complete') {
              executionState.stopExecution();
              refetchSubscriptionStatus();
              refetchExecutionHistory();
              options.onComplete?.();
              return true;
            }

            // Handle fatal errors
            if (eventData.type === 'fatal') {
              executionState.setError(eventData.message);
              executionState.stopExecution();

              // First try to use the variableId from the error event
              if (eventData.variableId !== undefined) {
                const bubbleId = String(eventData.variableId);
                executionState.setBubbleError(bubbleId);
                console.log(
                  '✅ Fatal error detected with variableId, marking bubble:',
                  bubbleId
                );
              } else if (executionState.lastExecutingBubble) {
                // Fallback to last executing bubble from store
                executionState.setBubbleError(
                  executionState.lastExecutingBubble
                );
                console.log(
                  '✅ Fatal error detected, marking last executing bubble:',
                  executionState.lastExecutingBubble
                );
              } else {
                console.warn(
                  '❌ Fatal error occurred but no bubble ID available'
                );
              }

              options.onError?.(eventData.message, true, eventData.variableId);
              return true;
            }

            // Handle non-fatal errors
            if (eventData.type === 'error') {
              executionState.setError(eventData.message);
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
          executionState.setError(errorMessage);
          executionState.stopExecution();
          options.onError?.(errorMessage, true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          executionState.stopExecution();
        }
      }
    },
    [flowId, executionState, currentFlow, options]
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
      executionState.startExecution();

      try {
        // 1. Validate inputs
        const inputValidation = validateInputs(currentFlow);
        if (!inputValidation.isValid) {
          toast.error(
            `Please fill all required inputs: ${inputValidation.reasons.join(', ')}`
          );
          executionState.stopExecution();
          return;
        }

        // 2. Validate credentials
        const credentialValidation = validateCredentials(currentFlow);
        if (!credentialValidation.isValid) {
          toast.error(
            `Please select all required credentials: ${credentialValidation.reasons.join(', ')}`
          );
          executionState.stopExecution();
          return;
        }

        // 3. Update credentials if needed
        if (
          updateCredentials &&
          Object.keys(executionState.pendingCredentials).length > 0
        ) {
          try {
            await updateBubbleFlowMutation.mutateAsync({
              flowId,
              credentials: executionState.pendingCredentials,
            });
          } catch (error) {
            toast.error('Failed to update credentials');
            executionState.stopExecution();
            return;
          }
        }

        // 4. Validate code if needed
        if (validateCode && getEditorCode() !== currentFlow?.code) {
          try {
            const isValid = await validateCodeMutation.mutateAsync({
              code: getEditorCode(),
              flowId: flowId,
              credentials: executionState.pendingCredentials,
            });
            if (!isValid) {
              executionState.stopExecution();
              return;
            }
          } catch (error) {
            toast.error('Code validation failed');
            executionState.stopExecution();
            return;
          }
        }

        // 6. Clean up inputs
        const cleanedInputs = cleanupFlattenedKeys(
          inputs || executionState.executionInputs
        );

        // 7. Execute with streaming
        await executeWithStreaming(cleanedInputs);
      } catch (error) {
        console.error('Error executing flow:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Execution failed: ${errorMessage}`);
        executionState.stopExecution();
        throw error;
      }
    },
    [
      flowId,
      currentFlow,
      executionState,
      validateCodeMutation,
      updateBubbleFlowMutation,
      executeWithStreaming,
    ]
  );

  const validateInputs = (currentFlow: any) => {
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
          executionState.executionInputs[fieldName] === undefined ||
          executionState.executionInputs[fieldName] === ''
        ) {
          reasons.push(`Missing required input: ${fieldName}`);
        }
      });
    } catch (error) {
      // If schema parsing fails, assume valid
      return { isValid: true, reasons: [] };
    }

    return { isValid: reasons.length === 0, reasons };
  };

  const validateCredentials = (currentFlow: any) => {
    const reasons: string[] = [];

    if (!currentFlow) {
      reasons.push('No flow selected');
      return { isValid: false, reasons };
    }

    const required = currentFlow.requiredCredentials || {};
    const requiredEntries = Object.entries(required) as Array<
      [string, string[]]
    >;

    for (const [bubbleKey, credTypes] of requiredEntries) {
      for (const credType of credTypes) {
        if (SYSTEM_CREDENTIALS.has(credType as CredentialType)) continue;

        const selectedForBubble =
          executionState.pendingCredentials[bubbleKey] || {};
        const selectedId = selectedForBubble[credType];

        if (selectedId === undefined || selectedId === null) {
          reasons.push(`Missing credential for ${bubbleKey}: ${credType}`);
        }
      }
    }

    return { isValid: reasons.length === 0, reasons };
  };

  const canExecute = () => {
    const reasons: string[] = [];

    if (!currentFlow) reasons.push('No flow selected');
    if (executionState.isRunning) reasons.push('Already executing');
    if (executionState.isValidating) reasons.push('Currently validating');

    const inputValidation = validateInputs(currentFlow);
    if (!inputValidation.isValid) {
      reasons.push(...inputValidation.reasons);
    }

    const credentialValidation = validateCredentials(currentFlow);
    if (!credentialValidation.isValid) {
      reasons.push(...credentialValidation.reasons);
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
    isRunning: executionState.isRunning,
    canExecute,
    executionStatus,
  };
}
