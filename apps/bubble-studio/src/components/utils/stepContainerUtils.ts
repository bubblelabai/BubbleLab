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
