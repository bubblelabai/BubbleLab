import { analyze, resetIds } from '@bubblelab/ts-scope-manager';
import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type {
  ScopeManager,
  Scope,
  Variable,
} from '@bubblelab/ts-scope-manager';
import {
  BubbleFactory,
  BubbleTriggerEventRegistry,
} from '@bubblelab/bubble-core';
import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { BubbleParser } from '../extraction/BubbleParser';

export class BubbleScript {
  private ast: TSESTree.Program;
  private scopeManager: ScopeManager;

  // Stores parsed bubble information with variable $id as key
  private parsedBubbles: Record<number, ParsedBubbleWithInfo>;
  private originalParsedBubbles: Record<number, ParsedBubbleWithInfo>;
  private scriptVariables: Record<number, Variable>; // Maps Variable.$id to Variable
  private variableLocations: Record<
    number,
    { startLine: number; startCol: number; endLine: number; endCol: number }
  >; // Maps Variable.$id to location
  private handleMethodLocation: { startLine: number; endLine: number } | null;
  private bubbleScript: string;
  private bubbleFactory: BubbleFactory;
  public currentBubbleScript: string;
  public triggerEventType: keyof BubbleTriggerEventRegistry;

  /**
   * Reparse the AST and bubbles after the script has been modified
   * This is necessary when the script text changes but we need updated bubble locations
   */
  reparseAST(): void {
    // Reset ID generator to ensure deterministic variable IDs
    resetIds();

    // Parse the modified script into a new AST
    this.ast = parse(this.currentBubbleScript, {
      range: true, // Required for scope-manager
      loc: true, // Location info for line numbers
      sourceType: 'module', // Treat as ES module
      ecmaVersion: 2022, // Modern JS/TS features
    });
    console.log('Done parsing AST');

    // Analyze scope to build variable dependency graph
    this.scopeManager = analyze(this.ast, {
      sourceType: 'module',
    });
    this.variableLocations = {};
    // Build variable mapping first
    this.scriptVariables = this.buildVariableMapping();

    // Parse bubble dependencies from AST using the provided factory and scope manager
    const bubbleParser = new BubbleParser(this.currentBubbleScript);
    const parseResult = bubbleParser.parseBubblesFromAST(
      this.bubbleFactory,
      this.ast,
      this.scopeManager
    );

    this.parsedBubbles = parseResult.bubbles;
    this.triggerEventType =
      this.getBubbleTriggerEventType() as keyof BubbleTriggerEventRegistry;
  }

  constructor(bubbleScript: string, bubbleFactory: BubbleFactory) {
    // Reset ID generator to ensure deterministic variable IDs
    resetIds();

    // Parse the bubble script into AST
    this.bubbleScript = bubbleScript;
    this.currentBubbleScript = bubbleScript;
    this.bubbleFactory = bubbleFactory;
    this.ast = parse(bubbleScript, {
      range: true, // Required for scope-manager
      loc: true, // Location info for line numbers
      sourceType: 'module', // Treat as ES module
      ecmaVersion: 2022, // Modern JS/TS features
    });

    // Analyze scope to build variable dependency graph
    this.scopeManager = analyze(this.ast, {
      sourceType: 'module',
    });
    this.variableLocations = {};

    // Build variable mapping first
    this.scriptVariables = this.buildVariableMapping();

    // Parse bubble dependencies from AST using the provided factory and scope manager
    const bubbleParser = new BubbleParser(bubbleScript);
    const parseResult = bubbleParser.parseBubblesFromAST(
      bubbleFactory,
      this.ast,
      this.scopeManager
    );

    this.parsedBubbles = parseResult.bubbles;
    this.originalParsedBubbles = parseResult.bubbles;
    this.handleMethodLocation = parseResult.handleMethodLocation;
    this.triggerEventType =
      this.getBubbleTriggerEventType() as keyof BubbleTriggerEventRegistry;
  }

  // getter for bubblescript (computed property)
  public get bubblescript(): string {
    // Regenerate the script
    return this.currentBubbleScript;
  }

  /**
   * Get all variable names available at a specific line (excluding globals)
   * This is like setting a debugger breakpoint at that line
   */
  getVarsForLine(lineNumber: number): Variable[] {
    // Find ALL scopes that contain this line (not just one)
    const containingScopes = this.getAllScopesContainingLine(lineNumber);

    if (containingScopes.length === 0) {
      return [];
    }

    // Collect variables from all containing scopes
    const allAccessibleVars = new Set<Variable>();

    for (const scope of containingScopes) {
      // Add variables from this scope
      for (const variable of scope.variables) {
        allAccessibleVars.add(variable);
      }

      // Walk up the parent chain for this scope
      let parentScope = scope.upper;
      while (parentScope) {
        for (const variable of parentScope.variables) {
          allAccessibleVars.add(variable);
        }
        parentScope = parentScope.upper;
      }
    }

    // Convert to array and filter
    const accessibleVars: Variable[] = Array.from(allAccessibleVars);

    // Filter out global/built-in variables AND variables declared after this line
    return accessibleVars
      .filter((variable) => !this.isGlobalVariable(variable))
      .filter((variable) =>
        this.isVariableDeclaredBeforeLine(variable, lineNumber)
      )
      .map((variable) => variable);
  }

