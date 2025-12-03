import { BubbleScript } from '../parse/BubbleScript';
import type { MethodInvocationInfo } from '../parse/BubbleScript';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { hashToVariableId, buildCallSiteKey } from '@bubblelab/shared-schemas';

export interface LoggingInjectionOptions {
  enableLineByLineLogging: boolean;
  enableBubbleLogging: boolean;
  enableVariableLogging: boolean;
}

export class LoggerInjector {
  private bubbleScript: BubbleScript;
  private options: LoggingInjectionOptions;

  constructor(
    bubbleScript: BubbleScript,
    options: Partial<LoggingInjectionOptions> = {}
  ) {
    this.bubbleScript = bubbleScript;
    this.options = {
      enableLineByLineLogging: true,
      enableBubbleLogging: true,
      enableVariableLogging: true,
      ...options,
    };
  }

  /**
   * Inject comprehensive logging into the bubble script using existing analysis
   */
  injectLogging(): string {
    const modifiedScript = this.bubbleScript.currentBubbleScript;
    const lines = modifiedScript.split('\n');

    // Inject function call logging FIRST (before line logging shifts line numbers)
    this.injectFunctionCallLogging(lines);

    // Update the script and reparse AST after function call logging
    this.bubbleScript.currentBubbleScript = lines.join('\n');
    this.bubbleScript.reparseAST();

    // Inject statement-level logging in handle method (now with updated AST)
    if (this.options.enableLineByLineLogging) {
      const updatedLines = this.bubbleScript.currentBubbleScript.split('\n');
      this.injectLineLogging(updatedLines);
      this.bubbleScript.currentBubbleScript = updatedLines.join('\n');
    }

    return this.bubbleScript.currentBubbleScript;
  }

  /**
   * Inject logging using original line numbers for traceability
   */
  injectLoggingWithOriginalLines(
    originalAST: any,
    originalHandleMethodLocation: any
  ): string {
    const modifiedScript = this.bubbleScript.currentBubbleScript;
    const lines = modifiedScript.split('\n');

    // Inject statement-level logging using original line numbers
    if (this.options.enableLineByLineLogging) {
      this.injectLineLoggingWithOriginalLines(
        lines,
        originalAST,
        originalHandleMethodLocation
      );
    }

    this.bubbleScript.currentBubbleScript = lines.join('\n');
    return lines.join('\n');
  }

  /**
   * Inject statement-level logging using existing AST analysis
   */
  private injectLineLogging(lines: string[]): void {
    const handleMethodLocation = this.bubbleScript.getHandleMethodLocation();

    if (!handleMethodLocation) {
      console.warn(
        'Handle method location not found, skipping statement logging'
      );
      return;
    }

    // Note: __bubbleFlowSelf should already be injected via injectSelfCapture()
    // which is called before this method in injectBubbleLoggingAndReinitializeBubbleParameters()

    // Get the existing AST and find statements within the handle method
    const ast = this.bubbleScript.getAST();
    const statements = this.findStatementsInHandleMethod(
      ast,
      handleMethodLocation
    );

    // Sort statements by line number (reverse order for safe insertion)
    statements.sort((a, b) => b.line - a.line);

    // Insert logging after each statement
    for (const statement of statements) {
      const arrayIndex = statement.line - 1; // Convert to 0-based index

      if (arrayIndex >= 0 && arrayIndex < lines.length) {
        const line = lines[arrayIndex];
        const indentation = line.match(/^\s*/)?.[0] || '    ';
        // Use __bubbleFlowSelf.logger instead of this.logger for nested function support
        const statementLog = `${indentation}__bubbleFlowSelf.logger?.logLine(${statement.line}, 'Statement: ${statement.type}');`;

        // Insert after the statement line
        lines.splice(arrayIndex + 1, 0, statementLog);
      }
    }
  }

  /**
   * Inject statement-level logging using original line numbers for traceability
   */
  private injectLineLoggingWithOriginalLines(
    lines: string[],
    originalAST: any,
    originalHandleMethodLocation: {
      startLine: number;
      endLine: number;
      definitionStartLine: number;
      bodyStartLine: number;
    }
  ): void {
    if (!originalHandleMethodLocation) {
      console.warn(
        'Original handle method location not found, skipping statement logging'
      );
      return;
    }

    // Note: __bubbleFlowSelf should already be injected via injectSelfCapture()
    // which is called before this method in injectBubbleLoggingAndReinitializeBubbleParameters()

    // Find statements within the original handle method
    const statements = this.findStatementsInHandleMethod(
      originalAST,
      originalHandleMethodLocation
    );

    // Sort statements by line number (reverse order for safe insertion)
    statements.sort((a, b) => b.line - a.line);

    // Insert logging after each statement using original line numbers
    for (const statement of statements) {
      const arrayIndex = statement.line - 1; // Convert to 0-based index

      if (arrayIndex >= 0 && arrayIndex < lines.length) {
        const line = lines[arrayIndex];
        const indentation = line.match(/^\s*/)?.[0] || '    ';
        // Use __bubbleFlowSelf.logger instead of this.logger for nested function support
        const statementLog = `${indentation}__bubbleFlowSelf.logger?.logLine(${statement.line}, 'Statement: ${statement.type}');`;

        // Insert after the statement line
        lines.splice(arrayIndex + 1, 0, statementLog);
      }
    }
  }

