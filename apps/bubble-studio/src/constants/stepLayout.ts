/**
 * Shared layout constants for step containers and bubbles
 *
 * These values are used in both StepContainerNode (for container sizing)
 * and FlowVisualizer (for bubble positioning within steps).
 *
 * Keeping them in one place ensures consistency and makes maintenance easier.
 */
export const STEP_LAYOUT = {
  /** Height of the step container header (function name + description) */
  HEADER_HEIGHT: 110,

  /** Vertical spacing between bubbles within a step container */
  BUBBLE_SPACING: 180,

  /** Total padding for the step container (top + bottom) */
  CONTAINER_PADDING: 40,

  /** Width of the step container */
  CONTAINER_WIDTH: 400,

  /** Width of bubble nodes (used for centering calculations) */
  BUBBLE_WIDTH: 320,

  /** Horizontal offset for bubbles within container (centered) */
  BUBBLE_X_OFFSET: 20, // (CONTAINER_WIDTH - BUBBLE_WIDTH) / 2 - padding considerations

  /** Starting Y position for first bubble (after header) */
  BUBBLE_START_Y: 120, // Header height + small gap

  /** Minimum horizontal spacing between step containers (prevents overlap) */
  STEP_HORIZONTAL_SPACING: 500, // Should be > CONTAINER_WIDTH (400) + gap

  /** Minimum vertical spacing between step containers at different levels */
  STEP_VERTICAL_SPACING: 450, // Should account for container height + gap

  /** Horizontal gap between sequential (non-branching) steps */
  STEP_SEQUENTIAL_SPACING: 450, // Spacing for sequential steps in same level
} as const;

/**
 * Calculate the height of a step container based on the number of bubbles
 *
 * @param bubbleCount - Number of bubbles in the step
 * @returns Total height in pixels
 */
export function calculateStepContainerHeight(bubbleCount: number): number {
  const { HEADER_HEIGHT, BUBBLE_SPACING, CONTAINER_PADDING } = STEP_LAYOUT;

  return (
    HEADER_HEIGHT +
    (bubbleCount > 0 ? bubbleCount * BUBBLE_SPACING : 0) +
    CONTAINER_PADDING
  );
}

/**
 * Calculate the Y position for a bubble at a given index within a step
 *
 * @param bubbleIndex - Zero-based index of the bubble in the step
 * @returns Y position relative to the step container
 */
export function calculateBubbleYPosition(bubbleIndex: number): number {
  const { BUBBLE_START_Y, BUBBLE_SPACING } = STEP_LAYOUT;
  return BUBBLE_START_Y + bubbleIndex * BUBBLE_SPACING;
}
