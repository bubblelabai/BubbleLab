import path from 'path';
import ts from 'typescript';
import { enhanceErrorMessage } from '@bubblelab/shared-schemas';

export interface VariableTypeInfo {
  name: string;
  type: string;
  line: number;
  column: number;
}

type DiagnosticsResult = {
  success: boolean;
  errors?: Record<number, string>;
  variableTypes?: VariableTypeInfo[];
};

/**
 * Minimal warmed TypeScript checker for validating string scripts.
 * - Uses LanguageService for fast incremental diagnostics
 * - Keeps shared libs/graphs in memory across requests
 * - Backend callers pass only a code string; imports resolve via tsconfig
 */
class LanguageServiceTypechecker {
  private readonly projectDir: string;
  private readonly options: ts.CompilerOptions;
  private readonly sanitizedOptions: ts.CompilerOptions;
  private readonly configFileNames: string[];
  private readonly snapshots = new Map<
    string,
    { version: number; text: string }
  >();
  private readonly documentRegistry = ts.createDocumentRegistry();
  private readonly moduleResolutionCache: ts.ModuleResolutionCache;
  private languageService: ts.LanguageService;

  constructor(configPath = './tsconfig.json') {
    const resolvedConfigPath = path.isAbsolute(configPath)
      ? configPath
      : path.join(ts.sys.getCurrentDirectory(), configPath);

    const configFile = ts.readConfigFile(resolvedConfigPath, ts.sys.readFile);
    if (configFile.error) {
      const message = ts.formatDiagnosticsWithColorAndContext(
        [configFile.error],
        this.createFormatHost()
      );
      throw new Error(
        `Failed to read tsconfig at ${resolvedConfigPath}:\n${message}`
      );
    }

    const projectDir = path.dirname(resolvedConfigPath);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      projectDir
    );
    this.projectDir = projectDir;
    this.options = parsed.options;
    // Disable options that cause irrelevant diagnostics for in-memory checks
    this.sanitizedOptions = {
      ...this.options,
      incremental: false,
      tsBuildInfoFile: undefined,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
    };
    this.configFileNames = parsed.fileNames;
    this.moduleResolutionCache = ts.createModuleResolutionCache(
      this.projectDir,
      (s) => s,
      this.sanitizedOptions
    );

