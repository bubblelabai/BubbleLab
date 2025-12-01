// Layout constants - single source of truth for bubble spacing and positioning
export const STEP_CONTAINER_LAYOUT = {
  WIDTH: 400,
  PADDING: 20,
  INTERNAL_WIDTH: 360, // WIDTH - (PADDING * 2)
  HEADER_HEIGHT: 230, // Default/fallback header height
  MIN_HEADER_HEIGHT: 80, // Minimum header height (for short titles)
  HEADER_PADDING_Y: 16, // Vertical padding in header (py-4 = 1rem = 16px)
  HEADER_PADDING_X: 20, // Horizontal padding in header (px-5 = 1.25rem = 20px)
  TITLE_LINE_HEIGHT: 28, // Text-xl line height (~1.75rem)
  DESCRIPTION_LINE_HEIGHT: 24, // Text-base line height (~1.5rem)
  TITLE_MARGIN_BOTTOM: 4, // mb-1 = 0.25rem = 4px
  CHARS_PER_LINE: 45, // Approximate characters per line given width
  BUBBLE_HEIGHT: 280, // Fixed height allocation per bubble slot
  BUBBLE_SPACING: 20, // Gap from bottom of one bubble to top of next (fixed distance)
  BUBBLE_WIDTH: 320, // w-80 class
  BUBBLE_X_OFFSET: 40, // (WIDTH - BUBBLE_WIDTH) / 2
} as const;

/**
 * Calculate the dynamic header height based on text content
 * @param functionName - The function name to display
 * @param description - Optional description text
 * @returns Calculated header height in pixels
 */
export function calculateHeaderHeight(
  functionName: string,
  description?: string
): number {
  const {
    HEADER_PADDING_Y,
    TITLE_LINE_HEIGHT,
    DESCRIPTION_LINE_HEIGHT,
    TITLE_MARGIN_BOTTOM,
    CHARS_PER_LINE,
    MIN_HEADER_HEIGHT,
    INTERNAL_WIDTH,
    HEADER_PADDING_X,
  } = STEP_CONTAINER_LAYOUT;

  // Start with padding
  let height = HEADER_PADDING_Y * 2;

  // Add title height (always one line for function name)
  height += TITLE_LINE_HEIGHT + TITLE_MARGIN_BOTTOM;

  // Calculate description height if present
  if (description) {
    // Account for horizontal padding when calculating available width
    const availableWidth = INTERNAL_WIDTH - HEADER_PADDING_X * 2;
    const charsPerLine = Math.floor(
      (availableWidth / INTERNAL_WIDTH) * CHARS_PER_LINE
    );
    const descriptionLines = Math.ceil(description.length / charsPerLine);
    height += descriptionLines * DESCRIPTION_LINE_HEIGHT;
  }

  // Ensure minimum height
  return Math.max(height, MIN_HEADER_HEIGHT);
}

/**
 * Calculate the height of a step container based on the number of bubbles it contains
 * @param bubbleCount - Number of bubbles in the step
 * @param headerHeight - Optional dynamic header height (if not provided, uses default)
 */
export function calculateStepContainerHeight(
  bubbleCount: number,
  headerHeight?: number
): number {
  const actualHeaderHeight =
    headerHeight ?? STEP_CONTAINER_LAYOUT.HEADER_HEIGHT;

  if (bubbleCount === 0) {
    return actualHeaderHeight;
  }

  // Calculate content area height including padding
  const contentHeight =
    STEP_CONTAINER_LAYOUT.PADDING + // Top padding of content area
    bubbleCount * STEP_CONTAINER_LAYOUT.BUBBLE_HEIGHT +
    (bubbleCount - 1) * STEP_CONTAINER_LAYOUT.BUBBLE_SPACING +
    STEP_CONTAINER_LAYOUT.PADDING; // Bottom padding of content area

  return actualHeaderHeight + contentHeight;
}

/**
 * Calculate the position of a bubble within a step container
 * @param bubbleIndex - Zero-based index of the bubble within the step
 * @param headerHeight - Optional dynamic header height (if not provided, uses default)
 * @returns Position object with x and y coordinates relative to the container
 */
export function calculateBubblePosition(
  bubbleIndex: number,
  headerHeight?: number
): {
  x: number;
  y: number;
} {
  const actualHeaderHeight =
    headerHeight ?? STEP_CONTAINER_LAYOUT.HEADER_HEIGHT;

  return {
    x: STEP_CONTAINER_LAYOUT.BUBBLE_X_OFFSET,
    y:
      actualHeaderHeight +
      STEP_CONTAINER_LAYOUT.PADDING + // Account for content area's top padding
      bubbleIndex *
        (STEP_CONTAINER_LAYOUT.BUBBLE_HEIGHT +
          STEP_CONTAINER_LAYOUT.BUBBLE_SPACING),
  };
}
