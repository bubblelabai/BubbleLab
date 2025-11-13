/**
 * ESLint rule to ensure context field is not null in BaseBubble classes
 * This rule checks that when accessing this.context, it's not null or undefined
 * and that when creating new bubbles, context is passed as the second argument
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure context field is not null when accessing it in BaseBubble classes and that context is passed when creating new bubbles',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      nullContextAccess:
        'Context field should not be null when accessing {{property}}. Consider adding null check or ensuring context is properly initialized.',
      nullContextAssignment:
        'Context field should not be assigned null. Use undefined instead or ensure proper initialization.',
      missingContextArgument:
        'When creating a new bubble, context should be passed as the second argument. Consider passing this.context as the second parameter.',
    },
  },

  create(context) {
    // Track if we're inside a BaseBubble class
    let isInBaseBubbleClass = false;
    let currentClassName = null;

    return {
      // Check class declarations to see if they extend BaseBubble
      ClassDeclaration(node) {
        if (node.superClass) {
          const superClassName = node.superClass.name;
          if (
            superClassName === 'BaseBubble' ||
            superClassName === 'ServiceBubble' ||
            superClassName === 'ToolBubble' ||
            superClassName === 'WorkflowBubble'
          ) {
            isInBaseBubbleClass = true;
            currentClassName = node.id.name;
          }
        }
      },

      // Reset when exiting class
      'ClassDeclaration:exit'(node) {
        if (node.id.name === currentClassName) {
          isInBaseBubbleClass = false;
          currentClassName = null;
        }
      },

      // Check member expressions that access this.context
      MemberExpression(node) {
        if (!isInBaseBubbleClass) return;

        // Helper function to check if an expression involves this.context (directly or through optional chaining)
        const involvesThisContext = (expr) => {
          if (!expr) return false;

          // Direct access: this.context
          if (
            expr.type === 'MemberExpression' &&
            expr.object.type === 'ThisExpression' &&
            expr.property.name === 'context'
          ) {
            return true;
          }

          // Optional chaining: this.context?.property
          if (expr.type === 'ChainExpression') {
            return involvesThisContext(expr.expression);
          }

          // MemberExpression that might chain from this.context
          if (expr.type === 'MemberExpression') {
            return involvesThisContext(expr.object);
          }

          return false;
        };

        // Check for multiple optional chaining: this.context?.logger?.warn
        // In this case, node.object is a ChainExpression
        if (node.object.type === 'ChainExpression') {
          if (involvesThisContext(node.object)) {
            // This is multiple optional chaining involving this.context, so it's safe
            return;
          }
        }

        // Check for this.context access
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'ThisExpression' &&
          node.object.property.name === 'context'
        ) {
          // Check if any ancestor is a ChainExpression (for optional chaining)
          let ancestor = node.parent;
          while (ancestor) {
            if (ancestor.type === 'ChainExpression') {
              // This is part of optional chaining, so it's safe
              return;
            }
            ancestor = ancestor.parent;
          }

          // Check if the parent is a conditional expression or optional chaining
          const parent = node.parent;

          // Allow conditional checks (this.context && this.context.property)
          if (parent.type === 'LogicalExpression' && parent.operator === '&&') {
            return;
          }

          // Allow ternary operators (this.context ? this.context.property : ...)
          if (parent.type === 'ConditionalExpression') {
            return;
          }

          // Allow null checks (this.context != null)
          if (
            parent.type === 'BinaryExpression' &&
            (parent.operator === '!=' || parent.operator === '!==') &&
            parent.right.type === 'Literal' &&
            parent.right.value === null
          ) {
            return;
          }

          // Helper function to check if an expression contains a null check for this.context
          const hasContextNullCheck = (expr) => {
            if (!expr) return false;

            // Check for optional chaining: this.context?.property
            if (expr.type === 'ChainExpression') {
              const expression = expr.expression;
              if (
                expression.type === 'MemberExpression' &&
                expression.object.type === 'MemberExpression' &&
                expression.object.object.type === 'ThisExpression' &&
                expression.object.property.name === 'context'
              ) {
                return true;
              }
            }

            // Check for simple binary expression: this.context !== null
            if (
              expr.type === 'BinaryExpression' &&
              (expr.operator === '!=' || expr.operator === '!==') &&
              expr.right.type === 'Literal' &&
              expr.right.value === null &&
              expr.left.type === 'MemberExpression' &&
              expr.left.object.type === 'ThisExpression' &&
              expr.left.property.name === 'context'
            ) {
              return true;
            }

            // Check for truthy check: this.context (in logical expression)
            if (
              expr.type === 'MemberExpression' &&
              expr.object.type === 'ThisExpression' &&
              expr.property.name === 'context'
            ) {
              return true;
            }

            // Recursively check logical expressions (&&, ||)
            if (expr.type === 'LogicalExpression') {
              return (
                hasContextNullCheck(expr.left) ||
                hasContextNullCheck(expr.right)
              );
            }

            return false;
          };

          // Check if we're inside a block that has a null check for this.context
          let current = node;
          while (current.parent) {
            current = current.parent;

            // If we're inside a BlockStatement, check if it's preceded by a null check
            if (current.type === 'BlockStatement') {
              // Look for if statements with null checks
              const ifStatement = current.parent;
              if (ifStatement && ifStatement.type === 'IfStatement') {
                if (hasContextNullCheck(ifStatement.test)) {
                  return; // We're inside a null check block, so it's safe
                }
              }
              break;
            }
          }

          // Report error for direct access without null check
          context.report({
            node,
            messageId: 'nullContextAccess',
            data: {
              property: node.property.name || 'context',
            },
          });
        }
      },

      // Check assignments to this.context
      AssignmentExpression(node) {
        if (!isInBaseBubbleClass) return;

        // Check for this.context = null assignments
        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'ThisExpression' &&
          node.left.property.name === 'context' &&
          node.right.type === 'Literal' &&
          node.right.value === null
        ) {
          context.report({
            node,
            messageId: 'nullContextAssignment',
          });
        }
      },

      // Check for null comparisons with this.context
      BinaryExpression(node) {
        if (!isInBaseBubbleClass) return;

        // Check for this.context == null or this.context === null
        if (
          (node.operator === '==' || node.operator === '===') &&
          node.right.type === 'Literal' &&
          node.right.value === null
        ) {
          if (
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'ThisExpression' &&
            node.left.property.name === 'context'
          ) {
            // This is actually good - it's a null check, so we don't report it
            return;
          }
        }
      },

      // Check for new expressions that create bubbles
      NewExpression(node) {
        if (!isInBaseBubbleClass) return;

        // Check if this is creating a bubble class
        const callee = node.callee;
        if (callee.type === 'Identifier') {
          const className = callee.name;

          // Check if it's a known bubble class (ends with 'Bubble' or is a known bubble class)
          const isBubbleClass =
            className.endsWith('Bubble') ||
            className === 'AIAgentBubble' ||
            className === 'ServiceBubble' ||
            className === 'ToolBubble' ||
            className === 'WorkflowBubble';

          if (isBubbleClass) {
            // Check if context is passed as second argument
            const args = node.arguments;

            // If there's only one argument (params), context is missing
            if (args.length === 1) {
              context.report({
                node,
                messageId: 'missingContextArgument',
              });
            }
            // If there are two arguments, check if the second one is this.context
            else if (args.length === 2) {
              const secondArg = args[1];
              if (
                secondArg.type === 'MemberExpression' &&
                secondArg.object.type === 'ThisExpression' &&
                secondArg.property.name === 'context'
              ) {
                // This is correct - context is being passed
                return;
              } else {
                // Second argument exists but it's not this.context
                context.report({
                  node,
                  messageId: 'missingContextArgument',
                });
              }
            }
          }
        }
      },
    };
  },
};
