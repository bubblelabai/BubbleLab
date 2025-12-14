/**
 * Pearl Chat Store - Pure state management for Pearl AI chat
 *
 * Messages are the source of truth for Coffee state.
 * Use helper functions from type.ts to derive pending state from messages.
 */

import { create } from 'zustand';
import type { ChatMessage } from '../components/ai/type';
import type { CredentialType } from '@bubblelab/shared-schemas';

// Base display event with timestamp for timeline ordering
interface BaseDisplayEvent {
  timestamp: Date;
}

// Display event types for chronological rendering
export type DisplayEvent =
  | (BaseDisplayEvent & { type: 'llm_thinking' })
  | (BaseDisplayEvent & {
      type: 'tool_start';
      tool: string;
      input: unknown;
      callId: string;
      startTime: number;
    })
  | (BaseDisplayEvent & {
      type: 'tool_complete';
      tool: string;
      output: unknown;
      duration: number;
      callId: string;
    })
  | (BaseDisplayEvent & { type: 'token'; content: string })
  | (BaseDisplayEvent & { type: 'think'; content: string })
  | (BaseDisplayEvent & { type: 'llm_complete_content'; content: string })
  // Generation-specific events (unified from generationEventsStore)
  | (BaseDisplayEvent & { type: 'generation_progress'; message: string })
  | (BaseDisplayEvent & {
      type: 'generation_complete';
      summary: string;
      code: string;
    })
  | (BaseDisplayEvent & { type: 'generation_error'; message: string })
  | (BaseDisplayEvent & {
      type: 'retry_attempt';
      attempt: number;
      maxRetries: number;
      delay: number;
    });

// Timeline item: either a message or an event, both have timestamps
export type TimelineItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'event'; data: DisplayEvent };

// Display event without timestamp - used for input to addEvent
// The timestamp is added automatically when the event is stored
export type DisplayEventInput =
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
  | { type: 'think'; content: string }
  | { type: 'llm_complete_content'; content: string }
  | { type: 'generation_progress'; message: string }
  | { type: 'generation_complete'; summary: string; code: string }
  | { type: 'generation_error'; message: string }
  | {
      type: 'retry_attempt';
      attempt: number;
      maxRetries: number;
      delay: number;
    };

interface PearlChatState {
  // ===== Core State =====
  /** Unified timeline: messages and events in chronological order */
  timeline: TimelineItem[];
  /** Messages array - derived from timeline for backward compat */
  messages: ChatMessage[];
  activeToolCallIds: Set<string>;
  prompt: string;

  // Context selection
  selectedBubbleContext: number[];
  selectedTransformationContext: string | null;
  selectedStepContext: string | null;

  // ===== Minimal Coffee State (transient UI state only) =====
  coffeeOriginalPrompt: string | null;
  coffeeContextCredentials: Partial<Record<CredentialType, number>>;
  isCoffeeLoading: boolean;

  // ===== Generation State (unified from generationEventsStore) =====
  isGenerating: boolean;
  generationAbortController: AbortController | null;
  generationCompleted: boolean;

  // ===== State Mutations =====
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Timeline management (unified)
  addToTimeline: (item: TimelineItem) => void;
  addEventToTimeline: (event: DisplayEventInput) => void;
  addMessageToTimeline: (message: ChatMessage) => void;
  /** Update or remove the last event of a specific type */
  updateLastTimelineEvent: (
    updater: (event: DisplayEvent) => DisplayEvent | null
  ) => void;
  /** Remove last event matching a predicate */
  removeLastTimelineEventIf: (
    predicate: (event: DisplayEvent) => boolean
  ) => void;
  /** Update a specific event by callId (for tool_start -> tool_complete) */
  updateTimelineEventByCallId: (
    callId: string,
    updater: (event: DisplayEvent) => DisplayEvent
  ) => void;
  /** Update the last token event or add a new one */
  appendToLastTokenOrAdd: (content: string) => void;
  clearTimeline: () => void;

  // Prompt management
  setPrompt: (prompt: string) => void;
  clearPrompt: () => void;

  // Bubble context management
  addBubbleToContext: (variableId: number) => void;
  removeBubbleFromContext: (variableId: number) => void;
  toggleBubbleInContext: (variableId: number) => void;
  clearBubbleContext: () => void;

  // Transformation context management
  addTransformationToContext: (functionName: string) => void;
  clearTransformationContext: () => void;

