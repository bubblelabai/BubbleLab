import { create } from 'zustand';
import * as monaco from 'monaco-editor';

/**
 * Monaco Editor State Store
 *
 * Philosophy: Store minimal state, derive everything else from Monaco's APIs
 *
 * What we store:
 * - editorInstance: Reference to Monaco editor for API access
 * - cursorPosition: Current cursor location (line, column)
 * - selectedRange: Currently selected text range (if any)
 * - Side panel UI state: Controls the bubble insertion panel
 *
 * What we DON'T store (fetch on-demand from Monaco instead):
 * - Variable types: Use TypeScript worker's getQuickInfoAtPosition()
 * - Errors/diagnostics: Use monaco.editor.getModelMarkers()
 * - Available variables: Use TypeScript worker's getCompletionsAtPosition()
 * - Code intelligence: Use Monaco's language service APIs
 */

/**
 * Cursor position in the editor
 */
export interface CursorPosition {
  lineNumber: number;
  column: number;
}

/**
 * Selected range in the editor (includes start and end positions)
 */
export interface SelectedRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Execution highlight range (line-based only, for highlighting during execution)
 */
export interface ExecutionHighlightRange {
  startLine: number;
  endLine: number;
}

/**
 * Side panel modes
 */
export type SidePanelMode = 'closed' | 'bubbleList' | 'milktea' | 'pearl';

/**
 * Editor state interface
 */
interface EditorState {
  // ============= Core Editor State =============

  /**
   * Reference to the Monaco editor instance
   * Used to call Monaco APIs for code intelligence
   */
  editorInstance: monaco.editor.IStandaloneCodeEditor | null;

  /**
   * Current cursor position in the editor
   * Tracked for determining where to insert code and for type lookups
   */
  cursorPosition: CursorPosition | null;

  /**
   * Currently selected range (if user has selected text)
   * Null if no selection exists
   */
  selectedRange: SelectedRange | null;

  /**
   * Execution highlight range (for highlighting code during execution)
   * Different from selectedRange - this is for visual feedback during flow execution
   */
  executionHighlightRange: ExecutionHighlightRange | null;

  // ============= Side Panel UI State =============

  /**
   * Current mode of the side panel
   * - 'closed': Panel is not visible
   * - 'bubbleList': Showing list of available bubbles
   * - 'milktea': Configuring a specific bubble with MilkTea AI
   * - 'pearl': General AI chat with Pearl (can read/replace entire code)
   */
  sidePanelMode: SidePanelMode;

  /**
   * Name of the bubble being configured in MilkTea mode (e.g., "resend", "slack")
   * Only used when sidePanelMode is 'milktea'
   */
  selectedBubbleName: string | null;

  /**
   * Target line number where generated bubble code will be inserted
   * Only used when sidePanelMode is 'milktea'
   * Null when in Pearl mode (replaces entire content)
   */
  targetInsertLine: number | null;

  // ============= Actions =============

  /**
   * Set the Monaco editor instance reference
   * Called once when editor mounts
   */
  setEditorInstance: (
    instance: monaco.editor.IStandaloneCodeEditor | null
  ) => void;

  /**
   * Update cursor position when user moves cursor
   */
  setCursorPosition: (position: CursorPosition | null) => void;

  /**
   * Update selected range when user selects text
   * Pass null to clear selection
   */
  setSelectedRange: (range: SelectedRange | null) => void;

  /**
   * Set execution highlight range (for visual feedback during execution)
   */
  setExecutionHighlight: (range: ExecutionHighlightRange | null) => void;

  /**
   * Clear execution highlight
   */
  clearExecutionHighlight: () => void;

  /**
   * Open the side panel in bubble list mode at specified line
   * @param line - Line number where bubble will be inserted
   */
  openSidePanel: (line: number) => void;

  /**
   * Close the side panel and reset state
   */
  closeSidePanel: () => void;

  /**
   * Select a bubble for configuration (transitions to MilkTea mode)
   * @param bubbleName - Name of the bubble (e.g., "resend") or null to go back to list
   */
  selectBubble: (bubbleName: string | null) => void;

  /**
   * Open Pearl chat mode (general AI chat - can read/replace entire code)
   */
  openPearlChat: () => void;
}

