import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useSettingsStore } from '../../stores/settingsStore';

interface CodeRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentCode: string;
  restoredCode: string;
  executionId: number;
  isApplying?: boolean;
}

export function CodeRestoreModal({
  isOpen,
  onClose,
  onConfirm,
  currentCode,
  restoredCode,
  executionId,
  isApplying = false,
}: CodeRestoreModalProps) {
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(
    null
  );
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme);
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs';

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneDiffEditor
  ) => {
    diffEditorRef.current = editor;

    // read only mode for the modified and original editors
    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.updateOptions({
      readOnly: true,
      domReadOnly: true,
    });

    const originalEditor = editor.getOriginalEditor();
    originalEditor.updateOptions({
      readOnly: true,
      domReadOnly: true,
    });
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 dark:bg-sidebar/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background dark:bg-sidebar rounded-lg shadow-xl max-w-6xl w-full mx-4 h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="bg-card px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Preview Code Changes
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review changes from execution #{executionId} before applying
              </p>
            </div>
            <button
              title="Close"
              onClick={onClose}
              disabled={isApplying}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diff Editor */}
        <div
          className="flex-1 overflow-hidden bg-code-background"
          style={{ minHeight: 0 }}
        >
          <DiffEditor
            original={currentCode}
            modified={restoredCode}
            language="typescript"
            theme={monacoTheme}
            onMount={handleEditorDidMount}
            height="100%"
            width="100%"
            options={{
              readOnly: true,
              renderSideBySide: true,
              renderOverviewRuler: true,
              scrollBeyondLastLine: false,
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily:
                'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
              lineNumbers: 'on',
              glyphMargin: true,
              folding: true,
              lineDecorationsWidth: 10,
              lineNumbersMinChars: 3,
              renderLineHighlight: 'all',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                useShadows: false,
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
              },
              diffWordWrap: 'on',
              hideUnchangedRegions: {
                enabled: false, // Show all code for better context
              },
              automaticLayout: true,
            }}
          />
        </div>

        <div className="bg-card px-6 py-4 border-t border-border flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-slate-200 dark:hover:bg-gray-700 border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isApplying}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Applying...
                </>
              ) : (
                'Apply Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
