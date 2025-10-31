import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';

/**
 * Execution Store - Per-Flow Execution State
 *
 * Philosophy: Each flow gets its own execution state instance
 * Uses factory pattern - call useExecutionStore(flowId) to get state for that flow
 *
 * Separation:
 * - This store: Local execution UI state (highlighting, inputs, credentials, events)
 * - React Query: Server state (execution history, results)
 * - useRunExecution hook: Orchestrates validation, updates, and streaming execution
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
   * Bubbles that are currently running/executing
   * Set of bubble keys (variableIds) that are actively executing
   */
  runningBubbles: Set<string>;

  /**
   * Bubbles that have completed execution with their execution statistics
   * Key: bubbleKey (variableId), Value: execution statistics
   */
  completedBubbles: Record<string, { totalTime: number; count: number }>;

  /**
   * Root bubble IDs that are expanded (showing sub-bubbles)
   */
  expandedRootIds: string[];

  /**
   * Root bubble IDs that are suppressed (manually hidden)
   */
  suppressedRootIds: string[];

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
   * Mark a bubble as currently running
   */
  setBubbleRunning: (bubbleKey: string) => void;

  /**
   * Mark a bubble as no longer running
   */
  setBubbleStopped: (bubbleKey: string) => void;

  /**
   * Mark a bubble as completed with execution time (accumulates multiple executions)
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

  // ============= Actions - Sub-Bubble Visibility =============

  /**
   * Toggle expansion of a root bubble (show/hide sub-bubbles)
   */
  toggleRootExpansion: (nodeId: string) => void;

  /**
   * Set expanded root IDs (for auto-expansion during execution)
   */
  setExpandedRootIds: (ids: string[]) => void;

  /**
   * Get execution statistics from events
   */
  getExecutionStats: () => {
    totalTime: number;
    memoryUsage: number;
    linesExecuted: number;
    bubblesProcessed: number;
  };
}

// Factory function to create a store for a specific flow
function createExecutionStore(flowId: number) {
  console.debug('Creating execution store for flow:', flowId);
  return createWithEqualityFn<FlowExecutionState>(
    (set, get) => ({
      // Initial state
      isRunning: false,
      isValidating: false,
      highlightedBubble: null,
      bubbleWithError: null,
      lastExecutingBubble: null,
      runningBubbles: new Set<string>(),
      completedBubbles: {},
      executionInputs: {},
      pendingCredentials: {},
      expandedRootIds: [],
      suppressedRootIds: [],
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
          runningBubbles: new Set<string>(),
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
          // Clear running bubbles to prevent lingering state that could cause flicker
          runningBubbles: new Set<string>(),
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

      setBubbleRunning: (bubbleKey) =>
        set((state) => ({
          runningBubbles: new Set([...state.runningBubbles, bubbleKey]),
        })),

      setBubbleStopped: (bubbleKey) =>
        set((state) => {
          const newRunningBubbles = new Set(state.runningBubbles);
          newRunningBubbles.delete(bubbleKey);
          return { runningBubbles: newRunningBubbles };
        }),

      setBubbleCompleted: (bubbleKey, executionTimeMs) =>
        set((state) => {
          const existing = state.completedBubbles[bubbleKey];
          return {
            completedBubbles: {
              ...state.completedBubbles,
              [bubbleKey]: {
                totalTime: (existing?.totalTime || 0) + executionTimeMs,
                count: (existing?.count || 0) + 1,
              },
            },
            // Remove from running bubbles when completed
            runningBubbles: (() => {
              const newRunningBubbles = new Set(state.runningBubbles);
              newRunningBubbles.delete(bubbleKey);
              return newRunningBubbles;
            })(),
          };
        }),

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
            const rest = Object.fromEntries(
              Object.entries(bubbleCredentials).filter(
                ([key]) => key !== credType
              )
            );
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
          expandedRootIds: [],
          suppressedRootIds: [],
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

      // Sub-bubble visibility
      toggleRootExpansion: (nodeId) =>
        set((state) => {
          const isExpanded = state.expandedRootIds.includes(nodeId);
          if (isExpanded) {
            return {
              expandedRootIds: state.expandedRootIds.filter(
                (id) => id !== nodeId
              ),
              suppressedRootIds: state.suppressedRootIds.includes(nodeId)
                ? state.suppressedRootIds
                : [...state.suppressedRootIds, nodeId],
            };
          } else {
            return {
              expandedRootIds: [...state.expandedRootIds, nodeId],
              suppressedRootIds: state.suppressedRootIds.filter(
                (id) => id !== nodeId
              ),
            };
          }
        }),

      setExpandedRootIds: (ids) => set({ expandedRootIds: ids }),

      getExecutionStats: () => {
        const { events } = get();

        let totalTime = 0;
        let memoryUsage = 0;
        let linesExecuted = 0;
        let bubblesProcessed = 0;

        for (const event of events) {
          if (event.executionTime) {
            totalTime = Math.max(totalTime, event.executionTime);
          }
          if (event.memoryUsage) {
            memoryUsage = Math.max(memoryUsage, event.memoryUsage);
          }
          if (event.type === 'log_line') {
            linesExecuted++;
          }
          if (
            event.type === 'bubble_complete' ||
            event.type === 'bubble_execution' ||
            event.type === 'bubble_execution_complete'
          ) {
            bubblesProcessed++;
          }
        }

        return {
          totalTime,
          memoryUsage,
          linesExecuted,
          bubblesProcessed,
        };
      },
    }),
    shallow
  );
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
  runningBubbles: new Set<string>(),
  completedBubbles: {},
  executionInputs: {},
  pendingCredentials: {},
  expandedRootIds: [],
  suppressedRootIds: [],
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
  setBubbleRunning: () => {},
  setBubbleStopped: () => {},
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
  toggleRootExpansion: () => {},
  setExpandedRootIds: () => {},
  getExecutionStats: () => ({
    totalTime: 0,
    memoryUsage: 0,
    linesExecuted: 0,
    bubblesProcessed: 0,
  }),
};