    // Initialize language service with a host capable of resolving packages
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => this.sanitizedOptions,
      getCurrentDirectory: () => this.projectDir,
      getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
      getScriptFileNames: () => [
        ...this.configFileNames,
        ...this.getVirtualFiles(),
      ],
      getScriptVersion: (fileName) =>
        this.snapshots.get(this.normalize(fileName))?.version.toString() ?? '0',
      getScriptSnapshot: (fileName) => {
        const normalized = this.normalize(fileName);
        const virtual = this.snapshots.get(normalized);
        if (virtual) {
          return ts.ScriptSnapshot.fromString(virtual.text);
        }
        const text = ts.sys.readFile(normalized);
        if (text === undefined) return undefined;
        return ts.ScriptSnapshot.fromString(text);
      },
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      realpath: ts.sys.realpath,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      // Cache module resolution for performance
      resolveModuleNameLiterals: (
        moduleNames,
        containingFile,
        redirectedReference,
        options
      ) => {
        const results: readonly ts.ResolvedModuleWithFailedLookupLocations[] =
          moduleNames.map((m) => {
            const res = ts.resolveModuleName(
              m.text,
              containingFile,
              options,
              ts.sys,
              this.moduleResolutionCache,
              redirectedReference
            );
            return res;
          });
        return results as unknown as ts.ResolvedModuleWithFailedLookupLocations[];
      },
    };

    this.languageService = ts.createLanguageService(
      host,
      this.documentRegistry
    );
  }

  private normalize(fileName: string): string {
    // Place virtual files under the configured rootDir to avoid TS6059.
    const rootDir = this.options.rootDir
      ? path.isAbsolute(this.options.rootDir)
        ? this.options.rootDir
        : path.join(this.projectDir, this.options.rootDir)
      : this.projectDir;
    const p = path.isAbsolute(fileName)
      ? fileName
      : path.join(rootDir, fileName);
    return ts.sys.useCaseSensitiveFileNames ? p : p.toLowerCase();
  }

  private getVirtualFiles(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Validate an in-memory script and return diagnostics.
   * fileName affects caching identity and relative module resolution.
   */
  checkCode(
    code: string,
    fileName = 'virtual/bubbleflow.ts'
  ): DiagnosticsResult {
    const normalized = this.normalize(fileName);
    const prev = this.snapshots.get(normalized);
    const version = prev ? prev.version + 1 : 1;
    this.snapshots.set(normalized, { version, text: code });

    const syntactic = this.languageService.getSyntacticDiagnostics(normalized);
    const semantic = this.languageService.getSemanticDiagnostics(normalized);
    // Skip compiler options diagnostics (e.g., incremental) for in-memory validation
    const all = [...syntactic, ...semantic].filter((d) => d.code !== 6133); // Ignore TS6133 (unused variable)

    // Build a simple line -> message map for the checked file
    const lineErrors: Record<number, string> = {};
    for (const d of all) {
      if (!d.file || d.start === undefined) continue;
      const lc = d.file.getLineAndCharacterOfPosition(d.start);
      const line = lc.line + 1; // 1-based line numbers
      const message = ts.flattenDiagnosticMessageText(
        d.messageText,
        ts.sys.newLine
      );
      const code = d.code ? `TS${d.code}: ` : '';
      const entry = `${code}${enhanceErrorMessage(message)}`;
      if (lineErrors[line]) {
        lineErrors[line] = `${lineErrors[line]}\n${entry}`;
      } else {
        lineErrors[line] = entry;
      }
    }

    // Extract variable types if there are errors
    let variableTypes: VariableTypeInfo[] | undefined;
    if (all.length > 0) {
      const program = this.languageService.getProgram();
      const sourceFile = program?.getSourceFile(normalized);
      if (sourceFile && program) {
        variableTypes = this.extractVariableTypes(sourceFile, program);
      }
    }

    return {
      success: all.length === 0,
      errors: Object.keys(lineErrors).length ? lineErrors : undefined,
      variableTypes,
    };
  }

  // Warm the service by building a Program once. Speeds up first query.
  prewarm(): void {
    this.languageService.getProgram();
  }

  // Drop a virtual file from the service cache
  removeVirtualFile(fileName: string): void {
    const normalized = this.normalize(fileName);
    this.snapshots.delete(normalized);
  }

  private createFormatHost(): ts.FormatDiagnosticsHost {
    return {
      getCurrentDirectory: () => this.projectDir,
      getCanonicalFileName: (f) =>
        ts.sys.useCaseSensitiveFileNames ? f : f.toLowerCase(),
      getNewLine: () => ts.sys.newLine,
    };
  }

  /**
   * Expands a type to show its full structure, not just the type name
   */
  private expandTypeString(
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
              const expanded = this.expandTypeString(
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
              prop.valueDeclaration ||
              prop.getDeclarations()?.[0] ||
              sourceFile;
            const propType = typeChecker.getTypeOfSymbolAtLocation(
              prop,
              propDeclaration
            );
            const propTypeString = this.expandTypeString(
              propType,
              typeChecker,
              sourceFile,
              new Set(visited)
            );
            const optional =
              prop.getFlags() & ts.SymbolFlags.Optional ? '?' : '';
            expandedParts.push(
              `${prop.getName()}${optional}: ${propTypeString}`
            );
          }

          if (expandedParts.length > 0) {
            const remaining =
              properties.length > 20
                ? `... ${properties.length - 20} more`
                : '';
            return `{ ${expandedParts.join('; ')}${remaining ? `; ${remaining}` : ''} }`;
          }
        }
      }
    }

    // For union types, expand each member
    if (type.isUnion()) {
      const unionTypes = type.types.map((t) =>
        this.expandTypeString(t, typeChecker, sourceFile, new Set(visited))
      );
      return unionTypes.join(' | ');
    }

    // For intersection types, expand each member
    if (type.isIntersection()) {
      const intersectionTypes = type.types.map((t) =>
        this.expandTypeString(t, typeChecker, sourceFile, new Set(visited))
      );
      return intersectionTypes.join(' & ');
    }

    return baseTypeString;
  }

  /**
   * Extracts type definitions for all variables in the source file
   */
  private extractVariableTypes(
    sourceFile: ts.SourceFile,
    program: ts.Program
  ): VariableTypeInfo[] {
    const typeChecker = program.getTypeChecker();
    const variableTypes: VariableTypeInfo[] = [];
    const expandTypeString = (
      type: ts.Type,
      visited: Set<ts.Type> = new Set()
    ) => this.expandTypeString(type, typeChecker, sourceFile, visited);

    const visit = (node: ts.Node) => {
      // Extract variable declarations
      if (ts.isVariableDeclaration(node)) {
        const name = node.name;
        if (ts.isIdentifier(name)) {
          const variableName = name.text;
          const type = typeChecker.getTypeAtLocation(node);
          const typeString = expandTypeString(type);

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
                const typeString = expandTypeString(type);

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
        const typeString = expandTypeString(type);

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
          const typeString = expandTypeString(type);

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
    };

    visit(sourceFile);

    return variableTypes;
  }
}

// Pool warm services by tsconfig path for server reuse
const checkerPool = new Map<string, LanguageServiceTypechecker>();
export function getWarmChecker(
  configPath = './tsconfig.json'
): LanguageServiceTypechecker {
  const cwd = ts.sys.getCurrentDirectory();
  const resolved = path.isAbsolute(configPath)
    ? configPath
    : path.join(cwd, configPath);
  const key = ts.sys.useCaseSensitiveFileNames
    ? resolved
    : resolved.toLowerCase();
  let service = checkerPool.get(key);
  if (!service) {
    service = new LanguageServiceTypechecker(resolved);
    service.prewarm();
    checkerPool.set(key, service);
  }
  return service;
}

/**
 * Convenience API for backend use: pass code string and receive diagnostics.
 * - fileName only influences cache identity and relative module resolution.
 * - configPath selects the tsconfig used to resolve libs and types.
 */
export function validateScript(
  code: string,
  options?: { fileName?: string; configPath?: string }
): DiagnosticsResult {
  const svc = getWarmChecker(options?.configPath);
  return svc.checkCode(code, options?.fileName ?? 'virtual/script.ts');
}
