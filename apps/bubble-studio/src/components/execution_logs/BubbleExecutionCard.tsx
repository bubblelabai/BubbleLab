import { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Clock,
  ArrowDown,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { findLogoForBubble } from '../../lib/integrations';

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

interface BubbleExecutionCardProps {
  execution: PairedExecution;
  renderJson: React.ComponentType<{
    data: unknown;
    flowId?: number | null;
    executionId?: number;
    timestamp?: string;
  }>;
  flowId?: number | null;
  isSelected?: boolean;
  onSelect?: () => void;
  /** Active browser session for live viewing */
  activeBrowserSession?: {
    variableId: string;
    sessionUrl: string;
    sessionId: string;
  } | null;
}

/**
 * BubbleExecutionCard - Unified view showing bubble input and output together
 *
 * Layout: Vertical (top = input, bottom = output) with max heights
 * Pagination: Navigate between multiple runs of the same bubble
 */
export function BubbleExecutionCard({
  execution,
  renderJson: JsonRenderer,
  flowId,
  isSelected = false,
  onSelect,
  activeBrowserSession,
}: BubbleExecutionCardProps) {
  // Current run index for pagination (0 = latest)
  const [currentRunIndex, setCurrentRunIndex] = useState(0);

  const logo = findLogoForBubble({ bubbleName: execution.bubbleName });

  // Get current run (default to first/only run)
  const totalRuns = execution.runs.length;
  const currentRun = execution.runs[currentRunIndex] || execution.runs[0];

  if (!currentRun) {
    return null;
  }

  // Navigation handlers
  const goToPrevRun = () => {
    if (currentRunIndex < totalRuns - 1) {
      setCurrentRunIndex(currentRunIndex + 1);
    }
  };

  const goToNextRun = () => {
    if (currentRunIndex > 0) {
      setCurrentRunIndex(currentRunIndex - 1);
    }
  };

  // Extract data from current run
  const inputParams = currentRun.inputData;
  const outputResult = currentRun.outputData;
  const execTime = currentRun.executionTime;
  const runStatus = currentRun.status;

  // Debug: Check browser session matching
  if (runStatus === 'running') {
    console.log('[BubbleExecutionCard] Session check:', {
      runStatus,
      activeBrowserSession,
      executionVariableId: execution.variableId,
      sessionVariableId: activeBrowserSession?.variableId,
      match: activeBrowserSession?.variableId === execution.variableId,
    });
  }

  // Status styling
  const statusStyles = {
    pending: {
      border: 'border-gray-700/50',
      bg: 'bg-[#0d1117]',
      icon: <div className="w-2 h-2 rounded-full bg-gray-600" />,
      label: 'Pending',
      labelColor: 'text-gray-500',
    },
    running: {
      border: 'border-blue-500/40',
      bg: 'bg-[#0d1117]',
      icon: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
      label: 'Running',
      labelColor: 'text-blue-400',
    },
    complete: {
      border: 'border-emerald-500/30',
      bg: 'bg-[#0d1117]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      label: 'Done',
      labelColor: 'text-emerald-400',
    },
    error: {
      border: 'border-red-500/40',
      bg: 'bg-red-950/20',
      icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
      label: 'Error',
      labelColor: 'text-red-400',
    },
  };

  const style = statusStyles[runStatus];

  // Status gradient backgrounds (matching Results tab)
  const statusGradients = {
    pending: 'bg-[#161b22]',
    running: 'bg-gradient-to-r from-blue-950/30 via-blue-950/10 to-transparent',
    complete:
      'bg-gradient-to-r from-emerald-950/30 via-emerald-950/10 to-transparent',
    error: 'bg-gradient-to-r from-red-950/30 via-red-950/10 to-transparent',
  };

  return (
    <div
      className={`
        rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden transition-all duration-200
        ${isSelected ? 'ring-1 ring-blue-500/50' : ''}
        ${onSelect ? 'cursor-pointer hover:border-gray-500' : ''}
      `}
      onClick={onSelect}
    >
      {/* Header with status gradient */}
      <div
        className={`
        flex items-center gap-3 px-4 py-3 border-b border-[#21262d]
        ${statusGradients[runStatus]}
      `}
      >
        {/* Status Icon */}
        <div
          className={`
          flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
          ${
            runStatus === 'error'
              ? 'bg-red-500/20 ring-1 ring-red-500/30'
              : runStatus === 'running'
                ? 'bg-blue-500/20 ring-1 ring-blue-500/30'
                : runStatus === 'complete'
                  ? 'bg-emerald-500/20 ring-1 ring-emerald-500/30'
                  : 'bg-gray-500/20 ring-1 ring-gray-500/30'
          }
        `}
        >
          {logo ? (
            <img
              src={logo.file}
              alt={`${logo.name} logo`}
              className="w-4 h-4"
              loading="lazy"
            />
          ) : (
            style.icon
          )}
        </div>

        {/* Bubble Name */}
        <div className="flex-1 min-w-0">
          <span
            className={`
            text-sm font-medium truncate block
            ${runStatus === 'error' ? 'text-red-300' : runStatus === 'running' ? 'text-blue-300' : 'text-gray-200'}
          `}
          >
            {execution.displayName}
          </span>
        </div>

        {/* Run Pagination (if multiple runs) */}
        {totalRuns > 1 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-[#0d1117]/50 rounded-md">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevRun();
              }}
              disabled={currentRunIndex >= totalRuns - 1}
              className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous run"
              title="Previous run"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-gray-400 font-mono tabular-nums min-w-[3ch] text-center">
              {totalRuns - currentRunIndex}/{totalRuns}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNextRun();
              }}
              disabled={currentRunIndex <= 0}
              className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next run"
              title="Next run"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Time Badge */}
        {execTime !== undefined && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0d1117]/50 rounded-md">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-mono tabular-nums text-gray-400">
              {execTime < 1000
                ? `${execTime}ms`
                : `${(execTime / 1000).toFixed(2)}s`}
            </span>
          </div>
        )}

        {/* Status Badge */}
        <span
          className={`
          px-2 py-0.5 text-[10px] font-medium rounded border
          ${
            runStatus === 'error'
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : runStatus === 'running'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : runStatus === 'complete'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          }
        `}
        >
          {style.label}
        </span>
      </div>

      {/* Warnings/Errors Badges */}
      {(execution.warnings.length > 0 || execution.errors.length > 0) && (
        <div className="px-4 py-2 border-b border-[#21262d] bg-[#0d1117]/30 flex gap-2">
          {execution.errors.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded border border-red-500/30 flex items-center gap-1.5">
              <XCircle className="w-3 h-3" />
              {execution.errors.length} error
              {execution.errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {execution.warnings.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {execution.warnings.length} warning
              {execution.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Input/Output - Vertical Stack */}
      <div className="flex flex-col">
        {/* Input Section */}
        <div className="p-4 border-b border-[#21262d]/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Input
            </span>
          </div>
          {inputParams ? (
            <div className="rounded-lg border border-[#30363d] bg-[#0d1117]/50 overflow-hidden">
              <pre className="json-output text-xs p-4 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto max-h-[40vh] overflow-y-auto thin-scrollbar">
                <JsonRenderer
                  data={inputParams}
                  flowId={flowId}
                  timestamp={currentRun.startEvent?.timestamp}
                />
              </pre>
            </div>
          ) : (
            <div className="text-xs p-3 bg-[#0d1117]/50 border border-[#30363d] rounded-lg text-gray-500 italic">
              No input parameters
            </div>
          )}
        </div>

        {/* Flow Arrow */}
        <div className="flex justify-center py-2 bg-[#0d1117]/20">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
            <ArrowDown className="w-4 h-4" />
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
          </div>
        </div>

        {/* Output Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Output
            </span>
          </div>
          {runStatus === 'running' ? (
            activeBrowserSession?.variableId === execution.variableId ? (
              // Show embedded browser session for live viewing
              <div className="relative w-full h-[400px] bg-gray-900 rounded-lg overflow-hidden border border-blue-500/30">
                <iframe
                  src={activeBrowserSession.sessionUrl}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  title="Live Browser Session"
                  allow="clipboard-read; clipboard-write"
                />
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="font-medium">Live Session</span>
                </div>
              </div>
            ) : (
              // Default executing loader
              <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-lg flex items-center gap-2 text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Executing...</span>
              </div>
            )
          ) : runStatus === 'pending' ? (
            <div className="text-xs p-3 bg-[#0d1117]/50 border border-[#30363d] rounded-lg text-gray-500 italic">
              Waiting for execution...
            </div>
          ) : outputResult ? (
            <div className="rounded-lg border border-[#30363d] bg-[#0d1117]/50 overflow-hidden">
              <pre className="json-output text-xs p-4 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto max-h-[40vh] overflow-y-auto thin-scrollbar">
                <JsonRenderer
                  data={outputResult}
                  flowId={flowId}
                  timestamp={currentRun.completeEvent?.timestamp}
                />
              </pre>
            </div>
          ) : (
            <div className="text-xs p-3 bg-[#0d1117]/50 border border-[#30363d] rounded-lg text-gray-500 italic">
              No output data
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
