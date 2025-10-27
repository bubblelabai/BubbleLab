import { create } from 'zustand';
import { GenerationResult } from '@bubblelab/shared-schemas';

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

  /**
   * Generation result with summary and stats (null when not available)
   */
  generationResult: GenerationResult | null;

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
   * Set the generation result (after successful generation)
   */
  setGenerationResult: (result: GenerationResult | null) => void;

  /**
   * Start streaming (generation in progress)
   */
  startStreaming: () => void;

  /**
   * Stop streaming (generation complete)
   */
  stopStreaming: () => void;

  /**
   * Start generation flow - combines startStreaming + navigate to IDE
   * Use this instead of startStreaming() to ensure consistent state
   */
  startGenerationFlow: () => void;

  /**
   * Stop generation flow - only stops streaming, doesn't navigate away
   * User might want to stay on IDE page after generation completes
   */
  stopGenerationFlow: () => void;

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
 * const { generationPrompt, setGenerationPrompt, startGenerationFlow, stopGenerationFlow } = useGenerationStore();
 *
 * // User types prompt
 * setGenerationPrompt('Create a Slack notification flow');
 *
 * // Start generation (automatically navigates to IDE)
 * startGenerationFlow();
 * await generateCode(generationPrompt);
 * stopGenerationFlow();
 * ```
 */
export const useGenerationStore = create<GenerationStore>((set) => ({
  // Initial state
  generationPrompt: '',
  selectedPreset: -1,
  isStreaming: false,
  generationResult: null,

  // Actions
  setGenerationPrompt: (prompt) => set({ generationPrompt: prompt }),

  setSelectedPreset: (preset) => set({ selectedPreset: preset }),

  setGenerationResult: (result) => set({ generationResult: result }),

  startStreaming: () => set({ isStreaming: true }),

  stopStreaming: () => set({ isStreaming: false }),

  startGenerationFlow: () => {
    set({ isStreaming: true });
    // Navigation is now handled by the useFlowGeneration hook after flow creation
  },

  stopGenerationFlow: () => set({ isStreaming: false }),

  clearPrompt: () => set({ generationPrompt: '' }),

  reset: () =>
    set({
      generationPrompt: '',
      selectedPreset: -1,
      isStreaming: false,
      generationResult: null,
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
