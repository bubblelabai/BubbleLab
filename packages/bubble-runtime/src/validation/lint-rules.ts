import ts from 'typescript';

/**
 * Represents a lint error found during validation
 */
export interface LintError {
  line: number;
  column?: number;
  message: string;
}

/**
 * Context containing pre-parsed AST information for lint rules
 * This allows rules to avoid redundant AST traversals
 */
export interface LintRuleContext {
  sourceFile: ts.SourceFile;
  bubbleFlowClass: ts.ClassDeclaration | null;
  handleMethod: ts.MethodDeclaration | null;
  handleMethodBody: ts.Block | null;
  importedBubbleClasses: Set<string>;
}

/**
 * Interface for lint rules that can validate BubbleFlow code
 */
export interface LintRule {
  name: string;
  validate(context: LintRuleContext): LintError[];
}

/**
 * Registry that manages and executes all lint rules
 */
export class LintRuleRegistry {
  private rules: LintRule[] = [];

  /**
   * Register a lint rule
   */
  register(rule: LintRule): void {
    this.rules.push(rule);
  }

  /**
   * Execute all registered rules on the given code
   * Traverses AST once and shares context with all rules for efficiency
   */
  validateAll(sourceFile: ts.SourceFile): LintError[] {
    // Parse AST once and create shared context
    const context = parseLintRuleContext(sourceFile);

    const errors: LintError[] = [];
    for (const rule of this.rules) {
      try {
        const ruleErrors = rule.validate(context);
        errors.push(...ruleErrors);
      } catch (error) {
        // If a rule fails, log but don't stop other rules
        console.error(`Error in lint rule ${rule.name}:`, error);
      }
    }
    return errors;
  }

  /**
   * Get all registered rule names
   */
  getRuleNames(): string[] {
    return this.rules.map((r) => r.name);
  }
}

/**
 * Parses the AST once to create a shared context for all lint rules
 * This avoids redundant AST traversals by doing a single pass
 */
