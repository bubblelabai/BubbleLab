import { create } from 'zustand';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';

/**
 * Execution Store - Per-Flow Execution State
 *
 * Philosophy: Each flow gets its own execution state instance
 * Uses factory pattern - call useExecutionStore(flowId) to get state for that flow
 *
 * Separation:
 * - This store: Local execution UI state (highlighting, inputs, credentials)
 * - React Query: Server state (execution history, results)
 * - useExecutionStream hook: Streaming logic (syncs to this store)
 */

export interface FlowExecutionState {
  // ============= Runtime Execution State =============

  /**
   * Whether this flow is currently executing
   */
  isRunning: boolean;

  /**
   * Whether this flow is currently being validated
   */
  isValidating: boolean;

  /**
   * Which bubble is currently highlighted (during execution)
   */
  highlightedBubble: string | null;

  /**
   * Which bubble has an error
   */
  bubbleWithError: string | null;

  /**
   * Last bubble that was executing (for error tracking)
   */
  lastExecutingBubble: string | null;

  /**
   * Bubbles that have completed execution with their execution times (in ms)
   * Key: bubbleKey (variableId), Value: execution time in milliseconds
   */
  completedBubbles: Record<string, number>;

  // ============= Execution Data =============

  /**
   * Input values for flow execution
   * Key: input field name, Value: input value
   */
  executionInputs: Record<string, unknown>;

  /**
   * Pending credential selections for this flow
   * Key: bubble name, Value: { credentialType: credentialId }
   */
  pendingCredentials: Record<string, Record<string, number>>;

  // ============= Streaming State =============

  /**
   * Whether execution stream is connected
   */
  isConnected: boolean;

  /**
   * Error from execution (if any)
   */
  error: string | null;

  /**
   * Stream events from execution
   */
  events: StreamingLogEvent[];

  /**
   * Current line being executed
   */
  currentLine: number | null;

  /**
   * AbortController for stopping execution
   */
  abortController: AbortController | null;

  // ============= Actions - Execution Control =============

  /**
   * Start execution for this flow
   */
  startExecution: () => void;

  /**
   * Stop execution for this flow
   */
  stopExecution: () => void;

  /**
   * Start validation
   */
  startValidation: () => void;

  /**
   * Stop validation
   */
  stopValidation: () => void;

  /**
   * Set abort controller for execution
   */
  setAbortController: (controller: AbortController | null) => void;

  // ============= Actions - Visual State =============

  /**
   * Highlight a bubble during execution
   */
  highlightBubble: (bubbleKey: string | null) => void;

  /**
   * Mark a bubble as having an error
   */
  setBubbleError: (bubbleKey: string | null) => void;

  /**
   * Track the last executing bubble
   */
  setLastExecutingBubble: (bubbleKey: string | null) => void;

  /**
   * Mark a bubble as completed with execution time
   */
  setBubbleCompleted: (bubbleKey: string, executionTimeMs: number) => void;

  /**
   * Clear all highlighting
   */
  clearHighlighting: () => void;

  // ============= Actions - Execution Data =============

  /**
   * Set a single input value
   */
  setInput: (field: string, value: unknown) => void;

  /**
   * Set all input values
   */
  setInputs: (inputs: Record<string, unknown>) => void;

  /**
   * Set a credential for a bubble
   */
  setCredential: (
    bubbleName: string,
    credType: string,
    credId: number | null
  ) => void;

  /**
   * Set all credentials for a bubble
   */
  setBubbleCredentials: (
    bubbleName: string,
    credentials: Record<string, number>
  ) => void;

  /**
   * Set all pending credentials
   */
  setAllCredentials: (
    credentials: Record<string, Record<string, number>>
  ) => void;

  // ============= Actions - Streaming State =============

  /**
   * Add an event to the stream
   */
  addEvent: (event: StreamingLogEvent) => void;

  /**
   * Set current executing line
   */
  setCurrentLine: (line: number | null) => void;

  /**
   * Set connection state
   */
  setConnected: (connected: boolean) => void;

  /**
   * Set error state
   */
  setError: (error: string | null) => void;

  /**
   * Clear all events
   */
  clearEvents: () => void;