  // Step context management
  addStepToContext: (functionName: string) => void;
  clearStepContext: () => void;

  // Event management (uses timeline)
  addEvent: (event: DisplayEventInput) => void;

  // Tool call tracking
  addToolCall: (callId: string) => void;
  removeToolCall: (callId: string) => void;
  clearToolCalls: () => void;

  // ===== Coffee Actions =====
  setCoffeeOriginalPrompt: (prompt: string | null) => void;
  setCoffeeContextCredential: (
    credType: CredentialType,
    credId: number | null
  ) => void;
  clearCoffeeContextCredentials: () => void;
  setIsCoffeeLoading: (loading: boolean) => void;

  // ===== Generation Actions =====
  registerGenerationStream: (controller: AbortController) => void;
  cancelGenerationStream: () => void;
  setIsGenerating: (generating: boolean) => void;
  setGenerationCompleted: (completed: boolean) => void;
  hasActiveGenerationStream: () => boolean;

  // Reset
  reset: () => void;
}

// Factory pattern - per flow
const stores = new Map<number, ReturnType<typeof createPearlChatStore>>();

function createPearlChatStore(_flowId: number) {
  return create<PearlChatState>((set, get) => ({
    // Unified timeline
    timeline: [],
    // Messages array (kept in sync with timeline for backward compat)
    messages: [],
    activeToolCallIds: new Set(),
    prompt: '',
    selectedBubbleContext: [],
    selectedTransformationContext: null,
    selectedStepContext: null,

    // Minimal Coffee state
    coffeeOriginalPrompt: null,
    coffeeContextCredentials: {},
    isCoffeeLoading: false,

    // Generation state (unified from generationEventsStore)
    isGenerating: false,
    generationAbortController: null,
    generationCompleted: false,

    // === Timeline methods (new unified approach) ===
    addToTimeline: (item) =>
      set((state) => ({ timeline: [...state.timeline, item] })),

    addEventToTimeline: (eventWithoutTimestamp) => {
      const event = {
        ...eventWithoutTimestamp,
        timestamp: new Date(),
      } as DisplayEvent;
      set((state) => ({
        timeline: [...state.timeline, { kind: 'event', data: event }],
      }));
    },

    addMessageToTimeline: (message) =>
      set((state) => ({
        timeline: [...state.timeline, { kind: 'message', data: message }],
        messages: [...state.messages, message], // Keep legacy in sync
      })),

    updateLastTimelineEvent: (updater) =>
      set((state) => {
        const timeline = [...state.timeline];
        // Find the last event item
        for (let i = timeline.length - 1; i >= 0; i--) {
          const item = timeline[i];
          if (item.kind === 'event') {
            const updated = updater(item.data);
            if (updated === null) {
              // Remove the event
              timeline.splice(i, 1);
            } else {
              timeline[i] = { kind: 'event', data: updated };
            }
            break;
          }
        }
        return { timeline };
      }),

    removeLastTimelineEventIf: (predicate) =>
      set((state) => {
        const timeline = [...state.timeline];
        for (let i = timeline.length - 1; i >= 0; i--) {
          const item = timeline[i];
          if (item.kind === 'event' && predicate(item.data)) {
            timeline.splice(i, 1);
            break;
          }
        }
        return { timeline };
      }),

    updateTimelineEventByCallId: (callId, updater) =>
      set((state) => {
        const timeline = [...state.timeline];
        for (let i = timeline.length - 1; i >= 0; i--) {
          const item = timeline[i];
          if (
            item.kind === 'event' &&
            'callId' in item.data &&
            item.data.callId === callId
          ) {
            timeline[i] = { kind: 'event', data: updater(item.data) };
            break;
          }
        }
        return { timeline };
      }),

    appendToLastTokenOrAdd: (content) =>
      set((state) => {
        const timeline = [...state.timeline];
        // Find last token event
        for (let i = timeline.length - 1; i >= 0; i--) {
          const item = timeline[i];
          if (item.kind === 'event' && item.data.type === 'token') {
            // Append to existing token
            timeline[i] = {
              kind: 'event',
              data: {
                type: 'token',
                content: item.data.content + content,
                timestamp: item.data.timestamp,
              },
            };
            return { timeline };
          }
          // Stop at first message boundary
          if (item.kind === 'message') break;
        }
        // No token found, add new one
        return {
          timeline: [
            ...timeline,
            {
              kind: 'event',
              data: { type: 'token', content, timestamp: new Date() },
            },
          ],
        };
      }),

    clearTimeline: () =>
      set({
        timeline: [],
        messages: [],
        activeToolCallIds: new Set(),
      }),

    // === Legacy methods (kept for backward compat) ===
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
        timeline: [...state.timeline, { kind: 'message', data: message }],
      })),

    clearMessages: () =>
      set({
        messages: [],
        timeline: [],
        activeToolCallIds: new Set(),
      }),

    setPrompt: (prompt) => set({ prompt }),

    clearPrompt: () => set({ prompt: '' }),

    addBubbleToContext: (variableId) =>
      set((state) => {
        if (state.selectedBubbleContext.includes(variableId)) {
          return state;
        }
        return {
          selectedBubbleContext: [...state.selectedBubbleContext, variableId],
          selectedTransformationContext: null,
          selectedStepContext: null,
        };
      }),

    removeBubbleFromContext: (variableId) =>
      set((state) => ({
        selectedBubbleContext: state.selectedBubbleContext.filter(
          (id) => id !== variableId
        ),
      })),

    toggleBubbleInContext: (variableId) =>
      set((state) => {
        const exists = state.selectedBubbleContext.includes(variableId);
        if (exists) {
          return {
            selectedBubbleContext: state.selectedBubbleContext.filter(
              (id) => id !== variableId
            ),
          };
        } else {
          return {
            selectedBubbleContext: [...state.selectedBubbleContext, variableId],
          };
        }
      }),

    clearBubbleContext: () =>
      set({
        selectedBubbleContext: [],
        selectedTransformationContext: null,
        selectedStepContext: null,
      }),

    addTransformationToContext: (functionName) =>
      set({
        selectedTransformationContext: functionName,
        selectedBubbleContext: [],
        selectedStepContext: null,
      }),

    clearTransformationContext: () =>
      set({ selectedTransformationContext: null }),

    addStepToContext: (functionName) =>
      set({
        selectedStepContext: functionName,
        selectedBubbleContext: [],
        selectedTransformationContext: null,
      }),

    clearStepContext: () => set({ selectedStepContext: null }),

    // Add event to timeline with automatic timestamp
    addEvent: (event) =>
      set((state) => {
        const eventWithTimestamp = {
          ...event,
          timestamp: new Date(),
        } as DisplayEvent;
        return {
          timeline: [
            ...state.timeline,
            { kind: 'event', data: eventWithTimestamp },
          ],
        };
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

    // Coffee actions
    setCoffeeOriginalPrompt: (prompt) => set({ coffeeOriginalPrompt: prompt }),

    setCoffeeContextCredential: (credType, credId) =>
      set((state) => {
        if (credId === null) {
          const updated = { ...state.coffeeContextCredentials };
          delete updated[credType];
          return { coffeeContextCredentials: updated };
        }
        return {
          coffeeContextCredentials: {
            ...state.coffeeContextCredentials,
            [credType]: credId,
          },
        };
      }),

    clearCoffeeContextCredentials: () => set({ coffeeContextCredentials: {} }),

    setIsCoffeeLoading: (loading) => set({ isCoffeeLoading: loading }),

    // Generation actions
    registerGenerationStream: (controller) =>
      set({
        generationAbortController: controller,
        generationCompleted: false,
      }),

    cancelGenerationStream: () => {
      const controller = get().generationAbortController;
      if (controller) controller.abort();
      set({ generationAbortController: null, isGenerating: false });
    },

    setIsGenerating: (generating) => set({ isGenerating: generating }),

    setGenerationCompleted: (completed) =>
      set({
        generationCompleted: completed,
        generationAbortController: null,
        isGenerating: false,
      }),

    hasActiveGenerationStream: () => get().generationAbortController !== null,

    reset: () =>
      set({
        timeline: [],
        messages: [],
        activeToolCallIds: new Set(),
        prompt: '',
        selectedBubbleContext: [],
        selectedTransformationContext: null,
        selectedStepContext: null,
        coffeeOriginalPrompt: null,
        coffeeContextCredentials: {},
        isCoffeeLoading: false,
        isGenerating: false,
        generationAbortController: null,
        generationCompleted: false,
      }),
  }));
}

/**
 * Get or create store for a specific flow
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