function parseLintRuleContext(sourceFile: ts.SourceFile): LintRuleContext {
  let bubbleFlowClass: ts.ClassDeclaration | null = null;
  let handleMethod: ts.MethodDeclaration | null = null;
  const importedBubbleClasses = new Set<string>();

  // Single AST traversal to collect all needed information
  const visit = (node: ts.Node) => {
    // Find BubbleFlow class
    if (ts.isClassDeclaration(node) && !bubbleFlowClass) {
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const type of clause.types) {
              if (ts.isIdentifier(type.expression)) {
                if (type.expression.text === 'BubbleFlow') {
                  bubbleFlowClass = node;
                  // Find handle method in this class
                  if (node.members) {
                    for (const member of node.members) {
                      if (ts.isMethodDeclaration(member)) {
                        const name = member.name;
                        if (ts.isIdentifier(name) && name.text === 'handle') {
                          handleMethod = member;
                          break;
                        }
                      }
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Collect imported bubble classes
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (
        ts.isStringLiteral(moduleSpecifier) &&
        (moduleSpecifier.text === '@bubblelab/bubble-core' ||
          moduleSpecifier.text === '@nodex/bubble-core')
      ) {
        if (node.importClause && node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              const importedName = element.name
                ? element.name.text
                : element.propertyName?.text;
              if (importedName) {
                if (
                  (importedName.endsWith('Bubble') ||
                    (importedName.endsWith('Tool') &&
                      !importedName.includes('Structured'))) &&
                  importedName !== 'BubbleFlow' &&
                  importedName !== 'BaseBubble'
                ) {
                  importedBubbleClasses.add(importedName);
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let handleMethodBody: ts.Block | null = null;
  if (handleMethod !== null) {
    const methodBody = (handleMethod as ts.MethodDeclaration).body;
    if (methodBody !== undefined && ts.isBlock(methodBody)) {
      handleMethodBody = methodBody;
    }
  }

  return {
    sourceFile,
    bubbleFlowClass,
    handleMethod,
    handleMethodBody,
    importedBubbleClasses,
  };
}

/**
 * Lint rule that prevents throw statements directly in the handle method
 */
export const noThrowInHandleRule: LintRule = {
  name: 'no-throw-in-handle',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Use pre-parsed context
    if (!context.handleMethodBody) {
      return errors; // No handle method body found, skip this rule
    }

    // Check only direct statements in the method body (not nested)
    for (const statement of context.handleMethodBody.statements) {
      const throwError = checkStatementForThrow(statement, context.sourceFile);
      if (throwError) {
        errors.push(throwError);
      }
    }

    return errors;
  },
};

/**
 * Checks if a statement is a throw statement or contains a throw at the top level
 * Only checks direct statements, not nested blocks
 */
function checkStatementForThrow(
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): LintError | null {
  // Direct throw statement
  if (ts.isThrowStatement(statement)) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart(sourceFile)
    );
    return {
      line: line + 1, // Convert to 1-based
      message:
        'throw statements are not allowed directly in handle method. Move error handling into another step.',
    };
  }

  // Check for if statement with direct throw in then/else branches
  // Note: We only check if the then/else is a direct throw statement, not if it's inside a block
  if (ts.isIfStatement(statement)) {
    // Check if the then branch is a direct throw statement (not inside a block)
    if (ts.isThrowStatement(statement.thenStatement)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        statement.thenStatement.getStart(sourceFile)
      );
      return {
        line: line + 1,
        message:
          'throw statements are not allowed directly in handle method. Move error handling into another step.',
      };
    }

    // Check if the else branch is a direct throw statement (not inside a block)
    if (
      statement.elseStatement &&
      ts.isThrowStatement(statement.elseStatement)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        statement.elseStatement.getStart(sourceFile)
      );
      return {
        line: line + 1,
        message:
          'throw statements are not allowed directly in handle method. Move error handling into another step.',
      };
    }
  }

  return null;
}

/**
 * Lint rule that prevents direct bubble instantiation in the handle method
 */
export const noDirectBubbleInstantiationInHandleRule: LintRule = {
  name: 'no-direct-bubble-instantiation-in-handle',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Use pre-parsed context
    if (!context.handleMethodBody) {
      return errors; // No handle method body found, skip this rule
    }

    // Check only direct statements in the method body (not nested)
    for (const statement of context.handleMethodBody.statements) {
      const bubbleError = checkStatementForBubbleInstantiation(
        statement,
        context.sourceFile,
        context.importedBubbleClasses
      );
      if (bubbleError) {
        errors.push(bubbleError);
      }
    }

    return errors;
  },
};

/**
 * Checks if a statement contains a direct bubble instantiation
 * Only checks direct statements, not nested blocks
 */
function checkStatementForBubbleInstantiation(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
  importedBubbleClasses: Set<string>
): LintError | null {
  // Check for variable declaration with bubble instantiation
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer) {
        const error = checkExpressionForBubbleInstantiation(
          declaration.initializer,
          sourceFile,
          importedBubbleClasses
        );
        if (error) {
          return error;
        }
      }
    }
  }

  // Check for expression statement with bubble instantiation
  if (ts.isExpressionStatement(statement)) {
    const error = checkExpressionForBubbleInstantiation(
      statement.expression,
      sourceFile,
      importedBubbleClasses
    );
    if (error) {
      return error;
    }
  }

  // Check for if statement with direct bubble instantiation in then/else
  if (ts.isIfStatement(statement)) {
    // Check if the then branch is a direct bubble instantiation (not inside a block)
    if (!ts.isBlock(statement.thenStatement)) {
      // If it's an expression statement, check the expression
      if (ts.isExpressionStatement(statement.thenStatement)) {
        const error = checkExpressionForBubbleInstantiation(
          statement.thenStatement.expression,
          sourceFile,
          importedBubbleClasses
        );
        if (error) {
          return error;
        }
      }
    }

    // Check if the else branch is a direct bubble instantiation (not inside a block)
    if (statement.elseStatement && !ts.isBlock(statement.elseStatement)) {
      // If it's an expression statement, check the expression
      if (ts.isExpressionStatement(statement.elseStatement)) {
        const error = checkExpressionForBubbleInstantiation(
          statement.elseStatement.expression,
          sourceFile,
          importedBubbleClasses
        );
        if (error) {
          return error;
        }
      }
    }
  }

  return null;
}

/**
 * Checks if an expression is a bubble instantiation (new BubbleClass(...))
 */
function checkExpressionForBubbleInstantiation(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  importedBubbleClasses: Set<string>
): LintError | null {
  // Handle await expressions
  if (ts.isAwaitExpression(expression)) {
    return checkExpressionForBubbleInstantiation(
      expression.expression,
      sourceFile,
      importedBubbleClasses
    );
  }

  // Handle call expressions (e.g., new Bubble().action())
  if (ts.isCallExpression(expression)) {
    if (ts.isPropertyAccessExpression(expression.expression)) {
      return checkExpressionForBubbleInstantiation(
        expression.expression.expression,
        sourceFile,
        importedBubbleClasses
      );
    }
  }

  // Check for new expression
  if (ts.isNewExpression(expression)) {
    const className = getClassNameFromExpression(expression.expression);
    if (className && isBubbleClass(className, importedBubbleClasses)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        expression.getStart(sourceFile)
      );
      return {
        line: line + 1,
        message:
          'Direct bubble instantiation is not allowed in handle method. Move bubble creation into another step.',
      };
    }
  }

  return null;
}

/**
 * Gets the class name from an expression (handles identifiers and property access)
 */
function getClassNameFromExpression(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

/**
 * Checks if a class name represents a bubble class
 */
function isBubbleClass(
  className: string,
  importedBubbleClasses: Set<string>
): boolean {
  // Check if it's in the imported bubble classes
  if (importedBubbleClasses.has(className)) {
    return true;
  }

  // Fallback: check naming pattern
  // Bubble classes typically end with "Bubble" or "Tool" (but not StructuredTool)
  const endsWithBubble = className.endsWith('Bubble');
  const endsWithTool =
    className.endsWith('Tool') && !className.includes('Structured');

  return (
    (endsWithBubble || endsWithTool) &&
    className !== 'BubbleFlow' &&
    className !== 'BaseBubble' &&
    !className.includes('Error') &&
    !className.includes('Exception') &&
    !className.includes('Validation')
  );
}

/**
 * Default registry instance with all rules registered
 */
export const defaultLintRuleRegistry = new LintRuleRegistry();
defaultLintRuleRegistry.register(noThrowInHandleRule);
defaultLintRuleRegistry.register(noDirectBubbleInstantiationInHandleRule);
