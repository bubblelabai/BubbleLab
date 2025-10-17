import React, { useState, useRef } from 'react';
import { PlayIcon } from '@heroicons/react/24/solid';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { findLogoForBubble } from '../../lib/integrations';

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
  renderJson: (data: unknown) => React.ReactElement;
}

export default function AllEventsView({
  orderedItems,
  currentLine,
  getEventIcon,
  getEventColor,
  formatTimestamp,
  makeLinksClickable,
  renderJson,
}: AllEventsViewProps) {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [selectedByVar, setSelectedByVar] = useState<Record<string, number>>(
    {}
  );
  const eventsEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Event List */}
      <div className="w-80 border-r border-[#30363d] overflow-y-auto thin-scrollbar bg-[#0f1115]">
        <div className="p-2 space-y-1">
          {orderedItems.map((item, index) => {
            const isSelected = selectedItemIndex === index;

            if (item.kind === 'global') {
              const event = item.event;
              return (
                <button
                  key={`global-${index}`}
                  onClick={() => setSelectedItemIndex(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-500/50'
                      : 'bg-[#21262d] border-[#30363d] hover:bg-[#30363d] hover:border-[#40464d]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0">{getEventIcon(event)}</div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${getEventColor(event)}`}
                      >
                        {event.type
                          .replace('_', ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            } else {
              // Bubble group
              const varId = item.name;
              const logo = findLogoForBubble({ bubbleName: varId });
              return (
                <button
                  key={`bubble-${varId}`}
                  onClick={() => setSelectedItemIndex(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-500/50'
                      : 'bg-[#21262d] border-[#30363d] hover:bg-[#30363d] hover:border-[#40464d]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0">
                      {logo ? (
                        <img
                          src={logo.file}
                          alt={`${logo.name} logo`}
                          className="h-4 w-4 opacity-80"
                          loading="lazy"
                        />
                      ) : (
                        <PlayIcon className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        Bubble: <span className="text-blue-300">{varId}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.events.length} event
                        {item.events.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              );
            }
          })}
        </div>
      </div>

      {/* Right Side - Event Details */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4">
        {orderedItems[selectedItemIndex] ? (
          (() => {
            const item = orderedItems[selectedItemIndex];

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
                <div className="rounded-lg border border-[#30363d] bg-[#0f1115]/60">
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-[#30363d]">
                    <div className="text-sm text-gray-200 font-mono">
                      Bubble: <span className="text-blue-300">{varId}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <label className="text-xs text-gray-400">Output</label>
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
                                    (selectedEvent as { variableId?: number })
                                      .variableId
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
                            Object.keys(selectedEvent.additionalData).length >
                              0 && (
                              <details
                                className="mt-2"
                                open={
                                  selectedEvent.type === 'execution_complete'
                                }
                              >
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
          })()
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No event selected</p>
              <p className="text-sm">
                Select an event from the sidebar to view details
              </p>
            </div>
          </div>
        )}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
