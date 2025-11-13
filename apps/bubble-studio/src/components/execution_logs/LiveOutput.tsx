import { useState } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { JsonRenderer } from './JsonRenderer';
import {
  formatTimestamp,
  makeLinksClickable,
  getEventIcon,
  formatEventMessage,
} from '../../utils/executionLogsFormatUtils';
import { useLiveOutput } from '../../hooks/useLiveOutput';
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
  isRunning?: boolean;
}

export default function LiveOutput({
  events: propsEvents = [],
  currentLine: propsCurrentLine = null,
  flowId = null,
  isRunning = false,
}: LiveOutputProps) {
  const [localEvents] = useState<StreamingLogEvent[]>([]);

  // Use props events if provided, otherwise use local state
  const events = propsEvents.length > 0 ? propsEvents : localEvents;

  // Use LiveOutput hook for state management and computed values
  const { getOrderedItems, getWarningLogs, getErrorLogs } =
    useLiveOutput(flowId);

  // Get computed values using non-reactive getters (no re-renders)
  const orderedItems = getOrderedItems();
  const warningCount = getWarningLogs().length;
  const errorCount = getErrorLogs().length;
  const currentLine = propsCurrentLine;

  return (
    <div className="h-full flex flex-col bg-[#0f1115]">
      {/* Content Area - Full height AllEventsView */}
      <div className="flex-1 overflow-hidden">
        {events.length === 0 ? (
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
            formatTimestamp={formatTimestamp}
            formatEventMessage={formatEventMessage}
            makeLinksClickable={makeLinksClickable}
            renderJson={JsonRenderer}
            flowId={flowId}
            events={events}
            warningCount={warningCount}
            errorCount={errorCount}
            isRunning={isRunning}
          />
        )}
      </div>
    </div>
  );
}

// Export the connect function for external use
export { LiveOutput };
