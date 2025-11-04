import ts from 'typescript';
import {
  BubbleParameterType,
  ParsedBubbleWithInfo,
  type ParsedBubble,
  type BubbleNodeType,
} from '@bubblelab/shared-schemas';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { buildClassNameLookup } from '../utils/bubble-helper';
export interface DependencyTraceResult {
  success: boolean;
  nodes: Record<string, ParsedBubbleWithInfo>;
  errors?: string[];
}

/**
 * Trace bubble dependencies from a validated BubbleFlow script.
 * - Parses AST, extracts bubble instantiations and their parameters
 * - Builds a className -> metadata mapping from BubbleFactory defaults
 * - Classifies each bubble node as service/tool/workflow using metadata
 *
 * Note: Only dependencies explicitly constructed in the script are captured.
 * Internal dependencies of workflow bubbles require explicit metadata.
 */
export function traceBubbleDependencies(
  code: string,
  bubbleFactory: BubbleFactory
): DependencyTraceResult {
  try {
    const sourceFile = ts.createSourceFile(
      'bubbleflow.ts',
      code,
      ts.ScriptTarget.ES2022,
      true
    );

    // Build registry lookup from bubble-core
    const classNameToInfo = buildClassNameLookup(bubbleFactory);
    if (classNameToInfo.size === 0) {
      return {
        success: false,
        nodes: {},
        errors: ['No bubbles found in BubbleFactory'],
      };
    }

    const nodes: Record<string, ParsedBubbleWithInfo> = {};
    const errors: string[] = [];

    function visit(node: ts.Node) {
      // Capture variable declarations
      if (ts.isVariableDeclaration(node)) {
        const nameText = node.name.getText(sourceFile);

        // Bubble instantiation assigned to variable
        if (node.initializer) {
          const bubbleNode = extractBubbleFromExpression(
            node.initializer,
            sourceFile,
            classNameToInfo
          );
          if (bubbleNode) {
            nodes[nameText] = bubbleNode;
          }
        }
      }

      // Anonymous instantiations in expression statements
      if (ts.isExpressionStatement(node)) {
        const bubbleNode = extractBubbleFromExpression(
          node.expression,
          sourceFile,
          classNameToInfo
        );
        if (bubbleNode) {
          const synthetic = `_anonymous_${bubbleNode.className}_${Object.keys(nodes).length}`;
          nodes[synthetic] = { ...bubbleNode, variableName: synthetic };
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return {
      success: errors.length === 0,
      nodes,
      errors: errors.length ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      nodes: {},
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function extractBubbleFromExpression(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  classNameLookup: Map<
    string,
    { bubbleName: string; className: string; nodeType: BubbleNodeType }
  >
): ParsedBubbleWithInfo | null {
  // await new X(...)
  if (ts.isAwaitExpression(expr)) {
    const inner = extractBubbleFromExpression(
      expr.expression,
      sourceFile,
      classNameLookup
    );
    if (inner) inner.hasAwait = true;
    return inner;
  }

  // new X({...}) or new X({...}).action()
  if (ts.isNewExpression(expr)) {
    const newNode = extractFromNewExpression(expr, sourceFile, classNameLookup);
    if (newNode) return newNode;
  }

  // new X({...}).action() pattern
  if (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression)
  ) {
    const prop = expr.expression;
    if (prop.name.text === 'action' && ts.isNewExpression(prop.expression)) {
      const node = extractFromNewExpression(
        prop.expression,
        sourceFile,
        classNameLookup
      );
      if (node) node.hasActionCall = true;
      return node;
    }
  }

  return null;
}

function extractFromNewExpression(
  newExpr: ts.NewExpression,
  sourceFile: ts.SourceFile,
  classNameLookup: Map<
    string,
    { bubbleName: string; className: string; nodeType: BubbleNodeType }
  >
): ParsedBubbleWithInfo | null {
  if (!newExpr.expression || !ts.isIdentifier(newExpr.expression)) return null;
  const className = newExpr.expression.text;
  const info = classNameLookup.get(className);
  if (!info) return null;

  const parameters: ParsedBubble['parameters'] = [];
  if (newExpr.arguments && newExpr.arguments.length > 0) {
    const firstArg = newExpr.arguments[0];
    if (ts.isObjectLiteralExpression(firstArg)) {
      for (const prop of firstArg.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const name = prop.name.text;
          const value = extractParameterValue(prop.initializer, sourceFile);
          parameters.push({ name, ...value, source: 'object-property' });
        } else if (
          ts.isShorthandPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name)
        ) {
          const name = prop.name.text;
          const value = extractParameterValue(prop.name, sourceFile);
          parameters.push({ name, ...value, source: 'object-property' });
        } else if (ts.isSpreadAssignment(prop)) {
          // Spread properties like {...params}
          const spreadExpr = prop.expression;
          const value = extractParameterValue(spreadExpr, sourceFile);
          const spreadName = ts.isIdentifier(spreadExpr)
            ? spreadExpr.text
            : 'spread';
          parameters.push({
            name: spreadName,
            ...value,
            source: 'object-property',
          });
        }
      }
    } else {
      // Handle single variable parameter (e.g., new GoogleDriveBubble(config))
      const value = extractParameterValue(firstArg, sourceFile);
      const argName = ts.isIdentifier(firstArg) ? firstArg.text : 'arg0';
      parameters.push({ name: argName, ...value, source: 'first-arg' });
    }
  }

  const start = newExpr.getStart(sourceFile);
  const end = newExpr.getEnd();
  const lineStart = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
  const lineEnd = sourceFile.getLineAndCharacterOfPosition(end).line + 1;

  return {
    variableId: -1,
    variableName: '',
    bubbleName: info.bubbleName,
    className: info.className,
    parameters,
    hasAwait: false,
    hasActionCall: false,
    nodeType: info.nodeType,
    location: {
      startLine: lineStart,
      startCol: 0,
      endLine: lineEnd,
      endCol: 0,
    },
  };
}

function extractParameterValue(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): {
  value: string | number | boolean | Record<string, unknown> | unknown[];
  type: BubbleParameterType;
} {
  const valueText = expression.getText(sourceFile);

  // process.env detection (with or without non-null)
  const isProcessEnv = (text: string) => text.startsWith('process.env.');
  if (ts.isNonNullExpression(expression)) {
    const inner = expression.expression;
    if (ts.isPropertyAccessExpression(inner)) {
      const full = inner.getText(sourceFile);
      if (isProcessEnv(full))
        return { value: valueText, type: BubbleParameterType.ENV };
    }
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    const full = expression.getText(sourceFile);
    if (isProcessEnv(full))
      return { value: full, type: BubbleParameterType.ENV };
    return { value: full, type: BubbleParameterType.VARIABLE };
  }

  // Identifiers treated as variable references
  if (ts.isIdentifier(expression)) {
    return { value: valueText, type: BubbleParameterType.VARIABLE };
  }

  // Literals and structured
  if (ts.isStringLiteral(expression) || ts.isTemplateExpression(expression)) {
    return { value: valueText, type: BubbleParameterType.STRING };
  }
  if (ts.isNumericLiteral(expression)) {
    return { value: valueText, type: BubbleParameterType.NUMBER };
  }
  if (
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { value: valueText, type: BubbleParameterType.BOOLEAN };
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return { value: valueText, type: BubbleParameterType.ARRAY };
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return { value: valueText, type: BubbleParameterType.OBJECT };
  }

  // Fallback
  return { value: valueText, type: BubbleParameterType.UNKNOWN };
}
