import { analyze, resetIds } from '@bubblelab/ts-scope-manager';
import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type {
  ScopeManager,
  Scope,
  Variable,
} from '@bubblelab/ts-scope-manager';
import { BubbleFactory } from '@bubblelab/bubble-core';
import type {
  ParsedBubbleWithInfo,
  BubbleTrigger,
  BubbleTriggerEventRegistry,
  ParsedWorkflow,
} from '@bubblelab/shared-schemas';
import { BubbleParser } from '../extraction/BubbleParser';

/**
 * Detailed information about a method invocation captured during AST parsing
 */
export interface MethodInvocationInfo {
  lineNumber: number;
  endLineNumber: number;
  columnNumber: number;
  invocationIndex: number;
  hasAwait: boolean;
  arguments: string;
  statementType:
    | 'variable_declaration'
    | 'assignment'
    | 'return'
    | 'simple'
    | 'condition_expression'
    | 'nested_call_expression';
  variableName?: string;
  variableType?: 'const' | 'let' | 'var';
  destructuringPattern?: string; // e.g., "{ a, b }" or "[x, y]" for destructuring assignments
  context?: 'default' | 'promise_all_element';
  /** For condition_expression: the line where the containing statement (if/while/etc) starts */
  containingStatementLine?: number;
  /** For condition_expression: the exact source range of the call expression to replace */
  callRange?: { start: number; end: number };
  /** For condition_expression: the full text of the call expression (e.g., "this.validateEmail(email)") */
  callText?: string;
}

export class BubbleScript {
  private ast: TSESTree.Program;
  private scopeManager: ScopeManager;
  public parsingErrors: string[] = [];

