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

  // ============= Side Panel UI State =============

  /**
   * Whether the bubble insertion side panel is open
   */
  isSidePanelOpen: boolean;

  /**
   * Name of the bubble selected for configuration (e.g., "resend", "slack")
   * Null when in bubble list view, set when user clicks a bubble
   */
  selectedBubbleName: string | null;

  /**
   * Target line number where generated bubble code will be inserted
   * Set when user clicks on a line in the editor to add a bubble
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
   * Open the side panel for bubble insertion at specified line
   * @param line - Line number where bubble will be inserted
   */
  openSidePanel: (line: number) => void;

  /**
   * Close the side panel and reset bubble selection
   */
  closeSidePanel: () => void;

  /**
   * Select a bubble for configuration (transitions to prompt view)
   * @param bubbleName - Name of the bubble (e.g., "resend") or null to go back to list
   */
  selectBubble: (bubbleName: string | null) => void;
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
  isSidePanelOpen: false,
  selectedBubbleName: null,
  targetInsertLine: null,

  // Actions
  setEditorInstance: (instance) => set({ editorInstance: instance }),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  setSelectedRange: (range) => set({ selectedRange: range }),

  openSidePanel: (line) =>
    set({
      isSidePanelOpen: true,
      targetInsertLine: line,
      selectedBubbleName: null, // Reset to list view
    }),

  closeSidePanel: () =>
    set({
      isSidePanelOpen: false,
      selectedBubbleName: null,
      targetInsertLine: null,
    }),

  selectBubble: (bubbleName) =>
    set({
      selectedBubbleName: bubbleName,
    }),
}));

// ============= Derived Selectors =============
// These selector functions derive data from the editor state
// Usage: const errors = useEditorStore(selectTypeScriptErrors);

/**
 * Type information at a position
 */
export interface TypeInfo {
  displayString: string; // e.g., "const foo: string"
  documentation: string; // JSDoc or description
  kind: string; // "variable", "function", "class", etc.
}

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
 * Variable found in the code
 */
export interface VariableInfo {
  name: string;
  type: string; // Inferred type
  kind: 'var' | 'let' | 'const' | 'parameter';
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
  return state.isSidePanelOpen && state.selectedBubbleName === null;
};

/**
 * Check if side panel is in prompt view (bubble selected)
 *
 * @example
 * const isPromptView = useEditorStore(selectIsPromptView);
 */
export const selectIsPromptView = (state: EditorState): boolean => {
  return state.isSidePanelOpen && state.selectedBubbleName !== null;
};

// ============= Async Helper Functions =============
// These are async functions that need to be called directly (not as selectors)
// They fetch data from Monaco's TypeScript worker

/**
 * Get type information at a specific position (async)
 * Call this directly, don't use as a selector
 *
 * @example
 * const typeInfo = await getTypeInfoAtPosition(42, 10);
 */
export async function getTypeInfoAtPosition(
  lineNumber: number,
  column: number
): Promise<TypeInfo | null> {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) return null;

  const model = editorInstance.getModel();
  if (!model) return null;

  try {
    const position = { lineNumber, column };
    const offset = model.getOffsetAt(position);

    const worker = await monaco.languages.typescript.getTypeScriptWorker();
    const client = await worker(model.uri);

    const quickInfo = await client.getQuickInfoAtPosition(
      model.uri.toString(),
      offset
    );

    if (!quickInfo) return null;

    return {
      displayString:
        quickInfo.displayParts?.map((p: { text: string }) => p.text).join('') ||
        '',
      documentation:
        quickInfo.documentation
          ?.map((d: { text: string }) => d.text)
          .join('\n') || '',
      kind: quickInfo.kind || 'unknown',
    };
  } catch (error) {
    console.error('Failed to get type info:', error);
    return null;
  }
}

/**
 * Get available variables at a specific position (async)
 * Call this directly, don't use as a selector
 *
 * @example
 * const vars = await getAvailableVariables(42, 1);
 */
export async function getAvailableVariables(
  lineNumber: number,
  column: number = 1
): Promise<VariableInfo[]> {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) return [];

  const model = editorInstance.getModel();
  if (!model) return [];

  try {
    const position = { lineNumber, column };
    const offset = model.getOffsetAt(position);

    const worker = await monaco.languages.typescript.getTypeScriptWorker();
    const client = await worker(model.uri);

    const completions = await client.getCompletionsAtPosition(
      model.uri.toString(),
      offset
    );

    if (!completions) return [];

    const variables: VariableInfo[] = [];

    for (const entry of completions.entries) {
      if (
        entry.kind === 'var' ||
        entry.kind === 'let' ||
        entry.kind === 'const' ||
        entry.kind === 'parameter'
      ) {
        const details = await client.getCompletionEntryDetails(
          model.uri.toString(),
          offset,
          entry.name
        );

        variables.push({
          name: entry.name,
          type:
            details?.displayParts
              ?.map((p: { text: string }) => p.text)
              .join('') || 'unknown',
          kind: entry.kind as VariableInfo['kind'],
        });
      }
    }

    return variables;
  } catch (error) {
    console.error('Failed to get available variables:', error);
    return [];
  }
}

/**
 * Get code context for AI (MilkTea API) - async
 * Call this directly before calling MilkTea API
 *
 * @example
 * const context = await getCodeContextForAI();
 * if (context) {
 *   await callMilkTeaAPI({ currentCode: context.fullCode, ... });
 * }
 */
export async function getCodeContextForAI(): Promise<{
  fullCode: string;
  contextCode: string;
  availableVariables: VariableInfo[];
  insertLine: number;
  insertLocation: string;
} | null> {
  const { editorInstance, targetInsertLine } = useEditorStore.getState();
  if (!editorInstance || !targetInsertLine) return null;

  const model = editorInstance.getModel();
  if (!model) return null;

  // Get full code
  const fullCode = model.getValue();

  // Get surrounding context (10 lines before, 5 after)
  const startLine = Math.max(1, targetInsertLine - 10);
  const endLine = Math.min(model.getLineCount(), targetInsertLine + 5);
  const contextCode = model.getValueInRange({
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine),
  });

  // Get available variables
  const availableVariables = await getAvailableVariables(targetInsertLine, 1);

  // Look for insert location marker
  const lineContent = model.getLineContent(targetInsertLine);
  const insertLocation =
    lineContent.match(/\/\/\s*(INSERT[_\s]?(LOCATION|HERE|POINT))/i)?.[0] ||
    `// Line ${targetInsertLine}`;

  return {
    fullCode,
    contextCode,
    availableVariables,
    insertLine: targetInsertLine,
    insertLocation,
  };
}

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
