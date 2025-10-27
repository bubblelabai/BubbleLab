import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../stores/editorStore';
import { setConfiguredMonaco } from '../utils/editorContext';
import { useUIStore } from '../stores/uiStore';
import { useBubbleFlow } from '../hooks/useBubbleFlow';

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

  // Helper function to load Zod types from CDN
  const loadZodTypes = async (monacoInstance: typeof monaco) => {
    try {
      console.log('📦 Loading Zod types from CDN...');

      // Try multiple CDN sources for Zod types
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/zod@4.1.12/lib/index.d.ts',
      ];

      let zodTypes: string | null = null;

      for (const url of cdnUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            zodTypes = await response.text();
            console.log(`✅ Loaded Zod types from ${url}`);
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load from ${url}:`, error);
        }
      }

      if (zodTypes) {
        // Add Zod types to Monaco
        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          zodTypes,
          'file:///node_modules/zod/index.d.ts'
        );
        console.log('✅ Successfully loaded Zod types');
      } else {
        // Try loading from ES module as fallback
        try {
          console.log('🔄 Trying to load Zod from ES module...');
          const esmResponse = await fetch(
            'https://cdn.jsdelivr.net/npm/zod@4.1.12/+esm'
          );
          if (esmResponse.ok) {
            // Extract type information from the ES module (basic approach)
            const moduleTypes = `
declare module 'zod' {
  export * from 'zod/lib/index.d.ts';
}
`;
            monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
              moduleTypes,
              'file:///node_modules/zod/index.d.ts'
            );
            console.log('✅ Loaded Zod from ES module');
          }
        } catch (esmError) {
          console.warn('⚠️ Failed to load from ES module:', esmError);
        }
      }

      if (!zodTypes) {
        console.log('⚠️ Failed to load Zod types from CDN, trying fallback...');
        // Fallback: Create comprehensive Zod type definitions
        const basicZodTypes = `
declare module 'zod' {
  export interface ZodType<Output = any, Def = any, Input = Output> {
    _output: Output;
    _input: Input;
    _def: Def;
    parse(input: unknown): Output;
    safeParse(input: unknown): { success: true; data: Output } | { success: false; error: any };
    optional(): ZodOptional<this>;
    nullable(): ZodNullable<this>;
    nullish(): ZodOptional<ZodNullable<this>>;
    array(): ZodArray<this>;
    default(def: () => Output): ZodDefault<this>;
    refine<RefinedOutput extends Output>(
      check: (arg: Output) => arg is RefinedOutput,
      message?: string | { message?: string; path?: (string | number)[] }
    ): ZodEffects<this, RefinedOutput, Input>;
    refine(
      check: (arg: Output) => unknown,
      message?: string | { message?: string; path?: (string | number)[] }
    ): ZodEffects<this, Output, Input>;
    transform<NewOutput>(
      transform: (arg: Output) => NewOutput
    ): ZodEffects<this, NewOutput, Input>;
    describe(description: string): this;
  }
  
  export interface ZodString extends ZodType<string> {
    min(minLength: number, message?: string): ZodString;
    max(maxLength: number, message?: string): ZodString;
    length(len: number, message?: string): ZodString;
    email(message?: string): ZodString;
    url(message?: string): ZodString;
    uuid(message?: string): ZodString;
    regex(regex: RegExp, message?: string): ZodString;
    nonempty(message?: string): ZodString;
    trim(): ZodString;
    toLowerCase(): ZodString;
    toUpperCase(): ZodString;
  }
  
  export interface ZodNumber extends ZodType<number> {
    min(minimum: number, message?: string): ZodNumber;
    max(maximum: number, message?: string): ZodNumber;
    int(message?: string): ZodNumber;
    positive(message?: string): ZodNumber;
    negative(message?: string): ZodNumber;
    nonpositive(message?: string): ZodNumber;
    nonnegative(message?: string): ZodNumber;
    finite(message?: string): ZodNumber;
    safe(message?: string): ZodNumber;
  }
  
  export interface ZodBoolean extends ZodType<boolean> {}
  
  export interface ZodArray<T extends ZodTypeAny> extends ZodType<T['_output'][]> {
    element: T;
    min(minLength: number, message?: string): ZodArray<T>;
    max(maxLength: number, message?: string): ZodArray<T>;
    length(len: number, message?: string): ZodArray<T>;
    nonempty(message?: string): ZodArray<T>;
  }
  
  export interface ZodObject<T extends ZodRawShape> extends ZodType<{ [k in keyof T]: T[k]['_output'] }> {
    shape: T;
    keyof(): ZodEnum<[keyof T, ...(keyof T)[]]>;
    extend<U extends ZodRawShape>(shape: U): ZodObject<T & U>;
    merge<U extends ZodRawShape>(shape: U): ZodObject<T & U>;
    pick<U extends keyof T>(keys: U[]): ZodObject<Pick<T, U>>;
    omit<U extends keyof T>(keys: U[]): ZodObject<Omit<T, U>>;
    partial(): ZodObject<{ [k in keyof T]: ZodOptional<T[k]> }>;
    deepPartial(): ZodObject<{ [k in keyof T]: ZodOptional<ZodType<T[k]['_output']>> }>;
    required(): ZodObject<{ [k in keyof T]: ZodType<T[k]['_output']> }>;
  }
  
  export interface ZodOptional<T extends ZodTypeAny> extends ZodType<T['_output'] | undefined> {
    unwrap(): T;
  }
  
  export interface ZodNullable<T extends ZodTypeAny> extends ZodType<T['_output'] | null> {
    unwrap(): T;
  }
  
  export interface ZodDefault<T extends ZodTypeAny> extends ZodType<T['_output']> {
    removeDefault(): T;
  }
  
  export interface ZodEnum<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
    options: T;
  }
  
  export interface ZodLiteral<T extends string | number | boolean | null> extends ZodType<T> {
    value: T;
  }
  
  export interface ZodUnion<T extends readonly [ZodTypeAny, ...ZodTypeAny[]]> extends ZodType<T[number]['_output']> {
    options: T;
  }
  
  export interface ZodDiscriminatedUnion<
    Discriminator extends string,
    T extends readonly [ZodObject<any>, ...ZodObject<any>[]]
  > extends ZodType<T[number]['_output']> {
    discriminator: Discriminator;
    options: T;
  }
  
  export interface ZodRecord<K extends ZodTypeAny, V extends ZodTypeAny> extends ZodType<Record<K['_output'], V['_output']>> {
    keySchema: K;
    valueSchema: V;
  }
  
  export interface ZodMap<K extends ZodTypeAny, V extends ZodTypeAny> extends ZodType<Map<K['_output'], V['_output']>> {
    keySchema: K;
    valueSchema: V;
  }
  
  export interface ZodSet<T extends ZodTypeAny> extends ZodType<Set<T['_output']>> {
    valueSchema: T;
  }
  
  export interface ZodFunction<
    Args extends ZodTuple<any>,
    Returns extends ZodTypeAny
  > extends ZodType<(...args: Args['_output']) => Returns['_output']> {
    args: Args;
    returns: Returns;
  }
  
  export interface ZodTuple<T extends readonly ZodTypeAny[]> extends ZodType<{ [k in keyof T]: T[k]['_output'] }> {
    items: T;
  }
  
  export interface ZodEffects<
    Output,
    NewOutput,
    Input
  > extends ZodType<NewOutput, any, Input> {
    innerType(): ZodType<Output>;
  }
  
  export type ZodTypeAny = ZodType<any, any, any>;
  export type ZodRawShape = { [k: string]: ZodTypeAny };
  
  export const z: {
    string(): ZodString;
    number(): ZodNumber;
    boolean(): ZodBoolean;
    array<T extends ZodTypeAny>(schema: T): ZodArray<T>;
    object<T extends ZodRawShape>(shape: T): ZodObject<T>;
    enum<T extends readonly [string, ...string[]]>(values: T): ZodEnum<T>;
    literal<T extends string | number | boolean | null>(value: T): ZodLiteral<T>;
    union<T extends readonly [ZodTypeAny, ...ZodTypeAny[]]>(options: T): ZodUnion<T>;
    discriminatedUnion<Discriminator extends string, T extends readonly [ZodObject<any>, ...ZodObject<any>[]]>(
      discriminator: Discriminator,
      options: T
    ): ZodDiscriminatedUnion<Discriminator, T>;
    record<K extends ZodTypeAny, V extends ZodTypeAny>(keySchema: K, valueSchema: V): ZodRecord<K, V>;
    map<K extends ZodTypeAny, V extends ZodTypeAny>(keySchema: K, valueSchema: V): ZodMap<K, V>;
    set<T extends ZodTypeAny>(valueSchema: T): ZodSet<T>;
    function<Args extends ZodTuple<any>, Returns extends ZodTypeAny>(
      args: Args,
      returns: Returns
    ): ZodFunction<Args, Returns>;
    tuple<T extends readonly ZodTypeAny[]>(schemas: T): ZodTuple<T>;
    effects<Output, NewOutput, Input>(
      schema: ZodType<Output, any, Input>,
      transform: (arg: Output) => NewOutput
    ): ZodEffects<Output, NewOutput, Input>;
    any(): ZodType<any>;
    unknown(): ZodType<unknown>;
    never(): ZodType<never>;
    void(): ZodType<void>;
    null(): ZodType<null>;
    undefined(): ZodType<undefined>;
    date(): ZodType<Date>;
    bigint(): ZodType<bigint>;
    symbol(): ZodType<symbol>;
    lazy<T extends ZodTypeAny>(getter: () => T): T;
    catch<T extends ZodTypeAny>(schema: T, fallback: T['_output']): T;
    transform<T extends ZodTypeAny, NewOutput>(
      schema: T,
      transform: (arg: T['_output']) => NewOutput
    ): ZodEffects<T, NewOutput, T['_input']>;
    preprocess<PreprocessInput, Input, Output>(
      preprocess: (arg: PreprocessInput) => Input,
      schema: ZodType<Output, any, Input>
    ): ZodType<Output, any, PreprocessInput>;
    pipeline<Input, Output>(
      ...schemas: [ZodType<Output, any, Input>, ...ZodTypeAny[]]
    ): ZodType<Output, any, Input>;
    custom<T>(check: (arg: unknown) => arg is T, message?: string): ZodType<T>;
    custom<T>(check: (arg: unknown) => unknown, message?: string): ZodType<T>;
  };
}
`;

        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          basicZodTypes,
          'file:///node_modules/zod/index.d.ts'
        );
        console.log('✅ Loaded comprehensive Zod type definitions (fallback)');
      }
    } catch (error) {
      console.error('❌ Failed to load Zod types:', error);
    }
  };

  // Helper function to add JSON Schema to Zod converter types
  const addJsonSchemaToZodConverter = (monacoInstance: typeof monaco) => {
    const converterTypes = `
declare global {
  interface JsonSchemaProperty {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    items?: JsonSchemaProperty;
    properties?: Record<string, JsonSchemaProperty>;
  }

  interface JsonSchema {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  }

  class JsonSchemaToZodConverter {
    static convert(jsonSchema: JsonSchema): Record<string, any>;
  }
}
`;

    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      converterTypes,
      'file:///utils/json-schema-converter.d.ts'
    );
    console.log('✅ Added JSON Schema to Zod converter types');
  };

  const handleEditorDidMount = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    console.log('Editor mounted');
    editorRef.current = editor;

    // Store the configured Monaco instance for TypeScript worker access
    setConfiguredMonaco(monacoInstance);

    // Store editor instance in Zustand
    setEditorInstance(editor);

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
        /declare module '@bubblelab\/bubble-core'[\s\S]*$/
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

    // Load Zod types from CDN
    await loadZodTypes(monacoInstance);

    // Add JSON Schema to Zod converter types
    addJsonSchemaToZodConverter(monacoInstance);

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

    console.log('Applying range highlight:', executionHighlightRange);

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

    console.log('Applied range decorations:', newDecorations);

    // Auto-scroll to highlight
    console.log('Auto-scrolling to highlight:', executionHighlightRange);
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
    <div className="relative monaco-editor-container">
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
