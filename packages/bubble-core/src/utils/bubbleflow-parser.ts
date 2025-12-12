import * as ts from 'typescript';
import type { BubbleFactory } from '../bubble-factory.js';
import type {
  BubbleName,
  ParsedBubble,
  BubbleParameter,
} from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';

export interface BubbleFlowParseResult {
  success: boolean;
  bubbles: Record<string, ParsedBubble>;
  errors?: string[];
}

/**
 * Parses a BubbleFlow TypeScript code and extracts all bubble instantiations
 * with their parameters using the BubbleRegistry for accurate mapping.
 */
export function parseBubbleFlow(
  code: string,
  bubbleFactory: BubbleFactory
): BubbleFlowParseResult {
  try {
    // First, try to create the source file and check for basic syntax errors
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.ES2022,
      true
    );

    // Check if there are any parse diagnostics
    const syntaxDiagnostics = (
      sourceFile as unknown as {
        parseDiagnostics?: ts.DiagnosticWithLocation[];
      }
    ).parseDiagnostics;
    if (syntaxDiagnostics && syntaxDiagnostics.length > 0) {
      const errors = syntaxDiagnostics.map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        );
        return `Syntax error: ${message}`;
      });
      return {
        success: false,
        bubbles: {},
        errors,
      };
    }

    const bubbles: Record<string, ParsedBubble> = {};
    const errors: string[] = [];

    // Build reverse lookup map from class names to bubble names using BubbleRegistry
    const classNameToBubbleName = buildClassNameLookup(bubbleFactory);
    // Build import alias map to resolve aliased imports
    const importAliasMap = buildImportAliasMap(sourceFile);

    function visit(node: ts.Node) {
      // Look for variable declarations with bubble instantiations
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const variableName = node.name.getText(sourceFile);
        const bubbleInfo = extractBubbleFromExpression(
          node.initializer,
          sourceFile,
          classNameToBubbleName,
          importAliasMap
        );

        if (bubbleInfo) {
          bubbles[variableName] = {
            variableName,
            ...bubbleInfo,
          };
        }
      }

      // Look for expression statements with anonymous bubble instantiations
      if (ts.isExpressionStatement(node)) {
        const bubbleInfo = extractBubbleFromExpression(
          node.expression,
          sourceFile,
          classNameToBubbleName,
          importAliasMap
        );

        if (bubbleInfo) {
          // Generate a synthetic variable name for anonymous calls
          const syntheticName = `_anonymous_${bubbleInfo.className}_${Object.keys(bubbles).length}`;
          bubbles[syntheticName] = {
            variableName: syntheticName,
            ...bubbleInfo,
          };
        }
      }

      // Note: We now parse both variable declarations and anonymous expression statements
      // Method calls like 'await postgres.action()' are NOT parsed as they are usage, not instantiation

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return {
      success: errors.length === 0,
      bubbles,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      bubbles: {},
      errors: [
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function buildClassNameLookup(
  bubbleFactory: BubbleFactory
): Map<string, { bubbleName: string; className: string }> {
  const lookup = new Map<string, { bubbleName: string; className: string }>();

  // Get all registered bubbles and their metadata
  const allBubbles = bubbleFactory.getAll();
  const bubbleNames = bubbleFactory.list();

  bubbleNames.forEach((bubbleName, index) => {
    const bubbleClass = allBubbles[index];
    if (bubbleClass) {
      // Extract the class name from the constructor
      const className = bubbleClass.name;
      lookup.set(className, { bubbleName, className });
    }
  });

  return lookup;
}

/**
 * Builds a map of import aliases to their original class names.
 * Handles patterns like: import ResearchAgentBubble as xxx
 * Maps: "xxx" -> "ResearchAgentBubble"
 */
function buildImportAliasMap(sourceFile: ts.SourceFile): Map<string, string> {
  const aliasMap = new Map<string, string>();

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const importClause = node.importClause;

      // Handle named imports: import { X as Y } from '...'
      if (
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        importClause.namedBindings.elements.forEach((element) => {
          const identifierName = element.name.text;
          // Check if there's an alias (propertyName exists when there's an "as" clause)
          if (element.propertyName) {
            // Has alias: import { OriginalName as AliasName }
            const alias = identifierName; // What's used in code
            const originalName = element.propertyName.text; // Original class name
            aliasMap.set(alias, originalName);
          } else {
            // No alias: import { OriginalName }
            // Map to itself for consistency
            aliasMap.set(identifierName, identifierName);
          }
        });
      }

      // Handle namespace imports: import * as X from '...'
      // Note: For namespace imports, we can't easily map to specific classes
      // This would require more complex analysis of the namespace usage
      if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        // Namespace imports are not currently supported for bubble parsing
        // as we can't determine which specific class from the namespace is being used
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliasMap;
}

function extractBubbleFromExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  classNameLookup: Map<string, { bubbleName: string; className: string }>,
  importAliasMap: Map<string, string>
): Omit<ParsedBubble, 'variableName'> | null {
  // Handle await expressions only if they contain instantiations
  if (ts.isAwaitExpression(expression)) {
    const awaitResult = extractBubbleFromExpression(
      expression.expression,
      sourceFile,
      classNameLookup,
      importAliasMap
    );
    if (awaitResult) {
      awaitResult.hasAwait = true;
    }
    return awaitResult;
  }

  // Handle direct new expressions
  if (ts.isNewExpression(expression)) {
    const result = extractBubbleFromNewExpression(
      expression,
      sourceFile,
      classNameLookup,
      importAliasMap
    );
    if (result) {
      result.hasAwait = false;
      result.hasActionCall = false;
    }
    return result;
  }

  // Handle call expressions (like .action())
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression)
  ) {
    const propertyAccess = expression.expression;
    if (
      propertyAccess.name.text === 'action' &&
      ts.isNewExpression(propertyAccess.expression)
    ) {
      const result = extractBubbleFromNewExpression(
        propertyAccess.expression,
        sourceFile,
        classNameLookup,
        importAliasMap
      );
      if (result) {
        result.hasAwait = false;
        result.hasActionCall = true;
      }
      return result;
    }
  }

  return null;
}

