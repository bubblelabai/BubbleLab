import { create } from 'zustand';

/**
 * UI Store - Global navigation and panel visibility state
 *
 * Philosophy: Manages all UI chrome - navigation, panels, modals, indicators
 * Does NOT manage domain-specific state (execution, generation, editor)
 */

export type CurrentPage =
  | 'prompt'
  | 'ide'
  | 'credentials'
  | 'flow-summary'
  | 'home';

interface UIStore {
  // ============= Navigation State =============

  /**
   * Current page/view in the application
   */
  currentPage: CurrentPage;

  /**
   * Currently selected flow ID (which flow is being viewed/edited)
   * This is navigation state - determines what's shown in the IDE
   */
  selectedFlowId: number | null;

  // ============= Panel Visibility State =============

  /**
   * Whether the Monaco editor is visible
   */
  showEditor: boolean;

  /**
   * Whether the left panel is visible (currently unused)
   */
  showLeftPanel: boolean;

  /**
   * Whether the sidebar (flow list) is open
   */
  isSidebarOpen: boolean;

  /**
   * Whether the output panel is collapsed
   */
  isOutputCollapsed: boolean;

  // ============= Modal Visibility State =============

  /**
   * Whether the export modal is open
   */
  showExportModal: boolean;

  /**
   * Whether to show the generation prompt info
   */
  showPrompt: boolean;

  // ============= Visual Indicators =============

  // ============= Actions =============

  /**
   * Navigate to a different page
   */
  navigateToPage: (page: CurrentPage) => void;

  /**
   * Select a flow (changes what's shown in the IDE)
   */
  selectFlow: (flowId: number | null) => void;

  /**
   * Toggle editor visibility
   */
  toggleEditor: () => void;

  /**
   * Show the editor
   */
  showEditorPanel: () => void;

  /**
   * Hide the editor
   */
  hideEditorPanel: () => void;

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar: () => void;

  /**
   * Open the sidebar
   */
  openSidebar: () => void;

  /**
   * Close the sidebar
   */
  closeSidebar: () => void;

  /**
   * Collapse the output panel
   */
  collapseOutput: () => void;

  /**
   * Expand the output panel
   */
  expandOutput: () => void;

  /**
   * Toggle export modal
   */
  toggleExportModal: () => void;

  /**
   * Open export modal
   */
  openExportModal: () => void;

  /**
   * Close export modal
   */
  closeExportModal: () => void;

  /**
   * Toggle prompt display
   */
  togglePrompt: () => void;
}

/**
 * Zustand store for UI state
 *
 * Usage example:
 * ```typescript
 * const { currentPage, navigateToPage } = useUIStore();
 * navigateToPage('ide');
 * ```
 */
export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  currentPage: 'prompt',
  selectedFlowId: null,
  showEditor: false,
  showLeftPanel: false,
  isSidebarOpen: false,
  isOutputCollapsed: true,
  showExportModal: false,
  showPrompt: false,

  // Actions
  navigateToPage: (page) => set({ currentPage: page }),

  selectFlow: (flowId) => set({ selectedFlowId: flowId }),

  toggleEditor: () => set((state) => ({ showEditor: !state.showEditor })),

  showEditorPanel: () => set({ showEditor: true }),

  hideEditorPanel: () => set({ showEditor: false }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  openSidebar: () => set({ isSidebarOpen: true }),

  closeSidebar: () => set({ isSidebarOpen: false }),

  collapseOutput: () => set({ isOutputCollapsed: true }),

  expandOutput: () => set({ isOutputCollapsed: false }),

  toggleExportModal: () =>
    set((state) => ({ showExportModal: !state.showExportModal })),

  openExportModal: () => set({ showExportModal: true }),

  closeExportModal: () => set({ showExportModal: false }),

  togglePrompt: () => set((state) => ({ showPrompt: !state.showPrompt })),
}));

// ============= Derived Selectors =============

/**
 * Check if we're on the IDE page
 */
export const selectIsIDEPage = (state: UIStore): boolean =>
  state.currentPage === 'ide';

/**
 * Check if we're on the prompt page
 */
export const selectIsPromptPage = (state: UIStore): boolean =>
  state.currentPage === 'prompt';

/**
 * Check if a flow is selected
 */
export const selectHasSelectedFlow = (state: UIStore): boolean =>
  state.selectedFlowId !== null;