  /**
   * Find ALL scopes that contain the given line number
   * This is crucial because variables can be in sibling scopes (like block + for)
   */
  private getAllScopesContainingLine(lineNumber: number): Scope[] {
    const containingScopes: Scope[] = [];

    for (const scope of this.scopeManager.scopes) {
      const scopeStart = scope.block.loc?.start.line || 0;
      const scopeEnd = scope.block.loc?.end.line || 0;

      // Check if line is within this scope
      if (lineNumber >= scopeStart && lineNumber <= scopeEnd) {
        containingScopes.push(scope);
      }
    }

    // Sort by specificity (smaller ranges first, then by type priority)
    return containingScopes.sort((a, b) => {
      const rangeA =
        (a.block.loc?.end.line || 0) - (a.block.loc?.start.line || 0);
      const rangeB =
        (b.block.loc?.end.line || 0) - (b.block.loc?.start.line || 0);

      if (rangeA !== rangeB) {
        return rangeA - rangeB; // Smaller range first
      }

      // Same range, prefer by type priority
      const scopePriority = {
        block: 5,
        for: 4,
        function: 3,
        module: 2,
        global: 1,
      };
      const priorityA =
        scopePriority[a.type as keyof typeof scopePriority] || 0;
      const priorityB =
        scopePriority[b.type as keyof typeof scopePriority] || 0;

      return priorityB - priorityA; // Higher priority first
    });
  }

  /**
   * Find the most specific scope that contains the given line number
   */
  private findScopeForLine(lineNumber: number): Scope | null {
    let targetScope: Scope | null = null;
    let smallestRange = Infinity;

    for (const scope of this.scopeManager.scopes) {
      const scopeStart = scope.block.loc?.start.line || 0;
      const scopeEnd = scope.block.loc?.end.line || 0;

      // Check if line is within this scope
      if (lineNumber >= scopeStart && lineNumber <= scopeEnd) {
        const scopeRange = scopeEnd - scopeStart;

        // Prefer module scope over global scope when they have same range
        const isPreferredScope =
          scope.type === 'module' && targetScope?.type === 'global';

        // Find the most specific (smallest) scope containing this line
        if (scopeRange < smallestRange || isPreferredScope) {
          smallestRange = scopeRange;
          targetScope = scope;
        }
      }
    }

    return targetScope;
  }

  /**
   * Get all variables accessible from a scope (including parent scopes)
   * This mimics how debugger shows variables from current scope + outer scopes
   */
  private getAllAccessibleVariables(scope: Scope): Variable[] {
    const variables: Variable[] = [];
    let currentScope: Scope | null = scope;

    // Walk up the scope chain (like debugger scope stack)
    while (currentScope) {
      variables.push(...currentScope.variables);
      currentScope = currentScope.upper; // Parent scope
    }

    return variables;
  }

  /**
   * Check if a variable is declared before a given line number
   * This ensures we only return variables that actually exist at the breakpoint
   */
  private isVariableDeclaredBeforeLine(
    variable: Variable,
    lineNumber: number
  ): boolean {
    // Get the line where this variable is declared
    const declarations = variable.defs;
    if (!declarations || declarations.length === 0) {
      return true; // If no declaration info, assume it's available (like function params)
    }

    // Check if any declaration is at or before the target line
    return declarations.some((def) => {
      const declLine = def.node?.loc?.start?.line;
      return declLine !== undefined && declLine <= lineNumber;
    });
  }

  /**
   * Check if a variable is a global/built-in (filter these out)
   */
  private isGlobalVariable(variable: Variable): boolean {
    // Filter out TypeScript/JavaScript built-ins
    const globalNames = new Set([
      'console',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Date',
      'Math',
      'JSON',
      'Promise',
      'Error',
      'Function',
      'Symbol',
      'Map',
      'Set',
      'WeakMap',
      'WeakSet',
      'Proxy',
      'Reflect',
      'Buffer',
      'process',
      'global',
      'require',
      '__dirname',
      '__filename',
      'module',
      'exports',
      // TypeScript globals
      'Intl',
      'SymbolConstructor',
      'ArrayConstructor',
      'MapConstructor',
      'SetConstructor',
      'PromiseConstructor',
      'ErrorConstructor',
      'RegExp',
      'PropertyKey',
      'PropertyDescriptor',
      'Partial',
      'Required',
      'Readonly',
      'Pick',
      'Record',
      'Exclude',
      'Extract',
      'Omit',
      'NonNullable',
    ]);

    return (
      globalNames.has(variable.name) ||
      variable.scope.type === 'global' ||
      variable.name.includes('Constructor') ||
      variable.name.includes('Array') ||
      variable.name.includes('Iterator') ||
      variable.name.startsWith('Disposable') ||
      variable.name.startsWith('Async') ||
      variable.name.includes('Decorator')
    );
  }

