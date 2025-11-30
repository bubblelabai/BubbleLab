import type { Node } from '@xyflow/react';
import { STEP_CONTAINER_LAYOUT } from '../StepContainerNode';
import { FLOW_LAYOUT } from './flowLayoutConstants';

/**
 * Constants for subbubble positioning
 * @deprecated Use FLOW_LAYOUT.SUBBUBBLE instead
 */
export const SUBBUBBLE_POSITIONING = {
  VERTICAL_SPACING: FLOW_LAYOUT.SUBBUBBLE.VERTICAL_SPACING,
  SIBLING_HORIZONTAL_SPACING: FLOW_LAYOUT.SUBBUBBLE.SIBLING_HORIZONTAL_SPACING,
  HORIZONTAL_SPACING: FLOW_LAYOUT.SUBBUBBLE.HORIZONTAL_SPACING,
  SUBBUBBLE_WIDTH: FLOW_LAYOUT.BUBBLE_WIDTH, // Use centralized bubble width
  SUBBUBBLE_HEIGHT: FLOW_LAYOUT.BUBBLE_HEIGHT, // Use centralized bubble height
  Y_THRESHOLD: FLOW_LAYOUT.SUBBUBBLE.Y_THRESHOLD,
  SAME_X_THRESHOLD: FLOW_LAYOUT.SUBBUBBLE.SAME_X_THRESHOLD,
} as const;

/**
 * Determines which side (left or right) to position subbubbles relative to a step container
 * Uses the fact that sequential steps share the same X coordinate to make smart decisions
 */
export function determineSubbubbleSide(
  containerNode: Node,
  allStepNodes: Node[]
): 'left' | 'right' {
  const containerX = containerNode.position.x;
  const containerWidth = STEP_CONTAINER_LAYOUT.WIDTH;

  // Find step containers at similar Y levels (same "row" in the flow)
  const sameLevelSteps = allStepNodes.filter((step) => {
    if (step.id === containerNode.id || step.type !== 'stepContainerNode') {
      return false;
    }
    const yDiff = Math.abs(step.position.y - containerNode.position.y);
    return yDiff < FLOW_LAYOUT.SUBBUBBLE.Y_THRESHOLD;
  });

  // Default to right
  let side: 'left' | 'right' = 'right';

  if (sameLevelSteps.length === 0) {
    // No other steps at same level - check if container is on left or right side of canvas
    // If container X is less than threshold, it's likely on the left, so render right
    // If container X is greater than threshold, it's likely on the right, so render left
    side =
      containerX < FLOW_LAYOUT.SUBBUBBLE.LEFT_RIGHT_DETECTION_THRESHOLD
        ? 'right'
        : 'left';
  } else {
    // There are other steps at the same level
    // Check if this container is on the left or right side of the branch
    const leftSteps = sameLevelSteps.filter((s) => s.position.x < containerX);
    const rightSteps = sameLevelSteps.filter((s) => s.position.x > containerX);

    // If more steps on the right, render subbubbles to the left
    // If more steps on the left (or equal), render subbubbles to the right
    if (rightSteps.length > leftSteps.length) {
      side = 'left';
    } else {
      side = 'right';
    }

    // Special case: if this is a sequential step (same X as other steps)
    // Check if there are steps at the exact same X
    const sameXSteps = sameLevelSteps.filter(
      (s) =>
        Math.abs(s.position.x - containerX) <
        FLOW_LAYOUT.SUBBUBBLE.SAME_X_THRESHOLD
    );
    if (sameXSteps.length > 0) {
      // Sequential flow - check which side has more space
      const leftmostX = Math.min(
        ...sameLevelSteps.map((s) => s.position.x),
        containerX
      );
      const rightmostX = Math.max(
        ...sameLevelSteps.map(
          (s) => s.position.x + STEP_CONTAINER_LAYOUT.WIDTH
        ),
        containerX + containerWidth
      );

      const leftSpace = containerX - leftmostX;
      const rightSpace = rightmostX - (containerX + containerWidth);

      // Position to the side with more space
      side = leftSpace > rightSpace ? 'left' : 'right';
    }
  }

  return side;
}

/**
 * Calculates the position for a subbubble relative to its parent
 * Handles both regular nodes and nodes inside step containers
 * Uses all step nodes to make intelligent left/right positioning decisions
 * based on the layout context (sequential steps, branches, etc.)
 */
export function calculateSubbubblePositionWithContext(
  parentNode: Node | undefined,
  containerNode: Node | null,
  allStepNodes: Node[],
  siblingIndex: number,
  siblingsTotal: number,
  persistedPosition?: { x: number; y: number } | null
): { x: number; y: number } {
  let baseX = FLOW_LAYOUT.SUBBUBBLE.DEFAULT_POSITION.x;
  let baseY = FLOW_LAYOUT.SUBBUBBLE.DEFAULT_POSITION.y;

  if (parentNode) {
    baseX = parentNode.position.x;
    baseY = parentNode.position.y;

    // If parent node is inside a container (step), position subbubbles to the side
    if (parentNode.parentId && containerNode) {
      const containerX = containerNode.position.x;
      const containerWidth = STEP_CONTAINER_LAYOUT.WIDTH;
      const parentAbsoluteY = containerNode.position.y + parentNode.position.y;

      // Determine which side to position subbubbles
      const side = determineSubbubbleSide(containerNode, allStepNodes);

      if (side === 'right') {
        baseX =
          containerX +
          containerWidth +
          FLOW_LAYOUT.SUBBUBBLE.HORIZONTAL_SPACING;
        baseY = parentAbsoluteY; // Align vertically with parent bubble
      } else {
        // Position to the left of the step container
        baseX =
          containerX -
          FLOW_LAYOUT.SUBBUBBLE.HORIZONTAL_SPACING -
          FLOW_LAYOUT.BUBBLE_WIDTH;
        baseY = parentAbsoluteY; // Align vertically with parent bubble
      }
    } else if (containerNode) {
      // Fallback: convert to absolute position
      baseX += containerNode.position.x;
      baseY += containerNode.position.y;
    }
  }

  const rowWidth =
    siblingsTotal > 1
      ? (siblingsTotal - 1) * FLOW_LAYOUT.SUBBUBBLE.SIBLING_HORIZONTAL_SPACING
      : 0;
  const initialPosition = {
    x:
      baseX -
      rowWidth / 2 +
      siblingIndex * FLOW_LAYOUT.SUBBUBBLE.SIBLING_HORIZONTAL_SPACING,
    y: baseY + FLOW_LAYOUT.SUBBUBBLE.VERTICAL_SPACING,
  };

  // Use persisted position if available, otherwise use initial position
  return persistedPosition || initialPosition;
}
