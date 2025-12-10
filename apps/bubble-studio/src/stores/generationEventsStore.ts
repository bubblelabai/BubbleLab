import { create } from 'zustand';
import type { GenerationStreamingEvent } from '@/types/generation';

/**
 * Generation Events Store - Persists streaming events across component lifecycles
 *
 * This store solves the issue where SSE stream events are lost when components
 * unmount and remount. Events are stored here and persist regardless of
 * React component lifecycle.
 */

interface GenerationEventsState {
  /** Events per flowId */
  eventsByFlowId: Map<number, GenerationStreamingEvent[]>;

  /** Active stream AbortControllers per flowId */
  activeStreams: Map<number, AbortController>;

  /** Whether stream is complete per flowId */
  completedFlows: Set<number>;
}

interface GenerationEventsActions {
  /** Add an event for a flow */
  addEvent: (flowId: number, event: GenerationStreamingEvent) => void;

  /** Get events for a flow */
  getEvents: (flowId: number) => GenerationStreamingEvent[];

  /** Clear events for a flow */
  clearEvents: (flowId: number) => void;

  /** Register an active stream */
  registerStream: (flowId: number, controller: AbortController) => void;

  /** Check if a stream is active */
  hasActiveStream: (flowId: number) => boolean;

  /** Mark a flow as completed */
  markCompleted: (flowId: number) => void;

  /** Check if a flow is completed */
  isCompleted: (flowId: number) => boolean;

  /** Cancel an active stream */
  cancelStream: (flowId: number) => void;

  /** Reset all state for a flow */
  resetFlow: (flowId: number) => void;
}

type GenerationEventsStore = GenerationEventsState & GenerationEventsActions;

export const useGenerationEventsStore = create<GenerationEventsStore>(
  (set, get) => ({
    eventsByFlowId: new Map(),
    activeStreams: new Map(),
    completedFlows: new Set(),

    addEvent: (flowId, event) => {
      set((state) => {
        const newMap = new Map(state.eventsByFlowId);
        const existing = newMap.get(flowId) || [];
        newMap.set(flowId, [...existing, event]);
        return { eventsByFlowId: newMap };
      });
    },

    getEvents: (flowId) => {
      return get().eventsByFlowId.get(flowId) || [];
    },

    clearEvents: (flowId) => {
      set((state) => {
        const newMap = new Map(state.eventsByFlowId);
        newMap.delete(flowId);
        return { eventsByFlowId: newMap };
      });
    },

    registerStream: (flowId, controller) => {
      set((state) => {
        const newMap = new Map(state.activeStreams);
        newMap.set(flowId, controller);
        const newCompleted = new Set(state.completedFlows);
        newCompleted.delete(flowId);
        return { activeStreams: newMap, completedFlows: newCompleted };
      });
    },

    hasActiveStream: (flowId) => {
      return get().activeStreams.has(flowId);
    },

    markCompleted: (flowId) => {
      set((state) => {
        const newStreams = new Map(state.activeStreams);
        newStreams.delete(flowId);
        const newCompleted = new Set(state.completedFlows);
        newCompleted.add(flowId);
        return { activeStreams: newStreams, completedFlows: newCompleted };
      });
    },

    isCompleted: (flowId) => {
      return get().completedFlows.has(flowId);
    },

    cancelStream: (flowId) => {
      const controller = get().activeStreams.get(flowId);
      if (controller) {
        controller.abort();
      }
      set((state) => {
        const newMap = new Map(state.activeStreams);
        newMap.delete(flowId);
        return { activeStreams: newMap };
      });
    },

    resetFlow: (flowId) => {
      const controller = get().activeStreams.get(flowId);
      if (controller) {
        controller.abort();
      }
      set((state) => {
        const newEvents = new Map(state.eventsByFlowId);
        newEvents.delete(flowId);
        const newStreams = new Map(state.activeStreams);
        newStreams.delete(flowId);
        const newCompleted = new Set(state.completedFlows);
        newCompleted.delete(flowId);
        return {
          eventsByFlowId: newEvents,
          activeStreams: newStreams,
          completedFlows: newCompleted,
        };
      });
    },
  })
);

// Selector for subscribing to events for a specific flow
export const selectFlowEvents = (flowId: number | null) => {
  return (state: GenerationEventsStore) => {
    if (!flowId) return [];
    return state.eventsByFlowId.get(flowId) || [];
  };
};
