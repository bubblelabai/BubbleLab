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
  usedHandles?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

// Layout constants - single source of truth for bubble spacing and positioning
export const STEP_CONTAINER_LAYOUT = {
  WIDTH: 400,
  PADDING: 20,
  INTERNAL_WIDTH: 360, // WIDTH - (PADDING * 2)
  HEADER_HEIGHT: 230,
  BUBBLE_HEIGHT: 180, // Typical height of a bubble node
  BUBBLE_SPACING: 80, // Gap between bubbles (vertical spacing)
  BUBBLE_WIDTH: 320, // w-80 class
  BUBBLE_X_OFFSET: 40, // (WIDTH - BUBBLE_WIDTH) / 2
} as const;

/**
 * Calculate the height of a step container based on the number of bubbles it contains
 */
export function calculateStepContainerHeight(bubbleCount: number): number {
  if (bubbleCount === 0) {
    return STEP_CONTAINER_LAYOUT.HEADER_HEIGHT;
  }
  return (
    STEP_CONTAINER_LAYOUT.HEADER_HEIGHT +
    bubbleCount * STEP_CONTAINER_LAYOUT.BUBBLE_HEIGHT +
    (bubbleCount - 1) * STEP_CONTAINER_LAYOUT.BUBBLE_SPACING
  );
}

/**
 * Calculate the position of a bubble within a step container
 * @param bubbleIndex - Zero-based index of the bubble within the step
 * @returns Position object with x and y coordinates relative to the container
 */
export function calculateBubblePosition(bubbleIndex: number): {
  x: number;
  y: number;
} {
  return {
    x: STEP_CONTAINER_LAYOUT.BUBBLE_X_OFFSET,
    y:
      STEP_CONTAINER_LAYOUT.HEADER_HEIGHT +
      bubbleIndex *
        (STEP_CONTAINER_LAYOUT.BUBBLE_HEIGHT +
          STEP_CONTAINER_LAYOUT.BUBBLE_SPACING),
  };
}

interface StepContainerNodeProps {
  data: StepContainerNodeData;
}

function StepContainerNode({ data }: StepContainerNodeProps) {
  const { stepInfo, bubbleIds, usedHandles = {} } = data;
  const { functionName, description } = stepInfo;

  const calculatedHeight = calculateStepContainerHeight(bubbleIds.length);

  return (
    <div
      className="relative bg-neutral-800/60 backdrop-blur-sm rounded-lg border border-neutral-600/60 shadow-xl"
      style={{
        width: `${STEP_CONTAINER_LAYOUT.WIDTH}px`,
        height: `${calculatedHeight}px`,
        padding: `${STEP_CONTAINER_LAYOUT.PADDING}px`,
      }}
    >
      {/* Connection handles - only show if used */}
      {usedHandles.top && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.left && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}
      {usedHandles.right && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ background: '#a3a3a3', opacity: 0.7 }}
        />
      )}

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-semibold text-white">
            {functionName}()
          </span>
        </div>
        {description && (
          <p className="text-base text-neutral-200">{description}</p>
        )}
      </div>
    </div>
  );
}

export default memo(StepContainerNode);