/**
 * Hook to get execution state for a specific flow with optional selector
 *
 * The store uses createWithEqualityFn with shallow comparison as the default,
 * so object selectors automatically use shallow comparison to prevent unnecessary re-renders.
 *
 * Usage:
 * ```typescript
 * // Get full state (re-renders on ANY change)
 * const executionState = useExecutionStore(flowId);
 *
 * // Get specific field (re-renders ONLY when that field changes)
 * const isRunning = useExecutionStore(flowId, (state) => state.isRunning);
 *
 * // Get multiple fields with shallow comparison (re-renders when ANY of these fields change)
 * // Shallow comparison is the default, so this prevents re-renders when selector returns new object with same values
 * import { shallow } from 'zustand/shallow';
 * const { isRunning, highlightedBubble } = useExecutionStore(
 *   flowId,
 *   (state) => ({ isRunning: state.isRunning, highlightedBubble: state.highlightedBubble }),
 *   shallow // Optional: explicitly pass shallow (default is already shallow)
 * );
 * ```
 */
export function useExecutionStore(flowId: number | null): FlowExecutionState;
export function useExecutionStore<T>(
  flowId: number | null,
  selector: (state: FlowExecutionState) => T,
  equalityFn?: typeof shallow
): T;
export function useExecutionStore<T>(
  flowId: number | null,
  selector?: (state: FlowExecutionState) => T,
  equalityFn?: typeof shallow
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
  // If selector is provided, use it with optional equality function; otherwise subscribe to full state
  const state = selector
    ? equalityFn
      ? store(selector, equalityFn)
      : store(selector)
    : store();

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
 * Get the store instance for a specific flowId
 * This allows direct access to the store's getState() method
 */
export function getExecutionStoreInstance(flowId: number) {
  if (!executionStores.has(flowId)) {
    executionStores.set(flowId, createExecutionStore(flowId));
  }
  return executionStores.get(flowId)!;
}

/**
 * Get execution store state directly for a specific flowId
 * This provides a clean interface for accessing store state without React hooks
 */
export function getExecutionStore(flowId: number): FlowExecutionState {
  const storeInstance = getExecutionStoreInstance(flowId);
  return storeInstance.getState();
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
