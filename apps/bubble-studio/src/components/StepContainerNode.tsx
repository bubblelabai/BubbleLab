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
  const { functionName, description } = stepInfo;

  // Calculate height based on number of bubbles
  // Header: ~110px (increased for description), Each bubble: 180px spacing, Padding: 40px (20*2)
  const headerHeight = 110;
  const bubbleSpacing = 180;
  const padding = 40;
  const calculatedHeight =
    headerHeight +
    (bubbleIds.length > 0 ? bubbleIds.length * bubbleSpacing : 0) +
    padding;

  return (
    <div
      className="relative bg-neutral-800/60 backdrop-blur-sm rounded-lg border border-neutral-600/60 shadow-xl"
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
        style={{ background: '#a3a3a3', opacity: 0.7 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#a3a3a3', opacity: 0.7 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#a3a3a3', opacity: 0.7 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#a3a3a3', opacity: 0.7 }}
      />

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-semibold text-neutral-100">
            {functionName}()
          </span>
        </div>
        {description && (
          <p className="text-sm text-neutral-300 line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );
}

export default memo(StepContainerNode);
