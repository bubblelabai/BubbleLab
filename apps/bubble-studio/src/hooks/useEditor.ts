import { useMemo, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useBubbleFlow } from './useBubbleFlow';
import { toast } from 'react-toastify';
import {
  updateBubbleParamInCode,
  updateCachedBubbleParameters,
} from '../utils/bubbleParamEditor';
import type {
  BubbleParameter,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';

// Re-export for external use
export {
  updateBubbleParamInCode,
  updateCachedBubbleParameters,
  serializeValue,
  getRelatedBubbleVariableIds,
} from '../utils/bubbleParamEditor';

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
  const { data: currentFlow, updateBubbleParameters } = useBubbleFlow(
    flowId || 0
  );

  // Get current editor code
  const currentEditorCode = getEditorCode();

  // Derived state: check if there are unsaved code changes
  const unsavedCode = useMemo(() => {
    if (!currentFlow?.code || !currentEditorCode || !flowId) {
      return false;
    }
    return currentEditorCode !== currentFlow.code;
  }, [currentFlow?.code, currentEditorCode, flowId]);

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

  /**
   * Get bubble parameters map keyed by variableId
   */
  const bubbleParametersById = useMemo(() => {
    const params = (currentFlow?.bubbleParameters || {}) as Record<
      string,
      ParsedBubbleWithInfo
    >;
    const byId: Record<number, ParsedBubbleWithInfo> = {};
    Object.values(params).forEach((bubble) => {
      byId[bubble.variableId] = bubble;
    });
    return byId;
  }, [currentFlow?.bubbleParameters]);

  /**
   * Get a specific parameter value from a bubble
   * @param variableId - The bubble's variableId
   * @param paramName - The parameter name to retrieve
   * @returns The parameter object or undefined
   */
  const getParam = useCallback(
    (variableId: number, paramName: string): BubbleParameter | undefined => {
      const bubble = bubbleParametersById[variableId];
      if (!bubble) return undefined;
      return bubble.parameters.find((p) => p.name === paramName);
    },
    [bubbleParametersById]
  );

  /**
   * Update a bubble parameter in the editor using location-based editing
   * Falls back to regex-based approach if location is not available
   */
  const updateBubbleParam = useCallback(
    (variableId: number, paramName: string, newValue: unknown) => {
      const editorInst = useEditorStore.getState().editorInstance;
      if (!editorInst) {
        toast.error('Editor instance not available');
        return;
      }

      const model = editorInst.getModel();
      if (!model) {
        toast.error('Editor model not available');
        return;
      }

      const bubble = bubbleParametersById[variableId];
      if (!bubble) {
        toast.error(`Bubble not found: ${variableId}`);
        return;
      }

      const currentCode = model.getValue();
      const bubbleParameters = (currentFlow?.bubbleParameters || {}) as Record<
        string,
        ParsedBubbleWithInfo
      >;

      const result = updateBubbleParamInCode(
        currentCode,
        bubbleParameters,
        variableId,
        paramName,
        newValue
      );

      if (result.success) {
        model.setValue(result.code);

        // Update the cached bubbleParameters for ALL related bubbles (original + clones)
        // so subsequent edits find the new value, and adjust line numbers if needed
        const updatedBubbleParameters = updateCachedBubbleParameters(
          bubbleParameters,
          result.relatedVariableIds,
          paramName,
          newValue,
          result.isTemplateLiteral,
          result.lineDiff,
          result.editedBubbleEndLine,
          result.editedParamEndLine
        );
        updateBubbleParameters(updatedBubbleParameters);
      } else {
        toast.error(result.error);
      }
    },
    [
      bubbleParametersById,
      currentFlow?.bubbleParameters,
      updateBubbleParameters,
    ]
  );

  return {
    // Editor state
    editorInstance,
    currentEditorCode,
    unsavedCode,
    // Editor manipulation functions
    editor,
    // Editor store functions
    setExecutionHighlight,
    updateCronSchedule,
    // Bubble param access (centralized in hook)
    getParam,
    updateBubbleParam,
    executionHighlightRange,
  };
}
