import { useMemo } from 'react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import {
  useLiveOutputStore,
  getLiveOutputStore,
  type TabType,
} from '../stores/liveOutputStore';
import { getExecutionStore } from '../stores/executionStore';
import { useBubbleFlow } from './useBubbleFlow';
import { getVariableNameForDisplay } from '../utils/bubbleUtils';
import { useUIStore } from '@/stores/uiStore';

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
 * Helper hook for LiveOutput component
 * Provides reactive state and non-reactive getter methods
 *
 * REACTIVE STATE (causes re-renders):
 * - selectedTab: Currently highlighted tab
 * - selectedEventIndexByVariableId: Slider positions per bubble
 *
 * NON-REACTIVE GETTERS (no re-renders, use .getState()):
 * - getWarningLogs(): Get warning events only
 * - getErrorLogs(): Get error/fatal events only
 * - getInfoLogs(): Get info/debug/trace events only
 * - getBubbleGroups(): Get bubble group metadata
 * - getEventsForTab(tab): Get events for specific tab
 * - getOrderedItems(): Get ordered items for tab generation
 *
 * ACTIONS:
 * - setSelectedTab(tab): Change highlighted tab
 * - setSelectedEventIndex(variableId, index): Change slider position
 * - selectBubbleByVariableId(variableId): Auto-select bubble tab
 *
 * @param flowId - The flow ID (can be null)
 * @returns Hook interface with reactive state and non-reactive getters
 */
export function useLiveOutput(flowId: number | null) {
  // Get bubble flow data for display names
  const currentFlow = useBubbleFlow(flowId);
  const bubbleParameters = currentFlow.data?.bubbleParameters || {};

  // ============= REACTIVE STATE (subscribes to store) =============
  // These will cause re-renders when they change

  const selectedTab = useLiveOutputStore(flowId, (state) => state.selectedTab);
  const selectedEventIndexByVariableId = useLiveOutputStore(
    flowId,
    (state) => state.selectedEventIndexByVariableId
  );

  // ============= ACTIONS =============

  const liveOutputStore = getLiveOutputStore(flowId);

  const setSelectedTab = (tab: TabType) => {
    liveOutputStore?.getState().setSelectedTab(tab);
  };

  const setSelectedEventIndex = (variableId: string, index: number) => {
    liveOutputStore?.getState().setSelectedEventIndex(variableId, index);
  };

  // ============= NON-REACTIVE GETTERS (use .getState(), no subscription) =============
  // These methods read current state without subscribing to updates

  /**
   * Get all events from executionStore (non-reactive)
   * @returns Array of all events for this flow
   */
  const getAllEvents = (): StreamingLogEvent[] => {
    if (flowId === null) return [];
    const executionState = getExecutionStore(flowId);
    return executionState.events || [];
  };

  /**
   * Get warning events only (non-reactive)
   * @returns Array of warning events
   */
  const getWarningLogs = (): StreamingLogEvent[] => {
    const events = getAllEvents();
    return events.filter((e) => e.type === 'warn');
  };

  /**
   * Get error/fatal events only (non-reactive)
   * @returns Array of error events
   */
  const getErrorLogs = (): StreamingLogEvent[] => {
    const events = getAllEvents();
    return events.filter((e) => e.type === 'error' || e.type === 'fatal');
  };

  /**
   * Get info/debug/trace events only (excludes log_line) (non-reactive)
   * @returns Array of info events
   */
  const getInfoLogs = (): StreamingLogEvent[] => {
    const events = getAllEvents();
    return events.filter(
      (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
    );
  };

  /**
   * Group events by variableId and return ordered items (non-reactive)
   * @returns Array of ordered items (bubble groups + global events)
   */
  const getOrderedItems = (): OrderedItem[] => {
    const events = getAllEvents();

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
  };

  /**
   * Get bubble groups with metadata for tab generation (non-reactive)
   * @returns Array of bubble groups with display names and event counts
   */
  const getBubbleGroups = (): BubbleGroup[] => {
    const orderedItems = getOrderedItems();

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
  };

  /**
   * Get events for a specific tab (non-reactive)
   * @param tab - The tab to get events for
   * @returns Filtered array of events for the specified tab
   */
  const getEventsForTab = (tab: TabType): StreamingLogEvent[] => {
    const events = getAllEvents();

    if (tab.kind === 'warnings') {
      return events.filter((e) => e.type === 'warn');
    } else if (tab.kind === 'errors') {
      return events.filter((e) => e.type === 'error' || e.type === 'fatal');
    } else if (tab.kind === 'info') {
      return events.filter(
        (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
      );
    } else if (tab.kind === 'item') {
      const orderedItems = getOrderedItems();
      const item = orderedItems[tab.index];
      if (!item) return [];

      if (item.kind === 'global') {
        return [item.event];
      } else {
        return item.events;
      }
    }

    return [];
  };

  /**
   * Select a bubble tab by its variableId (programmatic selection)
   * Finds the bubble group and sets the tab to that item
   * Wrapper around store action for convenience
   * @param variableId - The variableId of the bubble to select (e.g., 'var_123')
   */
  const selectBubbleInConsole = (variableId: string) => {
    if (flowId === null) return;
    liveOutputStore?.getState().selectBubbleInConsole(variableId);
  };

  return {
    // ============= REACTIVE STATE =============
    // These are subscribed and will cause re-renders when changed
    selectedTab,
    selectedEventIndexByVariableId,

    // ============= ACTIONS =============
    setSelectedTab,
    setSelectedEventIndex,
    selectBubbleInConsole: selectBubbleInConsole,

    // ============= NON-REACTIVE GETTERS =============
    // These use .getState() internally and do NOT cause re-renders
    getAllEvents,
    getWarningLogs,
    getErrorLogs,
    getInfoLogs,
    getBubbleGroups,
    getEventsForTab,
    getOrderedItems,
  };
}
