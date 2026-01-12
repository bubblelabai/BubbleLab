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
import { useExecutionStore } from '../../stores/executionStore';
import { usePearlChatStore } from '../../hooks/usePearlChatStore';
import { useUIStore } from '../../stores/uiStore';
import AllEventsView from './AllEventsView';
import { EvaluationIssuePopup } from './EvaluationIssuePopup';

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

  // Get evaluation state from execution store (popup state is global in store)
  const executionState = useExecutionStore(flowId);
  const { evaluationResult, showEvaluationPopup, dismissEvaluationPopup } =
    executionState;

  // Pearl chat for fixing issues
  const pearl = usePearlChatStore(flowId);
  const { openConsolidatedPanelWith } = useUIStore();

  // Handle fix with Pearl from popup
  const handleFixWithPearl = (issueDescription: string) => {
    if (!flowId) return;
    pearl.startGeneration(issueDescription);
    openConsolidatedPanelWith('pearl');
    dismissEvaluationPopup();
  };

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

      {/* Evaluation Issue Popup - uses global store state */}
      {evaluationResult && (
        <EvaluationIssuePopup
          isOpen={showEvaluationPopup}
          onClose={dismissEvaluationPopup}
          evaluationResult={evaluationResult}
          onFixWithPearl={handleFixWithPearl}
          isFixingWithPearl={pearl.isPending}
        />
      )}
    </div>
  );
}

// Export the connect function for external use
export { LiveOutput };
