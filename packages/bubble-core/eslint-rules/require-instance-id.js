/**
 * ESLint rule: require-bubble-instance-id
 *
 * Enforces that when a file has multiple instantiations of the same Bubble class,
 * all instances must provide an instanceId as the third parameter.
 *
 * This prevents ambiguity in dependency graphs and ensures predictable unique IDs.
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require instanceId when multiple instances of the same Bubble class are created',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingInstanceId:
        'Multiple instances of "{{ className }}" detected in this file. All instances must provide an instanceId as the third parameter.',
      inconsistentInstanceId:
        'All instances of "{{ className }}" must either have instanceId or not. Found mixed usage.',
    },
    schema: [],
  },

  create(context) {
    // Track bubble instantiations per file
    // Map: className -> Array of { node, hasInstanceId }
    const bubbleInstances = new Map();

    // Get TypeScript services if available
    const services = context.parserServices;
    const checker = services?.program?.getTypeChecker();

    return {
      NewExpression(node) {
        const className = node.callee.name;
        if (!className) {
          return;
        }

        let isBubbleClass = false;

        // Try type-based checking first (if TypeScript info available)
        if (checker && services?.esTreeNodeToTSNodeMap) {
          try {
            const tsNode = services.esTreeNodeToTSNodeMap.get(node.callee);
            const type = checker.getTypeAtLocation(tsNode);
            const symbol = type.getSymbol();

            if (symbol) {
              // Check if this class extends BaseBubble
              const declarations = symbol.getDeclarations();
              if (declarations && declarations.length > 0) {
                const classDecl = declarations[0];
                if (classDecl.kind === 263) {
                  // ClassDeclaration
                  const heritage = classDecl.heritageClauses;
                  if (heritage) {
                    for (const clause of heritage) {
                      for (const typeNode of clause.types) {
                        const baseType = checker.getTypeAtLocation(
                          typeNode.expression
                        );
                        const baseSymbol = baseType.getSymbol();
                        const baseName = baseSymbol?.getName();

                        // Check if extends BaseBubble or its subclasses
                        if (
                          baseName === 'BaseBubble' ||
                          baseName === 'ServiceBubble' ||
                          baseName === 'ToolBubble' ||
                          baseName === 'WorkflowBubble'
                        ) {
                          isBubbleClass = true;
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Fall back to name-based checking
          }
        }

        // Fallback: name-based checking
        if (!isBubbleClass) {
          isBubbleClass =
            (className.endsWith('Bubble') || className.endsWith('Tool')) &&
            !className.includes('Error') &&
            !className.includes('Exception') &&
            !className.includes('Validation');
        }

        if (!isBubbleClass) {
          return;
        }

        // Check if third argument (instanceId) is provided and not undefined
        const hasInstanceId =
          node.arguments.length >= 3 &&
          node.arguments[2] &&
          !(
            node.arguments[2].type === 'Identifier' &&
            node.arguments[2].name === 'undefined'
          );

        // Track this instance
        if (!bubbleInstances.has(className)) {
          bubbleInstances.set(className, []);
        }
        bubbleInstances.get(className).push({ node, hasInstanceId });
      },

      'Program:exit'() {
        // Check each class that has multiple instances
        for (const [className, instances] of bubbleInstances.entries()) {
          if (instances.length <= 1) {
            continue; // Only one instance, no need for instanceId
          }

          // Check if any instance is missing instanceId
          const withInstanceId = instances.filter((i) => i.hasInstanceId);
          const withoutInstanceId = instances.filter((i) => !i.hasInstanceId);

          if (withoutInstanceId.length > 0) {
            // Report all instances without instanceId
            for (const { node } of withoutInstanceId) {
              context.report({
                node,
                messageId: 'missingInstanceId',
                data: { className },
              });
            }
          }
        }
      },
    };
  },
};
