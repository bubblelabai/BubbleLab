import { create } from 'zustand';

/**
 * Output Store - Console Output Management
 *
 * Philosophy: Manages the console/terminal output text
 * Global state - one output log for the application
 * Gets cleared when switching flows or starting new execution
 */

interface OutputStore {
  // ============= Output State =============

  /**
   * Console output text
   */
  output: string;

  // ============= Actions =============

  /**
   * Append text to the output
   */
  appendOutput: (text: string) => void;

  /**
   * Set the output (replaces existing output)
   * Can also accept a function that takes previous output
   */
  setOutput: (output: string | ((prev: string) => string)) => void;

  /**
   * Clear all output
   */
  clearOutput: () => void;
}

/**
 * Zustand store for console output
 *
 * Usage example:
 * ```typescript
 * const { output, appendOutput, clearOutput } = useOutputStore();
 *
 * // Append to output
 * appendOutput('\n✅ Execution completed!');
 *
 * // Clear output
 * clearOutput();
 * ```
 */
export const useOutputStore = create<OutputStore>((set) => ({
  // Initial state
  output:
    'Ready to code! Try the examples above to test TypeScript IntelliSense.',

  // Actions
  appendOutput: (text) =>
    set((state) => ({
      output: state.output + text,
    })),

  setOutput: (output) =>
    set((state) => ({
      output: typeof output === 'function' ? output(state.output) : output,
    })),

  clearOutput: () =>
    set({
      output: '',
    }),
}));
