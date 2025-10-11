import { useState, useCallback, useRef } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { api } from '../lib/api';

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

interface ExecutionStreamState {
  isExecuting: boolean;
  isConnected: boolean;
  error: string | null;
  events: StreamingLogEvent[];
  currentLine: number | null;
}

export function useExecutionStream(options: UseExecutionStreamOptions = {}) {
  const [state, setState] = useState<ExecutionStreamState>({
    isExecuting: false,
    isConnected: false,
    error: null,
    events: [],
    currentLine: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const executeWithStreaming = useCallback(
    async (bubbleFlowId: number, payload: Record<string, unknown> = {}) => {
      // Cleanup any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState((prev) => ({
        ...prev,
        isExecuting: true,
        isConnected: false,
        error: null,
        events: [],
        currentLine: null,
      }));

      try {
        const response = await api.postStream(
          `/bubble-flow/${bubbleFlowId}/execute-stream`,
          payload
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body for streaming');
        }

        setState((prev) => ({ ...prev, isConnected: true }));

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

            setState((prev) => ({
              ...prev,
              events: [...prev.events, eventData],
              currentLine: eventData.lineNumber || prev.currentLine,
            }));

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
              setState((prev) => ({
                ...prev,
                isExecuting: false,
                currentLine: null,
              }));
              options.onComplete?.();
              return true;
            }

            if (eventData.type === 'stream_complete') {
              setState((prev) => ({
                ...prev,
                isExecuting: false,
                isConnected: false,
                currentLine: null,
              }));
              options.onComplete?.();
              return true;
            }

            // Handle fatal errors - these should stop the stream
            if (eventData.type === 'fatal') {
              setState((prev) => ({
                ...prev,
                error: eventData.message,
                isExecuting: false,
                currentLine: null,
              }));
              // Pass the variableId from the fatal event if available
              options.onError?.(eventData.message, true, eventData.variableId);
              return true;
            }

            // Handle non-fatal errors - log them but DO NOT stop execution
            // Individual bubble failures should not halt the entire flow
            if (eventData.type === 'error') {
              setState((prev) => ({
                ...prev,
                error: eventData.message,
                // Keep execution running - errors are just logged
              }));

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
          setState((prev) => ({
            ...prev,
            error: errorMessage,
            isExecuting: false,
            isConnected: false,
            currentLine: null,
          }));
          // Catch errors are treated as fatal
          options.onError?.(errorMessage, true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setState((prev) => ({
            ...prev,
            isExecuting: false,
            isConnected: false,
          }));
        }
      }
    },
    [options]
  );

  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isExecuting: false,
      isConnected: false,
      currentLine: null,
    }));
  }, []);

  const clearEvents = useCallback(() => {
    setState((prev) => ({
      ...prev,
      events: [],
      error: null,
      currentLine: null,
    }));
  }, []);

  const getExecutionStats = useCallback(() => {
    const { events } = state;

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
  }, [state.events]);

  return {
    state,
    executeWithStreaming,
    stopExecution,
    clearEvents,
    getExecutionStats,
  };
}