/**
 * Zustand store for Monaco editor state
 *
 * Usage example:
 * ```typescript
 * const { editorInstance, cursorPosition, openSidePanel } = useEditorStore();
 *
 * // Open side panel when user clicks line 42
 * openSidePanel(42);
 *
 * // Get type info at current cursor
 * const typeInfo = await getTypeInfoAtPosition(
 *   editorInstance,
 *   cursorPosition.lineNumber,
 *   cursorPosition.column
 * );
 * ```
 */
export const useEditorStore = create<EditorState>((set) => ({
  // Initial state
  editorInstance: null,
  cursorPosition: null,
  selectedRange: null,
  executionHighlightRange: null,
  sidePanelMode: 'closed',
  selectedBubbleName: null,
  targetInsertLine: null,

  // Actions
  setEditorInstance: (instance) => set({ editorInstance: instance }),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  setSelectedRange: (range) => set({ selectedRange: range }),

  setExecutionHighlight: (range) => set({ executionHighlightRange: range }),

  clearExecutionHighlight: () => set({ executionHighlightRange: null }),

  openSidePanel: (line) =>
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
    set(() => ({
      sidePanelMode: bubbleName === null ? 'bubbleList' : 'milktea',
      selectedBubbleName: bubbleName,
      // Keep targetInsertLine from when panel was opened
    })),

  openPearlChat: () =>
    set({
      sidePanelMode: 'pearl',
      selectedBubbleName: null,
      targetInsertLine: null,
    }),
}));

// ============= Derived Selectors =============
// These selector functions derive data from the editor state
// Usage: const errors = useEditorStore(selectTypeScriptErrors);

/**
 * TypeScript diagnostic (error/warning/info)
 */
export interface Diagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string | number;
}

/**
 * Get all TypeScript errors/warnings/hints in the current file
 *
 * @example
 * const errors = useEditorStore(selectTypeScriptErrors);
 * const errorCount = errors.filter(e => e.severity === 'error').length;
 */
export const selectTypeScriptErrors = (state: EditorState): Diagnostic[] => {
  if (!state.editorInstance) return [];

  const model = state.editorInstance.getModel();
  if (!model) return [];

  const markers = monaco.editor.getModelMarkers({
    resource: model.uri,
  });

  return markers.map((marker) => ({
    line: marker.startLineNumber,
    column: marker.startColumn,
    endLine: marker.endLineNumber,
    endColumn: marker.endColumn,
    message: marker.message,
    severity: ['hint', 'info', 'warning', 'error'][
      marker.severity - 1
    ] as Diagnostic['severity'],
    code:
      typeof marker.code === 'string' || typeof marker.code === 'number'
        ? marker.code
        : typeof marker.code === 'object' && marker.code?.value
          ? marker.code.value
          : 'unknown',
  }));
};

/**
 * Get the current line content at cursor position
 *
 * @example
 * const lineContent = useEditorStore(selectCurrentLineContent);
 */
export const selectCurrentLineContent = (state: EditorState): string => {
  if (!state.editorInstance || !state.cursorPosition) return '';

  const model = state.editorInstance.getModel();
  if (!model) return '';

  return model.getLineContent(state.cursorPosition.lineNumber);
};

/**
 * Get the content at target insert line
 *
 * @example
 * const insertLineContent = useEditorStore(selectInsertLineContent);
 */
export const selectInsertLineContent = (state: EditorState): string => {
  if (!state.editorInstance || !state.targetInsertLine) return '';

  const model = state.editorInstance.getModel();
  if (!model) return '';

  return model.getLineContent(state.targetInsertLine);
};

/**
 * Get full code from editor
 *
 * @example
 * const fullCode = useEditorStore(selectFullCode);
 */
export const selectFullCode = (state: EditorState): string => {
  if (!state.editorInstance) return '';

  const model = state.editorInstance.getModel();
  if (!model) return '';

  return model.getValue();
};

/**
 * Get selected text content
 *
 * @example
 * const selectedText = useEditorStore(selectSelectedText);
 */
export const selectSelectedText = (state: EditorState): string => {
  if (!state.editorInstance || !state.selectedRange) return '';

  const model = state.editorInstance.getModel();
  if (!model) return '';

  return model.getValueInRange(state.selectedRange);
};

/**
 * Check if side panel is in bubble list view (no bubble selected)
 *
 * @example
 * const isListView = useEditorStore(selectIsListView);
 */
