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

export type SidePanelMode = 'closed' | 'bubbleList' | 'milktea' | 'pearl';

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
  sidePanelMode: 'closed',
  selectedBubbleName: null,
  targetInsertLine: null,

  // Actions
  navigateToPage: (page) => set({ currentPage: page }),

  selectFlow: (flowId) => set({ selectedFlowId: flowId }),

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
        return { showEditor: true, isSidebarOpen: false };
      }
      return { showEditor: true };
    }),

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
