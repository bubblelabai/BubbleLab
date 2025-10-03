import { BubbleScript } from '../parse/BubbleScript';
import type { TSESTree } from '@typescript-eslint/typescript-estree';

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

    // Inject statement-level logging in handle method
    if (this.options.enableLineByLineLogging) {
      this.injectLineLogging(lines);
    }

    this.bubbleScript.currentBubbleScript = lines.join('\n');
    return lines.join('\n');
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
        const indentation = line.match(/^\\s*/)?.[0] || '    ';
        const statementLog = `${indentation}this.logger?.logLine(${statement.line}, 'Statement: ${statement.type}');`;

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
    originalHandleMethodLocation: any
  ): void {
    if (!originalHandleMethodLocation) {
      console.warn(
        'Original handle method location not found, skipping statement logging'
      );
      return;
    }

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
        const indentation = line.match(/^\\s*/)?.[0] || '    ';
        // Use original line number for traceability
        const statementLog = `${indentation}this.logger?.logLine(${statement.line}, 'Statement: ${statement.type}');`;

        // Insert after the statement line
        lines.splice(arrayIndex + 1, 0, statementLog);
      }
    }
  }

  /**
   * Find all statements within the handle method using AST
   */
  private findStatementsInHandleMethod(
    ast: TSESTree.Program,
    handleMethodLocation: { startLine: number; endLine: number }
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
}
