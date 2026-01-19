/**
 * Color constants for bubble execution states
 * Modify these values to change the visual appearance of bubbles
 */

// Border colors
export const BUBBLE_COLORS = {
  // Running state - bright cyan
  RUNNING: {
    border: 'border-2 border-cyan-600',
    background: 'bg-cyan-900/30',
    handle: 'bg-cyan-600',
  },

  // Error state - red
  ERROR: {
    border: 'border-red-500',
    background: 'bg-red-900/20',
    handle: 'bg-red-500',
  },

  // Completed state - green
  COMPLETED: {
    border: 'border-green-500',
    background: 'bg-green-900/20',
    handle: 'bg-green-500',
  },

  // Selected state - purple
  SELECTED: {
    border: 'border-purple-400',
    background: 'bg-purple-900/20',
    handle: 'bg-purple-400',
  },

  // Default state - gray
  DEFAULT: {
    border: 'border-neutral-600',
    background: '',
    handle: 'bg-blue-400',
  },

  // Missing credentials - amber
  MISSING: {
    border: 'border-amber-600/40',
    background: 'bg-amber-500/20',
    text: 'text-amber-300',
  },

  // Service trigger state - rose (for service-specific triggers like Slack)
  SERVICE_TRIGGER: {
    border: 'border-rose-500',
    background: 'bg-rose-900/20',
    handle: 'bg-rose-500',
    accent: 'bg-rose-600',
  },
} as const;

// Badge colors
export const BADGE_COLORS = {
  RUNNING: {
    background: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-600/40',
  },
  ERROR: {
    background: 'bg-red-500/20',
    text: 'text-red-300',
    border: 'border-red-600/40',
  },
  COMPLETED: {
    background: 'bg-green-600',
    text: 'text-white',
    border: '',
  },
  MISSING: {
    background: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-600/40',
  },
} as const;
