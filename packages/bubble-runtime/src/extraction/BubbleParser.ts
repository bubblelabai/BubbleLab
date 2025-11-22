import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { Scope, ScopeManager } from '@bubblelab/ts-scope-manager';
import {
  BubbleFactory,
  BubbleTriggerEventRegistry,
} from '@bubblelab/bubble-core';
import { buildClassNameLookup } from '../utils/bubble-helper';
import type {
  ParsedBubbleWithInfo,
  BubbleNodeType,
  ParsedBubble,
  BubbleName,
  DependencyGraphNode,
  BubbleParameter,
  WorkflowNode,
  ParsedWorkflow,
  ControlFlowWorkflowNode,
  TryCatchWorkflowNode,
  CodeBlockWorkflowNode,
} from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';
import { parseToolsParamValue } from '../utils/parameter-formatter';

export class BubbleParser {
  private bubbleScript: string;

  constructor(bubbleScript: string) {
    this.bubbleScript = bubbleScript;
  }
  /**
   * Parse bubble dependencies from an AST using the provided factory and scope manager
   */
  parseBubblesFromAST(
    bubbleFactory: BubbleFactory,
    ast: TSESTree.Program,
    scopeManager: ScopeManager
  ): {
    bubbles: Record<number, ParsedBubbleWithInfo>;
    workflow: ParsedWorkflow;
    instanceMethodsLocation: Record<
      string,
      {
        startLine: number;
        endLine: number;
        definitionStartLine: number;
        bodyStartLine: number;
        invocationLines: number[];
      }
    >;
  } {
    // Build registry lookup from bubble-core
    const classNameToInfo = buildClassNameLookup(bubbleFactory);
    if (classNameToInfo.size === 0) {
      throw new Error(
        'Failed to trace bubble dependencies: No bubbles found in BubbleFactory'
      );
    }

    const nodes: Record<number, ParsedBubbleWithInfo> = {};
    const errors: string[] = [];

    // Find main BubbleFlow class and all its instance methods
    const mainClass = this.findMainBubbleFlowClass(ast);
    const instanceMethodsLocation: Record<
      string,
      {
        startLine: number;
        endLine: number;
        definitionStartLine: number;
        bodyStartLine: number;
        invocationLines: number[];
      }
    > = {};

    if (mainClass) {
      const methods = this.findAllInstanceMethods(mainClass);
      const methodNames = methods.map((m) => m.methodName);
      const invocations = this.findMethodInvocations(ast, methodNames);

      // Combine method locations with invocation lines
      for (const method of methods) {
        instanceMethodsLocation[method.methodName] = {
          startLine: method.startLine,
          endLine: method.endLine,
          definitionStartLine: method.definitionStartLine,
          bodyStartLine: method.bodyStartLine,
          invocationLines: invocations[method.methodName] || [],
        };
      }
    }

    // Visit AST nodes to find bubble instantiations
    this.visitNode(ast, nodes, classNameToInfo, scopeManager);

    if (errors.length > 0) {
      throw new Error(
        `Failed to trace bubble dependencies: ${errors.join(', ')}`
      );
    }

    // Build a set of used variable IDs to ensure uniqueness for any synthetic IDs we allocate
    const usedVariableIds = new Set<number>();
    for (const [idStr, node] of Object.entries(nodes)) {
      const id = Number(idStr);
      if (!Number.isNaN(id)) usedVariableIds.add(id);
      for (const param of node.parameters) {
        if (typeof param.variableId === 'number') {
          usedVariableIds.add(param.variableId);
        }
      }
    }

    // For each bubble, compute flat dependencies and construct a detailed dependency graph
    for (const bubble of Object.values(nodes)) {
      const all = this.findDependenciesForBubble(
        [bubble.bubbleName as BubbleName],
        bubbleFactory,
        bubble.parameters
      );
      bubble.dependencies = all;

      // If this node is an ai-agent, extract tools for graph inclusion at the root level
      let rootAIAgentTools: BubbleName[] | undefined;
      if (bubble.bubbleName === 'ai-agent') {
        const toolsParam = bubble.parameters.find((p) => p.name === 'tools');
        const tools = toolsParam
          ? parseToolsParamValue(toolsParam.value)
          : null;
        if (Array.isArray(tools)) {
          rootAIAgentTools = tools
            .map((t) => t?.name)
            .filter((n): n is string => typeof n === 'string') as BubbleName[];
        }
      }

      // Build hierarchical graph annotated with uniqueId and variableId
      const ordinalCounters = new Map<string, number>();
      bubble.dependencyGraph = this.buildDependencyGraph(
        bubble.bubbleName as BubbleName,
        bubbleFactory,
        new Set(),
        rootAIAgentTools,
        String(bubble.variableId), // Root uniqueId starts with the root variableId string
        ordinalCounters,
        usedVariableIds,
        bubble.variableId, // Root variable id mirrors the parsed bubble's variable id
        true, // suppress adding self segment for root
        bubble.variableName
      );
    }

    // Build hierarchical workflow structure
    const workflow = this.buildWorkflowTree(ast, nodes, scopeManager);

    return {
      bubbles: nodes,
      workflow,
      instanceMethodsLocation,
    };
  }

  private findDependenciesForBubble(
    currentDependencies: BubbleName[],
    bubbleFactory: BubbleFactory,
    parameters: BubbleParameter[],
    seen: Set<BubbleName> = new Set()
  ): BubbleName[] {
    const queue: BubbleName[] = [...currentDependencies];
    // Mark initial seeds as seen so they are not included in results
    for (const seed of currentDependencies) seen.add(seed);

    const result: BubbleName[] = [];

    while (queue.length > 0) {
      const name = queue.shift() as BubbleName;

      // If the bubble is an ai agent, add the tools to the dependencies
      if (name === 'ai-agent') {
        const toolsParam = parameters.find((param) => param.name === 'tools');
        const tools = toolsParam
          ? parseToolsParamValue(toolsParam.value)
          : null;
        if (Array.isArray(tools)) {
          for (const tool of tools) {
            if (
              tool &&
              typeof tool === 'object' &&
              typeof tool.name === 'string'
            ) {
              const toolName = tool.name as BubbleName;
              if (seen.has(toolName)) continue;
              seen.add(toolName);
              result.push(toolName);
              queue.push(toolName);
            }
          }
        }
      }

      const metadata = bubbleFactory.getMetadata(name) as
        | (ReturnType<BubbleFactory['getMetadata']> & {
            bubbleDependenciesDetailed?: {
              name: BubbleName;
              tools?: BubbleName[];
            }[];
          })
        | undefined;

      const detailed = metadata?.bubbleDependenciesDetailed || [];
      if (Array.isArray(detailed) && detailed.length > 0) {
        for (const spec of detailed) {
          const depName = spec.name as BubbleName;
          if (!seen.has(depName)) {
            seen.add(depName);
            result.push(depName);
            queue.push(depName);
          }
          // If this dependency is an AI agent with declared tools, include them as dependencies too
          if (depName === 'ai-agent' && Array.isArray(spec.tools)) {
            for (const toolName of spec.tools) {
              if (seen.has(toolName)) continue;
              seen.add(toolName);
              result.push(toolName);
              queue.push(toolName);
            }
          }
        }
      } else {
        // Fallback to flat dependencies
        const deps = metadata?.bubbleDependencies || [];
        for (const dep of deps) {
          const depName = dep as BubbleName;
          if (seen.has(depName)) continue;
          seen.add(depName);
          result.push(depName);
          queue.push(depName);
        }
      }
    }

    return result;
  }