  // ============= Actions - Reset =============

  /**
   * Reset all state for this flow
   */
  reset: () => void;

  /**
   * Reset only execution runtime state (keep inputs/credentials)
   */
  resetExecution: () => void;
}

// Factory function to create a store for a specific flow
function createExecutionStore(flowId: number) {
  return create<FlowExecutionState>((set, get) => ({
    // Initial state
    isRunning: false,
    isValidating: false,
    highlightedBubble: null,
    bubbleWithError: null,
    lastExecutingBubble: null,
    completedBubbles: {},
    executionInputs: {},
    pendingCredentials: {},
    isConnected: false,
    error: null,
    events: [],
    currentLine: null,
    abortController: null,

    // Execution control
    startExecution: () =>
      set({
        isRunning: true,
        error: null,
        events: [],
        bubbleWithError: null,
        completedBubbles: {},
      }),

    stopExecution: () => {
      const { abortController } = get();
      if (abortController) {
        abortController.abort();
      }
      set({
        isRunning: false,
        isConnected: false,
        abortController: null,
        highlightedBubble: null,
        currentLine: null,
      });
    },

    startValidation: () => set({ isValidating: true }),

    stopValidation: () => set({ isValidating: false }),

    setAbortController: (controller) => set({ abortController: controller }),

    // Visual state
    highlightBubble: (bubbleKey) => set({ highlightedBubble: bubbleKey }),

    setBubbleError: (bubbleKey) => set({ bubbleWithError: bubbleKey }),

    setLastExecutingBubble: (bubbleKey) =>
      set({ lastExecutingBubble: bubbleKey }),

    setBubbleCompleted: (bubbleKey, executionTimeMs) =>
      set((state) => ({
        completedBubbles: {
          ...state.completedBubbles,
          [bubbleKey]: executionTimeMs,
        },
      })),

    clearHighlighting: () =>
      set({
        highlightedBubble: null,
        bubbleWithError: null,
        lastExecutingBubble: null,
      }),

    // Execution data
    setInput: (field, value) =>
      set((state) => ({
        executionInputs: {
          ...state.executionInputs,
          [field]: value,
        },
      })),

    setInputs: (inputs) => set({ executionInputs: inputs }),

    setCredential: (bubbleName, credType, credId) =>
      set((state) => {
        const bubbleCredentials = state.pendingCredentials[bubbleName] || {};

        // If credId is null, remove the credential
        if (credId === null) {
          const { [credType]: removed, ...rest } = bubbleCredentials;
          return {
            pendingCredentials: {
              ...state.pendingCredentials,
              [bubbleName]: rest,
            },
          };
        }

        // Otherwise, add/update the credential
        return {
          pendingCredentials: {
            ...state.pendingCredentials,
            [bubbleName]: {
              ...bubbleCredentials,
              [credType]: credId,
            },
          },
        };
      }),

    setBubbleCredentials: (bubbleName, credentials) =>
      set((state) => ({
        pendingCredentials: {
          ...state.pendingCredentials,
          [bubbleName]: credentials,
        },
      })),

    setAllCredentials: (credentials) =>
      set({ pendingCredentials: credentials }),

    // Streaming state
    addEvent: (event) =>
      set((state) => ({
        events: [...state.events, event],
      })),

    setCurrentLine: (line) => set({ currentLine: line }),

    setConnected: (connected) => set({ isConnected: connected }),

    setError: (error) => set({ error }),

    clearEvents: () => set({ events: [], error: null }),

    // Reset
    reset: () =>
      set({
        isRunning: false,
        isValidating: false,
        highlightedBubble: null,
        bubbleWithError: null,
        lastExecutingBubble: null,
        completedBubbles: {},
        executionInputs: {},
        pendingCredentials: {},
        isConnected: false,
        error: null,
        events: [],
        currentLine: null,
        abortController: null,
      }),

    resetExecution: () =>
      set({
        isRunning: false,
        isValidating: false,
        highlightedBubble: null,
        bubbleWithError: null,
        lastExecutingBubble: null,
        completedBubbles: {},
        isConnected: false,
        error: null,
        events: [],
        currentLine: null,
        abortController: null,
      }),
  }));
}

