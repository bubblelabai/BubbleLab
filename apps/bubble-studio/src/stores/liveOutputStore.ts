import { create } from 'zustand';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { getExecutionStore } from './executionStore';
import { useUIStore } from './uiStore';
import { getVariableNameForDisplay } from '../utils/bubbleUtils';

/**
 * Ordered item type for event grouping
 * - group: Multiple events from same bubble (needs range slider)
 * - global: Single global event (no grouping)
 */
export type OrderedItem =
  | {
      kind: 'group';
      name: string;
      events: StreamingLogEvent[];
      firstTs: number;
    }
  | { kind: 'global'; event: StreamingLogEvent; firstTs: number };

/**
 * Discriminated union type for tab selection in LiveOutput
 * - results: Show all global events (info, warnings, errors) chronologically
 * - item: Show a specific bubble group or global event by index
 */
export type TabType = { kind: 'results' } | { kind: 'item'; index: number };

/**
 * Bubble group metadata for tab generation
 */
export interface BubbleGroup {
  variableId: string;
  bubbleName: string | undefined;
  displayName: string;
  events: StreamingLogEvent[];
  eventCount: number;
  firstTimestamp: number;
}

/**
 * State interface for per-flow LiveOutput UI state
 */
interface FlowLiveOutputState {
  // ============= UI STATE =============

  /**
   * Currently selected/highlighted tab
   * Default: { kind: 'results' }
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
   * Select a bubble tab by its variableId (programmatic selection)
   * Finds the bubble group and sets the tab to that item
   * @param flowId - The flow ID to get execution events from
   * @param variableId - The variableId of the bubble to select (e.g., 'var_123')
   */
  selectBubbleInConsole: (variableId: string) => void;

  /**
   * Select the Results tab (programmatic selection)
   * Opens the output panel and switches to the Results tab
   */
  selectResultsInConsole: () => void;

  /**
   * Reset state to initial values
   * Called on flow execution start or when cleaning up
   */
  reset: () => void;

  // ============= NON-REACTIVE GETTERS =============
  // These methods read current state without subscribing to updates

  /**
   * Get all events from executionStore (non-reactive)
   * @returns Array of all events for this flow
   */
  getAllEvents: () => StreamingLogEvent[];

  /**
   * Get warning events only (non-reactive)
   * @returns Array of warning events
   */
  getWarningLogs: () => StreamingLogEvent[];

  /**
   * Get error/fatal events only (non-reactive)
   * @returns Array of error events
   */
  getErrorLogs: () => StreamingLogEvent[];

  /**
   * Get info/debug/trace events only (excludes log_line) (non-reactive)
   * @returns Array of info events
   */
  getInfoLogs: () => StreamingLogEvent[];

  /**
   * Group events by variableId and return ordered items (non-reactive)
   * @returns Array of ordered items (bubble groups + global events)
   */
  getOrderedItems: () => OrderedItem[];

  /**
   * Get bubble groups with metadata for tab generation (non-reactive)
   * @param bubbleParameters - Bubble parameters for display name generation
   * @returns Array of bubble groups with display names and event counts
   */
  getBubbleGroups: (bubbleParameters: Record<string, unknown>) => BubbleGroup[];

  /**
   * Get events for a specific tab (non-reactive)
   * @param tab - The tab to get events for
   * @returns Filtered array of events for the specified tab
   */
  getEventsForTab: (tab: TabType) => StreamingLogEvent[];
}

/**
 * Initial/empty state for when flowId is null
 */
const emptyState: FlowLiveOutputState = {
  selectedTab: { kind: 'results' },
  selectedEventIndexByVariableId: {},
  setSelectedTab: () => {},
  setSelectedEventIndex: () => {},
  selectBubbleInConsole: () => {},
  selectResultsInConsole: () => {},
  reset: () => {},
  getAllEvents: () => [],
  getWarningLogs: () => [],
  getErrorLogs: () => [],
  getInfoLogs: () => [],
  getOrderedItems: () => [],
  getBubbleGroups: () => [],
  getEventsForTab: () => [],
};

/**
 * Helper function to get ordered items from execution events
 * Groups events by variableId and returns ordered list
 */
