import * as ts from 'typescript';
import { parseBubbleFlow } from './bubbleflow-parser.js';
import type { BubbleFactory } from '../bubble-factory.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  bubbleParameters?: Record<string, ParsedBubble>;
}

export async function validateBubbleFlow(
  code: string,
  bubbleFactory: BubbleFactory
): Promise<ValidationResult> {
  try {
    // Create a temporary file name for the validation
    const fileName = 'temp-bubble-flow.ts';

    // Get TypeScript compiler options (similar to bubble-core config)
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: true,
      noImplicitAny: true,
      skipLibCheck: true,
      verbatimModuleSyntax: true,
      paths: {
        '@bubblelab/bubble-core': ['../../packages/bubble-core/src'],
      },
      baseUrl: '.',
    };

    // Create a program with the code
    const sourceFile = ts.createSourceFile(
      fileName,
      code,
      ts.ScriptTarget.ES2022,
      true
    );

    // Create program
    const host = ts.createCompilerHost(compilerOptions);

    // Override getSourceFile to return our code
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (
      name,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    ) => {
      if (name === fileName) {
        return sourceFile;
      }
      return originalGetSourceFile.call(
        host,
        name,
        languageVersion,
        onError,
        shouldCreateNewSourceFile
      );
    };

    const program = ts.createProgram([fileName], compilerOptions, host);

    // Get diagnostics
    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
      const errors = diagnostics.map((diagnostic) => {
        if (diagnostic.file && diagnostic.start !== undefined) {
          const { line, character } = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start
          );
          const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n'
          );
          return `Line ${line + 1}, Column ${character + 1}: ${message}`;
        }
        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      });

      return {
        valid: false,
        errors,
      };
    }

    // Additional validation: Check if it extends BubbleFlow
    const hasValidBubbleFlow = validateBubbleFlowClass(sourceFile);
    if (!hasValidBubbleFlow.valid) {
      return hasValidBubbleFlow;
    }

    // Parse bubble parameters after successful validation
    const parseResult = parseBubbleFlow(code, bubbleFactory);
    if (!parseResult.success) {
      // This shouldn't happen if TypeScript validation passed, but handle it
      return {
        valid: false,
        errors: parseResult.errors || ['Failed to parse bubble parameters'],
      };
    }

    return {
      valid: true,
      bubbleParameters: parseResult.bubbles,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function validateBubbleFlowClass(sourceFile: ts.SourceFile): ValidationResult {
  let hasBubbleFlowClass = false;
  let hasHandleMethod = false;

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.heritageClauses) {
      // Check if class extends BubbleFlow
      const extendsClause = node.heritageClauses.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      );

      if (
        extendsClause &&
        extendsClause.types.some(
          (type) =>
            ts.isIdentifier(type.expression) &&
            type.expression.text === 'BubbleFlow'
        )
      ) {
        hasBubbleFlowClass = true;

        // Check for handle method
        node.members.forEach((member) => {
          if (
            ts.isMethodDeclaration(member) &&
            ts.isIdentifier(member.name) &&
            member.name.text === 'handle'
          ) {
            hasHandleMethod = true;
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const errors: string[] = [];
  if (!hasBubbleFlowClass) {
    errors.push('Code must contain a class that extends BubbleFlow');
  }
  if (!hasHandleMethod) {
    errors.push('BubbleFlow class must have a handle method');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
