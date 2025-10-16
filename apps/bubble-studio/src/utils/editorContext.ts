import * as monaco from 'monaco-editor';
import { useEditorStore } from '../stores/editorStore';

/**
 * Store the configured Monaco instance (set during editor mount)
 * This is the actual Monaco instance with TypeScript worker configured
 */
let configuredMonaco: typeof monaco | null = null;

/**
 * Set the configured Monaco instance (called from MonacoEditor onMount)
 */
export function setConfiguredMonaco(monacoInstance: typeof monaco): void {
  configuredMonaco = monacoInstance;
}

/**
 * Get the configured Monaco instance
 */
export function getConfiguredMonaco(): typeof monaco | null {
  return configuredMonaco;
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
 * Type information at a position
 */
export interface TypeInfo {
  displayString: string; // e.g., "const foo: string"
  documentation: string; // JSDoc or description
  kind: string; // "variable", "function", "class", etc.
}

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

  // Use configured Monaco instance
  const monacoInstance = getConfiguredMonaco() || monaco;

  try {
    const position = { lineNumber, column };
    const offset = model.getOffsetAt(position);

    const worker =
      await monacoInstance.languages.typescript.getTypeScriptWorker();
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

  // Use configured Monaco instance
  const monacoInstance = getConfiguredMonaco() || monaco;

  try {
    const position = { lineNumber, column };
    const offset = model.getOffsetAt(position);

    const worker =
      await monacoInstance.languages.typescript.getTypeScriptWorker();
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
 * Get all variables defined in the entire file with their exact types using TypeScript worker
 * This uses the TypeScript language service to analyze the entire AST
 *
 * @example
 * const allVars = await getAllVariablesWithTypes();
 */
export async function getAllVariablesWithTypes(): Promise<VariableInfo[]> {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) {
    console.warn('No editor instance available');
    return [];
  }

  const model = editorInstance.getModel();
  if (!model) {
    console.warn('No model available');
    return [];
  }

  try {
    // Use the configured Monaco instance (from editor mount) instead of static import
    const monacoInstance = getConfiguredMonaco();
    if (!monacoInstance) {
      console.error(
        'Monaco instance not configured yet. Editor may not be mounted.'
      );
      return [];
    }

    // Check the model's language mode
    const languageId = model.getLanguageId();
    console.log('Model language ID:', languageId);

    // Verify TypeScript language is available
    if (!monacoInstance.languages.typescript) {
      console.error('Monaco TypeScript language service is not available');
      return [];
    }

    // Get the appropriate worker based on language
    let worker;
    if (languageId === 'typescript') {
      worker = await monacoInstance.languages.typescript.getTypeScriptWorker();
    } else if (languageId === 'javascript') {
      worker = await monacoInstance.languages.typescript.getJavaScriptWorker();
    } else {
      console.error(`Unsupported language for type extraction: ${languageId}`);
      return [];
    }

    if (!worker) {
      console.error('TypeScript/JavaScript worker not available');
      return [];
    }

    const client = await worker(model.uri);
    if (!client) {
      console.error(
        'Language service client not available for model URI:',
        model.uri.toString()
      );
      return [];
    }

    console.log('✅ Successfully connected to TypeScript worker');

    // Get the semantic diagnostics to ensure the file is fully analyzed
    await client.getSemanticDiagnostics(model.uri.toString());

    const lineCount = model.getLineCount();

    const variableMap = new Map<string, VariableInfo>();

    // Scan through each line to find variable declarations
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      const lineContent = model.getLineContent(lineNumber);

      // Match variable declarations: const/let/var/function/class/interface/type
      const declarationPatterns = [
        /\b(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        /\binterface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        /\btype\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        /\benum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      ];

      for (const pattern of declarationPatterns) {
        let match;
        while ((match = pattern.exec(lineContent)) !== null) {
          const keyword = match[1];
          const name = match[2] || match[1];

          // Get the column position of the identifier
          const column =
            match.index + (match[1] ? match[0].indexOf(name) : 0) + 1;
          const offset = model.getOffsetAt({ lineNumber, column });

          try {
            // Get detailed type information using TypeScript worker
            const quickInfo = await client.getQuickInfoAtPosition(
              model.uri.toString(),
              offset
            );

            if (quickInfo && !variableMap.has(name)) {
              // Extract the full type from displayParts
              const displayString =
                quickInfo.displayParts
                  ?.map((p: { text: string }) => p.text)
                  .join('') || 'unknown';

              // Extract just the type portion (after the colon)
              const typeMatch = displayString.match(/:\s*(.+)$/);
              const type = typeMatch ? typeMatch[1].trim() : displayString;

              // Determine the kind
              let kind: VariableInfo['kind'] = 'const';
              if (keyword === 'var') kind = 'var';
              else if (keyword === 'let') kind = 'let';
              else if (keyword === 'const') kind = 'const';
              else if (quickInfo.kind === 'parameter') kind = 'parameter';

              variableMap.set(name, {
                name,
                type,
                kind,
              });
            }
          } catch (error) {
            console.error(`Failed to get type for ${name}:`, error);
          }
        }
      }

      // Also check for function parameters
      const functionMatch = lineContent.match(
        /function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(([^)]*)\)/
      );
      const arrowFunctionMatch = lineContent.match(/\(([^)]*)\)\s*=>/);

      const paramString = functionMatch?.[1] || arrowFunctionMatch?.[1];
      if (paramString) {
        const params = paramString.split(',').map((p) => p.trim());
        for (const param of params) {
          const paramNameMatch = param.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/);
          if (paramNameMatch) {
            const paramName = paramNameMatch[1];
            const column = lineContent.indexOf(paramName) + 1;
            const offset = model.getOffsetAt({ lineNumber, column });

            try {
              const quickInfo = await client.getQuickInfoAtPosition(
                model.uri.toString(),
                offset
              );

              if (quickInfo && !variableMap.has(paramName)) {
                const displayString =
                  quickInfo.displayParts
                    ?.map((p: { text: string }) => p.text)
                    .join('') || 'unknown';

                const typeMatch = displayString.match(/:\s*(.+)$/);
                const type = typeMatch ? typeMatch[1].trim() : displayString;

                variableMap.set(paramName, {
                  name: paramName,
                  type,
                  kind: 'parameter',
                });
              }
            } catch (error) {
              console.error(
                `Failed to get type for parameter ${paramName}:`,
                error
              );
            }
          }
        }
      }
    }

    return Array.from(variableMap.values());
  } catch (error) {
    console.error('Failed to get all variables with types:', error);
    return [];
  }
}

