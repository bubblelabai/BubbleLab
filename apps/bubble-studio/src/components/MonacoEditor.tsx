import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value?: string;
  onChange: (value: string) => void;
  language?: string;
  className?: string;
  // Highlight props
  highlightedRange?: { startLine: number; endLine: number } | null;
}

export function MonacoEditor({
  value = '',
  onChange,
  language = 'typescript',
  className = '',
  highlightedRange,
}: MonacoEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const rangeDecorationRef = useRef<string[]>([]);

  const handleEditorDidMount = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    editorRef.current = editor;

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

    // Load essential TypeScript lib files from local public directory
    try {
      console.log('📦 Loading TypeScript lib types from local files...');

      // Load ES2015 lib (includes Promise)
      const es2015Response = await fetch('/typescript-libs/lib.es2015.d.ts');
      if (es2015Response.ok) {
        const es2015Types = await es2015Response.text();
        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          es2015Types,
          'file:///node_modules/typescript/lib/lib.es2015.d.ts'
        );
        console.log('✅ Loaded ES2015 types (Promise, etc.)');
      }

      // Load DOM lib
      const domResponse = await fetch('/typescript-libs/lib.dom.d.ts');
      if (domResponse.ok) {
        const domTypes = await domResponse.text();
        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          domTypes,
          'file:///node_modules/typescript/lib/lib.dom.d.ts'
        );
        console.log('✅ Loaded DOM types');
      }

      // Load ES2020 full lib to ensure modern APIs like Array.prototype.flat are available
      let es2020Loaded = false;
      try {
        const es2020FullResponse = await fetch(
          '/typescript-libs/lib.es2020.full.d.ts'
        );
        if (es2020FullResponse.ok) {
          const es2020FullTypes = await es2020FullResponse.text();
          monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
            es2020FullTypes,
            'file:///node_modules/typescript/lib/lib.es2020.full.d.ts'
          );
          console.log(
            '✅ Loaded ES2020 full types (includes Array.flat, etc.)'
          );
          es2020Loaded = true;
        }
      } catch (error) {
        console.warn('⚠️ Failed to load ES2020 full types:', error);
      }

      if (!es2020Loaded) {
        // Minimal fallback to get Array.prototype.flat typings
        const es2019ArrayResponse = await fetch(
          '/typescript-libs/lib.es2019.array.d.ts'
        );
        if (es2019ArrayResponse.ok) {
          const es2019ArrayTypes = await es2019ArrayResponse.text();
          monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
            es2019ArrayTypes,
            'file:///node_modules/typescript/lib/lib.es2019.array.d.ts'
          );
          console.log('✅ Loaded ES2019 array types (Array.flat fallback)');
        } else {
          console.warn('⚠️ Could not load ES2020 full or ES2019 array lib.');
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load TypeScript lib types:', error);
    }

    // Load Buffer type definitions from local file
    try {
      const bufferResponse = await fetch('/typescript-libs/buffer.d.ts');
      if (bufferResponse.ok) {
        const bufferTypes = await bufferResponse.text();
        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          bufferTypes,
          'file:///node_modules/@types/node/buffer.d.ts'
        );
        console.log('✅ Loaded Buffer type definitions from local file');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load Buffer types:', error);
    }

    // Load @bubblelab/bubble-core types from public directory (copied from bubble-core dist)
    try {
      const response = await fetch('/bubble-types.txt');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bundledTypes = await response.text();
      console.log('✅ Loaded minified bubble types from public directory');

      // Debug: Check what we actually received
      console.log(
        '📥 Raw fetched content preview:',
        bundledTypes.substring(0, 500)
      );
      console.log('📏 Total fetched length:', bundledTypes.length);
      console.log('📦 Loaded bundle size:', bundledTypes.length, 'characters');

      // Find the module declaration and remove it
      const moduleDeclarationMatch = bundledTypes.match(
        /declare module '@nodex\/bubble-core'[\s\S]*$/
      );
      const moduleDeclarationStart = moduleDeclarationMatch
        ? bundledTypes.indexOf(moduleDeclarationMatch[0])
        : bundledTypes.length;

      // Extract only the actual type definitions (before the module declaration)
      const cleanedTypes = bundledTypes
        .substring(0, moduleDeclarationStart)
        .trim();

      // Add our bundled types as the @bubblelab/bubble-core module
      const moduleDeclaration = `
declare module '@bubblelab/bubble-core' {
${cleanedTypes.replace(/^/gm, '  ')}
}
`;

      monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        moduleDeclaration,
        'file:///node_modules/@types/nodex__bubble-core/index.d.ts'
      );

      // Debug: Check for ServiceBubble declarations
      const serviceBubbleMatches = cleanedTypes.match(
        /export declare (abstract )?class ServiceBubble/g
      );
      console.log(
        '🔍 ServiceBubble declarations found:',
        serviceBubbleMatches?.length || 0
      );
      console.log('📏 Cleaned types length:', cleanedTypes.length);

      console.log('✅ Successfully loaded @bubblelab/bubble-core types');
      console.log(
        '📦 Module declaration preview:',
        moduleDeclaration.substring(0, 800) + '...'
      );
      console.log(
        '🔍 Available libs:',
        Object.keys(
          monacoInstance.languages.typescript.typescriptDefaults.getExtraLibs()
        )
      );
    } catch (error) {
      console.error('❌ Failed to load bundled types:', error);
    }

    setIsLoading(false);
  };

  // Note: single highlighter mode uses highlightedRange for both range and single-line

  // Effect to handle highlighting (single tool): use highlightedRange, including single-line where start=end
  useEffect(() => {
    if (!editorRef.current || !highlightedRange || isLoading) {
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    // Validate line numbers (Monaco requires >= 1)
    if (highlightedRange.startLine < 1 || highlightedRange.endLine < 1) {
      console.warn('Invalid line numbers for highlighting:', highlightedRange);
      return;
    }

    // Check if line numbers are within document bounds
    const lineCount = model.getLineCount();
    if (
      highlightedRange.startLine > lineCount ||
      highlightedRange.endLine > lineCount
    ) {
      console.warn(
        'Line numbers exceed document length:',
        highlightedRange,
        'Document has',
        lineCount,
        'lines'
      );
      return;
    }

    console.log('Applying range highlight:', highlightedRange);

    // Clear previous decorations
    if (rangeDecorationRef.current.length > 0) {
      editor.deltaDecorations(rangeDecorationRef.current, []);
      rangeDecorationRef.current = [];
    }

    // Create decoration for highlighted range (or single line when start=end)
    const range = {
      startLineNumber: highlightedRange.startLine,
      endLineNumber: highlightedRange.endLine,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(highlightedRange.endLine),
    };

    const isSingleLine =
      highlightedRange.startLine === highlightedRange.endLine;
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

    console.log('Applied range decorations:', newDecorations);

    // Auto-scroll to highlight
    console.log('Auto-scrolling to highlight:', highlightedRange);
    editor.revealRangeInCenter(range);
  }, [highlightedRange, isLoading]);

  // Effect to clear highlighting when highlightedRange becomes null
  useEffect(() => {
    if (
      highlightedRange === null &&
      editorRef.current &&
      rangeDecorationRef.current.length > 0
    ) {
      editorRef.current.deltaDecorations(rangeDecorationRef.current, []);
      rangeDecorationRef.current = [];
    }
  }, [highlightedRange]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className={`relative monaco-editor-container ${className}`}>
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
          width: '100%',
          language,
          theme: 'vs-dark',
          value,
          onChange: handleEditorChange,
          onMount: handleEditorDidMount,
          path: 'file:///main.ts',
          options: {
            fontSize: 14,
            fontFamily:
              'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 20,
            lineNumbersMinChars: 3,
            renderWhitespace: 'boundary',
            cursorBlinking: 'blink',
            cursorStyle: 'line',
            contextmenu: true,
            mouseWheelZoom: true,
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
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