  /**
   * Debug method: Get detailed scope info for a line
   */
  getScopeInfoForLine(lineNumber: number): {
    scopeType: string;
    variables: string[];
    allAccessible: string[];
    lineRange: string;
  } | null {
    const targetScope = this.findScopeForLine(lineNumber);

    if (!targetScope) {
      return null;
    }

    const scopeVars = targetScope.variables
      .filter((v: Variable) => !this.isGlobalVariable(v))
      .map((v: Variable) => v.name);

    const allVars = this.getAllAccessibleVariables(targetScope)
      .filter((v: Variable) => !this.isGlobalVariable(v))
      .map((v) => v.name);

    return {
      scopeType: targetScope.type,
      variables: scopeVars,
      allAccessible: allVars,
      lineRange: `${targetScope.block.loc?.start.line}-${targetScope.block.loc?.end.line}`,
    };
  }

  /**
   * Build a mapping of all user-defined variables with unique IDs
   * Also cross-references with parsed bubbles
   */
  private buildVariableMapping(): Record<number, Variable> {
    const variableMap: Record<number, Variable> = {};
    this.variableLocations = {};

    // Collect all user-defined variables from all scopes
    for (const scope of this.scopeManager.scopes) {
      for (const variable of scope.variables) {
        if (!this.isGlobalVariable(variable)) {
          // Use the Variable's built-in $id as the key
          variableMap[variable.$id] = variable;

          // Extract location information from the variable's definition
          const location = this.extractVariableLocation(variable);
          if (location) {
            this.variableLocations[variable.$id] = location;
          }
        }
      }
    }

    return variableMap;
  }

  /**
   * Extract precise location (line and column) for a variable
   */
  private extractVariableLocation(variable: Variable): {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  } | null {
    // Get the primary definition of the variable
    const primaryDef = variable.defs[0];
    if (!primaryDef?.node?.loc) return null;

    const loc = primaryDef.node.loc;
    return {
      startLine: loc.start.line,
      startCol: loc.start.column,
      endLine: loc.end.line,
      endCol: loc.end.column,
    };
  }

  /**
   * Get Variable object by its $id
   */
  getVariableById(id: number): Variable | undefined {
    return this.scriptVariables[id];
  }

  /**
   * Get all user-defined variables with their $ids
   */
  getAllVariablesWithIds(): Record<number, Variable> {
    return { ...this.scriptVariables };
  }

  /**
   * Get all user-defined variables in the entire script
   */
  getAllUserVariables(): string[] {
    const allVars = new Set<string>();

    for (const scope of this.scopeManager.scopes) {
      for (const variable of scope.variables) {
        if (!this.isGlobalVariable(variable)) {
          allVars.add(variable.name);
        }
      }
    }

    return Array.from(allVars);
  }

  /**
   * Get the parsed AST (for debugging or further analysis)
   */
  getAST(): TSESTree.Program {
    return this.ast;
  }

  getOriginalParsedBubbles(): Record<number, ParsedBubbleWithInfo> {
    return this.originalParsedBubbles;
  }

  /**
   * Get the scope manager (for advanced analysis)
   */
  getScopeManager(): ScopeManager {
    return this.scopeManager;
  }

  /**
   * Get the parsed bubbles found in the script
   */
  getParsedBubbles(): Record<number, ParsedBubbleWithInfo> {
    return this.parsedBubbles;
  }

  /**
   * Get the handle method location (start and end lines)
   */
  getHandleMethodLocation(): { startLine: number; endLine: number } | null {
    return this.handleMethodLocation;
  }

  /**
   * Get location information for a variable by its $id
   */
  getVariableLocation(variableId: number): {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  } | null {
    return this.variableLocations[variableId] || null;
  }

  /**
   * Get all variable locations
   */
  getAllVariableLocations(): Record<
    number,
    { startLine: number; startCol: number; endLine: number; endCol: number }
  > {
    return { ...this.variableLocations };
  }

  resetBubbleScript(): void {
    this.currentBubbleScript = this.bubbleScript;
  }

