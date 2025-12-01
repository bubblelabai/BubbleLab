import { memo } from 'react';
import { BADGE_COLORS } from '@/components/flow_visualizer/BubbleColors';
import { getLiveOutputStore } from '@/stores/liveOutputStore';

interface BubbleExecutionBadgeProps {
  hasError?: boolean;
  isCompleted?: boolean;
  isExecuting?: boolean;
  executionStats?: { totalTime: number; count: number };
  bubbleId?: string;
  flowId?: number;
}

function BubbleExecutionBadge({
  hasError = false,
  isCompleted = false,
  isExecuting = false,
  executionStats,
  bubbleId,
  flowId,
}: BubbleExecutionBadgeProps) {
  // Don't render anything if no state to show
  if (!hasError && !isCompleted && !isExecuting) {
    return null;
  }

  if (isExecuting) {
    return (
      <div className="flex-shrink-0">
        <div
          title="Currently executing"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${BADGE_COLORS.RUNNING.background} ${BADGE_COLORS.RUNNING.text} border ${BADGE_COLORS.RUNNING.border}`}
        >
          <div className="w-2 h-2 border border-blue-300 border-t-transparent rounded-full animate-spin"></div>
          <span>Running</span>
          {isCompleted && executionStats && (
            <span className="text-[9px] opacity-75">
              ({executionStats.count}×)
            </span>
          )}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex-shrink-0">
        <div
          title="Execution failed at this bubble"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${BADGE_COLORS.ERROR.background} ${BADGE_COLORS.ERROR.text} border ${BADGE_COLORS.ERROR.border}`}
        >
          <span>❌</span>
          <span>Error</span>
        </div>
      </div>
    );
  }

  if (isCompleted && executionStats) {
    const averageTime = Math.round(
      executionStats.totalTime / executionStats.count
    );
    const isMultipleExecutions = executionStats.count > 1;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (bubbleId && flowId) {
        const liveOutputStore = getLiveOutputStore(flowId);
        liveOutputStore?.getState().selectBubbleInConsole(bubbleId);
      }
    };

    return (
      <div className="flex-shrink-0">
        <button
          onClick={handleClick}
          title={`Completed in ${averageTime}ms${isMultipleExecutions ? ` (${executionStats.count} runs)` : ''} - Click to view in console`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${BADGE_COLORS.COMPLETED.background} ${BADGE_COLORS.COMPLETED.text} hover:opacity-80 transition-opacity cursor-pointer`}
        >
          <span>✓</span>
          <span>{averageTime}ms</span>
          {isMultipleExecutions && (
            <span className="text-[9px] opacity-75">
              {executionStats.count}×
            </span>
          )}
        </button>
      </div>
    );
  }

  return null;
}

export default memo(BubbleExecutionBadge);
