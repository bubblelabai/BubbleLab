import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface StepContainerNodeData {
  flowId: number;
  stepInfo: {
    functionName: string;
    description?: string;
    location: { startLine: number; endLine: number };
    isAsync: boolean;
  };
  bubbleIds: string[]; // IDs of bubbles inside this step
}

interface StepContainerNodeProps {
  data: StepContainerNodeData;
}

function StepContainerNode({ data }: StepContainerNodeProps) {
  const { stepInfo, bubbleIds } = data;
  const { functionName, description, isAsync } = stepInfo;

  // Calculate height based on number of bubbles
  // Header: ~110px (increased for description), Each bubble: 180px spacing, Footer: ~40px, Padding: 40px (20*2)
  const headerHeight = 110;
  const bubbleSpacing = 180;
  const footerHeight = 40;
  const padding = 40;
  const calculatedHeight =
    headerHeight +
    (bubbleIds.length > 0 ? bubbleIds.length * bubbleSpacing : 0) +
    footerHeight +
    padding;

  return (
    <div
      className="relative bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg shadow-lg border-2 border-purple-300 dark:border-purple-700"
      style={{
        width: '400px',
        height: `${calculatedHeight}px`,
        padding: '20px',
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: '#9333ea' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#9333ea' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#9333ea' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#9333ea' }}
      />

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-purple-900 dark:text-purple-100">
            {isAsync && '⚡️ '}
            {functionName}()
          </span>
        </div>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Footer - shows bubble count */}
      <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {bubbleIds.length} {bubbleIds.length === 1 ? 'bubble' : 'bubbles'}
        </span>
      </div>
    </div>
  );
}

export default memo(StepContainerNode);
