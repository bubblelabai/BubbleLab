import * as ts from 'typescript';
import { parseBubbleFlow } from './bubbleflow-parser.js';
import type { BubbleFactory } from '../bubble-factory.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import { enhanceErrorMessage } from '@bubblelab/shared-schemas';

export interface VariableTypeInfo {
  name: string;
  type: string;
  line: number;
  column: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  bubbleParameters?: Record<string, ParsedBubble>;
  variableTypes?: VariableTypeInfo[];
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
  // Disable file generation options for runtime validation performance
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
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    incremental: false,
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
    // Additional validation: Check if it extends BubbleFlow
    // Get source file from language service for AST analysis
    const program = languageService.getProgram();
    const sourceFile = program?.getSourceFile(fileName);
    if (diagnostics.length > 0) {
      const variableTypes = sourceFile
        ? extractVariableTypes(sourceFile, program)
        : [];
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
          return `Line ${line + 1}, Column ${character + 1}: ${enhanceErrorMessage(message)}`;
        }
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        );
        return enhanceErrorMessage(message);
      });

      return {
        valid: false,
        errors,
        variableTypes,
      };
    }

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

    // Extract type definitions for all variables
    const variableTypes = sourceFile
      ? extractVariableTypes(sourceFile, program)
      : [];

    return {
      valid: true,
      bubbleParameters: parseResult.bubbles,
      variableTypes,
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

/**
 * Expands a type to show its full structure, not just the type name
 */
function expandTypeString(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  visited: Set<ts.Type> = new Set()
): string {
  // Prevent infinite recursion
  if (visited.has(type)) {
    return typeChecker.typeToString(type);
  }
  visited.add(type);

  // Get the base type string
  const baseTypeString = typeChecker.typeToString(type);

  // If it's an object type, expand it to show properties
  if (type.isClassOrInterface() || type.getSymbol()) {
    const symbol = type.getSymbol();
    if (symbol) {
      // Check if it's a type alias or interface that we should expand
      const declarations = symbol.getDeclarations();
      if (declarations && declarations.length > 0) {
        const declaration = declarations[0];

        // If it's a type alias, try to get the aliased type
        if (ts.isTypeAliasDeclaration(declaration)) {
          const aliasedType = typeChecker.getTypeAtLocation(declaration.type);
          if (aliasedType !== type) {
            const expanded = expandTypeString(
              aliasedType,
              typeChecker,
              sourceFile,
              visited
            );
            // Only use expanded if it's different and more detailed
            if (
              expanded !== baseTypeString &&
              expanded.length > baseTypeString.length
            ) {
              return expanded;
            }
          }
        }
      }
    }

    // For object types, try to get a more detailed representation
    const properties = type.getProperties();
    if (properties.length > 0) {
      // Check if the type string is just the name (not expanded)
      // If it's a simple name without braces, try to expand it
      if (
        !baseTypeString.includes('{') &&
        !baseTypeString.includes('[') &&
        !baseTypeString.includes('|')
      ) {
        // Try to get the expanded type by checking the type's structure
        const expandedParts: string[] = [];

        for (const prop of properties.slice(0, 20)) {
          // Limit to 20 properties to avoid huge output
          const propDeclaration =
            prop.valueDeclaration || prop.getDeclarations()?.[0] || sourceFile;
          const propType = typeChecker.getTypeOfSymbolAtLocation(
            prop,
            propDeclaration
          );
          const propTypeString = expandTypeString(
            propType,
            typeChecker,
            sourceFile,
            new Set(visited)
          );
          const optional = prop.getFlags() & ts.SymbolFlags.Optional ? '?' : '';
          expandedParts.push(`${prop.getName()}${optional}: ${propTypeString}`);
        }

        if (expandedParts.length > 0) {
          const remaining =
            properties.length > 20 ? `... ${properties.length - 20} more` : '';
          return `{ ${expandedParts.join('; ')}${remaining ? `; ${remaining}` : ''} }`;
        }
      }
    }
  }

  // For union types, expand each member
  if (type.isUnion()) {
    const unionTypes = type.types.map((t) =>
      expandTypeString(t, typeChecker, sourceFile, new Set(visited))
    );
    return unionTypes.join(' | ');
  }

  // For intersection types, expand each member
  if (type.isIntersection()) {
    const intersectionTypes = type.types.map((t) =>
      expandTypeString(t, typeChecker, sourceFile, new Set(visited))
    );
    return intersectionTypes.join(' & ');
  }

  return baseTypeString;
}

/**
 * Extracts type definitions for all variables in the source file
 */
function extractVariableTypes(
  sourceFile: ts.SourceFile,
  program: ts.Program | undefined
): VariableTypeInfo[] {
  if (!program) {
    return [];
  }

  const typeChecker = program.getTypeChecker();
  const variableTypes: VariableTypeInfo[] = [];

  function visit(node: ts.Node) {
    // Extract variable declarations
    if (ts.isVariableDeclaration(node)) {
      const name = node.name;
      if (ts.isIdentifier(name)) {
        const variableName = name.text;
        const type = typeChecker.getTypeAtLocation(node);
        const typeString = expandTypeString(type, typeChecker, sourceFile);

        // Get position information
        const position = name.getStart(sourceFile);
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          position
        );

        variableTypes.push({
          name: variableName,
          type: typeString,
          line: line + 1,
          column: character + 1,
        });
      } else if (
        ts.isObjectBindingPattern(name) ||
        ts.isArrayBindingPattern(name)
      ) {
        // Handle destructuring patterns (e.g., const { a, b } = ... or const [a, b] = ...)
        name.elements.forEach((element) => {
          if (ts.isBindingElement(element) && element.name) {
            if (ts.isIdentifier(element.name)) {
              const variableName = element.name.text;
              const type = typeChecker.getTypeAtLocation(element);
              const typeString = expandTypeString(
                type,
                typeChecker,
                sourceFile
              );

              const position = element.name.getStart(sourceFile);
              const { line, character } = ts.getLineAndCharacterOfPosition(
                sourceFile,
                position
              );

              variableTypes.push({
                name: variableName,
                type: typeString,
                line: line + 1,
                column: character + 1,
              });
            }
          }
        });
      }
    }

    // Extract function parameters
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const parameterName = node.name.text;
      const type = typeChecker.getTypeAtLocation(node);
      const typeString = expandTypeString(type, typeChecker, sourceFile);

      const position = node.name.getStart(sourceFile);
      const { line, character } = ts.getLineAndCharacterOfPosition(
        sourceFile,
        position
      );

      variableTypes.push({
        name: parameterName,
        type: typeString,
        line: line + 1,
        column: character + 1,
      });
    }

    // Extract class properties
    if (ts.isPropertyDeclaration(node) && node.name) {
      if (ts.isIdentifier(node.name)) {
        const propertyName = node.name.text;
        const type = typeChecker.getTypeAtLocation(node);
        const typeString = expandTypeString(type, typeChecker, sourceFile);

        const position = node.name.getStart(sourceFile);
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          position
        );

        variableTypes.push({
          name: propertyName,
          type: typeString,
          line: line + 1,
          column: character + 1,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return variableTypes;
}
