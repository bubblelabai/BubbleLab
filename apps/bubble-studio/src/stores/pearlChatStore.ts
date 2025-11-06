/**
 * Pearl Chat Store - Pure state management for Pearl AI chat
 *
 * This store manages the conversation state (messages, streaming events, tool calls)
 * without handling API calls. The usePearlChatStore hook combines this with React Query.
 */

import { create } from 'zustand';
import type { ChatMessage } from '../components/ai/type';

// Display event types for chronological rendering
export type DisplayEvent =
  | { type: 'llm_thinking' }
  | {
      type: 'tool_start';
      tool: string;
      input: unknown;
      callId: string;
      startTime: number;
    }
  | {
      type: 'tool_complete';
      tool: string;
      output: unknown;
      duration: number;
      callId: string;
    }
  | { type: 'token'; content: string }
  | { type: 'think'; content: string };

interface PearlChatState {
  // ===== State =====
  messages: ChatMessage[];
  eventsList: DisplayEvent[][];
  activeToolCallIds: Set<string>;

  // ===== State Mutations =====
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Event management
  addEventToCurrentTurn: (event: DisplayEvent) => void;
  startNewTurn: () => void;
  updateLastEvent: (
    updater: (events: DisplayEvent[]) => DisplayEvent[]
  ) => void;

  // Tool call tracking
  addToolCall: (callId: string) => void;
  removeToolCall: (callId: string) => void;
  clearToolCalls: () => void;

  // Reset
  reset: () => void;
}

// Factory pattern - per flow
const stores = new Map<number, ReturnType<typeof createPearlChatStore>>();

function createPearlChatStore(flowId: number) {
  return create<PearlChatState>((set) => ({
    messages: [],
    eventsList: [],
    activeToolCallIds: new Set(),

    addMessage: (message) =>
      set((state) => ({ messages: [...state.messages, message] })),

    clearMessages: () =>
      set({ messages: [], eventsList: [], activeToolCallIds: new Set() }),

    startNewTurn: () =>
      set((state) => ({ eventsList: [...state.eventsList, []] })),

    addEventToCurrentTurn: (event) =>
      set((state) => {
        const updated = [...state.eventsList];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = [...updated[lastIndex], event];
        }
        return { eventsList: updated };
      }),

    updateLastEvent: (updater) =>
      set((state) => {
        const updated = [...state.eventsList];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = updater(updated[lastIndex]);
        }
        return { eventsList: updated };
      }),

    addToolCall: (callId) =>
      set((state) => ({
        activeToolCallIds: new Set([...state.activeToolCallIds, callId]),
      })),

    removeToolCall: (callId) =>
      set((state) => {
        const next = new Set(state.activeToolCallIds);
        next.delete(callId);
        return { activeToolCallIds: next };
      }),

    clearToolCalls: () => set({ activeToolCallIds: new Set() }),

    reset: () =>
      set({ messages: [], eventsList: [], activeToolCallIds: new Set() }),
  }));
}

/**
 * Get or create store for a specific flow
 * Uses flowId -1 as fallback for null flowId to ensure consistent hook behavior
 */
export function getPearlChatStore(flowId: number) {
  if (!stores.has(flowId)) {
    stores.set(flowId, createPearlChatStore(flowId));
  }
  return stores.get(flowId)!;
}

/**
 * Cleanup when flow is deleted
 */
export function deletePearlChatStore(flowId: number) {
  stores.delete(flowId);
}
