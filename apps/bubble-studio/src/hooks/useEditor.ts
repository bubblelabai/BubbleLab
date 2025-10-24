import { useMemo } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useBubbleFlow } from './useBubbleFlow';
import {
  getEditorCode,
  setEditorCode,
  insertCodeAtTargetLine,
  replaceAllEditorContent,
} from '../stores/editorStore';

/**
 * Hook for editor manipulation and state
 *
 * @param flowId - The flow ID to get code for comparison
 * @returns Editor manipulation functions and derived state
 */
export function useEditor(flowId: number) {
  const {
    editorInstance,
    targetInsertLine,
    setExecutionHighlight,
    updateCronSchedule,
  } = useEditorStore();
  const { data: currentFlow } = useBubbleFlow(flowId);

  // Get current editor code
  const currentEditorCode = getEditorCode();

  // Derived state: check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!currentFlow?.code || !currentEditorCode) {
      return false;
    }
    return currentEditorCode !== currentFlow.code;
  }, [currentFlow?.code, currentEditorCode]);

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
    targetInsertLine,
    currentEditorCode,
    hasUnsavedChanges,

    // Editor manipulation functions
    editor,

    // Editor store functions
    setExecutionHighlight,
    updateCronSchedule,
  };
}
