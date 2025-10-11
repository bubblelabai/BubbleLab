import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { BubbleName } from '@bubblelab/shared-schemas';
import type { BubbleClassWithMetadata } from '../bubble-factory.js';

export interface ParsedInstanceInfo {
  variableName: string;
  isAnonymous: boolean;
  startLine?: number;
  endLine?: number;
  // For ai-agent instances, list of tool bubble names extracted from AST (if any)
  tools?: BubbleName[];
}

export type ParsedInstancesByBubble = Map<BubbleName, ParsedInstanceInfo[]>;

/**
 * Build a className -> { bubbleName } map from the factory registry
 */
export function buildClassNameLookup(
  registry: Map<BubbleName, BubbleClassWithMetadata<any>>
): Map<string, { bubbleName: BubbleName; className: string }> {
  const out = new Map<string, { bubbleName: BubbleName; className: string }>();
  for (const [bubbleName, klass] of registry.entries()) {
    // Rely on constructor name as className for detection (runtime safe)
    const className =
      (klass as unknown as { name?: string })?.name || String(bubbleName);
    out.set(className, { bubbleName, className });
  }
  return out;
}

/**
 * Parse a source file and extract all bubble instantiations with variable names and locations.
 * Works for patterns:
 *  - const v = new Class({...})
 *  - await new Class({...}).action()
 */
