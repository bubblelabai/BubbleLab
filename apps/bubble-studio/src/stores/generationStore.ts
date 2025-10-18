import { create } from 'zustand';

/**
 * Generation Store - Flow Generation State
 *
 * Philosophy: Manages state for flow code generation
 * Only ONE generation can happen at a time (global state)
 *
 * Separation:
 * - This store: Generation UI state (prompt, preset, streaming status)
 * - useFlowGeneration hook: Actual generation logic (calls AI, parses response)
 */

interface GenerationStore {
  // ============= Generation Input State =============

  /**
   * User's prompt for generating flow code
   */
  generationPrompt: string;

  /**
   * Selected preset/template index (-1 for none)
   */
  selectedPreset: number;

  // ============= Generation Status State =============

  /**
   * Whether code generation is currently streaming
   */
  isStreaming: boolean;

  // ============= Actions =============

  /**
   * Set the generation prompt
   */
  setGenerationPrompt: (prompt: string) => void;

  /**
   * Set the selected preset
   */
  setSelectedPreset: (preset: number) => void;

  /**
   * Start streaming (generation in progress)
   */
  startStreaming: () => void;

  /**
   * Stop streaming (generation complete)
   */
  stopStreaming: () => void;

  /**
   * Clear the prompt (after successful generation)
   */
  clearPrompt: () => void;

  /**
   * Reset all generation state
   */
  reset: () => void;
}

/**
 * Zustand store for flow generation state
 *
 * Usage example:
 * ```typescript
 * const { generationPrompt, setGenerationPrompt, startStreaming } = useGenerationStore();
 *
 * // User types prompt
 * setGenerationPrompt('Create a Slack notification flow');
 *
 * // Start generation
 * startStreaming();
 * await generateCode(generationPrompt);
 * stopStreaming();
 * ```
 */
export const useGenerationStore = create<GenerationStore>((set) => ({
  // Initial state
  generationPrompt: '',
  selectedPreset: -1,
  isStreaming: false,

  // Actions
  setGenerationPrompt: (prompt) => set({ generationPrompt: prompt }),

  setSelectedPreset: (preset) => set({ selectedPreset: preset }),

  startStreaming: () => set({ isStreaming: true }),

  stopStreaming: () => set({ isStreaming: false }),

  clearPrompt: () => set({ generationPrompt: '' }),

  reset: () =>
    set({
      generationPrompt: '',
      selectedPreset: -1,
      isStreaming: false,
    }),
}));

// ============= Derived Selectors =============

/**
 * Check if a preset is selected
 */
export const selectHasPreset = (state: GenerationStore): boolean =>
  state.selectedPreset !== -1;

/**
 * Check if generation can be started
 */
export const selectCanGenerate = (state: GenerationStore): boolean =>
  state.generationPrompt.trim().length > 0 && !state.isStreaming;
