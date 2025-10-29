import { create } from 'zustand';

/**
 * Discriminated union type for tab selection in LiveOutput
 * - warnings: Show all warning events
 * - errors: Show all error/fatal events
 * - info: Show all info/debug/trace events
 * - item: Show a specific bubble group or global event by index
 */
export type TabType =
  | { kind: 'warnings' }
  | { kind: 'errors' }
  | { kind: 'info' }
  | { kind: 'item'; index: number };

/**
 * State interface for per-flow LiveOutput UI state
 */
interface FlowLiveOutputState {
  // ============= UI STATE =============

  /**
   * Currently selected/highlighted tab
   * Default: { kind: 'warnings' }
   */
  selectedTab: TabType;

  /**
   * Selected event index for each bubble group (for range sliders)
   * Key: variableId (e.g., 'var_123' or 'global')
   * Value: index (0-based) of selected event in that group
   * Default: {} (will default to last event when accessed)
   */
  selectedEventIndexByVariableId: Record<string, number>;

  // ============= ACTIONS =============

  /**
   * Set the currently highlighted tab
   */
  setSelectedTab: (tab: TabType) => void;

  /**
   * Set the selected event index for a specific bubble group
   * Used by range sliders to navigate through multiple outputs
   */
  setSelectedEventIndex: (variableId: string, index: number) => void;

  /**
   * Reset state to initial values
   * Called on flow execution start or when cleaning up
   */
  reset: () => void;
}

/**
 * Initial/empty state for when flowId is null
 */
const emptyState: FlowLiveOutputState = {
  selectedTab: { kind: 'warnings' },
  selectedEventIndexByVariableId: {},
  setSelectedTab: () => {},
  setSelectedEventIndex: () => {},
  reset: () => {},
};

/**
 * Factory function to create a new LiveOutput store instance
 */
function createLiveOutputStore(flowId: number) {
  return create<FlowLiveOutputState>((set) => ({
    // Initial state
    selectedTab: { kind: 'warnings' },
    selectedEventIndexByVariableId: {},

    // Actions
    setSelectedTab: (tab) => set({ selectedTab: tab }),

    setSelectedEventIndex: (variableId, index) =>
      set((state) => ({
        selectedEventIndexByVariableId: {
          ...state.selectedEventIndexByVariableId,
          [variableId]: index,
        },
      })),

    reset: () =>
      set({
        selectedTab: { kind: 'warnings' },
        selectedEventIndexByVariableId: {},
      }),
  }));
}

/**
 * Map to store LiveOutput store instances per flow
 */
const liveOutputStores = new Map<
  number,
  ReturnType<typeof createLiveOutputStore>
>();

/**
 * Hook to access LiveOutput store for a specific flow
 * Supports optional selector for performance optimization
 *
 * @example
 * // Get entire state (will re-render on any state change)
 * const state = useLiveOutputStore(flowId);
 *
 * @example
 * // Get specific value with selector (only re-renders when selectedTab changes)
 * const selectedTab = useLiveOutputStore(flowId, state => state.selectedTab);
 */
export function useLiveOutputStore(flowId: number | null): FlowLiveOutputState;
export function useLiveOutputStore<T>(
  flowId: number | null,
  selector: (state: FlowLiveOutputState) => T
): T;
export function useLiveOutputStore<T>(
  flowId: number | null,
  selector?: (state: FlowLiveOutputState) => T
): FlowLiveOutputState | T {
  if (flowId === null) {
    return selector ? selector(emptyState) : emptyState;
  }

  if (!liveOutputStores.has(flowId)) {
    liveOutputStores.set(flowId, createLiveOutputStore(flowId));
  }

  const store = liveOutputStores.get(flowId)!;
  return selector ? store(selector) : store();
}

/**
 * Get LiveOutput store instance directly (non-reactive)
 * Useful for reading state without subscribing to updates
 *
 * @example
 * const store = getLiveOutputStore(flowId);
 * const currentTab = store?.getState().selectedTab;
 */
export function getLiveOutputStore(
  flowId: number | null
): ReturnType<typeof createLiveOutputStore> | undefined {
  if (flowId === null) return undefined;

  if (!liveOutputStores.has(flowId)) {
    liveOutputStores.set(flowId, createLiveOutputStore(flowId));
  }

  return liveOutputStores.get(flowId);
}

/**
 * Clean up LiveOutput store for a specific flow
 * Should be called when a flow is deleted
 */
export function cleanupLiveOutputStore(flowId: number): void {
  const store = liveOutputStores.get(flowId);
  if (store) {
    store.getState().reset();
    liveOutputStores.delete(flowId);
  }
}

/**
 * Clean up all LiveOutput stores
 * Useful for testing or complete reset
 */
export function cleanupAllLiveOutputStores(): void {
  liveOutputStores.forEach((store) => {
    store.getState().reset();
  });
  liveOutputStores.clear();
}
