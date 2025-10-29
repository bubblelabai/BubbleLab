import { create } from 'zustand';

/**
 * UI Store - Global panel visibility and UI state
 *
 * Philosophy: Manages all UI chrome - panels, modals, indicators
 * Does NOT manage domain-specific state (execution, generation, editor)
 * Navigation is now handled by TanStack Router
 */

export type SidePanelMode = 'closed' | 'bubbleList' | 'milktea' | 'pearl';

interface UIStore {
  // ============= Panel State =============

  /**
   * Currently selected flow ID (which flow is being viewed/edited)
   * Used by execution/editor stores to track which flow is active
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

  // ============= Side Panel State =============

  /**
   * Current side panel mode
   */
  sidePanelMode: SidePanelMode;

  /**
   * Currently selected bubble name (for milktea panel)
   */
  selectedBubbleName: string | null;

  /**
   * Target line for code insertion
   */
  targetInsertLine: number | null;

  // ============= Consolidated Side Panel State =============

  /**
   * Whether the consolidated side panel is open
   */
  isConsolidatedPanelOpen: boolean;

  /**
   * Active tab in the consolidated side panel
   */
  consolidatedPanelTab: 'pearl' | 'code' | 'output' | 'history';

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

  // ============= Side Panel Actions =============

  /**
   * Open side panel for bubble list
   */
  openBubbleListPanel: (line: number) => void;

  /**
   * Close side panel
   */
  closeSidePanel: () => void;

  /**
   * Select a bubble (opens milktea panel)
   */
  selectBubble: (bubbleName: string | null) => void;

  /**
   * Open Pearl chat panel
   */
  openPearlChat: () => void;

  // ============= Consolidated Panel Actions =============

  /**
   * Set the active tab in the consolidated side panel
   */
  setConsolidatedPanelTab: (
    tab: 'pearl' | 'code' | 'output' | 'history'
  ) => void;

  /**
   * Open the consolidated side panel with a specific tab
   */
  openConsolidatedPanelWith: (
    tab: 'pearl' | 'code' | 'output' | 'history'
  ) => void;

  /**
   * Toggle the consolidated side panel visibility
   */
  toggleConsolidatedPanel: () => void;

  /**
   * Close the consolidated side panel
   */
  closeConsolidatedPanel: () => void;
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
  selectedFlowId: null,
  showEditor: false,
  showLeftPanel: false,
  isSidebarOpen: false,
  isOutputCollapsed: true,
  showExportModal: false,
  showPrompt: false,
  sidePanelMode: 'closed',
  selectedBubbleName: null,
  targetInsertLine: null,
  isConsolidatedPanelOpen: true,
  consolidatedPanelTab: 'pearl',

  // Actions
  selectFlow: (flowId) => set({ selectedFlowId: flowId, showEditor: false }),

  // If sidebar is open AND trying to open editor, close sidebar
  toggleEditor: () =>
    set((state) => {
      if (state.isSidebarOpen && !state.showEditor) {
        return { showEditor: !state.showEditor, isSidebarOpen: false };
      }
      return { showEditor: !state.showEditor };
    }),

  // Show editor panel and close sidebar if it's open
  showEditorPanel: () =>
    set((state) => {
      if (state.isSidebarOpen) {
        return { isSidebarOpen: false, consolidatedPanelTab: 'code' };
      }
      return { consolidatedPanelTab: 'code' };
    }),

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

  // Side panel actions
  openBubbleListPanel: (line) =>
    set({
      sidePanelMode: 'bubbleList',
      targetInsertLine: line,
      selectedBubbleName: null,
    }),

  closeSidePanel: () =>
    set({
      sidePanelMode: 'closed',
      selectedBubbleName: null,
      targetInsertLine: null,
    }),

  selectBubble: (bubbleName) =>
    set({
      sidePanelMode: bubbleName === null ? 'bubbleList' : 'milktea',
      selectedBubbleName: bubbleName,
      // Keep targetInsertLine from when panel was opened
    }),

  openPearlChat: () =>
    set({
      sidePanelMode: 'pearl',
      selectedBubbleName: null,
      targetInsertLine: null,
    }),

  // Consolidated panel actions
  setConsolidatedPanelTab: (tab) => set({ consolidatedPanelTab: tab }),

  openConsolidatedPanelWith: (tab) =>
    set({
      isConsolidatedPanelOpen: true,
      consolidatedPanelTab: tab,
    }),

  toggleConsolidatedPanel: () =>
    set((state) => ({
      isConsolidatedPanelOpen: !state.isConsolidatedPanelOpen,
    })),

  closeConsolidatedPanel: () => set({ isConsolidatedPanelOpen: false }),
}));

// ============= Derived Selectors =============

/**
 * Check if a flow is selected
 */
export const selectHasSelectedFlow = (state: UIStore): boolean =>
  state.selectedFlowId !== null;

/**
 * Check if side panel is open
 */
export const selectIsSidePanelOpen = (state: UIStore): boolean =>
  state.sidePanelMode !== 'closed';

/**
 * Check if bubble list panel is open
 */
export const selectIsBubbleListOpen = (state: UIStore): boolean =>
  state.sidePanelMode === 'bubbleList' && state.selectedBubbleName === null;

/**
 * Check if milktea panel is open
 */
export const selectIsMilkteaPanelOpen = (state: UIStore): boolean =>
  state.sidePanelMode === 'milktea' && state.selectedBubbleName !== null;

/**
 * Check if Pearl chat panel is open
 */
export const selectIsPearlChatOpen = (state: UIStore): boolean =>
  state.sidePanelMode === 'pearl';
