import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';

interface BraceInsertion {
  // Position where opening brace should be inserted (after the condition/header)
  openBracePos: number;
  // Position where closing brace should be inserted (after the statement)
  closeBracePos: number;
  // Indentation to use for the closing brace
  indentation: string;
}

/**
 * Normalizes braceless control flow statements by wrapping them with braces.
 * This prevents issues when injecting logging or other statements into the code.
 *
 * Transforms:
 *   if (x) doSomething();
 *   else doOther();
 *
 * Into:
 *   if (x) { doSomething(); }
 *   else { doOther(); }
 */
export function normalizeBracelessControlFlow(code: string): string {
  let ast: TSESTree.Program;

  try {
    ast = parse(code, {
      range: true,
      loc: true,
      sourceType: 'module',
      ecmaVersion: 2022,
    });
  } catch {
    // If parsing fails, return original code
    return code;
  }

  const insertions: BraceInsertion[] = [];

  // Collect all braceless control flow bodies
  collectBracelessBodies(ast, code, insertions);

  if (insertions.length === 0) {
    return code;
  }

  // Sort insertions by position in reverse order to preserve positions during modification
  insertions.sort((a, b) => b.openBracePos - a.openBracePos);

  // Apply insertions
  let result = code;
  for (const insertion of insertions) {
    result = applyBraceInsertion(result, insertion);
  }

  return result;
}

function collectBracelessBodies(
  node: TSESTree.Node,
  code: string,
  insertions: BraceInsertion[]
): void {
  if (!node || typeof node !== 'object') return;

  // Check if statement
  if (node.type === 'IfStatement') {
    const ifStmt = node as TSESTree.IfStatement;

    // Check consequent (then branch)
    if (ifStmt.consequent.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(
        ifStmt,
        ifStmt.consequent,
        code,
        'consequent'
      );
      if (insertion) {
        insertions.push(insertion);
      }
    }

    // Check alternate (else branch) - but not if it's another IfStatement (else if)
    if (
      ifStmt.alternate &&
      ifStmt.alternate.type !== 'BlockStatement' &&
      ifStmt.alternate.type !== 'IfStatement'
    ) {
      const insertion = createBraceInsertion(
        ifStmt,
        ifStmt.alternate,
        code,
        'alternate'
      );
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Check for statement
  if (node.type === 'ForStatement') {
    const forStmt = node as TSESTree.ForStatement;
    if (forStmt.body.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(forStmt, forStmt.body, code);
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Check for-in statement
  if (node.type === 'ForInStatement') {
    const forInStmt = node as TSESTree.ForInStatement;
    if (forInStmt.body.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(forInStmt, forInStmt.body, code);
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Check for-of statement
  if (node.type === 'ForOfStatement') {
    const forOfStmt = node as TSESTree.ForOfStatement;
    if (forOfStmt.body.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(forOfStmt, forOfStmt.body, code);
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Check while statement
  if (node.type === 'WhileStatement') {
    const whileStmt = node as TSESTree.WhileStatement;
    if (whileStmt.body.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(whileStmt, whileStmt.body, code);
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Check do-while statement
  if (node.type === 'DoWhileStatement') {
    const doWhileStmt = node as TSESTree.DoWhileStatement;
    if (doWhileStmt.body.type !== 'BlockStatement') {
      const insertion = createBraceInsertion(
        doWhileStmt,
        doWhileStmt.body,
        code
      );
      if (insertion) {
        insertions.push(insertion);
      }
    }
  }

  // Recursively process children
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;

    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          collectBracelessBodies(item as TSESTree.Node, code, insertions);
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      collectBracelessBodies(child as TSESTree.Node, code, insertions);
    }
  }
}

function createBraceInsertion(
  parent: TSESTree.Node,
  body: TSESTree.Statement,
  code: string,
  branchType?: 'consequent' | 'alternate'
): BraceInsertion | null {
  if (!body.range) return null;

  // For 'else' branches, we need to find where the 'else' keyword ends
  let openBracePos: number;

  if (branchType === 'alternate') {
    // Find the 'else' keyword before this statement
    // Search backwards from the body start to find 'else'
    const searchStart = Math.max(0, body.range[0] - 20);
    const searchRegion = code.substring(searchStart, body.range[0]);
    const elseMatch = searchRegion.match(/else\s*$/);
    if (elseMatch) {
      openBracePos = body.range[0];
    } else {
      openBracePos = body.range[0];
    }
  } else if (branchType === 'consequent') {
    // For 'if' consequent, insert after the closing paren of condition
    openBracePos = body.range[0];
  } else {
    // For for/while loops, insert after the closing paren
    openBracePos = body.range[0];
  }

  // Get the indentation of the parent statement
  const parentLine =
    code.substring(0, parent.range![0]).split('\n').pop() || '';
  const indentation = parentLine.match(/^\s*/)?.[0] || '';

  return {
    openBracePos,
    closeBracePos: body.range[1],
    indentation,
  };
}

function applyBraceInsertion(code: string, insertion: BraceInsertion): string {
  const { openBracePos, closeBracePos, indentation } = insertion;

  // Get the content between the positions
  const beforeOpen = code.substring(0, openBracePos);
  const bodyContent = code.substring(openBracePos, closeBracePos);
  const afterClose = code.substring(closeBracePos);

  // Always put the statement on its own line inside the braces
  // This ensures logging can be injected after the statement but before the closing brace
  const bodyIndent = indentation + '  ';
  return `${beforeOpen}{\n${bodyIndent}${bodyContent.trim()}\n${indentation}}${afterClose}`;
}
