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
          const { [credType]: _, ...rest } = bubbleCredentials;
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
 * Hook to get execution state for a specific flow
 *
 * Usage:
 * ```typescript
 * function FlowVisualizer({ flowId }: { flowId: number }) {
 *   const executionState = useExecutionStore(flowId);
 *   const { isRunning, highlightedBubble, setInput } = executionState;
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useExecutionStore(flowId: number | null): FlowExecutionState {
  if (flowId === null) {
    return emptyState;
  }

  // Get or create store for this flowId
  if (!executionStores.has(flowId)) {
    executionStores.set(flowId, createExecutionStore(flowId));
  }

  const store = executionStores.get(flowId)!;
  return store();
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
