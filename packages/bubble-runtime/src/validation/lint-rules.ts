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
  /** The trigger type extracted from BubbleFlow<'trigger-type'> generic parameter */
  bubbleFlowTriggerType: string | null;
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
  let bubbleFlowTriggerType: string | null = null;
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

                  // Extract trigger type from BubbleFlow<'trigger-type'> generic parameter
                  if (type.typeArguments && type.typeArguments.length > 0) {
                    const firstArg = type.typeArguments[0];
                    if (
                      ts.isLiteralTypeNode(firstArg) &&
                      ts.isStringLiteral(firstArg.literal)
                    ) {
                      bubbleFlowTriggerType = firstArg.literal.text;
                    }
                  }

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
    bubbleFlowTriggerType,
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

    // Recursively check all statements in the method body, including nested blocks
    for (const statement of context.handleMethodBody.statements) {
      const bubbleErrors = checkStatementForBubbleInstantiation(
        statement,
        context.sourceFile,
        context.importedBubbleClasses
      );
      errors.push(...bubbleErrors);
    }

    return errors;
  },
};

/**
 * Checks if a statement contains a direct bubble instantiation
 * Recursively checks nested blocks to find all bubble instantiations
 */
function checkStatementForBubbleInstantiation(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
  importedBubbleClasses: Set<string>
): LintError[] {
  const errors: LintError[] = [];

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
          errors.push(error);
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
      errors.push(error);
    }
  }

  // Check for if statement - recursively check then/else branches
  if (ts.isIfStatement(statement)) {
    // Check the then branch
    if (ts.isBlock(statement.thenStatement)) {
      // Recursively check all statements inside the block
      for (const nestedStatement of statement.thenStatement.statements) {
        const nestedErrors = checkStatementForBubbleInstantiation(
          nestedStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    } else {
      // Single statement (not a block) - check it directly
      const nestedErrors = checkStatementForBubbleInstantiation(
        statement.thenStatement,
        sourceFile,
        importedBubbleClasses
      );
      errors.push(...nestedErrors);
    }

    // Check the else branch if it exists
    if (statement.elseStatement) {
      if (ts.isBlock(statement.elseStatement)) {
        // Recursively check all statements inside the block
        for (const nestedStatement of statement.elseStatement.statements) {
          const nestedErrors = checkStatementForBubbleInstantiation(
            nestedStatement,
            sourceFile,
            importedBubbleClasses
          );
          errors.push(...nestedErrors);
        }
      } else {
        // Single statement (not a block) - check it directly
        const nestedErrors = checkStatementForBubbleInstantiation(
          statement.elseStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    }
  }

  // Check for other block statements (for, while, etc.)
  if (
    ts.isForStatement(statement) ||
    ts.isWhileStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement)
  ) {
    const block = statement.statement;
    if (ts.isBlock(block)) {
      for (const nestedStatement of block.statements) {
        const nestedErrors = checkStatementForBubbleInstantiation(
          nestedStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    } else {
      // Single statement (not a block) - check it directly
      const nestedErrors = checkStatementForBubbleInstantiation(
        block,
        sourceFile,
        importedBubbleClasses
      );
      errors.push(...nestedErrors);
    }
  }

  // Check for try-catch-finally statements
  if (ts.isTryStatement(statement)) {
    // Check try block
    if (ts.isBlock(statement.tryBlock)) {
      for (const nestedStatement of statement.tryBlock.statements) {
        const nestedErrors = checkStatementForBubbleInstantiation(
          nestedStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    }
    // Check catch clause
    if (statement.catchClause && statement.catchClause.block) {
      for (const nestedStatement of statement.catchClause.block.statements) {
        const nestedErrors = checkStatementForBubbleInstantiation(
          nestedStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    }
    // Check finally block
    if (statement.finallyBlock && ts.isBlock(statement.finallyBlock)) {
      for (const nestedStatement of statement.finallyBlock.statements) {
        const nestedErrors = checkStatementForBubbleInstantiation(
          nestedStatement,
          sourceFile,
          importedBubbleClasses
        );
        errors.push(...nestedErrors);
      }
    }
  }

  return errors;
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
 * Lint rule that prevents credentials parameter from being used in bubble instantiations
 */
export const noCredentialsParameterRule: LintRule = {
  name: 'no-credentials-parameter',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Traverse entire source file to find all bubble instantiations
    const visit = (node: ts.Node) => {
      // Check for new expressions (bubble instantiations)
      if (ts.isNewExpression(node)) {
        const className = getClassNameFromExpression(node.expression);
        if (
          className &&
          isBubbleClass(className, context.importedBubbleClasses)
        ) {
          // Check constructor arguments for credentials parameter
          if (node.arguments && node.arguments.length > 0) {
            for (const arg of node.arguments) {
              const credentialError = checkForCredentialsParameter(
                arg,
                context.sourceFile
              );
              if (credentialError) {
                errors.push(credentialError);
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);
    return errors;
  },
};

/**
 * Checks if an expression (constructor argument) contains a credentials parameter
 */
function checkForCredentialsParameter(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): LintError | null {
  // Handle object literals: { credentials: {...} }
  if (ts.isObjectLiteralExpression(expression)) {
    for (const property of expression.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = property.name;
        if (
          (ts.isIdentifier(name) && name.text === 'credentials') ||
          (ts.isStringLiteral(name) && name.text === 'credentials')
        ) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            property.getStart(sourceFile)
          );
          return {
            line: line + 1,
            message:
              'credentials parameter is not allowed in bubble instantiation. Credentials should be injected at runtime, not passed as parameters.',
          };
        }
      }
      // Handle shorthand property: { credentials }
      if (ts.isShorthandPropertyAssignment(property)) {
        const name = property.name;
        if (ts.isIdentifier(name) && name.text === 'credentials') {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            property.getStart(sourceFile)
          );
          return {
            line: line + 1,
            message:
              'credentials parameter is not allowed in bubble instantiation. Credentials should be injected at runtime, not passed as parameters.',
          };
        }
      }
    }
  }

  // Handle spread expressions that might contain credentials
  if (ts.isSpreadElement(expression)) {
    return checkForCredentialsParameter(expression.expression, sourceFile);
  }

  // Handle type assertions: { credentials: {...} } as Record<string, string>
  if (ts.isAsExpression(expression)) {
    return checkForCredentialsParameter(expression.expression, sourceFile);
  }

  // Handle parenthesized expressions: ({ credentials: {...} })
  if (ts.isParenthesizedExpression(expression)) {
    return checkForCredentialsParameter(expression.expression, sourceFile);
  }

  return null;
}

/**
 * Lint rule that prevents usage of process.env
 */
export const noProcessEnvRule: LintRule = {
  name: 'no-process-env',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Traverse entire source file to find all process.env usages
    const visit = (node: ts.Node) => {
      // Check for property access expression: process.env
      if (ts.isPropertyAccessExpression(node)) {
        const object = node.expression;
        const property = node.name;

        // Check if it's process.env
        if (
          ts.isIdentifier(object) &&
          object.text === 'process' &&
          ts.isIdentifier(property) &&
          property.text === 'env'
        ) {
          const { line, character } =
            context.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(context.sourceFile)
            );
          errors.push({
            line: line + 1,
            column: character + 1,
            message:
              'process.env is not allowed. Put the credential inside payload if the integration is not supported yet (service is not an available bubble).',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);
    return errors;
  },
};

/**
 * Lint rule that prevents method invocations inside complex expressions
 */
export const noMethodInvocationInComplexExpressionRule: LintRule = {
  name: 'no-method-invocation-in-complex-expression',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Track parent nodes to detect complex expressions
    const visitWithParents = (node: ts.Node, parents: ts.Node[] = []): void => {
      // Check for method calls: this.methodName()
      if (ts.isCallExpression(node)) {
        if (ts.isPropertyAccessExpression(node.expression)) {
          const object = node.expression.expression;
          // Check if it's 'this' keyword (SyntaxKind.ThisKeyword)
          if (object.kind === ts.SyntaxKind.ThisKeyword) {
            // This is a method invocation: this.methodName()
            // Check if any parent is a complex expression
            const complexParent = findComplexExpressionParent(parents, node);
            if (complexParent) {
              const { line, character } =
                context.sourceFile.getLineAndCharacterOfPosition(
                  node.getStart(context.sourceFile)
                );
              const methodName = node.expression.name.text;
              const parentType = getReadableParentType(complexParent);
              errors.push({
                line: line + 1,
                column: character + 1,
                message: `Method invocation 'this.${methodName}()' inside ${parentType} cannot be instrumented. Extract to a separate variable before using in ${parentType}.`,
              });
            }
          }
        }
      }

      // Recursively visit children with updated parent chain
      ts.forEachChild(node, (child) => {
        visitWithParents(child, [...parents, node]);
      });
    };

    visitWithParents(context.sourceFile);
    return errors;
  },
};

/**
 * Finds if any parent node is a complex expression that cannot contain instrumented calls
 */
function findComplexExpressionParent(
  parents: ts.Node[],
  node: ts.Node
): ts.Node | null {
  // Walk through parents to find complex expressions
  // Stop at statement boundaries (these are safe)
  let currentChild: ts.Node | null = node;
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];

    // Stop at statement boundaries - these are safe contexts
    if (
      ts.isVariableDeclaration(parent) ||
      ts.isExpressionStatement(parent) ||
      ts.isReturnStatement(parent) ||
      ts.isBlock(parent)
    ) {
      return null;
    }

    // Check for complex expressions
    if (ts.isConditionalExpression(parent)) {
      return parent; // Ternary operator
    }
    if (ts.isObjectLiteralExpression(parent)) {
      return parent; // Object literal
    }
    if (ts.isArrayLiteralExpression(parent)) {
      if (
        currentChild &&
        isPromiseAllArrayElement(parent, currentChild as ts.Expression)
      ) {
        currentChild = parent;
        continue;
      }
      return parent; // Array literal
    }
    if (ts.isPropertyAssignment(parent)) {
      return parent; // Object property value
    }
    if (ts.isSpreadElement(parent)) {
      return parent; // Spread expression
    }

    currentChild = parent;
  }

  return null;
}

/**
 * Gets a human-readable description of the parent node type
 */
function getReadableParentType(node: ts.Node): string {
  if (ts.isConditionalExpression(node)) {
    return 'ternary operator';
  }
  if (ts.isObjectLiteralExpression(node)) {
    return 'object literal';
  }
  if (ts.isArrayLiteralExpression(node)) {
    return 'array literal';
  }
  if (ts.isPropertyAssignment(node)) {
    return 'object property';
  }
  if (ts.isSpreadElement(node)) {
    return 'spread expression';
  }
  return 'complex expression';
}

function isPromiseAllArrayElement(
  arrayNode: ts.ArrayLiteralExpression,
  childNode: ts.Expression
): boolean {
  if (!arrayNode.elements.some((element) => element === childNode)) {
    return false;
  }

  if (!arrayNode.parent || !ts.isCallExpression(arrayNode.parent)) {
    return false;
  }

  const callExpr = arrayNode.parent;
  const callee = callExpr.expression;

  if (
    !ts.isPropertyAccessExpression(callee) ||
    !ts.isIdentifier(callee.expression) ||
    callee.expression.text !== 'Promise' ||
    callee.name.text !== 'all'
  ) {
    return false;
  }

  return callExpr.arguments.length > 0 && callExpr.arguments[0] === arrayNode;
}

/**
 * Lint rule that prevents try-catch statements in the handle method
 * Try-catch blocks interfere with runtime instrumentation and error handling
 */
export const noTryCatchInHandleRule: LintRule = {
  name: 'no-try-catch-in-handle',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    if (!context.handleMethodBody) {
      return errors; // No handle method body found, skip this rule
    }

    // Recursively find all try statements in the handle method body
    const findTryStatements = (node: ts.Node): void => {
      if (ts.isTryStatement(node)) {
        const { line } = context.sourceFile.getLineAndCharacterOfPosition(
          node.getStart(context.sourceFile)
        );
        errors.push({
          line: line + 1,
          message:
            'try-catch statements are not allowed in handle method. Error handling should be done in function steps.',
        });
        // Don't return early - continue checking nested content for multiple violations
      }

      ts.forEachChild(node, findTryStatements);
    };

    // Start recursive search from the handle method body
    findTryStatements(context.handleMethodBody);

    return errors;
  },
};

/**
 * Lint rule that prevents methods from calling other methods
 * Methods should only be called from the handle method, not from other methods
 */
export const noMethodCallingMethodRule: LintRule = {
  name: 'no-method-calling-method',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    if (!context.bubbleFlowClass) {
      return errors; // No BubbleFlow class found, skip this rule
    }

    // Find all methods in the BubbleFlow class
    const methods: ts.MethodDeclaration[] = [];
    if (context.bubbleFlowClass.members) {
      for (const member of context.bubbleFlowClass.members) {
        if (ts.isMethodDeclaration(member)) {
          // Skip the handle method - it's allowed to call other methods
          const methodName = member.name;
          if (ts.isIdentifier(methodName) && methodName.text === 'handle') {
            continue;
          }
          methods.push(member);
        }
      }
    }

    // For each method, check if it calls other methods
    for (const method of methods) {
      if (!method.body || !ts.isBlock(method.body)) {
        continue;
      }

      const methodCallErrors = findMethodCallsInNode(
        method.body,
        context.sourceFile
      );
      errors.push(...methodCallErrors);
    }

    return errors;
  },
};

/**
 * Recursively finds all method calls (this.methodName()) in a node
 */
function findMethodCallsInNode(
  node: ts.Node,
  sourceFile: ts.SourceFile
): LintError[] {
  const errors: LintError[] = [];

  const visit = (n: ts.Node) => {
    // Check for call expressions: this.methodName()
    if (ts.isCallExpression(n)) {
      if (ts.isPropertyAccessExpression(n.expression)) {
        const object = n.expression.expression;
        // Check if it's 'this' keyword (SyntaxKind.ThisKeyword)
        if (object.kind === ts.SyntaxKind.ThisKeyword) {
          const methodName = n.expression.name.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            n.getStart(sourceFile)
          );
          errors.push({
            line: line + 1,
            column: character + 1,
            message: `Method 'this.${methodName}()' cannot be called from another method. Methods should only be called from the handle method.`,
          });
        }
      }
    }

    ts.forEachChild(n, visit);
  };

  visit(node);
  return errors;
}

/**
 * Lint rule that prevents usage of 'any' type
 * Using 'any' bypasses TypeScript's type checking and should be avoided
 */
export const noAnyTypeRule: LintRule = {
  name: 'no-any-type',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    const visit = (node: ts.Node) => {
      // Check for 'any' keyword in type nodes
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const { line, character } =
          context.sourceFile.getLineAndCharacterOfPosition(
            node.getStart(context.sourceFile)
          );
        errors.push({
          line: line + 1,
          column: character + 1,
          message:
            "Type 'any' is not allowed. Use a specific type, 'unknown', or a generic type parameter instead.",
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);
    return errors;
  },
};

/**
 * Lint rule that prevents multiple BubbleFlow classes in a single file
 * Only one class extending BubbleFlow is allowed per file for proper runtime instrumentation
 */
export const singleBubbleFlowClassRule: LintRule = {
  name: 'single-bubbleflow-class',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];
    const bubbleFlowClasses: { name: string; line: number }[] = [];

    // Traverse the entire source file to find all BubbleFlow class declarations
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const type of clause.types) {
                if (ts.isIdentifier(type.expression)) {
                  if (type.expression.text === 'BubbleFlow') {
                    const { line } =
                      context.sourceFile.getLineAndCharacterOfPosition(
                        node.getStart(context.sourceFile)
                      );
                    const className = node.name?.text || 'Anonymous';
                    bubbleFlowClasses.push({ name: className, line: line + 1 });
                  }
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);

    // If more than one BubbleFlow class found, report errors for all except the first
    if (bubbleFlowClasses.length > 1) {
      for (let i = 1; i < bubbleFlowClasses.length; i++) {
        const cls = bubbleFlowClasses[i];
        errors.push({
          line: cls.line,
          message: `Multiple BubbleFlow classes are not allowed. Found '${cls.name}' but '${bubbleFlowClasses[0].name}' already extends BubbleFlow. Remove the additional class or combine the flows into a single class.`,
        });
      }
    }

    return errors;
  },
};

/**
 * Mapping of trigger types to their expected payload type names
 * Used by the enforce-payload-type lint rule
 */
const TRIGGER_PAYLOAD_TYPE_MAP: Record<string, string> = {
  'slack/bot_mentioned': 'SlackMentionEvent',
  'slack/message_received': 'SlackMessageReceivedEvent',
  'schedule/cron': 'CronEvent',
  'webhook/http': 'WebhookEvent',
};

/**
 * Set of all base trigger event type names.
 * Used to detect when a user uses the wrong base type (e.g., CronEvent for a Slack trigger).
 */
const BASE_TRIGGER_EVENT_TYPES = new Set(
  Object.values(TRIGGER_PAYLOAD_TYPE_MAP)
);

/**
 * Lint rule that enforces proper payload typing for BubbleFlow<TriggerType>
 *
 * When a class extends BubbleFlow<'slack/bot_mentioned'>, the handle() method's
 * payload parameter must be typed with the correct event type (e.g., SlackMentionEvent)
 * from BubbleTriggerEventRegistry, not 'any' or an incompatible type.
 *
 * This is a blocking error - mismatched types will prevent the flow from being saved.
 */
export const enforcePayloadTypeRule: LintRule = {
  name: 'enforce-payload-type',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Skip if no BubbleFlow class or handle method found
    if (!context.bubbleFlowClass || !context.handleMethod) {
      return errors;
    }

    // Skip if no trigger type extracted
    if (!context.bubbleFlowTriggerType) {
      return errors;
    }

    // Get the expected payload type for this trigger
    const expectedTypeName =
      TRIGGER_PAYLOAD_TYPE_MAP[context.bubbleFlowTriggerType];
    if (!expectedTypeName) {
      // Unknown trigger type, skip validation
      return errors;
    }

    // Check the handle method's first parameter
    const parameters = context.handleMethod.parameters;
    if (parameters.length === 0) {
      const { line } = context.sourceFile.getLineAndCharacterOfPosition(
        context.handleMethod.getStart(context.sourceFile)
      );
      errors.push({
        line: line + 1,
        message: `handle() method must have a payload parameter typed as '${expectedTypeName}' for trigger type '${context.bubbleFlowTriggerType}'.`,
      });
      return errors;
    }

    const firstParam = parameters[0];
    const typeAnnotation = firstParam.type;

    // Check if parameter has no type annotation
    if (!typeAnnotation) {
      const { line } = context.sourceFile.getLineAndCharacterOfPosition(
        firstParam.getStart(context.sourceFile)
      );
      errors.push({
        line: line + 1,
        message: `Payload parameter must be typed as '${expectedTypeName}' for trigger type '${context.bubbleFlowTriggerType}'. Add explicit type annotation.`,
      });
      return errors;
    }

    // Check for 'any' type
    if (typeAnnotation.kind === ts.SyntaxKind.AnyKeyword) {
      const { line } = context.sourceFile.getLineAndCharacterOfPosition(
        typeAnnotation.getStart(context.sourceFile)
      );
      errors.push({
        line: line + 1,
        message: `Payload type 'any' is not allowed. Use '${expectedTypeName}' for trigger type '${context.bubbleFlowTriggerType}'.`,
      });
      return errors;
    }

    // Check if the type is a reference type and matches expected
    if (ts.isTypeReferenceNode(typeAnnotation)) {
      const typeName = typeAnnotation.typeName;
      let actualTypeName: string | null = null;

      if (ts.isIdentifier(typeName)) {
        actualTypeName = typeName.text;
      } else if (ts.isQualifiedName(typeName)) {
        // Handle qualified names like Namespace.Type
        actualTypeName = typeName.right.text;
      }

      if (actualTypeName && actualTypeName !== expectedTypeName) {
        // Allow custom interfaces that extend the base trigger event.
        // We only error if the type is a DIFFERENT base trigger event type.
        // e.g., using CronEvent for a Slack trigger is an error,
        // but using MyCustomSlackPayload (which extends SlackMentionEvent) is allowed.
        if (BASE_TRIGGER_EVENT_TYPES.has(actualTypeName)) {
          // Using a different base trigger event type - this is an error
          const { line } = context.sourceFile.getLineAndCharacterOfPosition(
            typeAnnotation.getStart(context.sourceFile)
          );
          errors.push({
            line: line + 1,
            message: `Payload type mismatch: expected '${expectedTypeName}' (or a custom interface extending it) for trigger type '${context.bubbleFlowTriggerType}', but found '${actualTypeName}'.`,
          });
        }
        // Otherwise, it's a custom interface - allow it (parser will handle extraction)
      }
    }

    // Check for indexed access type: BubbleTriggerEventRegistry['slack/bot_mentioned']
    if (ts.isIndexedAccessTypeNode(typeAnnotation)) {
      const objectType = typeAnnotation.objectType;
      const indexType = typeAnnotation.indexType;

      // Verify it's BubbleTriggerEventRegistry
      if (
        ts.isTypeReferenceNode(objectType) &&
        ts.isIdentifier(objectType.typeName) &&
        objectType.typeName.text === 'BubbleTriggerEventRegistry'
      ) {
        // Verify the index matches the trigger type
        if (
          ts.isLiteralTypeNode(indexType) &&
          ts.isStringLiteral(indexType.literal)
        ) {
          const indexValue = indexType.literal.text;
          if (indexValue !== context.bubbleFlowTriggerType) {
            const { line } = context.sourceFile.getLineAndCharacterOfPosition(
              typeAnnotation.getStart(context.sourceFile)
            );
            errors.push({
              line: line + 1,
              message: `Payload type mismatch: indexed access uses '${indexValue}' but BubbleFlow extends '${context.bubbleFlowTriggerType}'.`,
            });
          }
        }
      }
    }

    return errors;
  },
};

/**
 * Lint rule that bans casting the payload parameter to a different type inside handle().
 *
 * This pattern defeats the type system and prevents the parser from extracting custom fields:
 *
 * BAD:
 * ```typescript
 * interface MyPayload extends SlackMentionEvent { customField: string; }
 * async handle(payload: SlackMentionEvent) {
 *   const { customField } = payload as MyPayload; // Cast inside - BAD!
 * }
 * ```
 *
 * GOOD:
 * ```typescript
 * interface MyPayload extends SlackMentionEvent { customField: string; }
 * async handle(payload: MyPayload) { // Use custom type directly
 *   const { customField } = payload; // No cast needed
 * }
 * ```
 */
export const noCastPayloadInHandleRule: LintRule = {
  name: 'no-cast-payload-in-handle',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    // Skip if no handle method or body
    if (!context.handleMethod || !context.handleMethodBody) {
      return errors;
    }

    // Get the payload parameter name
    const parameters = context.handleMethod.parameters;
    if (parameters.length === 0) {
      return errors;
    }

    const firstParam = parameters[0];
    let payloadParamName: string | null = null;

    if (ts.isIdentifier(firstParam.name)) {
      payloadParamName = firstParam.name.text;
    }

    if (!payloadParamName) {
      return errors;
    }

    // Get the declared type of the payload parameter
    const paramType = firstParam.type;
    let declaredTypeName: string | null = null;

    if (paramType && ts.isTypeReferenceNode(paramType)) {
      if (ts.isIdentifier(paramType.typeName)) {
        declaredTypeName = paramType.typeName.text;
      }
    }

    // Walk the handle method body looking for 'as' expressions on the payload
    const findPayloadCasts = (node: ts.Node): void => {
      // Check for type assertion: payload as SomeType
      if (ts.isAsExpression(node)) {
        const expression = node.expression;
        const targetType = node.type;

        // Check if the expression is the payload parameter
        if (
          ts.isIdentifier(expression) &&
          expression.text === payloadParamName
        ) {
          // Get the target type name
          let targetTypeName: string | null = null;
          if (ts.isTypeReferenceNode(targetType)) {
            if (ts.isIdentifier(targetType.typeName)) {
              targetTypeName = targetType.typeName.text;
            }
          }

          // If casting to a different type than declared, report error
          if (targetTypeName && targetTypeName !== declaredTypeName) {
            const { line, character } =
              context.sourceFile.getLineAndCharacterOfPosition(
                node.getStart(context.sourceFile)
              );
            errors.push({
              line: line + 1,
              column: character + 1,
              message: `Do not cast payload to '${targetTypeName}' inside handle(). Instead, use '${targetTypeName}' as the parameter type directly: handle(payload: ${targetTypeName}). This allows the parser to extract custom fields from your payload interface.`,
            });
          }
        }
      }

      ts.forEachChild(node, findPayloadCasts);
    };

    findPayloadCasts(context.handleMethodBody);

    return errors;
  },
};

/**
 * Lint rule that prevents calling .toString() on Zod schemas for expectedOutputSchema.
 *
 * Calling .toString() on a Zod schema returns a useless string like "ZodObject"
 * instead of the actual JSON schema. This causes the AI to not follow the expected
 * output structure.
 *
 * BAD:
 * ```typescript
 * expectedOutputSchema: z.object({ companies: z.array(...) }).toString()
 * ```
 *
 * GOOD:
 * ```typescript
 * expectedOutputSchema: z.object({ companies: z.array(...) })
 * ```
 */
export const noToStringOnExpectedOutputSchemaRule: LintRule = {
  name: 'no-tostring-on-expected-output-schema',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    const visit = (node: ts.Node): void => {
      // Look for property assignments: expectedOutputSchema: <value>
      if (ts.isPropertyAssignment(node)) {
        const propName = node.name;
        let isExpectedOutputSchema = false;

        if (
          ts.isIdentifier(propName) &&
          propName.text === 'expectedOutputSchema'
        ) {
          isExpectedOutputSchema = true;
        } else if (
          ts.isStringLiteral(propName) &&
          propName.text === 'expectedOutputSchema'
        ) {
          isExpectedOutputSchema = true;
        }

        if (isExpectedOutputSchema) {
          // Check if the value is a call expression ending with .toString()
          const value = node.initializer;
          if (ts.isCallExpression(value)) {
            const callee = value.expression;
            if (
              ts.isPropertyAccessExpression(callee) &&
              callee.name.text === 'toString'
            ) {
              const { line, character } =
                context.sourceFile.getLineAndCharacterOfPosition(
                  value.getStart(context.sourceFile)
                );
              errors.push({
                line: line + 1,
                column: character + 1,
                message:
                  'Do not call .toString() on Zod schemas for expectedOutputSchema. Pass the Zod schema directly: expectedOutputSchema: z.object({ ... })',
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);
    return errors;
  },
};

/**
 * Lint rule that prevents calling JSON.stringify() on Zod schemas for expectedOutputSchema.
 *
 * JSON.stringify() on a Zod schema returns unusable JSON representation of the schema object
 * instead of the actual JSON schema format needed for AI structured output.
 *
 * BAD:
 * ```typescript
 * expectedOutputSchema: JSON.stringify(z.object({ ... }))
 * ```
 *
 * GOOD:
 * ```typescript
 * expectedOutputSchema: z.object({ ... })
 * ```
 */
export const noJsonStringifyOnExpectedOutputSchemaRule: LintRule = {
  name: 'no-json-stringify-on-expected-output-schema',
  validate(context: LintRuleContext): LintError[] {
    const errors: LintError[] = [];

    const visit = (node: ts.Node): void => {
      // Look for property assignments: expectedOutputSchema: <value>
      if (ts.isPropertyAssignment(node)) {
        const propName = node.name;
        let isExpectedOutputSchema = false;

        if (
          ts.isIdentifier(propName) &&
          propName.text === 'expectedOutputSchema'
        ) {
          isExpectedOutputSchema = true;
        } else if (
          ts.isStringLiteral(propName) &&
          propName.text === 'expectedOutputSchema'
        ) {
          isExpectedOutputSchema = true;
        }

        if (isExpectedOutputSchema) {
          // Check if the value is JSON.stringify(...)
          const value = node.initializer;
          if (ts.isCallExpression(value)) {
            const callee = value.expression;
            if (
              ts.isPropertyAccessExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              callee.expression.text === 'JSON' &&
              callee.name.text === 'stringify'
            ) {
              const { line, character } =
                context.sourceFile.getLineAndCharacterOfPosition(
                  value.getStart(context.sourceFile)
                );
              errors.push({
                line: line + 1,
                column: character + 1,
                message:
                  'Do not call JSON.stringify() on Zod schemas for expectedOutputSchema. Pass the Zod schema directly: expectedOutputSchema: z.object({ ... })',
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(context.sourceFile);
    return errors;
  },
};

/**
 * Default registry instance with all rules registered
 */
export const defaultLintRuleRegistry = new LintRuleRegistry();
defaultLintRuleRegistry.register(noThrowInHandleRule);
defaultLintRuleRegistry.register(noDirectBubbleInstantiationInHandleRule);
defaultLintRuleRegistry.register(noCredentialsParameterRule);
defaultLintRuleRegistry.register(noMethodInvocationInComplexExpressionRule);
defaultLintRuleRegistry.register(noProcessEnvRule);
defaultLintRuleRegistry.register(noMethodCallingMethodRule);
defaultLintRuleRegistry.register(noTryCatchInHandleRule);
defaultLintRuleRegistry.register(noAnyTypeRule);
defaultLintRuleRegistry.register(singleBubbleFlowClassRule);
defaultLintRuleRegistry.register(enforcePayloadTypeRule);
defaultLintRuleRegistry.register(noCastPayloadInHandleRule);
defaultLintRuleRegistry.register(noToStringOnExpectedOutputSchemaRule);
defaultLintRuleRegistry.register(noJsonStringifyOnExpectedOutputSchemaRule);