export const selectIsListView = (state: EditorState): boolean => {
  return (
    state.sidePanelMode === 'bubbleList' && state.selectedBubbleName === null
  );
};

/**
 * Check if side panel is in prompt view (bubble selected)
 *
 * @example
 * const isPromptView = useEditorStore(selectIsPromptView);
 */
export const selectIsPromptView = (state: EditorState): boolean => {
  return state.sidePanelMode === 'milktea' && state.selectedBubbleName !== null;
};

/**
 * Check if side panel is in general chat view
 *
 * @example
 * const isGeneralChatView = useEditorStore(selectIsGeneralChatView);
 */
export const selectIsGeneralChatView = (state: EditorState): boolean => {
  return state.sidePanelMode === 'pearl';
};

// ============= Editor Manipulation Functions =============
// These functions modify editor content

/**
 * Insert code at target insert line
 * Call this after getting code from MilkTea
 *
 * @example
 * insertCodeAtTargetLine('const result = await bubble.action();');
 */
export function insertCodeAtTargetLine(
  code: string,
  replaceExistingLine = false
): void {
  const { editorInstance, targetInsertLine } = useEditorStore.getState();
  if (!editorInstance || !targetInsertLine) return;

  const model = editorInstance.getModel();
  if (!model) return;

  const lineCount = model.getLineCount();
  const targetLine = Math.min(targetInsertLine, lineCount);

  if (replaceExistingLine) {
    // Replace entire line
    const lineMaxColumn = model.getLineMaxColumn(targetLine);
    const range = {
      startLineNumber: targetLine,
      startColumn: 1,
      endLineNumber: targetLine,
      endColumn: lineMaxColumn,
    };

    editorInstance.executeEdits('insert-bubble-code', [
      {
        range,
        text: code,
      },
    ]);
  } else {
    // Insert above the line
    const range = {
      startLineNumber: targetLine,
      startColumn: 1,
      endLineNumber: targetLine,
      endColumn: 1,
    };

    editorInstance.executeEdits('insert-bubble-code', [
      {
        range,
        text: code + '\n',
      },
    ]);
  }

  // Move cursor to inserted code
  const newPosition = {
    lineNumber: targetLine,
    column: 1,
  };
  editorInstance.setPosition(newPosition);
  editorInstance.revealLineInCenter(targetLine);
  editorInstance.focus();
}

/**
 * Replace entire editor content
 * Call this when getting code from general chat mode
 *
 * @example
 * replaceAllEditorContent('// New complete workflow\n...');
 */
export function replaceAllEditorContent(code: string): void {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) return;

  const model = editorInstance.getModel();
  if (!model) return;

  // Replace entire content
  const fullRange = model.getFullModelRange();

  editorInstance.executeEdits('replace-all-code', [
    {
      range: fullRange,
      text: code,
    },
  ]);

  // Move cursor to the beginning
  const newPosition = {
    lineNumber: 1,
    column: 1,
  };
  editorInstance.setPosition(newPosition);
  editorInstance.revealLineInCenter(1);
  editorInstance.focus();
}

// ============= Code Helper Functions =============
// Monaco's model is the source of truth for code
// These helpers make it easy to read/write code without prop drilling

/**
 * Get the current code from Monaco editor
 *
 * @returns The current code string, or empty string if editor not ready
 *
 * @example
 * const code = getEditorCode();
 * await api.post('/validate', { code });
 */
export function getEditorCode(): string {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) {
    console.warn(
      '[EditorStore] Cannot get code: editor instance not available'
    );
    return '';
  }

  const model = editorInstance.getModel();
  if (!model) {
    console.warn('[EditorStore] Cannot get code: model not available');
    return '';
  }

  return model.getValue();
}

/**
 * Set code in the Monaco editor
 *
 * @param code - The code to set
 *
 * @example
 * // Load flow code
 * setEditorCode(currentFlow.code);
 *
 * // Set generated code
 * setEditorCode(generatedResult.code);
 */
export function setEditorCode(code: string): void {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) {
    console.warn(
      '[EditorStore] Cannot set code: editor instance not available'
    );
    return;
  }

  const model = editorInstance.getModel();
  if (!model) {
    console.warn('[EditorStore] Cannot set code: model not available');
    return;
  }

  model.setValue(code);
  console.log('[EditorStore] Code set:', code.length, 'characters');
}