  /**
   * Inject `const __bubbleFlowSelf = this;` at the beginning of all instance method bodies
   * This captures `this` in a lexical variable that works at any nesting level
   * This should be called BEFORE reapplyBubbleInstantiations so bubble instantiations can use __bubbleFlowSelf.logger
   */
  injectSelfCapture(): void {
    // Reparse AST first to get updated method locations after script modifications
    this.bubbleScript.reparseAST();
    const instanceMethodsLocation = this.bubbleScript.instanceMethodsLocation;

    if (
      !instanceMethodsLocation ||
      Object.keys(instanceMethodsLocation).length === 0
    ) {
      console.warn(
        'Instance methods location not found, skipping __bubbleFlowSelf injection'
      );
      return;
    }

    // Process methods in reverse order of bodyStartLine to avoid line number shifts
    const methods = Object.entries(instanceMethodsLocation).sort(
      (a, b) => b[1].bodyStartLine - a[1].bodyStartLine
    );

    for (const [, location] of methods) {
      // Get the indentation from the method body start line
      const lines = this.bubbleScript.currentBubbleScript.split('\n');
      const bodyStartLineIndex = location.bodyStartLine - 1;

      if (bodyStartLineIndex >= 0 && bodyStartLineIndex < lines.length) {
        const bodyStartLine = lines[bodyStartLineIndex];

        // Check if __bubbleFlowSelf already exists in this method to avoid duplicates
        const methodStartIndex = location.startLine - 1;
        const methodEndIndex = Math.min(location.endLine, lines.length);
        const methodBodyLines = lines.slice(methodStartIndex, methodEndIndex);
        const methodBody = methodBodyLines.join('\n');

        if (methodBody.includes('const __bubbleFlowSelf = this;')) {
          // Already injected, skip
          continue;
        }

        // Extract indentation from the line (usually 2 spaces for method body)
        const match = bodyStartLine.match(/^(\s*)/);
        const indentation = match ? match[1] : '  ';

        // Add one level of indentation for the injected statement
        const selfCapture = `${indentation}  const __bubbleFlowSelf = this;`;

        // Inject self capture at body start line (after opening brace)
        // bodyStartLine is the line with the opening brace, so inject on the next line
        this.bubbleScript.injectLines(
          [selfCapture],
          location.bodyStartLine + 1
        );
      }
    }
    this.bubbleScript.reparseAST();
    this.bubbleScript.showScript(
      '[LoggerInjector] After injectSelfCapture in all methods'
    );
  }

  /**
   * Find all statements within the handle method using AST
   */
  private findStatementsInHandleMethod(
    ast: TSESTree.Program,
    handleMethodLocation: {
      startLine: number;
      endLine: number;
      definitionStartLine: number;
      bodyStartLine: number;
    }
  ): Array<{ line: number; type: string }> {
    const statements: Array<{ line: number; type: string }> = [];

    const visitNode = (node: TSESTree.Node) => {
      if (!node || typeof node !== 'object') return;

      // Check if this node is a statement within the handle method
      if (
        node.loc &&
        node.loc.start.line >= handleMethodLocation.startLine &&
        node.loc.end.line <= handleMethodLocation.endLine
      ) {
        // Check if it's a statement type we want to log
        const statementTypes = [
          'VariableDeclaration',
          'ExpressionStatement',
          'ReturnStatement',
          'IfStatement',
          'ForStatement',
          'WhileStatement',
          'TryStatement',
          'ThrowStatement',
        ];

        if (statementTypes.includes(node.type)) {
          statements.push({
            line: node.loc.end.line, // Use end line for insertion point
            type: node.type,
          });
        }
      }

      // Recursively visit child nodes using a type-safe approach
      this.visitChildNodes(node, visitNode);
    };

    visitNode(ast);
    return statements;
  }

