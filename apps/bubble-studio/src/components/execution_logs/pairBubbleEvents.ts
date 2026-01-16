import type { StreamingLogEvent } from '@bubblelab/shared-schemas';

/**
 * Single execution run (one start + one complete event pair)
 */
export interface ExecutionRun {
  runIndex: number;
  startEvent?: StreamingLogEvent;
  completeEvent?: StreamingLogEvent;
  inputData?: unknown;
  outputData?: unknown;
  executionTime?: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  timestamp: number;
}

/**
 * Paired execution data combining start and complete events
 * Now supports multiple runs of the same bubble
 */
export interface PairedExecution {
  variableId: string;
  bubbleName?: string;
  variableName?: string;
  displayName: string;
  runs: ExecutionRun[];
  errors: StreamingLogEvent[];
  warnings: StreamingLogEvent[];
  allEvents: StreamingLogEvent[];
  // Computed from latest run
  status: 'pending' | 'running' | 'complete' | 'error';
}

/**
 * Pairs bubble_execution and bubble_execution_complete events by variableId
 * Returns unified execution data with input/output together
 * Supports multiple runs of the same bubble with pagination
 */
export function pairBubbleEvents(
  events: StreamingLogEvent[],
  bubbleParameters?: Record<string, unknown>
): PairedExecution[] {
  // Group events by variableId
  const byVariableId = new Map<string, StreamingLogEvent[]>();

  for (const event of events) {
    // Get variableId from event or additionalData
    const directVariableId = (event as { variableId?: number }).variableId;
    const additionalDataVariableId = (
      event.additionalData as { variableId?: number }
    )?.variableId;
    const variableId = String(directVariableId ?? additionalDataVariableId);

    // Skip global events (no variableId) and non-bubble events
    if (!variableId || variableId === 'undefined' || variableId === 'null') {
      continue;
    }

    // Only include bubble-related events
    const bubbleEventTypes = [
      'bubble_execution',
      'bubble_execution_complete',
      'bubble_instantiation',
      'bubble_start',
      'bubble_complete',
      'function_call_start',
      'function_call_complete',
      'error',
      'fatal',
      'warn',
    ];

    if (!bubbleEventTypes.includes(event.type)) {
      continue;
    }

    if (!byVariableId.has(variableId)) {
      byVariableId.set(variableId, []);
    }
    byVariableId.get(variableId)!.push(event);
  }

  // Create paired executions
  const pairedExecutions: PairedExecution[] = [];

  for (const [variableId, varEvents] of byVariableId) {
    // Sort events by timestamp
    const sortedEvents = [...varEvents].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Get bubble name and variable name from first event
    const firstStartEvent = sortedEvents.find(
      (e) => e.type === 'bubble_execution' || e.type === 'function_call_start'
    );
    const bubbleName = (firstStartEvent as { bubbleName?: string })?.bubbleName;
    const variableName = (firstStartEvent as { variableName?: string })
      ?.variableName;
    const functionName = (firstStartEvent as { functionName?: string })
      ?.functionName;

    // Get display name from bubble parameters or use variableName/bubbleName
    let displayName =
      variableName || functionName || bubbleName || `Variable ${variableId}`;
    if (bubbleParameters) {
      const bubbleParam = bubbleParameters[variableId] as
        | { variableName?: string }
        | undefined;
      if (bubbleParam?.variableName) {
        displayName = bubbleParam.variableName;
      }
    }

    // Extract errors and warnings
    const errors = sortedEvents.filter(
      (e) => e.type === 'error' || e.type === 'fatal'
    );
    const warnings = sortedEvents.filter((e) => e.type === 'warn');

    // Group into runs: pair each start with its corresponding complete
    const runs: ExecutionRun[] = [];
    const startEvents = sortedEvents.filter(
      (e) => e.type === 'bubble_execution' || e.type === 'function_call_start'
    );
    const completeEvents = sortedEvents.filter(
      (e) =>
        e.type === 'bubble_execution_complete' ||
        e.type === 'function_call_complete'
    );

    // Match starts with completes by order (each start pairs with next available complete)
    for (let i = 0; i < startEvents.length; i++) {
      const startEvent = startEvents[i];
      const completeEvent = completeEvents[i]; // May be undefined if still running

      // Extract input from start event
      const inputData =
        (startEvent?.additionalData as { parameters?: unknown })?.parameters ||
        (startEvent?.additionalData as { functionInput?: unknown })
          ?.functionInput;

      // Extract output from complete event
      const outputData =
        (completeEvent?.additionalData as { result?: unknown })?.result ||
        (completeEvent?.additionalData as { functionOutput?: unknown })
          ?.functionOutput;

      // Get execution time - check individual duration fields FIRST, before cumulative executionTime
      // Note: executionTime is cumulative (time since flow start), while functionDuration/duration are individual
      const executionTime =
        // Top-level functionDuration (individual time for function_call_complete)
        (completeEvent as { functionDuration?: number })?.functionDuration ||
        // Top-level toolDuration (individual time for tool_call_complete)
        (completeEvent as { toolDuration?: number })?.toolDuration ||
        // In additionalData.duration (individual time for function_call_complete)
        (completeEvent?.additionalData as { duration?: number })?.duration ||
        // In additionalData.executionTime (individual time for bubble_execution_complete)
        (completeEvent?.additionalData as { executionTime?: number })
          ?.executionTime ||
        // Top-level executionTime (CUMULATIVE - last resort fallback)
        (completeEvent as { executionTime?: number })?.executionTime;

      // Determine run status
      let runStatus: ExecutionRun['status'] = 'pending';
      if (completeEvent) {
        const result = (
          completeEvent.additionalData as { result?: { success?: boolean } }
        )?.result;
        if (result && result.success === false) {
          runStatus = 'error';
        } else {
          runStatus = 'complete';
        }
      } else if (startEvent) {
        runStatus = 'running';
      }

      runs.push({
        runIndex: i,
        startEvent,
        completeEvent,
        inputData,
        outputData,
        executionTime,
        status: runStatus,
        timestamp: new Date(startEvent.timestamp).getTime(),
      });
    }

    // If no start events but have complete events, create runs from completes
    if (startEvents.length === 0 && completeEvents.length > 0) {
      for (let i = 0; i < completeEvents.length; i++) {
        const completeEvent = completeEvents[i];
        const outputData = (
          completeEvent?.additionalData as { result?: unknown }
        )?.result;
        // Prioritize individual duration fields over cumulative executionTime
        const executionTime =
          (completeEvent as { functionDuration?: number })?.functionDuration ||
          (completeEvent as { toolDuration?: number })?.toolDuration ||
          (completeEvent?.additionalData as { duration?: number })?.duration ||
          (completeEvent?.additionalData as { executionTime?: number })
            ?.executionTime ||
          (completeEvent as { executionTime?: number })?.executionTime;

        runs.push({
          runIndex: i,
          completeEvent,
          outputData,
          executionTime,
          status: 'complete',
          timestamp: new Date(completeEvent.timestamp).getTime(),
        });
      }
    }

    // Sort runs by timestamp (newest first for pagination)
    runs.sort((a, b) => b.timestamp - a.timestamp);

    // Overall status from latest run
    const latestRun = runs[0];
    let status: PairedExecution['status'] = latestRun?.status || 'pending';
    if (errors.length > 0) {
      status = 'error';
    }

    pairedExecutions.push({
      variableId,
      bubbleName: bubbleName || functionName,
      variableName,
      displayName,
      runs,
      errors,
      warnings,
      allEvents: sortedEvents,
      status,
    });
  }

  // Sort by first event timestamp
  pairedExecutions.sort((a, b) => {
    const aTime = a.allEvents[0]
      ? new Date(a.allEvents[0].timestamp).getTime()
      : 0;
    const bTime = b.allEvents[0]
      ? new Date(b.allEvents[0].timestamp).getTime()
      : 0;
    return aTime - bTime;
  });

  return pairedExecutions;
}
