import { useState } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import {
  formatTimestamp,
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
  flowId = null,
}: LiveOutputProps) {
  // Toggle to include per-line log output in the live preview
  const SHOW_LINE_LOG = false;
  const [localEvents] = useState<StreamingLogEvent[]>([]);

  // Use props events if provided, otherwise use local state
  const events = propsEvents.length > 0 ? propsEvents : localEvents;
  const displayEvents = SHOW_LINE_LOG
    ? events
    : events.filter((e) => e.type !== 'log_line');

  // Count warnings and errors for badges
  const warningCount = events.filter((e) => e.type === 'warn').length;
  const errorCount = events.filter(
    (e) => e.type === 'error' || e.type === 'fatal'
  ).length;
  const currentLine = propsCurrentLine;

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
      {/* Content Area - Full height AllEventsView */}
      <div className="flex-1 overflow-hidden">
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No execution logs yet</p>
              <p className="text-sm">
                Execute a BubbleFlow to see live output here
              </p>
            </div>
          </div>
        ) : (
          <AllEventsView
            orderedItems={orderedItems}
            currentLine={currentLine}
            getEventIcon={getEventIcon}
            getEventColor={getEventColor}
            formatTimestamp={formatTimestamp}
            makeLinksClickable={makeLinksClickable}
            renderJson={renderJson}
            flowId={flowId}
            events={events}
            warningCount={warningCount}
            errorCount={errorCount}
          />
        )}
      </div>
    </div>
  );
}

// Export the connect function for external use
export { LiveOutput };