  private visitChildNodes(
    node: TSESTree.Node,
    visitor: (node: TSESTree.Node) => void
  ): void {
    // Use a more comprehensive approach that handles all node types
    const visitValue = (value: unknown): void => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach(visitValue);
        } else if ('type' in value && typeof value.type === 'string') {
          // This is likely an AST node
          visitor(value as TSESTree.Node);
        } else {
          // This is a regular object, recurse into its properties
          Object.values(value).forEach(visitValue);
        }
      }
    };

    // Get all property values of the node, excluding metadata properties
    const nodeObj = node as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(nodeObj)) {
      // Skip metadata properties that aren't part of the AST structure
      if (key === 'parent' || key === 'loc' || key === 'range') {
        continue;
      }

      visitValue(value);
    }
  }

  /**
   * Inject logging for all method invocations using pre-tracked invocation data
   * Uses rich invocation info captured during AST parsing
   */
  private injectFunctionCallLogging(lines: string[]): void {
    // Reparse AST to get current invocation lines (after script modifications)
    this.bubbleScript.reparseAST();
    const instanceMethods = this.bubbleScript.instanceMethodsLocation;

    if (!instanceMethods || Object.keys(instanceMethods).length === 0) {
      return;
    }

    // Collect all invocations with their rich metadata
    const invocations: Array<
      MethodInvocationInfo & { methodName: string; variableId: number }
    > = [];

    for (const [methodName, methodInfo] of Object.entries(instanceMethods)) {
      for (const invocationInfo of methodInfo.invocationLines) {
        // Generate a deterministic variableId based on method name + call site location
        // This ensures each invocation gets a unique ID even when the same method is called multiple times
        const variableId = hashToVariableId(
          buildCallSiteKey(methodName, invocationInfo.invocationIndex)
        );
        invocations.push({ ...invocationInfo, methodName, variableId });
      }
    }

    // Sort by line number in reverse order for safe insertion
    invocations.sort((a, b) => b.lineNumber - a.lineNumber);

    // Inject logging for each invocation
    for (const invocation of invocations) {
      this.injectLoggingForInvocation(lines, invocation);
    }
  }

  /**
   * Inject logging before and after a method invocation line
   * Uses pre-parsed invocation data from AST analysis - no regex parsing needed
   */
  private injectLoggingForInvocation(
    lines: string[],
    invocation: MethodInvocationInfo & {
      methodName: string;
      variableId: number;
    }
  ): void {
    const {
      lineNumber,
      endLineNumber,
      methodName,
      variableId,
      invocationIndex,
      hasAwait,
      arguments: args,
      statementType,
      variableName,
      variableType,
      destructuringPattern,
      context = 'default',
    } = invocation;
    const lineIndex = lineNumber - 1;
    const endLineIndex = endLineNumber - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return;
    }

    const line = lines[lineIndex];
    const indentation = line.match(/^\s*/)?.[0] || '    ';

    // Use pre-parsed arguments
    const argsArray = args ? `[${args}]` : '[]';

    const callSiteKey = buildCallSiteKey(methodName, invocationIndex);
    const callSiteKeyLiteral = JSON.stringify(callSiteKey);
    const resultVar = `__functionCallResult_${variableId}`;
    const durationVar = `__functionCallDuration_${variableId}`;
    const argsVar = `__functionCallArgs_${variableId}`;
    const prevInvocationVar = `__prevInvocationCallSiteKey_${variableId}`;
    const setInvocationLine = `${indentation}const ${prevInvocationVar} = __bubbleFlowSelf?.__setInvocationCallSiteKey?.(${callSiteKeyLiteral});`;
    const restoreInvocationLine = `${indentation}__bubbleFlowSelf?.__restoreInvocationCallSiteKey?.(${prevInvocationVar});`;

    const startLog = `${indentation}const __functionCallStart_${variableId} = Date.now();`;
    const argsLog = `${indentation}const ${argsVar} = ${argsArray};`;
    const startCallLog = `${indentation}__bubbleFlowSelf.logger?.logFunctionCallStart(${variableId}, '${methodName}', ${argsVar}, ${lineNumber});`;

    // Calculate how many lines to remove (from lineNumber to endLineNumber)
    const linesToRemove = endLineIndex - lineIndex + 1;

    if (context === 'promise_all_element') {
      this.injectPromiseAllElementLogging(
        lines,
        lineIndex,
        linesToRemove,
        indentation,
        {
          args,
          argsArray,
          argsVar,
          durationVar,
          lineNumber,
          methodName,
          resultVar,
          variableId,
          callSiteKeyLiteral,
        }
      );
      return;
    }

    // Use pre-determined statement type instead of regex matching
    if (
      statementType === 'variable_declaration' &&
      (variableName || destructuringPattern) &&
      variableType
    ) {
      const callLine = `${indentation}const ${resultVar} = ${hasAwait ? 'await ' : ''}this.${methodName}(${args});`;
      const completeLog = `${indentation}const ${durationVar} = Date.now() - __functionCallStart_${variableId}; __bubbleFlowSelf.logger?.logFunctionCallComplete(${variableId}, '${methodName}', ${resultVar}, ${durationVar}, ${lineNumber});`;
      // Use destructuring pattern if present, otherwise use simple variable name
      const assignPattern = destructuringPattern || variableName;
      const assignLine = `${indentation}${variableType} ${assignPattern} = ${resultVar};`;
      lines.splice(
        lineIndex,
        linesToRemove,
        startLog,
        argsLog,
        startCallLog,
        setInvocationLine,
        callLine,
        completeLog,
        restoreInvocationLine,
        assignLine
      );
      return;
    }

    if (statementType === 'return') {
      const callLine = `${indentation}const ${resultVar} = ${hasAwait ? 'await ' : ''}this.${methodName}(${args});`;
      const completeLog = `${indentation}const ${durationVar} = Date.now() - __functionCallStart_${variableId}; __bubbleFlowSelf.logger?.logFunctionCallComplete(${variableId}, '${methodName}', ${resultVar}, ${durationVar}, ${lineNumber});`;
      const returnLine = `${indentation}return ${resultVar};`;
      lines.splice(
        lineIndex,
        linesToRemove,
        startLog,
        argsLog,
        startCallLog,
        setInvocationLine,
        callLine,
        completeLog,
        restoreInvocationLine,
        returnLine
      );
      return;
    }

    if (statementType === 'assignment' && variableName) {
      const callLine = `${indentation}const ${resultVar} = ${hasAwait ? 'await ' : ''}this.${methodName}(${args});`;
      const completeLog = `${indentation}const ${durationVar} = Date.now() - __functionCallStart_${variableId}; __bubbleFlowSelf.logger?.logFunctionCallComplete(${variableId}, '${methodName}', ${resultVar}, ${durationVar}, ${lineNumber});`;
      const assignLine = `${indentation}${variableName} = ${resultVar};`;
      lines.splice(
        lineIndex,
        linesToRemove,
        startLog,
        argsLog,
        startCallLog,
        setInvocationLine,
        callLine,
        completeLog,
        restoreInvocationLine,
        assignLine
      );
      return;
    }

    // Simple statement (no assignment, no return)
    const callLine = `${indentation}const ${resultVar} = ${hasAwait ? 'await ' : ''}this.${methodName}(${args});`;
    const completeLog = `${indentation}const ${durationVar} = Date.now() - __functionCallStart_${variableId}; __bubbleFlowSelf.logger?.logFunctionCallComplete(${variableId}, '${methodName}', ${resultVar}, ${durationVar}, ${lineNumber});`;
    lines.splice(
      lineIndex,
      linesToRemove,
      startLog,
      argsLog,
      startCallLog,
      setInvocationLine,
      callLine,
      completeLog,
      restoreInvocationLine
    );
  }

  private injectPromiseAllElementLogging(
    lines: string[],
    lineIndex: number,
    linesToRemove: number,
    indentation: string,
    details: {
      args: string;
      argsArray: string;
      argsVar: string;
      durationVar: string;
      lineNumber: number;
      methodName: string;
      resultVar: string;
      variableId: number;
      callSiteKeyLiteral: string;
    }
  ): void {
    const {
      args,
      argsArray,
      argsVar,
      durationVar,
      lineNumber,
      methodName,
      resultVar,
      variableId,
      callSiteKeyLiteral,
    } = details;

    const originalLines = lines.slice(lineIndex, lineIndex + linesToRemove);
    const lastOriginalLine = originalLines[originalLines.length - 1] || '';
    const trailingComma = lastOriginalLine.trimEnd().endsWith(',');
    const innerIndent = `${indentation}  `;
    const prevInvocationVar = `__promiseAllPrevInvocationCallSiteKey_${variableId}`;
    const wrappedLines = [
      `${indentation}(async () => {`,
      `${innerIndent}const __functionCallStart_${variableId} = Date.now();`,
      `${innerIndent}const ${argsVar} = ${argsArray};`,
      `${innerIndent}__bubbleFlowSelf.logger?.logFunctionCallStart(${variableId}, '${methodName}', ${argsVar}, ${lineNumber});`,
      `${innerIndent}const ${prevInvocationVar} = __bubbleFlowSelf?.__setInvocationCallSiteKey?.(${callSiteKeyLiteral});`,
      `${innerIndent}const ${resultVar} = await this.${methodName}(${args});`,
      `${innerIndent}const ${durationVar} = Date.now() - __functionCallStart_${variableId};`,
      `${innerIndent}__bubbleFlowSelf.logger?.logFunctionCallComplete(${variableId}, '${methodName}', ${resultVar}, ${durationVar}, ${lineNumber});`,
      `${innerIndent}__bubbleFlowSelf?.__restoreInvocationCallSiteKey?.(${prevInvocationVar});`,
      `${innerIndent}return ${resultVar};`,
      `${indentation}})()${trailingComma ? ',' : ''}`,
    ];

    lines.splice(lineIndex, linesToRemove, ...wrappedLines);
  }
}