/**
 * Get code context for AI (MilkTea API) - async
 * Call this directly before calling MilkTea API
 *
 * @example
 * const context = await getCodeContextForMilkTea();
 * if (context) {
 *   await callMilkTeaAPI({ currentCode: context.fullCode, ... });
 * }
 */
export async function getCodeContextForMilkTea(): Promise<{
  fullCode: string;
  contextCode: string;
  availableVariables: VariableInfo[];
  insertLine: number;
  insertLocation: string;
} | null> {
  const { editorInstance, targetInsertLine } = useEditorStore.getState();
  if (!editorInstance || !targetInsertLine) return null;

  const model = editorInstance.getModel();
  if (!model) {
    console.error('No model found');
    return null;
  }

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

  // Get available variables from the end of the file to capture all variables in scope
  const lastLine = model.getLineCount();
  const availableVariables = await getAvailableVariables(lastLine, 1);

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
 * Gets context about entire editor file for AI (Pearl)
 */
export async function getCodeContextForPearl(): Promise<{
  fullCode: string;
  availableVariables: VariableInfo[];
} | null> {
  const { editorInstance } = useEditorStore.getState();
  if (!editorInstance) return null;
  const model = editorInstance.getModel();
  if (!model) return null;
  const fullCode = model.getValue();

  // Use the new function that gets ALL variables with their exact types
  const availableVariables = await getAllVariablesWithTypes();

  return { fullCode, availableVariables };
}