  private buildDependencyGraph(
    bubbleName: BubbleName,
    bubbleFactory: BubbleFactory,
    seen: Set<BubbleName>,
    toolsForThisNode?: BubbleName[],
    parentUniqueId: string = '',
    ordinalCounters: Map<string, number> = new Map<string, number>(),
    usedVariableIds: Set<number> = new Set<number>(),
    explicitVariableId?: number,
    suppressSelfSegment: boolean = false,
    instanceVariableName?: string
  ): DependencyGraphNode {
    // Compute this node's uniqueId and variableId FIRST so even cycle hits have IDs
    const countKey = `${parentUniqueId}|${bubbleName}`;
    const nextOrdinal = (ordinalCounters.get(countKey) || 0) + 1;
    ordinalCounters.set(countKey, nextOrdinal);
    const uniqueId = suppressSelfSegment
      ? parentUniqueId
      : parentUniqueId && parentUniqueId.length > 0
        ? `${parentUniqueId}.${bubbleName}#${nextOrdinal}`
        : `${bubbleName}#${nextOrdinal}`;
    const variableId =
      typeof explicitVariableId === 'number'
        ? explicitVariableId
        : this.hashUniqueIdToVarId(uniqueId);

    const metadata = bubbleFactory.getMetadata(bubbleName);

    if (seen.has(bubbleName)) {
      return {
        name: bubbleName,
        nodeType: metadata?.type || 'unknown',
        uniqueId,
        variableId,
        variableName: instanceVariableName,
        dependencies: [],
      };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(bubbleName);

    const children: DependencyGraphNode[] = [];
    const detailed = metadata?.bubbleDependenciesDetailed;

    if (Array.isArray(detailed) && detailed.length > 0) {
      for (const spec of detailed) {
        const childName = spec.name;
        const toolsForChild = childName === 'ai-agent' ? spec.tools : undefined;
        const instancesArr = Array.isArray(spec.instances)
          ? spec.instances
          : [];
        const instanceCount = instancesArr.length > 0 ? instancesArr.length : 1;
        const nodeType =
          bubbleFactory.getMetadata(childName)?.type || 'unknown';
        for (let i = 0; i < instanceCount; i++) {
          const instVarName = instancesArr[i]?.variableName;
          // Special handling: avoid cycles when ai-agent appears again. If seen already has ai-agent
          // but we have tools to display, synthesize a child node with tool dependencies directly.
          if (
            childName === 'ai-agent' &&
            Array.isArray(toolsForChild) &&
            nextSeen.has('ai-agent' as BubbleName)
          ) {
            // Synthesize an ai-agent node under the current uniqueId with its own ordinal
            const aiCountKey = `${uniqueId}|ai-agent`;
            const aiOrdinal = (ordinalCounters.get(aiCountKey) || 0) + 1;
            ordinalCounters.set(aiCountKey, aiOrdinal);
            const aiAgentUniqueId = `${uniqueId}.ai-agent#${aiOrdinal}`;
            const aiAgentVarId = this.hashUniqueIdToVarId(aiAgentUniqueId);

            const toolChildren: DependencyGraphNode[] = [];
            for (const toolName of toolsForChild) {
              toolChildren.push(
                this.buildDependencyGraph(
                  toolName,
                  bubbleFactory,
                  nextSeen,
                  undefined,
                  aiAgentUniqueId,
                  ordinalCounters,
                  usedVariableIds,
                  undefined,
                  false,
                  toolName
                )
              );
            }
            children.push({
              name: 'ai-agent',
              uniqueId: aiAgentUniqueId,
              variableId: aiAgentVarId,
              variableName: instVarName,
              dependencies: toolChildren,
              nodeType,
            });
            continue;
          }

          children.push(
            this.buildDependencyGraph(
              childName,
              bubbleFactory,
              nextSeen,
              toolsForChild,
              uniqueId,
              ordinalCounters,
              usedVariableIds,
              undefined,
              false,
              instVarName
            )
          );
        }
      }
    } else {
      const directDeps = metadata?.bubbleDependencies || [];
      for (const dep of directDeps) {
        console.warn('No bubble detail dependency', dep);
        children.push(
          this.buildDependencyGraph(
            dep as BubbleName,
            bubbleFactory,
            nextSeen,
            undefined,
            uniqueId,
            ordinalCounters,
            usedVariableIds,
            undefined,
            false,
            'No bubble detail dependency'
          )
        );
      }
    }

    // Include dynamic tool dependencies for ai-agent at the root node
    if (bubbleName === 'ai-agent' && Array.isArray(toolsForThisNode)) {
      for (const toolName of toolsForThisNode) {
        if (nextSeen.has(toolName)) continue;
        // No variable name for tool, just use tool name
        children.push(
          this.buildDependencyGraph(
            toolName,
            bubbleFactory,
            nextSeen,
            undefined,
            uniqueId,
            ordinalCounters,
            usedVariableIds,
            undefined,
            false,
            toolName
          )
        );
      }
    }
    const nodeObj = {
      name: bubbleName,
      uniqueId,
      variableId,
      variableName: instanceVariableName,
      nodeType: metadata?.type || 'unknown',
      dependencies: children,
    };
    return nodeObj;
  }

  // Deterministic non-negative integer ID from uniqueId string
  private hashUniqueIdToVarId(input: string): number {
    let hash = 2166136261; // FNV-1a 32-bit offset basis
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 16777619) >>> 0; // unsigned 32-bit
    }
    // Map to 6-digit range to avoid colliding with small AST ids while readable
    const mapped = 100000 + (hash % 900000);
    return mapped;
  }

  /**
   * Build a JSON Schema object for the payload parameter of the top-level `handle` entrypoint.
   * Supports primitives, arrays, unions (anyOf), intersections (allOf), type literals, and
   * same-file interfaces/type aliases. Interface `extends` are ignored for now.
   */
  public getPayloadJsonSchema(
    ast: TSESTree.Program
  ): Record<string, unknown> | null {
    const handleNode = this.findHandleFunctionNode(ast);
    if (!handleNode) return null;

    const params: TSESTree.Parameter[] =
      handleNode.type === 'FunctionDeclaration' ||
      handleNode.type === 'FunctionExpression' ||
      handleNode.type === 'ArrowFunctionExpression'
        ? handleNode.params
        : [];

    if (!params || params.length === 0) return null;

    const firstParam = params[0];
    let typeAnn: TSESTree.TSTypeAnnotation | undefined;

    if (firstParam.type === 'Identifier') {
      typeAnn = firstParam.typeAnnotation || undefined;
    } else if (
      firstParam.type === 'AssignmentPattern' &&
      firstParam.left.type === 'Identifier'
    ) {
      typeAnn = firstParam.left.typeAnnotation || undefined;
    } else if (
      firstParam.type === 'RestElement' &&
      firstParam.argument.type === 'Identifier'
    ) {
      typeAnn = firstParam.argument.typeAnnotation || undefined;
    }

    if (!typeAnn) return {};

    const schema = this.tsTypeToJsonSchema(typeAnn.typeAnnotation, ast) || {};

    // Extract defaults from destructuring of the first parameter (e.g. const { a = 1 } = payload)
    const defaults = this.extractPayloadDefaultsFromHandle(handleNode);
    if (
      defaults &&
      schema &&
      typeof schema === 'object' &&
      (schema as Record<string, unknown>).properties &&
      typeof (schema as Record<string, unknown>).properties === 'object'
    ) {
      const props = (schema as { properties: Record<string, any> }).properties;
      for (const [key, defVal] of Object.entries(defaults)) {
        if (key in props && defVal !== undefined) {
          const current = props[key] as Record<string, unknown>;
          props[key] = { ...current, default: defVal };
        }
      }
    }

    return schema;
  }
  /**
   * Find the actual Function/ArrowFunction node corresponding to the handle entrypoint.
   */
  private findHandleFunctionNode(
    ast: TSESTree.Program
  ):
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
    | null {
    for (const stmt of ast.body) {
      if (stmt.type === 'FunctionDeclaration' && stmt.id?.name === 'handle') {
        return stmt;
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'FunctionDeclaration' &&
        stmt.declaration.id?.name === 'handle'
      ) {
        return stmt.declaration;
      }
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations) {
          if (
            d.id.type === 'Identifier' &&
            d.id.name === 'handle' &&
            d.init &&
            (d.init.type === 'ArrowFunctionExpression' ||
              d.init.type === 'FunctionExpression')
          ) {
            return d.init;
          }
        }
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'VariableDeclaration'
      ) {
        for (const d of stmt.declaration.declarations) {
          if (
            d.id.type === 'Identifier' &&
            d.id.name === 'handle' &&
            d.init &&
            (d.init.type === 'ArrowFunctionExpression' ||
              d.init.type === 'FunctionExpression')
          ) {
            return d.init;
          }
        }
      }
      if (stmt.type === 'ClassDeclaration') {
        const fn = this.findHandleInClass(stmt);
        if (fn) return fn;
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'ClassDeclaration'
      ) {
        const fn = this.findHandleInClass(stmt.declaration);
        if (fn) return fn;
      }
    }
    return null;
  }
  private findHandleInClass(
    cls: TSESTree.ClassDeclaration
  ): TSESTree.FunctionExpression | null {
    for (const member of cls.body.body) {
      if (
        member.type === 'MethodDefinition' &&
        member.key.type === 'Identifier' &&
        member.key.name === 'handle' &&
        member.value.type === 'FunctionExpression'
      ) {
        return member.value;
      }
    }
    return null;
  }
  /** Extract defaults from object destructuring of the first handle parameter */
  private extractPayloadDefaultsFromHandle(
    handleNode:
      | TSESTree.FunctionDeclaration
      | TSESTree.FunctionExpression
      | TSESTree.ArrowFunctionExpression
  ): Record<string, unknown> | null {
    const params = handleNode.params || [];
    if (params.length === 0) return null;

    const paramName = this.getFirstParamIdentifierName(params[0]);
    if (!paramName) return null;

    const body = handleNode.body;
    if (!body || body.type !== 'BlockStatement') return null;

    const defaults: Record<string, unknown> = {};

    for (const stmt of body.body) {
      if (stmt.type !== 'VariableDeclaration') continue;
      for (const decl of stmt.declarations) {
        if (
          decl.type === 'VariableDeclarator' &&
          decl.id.type === 'ObjectPattern' &&
          decl.init &&
          decl.init.type === 'Identifier' &&
          decl.init.name === paramName
        ) {
          for (const prop of decl.id.properties) {
            if (prop.type !== 'Property') continue;

            // Source property name on payload
            let keyName: string | null = null;
            if (prop.key.type === 'Identifier') keyName = prop.key.name;
            else if (
              prop.key.type === 'Literal' &&
              typeof prop.key.value === 'string'
            )
              keyName = prop.key.value;

            if (!keyName) continue;

            // Default value: { key = <expr> }
            if (prop.value.type === 'AssignmentPattern') {
              const defExpr = prop.value.right;
              const evaluated = this.evaluateDefaultExpressionToJSON(defExpr);
              if (evaluated !== undefined && !(keyName in defaults)) {
                defaults[keyName] = evaluated;
              }
            }
          }
        }
      }
    }

    return Object.keys(defaults).length > 0 ? defaults : null;
  }
  private getFirstParamIdentifierName(
    firstParam: TSESTree.Parameter
  ): string | null {
    if (firstParam.type === 'Identifier') return firstParam.name;
    if (
      firstParam.type === 'AssignmentPattern' &&
      firstParam.left.type === 'Identifier'
    ) {
      return firstParam.left.name;
    }
    if (
      firstParam.type === 'RestElement' &&
      firstParam.argument.type === 'Identifier'
    ) {
      return firstParam.argument.name;
    }
    return null;
  }
  /** Best-effort conversion of default expression to JSON-safe value */
  private evaluateDefaultExpressionToJSON(
    expr: TSESTree.Expression
  ): unknown | undefined {
    switch (expr.type) {
      case 'Literal':
        // string | number | boolean | null
        return (expr as any).value as unknown;
      case 'TemplateLiteral': {
        if (expr.expressions.length === 0) {
          // join cooked string parts
          const cooked = expr.quasis.map((q) => q.value.cooked || '').join('');
          return cooked;
        }
        return undefined;
      }
      case 'UnaryExpression': {
        if (
          (expr.operator === '-' || expr.operator === '+') &&
          expr.argument.type === 'Literal' &&
          typeof (expr.argument as any).value === 'number'
        ) {
          const num = (expr.argument as any).value as number;
          return expr.operator === '-' ? -num : +num;
        }
        if (expr.operator === '!' && expr.argument.type === 'Literal') {
          const val = (expr.argument as any).value;
          if (typeof val === 'boolean') return !val;
        }
        return undefined;
      }
      case 'ArrayExpression': {
        const out: unknown[] = [];
        for (const el of expr.elements) {
          if (!el || el.type !== 'Literal') return undefined;
          out.push((el as any).value as unknown);
        }
        return out;
      }
      case 'ObjectExpression': {
        const obj: Record<string, unknown> = {};
        for (const p of expr.properties) {
          if (p.type !== 'Property') return undefined;
          let pk: string | null = null;
          if (p.key.type === 'Identifier') pk = p.key.name;
          else if (p.key.type === 'Literal' && typeof p.key.value === 'string')
            pk = p.key.value;
          if (!pk) return undefined;
          if (p.value.type !== 'Literal') return undefined;
          obj[pk] = (p.value as any).value as unknown;
        }
        return obj;
      }
      default:
        return undefined;
    }
  }
  /** Convert a TS type AST node into a JSON Schema object */
  private tsTypeToJsonSchema(
    typeNode: TSESTree.TypeNode,
    ast: TSESTree.Program
  ): Record<string, unknown> | null {
    switch (typeNode.type) {
      case 'TSStringKeyword':
        return { type: 'string' };
      case 'TSNumberKeyword':
        return { type: 'number' };
      case 'TSBooleanKeyword':
        return { type: 'boolean' };
      case 'TSNullKeyword':
        return { type: 'null' };
      case 'TSAnyKeyword':
      case 'TSUnknownKeyword':
      case 'TSUndefinedKeyword':
        return {};
      case 'TSLiteralType': {
        const lit = typeNode.literal;
        if (lit.type === 'Literal') {
          return { const: lit.value as unknown } as Record<string, unknown>;
        }
        return {};
      }
      case 'TSArrayType': {
        const items = this.tsTypeToJsonSchema(typeNode.elementType, ast) || {};
        return { type: 'array', items };
      }
      case 'TSUnionType': {
        const anyOf = typeNode.types.map(
          (t) => this.tsTypeToJsonSchema(t, ast) || {}
        );
        return { anyOf };
      }
      case 'TSIntersectionType': {
        const allOf = typeNode.types.map(
          (t) => this.tsTypeToJsonSchema(t, ast) || {}
        );
        return { allOf };
      }
      case 'TSTypeLiteral': {
        return this.objectTypeToJsonSchema(typeNode, ast);
      }
      case 'TSIndexedAccessType': {
        // Handle BubbleTriggerEventRegistry['event/key'] → specific event schema
        const obj = typeNode.objectType;
        const idx = typeNode.indexType;
        if (
          obj.type === 'TSTypeReference' &&
          obj.typeName.type === 'Identifier' &&
          obj.typeName.name === 'BubbleTriggerEventRegistry' &&
          idx.type === 'TSLiteralType' &&
          idx.literal.type === 'Literal' &&
          typeof idx.literal.value === 'string'
        ) {
          const schema = this.eventKeyToSchema(
            idx.literal.value as keyof BubbleTriggerEventRegistry
          );
          if (schema) return schema;
        }
        return {};
      }
      case 'TSTypeReference': {
        const name = this.extractTypeReferenceName(typeNode);
        if (!name) return {};
        const resolved = this.resolveTypeNameToJson(name, ast);
        return resolved || {};
      }
      default:
        return {};
    }
  }
  private extractTypeReferenceName(
    ref: TSESTree.TSTypeReference
  ): string | null {
    if (ref.typeName.type === 'Identifier') return ref.typeName.name;
    return null;
  }
  private objectTypeToJsonSchema(
    node: TSESTree.TSTypeLiteral | TSESTree.TSInterfaceBody,
    ast: TSESTree.Program
  ): Record<string, unknown> {
    const elements = node.type === 'TSTypeLiteral' ? node.members : node.body;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const m of elements) {
      if (m.type !== 'TSPropertySignature') continue;
      let keyName: string | null = null;
      if (m.key.type === 'Identifier') keyName = m.key.name;
      else if (m.key.type === 'Literal' && typeof m.key.value === 'string')
        keyName = m.key.value;
      if (!keyName) continue;
      const propSchema = m.typeAnnotation
        ? this.tsTypeToJsonSchema(m.typeAnnotation.typeAnnotation, ast) || {}
        : {};

      // Extract comment/description for this property
      const description = this.extractCommentForNode(m);
      if (description) {
        propSchema.description = description;
      }

      properties[keyName] = propSchema;
      if (!m.optional) required.push(keyName);
    }
    const schema: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) schema.required = required;
    return schema;
  }

  // Minimal mapping for known trigger event keys to JSON Schema shapes
  // Used for the input schema in the BubbleFlow editor if defined as BubbleTriggerEventRegistry[eventType]
  private eventKeyToSchema(
    eventKey: keyof BubbleTriggerEventRegistry
  ): Record<string, unknown> | null {
    if (eventKey === 'slack/bot_mentioned') {
      return {
        type: 'object',
        properties: {
          text: { type: 'string' },
          channel: { type: 'string' },
          thread_ts: { type: 'string' },
          user: { type: 'string' },
          slack_event: { type: 'object' },
          // Allow additional field used in flows
          monthlyLimitError: {},
        },
        required: ['text', 'channel', 'user', 'slack_event'],
      };
    }
    if (eventKey === 'webhook/http') {
      return {
        type: 'object',
        properties: {
          body: { type: 'object' },
        },
      };
    }
    if (eventKey === 'schedule/cron') {
      return {
        type: 'object',
        properties: {
          body: { type: 'object' },
        },
      };
    }
    if (eventKey === 'slack/message_received') {
      return {
        type: 'object',
        properties: {
          text: { type: 'string' },
          channel: { type: 'string' },
          user: { type: 'string' },
          channel_type: { type: 'string' },
          slack_event: { type: 'object' },
        },
        required: ['text', 'channel', 'user', 'slack_event'],
      };
    }
    return null;
  }
  /** Resolve in-file interface/type alias by name to JSON Schema */
  private resolveTypeNameToJson(
    name: string,
    ast: TSESTree.Program
  ): Record<string, unknown> | null {
    for (const stmt of ast.body) {
      if (stmt.type === 'TSInterfaceDeclaration' && stmt.id.name === name) {
        return this.objectTypeToJsonSchema(stmt.body, ast);
      }
      if (stmt.type === 'TSTypeAliasDeclaration' && stmt.id.name === name) {
        return this.tsTypeToJsonSchema(stmt.typeAnnotation, ast) || {};
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'TSInterfaceDeclaration' &&
        stmt.declaration.id.name === name
      ) {
        return this.objectTypeToJsonSchema(stmt.declaration.body, ast);
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        stmt.declaration?.type === 'TSTypeAliasDeclaration' &&
        stmt.declaration.id.name === name
      ) {
        return (
          this.tsTypeToJsonSchema(stmt.declaration.typeAnnotation, ast) || {}
        );
      }
    }
    return null;
  }

  /**
   * Find the main class that extends BubbleFlow
   */
  private findMainBubbleFlowClass(
    ast: TSESTree.Program
  ): TSESTree.ClassDeclaration | null {
    for (const statement of ast.body) {
      let classDecl: TSESTree.ClassDeclaration | null = null;

      // Check exported class declarations
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'ClassDeclaration'
      ) {
        classDecl = statement.declaration;
      }
      // Check non-exported class declarations
      else if (statement.type === 'ClassDeclaration') {
        classDecl = statement;
      }

      if (classDecl) {
        // Check if this class extends BubbleFlow
        if (classDecl.superClass) {
          const superClass = classDecl.superClass;

          // Handle simple identifier like extends BubbleFlow
          if (
            superClass.type === 'Identifier' &&
            superClass.name === 'BubbleFlow'
          ) {
            return classDecl;
          }

          // Handle generic type like BubbleFlow<'webhook/http'>
          // Check if it's a TSTypeReference with type parameters
          // Use type assertion since TSESTree types may not fully expose this
          if ((superClass as any).type === 'TSTypeReference') {
            const typeName = (superClass as any).typeName;
            if (
              typeName &&
              typeName.type === 'Identifier' &&
              typeName.name === 'BubbleFlow'
            ) {
              return classDecl;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract all instance methods from a class
   */
  private findAllInstanceMethods(
    classDeclaration: TSESTree.ClassDeclaration
  ): Array<{
    methodName: string;
    startLine: number;
    endLine: number;
    definitionStartLine: number;
    bodyStartLine: number;
  }> {
    const methods: Array<{
      methodName: string;
      startLine: number;
      endLine: number;
      definitionStartLine: number;
      bodyStartLine: number;
    }> = [];

    if (!classDeclaration.body) return methods;

    for (const member of classDeclaration.body.body) {
      // Only process instance methods (not static, not getters/setters)
      if (
        member.type === 'MethodDefinition' &&
        !member.static &&
        member.kind === 'method' &&
        member.key.type === 'Identifier' &&
        member.value.type === 'FunctionExpression'
      ) {
        const methodName = member.key.name;
        const definitionStart = member.loc?.start.line || -1;
        const bodyStart = member.value.body?.loc?.start.line || definitionStart;
        const definitionEnd = member.loc?.end.line || -1;

        methods.push({
          methodName,
          startLine: definitionStart,
          endLine: definitionEnd,
          definitionStartLine: definitionStart,
          bodyStartLine: bodyStart,
        });
      }
    }

    return methods;
  }

  /**
   * Find all method invocations in the AST
   */
  private findMethodInvocations(
    ast: TSESTree.Program,
    methodNames: string[]
  ): Record<string, number[]> {
    const invocations: Record<string, Set<number>> = {};
    const methodNameSet = new Set(methodNames);
    const visitedNodes = new WeakSet<TSESTree.Node>();

    // Initialize invocations map with Sets to avoid duplicates
    for (const methodName of methodNames) {
      invocations[methodName] = new Set<number>();
    }

    const visitNode = (node: TSESTree.Node): void => {
      // Skip if already visited to avoid duplicate processing
      if (visitedNodes.has(node)) {
        return;
      }
      visitedNodes.add(node);

      // Look for CallExpression nodes
      if (node.type === 'CallExpression') {
        const callee = node.callee;

        // Check if it's a method call: this.methodName()
        if (callee.type === 'MemberExpression') {
          const object = callee.object;
          const property = callee.property;

          // Check if it's this.methodName() or await this.methodName()
          if (
            object.type === 'ThisExpression' &&
            property.type === 'Identifier' &&
            methodNameSet.has(property.name)
          ) {
            const lineNumber = node.loc?.start.line;
            if (lineNumber) {
              invocations[property.name].add(lineNumber);
            }
          }
        }
      }

      // Also check for await this.methodName()
      if (node.type === 'AwaitExpression' && node.argument) {
        visitNode(node.argument);
      }

      // Recursively visit child nodes
      this.visitChildNodesForInvocations(node, visitNode);
    };

    visitNode(ast);

    // Convert Sets to sorted Arrays
    const result: Record<string, number[]> = {};
    for (const [methodName, lineSet] of Object.entries(invocations)) {
      result[methodName] = Array.from(lineSet).sort((a, b) => a - b);
    }

    return result;
  }

  /**
   * Helper to recursively visit child nodes for finding invocations
   */
  private visitChildNodesForInvocations(
    node: TSESTree.Node,
    visitor: (node: TSESTree.Node) => void
  ): void {
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

  /**
   * Recursively visit AST nodes to find bubble instantiations
   */
  private visitNode(
    node: TSESTree.Node,
    nodes: Record<number, ParsedBubbleWithInfo>,
    classNameLookup: Map<
      string,
      { bubbleName: string; className: string; nodeType: BubbleNodeType }
    >,
    scopeManager: ScopeManager
  ): void {
    // Capture variable declarations
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (
          declarator.type === 'VariableDeclarator' &&
          declarator.id.type === 'Identifier' &&
          declarator.init
        ) {
          const nameText = declarator.id.name;
          const bubbleNode = this.extractBubbleFromExpression(
            declarator.init,
            classNameLookup
          );
          if (bubbleNode) {
            bubbleNode.variableName = nameText;

            // Extract comment for this bubble node
            const description = this.extractCommentForNode(node);
            if (description) {
              bubbleNode.description = description;
            }

            // Find the Variable object for this bubble declaration
            const variable = this.findVariableForBubble(
              nameText,
              node,
              scopeManager
            );
            if (variable) {
              bubbleNode.variableId = variable.$id;

              // Add variable references to parameters
              bubbleNode.parameters = this.addVariableReferencesToParameters(
                bubbleNode.parameters,
                node,
                scopeManager
              );

              nodes[variable.$id] = bubbleNode;
            } else {
              // Fallback: use variable name as key if Variable not found
              throw new Error(
                `Variable ${nameText} not found in scope manager`
              );
            }
          }
        }
      }
    }

    // Anonymous instantiations in expression statements
    if (node.type === 'ExpressionStatement') {
      const bubbleNode = this.extractBubbleFromExpression(
        node.expression,
        classNameLookup
      );
      if (bubbleNode) {
        const synthetic = `_anonymous_${bubbleNode.className}_${Object.keys(nodes).length}`;
        bubbleNode.variableName = synthetic;

        // Extract comment for this bubble node
        const description = this.extractCommentForNode(node);
        if (description) {
          bubbleNode.description = description;
        }

        // For anonymous bubbles, use negative synthetic ID (no Variable object exists)
        const syntheticId = -1 * (Object.keys(nodes).length + 1);
        bubbleNode.variableId = syntheticId;

        // Still add variable references to parameters (they can reference other variables)
        bubbleNode.parameters = this.addVariableReferencesToParameters(
          bubbleNode.parameters,
          node,
          scopeManager
        );

        nodes[syntheticId] = bubbleNode;
      }
    }

    // Arrow function concise body returning a bubble expression, e.g., (u) => new X({...}).action()
    if (
      node.type === 'ArrowFunctionExpression' &&
      node.body &&
      node.body.type !== 'BlockStatement'
    ) {
      const bubbleNode = this.extractBubbleFromExpression(
        node.body as TSESTree.Expression,
        classNameLookup
      );
      if (bubbleNode) {
        const synthetic = `_anonymous_${bubbleNode.className}_${Object.keys(nodes).length}`;
        bubbleNode.variableName = synthetic;

        const syntheticId = -1 * (Object.keys(nodes).length + 1);
        bubbleNode.variableId = syntheticId;

        bubbleNode.parameters = this.addVariableReferencesToParameters(
          bubbleNode.parameters,
          node,
          scopeManager
        );

        nodes[syntheticId] = bubbleNode;
      }
    }

    // Return statements returning a bubble expression inside function bodies
    if (node.type === 'ReturnStatement' && node.argument) {
      const bubbleNode = this.extractBubbleFromExpression(
        node.argument as TSESTree.Expression,
        classNameLookup
      );
      if (bubbleNode) {
        const synthetic = `_anonymous_${bubbleNode.className}_${Object.keys(nodes).length}`;
        bubbleNode.variableName = synthetic;

        // Extract comment for this bubble node
        const description = this.extractCommentForNode(node);
        if (description) {
          bubbleNode.description = description;
        }

        const syntheticId = -1 * (Object.keys(nodes).length + 1);
        bubbleNode.variableId = syntheticId;

        bubbleNode.parameters = this.addVariableReferencesToParameters(
          bubbleNode.parameters,
          node,
          scopeManager
        );

        nodes[syntheticId] = bubbleNode;
      }
    }

    // Recursively visit child nodes
    for (const key in node) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            this.visitNode(item as any, nodes, classNameLookup, scopeManager);
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        this.visitNode(child as any, nodes, classNameLookup, scopeManager);
      }
    }
  }

  /**
   * Find the Variable object corresponding to a bubble declaration
   */
  private findVariableForBubble(
    variableName: string,
    declarationNode: TSESTree.Node,
    scopeManager: ScopeManager
  ) {
    const line = declarationNode.loc?.start.line;
    if (!line) return null;

    // Find scopes that contain this line
    for (const scope of scopeManager.scopes) {
      const scopeStart = scope.block.loc?.start.line || 0;
      const scopeEnd = scope.block.loc?.end.line || 0;

      if (line >= scopeStart && line <= scopeEnd) {
        // Look for a variable with this name in this scope
        for (const variable of scope.variables) {
          if (variable.name === variableName) {
            // Check if this variable is declared on or near the same line
            const declLine = variable.defs[0]?.node?.loc?.start?.line;
            if (declLine && Math.abs(declLine - line) <= 2) {
              return variable;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Add variable ID references to parameters that are variables
   */
  private addVariableReferencesToParameters(
    parameters: ParsedBubble['parameters'],
    contextNode: TSESTree.Node,
    scopeManager: ScopeManager
  ): ParsedBubble['parameters'] {
    const contextLine = contextNode.loc?.start.line || 0;

    return parameters.map((param) => {
      if (param.type === 'variable') {
        const baseVariableName = this.extractBaseVariableName(
          param.value as string
        );
        if (baseVariableName) {
          const variableId = this.findVariableIdByName(
            baseVariableName,
            contextLine,
            scopeManager
          );
          if (variableId !== undefined) {
            return {
              ...param,
              variableId,
            };
          }
        }
      }
      return param;
    });
  }

  /**
   * Extract base variable name from expressions like "prompts[i]", "result.data"
   */
  private extractBaseVariableName(expression: string): string | null {
    const trimmed = expression.trim();

    // Handle array access: "prompts[i]" -> "prompts"
    const arrayMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\[/);
    if (arrayMatch) {
      return arrayMatch[1];
    }

    // Handle property access: "result.data" -> "result"
    const propertyMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\./);
    if (propertyMatch) {
      return propertyMatch[1];
    }

    // Handle simple variable: "myVar" -> "myVar"
    const simpleMatch = trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
    if (simpleMatch) {
      return trimmed;
    }

    return null;
  }

  /**
   * Find the Variable.$id for a variable name at a specific context line
   */
  private findVariableIdByName(
    variableName: string,
    contextLine: number,
    scopeManager: ScopeManager
  ): number | undefined {
    // Find ALL scopes that contain this line (not just the smallest)
    const containingScopes: Scope[] = [];

    for (const scope of scopeManager.scopes) {
      const scopeStart = scope.block.loc?.start.line || 0;
      const scopeEnd = scope.block.loc?.end.line || 0;

      if (contextLine >= scopeStart && contextLine <= scopeEnd) {
        containingScopes.push(scope);
      }
    }

    if (containingScopes.length === 0) {
      console.warn(
        `No scopes found containing line ${contextLine} for variable ${variableName}`
      );
      return undefined;
    }

    // Look through all containing scopes and their parents
    const allScopes = new Set<Scope>();
    for (const scope of containingScopes) {
      let currentScope = scope;
      while (currentScope) {
        allScopes.add(currentScope);
        if (!currentScope.upper) break;
        currentScope = currentScope.upper;
      }
    }

    // Search through all accessible scopes
    for (const scope of allScopes) {
      for (const variable of scope.variables) {
        if (variable.name === variableName) {
          // Check if this variable is declared before the context line
          const declLine = variable.defs[0]?.node?.loc?.start?.line;
          if (declLine && declLine <= contextLine) {
            return variable.$id;
          }
        }
      }
    }

    console.warn(
      `Variable ${variableName} not found or not declared before line ${contextLine}`
    );
    return undefined;
  }

  /**
   * Extract bubble information from an expression node
   */
  private extractBubbleFromExpression(
    expr: TSESTree.Expression,
    classNameLookup: Map<
      string,
      { bubbleName: string; className: string; nodeType: BubbleNodeType }
    >
  ): ParsedBubbleWithInfo | null {
    // await new X(...)
    if (expr.type === 'AwaitExpression') {
      const inner = this.extractBubbleFromExpression(
        expr.argument,
        classNameLookup
      );
      if (inner) inner.hasAwait = true;
      return inner;
    }

    // new X({...})
    if (expr.type === 'NewExpression') {
      return this.extractFromNewExpression(expr, classNameLookup);
    }

    // new X({...}).action() pattern
    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'MemberExpression'
    ) {
      const prop = expr.callee;
      if (
        prop.property.type === 'Identifier' &&
        prop.property.name === 'action' &&
        prop.object.type === 'NewExpression'
      ) {
        const node = this.extractFromNewExpression(
          prop.object,
          classNameLookup
        );
        if (node) node.hasActionCall = true;
        return node;
      }
    }

    return null;
  }

  /**
   * Extract bubble information from a NewExpression node
   */
  private extractFromNewExpression(
    newExpr: TSESTree.NewExpression,
    classNameLookup: Map<
      string,
      { bubbleName: string; className: string; nodeType: BubbleNodeType }
    >
  ): ParsedBubbleWithInfo | null {
    if (!newExpr.callee || newExpr.callee.type !== 'Identifier') return null;

    const className = newExpr.callee.name;
    const info = classNameLookup.get(className);
    if (!info) return null;

    const parameters: BubbleParameter[] = [];
    if (newExpr.arguments && newExpr.arguments.length > 0) {
      const firstArg = newExpr.arguments[0];
      if (firstArg.type === 'ObjectExpression') {
        for (const prop of firstArg.properties) {
          if (prop.type === 'Property') {
            if (
              prop.key.type === 'Identifier' &&
              'type' in prop.value &&
              prop.value.type !== 'AssignmentPattern'
            ) {
              const name = prop.key.name;
              const value = this.extractParameterValue(
                prop.value as TSESTree.Expression
              );

              // Extract location information for the parameter value
              const valueExpr = prop.value as TSESTree.Expression;
              const location = valueExpr.loc
                ? {
                    startLine: valueExpr.loc.start.line,
                    startCol: valueExpr.loc.start.column,
                    endLine: valueExpr.loc.end.line,
                    endCol: valueExpr.loc.end.column,
                  }
                : undefined;

              parameters.push({
                name,
                ...value,
                location,
                source: 'object-property', // Parameter came from an object literal property
              });
            }
          } else if (prop.type === 'SpreadElement') {
            // Capture spread elements like {...params} as a variable parameter
            const spreadArg = prop.argument as TSESTree.Expression;
            const value = this.extractParameterValue(spreadArg);

            const location = spreadArg.loc
              ? {
                  startLine: spreadArg.loc.start.line,
                  startCol: spreadArg.loc.start.column,
                  endLine: spreadArg.loc.end.line,
                  endCol: spreadArg.loc.end.column,
                }
              : undefined;

            // If the spread is an identifier, use its name as the parameter name; otherwise use a generic name
            const spreadName =
              spreadArg.type === 'Identifier' ? spreadArg.name : 'spread';

            parameters.push({
              name: spreadName,
              ...value,
              location,
              source: 'spread', // Changed from 'object-property' to 'spread'
            });
          }
        }
      } else {
        // Handle single variable parameter (e.g., new GoogleDriveBubble(config))
        const expr = firstArg as TSESTree.Expression;
        const value = this.extractParameterValue(expr);
        const location = expr.loc
          ? {
              startLine: expr.loc.start.line,
              startCol: expr.loc.start.column,
              endLine: expr.loc.end.line,
              endCol: expr.loc.end.column,
            }
          : undefined;

        const argName = expr.type === 'Identifier' ? expr.name : 'arg0';

        parameters.push({
          name: argName,
          ...value,
          location,
          source: 'first-arg', // Parameter represents the entire first argument
        });
      }
    }

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
        startLine: newExpr.loc?.start.line || 0,
        startCol: newExpr.loc?.start.column || 0,
        endLine: newExpr.loc?.end.line || 0,
        endCol: newExpr.loc?.end.column || 0,
      },
    };
  }

  /**
   * Extract parameter value and type from an expression
   */
  private extractParameterValue(expression: TSESTree.Expression): {
    value: string | number | boolean | Record<string, unknown> | unknown[];
    type: BubbleParameterType;
  } {
    const valueText = this.bubbleScript.substring(
      expression.range![0],
      expression.range![1]
    );

    // process.env detection (with or without non-null)
    const isProcessEnv = (text: string) => text.startsWith('process.env.');

    if (expression.type === 'TSNonNullExpression') {
      const inner = expression.expression;
      if (inner.type === 'MemberExpression') {
        const full = this.bubbleScript.substring(
          inner.range![0],
          inner.range![1]
        );
        if (isProcessEnv(full)) {
          return { value: valueText, type: BubbleParameterType.ENV };
        }
      }
    }

    if (
      expression.type === 'MemberExpression' ||
      expression.type === 'ChainExpression'
    ) {
      const full = valueText;
      if (isProcessEnv(full)) {
        return { value: full, type: BubbleParameterType.ENV };
      }
      return { value: full, type: BubbleParameterType.VARIABLE };
    }

    // Identifiers treated as variable references
    if (expression.type === 'Identifier') {
      return { value: valueText, type: BubbleParameterType.VARIABLE };
    }

    // Literals and structured
    if (expression.type === 'Literal') {
      if (typeof expression.value === 'string') {
        // Use expression.value to get the actual string without quotes
        return { value: expression.value, type: BubbleParameterType.STRING };
      }
      if (typeof expression.value === 'number') {
        return { value: valueText, type: BubbleParameterType.NUMBER };
      }
      if (typeof expression.value === 'boolean') {
        return { value: valueText, type: BubbleParameterType.BOOLEAN };
      }
    }

    if (expression.type === 'TemplateLiteral') {
      return { value: valueText, type: BubbleParameterType.STRING };
    }

    if (expression.type === 'ArrayExpression') {
      return { value: valueText, type: BubbleParameterType.ARRAY };
    }

    if (expression.type === 'ObjectExpression') {
      return { value: valueText, type: BubbleParameterType.OBJECT };
    }

    // Check for complex expressions (anything that's not a simple literal or identifier)
    // These are expressions that need to be evaluated rather than treated as literal values
    const simpleTypes = [
      'Literal',
      'Identifier',
      'MemberExpression',
      'TemplateLiteral',
      'ArrayExpression',
      'ObjectExpression',
    ];

    if (!simpleTypes.includes(expression.type)) {
      return { value: valueText, type: BubbleParameterType.EXPRESSION };
    }

    // Fallback
    return { value: valueText, type: BubbleParameterType.UNKNOWN };
  }

  /**
   * Extract comment/description for a node by looking at preceding comments
   **/
  private extractCommentForNode(node: TSESTree.Node): string | undefined {
    // Get the line number where this node starts
    const nodeLine = node.loc?.start.line;
    if (!nodeLine) return undefined;

    // Split the script into lines to find comments
    const lines = this.bubbleScript.split('\n');

    // Look backwards from the node line to find comments
    const commentLines: string[] = [];
    let currentLine = nodeLine - 1; // Start from the line before the node (0-indexed, but node.loc is 1-indexed)
    let isBlockComment = false;

    // Scan backwards to collect comment lines
    while (currentLine > 0) {
      const line = lines[currentLine - 1]?.trim(); // Convert to 0-indexed

      if (!line) {
        // Empty line - if we already have comments, stop here
        if (commentLines.length > 0) break;
        currentLine--;
        continue;
      }

      // Check for single-line comment (//)
      if (line.startsWith('//')) {
        commentLines.unshift(line);
        currentLine--;
        continue;
      }

      // Check if this line is part of a block comment
      if (
        line.startsWith('*') ||
        line.startsWith('/**') ||
        line.startsWith('/*')
      ) {
        commentLines.unshift(line);
        isBlockComment = true;
        currentLine--;
        continue;
      }

      // Check if this line ends a block comment
      if (line.endsWith('*/')) {
        commentLines.unshift(line);
        isBlockComment = true;
        currentLine--;
        // Continue collecting the rest of the comment block
        continue;
      }

      // If we've already collected some comment lines and hit a non-comment, stop
      if (commentLines.length > 0) {
        break;
      }

      // Otherwise, this might be code - stop looking
      break;
    }

    if (commentLines.length === 0) return undefined;

    // Join comment lines and extract the actual text
    const fullComment = commentLines.join('\n');

    let cleaned: string;

    if (isBlockComment) {
      // Extract text from JSDoc-style or block comments
      // Remove /** ... */ or /* ... */ wrappers and clean up
      cleaned = fullComment
        .replace(/^\/\*\*?\s*/, '') // Remove opening /** or /*
        .replace(/\s*\*\/\s*$/, '') // Remove closing */
        .split('\n')
        .map((line) => {
          // Remove leading * and whitespace from each line
          return line.replace(/^\s*\*\s?/, '').trim();
        })
        .filter((line) => line.length > 0) // Remove empty lines
        .join(' ') // Join into single line
        .trim();
    } else {
      // Handle single-line comments (//)
      cleaned = fullComment
        .split('\n')
        .map((line) => {
          // Remove leading // and whitespace from each line
          return line.replace(/^\/\/\s?/, '').trim();
        })
        .filter((line) => line.length > 0) // Remove empty lines
        .join(' ') // Join into single line
        .trim();
    }

    return cleaned || undefined;
  }

  /**
   * Build hierarchical workflow structure from AST
   */
  private buildWorkflowTree(
    ast: TSESTree.Program,
    bubbles: Record<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): ParsedWorkflow {
    const handleNode = this.findHandleFunctionNode(ast);
    if (!handleNode || handleNode.body.type !== 'BlockStatement') {
      // If no handle method or empty body, return empty workflow
      return {
        root: [],
        bubbles,
      };
    }

    const workflowNodes: WorkflowNode[] = [];
    const bubbleMap = new Map<number, ParsedBubbleWithInfo>();
    for (const [id, bubble] of Object.entries(bubbles)) {
      bubbleMap.set(Number(id), bubble);
    }

    // Process statements in handle method body
    for (const stmt of handleNode.body.body) {
      const node = this.buildWorkflowNodeFromStatement(
        stmt,
        bubbleMap,
        scopeManager
      );
      if (node) {
        workflowNodes.push(node);
      }
    }

    return {
      root: workflowNodes,
      bubbles,
    };
  }

  /**
   * Build a workflow node from an AST statement
   */
  private buildWorkflowNodeFromStatement(
    stmt: TSESTree.Statement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): WorkflowNode | null {
    // Handle IfStatement
    if (stmt.type === 'IfStatement') {
      return this.buildIfNode(stmt, bubbleMap, scopeManager);
    }

    // Handle ForStatement
    if (
      stmt.type === 'ForStatement' ||
      stmt.type === 'ForInStatement' ||
      stmt.type === 'ForOfStatement'
    ) {
      return this.buildForNode(stmt, bubbleMap, scopeManager);
    }

    // Handle WhileStatement
    if (stmt.type === 'WhileStatement') {
      return this.buildWhileNode(stmt, bubbleMap, scopeManager);
    }

    // Handle TryStatement
    if (stmt.type === 'TryStatement') {
      return this.buildTryCatchNode(stmt, bubbleMap, scopeManager);
    }

    // Handle VariableDeclaration - check if it's a bubble
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.init && decl.id.type === 'Identifier') {
          // Try to find bubble by variable name first (more reliable)
          const variableName = decl.id.name;
          const bubble = Array.from(bubbleMap.values()).find(
            (b) => b.variableName === variableName
          );
          if (bubble) {
            return {
              type: 'bubble',
              variableId: bubble.variableId,
            };
          }
          // Fallback to expression matching
          const bubbleFromExpr = this.findBubbleInExpression(
            decl.init,
            bubbleMap
          );
          if (bubbleFromExpr) {
            return {
              type: 'bubble',
              variableId: bubbleFromExpr.variableId,
            };
          }
        }
      }
      // If not a bubble, treat as code block
      return this.buildCodeBlockNode(stmt, bubbleMap, scopeManager);
    }

    // Handle ExpressionStatement - check if it's a bubble
    if (stmt.type === 'ExpressionStatement') {
      const bubble = this.findBubbleInExpression(stmt.expression, bubbleMap);
      if (bubble) {
        return {
          type: 'bubble',
          variableId: bubble.variableId,
        };
      }
      // If not a bubble, treat as code block
      return this.buildCodeBlockNode(stmt, bubbleMap, scopeManager);
    }

    // Handle ReturnStatement
    if (stmt.type === 'ReturnStatement') {
      if (stmt.argument) {
        const bubble = this.findBubbleInExpression(stmt.argument, bubbleMap);
        if (bubble) {
          return {
            type: 'bubble',
            variableId: bubble.variableId,
          };
        }
      }
      return this.buildCodeBlockNode(stmt, bubbleMap, scopeManager);
    }

    // Default: treat as code block
    return this.buildCodeBlockNode(stmt, bubbleMap, scopeManager);
  }

  /**
   * Build an if node from IfStatement
   */
  private buildIfNode(
    stmt: TSESTree.IfStatement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): ControlFlowWorkflowNode {
    const condition = this.extractConditionString(stmt.test);
    const location = this.extractLocation(stmt);

    const children: WorkflowNode[] = [];
    if (stmt.consequent.type === 'BlockStatement') {
      for (const childStmt of stmt.consequent.body) {
        const node = this.buildWorkflowNodeFromStatement(
          childStmt,
          bubbleMap,
          scopeManager
        );
        if (node) {
          children.push(node);
        }
      }
    } else {
      // Single statement (no braces)
      const node = this.buildWorkflowNodeFromStatement(
        stmt.consequent as TSESTree.Statement,
        bubbleMap,
        scopeManager
      );
      if (node) {
        children.push(node);
      }
    }

    const elseBranch: WorkflowNode[] | undefined = stmt.alternate
      ? (() => {
          if (stmt.alternate.type === 'BlockStatement') {
            const nodes: WorkflowNode[] = [];
            for (const childStmt of stmt.alternate.body) {
              const node = this.buildWorkflowNodeFromStatement(
                childStmt,
                bubbleMap,
                scopeManager
              );
              if (node) {
                nodes.push(node);
              }
            }
            return nodes;
          } else if (stmt.alternate.type === 'IfStatement') {
            // else if - treat as nested if
            const node = this.buildIfNode(
              stmt.alternate,
              bubbleMap,
              scopeManager
            );
            return [node];
          } else {
            // Single statement else
            const node = this.buildWorkflowNodeFromStatement(
              stmt.alternate as TSESTree.Statement,
              bubbleMap,
              scopeManager
            );
            return node ? [node] : [];
          }
        })()
      : undefined;

    return {
      type: 'if',
      location,
      condition,
      children,
      elseBranch,
    };
  }

  /**
   * Build a for node from ForStatement/ForInStatement/ForOfStatement
   */
  private buildForNode(
    stmt:
      | TSESTree.ForStatement
      | TSESTree.ForInStatement
      | TSESTree.ForOfStatement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): ControlFlowWorkflowNode {
    const location = this.extractLocation(stmt);
    let condition: string | undefined;

    if (stmt.type === 'ForStatement') {
      const init = stmt.init
        ? this.bubbleScript.substring(stmt.init.range![0], stmt.init.range![1])
        : '';
      const test = stmt.test
        ? this.bubbleScript.substring(stmt.test.range![0], stmt.test.range![1])
        : '';
      const update = stmt.update
        ? this.bubbleScript.substring(
            stmt.update.range![0],
            stmt.update.range![1]
          )
        : '';
      condition = `${init}; ${test}; ${update}`.trim();
    } else if (stmt.type === 'ForInStatement') {
      const left = this.bubbleScript.substring(
        stmt.left.range![0],
        stmt.left.range![1]
      );
      const right = this.bubbleScript.substring(
        stmt.right.range![0],
        stmt.right.range![1]
      );
      condition = `${left} in ${right}`;
    } else if (stmt.type === 'ForOfStatement') {
      const left = this.bubbleScript.substring(
        stmt.left.range![0],
        stmt.left.range![1]
      );
      const right = this.bubbleScript.substring(
        stmt.right.range![0],
        stmt.right.range![1]
      );
      condition = `${left} of ${right}`;
    }

    const children: WorkflowNode[] = [];
    if (stmt.body.type === 'BlockStatement') {
      for (const childStmt of stmt.body.body) {
        const node = this.buildWorkflowNodeFromStatement(
          childStmt,
          bubbleMap,
          scopeManager
        );
        if (node) {
          children.push(node);
        }
      }
    } else {
      // Single statement (no braces)
      const node = this.buildWorkflowNodeFromStatement(
        stmt.body as TSESTree.Statement,
        bubbleMap,
        scopeManager
      );
      if (node) {
        children.push(node);
      }
    }

    return {
      type: stmt.type === 'ForOfStatement' ? 'for' : 'for',
      location,
      condition,
      children,
    };
  }

  /**
   * Build a while node from WhileStatement
   */
  private buildWhileNode(
    stmt: TSESTree.WhileStatement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): ControlFlowWorkflowNode {
    const location = this.extractLocation(stmt);
    const condition = this.extractConditionString(stmt.test);

    const children: WorkflowNode[] = [];
    if (stmt.body.type === 'BlockStatement') {
      for (const childStmt of stmt.body.body) {
        const node = this.buildWorkflowNodeFromStatement(
          childStmt,
          bubbleMap,
          scopeManager
        );
        if (node) {
          children.push(node);
        }
      }
    } else {
      // Single statement (no braces)
      const node = this.buildWorkflowNodeFromStatement(
        stmt.body as TSESTree.Statement,
        bubbleMap,
        scopeManager
      );
      if (node) {
        children.push(node);
      }
    }

    return {
      type: 'while',
      location,
      condition,
      children,
    };
  }

  /**
   * Build a try-catch node from TryStatement
   */
  private buildTryCatchNode(
    stmt: TSESTree.TryStatement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): TryCatchWorkflowNode {
    const location = this.extractLocation(stmt);

    const children: WorkflowNode[] = [];
    if (stmt.block.type === 'BlockStatement') {
      for (const childStmt of stmt.block.body) {
        const node = this.buildWorkflowNodeFromStatement(
          childStmt,
          bubbleMap,
          scopeManager
        );
        if (node) {
          children.push(node);
        }
      }
    }

    const catchBlock: WorkflowNode[] | undefined = stmt.handler
      ? (() => {
          if (stmt.handler.body.type === 'BlockStatement') {
            const nodes: WorkflowNode[] = [];
            for (const childStmt of stmt.handler.body.body) {
              const node = this.buildWorkflowNodeFromStatement(
                childStmt,
                bubbleMap,
                scopeManager
              );
              if (node) {
                nodes.push(node);
              }
            }
            return nodes;
          }
          return [];
        })()
      : undefined;

    return {
      type: 'try_catch',
      location,
      children,
      catchBlock,
    };
  }

  /**
   * Build a code block node from a statement
   */
  private buildCodeBlockNode(
    stmt: TSESTree.Statement,
    bubbleMap: Map<number, ParsedBubbleWithInfo>,
    scopeManager: ScopeManager
  ): CodeBlockWorkflowNode | null {
    const location = this.extractLocation(stmt);
    if (!location) return null;

    const code = this.bubbleScript.substring(stmt.range![0], stmt.range![1]);

    // Check for nested structures
    const children: WorkflowNode[] = [];
    if (stmt.type === 'BlockStatement') {
      for (const childStmt of stmt.body) {
        const node = this.buildWorkflowNodeFromStatement(
          childStmt,
          bubbleMap,
          scopeManager
        );
        if (node) {
          children.push(node);
        }
      }
    }

    return {
      type: 'code_block',
      location,
      code,
      children,
    };
  }

  /**
   * Find a bubble in an expression by checking if it matches any parsed bubble
   */
  private findBubbleInExpression(
    expr: TSESTree.Expression,
    bubbleMap: Map<number, ParsedBubbleWithInfo>
  ): ParsedBubbleWithInfo | null {
    if (!expr.loc) return null;

    // Extract the NewExpression from the expression (handles await, .action(), etc.)
    const newExpr = this.extractNewExpression(expr);
    if (!newExpr || !newExpr.loc) return null;

    // Match by NewExpression location (this is what bubbles are stored with)
    for (const bubble of bubbleMap.values()) {
      // Check if the NewExpression location overlaps with bubble location
      // Use a tolerance for column matching since the exact column might differ slightly
      if (
        bubble.location.startLine === newExpr.loc.start.line &&
        bubble.location.endLine === newExpr.loc.end.line &&
        Math.abs(bubble.location.startCol - newExpr.loc.start.column) <= 5
      ) {
        return bubble;
      }
    }

    return null;
  }

  /**
   * Extract the NewExpression from an expression, handling await, .action(), etc.
   */
  private extractNewExpression(
    expr: TSESTree.Expression
  ): TSESTree.NewExpression | null {
    // Handle await new X()
    if (expr.type === 'AwaitExpression' && expr.argument) {
      return this.extractNewExpression(expr.argument);
    }

    // Handle new X().action()
    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'MemberExpression'
    ) {
      if (expr.callee.object) {
        return this.extractNewExpression(expr.callee.object);
      }
    }

    // Direct NewExpression
    if (expr.type === 'NewExpression') {
      return expr;
    }

    return null;
  }

  /**
   * Extract condition string from a test expression
   */
  private extractConditionString(test: TSESTree.Expression): string {
    return this.bubbleScript.substring(test.range![0], test.range![1]);
  }

  /**
   * Extract location from a node
   */
  private extractLocation(node: TSESTree.Node): {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  } {
    if (!node.loc) {
      return { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };
    }
    return {
      startLine: node.loc.start.line,
      startCol: node.loc.start.column,
      endLine: node.loc.end.line,
      endCol: node.loc.end.column,
    };
  }
}