function extractBubbleFromNewExpression(
  newExpr: ts.NewExpression,
  sourceFile: ts.SourceFile,
  classNameLookup: Map<string, { bubbleName: string; className: string }>,
  importAliasMap: Map<string, string>
): Omit<ParsedBubble, 'variableName'> | null {
  if (!newExpr.expression || !ts.isIdentifier(newExpr.expression)) {
    return null;
  }

  let className = newExpr.expression.text;

  // Resolve import alias if it exists
  // e.g., if user wrote: import ResearchAgentBubble as xxx
  // and then: new xxx(...), we need to resolve "xxx" -> "ResearchAgentBubble"
  const resolvedClassName = importAliasMap.get(className);
  if (resolvedClassName) {
    className = resolvedClassName;
  }

  // Look up the bubble info using the registry (with resolved class name)
  const bubbleInfo = classNameLookup.get(className);
  if (!bubbleInfo) {
    return null; // Not a registered bubble
  }

  const parameters: BubbleParameter[] = [];

  // Extract parameters from the constructor call
  if (newExpr.arguments && newExpr.arguments.length > 0) {
    const firstArg = newExpr.arguments[0];

    if (ts.isObjectLiteralExpression(firstArg)) {
      firstArg.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const paramName = prop.name.text;
          const paramValue = extractParameterValue(
            prop.initializer,
            sourceFile
          );
          parameters.push({
            name: paramName,
            ...paramValue,
          });
        }
      });
    }
  }

  return {
    bubbleName: bubbleInfo.bubbleName as BubbleName,
    className: bubbleInfo.className,
    parameters,
    hasAwait: false, // Will be set by calling functions
    hasActionCall: false, // Will be set by calling functions
  };
}

function extractParameterValue(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): { value: string; type: BubbleParameter['type'] } {
  const valueText = expression.getText(sourceFile);

  // Check if it's an environment variable access - need to handle non-null assertion
  if (ts.isNonNullExpression(expression)) {
    const innerExpression = expression.expression;
    if (ts.isPropertyAccessExpression(innerExpression)) {
      const fullText = innerExpression.getText(sourceFile);
      if (fullText.startsWith('process.env.')) {
        return { value: valueText, type: BubbleParameterType.ENV };
      }
    }
  }

  // Check direct property access (without non-null assertion)
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    const fullText = expression.getText(sourceFile);
    if (fullText.startsWith('process.env.')) {
      return { value: fullText, type: BubbleParameterType.ENV };
    }
  }

  // Check TypeScript syntax kinds for type detection
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

  return { value: valueText, type: BubbleParameterType.UNKNOWN };
}

/**
 * Reconstructs a BubbleFlow code string from parsed bubbles and parameters.
 */
