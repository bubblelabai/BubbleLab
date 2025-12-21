import { useRef, useState, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../stores/editorStore';
import { setConfiguredMonaco } from '../utils/editorContext';
import { useUIStore } from '../stores/uiStore';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import {
  loadMonacoTypes,
  loadBubbleCoreTypes,
} from '../utils/monacoTypeLoader';

// Import Monaco workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure Monaco environment for web workers
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// Configure Monaco to use the local version instead of CDN
loader.config({ monaco });

export function MonacoEditor() {
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const rangeDecorationRef = useRef<string[]>([]);

  // Connect to Zustand store
  const setEditorInstance = useEditorStore((state) => state.setEditorInstance);
  const setCursorPosition = useEditorStore((state) => state.setCursorPosition);
  const setSelectedRange = useEditorStore((state) => state.setSelectedRange);
  const executionHighlightRange = useEditorStore(
    (state) => state.executionHighlightRange
  );
  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  const { data: selectedFlow } = useBubbleFlow(selectedFlowId);

  const handleEditorDidMount = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    editorRef.current = editor;

    // Store the configured Monaco instance for TypeScript worker access
    setConfiguredMonaco(monacoInstance);

    // Store editor instance in Zustand
    setEditorInstance(editor);

    // Prevent Google Translate from modifying the editor DOM
    const editorDomNode = editor.getDomNode();
    if (editorDomNode) {
      editorDomNode.classList.add('notranslate');
      editorDomNode.setAttribute('translate', 'no');
    }

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Track selection changes
    editor.onDidChangeCursorSelection((e) => {
      const selection = e.selection;
      if (
        selection.startLineNumber === selection.endLineNumber &&
        selection.startColumn === selection.endColumn
      ) {
        // No selection, just cursor
        setSelectedRange(null);
      } else {
        // Text is selected
        setSelectedRange({
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        });
      }
    });

    // Add click handler on line numbers (gutter) to open side panel
    // editor.onMouseDown((e) => {
    //   // Check if click is on gutter/line numbers
    //   if (
    //     e.target.type ===
    //     monacoInstance.editor.MouseTargetType.GUTTER_LINE_NUMBERS
    //   ) {
    //     const lineNumber = e.target.position?.lineNumber;
    //     if (lineNumber) {
    //       openSidePanel(lineNumber);
    //     }
    //   }
    // });

    // Set up Monaco to properly support TypeScript
    monacoInstance.languages.typescript.typescriptDefaults.setEagerModelSync(
      true
    );

    // Configure TypeScript compiler options for modern TS with strict validation
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ES2020,
      lib: ['ES2015', 'ES2020', 'DOM'],
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution:
        monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      incremental: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
    });

    // Enable all TypeScript diagnostics
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
      {
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
      }
    );

    // Load all TypeScript lib types (ES2015, DOM, ES2020, Buffer, Zod, etc.)
    // All types are bundled at build time - no runtime fetches or CDN dependencies
    await loadMonacoTypes(monacoInstance);

    // Load @bubblelab/bubble-core types from public directory
    // This still requires a fetch since it's generated from bubble-core dist
    await loadBubbleCoreTypes(monacoInstance);

    setIsLoading(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setEditorInstance(null);
      setCursorPosition(null);
      setSelectedRange(null);
    };
  }, [setEditorInstance, setCursorPosition, setSelectedRange]);

  // Note: single highlighter mode uses highlightedRange for both range and single-line

  // Effect to handle highlighting (single tool): use highlightedRange, including single-line where start=end
  useEffect(() => {
    if (!editorRef.current || !executionHighlightRange || isLoading) {
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    // Validate line numbers (Monaco requires >= 1)
    if (
      executionHighlightRange.startLine < 1 ||
      executionHighlightRange.endLine < 1
    ) {
      console.warn(
        'Invalid line numbers for highlighting:',
        executionHighlightRange
      );
      return;
    }

    // Check if line numbers are within document bounds
    const lineCount = model.getLineCount();
    if (
      executionHighlightRange.startLine > lineCount ||
      executionHighlightRange.endLine > lineCount
    ) {
      console.warn(
        'Line numbers exceed document length:',
        executionHighlightRange,
        'Document has',
        lineCount,
        'lines'
      );
      return;
    }

    // Clear previous decorations
    if (rangeDecorationRef.current.length > 0) {
      editor.deltaDecorations(rangeDecorationRef.current, []);
      rangeDecorationRef.current = [];
    }

    // Create decoration for highlighted range (or single line when start=end)
    const range = {
      startLineNumber: executionHighlightRange.startLine,
      endLineNumber: executionHighlightRange.endLine,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(executionHighlightRange.endLine),
    };

    const isSingleLine =
      executionHighlightRange.startLine === executionHighlightRange.endLine;
    const decoration = {
      range: range,
      options: {
        isWholeLine: true,
        className: 'highlighted-line',
        marginClassName: 'highlighted-line-margin',
        hoverMessage: [
          {
            value: isSingleLine
              ? 'Edit this parameter here'
              : 'Selected bubble code',
          },
        ],
        // Use Monaco's built-in decoration types

        before: {
          content: '▶',
          inlineClassName: 'highlighted-line-before',
        },
      },
    };

    const newDecorations = editor.deltaDecorations([], [decoration]);
    rangeDecorationRef.current = newDecorations;

    // Auto-scroll to highlight
    setTimeout(() => {
      editor.revealRangeInCenter(range);
    }, 100);
  }, [executionHighlightRange, isLoading]);

  // Effect to clear highlighting when highlightedRange becomes null
  useEffect(() => {
    if (
      executionHighlightRange === null &&
      editorRef.current &&
      rangeDecorationRef.current.length > 0
    ) {
      editorRef.current.deltaDecorations(rangeDecorationRef.current, []);
      rangeDecorationRef.current = [];
    }
  }, [executionHighlightRange]);

  return (
    <div
      className="relative monaco-editor-container notranslate"
      translate="no"
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <div className="text-blue-400 text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            Loading TypeScript support...
          </div>
        </div>
      )}

      {/* @ts-expect-error - React 19 compatibility issue with Monaco Editor */}
      <Editor
        {...{
          defaultValue: selectedFlow?.code,
          width: '100%',
          language: 'typescript',
          theme: 'vs-dark',
          onMount: handleEditorDidMount,
          path: 'file:///main.ts',
          options: {
            fontSize: 14,
            fontFamily:
              'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
            minimap: { enabled: true },
            scrollbar: {
              vertical: 'visible',
              horizontal: 'hidden',
            },

            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            cursorStyle: 'line',
            contextmenu: false,
            mouseWheelZoom: true,
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'smart',
            acceptSuggestionOnCommitCharacter: true,
            quickSuggestions: true,
            parameterHints: {
              enabled: true,
              cycle: true,
            },
            hover: {
              enabled: true,
              delay: 100,
              sticky: true,
            },
            lightbulb: {
              enabled: true,
            },
          },
        }}
      />
    </div>
  );
}