export function parseBubbleInstancesFromSource(
  sourceCode: string,
  classNameLookup: Map<string, { bubbleName: BubbleName; className: string }>,
  options?: { debug?: boolean; filePath?: string }
): ParsedInstancesByBubble {
  const ast = parse(sourceCode, {
    range: true,
    loc: true,
    sourceType: 'module',
    ecmaVersion: 2022,
  });

  const found: ParsedInstancesByBubble = new Map();
  let anonCounter = 0;

  const visit = (node: TSESTree.Node) => {
    // VariableDeclaration -> capture class under initializer
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (
          declarator.type === 'VariableDeclarator' &&
          declarator.id.type === 'Identifier' &&
          declarator.init
        ) {
          const variableName = declarator.id.name;
          const info = extractFromExpression(declarator.init);
          if (info) {
            if (options?.debug) {
              console.log(
                `[source-bubble-parser] (${options.filePath}) match var decl: ${info.className} -> ${info.bubbleName} as ${variableName} @${declarator.loc?.start.line}-${declarator.loc?.end.line}`
              );
            }
            pushInstance(found, info.bubbleName, {
              variableName,
              isAnonymous: false,
              startLine: declarator.loc?.start.line,
              endLine: declarator.loc?.end.line,
              tools: info.tools,
            });
          } else if (options?.debug) {
            const dbg = debugFromExpression(
              declarator.init as TSESTree.Expression
            );
            if (dbg)
              console.log(
                `[source-bubble-parser] (${options.filePath}) new expr not mapped: ${dbg} @${declarator.loc?.start.line}-${declarator.loc?.end.line}`
              );
          }
        }
      }
    }

    // ExpressionStatement -> anonymous instantiation
    if (node.type === 'ExpressionStatement') {
      const info = extractFromExpression(node.expression);
      if (info) {
        const variableName = `_anonymous_${info.className}_${++anonCounter}`;
        if (options?.debug) {
          console.log(
            `[source-bubble-parser] (${options.filePath}) match anonymous: ${info.className} -> ${info.bubbleName} @${node.loc?.start.line}-${node.loc?.end.line}`
          );
        }
        pushInstance(found, info.bubbleName, {
          variableName,
          isAnonymous: true,
          startLine: node.loc?.start.line,
          endLine: node.loc?.end.line,
          tools: info.tools,
        });
      } else if (options?.debug) {
        const dbg = debugFromExpression(node.expression as TSESTree.Expression);
        if (dbg)
          console.log(
            `[source-bubble-parser] (${options.filePath}) expr not mapped: ${dbg} @${node.loc?.start.line}-${node.loc?.end.line}`
          );
      }
    }

    // Recurse
    for (const key of Object.keys(node) as Array<keyof typeof node>) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((child) => {
          if (child && typeof child === 'object' && 'type' in child)
            visit(child as TSESTree.Node);
        });
      } else if (value && typeof value === 'object' && 'type' in value) {
        visit(value as TSESTree.Node);
      }
    }
  };

  const extractFromExpression = (
    expr: TSESTree.Expression | TSESTree.PrivateIdentifier
  ): {
    bubbleName: BubbleName;
    className: string;
    tools?: BubbleName[];
  } | null => {
    // await new X(...)
    if (expr.type === 'AwaitExpression') {
      const inner = extractFromExpression(expr.argument as TSESTree.Expression);
      if (inner) return inner;
    }

    // new X({...}) or new X({...}).action()
    if (expr.type === 'NewExpression') {
      if (expr.callee.type === 'Identifier') {
        const className = expr.callee.name;
        const info = classNameLookup.get(className);
        if (info) return maybeAugmentWithTools(info, expr);
        if (options?.debug) {
          console.log(
            `[source-bubble-parser] (${options.filePath}) NewExpression Identifier callee not mapped: ${className}`
          );
        }
      }
      // Handle compiled ESM/CJS member access: new module_1.SlackBubble(...)
      if (
        expr.callee.type === 'MemberExpression' &&
        expr.callee.property.type === 'Identifier'
      ) {
        const className = expr.callee.property.name;
        const info = classNameLookup.get(className);
        if (info) return maybeAugmentWithTools(info, expr);
        if (options?.debug) {
          console.log(
            `[source-bubble-parser] (${options.filePath}) NewExpression MemberExpression callee not mapped: ${className}`
          );
        }
      }
    }

    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'MemberExpression' &&
      expr.callee.object.type === 'NewExpression'
    ) {
      const newObj = expr.callee.object;
      if (newObj.callee.type === 'Identifier') {
        const className = newObj.callee.name;
        const info = classNameLookup.get(className);
        if (info) return maybeAugmentWithTools(info, newObj);
        if (options?.debug) {
          console.log(
            `[source-bubble-parser] (${options.filePath}) Inline Call new Identifier not mapped: ${className}`
          );
        }
      }
      if (
        newObj.callee.type === 'MemberExpression' &&
        newObj.callee.property.type === 'Identifier'
      ) {
        const className = newObj.callee.property.name;
        const info = classNameLookup.get(className);
        if (info) return maybeAugmentWithTools(info, newObj);
        if (options?.debug) {
          console.log(
            `[source-bubble-parser] (${options.filePath}) Inline Call new MemberExpression not mapped: ${className}`
          );
        }
      }
    }
    return null;
  };

  function maybeAugmentWithTools(
    info: { bubbleName: BubbleName; className: string },
    newExpr: TSESTree.NewExpression
  ): { bubbleName: BubbleName; className: string; tools?: BubbleName[] } {
    if (info.bubbleName !== ('ai-agent' as BubbleName)) return info;
    try {
      const tools = extractToolsFromNewExpression(newExpr);
      if (tools && tools.length > 0) return { ...info, tools };
    } catch {
      // ignore
    }
    return info;
  }

  function extractToolsFromNewExpression(
    newExpr: TSESTree.NewExpression
  ): BubbleName[] | undefined {
    if (!newExpr.arguments || newExpr.arguments.length === 0) return undefined;
    const arg0 = newExpr.arguments[0] as TSESTree.Expression;
    if (arg0.type !== 'ObjectExpression') return undefined;
    const toolsProp = arg0.properties.find(
      (p): p is TSESTree.Property =>
        p.type === 'Property' &&
        p.key.type === 'Identifier' &&
        p.key.name === 'tools'
    );
    if (!toolsProp) return undefined;
    const value = toolsProp.value as TSESTree.Expression;
    if (value.type === 'ArrayExpression') {
      const out: BubbleName[] = [];
      for (const el of value.elements) {
        if (!el) continue;
        if (el.type === 'ObjectExpression') {
          const nameProp = el.properties.find(
            (pp): pp is TSESTree.Property =>
              pp.type === 'Property' &&
              pp.key.type === 'Identifier' &&
              pp.key.name === 'name'
          );
          if (
            nameProp &&
            nameProp.value.type === 'Literal' &&
            typeof nameProp.value.value === 'string'
          ) {
            out.push(nameProp.value.value as BubbleName);
          }
        } else if (el.type === 'Literal' && typeof el.value === 'string') {
          out.push(el.value as BubbleName);
        }
      }
      return out;
    }
    return undefined;
  }

  const debugFromExpression = (expr: TSESTree.Expression): string | null => {
    if (expr.type === 'NewExpression') {
      if (expr.callee.type === 'Identifier')
        return `new ${expr.callee.name}(...)`;
      if (
        expr.callee.type === 'MemberExpression' &&
        expr.callee.property.type === 'Identifier'
      )
        return `new <member>.${expr.callee.property.name}(...)`;
    }
    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'MemberExpression' &&
      expr.callee.object.type === 'NewExpression'
    ) {
      const callee = expr.callee.object.callee as TSESTree.Expression;
      if (callee.type === 'Identifier')
        return `await new ${callee.name}(...).<call>`;
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier'
      )
        return `await new <member>.${callee.property.name}(...).<call>`;
    }
    return null;
  };

  const pushInstance = (
    map: ParsedInstancesByBubble,
    bubbleName: BubbleName,
    instance: ParsedInstanceInfo
  ) => {
    const list = map.get(bubbleName) || [];
    list.push(instance);
    map.set(bubbleName, list);
  };

  visit(ast);
  // Sort instances by line
  for (const [key, list] of Array.from(found.entries())) {
    list.sort((a, b) => (a.startLine || 0) - (b.startLine || 0));
    found.set(key, list);
  }
  return found;
}
