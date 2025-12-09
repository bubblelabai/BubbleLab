/**
 * CodeDiffView - Shows an inline diff of code changes (only changed lines)
 * Uses Monaco's DiffEditor in inline mode for a compact, focused view
 */
import { useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Check } from 'lucide-react';

interface CodeDiffViewProps {
  originalCode: string;
  modifiedCode: string;
  onAccept: () => void;
  onReject?: () => void;
  isAccepted?: boolean;
}

export function CodeDiffView({
  originalCode,
  modifiedCode,
  onAccept,
  isAccepted = false,
}: CodeDiffViewProps) {
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(
    null
  );

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneDiffEditor
  ) => {
    diffEditorRef.current = editor;

    // Make the editor read-only
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

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-panel">
      {/* Diff Editor */}
      <div className="h-[400px]">
        <DiffEditor
          original={originalCode}
          modified={modifiedCode}
          language="typescript"
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            renderSideBySide: false, // Inline diff view (single column)
            renderOverviewRuler: false,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'none',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            // Only show changes context
            diffWordWrap: 'on',
            // Hide unchanged regions - only show changed lines with context
            hideUnchangedRegions: {
              enabled: true,
              contextLineCount: 3, // Show 3 lines of context around changes
              minimumLineCount: 3, // Hide regions with at least 3 unchanged lines
            },
          }}
        />
      </div>

      {/* Footer with centered action button */}
      <div className="flex items-center justify-center bg-muted/50 border-t border-border px-4 py-2.5">
        {!isAccepted && (
          <button
            onClick={onAccept}
            className="px-6 py-2 text-sm bg-success hover:bg-success/90 text-white rounded-lg transition-colors font-semibold shadow-lg shadow-success/20 hover:shadow-success/30"
          >
            Accept Changes
          </button>
        )}
        {isAccepted && (
          <div className="px-5 py-2 text-sm bg-muted text-foreground rounded-lg flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" />
            Applied
          </div>
        )}
      </div>
    </div>
  );
}
