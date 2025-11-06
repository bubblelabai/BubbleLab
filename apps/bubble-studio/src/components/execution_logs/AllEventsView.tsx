import React, { useRef } from 'react';
import { PlayIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { Sparkles } from 'lucide-react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { findLogoForBubble } from '../../lib/integrations';
import { getVariableNameForDisplay } from '../../utils/bubbleUtils';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import { useLiveOutput } from '../../hooks/useLiveOutput';
import { usePearlChatStore } from '../../hooks/usePearlChatStore';
import { useUIStore } from '../../stores/uiStore';
import type { TabType } from '../../stores/liveOutputStore';

interface AllEventsViewProps {
  orderedItems: Array<
    | {
        kind: 'group';
        name: string;
        events: StreamingLogEvent[];
        firstTs: number;
      }
    | { kind: 'global'; event: StreamingLogEvent; firstTs: number }
  >;
  currentLine: number | null;
  getEventIcon: (event: StreamingLogEvent) => React.ReactElement;
  formatTimestamp: (timestamp: string) => string;
  makeLinksClickable: (text: string | null) => (string | React.ReactElement)[];
  renderJson: React.ComponentType<{
    data: unknown;
    flowId?: number | null;
    executionId?: number;
    timestamp?: string;
  }>;
  flowId?: number | null;
  events: StreamingLogEvent[]; // NEW: All events for filtering
  warningCount: number; // NEW: For badge
  errorCount: number; // NEW: For badge
  isRunning?: boolean; // NEW: Execution state
}

export default function AllEventsView({
  orderedItems,
  currentLine,
  getEventIcon,
  formatTimestamp,
  makeLinksClickable,
  renderJson: JsonRenderer,
  flowId = null,
  events,
  warningCount,
  errorCount,
  isRunning = false,
}: AllEventsViewProps) {
  // Get bubble flow data to access bubble parameters
  const currentFlow = useBubbleFlow(flowId);
  const bubbleParameters = currentFlow.data?.bubbleParameters || {};

  // Use LiveOutput hook for state management
  const {
    selectedTab,
    setSelectedTab,
    selectedEventIndexByVariableId,
    setSelectedEventIndex,
  } = useLiveOutput(flowId);

  // Pearl chat integration for error fixing
  const pearl = usePearlChatStore(flowId);
  const { openConsolidatedPanelWith } = useUIStore();

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Count info events (exclude log_line from info grouping)
  const infoCount = events.filter(
    (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
  ).length;

  // Total count for Results tab (all global events)
  const totalGlobalCount = infoCount + warningCount + errorCount;

  // Generate unified tabs: Bubble execution tabs + Results tab at the end
  const allTabs: Array<{
    id: string;
    label: string;
    badge?: number;
    icon: React.ReactElement;
    type: TabType;
  }> = [];

  // Add bubble execution tabs first
  orderedItems.forEach((item, index) => {
    if (item.kind === 'group') {
      const varId = item.name;
      const bubbleName = (item.events[0] as { bubbleName?: string }).bubbleName;
      const logo = findLogoForBubble({ bubbleName: bubbleName });
      allTabs.push({
        id: `bubble-${varId}`,
        label: getVariableNameForDisplay(varId, item.events, bubbleParameters),
        badge: item.events.length,
        icon: logo ? (
          <img
            src={logo.file}
            alt={`${logo.name} logo`}
            className="h-4 w-4 opacity-80"
            loading="lazy"
          />
        ) : (
          <PlayIcon className="h-4 w-4 text-blue-400" />
        ),
        type: { kind: 'item', index },
      });
    }
  });

  // Add Results tab at the end - only when execution is complete
  if (!isRunning) {
    allTabs.push({
      id: 'results',
      label: 'Results',
      badge: totalGlobalCount,
      icon: <InformationCircleIcon className="h-4 w-4 text-blue-300" />,
      type: { kind: 'results' },
    });
  }

  // Determine if current tab matches
  const isTabSelected = (tabType: TabType) => {
    if (selectedTab.kind !== tabType.kind) return false;
    if (selectedTab.kind === 'item' && tabType.kind === 'item') {
      return selectedTab.index === tabType.index;
    }
    return true;
  };

  return (
    <div className="flex h-full bg-[#0d1117]">
      {/* Vertical Sidebar with Tabs */}
      <div
        ref={tabsRef}
        className="flex-shrink-0 border-r border-[#21262d] bg-[#0d1117] overflow-y-auto thin-scrollbar w-20"
      >
        <div className="flex flex-col gap-0.5 p-1.5">
          {allTabs.map((tab) => {
            const isSelected = isTabSelected(tab.type);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.type)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-md transition-all ${
                  isSelected
                    ? 'bg-[#1f6feb]/10 text-[#58a6ff]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#161b22]'
                }`}
              >
                <div className="flex-shrink-0">{tab.icon}</div>
                <span className="text-[9px] font-medium text-center leading-tight truncate w-full px-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Details */}
      <div
        ref={contentScrollRef}
        className="flex-1 overflow-y-auto thin-scrollbar"
      >
        {(() => {
          // Handle Results tab - show ALL global events chronologically
          if (selectedTab.kind === 'results') {
            // Filter for all global events (info, warn, error, fatal, debug, trace)
            const globalEvents = events.filter((e) => {
              return (
                e.type === 'info' ||
                e.type === 'debug' ||
                e.type === 'trace' ||
                e.type === 'warn' ||
                e.type === 'error' ||
                e.type === 'fatal' ||
                e.type === 'execution_complete'
              );
            });

            if (globalEvents.length === 0) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-600">
                    <InformationCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No events</p>
                  </div>
                </div>
              );
            }

            // Separate execution_complete events and other events
            const executionCompleteEvents = globalEvents.filter(
              (e) => e.type === 'execution_complete'
            );

            const errorEvents = globalEvents
              .filter((e) => e.type === 'error' || e.type === 'fatal')
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            // Handler for "Fix with Pearl" CTA
            const handleFixWithPearl = () => {
              if (!flowId || errorEvents.length === 0) return;
              const prompt = `I'm seeing error(s) in my workflow execution. Can you help me fix these errors?`;

              // Trigger Pearl generation (component doesn't subscribe to Pearl state)
              pearl.startGeneration(prompt);

              // Open Pearl panel
              openConsolidatedPanelWith('pearl');
            };

            const warningEvents = globalEvents
              .filter((e) => e.type === 'warn')
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            const infoEvents = globalEvents
              .filter(
                (e) =>
                  e.type === 'info' || e.type === 'debug' || e.type === 'trace'
              )
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            return (
              <div className="py-3 space-y-6">
                {/* Execution Output - Prominent */}
                {executionCompleteEvents.length > 0 && (
                  <div className="px-4">
                    <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Execution Output
                    </h3>
                    <div className="space-y-3">
                      {executionCompleteEvents.map((event, idx) => (
                        <div
                          key={idx}
                          className="border border-blue-500/30 rounded-lg bg-blue-500/5 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getEventIcon(event)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <p className="text-sm text-gray-200 break-words flex-1 min-w-0 font-medium">
                                  {makeLinksClickable(event.message)}
                                </p>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {event.additionalData &&
                            Object.keys(event.additionalData).length > 0 && (
                              <pre className="json-output text-xs mt-3 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                <JsonRenderer
                                  data={event.additionalData}
                                  flowId={flowId}
                                  timestamp={event.timestamp}
                                />
                              </pre>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors - If any */}
                {errorEvents.length > 0 && (
                  <div className="px-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-medium text-red-400 uppercase tracking-wide">
                        Errors ({errorEvents.length})
                      </h3>
                      <button
                        onClick={handleFixWithPearl}
                        disabled={pearl.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Fix with Pearl
                      </button>
                    </div>
                    <div className="space-y-2">
                      {errorEvents.map((event, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded border-l-2 border-red-500/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getEventIcon(event)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <p className="text-xs text-gray-300 break-words flex-1 min-w-0">
                                  {makeLinksClickable(event.message)}
                                </p>
                                <span className="text-[9px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {event.additionalData &&
                            Object.keys(event.additionalData).length > 0 && (
                              <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                <JsonRenderer
                                  data={event.additionalData}
                                  flowId={flowId}
                                  timestamp={event.timestamp}
                                />
                              </pre>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings - If any */}
                {warningEvents.length > 0 && (
                  <div className="px-4">
                    <h3 className="text-xs font-medium text-yellow-400 mb-2 uppercase tracking-wide">
                      Warnings ({warningEvents.length})
                    </h3>
                    <div className="space-y-2">
                      {warningEvents.map((event, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded border-l-2 border-yellow-500/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getEventIcon(event)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <p className="text-xs text-gray-300 break-words flex-1 min-w-0">
                                  {makeLinksClickable(event.message)}
                                </p>
                                <span className="text-[9px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {event.additionalData &&
                            Object.keys(event.additionalData).length > 0 && (
                              <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                <JsonRenderer
                                  data={event.additionalData}
                                  flowId={flowId}
                                  timestamp={event.timestamp}
                                />
                              </pre>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info/Debug - Collapsed by default */}
                {infoEvents.length > 0 && (
                  <div className="px-4">
                    <details className="group">
                      <summary className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide cursor-pointer hover:text-gray-400 flex items-center gap-2">
                        <svg
                          className="w-3 h-3 transition-transform group-open:rotate-90"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        Diagnostic Logs ({infoEvents.length})
                      </summary>
                      <div className="space-y-2 mt-2">
                        {infoEvents.map((event, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 rounded border-l-2 border-transparent"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getEventIcon(event)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                  <p className="text-xs text-gray-400 break-words flex-1 min-w-0">
                                    {makeLinksClickable(event.message)}
                                  </p>
                                  <span className="text-[9px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                    {formatTimestamp(event.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {event.additionalData &&
                              Object.keys(event.additionalData).length > 0 && (
                                <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                  <JsonRenderer
                                    data={event.additionalData}
                                    flowId={flowId}
                                    timestamp={event.timestamp}
                                  />
                                </pre>
                              )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          }

          // Handle item-based tabs (bubble groups and global events)
          if (selectedTab.kind === 'item') {
            const item = orderedItems[selectedTab.index];
            if (!item) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-600">
                    <PlayIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No event selected</p>
                  </div>
                </div>
              );
            }

            if (item.kind === 'global') {
              const event = item.event;
              return (
                <div className="py-2">
                  <div
                    className={`px-3 py-2 rounded border-l-2 ${
                      event.lineNumber === currentLine
                        ? 'border-yellow-500'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getEventIcon(event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <p className="text-sm text-gray-300 break-words flex-1 min-w-0">
                            {makeLinksClickable(event.message)}
                          </p>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {event.additionalData &&
                      Object.keys(event.additionalData).length > 0 && (
                        <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                          <JsonRenderer
                            data={event.additionalData}
                            flowId={flowId}
                            timestamp={event.timestamp}
                          />
                        </pre>
                      )}
                  </div>
                </div>
              );
            } else {
              // Bubble group
              const varId = item.name;
              const evs = item.events;
              const selectedIndex = Math.min(
                selectedEventIndexByVariableId[varId] ?? evs.length - 1,
                evs.length - 1
              );
              const selectedEvent = evs[selectedIndex];
              return (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-[#161b22] border-b border-[#21262d]">
                    <span className="text-xs text-gray-500 font-medium">
                      Output
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, evs.length - 1)}
                      value={selectedIndex}
                      onChange={(e) =>
                        setSelectedEventIndex(varId, Number(e.target.value))
                      }
                      className="flex-1 max-w-xs"
                      aria-label={`Select output for variable ${varId}`}
                    />
                    <span className="text-xs text-gray-500 font-mono tabular-nums">
                      {selectedIndex + 1}/{evs.length}
                    </span>
                  </div>
                  {selectedEvent ? (
                    <div className="flex-1 py-2">
                      <div
                        className={`px-3 py-2 rounded border-l-2 ${
                          selectedEvent.lineNumber === currentLine
                            ? 'border-yellow-500'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getEventIcon(selectedEvent)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 min-w-0">
                              <p className="text-sm text-gray-300 break-words flex-1 min-w-0">
                                {makeLinksClickable(selectedEvent.message)}
                              </p>
                              <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                {formatTimestamp(selectedEvent.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedEvent.additionalData &&
                          Object.keys(selectedEvent.additionalData).length >
                            0 && (
                            <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                              <JsonRenderer
                                data={selectedEvent.additionalData}
                                flowId={flowId}
                                timestamp={selectedEvent.timestamp}
                              />
                            </pre>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-gray-600">No event selected</p>
                    </div>
                  )}
                </div>
              );
            }
          }

          // Fallback - no tab selected
          return null;
        })()}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
