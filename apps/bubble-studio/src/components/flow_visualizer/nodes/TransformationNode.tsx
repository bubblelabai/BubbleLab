import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useExecutionStore } from '@/stores/executionStore';
import { BUBBLE_COLORS } from '@/components/flow_visualizer/BubbleColors';
import BubbleExecutionBadge from '@/components/flow_visualizer/BubbleExecutionBadge';

export interface TransformationNodeData {
  flowId: number;
  transformationId: string; // Node ID for tracking highlight state
  transformationInfo: {
    functionName: string;
    description?: string;
    code: string;
    arguments: string;
    location: { startLine: number; endLine: number };
    isAsync: boolean;
    variableName?: string;
    variableId?: number;
  };
  usedHandles?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
  onTransformationClick?: () => void;
}

interface TransformationNodeProps {
  data: TransformationNodeData;
}

function TransformationNode({ data }: TransformationNodeProps) {
  const {
    flowId,
    transformationId,
    transformationInfo,
    usedHandles = {},
    onTransformationClick,
  } = data;
  const {
    functionName,
    description,
    variableName,
    arguments: args,
    location,
    variableId,
  } = transformationInfo;

  const { showEditor } = useUIStore();
  const [showCodeTooltip, setShowCodeTooltip] = useState(false);

  // Determine the transformation ID for store lookups (prefer variableId, fallback to transformationId)
  const transformationKey = variableId ? String(variableId) : transformationId;

  // Get execution state from execution store
  const highlightedBubble = useExecutionStore(
    flowId,
    (s) => s.highlightedBubble
  );
  const bubbleWithError = useExecutionStore(flowId, (s) => s.bubbleWithError);
  const runningBubbles = useExecutionStore(flowId, (s) => s.runningBubbles);
  const completedBubbles = useExecutionStore(flowId, (s) => s.completedBubbles);
  const bubbleResults = useExecutionStore(flowId, (s) => s.bubbleResults);

  // Compute execution states
  const isHighlighted = useMemo(() => {
    if (variableId) {
      return highlightedBubble === String(variableId);
    }
    return highlightedBubble === transformationId;
  }, [highlightedBubble, variableId, transformationId]);

  const isExecuting = useMemo(() => {
    if (!variableId) return false;
    return runningBubbles.has(String(variableId));
  }, [runningBubbles, variableId]);

  const isCompleted = useMemo(() => {
    if (!variableId) return false;
    return !!completedBubbles[String(variableId)];
  }, [completedBubbles, variableId]);

  const hasError = useMemo(() => {
    if (!variableId) return false;
    const variableIdStr = String(variableId);
    // Check both bubbleResults and bubbleWithError (which uses lastExecutingBubble as fallback)
    return (
      bubbleResults[variableIdStr] === false ||
      bubbleWithError === variableIdStr
    );
  }, [bubbleResults, bubbleWithError, variableId]);

  const executionStats = useMemo(() => {
    if (!variableId) return undefined;
    return completedBubbles[String(variableId)];
  }, [completedBubbles, variableId]);

  const handleViewCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTransformationClick?.();
  };

  return (
    <div
      className={`relative rounded-lg border bg-neutral-800/90 transition-all duration-300 shadow-xl ${
        isExecuting
          ? BUBBLE_COLORS.RUNNING.border
          : hasError
            ? BUBBLE_COLORS.ERROR.border
            : isCompleted
              ? BUBBLE_COLORS.COMPLETED.border
              : isHighlighted
                ? BUBBLE_COLORS.SELECTED.border
                : 'border-neutral-600/60'
      }`}
      style={{
        width: '400px',
      }}
    >
      {/* Connection handles - only show if used */}
      {usedHandles.top && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className={`w-3 h-3 ${isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ top: -6 }}
        />
      )}
      {usedHandles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className={`w-3 h-3 ${isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ bottom: -6 }}
        />
      )}
      {usedHandles.left && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className={`w-3 h-3 ${isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ left: -6 }}
        />
      )}
      {usedHandles.right && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className={`w-3 h-3 ${isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ right: -6 }}
        />
      )}

      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Code className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-neutral-100 truncate">
                {functionName}
              </h3>
              {location && location.startLine > 0 && (
                <p className="text-xs text-neutral-500 truncate mt-0.5">
                  Line {location.startLine}
                  {location.startLine !== location.endLine &&
                    ` - ${location.endLine}`}
                </p>
              )}
            </div>
          </div>
          {/* View Code Button */}
          <div className="flex items-center gap-2">
            {/* Execution Badge */}
            <BubbleExecutionBadge
              hasError={hasError}
              isCompleted={isCompleted}
              isExecuting={isExecuting}
              executionStats={executionStats}
            />
            {/* View Code Button */}
            <div className="relative">
              <button
                type="button"
                title="View Code"
                onClick={handleViewCode}
                onMouseEnter={() => setShowCodeTooltip(true)}
                onMouseLeave={() => setShowCodeTooltip(false)}
                className="inline-flex items-center justify-center p-1.5 rounded text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              {showCodeTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs font-medium text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap border border-neutral-700 z-50">
                  {showEditor ? 'Hide Code' : 'View Code'}
                </div>
              )}
            </div>
          </div>
        </div>
        {description && (
          <p className="text-xs text-neutral-400 mt-1.5 break-words">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(TransformationNode);