export function reconstructBubbleFlow(
  originalCode: string,
  bubbleParameters: Record<string, ParsedBubble>,
  bubbleFactory: BubbleFactory
): { success: boolean; code?: string; errors?: string[] } {
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      originalCode,
      ts.ScriptTarget.ES2022,
      true
    );

    const errors: string[] = [];
    let modifiedCode = originalCode;
    const modifications: Array<{
      start: number;
      end: number;
      replacement: string;
    }> = [];
    const classNameLookup = buildClassNameLookup(bubbleFactory);
    const importAliasMap = buildImportAliasMap(sourceFile);

    function visit(node: ts.Node) {
      // Look for variable declarations with bubble instantiations
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const variableName = node.name.getText(sourceFile);
        const newBubbleParams = bubbleParameters[variableName];

        if (newBubbleParams) {
          const bubbleInfo = extractBubbleFromExpression(
            node.initializer,
            sourceFile,
            classNameLookup,
            importAliasMap
          );
          if (bubbleInfo) {
            // Validate bubble name matches
            if (bubbleInfo.bubbleName !== newBubbleParams.bubbleName) {
              errors.push(
                `Bubble name mismatch for variable '${variableName}': expected '${bubbleInfo.bubbleName}', got '${newBubbleParams.bubbleName}'`
              );
              return;
            }

            // Generate new bubble instantiation
            const newBubbleCode = generateBubbleInstantiation(newBubbleParams);
            const bubbleStart = node.initializer.getStart(sourceFile);
            const bubbleEnd = node.initializer.getEnd();

            modifications.push({
              start: bubbleStart,
              end: bubbleEnd,
              replacement: newBubbleCode,
            });
          }
        }
      }

      // Look for expression statements with anonymous bubble instantiations
      if (ts.isExpressionStatement(node)) {
        const bubbleInfo = extractBubbleFromExpression(
          node.expression,
          sourceFile,
          classNameLookup,
          importAliasMap
        );

        if (bubbleInfo) {
          // Generate synthetic name to match what parseBubbleFlow creates
          const syntheticName = `_anonymous_${bubbleInfo.className}_`;

          // Find matching bubble parameters by checking if any key starts with our synthetic pattern
          const matchingEntry = Object.entries(bubbleParameters).find(([key]) =>
            key.startsWith(syntheticName)
          );

          if (matchingEntry) {
            const [, newBubbleParams] = matchingEntry;

            // Validate bubble name matches
            if (bubbleInfo.bubbleName !== newBubbleParams.bubbleName) {
              errors.push(
                `Bubble name mismatch for anonymous call: expected '${bubbleInfo.bubbleName}', got '${newBubbleParams.bubbleName}'`
              );
              return;
            }

            // Generate new bubble instantiation
            const newBubbleCode = generateBubbleInstantiation(newBubbleParams);
            const bubbleStart = node.expression.getStart(sourceFile);
            const bubbleEnd = node.expression.getEnd();

            modifications.push({
              start: bubbleStart,
              end: bubbleEnd,
              replacement: newBubbleCode,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply modifications in reverse order to maintain positions
    modifications.sort((a, b) => b.start - a.start);

    for (const mod of modifications) {
      modifiedCode =
        modifiedCode.slice(0, mod.start) +
        mod.replacement +
        modifiedCode.slice(mod.end);
    }

    return { success: true, code: modifiedCode };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Reconstruction error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function generateBubbleInstantiation(bubble: ParsedBubble): string {
  const paramStrings = bubble.parameters.map((param) => {
    // Handle case where value might be an object (like credentials)
    const valueStr =
      typeof param.value === 'string'
        ? param.value
        : JSON.stringify(param.value);
    return `${param.name}: ${valueStr}`;
  });

  const hasParams = bubble.parameters.length > 0;
  const paramsString = hasParams ? `{\n  ${paramStrings.join(',\n  ')}\n}` : '';

  // Reconstruct based on original pattern
  if (bubble.hasAwait && bubble.hasActionCall) {
    // Original: await new BubbleName({...}).action()
    return `await new ${bubble.className}(${paramsString}).action()`;
  } else if (bubble.hasAwait && !bubble.hasActionCall) {
    // Original: await new BubbleName({...})
    return `await new ${bubble.className}(${paramsString})`;
  } else if (!bubble.hasAwait && bubble.hasActionCall) {
    // Original: new BubbleName({...}).action()
    return `new ${bubble.className}(${paramsString}).action()`;
  } else {
    // Original: new BubbleName({...})
    return `new ${bubble.className}(${paramsString})`;
  }
}

/**
 * Validates bubble parameters against their schema from the BubbleRegistry
 */
export function validateBubbleParameters(
  bubbleName: BubbleName,
  bubbleFactory: BubbleFactory,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _parameters: BubbleParameter[] // intentionally unused, reserved for future validation
): { valid: boolean; errors?: string[] } {
  const bubbleMetadata = bubbleFactory.getMetadata(bubbleName);
  if (!bubbleMetadata) {
    return { valid: false, errors: [`Unknown bubble: ${bubbleName}`] };
  }

  // For now, return success - full schema validation would require
  // evaluating the parameter values in context
  return { valid: true };
}

/**
 * Gets available parameter schema for a bubble from the registry
 */
export function getBubbleParameterSchema(
  bubbleName: BubbleName,
  bubbleFactory: BubbleFactory
): unknown {
  return bubbleFactory.getMetadata(bubbleName);
}