  /** Reassign variable to another value and assign to the new bubble script and return the new bubble script */
  reassignVariable(variableId: number, newValue: string): string {
    const variable = this.getVariableById(variableId);
    if (!variable) {
      throw new Error(`Variable with ID ${variableId} not found`);
    }

    const location = this.getVariableLocation(variableId);
    if (!location) {
      throw new Error(
        `Location for variable ${variable.name} (ID: ${variableId}) not found`
      );
    }

    // Split the current script into lines
    const lines = this.currentBubbleScript.split('\n');

    // Get the line content (convert from 1-based to 0-based indexing)
    const lineIndex = location.startLine - 1;
    const originalLine = lines[lineIndex];

    // Find the variable declaration pattern and replace its value
    // Handle different patterns: const/let/var varName = value
    const variablePattern = new RegExp(
      `(\\b(?:const|let|var)\\s+${this.escapeRegExp(variable.name)}\\s*=\\s*)([^;,\\n]+)`,
      'g'
    );

    if (variablePattern.test(originalLine)) {
      // Replace the value part
      const newLine = originalLine.replace(variablePattern, `$1${newValue}`);
      lines[lineIndex] = newLine;
    } else {
      // If pattern doesn't match, try simpler assignment pattern
      const assignmentPattern = new RegExp(
        `(\\b${this.escapeRegExp(variable.name)}\\s*=\\s*)([^;,\\n]+)`,
        'g'
      );

      if (assignmentPattern.test(originalLine)) {
        const newLine = originalLine.replace(
          assignmentPattern,
          `$1${newValue}`
        );
        lines[lineIndex] = newLine;
      } else {
        throw new Error(
          `Could not find variable assignment pattern for ${variable.name} on line ${location.startLine}`
        );
      }
    }

    // Update the current script and return it
    this.currentBubbleScript = lines.join('\n');
    return this.currentBubbleScript;
  }

  /** Inject lines of script at particular locations and return the new bubble script */
  injectLines(lines: string[], lineNumber: number): string {
    if (lineNumber < 1) {
      throw new Error('Line number must be 1 or greater');
    }

    // Split the current script into lines
    const scriptLines = this.currentBubbleScript.split('\n');
    console.log('scriptLines', scriptLines);

    // Convert from 1-based to 0-based indexing
    const insertIndex = lineNumber - 1;

    // Validate the line number
    if (insertIndex > scriptLines.length) {
      throw new Error(
        `Line number ${lineNumber} exceeds script length (${scriptLines.length} lines)`
      );
    }

    // Insert the new lines at the specified position
    scriptLines.splice(insertIndex, 0, ...lines);

    // Update the current script and return it
    this.currentBubbleScript = scriptLines.join('\n');
    return this.currentBubbleScript;
  }

  /**
   * Helper method to escape special regex characters in variable names
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a JSON Schema object for the payload parameter of the top-level `handle` entrypoint.
   * Delegates to BubbleParser for the actual implementation.
   */
  public getPayloadJsonSchema(): Record<string, unknown> | null {
    const bubbleParser = new BubbleParser(this.currentBubbleScript);
    return bubbleParser.getPayloadJsonSchema(this.ast);
  }

  /**
   * Detect the BubbleTriggerEventRegistry key from the class extends generic.
   * Example: class X extends BubbleFlow<'slack/bot_mentioned'> {}
   * Returns the string key (e.g., 'slack/bot_mentioned') or null if not found.
   */
  public getBubbleTriggerEventType(): string | null {
    for (const stmt of this.ast.body) {
      const tryClass = (cls: TSESTree.ClassDeclaration | null | undefined) => {
        if (!cls) return null;
        const superClass = cls.superClass;
        if (!superClass || superClass.type !== 'Identifier') return null;
        if (superClass.name !== 'BubbleFlow') return null;
        // typescript-estree attaches generic params to superTypeParameters
        const params = (
          cls as unknown as {
            superTypeParameters?: TSESTree.TSTypeParameterInstantiation | null;
          }
        ).superTypeParameters;
        const firstParam = params?.params?.[0];
        if (!firstParam) return null;
        if (
          firstParam.type === 'TSLiteralType' &&
          firstParam.literal.type === 'Literal'
        ) {
          const v = firstParam.literal.value;
          return typeof v === 'string' ? v : null;
        }
        return null;
      };

      if (stmt.type === 'ClassDeclaration') {
        const val = tryClass(stmt);
        if (val) return val;
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'ClassDeclaration'
      ) {
        const val = tryClass(stmt.declaration);
        if (val) return val;
      }
    }
    // Fallback: simple regex over the source to catch extends BubbleFlow<'event/key'>
    const match = this.currentBubbleScript.match(
      /extends\s+BubbleFlow\s*<\s*(['"`])([^'"`]+)\1\s*>/m
    );
    if (match && typeof match[2] === 'string') {
      return match[2];
    }
    return null;
  }
}
