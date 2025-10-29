import { useState, useRef, useEffect } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { useExecutionStore } from '../../stores/executionStore';
import { getVariableNameForDisplay } from '../../utils/bubbleUtils';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import {
  formatTimestamp,
  formatMemoryUsage,
  makeLinksClickable,
  renderJson,
  getEventIcon,
  getEventColor,
} from '../../utils/executionLogsFormat';
import AllEventsView from './AllEventsView';

interface LiveOutputProps {
  events?: StreamingLogEvent[];
  currentLine?: number | null;
  executionStats?: {
    totalTime: number;
    memoryUsage: number;
    linesExecuted: number;
    bubblesProcessed: number;
  };
  flowId?: number | null;
}

export default function LiveOutput({
  events: propsEvents = [],
  currentLine: propsCurrentLine = null,
  executionStats: propsExecutionStats,
  flowId = null,
}: LiveOutputProps) {
  // Toggle to include per-line log output in the live preview
  const SHOW_LINE_LOG = false;
  const [localEvents] = useState<StreamingLogEvent[]>([]);
  const [selectedByVar, setSelectedByVar] = useState<Record<string, number>>(
    {}
  );
  const [filterTab, setFilterTab] = useState<'all' | 'warnings' | 'errors'>(
    'all'
  );

  // Get bubble flow data to access bubble parameters
  const currentFlow = useBubbleFlow(flowId);
  const bubbleParameters = currentFlow.data?.bubbleParameters || {};

  // Get execution state from store - this is the source of truth
  // Use selector to ensure component re-renders when isRunning changes
  const isCurrentlyExecuting = useExecutionStore(
    flowId,
    (state) => state.isRunning
  );

  // Use props events if provided, otherwise use local state
  const events = propsEvents.length > 0 ? propsEvents : localEvents;
  let displayEvents = SHOW_LINE_LOG
    ? events
    : events.filter((e) => e.type !== 'log_line');

  // Apply filter based on filterTab
  if (filterTab === 'all') {
    // Exclude warnings and errors from main view - they have dedicated tabs
    displayEvents = displayEvents.filter(
      (e) => e.type !== 'warn' && e.type !== 'error' && e.type !== 'fatal'
    );
  } else if (filterTab === 'warnings') {
    displayEvents = displayEvents.filter((e) => e.type === 'warn');
  } else if (filterTab === 'errors') {
    displayEvents = displayEvents.filter(
      (e) => e.type === 'error' || e.type === 'fatal'
    );
  }

  // Count warnings and errors for badges
  const warningCount = events.filter((e) => e.type === 'warn').length;
  const errorCount = events.filter(
    (e) => e.type === 'error' || e.type === 'fatal'
  ).length;
  const currentLine = propsCurrentLine;
  const executionStats = propsExecutionStats || {
    totalTime: 0,
    memoryUsage: 0,
    linesExecuted: 0,
    bubblesProcessed: 0,
  };

  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Group events by variableId (fallback to bubbleName, then 'global')
  const byVariableId: Record<string, StreamingLogEvent[]> =
    displayEvents.reduce(
      (acc, ev) => {
        // Check for variableId in multiple places:
        // 1. Direct variableId field
        // 2. additionalData.variableId (for info logs and other events)
        // 3. bubbleName as fallback
        const directVariableId = (ev as { variableId?: number }).variableId;
        const additionalDataVariableId = (
          ev.additionalData as { variableId?: number }
        )?.variableId;
        const bubbleName = (ev as { bubbleName?: string }).bubbleName;

        const key = String(
          directVariableId ?? additionalDataVariableId ?? bubbleName ?? 'global'
        );
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
      },
      {} as Record<string, StreamingLogEvent[]>
    );
  const globalEvents = byVariableId['global'] ?? [];
  const ts = (e?: StreamingLogEvent) =>
    e ? new Date(e.timestamp).getTime() : 0;
  const variableEntries = Object.entries(byVariableId)
    .filter(([k]) => k !== 'global')
    .sort(([, a], [, b]) => ts(a[0]) - ts(b[0]));

  // Build unified ordered list: groups (by first event) + each global event
  type OrderedItem =
    | {
        kind: 'group';
        name: string;
        events: StreamingLogEvent[];
        firstTs: number;
      }
    | { kind: 'global'; event: StreamingLogEvent; firstTs: number };
  const orderedItems: OrderedItem[] = [];
  for (const [name, evs] of variableEntries) {
    if (evs.length)
      orderedItems.push({
        kind: 'group',
        name,
        events: evs,
        firstTs: ts(evs[0]),
      });
  }
  for (const ev of globalEvents) {
    orderedItems.push({ kind: 'global', event: ev, firstTs: ts(ev) });
  }
  orderedItems.sort((a, b) => a.firstTs - b.firstTs);

  return (
    <div className="h-full flex flex-col bg-[#0f1115]">
      {/* Statistics */}
      {(isCurrentlyExecuting || events.length > 0) && (
        <div className="flex items-center gap-6 px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-sm">
          <div className="text-gray-400">
            Time:{' '}
            <span className="text-white">{executionStats.totalTime}ms</span>
          </div>
          <div className="text-gray-400">
            Memory:{' '}
            <span className="text-white">
              {formatMemoryUsage(executionStats.memoryUsage)}
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {(isCurrentlyExecuting || events.length > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0f1115] border-b border-[#30363d]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterTab('all');
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filterTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-[#21262d] text-gray-400 hover:text-gray-300 hover:bg-[#30363d]'
            }`}
          >
            All Events
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterTab('warnings');
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              filterTab === 'warnings'
                ? 'bg-yellow-600 text-white'
                : 'bg-[#21262d] text-gray-400 hover:text-gray-300 hover:bg-[#30363d]'
            }`}
          >
            Warnings
            {warningCount > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs rounded ${
                  filterTab === 'warnings'
                    ? 'bg-yellow-700 text-yellow-100'
                    : 'bg-yellow-900/30 text-yellow-400'
                }`}
              >
                {warningCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterTab('errors');
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              filterTab === 'errors'
                ? 'bg-red-600 text-white'
                : 'bg-[#21262d] text-gray-400 hover:text-gray-300 hover:bg-[#30363d]'
            }`}
          >
            Errors
            {errorCount > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs rounded ${
                  filterTab === 'errors'
                    ? 'bg-red-700 text-red-100'
                    : 'bg-red-900/30 text-red-400'
                }`}
              >
                {errorCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto thin-scrollbar">
        <div className="h-full">
          {displayEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No execution logs yet</p>
                <p className="text-sm">
                  Execute a BubbleFlow to see live output here
                </p>
              </div>
            </div>
          ) : filterTab === 'all' ? (
            /* Sidebar layout for All Events */
            <AllEventsView
              orderedItems={orderedItems}
              currentLine={currentLine}
              getEventIcon={getEventIcon}
              getEventColor={getEventColor}
              formatTimestamp={formatTimestamp}
              makeLinksClickable={makeLinksClickable}
              renderJson={renderJson}
              flowId={flowId}
            />
          ) : (
            /* Vertical layout for Warnings and Errors tabs */
            <div className="p-4 space-y-2">
              {orderedItems.map((item, index) => {
                if (item.kind === 'global') {
                  const event = item.event;
                  return (
                    <div
                      key={`global-${index}`}
                      className={`flex items-start gap-3 p-3 rounded-lg bg-[#21262d] border border-[#30363d] ${
                        event.lineNumber === currentLine
                          ? 'ring-2 ring-yellow-400/50 bg-yellow-900/10'
                          : ''
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getEventIcon(event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span
                            className={`text-sm font-medium ${getEventColor(event)}`}
                          >
                            {event.type
                              .replace('_', ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                          {event.lineNumber && (
                            <span className="text-xs font-mono text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">
                              Line {event.lineNumber}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 break-words">
                          {makeLinksClickable(event.message)}
                        </p>
                        {event.additionalData &&
                          Object.keys(event.additionalData).length > 0 && (
                            <details className="mt-2" open={true}>
                              <summary
                                className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Additional Data
                              </summary>
                              <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                                {renderJson(event.additionalData)}
                              </pre>
                            </details>
                          )}
                      </div>
                    </div>
                  );
                } else {
                  // Bubble group
                  const varId = item.name;
                  const evs = item.events;
                  const selectedIndex = Math.min(
                    selectedByVar[varId] ?? evs.length - 1,
                    evs.length - 1
                  );
                  const selectedEvent = evs[selectedIndex];
                  return (
                    <div
                      key={`bubble-${varId}`}
                      className="rounded-lg border border-[#30363d] bg-[#0f1115]/60"
                    >
                      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#30363d]">
                        <div className="text-sm text-gray-200 font-mono">
                          bubble:{' '}
                          <span className="text-blue-300">
                            {getVariableNameForDisplay(
                              varId,
                              evs,
                              bubbleParameters
                            )}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <label className="text-xs text-gray-400">
                            Output
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, evs.length - 1)}
                            value={selectedIndex}
                            onChange={(e) =>
                              setSelectedByVar((s) => ({
                                ...s,
                                [varId]: Number(e.target.value),
                              }))
                            }
                            className="w-40"
                            aria-label={`Select output for variable ${varId}`}
                          />
                          <span className="text-xs text-gray-400 font-mono">
                            {selectedIndex + 1}/{evs.length}
                          </span>
                        </div>
                      </div>
                      {selectedEvent ? (
                        <div className="p-3">
                          <div
                            className={`flex items-start gap-3 p-3 rounded-lg bg-[#21262d] border border-[#30363d] ${
                              selectedEvent.lineNumber === currentLine
                                ? 'ring-2 ring-yellow-400/50 bg-yellow-900/10'
                                : ''
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {getEventIcon(selectedEvent)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span
                                  className={`text-sm font-medium ${getEventColor(selectedEvent)}`}
                                >
                                  {selectedEvent.type
                                    .replace('_', ' ')
                                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                                </span>
                                {'variableId' in selectedEvent &&
                                  (selectedEvent as { variableId?: number })
                                    .variableId !== undefined && (
                                    <span className="text-xs font-mono text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded">
                                      var{' '}
                                      {String(
                                        (
                                          selectedEvent as {
                                            variableId?: number;
                                          }
                                        ).variableId
                                      )}
                                    </span>
                                  )}
                                {selectedEvent.lineNumber && (
                                  <span className="text-xs font-mono text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">
                                    Line {selectedEvent.lineNumber}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 ml-auto">
                                  {formatTimestamp(selectedEvent.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 break-words">
                                {makeLinksClickable(selectedEvent.message)}
                              </p>
                              {selectedEvent.additionalData &&
                                Object.keys(selectedEvent.additionalData)
                                  .length > 0 && (
                                  <details className="mt-2" open={true}>
                                    <summary
                                      className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Additional Data
                                    </summary>
                                    <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                                      {renderJson(selectedEvent.additionalData)}
                                    </pre>
                                  </details>
                                )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-sm text-gray-400">
                          No event selected
                        </div>
                      )}
                    </div>
                  );
                }
              })}
              <div ref={eventsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export the connect function for external use
export { LiveOutput };