function getOrderedItemsFromEvents(events: StreamingLogEvent[]): OrderedItem[] {
  // Group events by variableId (fallback to bubbleName, then 'global')
  const byVariableId: Record<string, StreamingLogEvent[]> = events.reduce(
    (acc, ev) => {
      // Check for variableId in multiple places:
      // 1. Direct variableId field
      // 2. additionalData.variableId (for info logs and other events)
      // 3. bubbleName as fallback
      const directVariableId = (ev as { variableId?: number }).variableId;
      const additionalDataVariableId = (
        ev.additionalData as { variableId?: number }
      )?.variableId;
      const bubbleName = (ev as { bubbleName?: string }).bubbleName;

      const key = String(
        directVariableId ?? additionalDataVariableId ?? bubbleName ?? 'global'
      );
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    },
    {} as Record<string, StreamingLogEvent[]>
  );

  const globalEvents = byVariableId['global'] ?? [];
  const ts = (e?: StreamingLogEvent) =>
    e ? new Date(e.timestamp).getTime() : 0;
  const variableEntries = Object.entries(byVariableId)
    .filter(([k]) => k !== 'global')
    .sort(([, a], [, b]) => ts(a[0]) - ts(b[0]));

  // Build unified ordered list: groups (by first event) + each global event
  const orderedItems: OrderedItem[] = [];
  for (const [name, evs] of variableEntries) {
    if (evs.length)
      orderedItems.push({
        kind: 'group',
        name,
        events: evs,
        firstTs: ts(evs[0]),
      });
  }
  for (const ev of globalEvents) {
    orderedItems.push({ kind: 'global', event: ev, firstTs: ts(ev) });
  }
  orderedItems.sort((a, b) => a.firstTs - b.firstTs);

  return orderedItems;
}

/**
 * Factory function to create a new LiveOutput store instance
 * @param _flowId - Flow ID (unused but kept for consistency with factory pattern)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createLiveOutputStore(flowId: number) {
  return create<FlowLiveOutputState>((set, get) => ({
    // Initial state
    selectedTab: { kind: 'results' },
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

    selectBubbleInConsole: (variableId) => {
      // Get execution events from executionStore
      const executionState = getExecutionStore(flowId);
      const events = executionState.events || [];

      // Get ordered items
      const orderedItems = getOrderedItemsFromEvents(events);

      // Find the index of the bubble group
      const index = orderedItems.findIndex(
        (item) => item.kind === 'group' && item.name === variableId
      );

      if (index !== -1) {
        // Open the output panel
        useUIStore.getState().setConsolidatedPanelTab('output');
        // Set the selected tab
        get().setSelectedTab({ kind: 'item', index });
      }
    },

    selectResultsInConsole: () => {
      // Open the output panel
      useUIStore.getState().setConsolidatedPanelTab('output');
      // Set the selected tab to Results
      get().setSelectedTab({ kind: 'results' });
    },

    reset: () =>
      set({
        selectedTab: { kind: 'results' },
        selectedEventIndexByVariableId: {},
      }),

    // ============= NON-REACTIVE GETTERS =============
    getAllEvents: () => {
      const executionState = getExecutionStore(flowId);
      return executionState.events || [];
    },

    getWarningLogs: () => {
      const events = get().getAllEvents();
      return events.filter((e) => e.type === 'warn');
    },

    getErrorLogs: () => {
      const events = get().getAllEvents();
      return events.filter((e) => e.type === 'error' || e.type === 'fatal');
    },

    getInfoLogs: () => {
      const events = get().getAllEvents();
      return events.filter(
        (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
      );
    },

    getOrderedItems: () => {
      const events = get().getAllEvents();
      return getOrderedItemsFromEvents(events);
    },

    getBubbleGroups: (bubbleParameters: Record<string, unknown>) => {
      const orderedItems = get().getOrderedItems();

      return orderedItems
        .filter(
          (item): item is Extract<OrderedItem, { kind: 'group' }> =>
            item.kind === 'group'
        )
        .map((item) => {
          const bubbleName = (item.events[0] as { bubbleName?: string })
            .bubbleName;
          const displayName = getVariableNameForDisplay(
            item.name,
            item.events,
            bubbleParameters
          );

          return {
            variableId: item.name,
            bubbleName,
            displayName,
            events: item.events,
            eventCount: item.events.length,
            firstTimestamp: item.firstTs,
          };
        });
    },

    getEventsForTab: (tab: TabType) => {
      const events = get().getAllEvents();

      if (tab.kind === 'results') {
        // Return all global events (info, debug, trace, warn, error, fatal) chronologically
        return events.filter(
          (e) =>
            e.type === 'info' ||
            e.type === 'debug' ||
            e.type === 'trace' ||
            e.type === 'warn' ||
            e.type === 'error' ||
            e.type === 'fatal'
        );
      } else if (tab.kind === 'item') {
        const orderedItems = get().getOrderedItems();
        const item = orderedItems[tab.index];
        if (!item) return [];

        if (item.kind === 'global') {
          return [item.event];
        } else {
          return item.events;
        }
      }

      return [];
    },
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