  // Stores parsed bubble information with variable $id as key
  private parsedBubbles: Record<number, ParsedBubbleWithInfo>;
  private originalParsedBubbles: Record<number, ParsedBubbleWithInfo>;
  private workflow: ParsedWorkflow;
  private scriptVariables: Record<number, Variable>; // Maps Variable.$id to Variable
  private variableLocations: Record<
    number,
    { startLine: number; startCol: number; endLine: number; endCol: number }
  >; // Maps Variable.$id to location
  public instanceMethodsLocation: Record<
    string,
    {
      startLine: number;
      endLine: number;
      definitionStartLine: number;
      bodyStartLine: number;
      invocationLines: MethodInvocationInfo[];
    }
  >;
  private bubbleScript: string;
  private bubbleFactory: BubbleFactory;
  public currentBubbleScript: string;
  public trigger: BubbleTrigger;

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
    this.instanceMethodsLocation = parseResult.instanceMethodsLocation;
    this.parsedBubbles = parseResult.bubbles;
    this.workflow = parseResult.workflow;
    this.trigger = this.getBubbleTriggerEventType() ?? { type: 'webhook/http' };
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
    this.workflow = parseResult.workflow;
    this.instanceMethodsLocation = parseResult.instanceMethodsLocation;
    this.trigger = this.getBubbleTriggerEventType() ?? { type: 'webhook/http' };
  }

  // getter for bubblescript (computed property)
  public get bubblescript(): string {
    // Regenerate the script
    return this.currentBubbleScript;
  }

  /** Print script with line numbers in pretty readable format */
  public showScript(message: string): void {
    const lines = this.currentBubbleScript.split('\n');
    console.debug(`###### ${message} ######`);
    console.debug('------------Script--------------');
    console.debug(
      lines.map((line, index) => `${index + 1}: ${line}`).join('\n')
    );
    // Show bubble paramer location (just the basic info)
    console.debug('---------------------------------');

    console.debug('--------Bubble Locations---------');
    const bubbles = this.getParsedBubbles();
    for (const bubble of Object.values(bubbles)) {
      console.debug(
        `Bubble ${bubble.bubbleName} location: ${bubble.location.startLine}-${bubble.location.endLine}`
      );
    }
    // Print instance methods locations
    console.debug('Instance methods locations:');
    for (const [methodName, location] of Object.entries(
      this.instanceMethodsLocation
    )) {
      console.debug(
        `  ${methodName}: ${location.bodyStartLine}-${location.endLine} (invocations: ${location.invocationLines.join(', ')})`
      );
    }
    console.debug('---------------------------------');
    console.debug(`##################`);
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
   * Fills variableLocations
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
   * Get the hierarchical workflow structure
   */
  getWorkflow(): ParsedWorkflow {
    return this.workflow;
  }

  /**
   * Get the handle method location (start and end lines)
   */
  getHandleMethodLocation(): {
    startLine: number;
    endLine: number;
    definitionStartLine: number;
    bodyStartLine: number;
  } | null {
    // Backward compatibility: return handle method from instanceMethodsLocation
    const handleMethod = this.instanceMethodsLocation['handle'];
    if (handleMethod) {
      return {
        startLine: handleMethod.startLine,
        endLine: handleMethod.endLine,
        definitionStartLine: handleMethod.definitionStartLine,
        bodyStartLine: handleMethod.bodyStartLine,
      };
    }
    return null;
  }

  getInstanceMethodLocation(methodName: string): {
    startLine: number;
    endLine: number;
    definitionStartLine: number;
    bodyStartLine: number;
    invocationLines: MethodInvocationInfo[];
  } | null {
    return this.instanceMethodsLocation[methodName] || null;
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
    const schema = bubbleParser.getPayloadJsonSchema(this.ast);
    return schema;
  }

  /**
   * Detect the BubbleTriggerEventRegistry key from the class extends generic.
   * Example: class X extends BubbleFlow<'slack/bot_mentioned'> {}
   * Returns the string key (e.g., 'slack/bot_mentioned') or null if not found.
   */
  public getBubbleTriggerEventType(): BubbleTrigger | null {
    for (const stmt of this.ast.body) {
      const tryClass = (
        cls: TSESTree.ClassDeclaration | null | undefined
      ): BubbleTrigger | null => {
        if (!cls) return null;
        const superClass = cls.superClass;
        if (!superClass || superClass.type !== 'Identifier') return null;
        if (superClass.name !== 'BubbleFlow') return null;

        // Extract the event type from generic parameter
        const params = (
          cls as unknown as {
            superTypeParameters?: TSESTree.TSTypeParameterInstantiation | null;
          }
        ).superTypeParameters;
        const firstParam = params?.params?.[0];
        if (!firstParam) return null;

        let eventType: string | null = null;
        if (
          firstParam.type === 'TSLiteralType' &&
          firstParam.literal.type === 'Literal'
        ) {
          const v = firstParam.literal.value;
          eventType = typeof v === 'string' ? v : null;
        }

        if (!eventType) return null;

        // Extract cronSchedule if this is a schedule/cron event
        let cronSchedule: string | undefined = undefined;
        if (eventType === 'schedule/cron') {
          // Look for cronSchedule property in the class body
          for (const member of cls.body.body) {
            if (
              member.type === 'PropertyDefinition' &&
              member.key.type === 'Identifier' &&
              member.key.name === 'cronSchedule'
            ) {
              // Extract the string literal value
              if (
                member.value &&
                member.value.type === 'Literal' &&
                typeof member.value.value === 'string'
              ) {
                cronSchedule = member.value.value;
                break;
              }
            }
          }
        }

        return {
          type: eventType as keyof BubbleTriggerEventRegistry,
          cronSchedule,
        };
      };

      if (stmt.type === 'ClassDeclaration') {
        const result = tryClass(stmt);
        if (result) {
          return {
            type: result.type,
            cronSchedule: result.cronSchedule,
          };
        }
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'ClassDeclaration'
      ) {
        const result = tryClass(stmt.declaration);
        if (result) {
          return {
            type: result.type,
            cronSchedule: result.cronSchedule,
          };
        }
      }
    }

    // Fallback: simple regex over the source to catch extends BubbleFlow<'event/key'>
    const match = this.currentBubbleScript.match(
      /extends\s+BubbleFlow\s*<\s*(['"`])([^'"`]+)\1\s*>/m
    );
    if (match && typeof match[2] === 'string') {
      const eventType = match[2] as keyof BubbleTriggerEventRegistry;

      // Try to extract cronSchedule via regex if it's a cron event
      let cronSchedule: string | undefined = undefined;
      if (eventType === 'schedule/cron') {
        const cronMatch = this.currentBubbleScript.match(
          /readonly\s+cronSchedule\s*=\s*['"`]([^'"`]+)['"`]/
        );
        if (cronMatch) {
          cronSchedule = cronMatch[1];
        }
      }

      return { type: eventType, cronSchedule };
    }

    return null;
  }
}
