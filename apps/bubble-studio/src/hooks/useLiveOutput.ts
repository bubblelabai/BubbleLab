import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import {
  useLiveOutputStore,
  getLiveOutputStore,
  type TabType,
  type OrderedItem,
  type BubbleGroup,
} from '../stores/liveOutputStore';

/**
 * Helper hook for LiveOutput component
 * Provides reactive state and non-reactive getter methods
 *
 * REACTIVE STATE (causes re-renders):
 * - selectedTab: Currently highlighted tab
 * - selectedEventIndexByVariableId: Slider positions per bubble
 *
 * ACTIONS:
 * - setSelectedTab(tab): Change highlighted tab
 * - setSelectedEventIndex(variableId, index): Change slider position
 * - selectBubbleByVariableId(variableId): Auto-select bubble tab
 *
 * NON-REACTIVE GETTERS (no re-renders, use .getState()):
 * - getAllEvents(): Get all events
 * - getWarningLogs(): Get warning events only
 * - getErrorLogs(): Get error/fatal events only
 * - getInfoLogs(): Get info/debug/trace events only
 * - getBubbleGroups(bubbleParameters): Get bubble group metadata
 * - getEventsForTab(tab): Get events for specific tab
 * - getOrderedItems(): Get ordered items for tab generation
 *
 * @param flowId - The flow ID (can be null)
 * @returns Hook interface with reactive state and non-reactive getters
 */
export function useLiveOutput(flowId: number | null) {
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

  // ============= NON-REACTIVE GETTERS (use .getState(), no subscription) =============
  // These methods read current state without subscribing to updates

  const getAllEvents = (): StreamingLogEvent[] => {
    return liveOutputStore?.getState().getAllEvents() || [];
  };

  const getWarningLogs = (): StreamingLogEvent[] => {
    return liveOutputStore?.getState().getWarningLogs() || [];
  };

  const getErrorLogs = (): StreamingLogEvent[] => {
    return liveOutputStore?.getState().getErrorLogs() || [];
  };

  const getInfoLogs = (): StreamingLogEvent[] => {
    return liveOutputStore?.getState().getInfoLogs() || [];
  };

  const getOrderedItems = (): OrderedItem[] => {
    return liveOutputStore?.getState().getOrderedItems() || [];
  };

  const getBubbleGroups = (
    bubbleParameters: Record<string, unknown>
  ): BubbleGroup[] => {
    return liveOutputStore?.getState().getBubbleGroups(bubbleParameters) || [];
  };

  const getEventsForTab = (tab: TabType): StreamingLogEvent[] => {
    return liveOutputStore?.getState().getEventsForTab(tab) || [];
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
