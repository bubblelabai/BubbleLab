import { useMemo, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useBubbleFlow } from './useBubbleFlow';
import { useSyncCode } from './useSyncCode';

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
function getEditorCode(): string {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) {
    // console.warn(
    //   '[EditorStore] Cannot get code: editor instance not available'
    // );
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
function setEditorCode(code: string): void {
  const { editorInstance, setPendingCode } = useEditorStore.getState();

  if (!editorInstance) {
    console.log('[EditorStore] Editor not ready, storing as pending code');
    setPendingCode(code);
    return;
  }

  const model = editorInstance.getModel();
  if (!model) {
    console.log('[EditorStore] Model not ready, storing as pending code');
    setPendingCode(code);
    return;
  }

  model.setValue(code);
  console.log('[EditorStore] Code set:', code.length, 'characters');
}

/**
 * Insert code at target insert line
 * Call this after getting code from MilkTea
 *
 * @example
 * insertCodeAtTargetLine('const result = await bubble.action();');
 */
function insertCodeAtTargetLine(
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
function replaceAllEditorContent(code: string): void {
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

/**
 * Hook for editor manipulation and state
 *
 * @param flowId - The flow ID to get code for comparison (optional for general editor functions)
 * @returns Editor manipulation functions and derived state
 */
export function useEditor(flowId?: number) {
  const {
    editorInstance,
    setExecutionHighlight,
    updateCronSchedule,
    executionHighlightRange,
  } = useEditorStore();
  const { data: currentFlow } = useBubbleFlow(flowId || 0);
  const { syncCode } = useSyncCode({ flowId: flowId || null });

  // Get current editor code
  const currentEditorCode = getEditorCode();

  // Debounce timer ref
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedCodeRef = useRef<string>('');

  // Derived state: check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!currentFlow?.code || !currentEditorCode || !flowId) {
      return false;
    }
    return currentEditorCode !== currentFlow.code;
  }, [currentFlow?.code, currentEditorCode, flowId]);

  // Reset sync state when flowId changes
  useEffect(() => {
    lastSyncedCodeRef.current = '';
  }, [flowId]);

  // Set up code change listener to sync code
  useEffect(() => {
    if (!editorInstance || !flowId) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    // Debounced sync function
    const debouncedSync = (code: string) => {
      // Clear existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // Skip if code hasn't changed
      if (code === lastSyncedCodeRef.current) {
        return;
      }

      // Set new timeout
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await syncCode(code);
          lastSyncedCodeRef.current = code;
        } catch (error) {
          // Silently fail - sync is best-effort, validation will catch errors
          console.debug('[useEditor] Failed to sync code:', error);
        }
      }, 500); // 500ms debounce
    };

    // Listen to model content changes
    const disposable = model.onDidChangeContent(() => {
      const code = model.getValue();
      debouncedSync(code);
    });

    // Initial sync if there's code
    const initialCode = model.getValue();
    if (initialCode && initialCode !== lastSyncedCodeRef.current) {
      debouncedSync(initialCode);
    }

    // Cleanup
    return () => {
      disposable.dispose();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [editorInstance, flowId, syncCode]);

  // Editor manipulation functions
  const editor = {
    // Get current code from editor
    getCode: () => getEditorCode(),

    // Set code in editor
    setCode: (code: string) => setEditorCode(code),

    // Insert code at target line
    insertCodeAtLine: (code: string, replaceExistingLine = false) => {
      insertCodeAtTargetLine(code, replaceExistingLine);
    },

    // Replace all editor content
    replaceAllContent: (code: string) => {
      replaceAllEditorContent(code);
    },

    // Load flow code into editor
    loadFlowCode: () => {
      if (currentFlow?.code) {
        setEditorCode(currentFlow.code);
      }
    },

    // Reset to flow code (discard unsaved changes)
    resetToFlowCode: () => {
      if (currentFlow?.code) {
        setEditorCode(currentFlow.code);
      }
    },
  };

  return {
    // Editor state
    editorInstance,
    currentEditorCode,
    hasUnsavedChanges,
    // Editor manipulation functions
    editor,
    // Editor store functions
    setExecutionHighlight,
    updateCronSchedule,
    executionHighlightRange,
  };
}
