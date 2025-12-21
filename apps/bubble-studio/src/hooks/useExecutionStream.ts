import { useCallback, useEffect } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { api } from '../lib/api';
import { useExecutionStore } from '../stores/executionStore';

/**
 * Hook options for execution streaming
 */
interface UseExecutionStreamOptions {
  onEvent?: (event: StreamingLogEvent) => void;
  onError?: (
    error: string,
    isFatal?: boolean,
    errorVariableId?: number
  ) => void;
  onComplete?: () => void;
  onBubbleExecution?: (event: StreamingLogEvent) => void;
  onBubbleExecutionComplete?: (event: StreamingLogEvent) => void;
  onBubbleParametersUpdate?: (
    bubbleParameters: Record<number, unknown>
  ) => void;
}

/**
 * Flow-scoped execution streaming hook
 *
 * Syncs streaming events to the ExecutionStore for the given flowId
 *
 * @param flowId - The flow to execute
 * @param options - Callbacks for handling events
 *
 * @example
 * const { executeWithStreaming, stopExecution } = useExecutionStream(flowId, {
 *   onComplete: () => toast.success('Done!'),
 *   onError: (error) => toast.error(error),
 * });
 *
 * await executeWithStreaming(executionInputs);
 */
export function useExecutionStream(
  flowId: number | null,
  options: UseExecutionStreamOptions = {}
) {
  const executionState = useExecutionStore(flowId);

  // Cleanup on unmount or flowId change
  useEffect(() => {
    return () => {
      if (flowId) {
        executionState.stopExecution();
      }
    };
  }, [flowId, executionState.startExecution]);

  const executeWithStreaming = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      if (!flowId) {
        console.error('[useExecutionStream] Cannot execute: flowId is null');
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
          const dataStr = currentDataLines.join(''); // per SSE spec, concatenate lines
          currentDataLines = [];
          try {
            const eventData: StreamingLogEvent = JSON.parse(dataStr);

            // Update store with event
            executionState.addEvent(eventData);
            executionState.setCurrentLine(eventData.lineNumber || null);

            // Trigger callback
            options.onEvent?.(eventData);

            if (eventData.type === 'bubble_execution') {
              options.onBubbleExecution?.(eventData);
            }

            if (eventData.type === 'bubble_execution_complete') {
              options.onBubbleExecutionComplete?.(eventData);
            }

            if (
              eventData.type === 'bubble_parameters_update' &&
              eventData.bubbleParameters
            ) {
              options.onBubbleParametersUpdate?.(eventData.bubbleParameters);
            }

            if (eventData.type === 'execution_complete') {
              executionState.stopExecution();
              options.onComplete?.();
              return true;
            }

            if (eventData.type === 'stream_complete') {
              executionState.stopExecution();
              options.onComplete?.();
              return true;
            }

            // Handle fatal errors - these should stop the stream
            if (eventData.type === 'fatal') {
              executionState.setError(eventData.message);
              executionState.stopExecution();
              // Pass the variableId from the fatal event if available
              options.onError?.(eventData.message, true, eventData.variableId);
              return true;
            }

            // Handle non-fatal errors - log them but DO NOT stop execution
            // Individual bubble failures should not halt the entire flow
            if (eventData.type === 'error') {
              executionState.setError(eventData.message);
              options.onError?.(eventData.message, false);

              // Don't stop the stream - continue processing events
              return false;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE data:', parseError, dataStr);
          }
          return false;
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done || abortController.signal.aborted) {
            // Flush any pending event if the stream ends
            flushEvent();
            break;
          }

          textBuffer += decoder.decode(value, { stream: true });

          // Normalize line breaks and process complete lines only
          const lines = textBuffer.split(/\r?\n/);
          // Keep the last line in buffer if it's incomplete (no trailing newline)
          textBuffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line === '') {
              // Empty line denotes end of an SSE event
              const shouldStop = flushEvent();
              if (shouldStop) return;
              continue;
            }

            if (line.startsWith('event:')) {
              // Event name is parsed but not used in current implementation
              line.substring(6).trim();
              continue;
            }

            if (line.startsWith('data:')) {
              // Preserve everything after the first colon and optional space
              const after = line.substring(5);
              const content = after.startsWith(' ')
                ? after.substring(1)
                : after;
              currentDataLines.push(content);
              continue;
            }

            // Ignore other fields like id:, retry:, etc.
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          executionState.setError(errorMessage);
          executionState.stopExecution();
          // Catch errors are treated as fatal
          options.onError?.(errorMessage, true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          executionState.stopExecution();
        }
      }
    },
    [flowId, executionState, options]
  );

  const stopExecution = useCallback(() => {
    executionState.stopExecution();
  }, [executionState]);

  const clearEvents = useCallback(() => {
    executionState.clearEvents();
  }, [executionState]);

  const getExecutionStats = useCallback(() => {
    const { events } = executionState;

    let totalTime = 0;
    let memoryUsage = 0;
    let linesExecuted = 0;
    let bubblesProcessed = 0;

    for (const event of events) {
      if (event.executionTime) {
        totalTime = Math.max(totalTime, event.executionTime);
      }
      if (event.memoryUsage) {
        memoryUsage = Math.max(memoryUsage, event.memoryUsage);
      }
      if (event.type === 'log_line') {
        linesExecuted++;
      }
      if (
        event.type === 'bubble_complete' ||
        event.type === 'bubble_execution' ||
        event.type === 'bubble_execution_complete'
      ) {
        bubblesProcessed++;
      }
    }

    return {
      totalTime,
      memoryUsage,
      linesExecuted,
      bubblesProcessed,
    };
  }, [executionState.events]);

  return {
    // Return state from store (not local state)
    state: {
      isExecuting: executionState.isRunning,
      isConnected: executionState.isConnected,
      error: executionState.error,
      events: executionState.events,
      currentLine: executionState.currentLine,
    },
    executeWithStreaming,
    stopExecution,
    clearEvents,
    getExecutionStats,
  };
}
