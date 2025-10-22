import { useState, useRef, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
  EyeIcon,
  XCircleIcon,
  ChevronDownIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { useExecutionHistory } from '../../hooks/useExecutionHistory';
import { useExecutionStore } from '../../stores/executionStore';
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
  onToggleCollapse?: () => void;
  flowId?: number | null;
}

export default function LiveOutput({
  events: propsEvents = [],
  currentLine: propsCurrentLine = null,
  executionStats: propsExecutionStats,
  onToggleCollapse,
  flowId = null,
}: LiveOutputProps) {
  // Toggle to include per-line log output in the live preview
  const SHOW_LINE_LOG = false;
  const [localEvents] = useState<StreamingLogEvent[]>([]);
  const [selectedByVar, setSelectedByVar] = useState<Record<string, number>>(
    {}
  );
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [filterTab, setFilterTab] = useState<'all' | 'warnings' | 'errors'>(
    'all'
  );

  // Get execution state from store - this is the source of truth
  // Use selector to ensure component re-renders when isRunning changes
  const isCurrentlyExecuting = useExecutionStore(
    flowId,
    (state) => state.isRunning
  );

  // Fetch execution history using React Query
  const {
    data: executionHistory,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useExecutionHistory(flowId, { limit: 50 });

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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatMemoryUsage = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Function to detect URLs and make them clickable
  const makeLinksClickable = (text: string | null) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text?.split(urlRegex) ?? [];

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Function to syntax highlight JSON
  const syntaxHighlightJson = (json: string) => {
    // Replace special characters and add syntax highlighting
    const highlighted = json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-orange-300'; // numbers
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-purple-300'; // keys
            return `<span class="${cls}">${match}</span>`;
          } else {
            cls = 'text-green-300'; // string values
            return `<span class="${cls}">${match}</span>`;
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-blue-400'; // booleans
        } else if (/null/.test(match)) {
          cls = 'text-red-300'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
    return highlighted;
  };

  // Render syntax highlighted JSON
  const renderJson = (data: unknown) => {
    const jsonString = JSON.stringify(data, null, 2);
    const highlighted = syntaxHighlightJson(jsonString);
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const getEventIcon = (event: StreamingLogEvent) => {
    switch (event.type) {
      case 'bubble_start':
      case 'bubble_instantiation':
        return <PlayIcon className="h-4 w-4 text-blue-400" />;
      case 'bubble_complete':
      case 'bubble_execution':
      case 'bubble_execution_complete':
        return <CheckCircleIcon className="h-4 w-4 text-green-400" />;
      case 'execution_complete':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-4 w-4 text-red-400" />;
      case 'fatal':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'warn':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />;
      case 'info':
        return <InformationCircleIcon className="h-4 w-4 text-blue-300" />;
      case 'debug':
        return <BugAntIcon className="h-4 w-4 text-purple-400" />;
      case 'trace':
        return <EyeIcon className="h-4 w-4 text-gray-400" />;
      case 'log_line':
        return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
    }
  };

  const getEventColor = (event: StreamingLogEvent) => {
    switch (event.type) {
      case 'bubble_start':
      case 'bubble_instantiation':
        return 'text-blue-300';
      case 'bubble_complete':
      case 'bubble_execution':
      case 'bubble_execution_complete':
        return 'text-green-300';
      case 'execution_complete':
        return 'text-green-400 font-semibold';
      case 'error':
        return 'text-red-300';
      case 'fatal':
        return 'text-red-600 font-semibold';
      case 'warn':
        return 'text-yellow-300';
      case 'info':
        return 'text-blue-200';
      case 'debug':
        return 'text-purple-300';
      case 'trace':
        return 'text-gray-400';
      case 'log_line':
        return 'text-gray-300';
      default:
        return 'text-gray-300';
    }
  };

  // Group events by bubbleName (fallback to variableId, then 'global')
  const byVariableId: Record<string, StreamingLogEvent[]> =
    displayEvents.reduce(
      (acc, ev) => {
        const key = String(
          (ev as { bubbleName?: string; variableId?: number }).bubbleName ??
            (ev as { bubbleName?: string; variableId?: number }).variableId ??
            'global'
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
    <div className="h-full flex flex-col bg-[#0f1115] rounded-lg border border-[#30363d]">
      {/* Header with Tabs */}
      <div className="border-b border-[#30363d]">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between p-4 pb-0 hover:bg-[#161b22] transition-colors cursor-pointer"
          title="Collapse Execution Output"
          disabled={!onToggleCollapse}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-100">
              Execution Output
            </h3>
          </div>
          {onToggleCollapse && (
            <ChevronDownIcon className="w-4 h-4 text-gray-300" />
          )}
        </button>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#30363d]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('live');
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'live'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            Live Output
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('history');
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            History
            {executionHistory && (
              <span className="bg-gray-600 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                {executionHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Statistics - only show for live tab */}
      {activeTab === 'live' && (isCurrentlyExecuting || events.length > 0) && (
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

      {/* Filter Tabs - only show for live tab */}
      {activeTab === 'live' && (isCurrentlyExecuting || events.length > 0) && (
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
        {activeTab === 'live' ? (
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
                              <details
                                className="mt-2"
                                open={event.type === 'execution_complete'}
                              >
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
                            <span className="text-blue-300">{varId}</span>
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
                                    <details
                                      className="mt-2"
                                      open={
                                        selectedEvent.type ===
                                        'execution_complete'
                                      }
                                    >
                                      <summary
                                        className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Additional Data
                                      </summary>
                                      <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                                        {renderJson(
                                          selectedEvent.additionalData
                                        )}
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
        ) : (
          /* History Tab */
          <div className="p-4 space-y-2">
            {historyLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm">Loading execution history...</p>
                </div>
              </div>
            ) : historyError ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <ExclamationCircleIcon className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-lg mb-2">Failed to load history</p>
                  <p className="text-sm mb-4">{historyError.message}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      refetchHistory();
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : !executionHistory || executionHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <ClockIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-lg mb-2">No execution history</p>
                  <p className="text-sm">
                    {!flowId
                      ? 'Select a flow to view its execution history'
                      : 'Execute this flow to see its history here'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {executionHistory.map((execution) => (
                  <div
                    key={execution.id}
                    className="rounded-lg border border-[#30363d] bg-[#21262d] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {isCurrentlyExecuting ? (
                            <div className="h-5 w-5 bg-red-500 rounded-full animate-pulse"></div>
                          ) : execution.status === 'success' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-400" />
                          ) : execution.status === 'error' ? (
                            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                          ) : (
                            <div className="h-5 w-5 bg-yellow-400 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-400">
                              #{execution.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
                                isCurrentlyExecuting
                                  ? 'bg-red-900/30 text-red-300'
                                  : execution.status === 'success'
                                    ? 'bg-green-900/30 text-green-300'
                                    : execution.status === 'error'
                                      ? 'bg-red-900/30 text-red-300'
                                      : 'bg-yellow-900/30 text-yellow-300'
                              }`}
                            >
                              {isCurrentlyExecuting
                                ? 'executing'
                                : execution.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Started: {formatTimestamp(execution.startedAt)}
                            {execution.completedAt && (
                              <span className="ml-2">
                                • Completed:{' '}
                                {formatTimestamp(execution.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Execution Details */}
                    {execution.error && (
                      <div className="mb-3 p-3 bg-red-900/20 border border-red-700/30 rounded">
                        <p className="text-sm text-red-300 font-medium mb-1">
                          Error:
                        </p>
                        <p className="text-sm text-red-200">
                          {execution.error}
                        </p>
                      </div>
                    )}

                    {/* Payload */}
                    {execution.payload &&
                      Object.keys(execution.payload).length > 0 && (
                        <details
                          className="mb-3"
                          open={execution.status === 'success'}
                        >
                          <summary
                            className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium mb-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Execution Payload
                          </summary>
                          <pre className="json-output text-xs p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                            {renderJson(execution.payload)}
                          </pre>
                        </details>
                      )}

                    {/* Result */}
                    {execution.result && (
                      <details className="mb-3">
                        <summary
                          className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium mb-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Execution Result
                        </summary>
                        <pre className="json-output text-xs p-3 bg-[#0d0f13] border border-[#30363d] rounded-md overflow-x-auto whitespace-pre leading-relaxed">
                          {renderJson(execution.result)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Export the connect function for external use
export { LiveOutput };
