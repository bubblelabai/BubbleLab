import * as ts from 'typescript';
import { parseBubbleFlow } from './bubbleflow-parser.js';
import type { BubbleFactory } from '../bubble-factory.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  bubbleParameters?: Record<string, ParsedBubble>;
}

// Language Service-based validator (persistent across calls for performance)
let cachedLanguageService: ts.LanguageService | null = null;
let cachedCompilerOptions: ts.CompilerOptions | null = null;
const scriptVersions = new Map<string, number>();
const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();

function getOrCreateLanguageService(): ts.LanguageService {
  if (cachedLanguageService && cachedCompilerOptions) {
    return cachedLanguageService;
  }

  // Get TypeScript compiler options (similar to bubble-core config)
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: true,
    noImplicitAny: false,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    incremental: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    resolveJsonModule: true,
    isolatedModules: true,
  };

  // Create Language Service Host with full file system access
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => Array.from(scriptSnapshots.keys()),
    getScriptVersion: (fileName) =>
      scriptVersions.get(fileName)?.toString() ?? '0',
    getScriptSnapshot: (fileName) => {
      // First check our in-memory snapshots
      const snapshot = scriptSnapshots.get(fileName);
      if (snapshot) {
        return snapshot;
      }

      // Then try to read from file system (for node_modules, etc.)
      if (ts.sys.fileExists(fileName)) {
        const text = ts.sys.readFile(fileName);
        if (text !== undefined) {
          return ts.ScriptSnapshot.fromString(text);
        }
      }

      return undefined;
    },
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  cachedCompilerOptions = compilerOptions;
  cachedLanguageService = ts.createLanguageService(
    host,
    ts.createDocumentRegistry()
  );

  return cachedLanguageService;
}

export async function validateBubbleFlow(
  code: string,
  bubbleFactory: BubbleFactory
): Promise<ValidationResult> {
  try {
    // Create a temporary file name for the validation
    const fileName = 'virtual-bubble-flow.ts';

    // Get or create the language service
    const languageService = getOrCreateLanguageService();

    // Update script version and snapshot
    const version = (scriptVersions.get(fileName) ?? 0) + 1;
    scriptVersions.set(fileName, version);
    scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(code));

    // Get diagnostics using Language Service
    const syntacticDiagnostics =
      languageService.getSyntacticDiagnostics(fileName);
    const semanticDiagnostics =
      languageService.getSemanticDiagnostics(fileName);

    // Filter out TS6133 (unused variables) like the server does
    const diagnostics = [
      ...syntacticDiagnostics,
      ...semanticDiagnostics,
    ].filter((d) => d.code !== 6133);

    if (diagnostics.length > 0) {
      const errors = diagnostics.map((diagnostic) => {
        if (diagnostic.file && diagnostic.start !== undefined) {
          const { line, character } = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start
          );
          const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n'
          );
          return `Line ${line + 1}, Column ${character + 1}: ${message}`;
        }
        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      });

      return {
        valid: false,
        errors,
      };
    }

    // Additional validation: Check if it extends BubbleFlow
    // Get source file from language service for AST analysis
    const program = languageService.getProgram();
    const sourceFile = program?.getSourceFile(fileName);

    if (!sourceFile) {
      return {
        valid: false,
        errors: ['Failed to get source file for validation'],
      };
    }

    const hasValidBubbleFlow = validateBubbleFlowClass(sourceFile);
    if (!hasValidBubbleFlow.valid) {
      return hasValidBubbleFlow;
    }

    // Parse bubble parameters after successful validation
    const parseResult = parseBubbleFlow(code, bubbleFactory);
    if (!parseResult.success) {
      // This shouldn't happen if TypeScript validation passed, but handle it
      return {
        valid: false,
        errors: parseResult.errors || ['Failed to parse bubble parameters'],
      };
    }

    return {
      valid: true,
      bubbleParameters: parseResult.bubbles,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function validateBubbleFlowClass(sourceFile: ts.SourceFile): ValidationResult {
  let hasBubbleFlowClass = false;
  let hasHandleMethod = false;

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.heritageClauses) {
      // Check if class extends BubbleFlow
      const extendsClause = node.heritageClauses.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      );

      if (
        extendsClause &&
        extendsClause.types.some(
          (type) =>
            ts.isIdentifier(type.expression) &&
            type.expression.text === 'BubbleFlow'
        )
      ) {
        hasBubbleFlowClass = true;

        // Check for handle method
        node.members.forEach((member) => {
          if (
            ts.isMethodDeclaration(member) &&
            ts.isIdentifier(member.name) &&
            member.name.text === 'handle'
          ) {
            hasHandleMethod = true;
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const errors: string[] = [];
  if (!hasBubbleFlowClass) {
    errors.push('Code must contain a class that extends BubbleFlow');
  }
  if (!hasHandleMethod) {
    errors.push('BubbleFlow class must have a handle method');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