// Map to store instances per flowId
const executionStores = new Map<
  number,
  ReturnType<typeof createExecutionStore>
>();

// Empty state for when no flow is selected
const emptyState: FlowExecutionState = {
  isRunning: false,
  isValidating: false,
  highlightedBubble: null,
  bubbleWithError: null,
  lastExecutingBubble: null,
  completedBubbles: {},
  executionInputs: {},
  pendingCredentials: {},
  isConnected: false,
  error: null,
  events: [],
  currentLine: null,
  abortController: null,
  startExecution: () => {},
  stopExecution: () => {},
  startValidation: () => {},
  stopValidation: () => {},
  setAbortController: () => {},
  highlightBubble: () => {},
  setBubbleError: () => {},
  setLastExecutingBubble: () => {},
  setBubbleCompleted: () => {},
  clearHighlighting: () => {},
  setInput: () => {},
  setInputs: () => {},
  setCredential: () => {},
  setBubbleCredentials: () => {},
  setAllCredentials: () => {},
  addEvent: () => {},
  setCurrentLine: () => {},
  setConnected: () => {},
  setError: () => {},
  clearEvents: () => {},
  reset: () => {},
  resetExecution: () => {},
};

/**
 * Hook to get execution state for a specific flow with optional selector
 *
 * Usage:
 * ```typescript
 * // Get full state (re-renders on ANY change)
 * const executionState = useExecutionStore(flowId);
 *
 * // Get specific field (re-renders ONLY when that field changes)
 * const isRunning = useExecutionStore(flowId, (state) => state.isRunning);
 *
 * // Get multiple fields (re-renders when ANY of these fields change)
 * const { isRunning, highlightedBubble } = useExecutionStore(
 *   flowId,
 *   (state) => ({ isRunning: state.isRunning, highlightedBubble: state.highlightedBubble })
 * );
 * ```
 */
export function useExecutionStore(flowId: number | null): FlowExecutionState;
export function useExecutionStore<T>(
  flowId: number | null,
  selector: (state: FlowExecutionState) => T
): T;
export function useExecutionStore<T>(
  flowId: number | null,
  selector?: (state: FlowExecutionState) => T
): FlowExecutionState | T {
  // Get or create store for this flowId (or use empty store for null)
  let store: ReturnType<typeof createExecutionStore>;

  if (flowId === null) {
    // Use empty store for null flowId
    if (!executionStores.has(-1)) {
      executionStores.set(-1, createExecutionStore(-1));
    }
    store = executionStores.get(-1)!;
  } else {
    // Get or create store for this flowId
    if (!executionStores.has(flowId)) {
      executionStores.set(flowId, createExecutionStore(flowId));
    }
    store = executionStores.get(flowId)!;
  }

  // ALWAYS call the hook - never return early before this
  // If selector is provided, use it; otherwise subscribe to full state
  const state = selector ? store(selector) : store();

  // Return empty state data if flowId is null, but still subscribe to the store
  if (flowId === null) {
    return selector ? selector(emptyState) : emptyState;
  }

  return state;
}

/**
 * Cleanup function to remove store for a deleted flow
 *
 * Call this when a flow is deleted to prevent memory leaks
 */
export function cleanupExecutionStore(flowId: number): void {
  const store = executionStores.get(flowId);
  if (store) {
    // Reset state before deleting
    store.getState().reset();
    executionStores.delete(flowId);
    console.log(`[ExecutionStore] Cleaned up store for flow ${flowId}`);
  }
}

/**
 * Get all flow IDs that have active execution stores
 *
 * Useful for cleanup - remove stores for flows that no longer exist
 */
export function getActiveExecutionFlows(): number[] {
  return Array.from(executionStores.keys());
}

/**
 * Cleanup stores for flows that are not in the provided list
 *
 * Call this when the flow list changes to clean up deleted flows
 */
export function cleanupDeletedFlows(activeFlowIds: number[]): void {
  const storeFlowIds = getActiveExecutionFlows();

  storeFlowIds.forEach((flowId) => {
    if (!activeFlowIds.includes(flowId)) {
      cleanupExecutionStore(flowId);
    }
  });
}
