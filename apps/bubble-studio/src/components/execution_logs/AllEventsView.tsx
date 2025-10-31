import React, { useRef, useEffect } from 'react';
import {
  PlayIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { findLogoForBubble } from '../../lib/integrations';
import { getVariableNameForDisplay } from '../../utils/bubbleUtils';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import { useLiveOutput } from '../../hooks/useLiveOutput';
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
  getEventColor: (event: StreamingLogEvent) => string;
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
}

export default function AllEventsView({
  orderedItems,
  currentLine,
  getEventIcon,
  getEventColor,
  formatTimestamp,
  makeLinksClickable,
  renderJson: JsonRenderer,
  flowId = null,
  events,
  warningCount,
  errorCount,
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

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Count info events (exclude log_line from info grouping)
  const infoCount = events.filter(
    (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
  ).length;

  // Generate alert tabs (Warnings, Errors, Info)
  const alertTabs: Array<{
    id: string;
    label: string;
    badge?: number;
    icon: React.ReactElement;
    type: TabType;
  }> = [
    {
      id: 'info',
      label: 'Info',
      badge: infoCount,
      icon: <InformationCircleIcon className="h-4 w-4 text-blue-300" />,
      type: { kind: 'info' },
    },
    {
      id: 'warnings',
      label: 'Warnings',
      badge: warningCount,
      icon: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />,
      type: { kind: 'warnings' },
    },
    {
      id: 'errors',
      label: 'Errors',
      badge: errorCount,
      icon: <ExclamationCircleIcon className="h-4 w-4 text-red-400" />,
      type: { kind: 'errors' },
    },
  ];

  // Generate step tabs (dynamic from orderedItems)
  const stepTabs: Array<{
    id: string;
    label: string;
    badge?: number;
    icon: React.ReactElement;
    type: TabType;
  }> = [];

  orderedItems.forEach((item, index) => {
    if (item.kind === 'group') {
      const varId = item.name;
      const bubbleName = (item.events[0] as { bubbleName?: string }).bubbleName;
      const logo = findLogoForBubble({ bubbleName: bubbleName });
      stepTabs.push({
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

  // Determine if current tab matches
  const isTabSelected = (tabType: TabType) => {
    if (selectedTab.kind !== tabType.kind) return false;
    if (selectedTab.kind === 'item' && tabType.kind === 'item') {
      return selectedTab.index === tabType.index;
    }
    return true;
  };

  // Auto-scroll to selected tab when it changes (applies to either row)
  useEffect(() => {
    if (!tabsRef.current) return;

    // Find the selected tab button
    const tabContainer = tabsRef.current;
    const allTabs = [...alertTabs, ...stepTabs];
    const selectedTabIndex = allTabs.findIndex((tab) =>
      isTabSelected(tab.type)
    );

    if (selectedTabIndex === -1) return;

    // Get the selected tab button element
    const tabButtons = tabContainer.querySelectorAll('button');
    const selectedButton = tabButtons[selectedTabIndex];

    if (selectedButton) {
      // Calculate scroll position to center the selected tab
      const containerWidth = tabContainer.clientWidth;
      const buttonLeft = selectedButton.offsetLeft;
      const buttonWidth = selectedButton.offsetWidth;
      const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;

      // Smooth scroll to the selected tab
      tabContainer.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth',
      });
    }
  }, [selectedTab]);

  return (
    <div className="flex flex-col h-full">
      {/* Alerts Row: Warnings / Errors / Info (full-width tabs) */}
      <div
        ref={tabsRef}
        className="flex-shrink-0 border-b border-[#30363d] bg-[#0f1115]"
      >
        <div className="flex">
          {alertTabs.map((tab) => {
            const isSelected = isTabSelected(tab.type);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.type)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                  isSelected
                    ? 'border-gray-400 text-gray-200 bg-[#15181d]'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#161b22]'
                }`}
              >
                <div className="flex-shrink-0">{tab.icon}</div>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Steps Row: actual bubble steps */}
      <div className="flex-shrink-0 border-b border-[#30363d] bg-[#0f1115] overflow-x-auto thin-scrollbar">
        <div className="flex gap-1 p-2 min-w-max">
          {stepTabs.map((tab) => {
            const isSelected = isTabSelected(tab.type);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-900/30 border-blue-500/50'
                    : 'bg-[#21262d] border-[#30363d] hover:bg-[#30363d] hover:border-[#40464d]'
                }`}
              >
                <div className="flex-shrink-0">{tab.icon}</div>
                <span className="text-sm font-medium text-gray-200">
                  {tab.label}
                </span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Details */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4">
        {(() => {
          // Handle grouped event types (warnings, errors, info)
          if (
            selectedTab.kind === 'warnings' ||
            selectedTab.kind === 'errors' ||
            selectedTab.kind === 'info'
          ) {
            const filteredEvents = events.filter((e) => {
              if (selectedTab.kind === 'warnings') return e.type === 'warn';
              if (selectedTab.kind === 'errors')
                return e.type === 'error' || e.type === 'fatal';
              if (selectedTab.kind === 'info')
                return (
                  e.type === 'info' || e.type === 'debug' || e.type === 'trace'
                );
              return false;
            });

            if (filteredEvents.length === 0) {
              return (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-lg mb-2">No {selectedTab.kind} events</p>
                    <p className="text-sm">
                      {selectedTab.kind === 'warnings' &&
                        'No warning messages in this execution'}
                      {selectedTab.kind === 'errors' &&
                        'No errors in this execution'}
                      {selectedTab.kind === 'info' &&
                        'No info messages in this execution'}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredEvents.map((event, idx) => (
                  <div
                    key={idx}
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
                          <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                            <JsonRenderer
                              data={event.additionalData}
                              flowId={flowId}
                              timestamp={event.timestamp}
                            />
                          </pre>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          // Handle item-based tabs (bubble groups and global events)
          if (selectedTab.kind === 'item') {
            const item = orderedItems[selectedTab.index];
            if (!item) {
              return (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-lg mb-2">No event selected</p>
                    <p className="text-sm">
                      Select an event from the tabs above to view details
                    </p>
                  </div>
                </div>
              );
            }

            if (item.kind === 'global') {
              const event = item.event;
              return (
                <div
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
                        <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
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
                <div className="rounded-lg border border-[#30363d] bg-[#0f1115]/60">
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-[#30363d]">
                    <div className="text-sm text-gray-200 font-mono">
                      Bubble:{' '}
                      <span className="text-blue-300">
                        {getVariableNameForDisplay(
                          varId,
                          evs,
                          bubbleParameters
                        )}
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <label className="text-xs text-gray-400">Output</label>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, evs.length - 1)}
                        value={selectedIndex}
                        onChange={(e) =>
                          setSelectedEventIndex(varId, Number(e.target.value))
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
                            Object.keys(selectedEvent.additionalData).length >
                              0 && (
                              <pre className="json-output text-xs mt-2 p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                                <JsonRenderer
                                  data={selectedEvent.additionalData}
                                  flowId={flowId}
                                  timestamp={selectedEvent.timestamp}
                                />
                              </pre>
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
          }

          // Fallback - no tab selected
          return null;
        })()}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
