import { STEP_CONTAINER_LAYOUT } from './stepContainerUtils';

/**
 * Centralized layout constants for flow visualization
 * Single source of truth for all spacing, positioning, and sizing values
 */
export const FLOW_LAYOUT = {
  // Bubble dimensions (from STEP_CONTAINER_LAYOUT - single source of truth)
  BUBBLE_WIDTH: STEP_CONTAINER_LAYOUT.BUBBLE_WIDTH, // 320px - same as w-80 class
  BUBBLE_HEIGHT: STEP_CONTAINER_LAYOUT.BUBBLE_HEIGHT, // 180px - typical bubble height

  // Sequential layout (horizontal flow)
  SEQUENTIAL: {
    HORIZONTAL_SPACING: 450, // Space between bubbles in sequential layout
    BASE_Y: 300, // Base Y position for sequential layout
    START_X: 50, // Starting X position
    ENTRY_NODE_OFFSET: 450, // Offset for entry node (input-schema-node, cron-schedule-node)
  },

  // Hierarchical layout (step-based flow)
  HIERARCHICAL: {
    START_X: 50, // Start after entry node
    START_Y: 200,
    MIN_VERTICAL_SPACING: 80, // Minimum spacing between steps vertically
    HORIZONTAL_SPACING: 500, // Horizontal space between branches
    DEFAULT_POSITION: { x: 500, y: 200 }, // Default position for steps
    DEFAULT_HEIGHT: 200, // Default step height fallback
  },

  // Subbubble positioning
  SUBBUBBLE: {
    VERTICAL_SPACING: 140, // Vertical distance below parent
    SIBLING_HORIZONTAL_SPACING: 200, // Horizontal spacing between sibling subbubbles
    HORIZONTAL_SPACING: 150, // Space between step container and subbubbles
    Y_THRESHOLD: 100, // Consider steps within this Y distance as same level
    SAME_X_THRESHOLD: 10, // Consider steps at same X if within this threshold
    DEFAULT_POSITION: { x: 50, y: 50 } as { x: number; y: number }, // Default position fallback
    LEFT_RIGHT_DETECTION_THRESHOLD: 500, // X position threshold for left/right detection
  },

  // Transformation node layout
  TRANSFORMATION: {
    FIXED_HEIGHT: 100, // Fixed height since transformation nodes only show header (no code)
    HEADER_HEIGHT: 80,
    CODE_LINE_HEIGHT: 18,
    CODE_PADDING: 20, // Padding inside code area
    MIN_CODE_HEIGHT: 100, // Minimum code area height
    NODE_PADDING: 40, // Padding around transformation node
  },

  // Viewport and animation
  VIEWPORT: {
    INITIAL_ZOOM: 0.8,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 2.0,
    EXECUTION_ZOOM: 1.0,
    EXECUTION_LEFT_OFFSET_RATIO: 0.1, // 0 = center, 0.3 = ~30% from left
    CENTER_DURATION: 300, // Animation duration for centering
    INITIAL_VIEW_DELAY: 100, // Delay before setting initial view
  },

  // Z-index layers
  Z_INDEX: {
    SUBBUBBLE_BASE: 100, // Base z-index for subbubbles
    STEP_CONTAINER: -1, // Behind bubbles
  },
} as const;
