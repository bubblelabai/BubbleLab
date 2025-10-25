import { create } from 'zustand';
import * as monaco from 'monaco-editor';
import { toast } from 'react-toastify';

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
   * Update cron schedule in the editor
   * @param newSchedule - The new cron schedule expression
   * @throws Error if readonly cronSchedule constant is not found
   */
  updateCronSchedule: (newSchedule: string) => void;
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

  updateCronSchedule: (newSchedule: string) => {
    const { editorInstance } = useEditorStore.getState();
    if (!editorInstance) {
      toast.error('Editor instance not available');
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      toast.error('Editor model not available');
      return;
    }

    const currentCode = model.getValue();
    const lines = currentCode.split('\n');

    // Look for existing readonly cronSchedule line (case-insensitive)
    let cronScheduleLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('readonly cronschedule') && line.includes('=')) {
        cronScheduleLineIndex = i;
        break;
      }
    }

    if (cronScheduleLineIndex === -1) {
      // If no existing line found, throw error as required
      toast.error('Cron schedule not found');
    }

    // Update the cron schedule line
    const updatedLine = `readonly cronSchedule = '${newSchedule}';`;
    lines[cronScheduleLineIndex] = updatedLine;

    // Set the updated code back to the editor
    const updatedCode = lines.join('\n');
    model.setValue(updatedCode);
  },
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
