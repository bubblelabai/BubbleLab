import type {
  ParsedWorkflow,
  ParsedBubbleWithInfo,
  WorkflowNode,
  FunctionCallWorkflowNode,
  ParallelExecutionWorkflowNode,
} from '@bubblelab/shared-schemas';

export interface StepData {
  id: string;
  functionName: string;
  description?: string;
  isAsync: boolean;
  location: { startLine: number; endLine: number };
  bubbleIds: number[]; // IDs of bubbles inside this step
  controlFlowNodes: WorkflowNode[]; // if/for/while nodes for edge generation

  // New: layout / structural metadata
  level: number; // 0,1,2,... step “row” in the flow
  branchIndex?: number; // 0,1,2,... within a level (for siblings)

  // Branch information for hierarchical layout (kept for compatibility)
  parentStepId?: string; // Parent step in the flow (or undefined for root)
  branchType?: 'then' | 'else' | 'sequential'; // Type of connection to parent
  branchCondition?: string; // Condition text for conditional branches
  branchLabel?: string; // Display label for the edge (e.g., "if x > 0", "else")

  // Transformation-specific data
  isTransformation?: boolean;
  transformationData?: {
    code: string;
    arguments: string;
    variableName?: string;
    variableId?: number;
  };
}

// Graph structure to track step relationships
export interface StepGraph {
  steps: StepData[];
  edges: StepEdge[];
}

export interface StepEdge {
  sourceStepId: string;
  targetStepId: string;
  edgeType: 'sequential' | 'conditional';
  label?: string; // e.g., "if x > 0", "else if y < 5", "else"
  branchType?: 'then' | 'else' | 'sequential';
}

/**
 * Extract steps with control flow graph from ParsedWorkflow
 * Level-based: steps at the same depth share a level, edges only go between adjacent levels.
 */
export function extractStepGraph(
  workflow: ParsedWorkflow | undefined,
  bubbles: Record<number, ParsedBubbleWithInfo>
): StepGraph {
  if (!workflow || !workflow.root) {
    return { steps: [], edges: [] };
  }

  const steps: StepData[] = [];
  const edges: StepEdge[] = [];
  let stepCounter = 0;

  type BranchType = 'then' | 'else' | 'sequential';

  interface Frontier {
    level: number;
    parents: string[]; // step IDs at previous level that can lead into the next node(s)
  }

  interface ProcessContext {
    frontier: Frontier;
    // For conditional labeling
    branchType?: BranchType;
    edgeLabel?: string;
    isElseIf?: boolean;
  }

  function createStepBase(
    id: string,
    level: number,
    functionName: string,
    description: string | undefined,
    isAsync: boolean,
    location: { startLine: number; endLine: number },
    bubbleIds: number[],
    controlFlowNodes: WorkflowNode[],
    parentFrontier: Frontier,
    ctx: ProcessContext
  ): StepData {
    const parentStepId =
      parentFrontier.parents.length > 0 ? parentFrontier.parents[0] : undefined;

    const step: StepData = {
      id,
      functionName,
      description,
      isAsync,
      location,
      bubbleIds,
      controlFlowNodes,
      level,
      parentStepId,
      branchType: ctx.branchType,
      branchLabel: ctx.edgeLabel,
    };

    return step;
  }

  function connectFrontierToStep(
    sourceFrontier: Frontier,
    targetStepId: string,
    ctx: ProcessContext
  ) {
    const edgeType: StepEdge['edgeType'] =
      ctx.branchType === 'sequential' || !ctx.branchType
        ? 'sequential'
        : 'conditional';

    for (const sourceStepId of sourceFrontier.parents) {
      const edge: StepEdge = {
        sourceStepId,
        targetStepId,
        edgeType,
        branchType: ctx.branchType ?? 'sequential',
      };

      if (ctx.edgeLabel) {
        edge.label = ctx.edgeLabel;
      }

      edges.push(edge);
      // eslint-disable-next-line no-console
      console.log(
        `[StepGraph]   Edge: ${sourceStepId} → ${targetStepId} (${edge.edgeType}, label: ${edge.label || 'none'})`
      );
    }
  }

  function processNodes(nodes: WorkflowNode[], ctx: ProcessContext): Frontier {
    let frontier = ctx.frontier;

    for (const node of nodes) {
      if (node.type === 'function_call') {
        const functionCallNode = node as FunctionCallWorkflowNode;
        if (!functionCallNode.methodDefinition) {
          continue;
        }

        const stepId = `step-${stepCounter++}`;
        const stepLevel = frontier.level;

        const childBubbleIds = extractBubbleIdsFromChildren(
          functionCallNode.children || []
        );
        const bubbleIds =
          childBubbleIds.length > 0 && functionCallNode.isMethodCall
            ? childBubbleIds
            : extractBubbleIdsByLineRange(
                functionCallNode.methodDefinition.location,
                bubbles
              );
        const controlFlowNodes = extractControlFlowNodes(
          functionCallNode.children || []
        );

        const step = createStepBase(
          stepId,
          stepLevel,
          functionCallNode.functionName,
          functionCallNode.description,
          functionCallNode.methodDefinition.isAsync,
          functionCallNode.location,
          bubbleIds,
          controlFlowNodes,
          frontier,
          ctx
        );
        steps.push(step);

        connectFrontierToStep(frontier, stepId, ctx);

        frontier = { level: stepLevel, parents: [stepId] };

        if (functionCallNode.children && functionCallNode.children.length > 0) {
          frontier = processNodes(functionCallNode.children, {
            frontier: { level: stepLevel + 1, parents: [stepId] },
            branchType: 'sequential',
          });
        }
      } else if (node.type === 'transformation_function') {
        const transformationNode = node as unknown as {
          type: 'transformation_function';
          functionName: string;
          description?: string;
          code: string;
          arguments: string;
          variableId: number;
          location: {
            startLine: number;
            endLine: number;
            startCol: number;
            endCol: number;
          };
          isMethodCall: boolean;
          methodDefinition?: {
            location: { startLine: number; endLine: number };
            isAsync: boolean;
            parameters: string[];
          };
          variableDeclaration?: {
            variableName: string;
            variableType: string;
          };
        };

        const stepId = `step-${stepCounter++}`;
        const stepLevel = frontier.level;

        const step: StepData = {
          id: stepId,
          functionName: transformationNode.functionName,
          description: transformationNode.description,
          isAsync: transformationNode.methodDefinition?.isAsync ?? false,
          location: {
            startLine: transformationNode.location.startLine,
            endLine: transformationNode.location.endLine,
          },
          bubbleIds: [],
          controlFlowNodes: [],
          level: stepLevel,
          parentStepId:
            frontier.parents.length > 0 ? frontier.parents[0] : undefined,
          branchType: ctx.branchType,
          branchLabel: ctx.edgeLabel,
          isTransformation: true,
          transformationData: {
            code: transformationNode.code,
            arguments: transformationNode.arguments,
            variableName: transformationNode.variableDeclaration?.variableName,
            variableId: transformationNode.variableId,
          },
        };

        steps.push(step);
        connectFrontierToStep(frontier, stepId, ctx);
        frontier = { level: stepLevel, parents: [stepId] };
      } else if (node.type === 'if') {
        const ifNode =
          node as import('@bubblelab/shared-schemas').ControlFlowWorkflowNode;

        const condition = ifNode.condition || 'condition';
        const thenLabel = ctx.isElseIf
          ? `else if ${condition}`
          : `if ${condition}`;

        const branchLevel = frontier.level + 1;
        const branchEndParents: string[] = [];

        // THEN branch
        if (ifNode.children && ifNode.children.length > 0) {
          const thenFrontier = processNodes(ifNode.children, {
            frontier: { level: branchLevel, parents: frontier.parents },
            branchType: 'then',
            edgeLabel: thenLabel,
          });
          branchEndParents.push(...thenFrontier.parents);
        }

        // ELSE / ELSE-IF branch
        if (ifNode.elseBranch && ifNode.elseBranch.length > 0) {
          const isElseIf =
            ifNode.elseBranch.length === 1 &&
            ifNode.elseBranch[0].type === 'if';

          if (isElseIf) {
            const elseIfFrontier = processNodes(ifNode.elseBranch, {
              frontier: { level: branchLevel, parents: frontier.parents },
              branchType: 'then',
              isElseIf: true,
            });
            branchEndParents.push(...elseIfFrontier.parents);
          } else {
            const elseFrontier = processNodes(ifNode.elseBranch, {
              frontier: { level: branchLevel, parents: frontier.parents },
              branchType: 'else',
              edgeLabel: 'else',
            });
            branchEndParents.push(...elseFrontier.parents);
          }
        }

        // If no branch produced any steps, fall back to original parents
        const uniqueParents = Array.from(new Set(branchEndParents));
        if (uniqueParents.length > 0) {
          frontier = { level: branchLevel, parents: uniqueParents };
        }

        // eslint-disable-next-line no-console
        console.log(
          `[StepGraph] After if/else, frontier level=${frontier.level}, parents=`,
          frontier.parents
        );
      } else if (node.type === 'for' || node.type === 'while') {
        const loopNode =
          node as import('@bubblelab/shared-schemas').ControlFlowWorkflowNode;

        if (loopNode.children && loopNode.children.length > 0) {
          const loopFrontier = processNodes(loopNode.children, {
            frontier: { level: frontier.level + 1, parents: frontier.parents },
            branchType: 'sequential',
          });

          const mergedParents = new Set([
            ...frontier.parents,
            ...loopFrontier.parents,
          ]);
          frontier = {
            level: Math.max(frontier.level, loopFrontier.level),
            parents: Array.from(mergedParents),
          };
        }
      } else if (node.type === 'parallel_execution') {
        const parallelNode = node as ParallelExecutionWorkflowNode;
        const parallelLevel = frontier.level + 1;

        const parallelParents: string[] = [];

        for (const child of parallelNode.children) {
          if (child.type === 'function_call') {
            const fnChild = child as FunctionCallWorkflowNode;
            if (!fnChild.methodDefinition) continue;

            const stepId = `step-${stepCounter++}`;
            const childBubbleIds = extractBubbleIdsFromChildren(
              fnChild.children || []
            );
            const bubbleIds =
              childBubbleIds.length > 0 && fnChild.isMethodCall
                ? childBubbleIds
                : extractBubbleIdsByLineRange(
                    fnChild.methodDefinition.location,
                    bubbles
                  );
            const controlFlowNodes = extractControlFlowNodes(
              fnChild.children || []
            );

            const parentFrontier: Frontier = {
              level: parallelLevel - 1,
              parents: frontier.parents,
            };

            const step = createStepBase(
              stepId,
              parallelLevel,
              fnChild.functionName,
              fnChild.description,
              fnChild.methodDefinition.isAsync,
              fnChild.location,
              bubbleIds,
              controlFlowNodes,
              parentFrontier,
              { frontier, branchType: 'sequential' }
            );
            steps.push(step);
            connectFrontierToStep(
              { level: parallelLevel - 1, parents: frontier.parents },
              stepId,
              { frontier, branchType: 'sequential' }
            );
            parallelParents.push(stepId);
          }
        }

        if (parallelParents.length > 0) {
          frontier = { level: parallelLevel, parents: parallelParents };
        }
      }
    }

    return frontier;
  }

  const initialFrontier: Frontier = { level: 0, parents: [] };
  processNodes(workflow.root, {
    frontier: initialFrontier,
    branchType: 'sequential',
  });

  const topLevelBubbleIds = extractTopLevelBubbles(workflow, bubbles);
  if (topLevelBubbleIds.length > 0) {
    const mainStep: StepData = {
      id: 'step-main',
      functionName: 'Main Flow',
      description: 'Top-level bubble instantiations',
      isAsync: false,
      location: { startLine: 0, endLine: 0 },
      bubbleIds: topLevelBubbleIds,
      controlFlowNodes: [],
      level: 0,
      branchType: 'sequential',
    };
    steps.unshift(mainStep);

    if (steps.length > 1) {
      edges.unshift({
        sourceStepId: 'step-main',
        targetStepId: steps[1].id,
        edgeType: 'sequential',
        branchType: 'sequential',
      });
    }
  }

  return { steps, edges };
}

/**
 * Extract steps from ParsedWorkflow (legacy function for backward compatibility)
 * Steps are function_call nodes with methodDefinition
 */
export function extractStepsFromWorkflow(
  workflow: ParsedWorkflow | undefined,
  bubbles: Record<number, ParsedBubbleWithInfo>
): StepData[] {
  if (!workflow || !workflow.root) {
    return [];
  }

  const steps: StepData[] = [];
  let stepIndex = 0;

  // Process each node in the workflow root
  for (const node of workflow.root) {
    if (node.type === 'function_call') {
      const functionCallNode = node as FunctionCallWorkflowNode;

      // Only process function calls with method definitions (class methods)
      if (!functionCallNode.methodDefinition) {
        continue;
      }

      const childBubbleIds = extractBubbleIdsFromChildren(
        functionCallNode.children || []
      );
      const bubbleIds =
        childBubbleIds.length > 0 && functionCallNode.isMethodCall
          ? childBubbleIds
          : extractBubbleIdsByLineRange(
              functionCallNode.methodDefinition.location,
              bubbles
            );

      // Extract control flow nodes (if/for/while) for edge generation
      const controlFlowNodes = extractControlFlowNodes(
        functionCallNode.children || []
      );

      const stepId = `step-${stepIndex}`;
      steps.push({
        id: stepId,
        functionName: functionCallNode.functionName,
        description: functionCallNode.description,
        isAsync: functionCallNode.methodDefinition.isAsync,
        location: functionCallNode.location,
        bubbleIds,
        controlFlowNodes,
        level: 0,
      });

      stepIndex++;
    } else if (node.type === 'parallel_execution') {
      const parallelNode = node as ParallelExecutionWorkflowNode;

      // Create a separate step for each direct child in Promise.all
      for (const child of parallelNode.children) {
        if (child.type === 'function_call') {
          const functionCallNode = child as FunctionCallWorkflowNode;

          // Only process function calls with method definitions
          if (!functionCallNode.methodDefinition) {
            continue;
          }

          const childBubbleIds = extractBubbleIdsFromChildren(
            functionCallNode.children || []
          );
          const bubbleIds =
            childBubbleIds.length > 0 && functionCallNode.isMethodCall
              ? childBubbleIds
              : extractBubbleIdsByLineRange(
                  functionCallNode.methodDefinition.location,
                  bubbles
                );

          // Extract control flow nodes
          const controlFlowNodes = extractControlFlowNodes(
            functionCallNode.children || []
          );

          const stepId = `step-${stepIndex}`;
          steps.push({
            id: stepId,
            functionName: functionCallNode.functionName,
            description: functionCallNode.description,
            isAsync: functionCallNode.methodDefinition.isAsync,
            location: functionCallNode.location,
            bubbleIds,
            controlFlowNodes,
            level: 0,
          });

          stepIndex++;
        } else if (child.type === 'bubble') {
          // Handle bubbles directly in Promise.all (less common)
          const bubbleId = child.variableId;
          const stepId = `step-${stepIndex}`;
          steps.push({
            id: stepId,
            functionName: 'Parallel Task',
            description: 'Bubble in Promise.all',
            isAsync: true,
            location: parallelNode.location,
            bubbleIds: [bubbleId],
            controlFlowNodes: [],
            level: 0,
          });

          stepIndex++;
        }
      }
    }
  }

  // Handle top-level bubbles (not inside any function call)
  const topLevelBubbleIds = extractTopLevelBubbles(workflow, bubbles);
  if (topLevelBubbleIds.length > 0) {
    steps.unshift({
      id: 'step-main',
      functionName: 'Main Flow',
      description: 'Top-level bubble instantiations',
      isAsync: false,
      location: { startLine: 0, endLine: 0 },
      bubbleIds: topLevelBubbleIds,
      controlFlowNodes: [],
      level: 0,
    });
  }

  return steps;
}

/**
 * Extract bubble IDs from workflow node children
 * Recursively searches for nodes of type 'bubble'
 */
function extractBubbleIdsFromChildren(children: WorkflowNode[]): number[] {
  const bubbleIds: number[] = [];

  for (const child of children) {
    if (child.type === 'bubble') {
      // Bubble nodes have variableId
      bubbleIds.push(child.variableId);
    } else if ('children' in child && Array.isArray(child.children)) {
      // Recursively search in nested children (e.g., inside if/for blocks)
      bubbleIds.push(...extractBubbleIdsFromChildren(child.children));
    }
    // Handle if/else branches - elseBranch contains else block bubbles
    if (
      child.type === 'if' &&
      'elseBranch' in child &&
      Array.isArray(child.elseBranch)
    ) {
      bubbleIds.push(...extractBubbleIdsFromChildren(child.elseBranch));
    }
    // Handle try/catch - catchBlock contains catch block bubbles
    if (
      child.type === 'try_catch' &&
      'catchBlock' in child &&
      Array.isArray(child.catchBlock)
    ) {
      bubbleIds.push(...extractBubbleIdsFromChildren(child.catchBlock));
    }
  }

  return bubbleIds;
}

/**
 * Extract bubble IDs by line range
 * Returns all bubbles that fall within the given line range
 */
function extractBubbleIdsByLineRange(
  location: { startLine: number; endLine: number },
  allBubbles: Record<number, ParsedBubbleWithInfo>
): number[] {
  const bubbleIds: number[] = [];

  for (const bubble of Object.values(allBubbles)) {
    if (
      bubble.location.startLine >= location.startLine &&
      bubble.location.endLine <= location.endLine
    ) {
      bubbleIds.push(bubble.variableId);
    }
  }

  return bubbleIds;
}

/**
 * Extract control flow nodes (if/for/while) for edge generation
 */
function extractControlFlowNodes(children: WorkflowNode[]): WorkflowNode[] {
  const controlFlowNodes: WorkflowNode[] = [];

  for (const child of children) {
    if (child.type === 'if' || child.type === 'for' || child.type === 'while') {
      controlFlowNodes.push(child);
    }
  }

  return controlFlowNodes;
}

/**
 * Find bubbles that are not inside any function call
 * These are top-level bubble instantiations
 * Recursively searches through all workflow nodes including if/else branches
 */
function extractTopLevelBubbles(
  workflow: ParsedWorkflow,
  bubbles: Record<number, ParsedBubbleWithInfo>
): number[] {
  // Get all bubble IDs that are inside function calls or parallel execution
  const bubblesInSteps = new Set<number>();

  /**
   * Recursively collect bubbles from all nodes
   */
  function collectBubblesInSteps(nodes: WorkflowNode[]): void {
    for (const node of nodes) {
      if (node.type === 'function_call') {
        const functionCallNode = node as FunctionCallWorkflowNode;
        if (functionCallNode.methodDefinition) {
          const ids = extractBubbleIdsFromChildren(
            functionCallNode.children || []
          );
          ids.forEach((id) => bubblesInSteps.add(id));
        }
      } else if (node.type === 'parallel_execution') {
        const parallelNode = node as ParallelExecutionWorkflowNode;
        const ids = extractBubbleIdsFromChildren(parallelNode.children || []);
        ids.forEach((id) => bubblesInSteps.add(id));
      } else if (node.type === 'if') {
        // Recursively search if/else branches
        const ifNode =
          node as import('@bubblelab/shared-schemas').ControlFlowWorkflowNode;
        if (ifNode.children) {
          collectBubblesInSteps(ifNode.children);
        }
        if (ifNode.elseBranch) {
          collectBubblesInSteps(ifNode.elseBranch);
        }
      } else if (node.type === 'for' || node.type === 'while') {
        // Recursively search loop bodies
        const loopNode =
          node as import('@bubblelab/shared-schemas').ControlFlowWorkflowNode;
        if (loopNode.children) {
          collectBubblesInSteps(loopNode.children);
        }
      } else if (node.type === 'try_catch') {
        // Recursively search try/catch blocks
        const tryCatchNode =
          node as import('@bubblelab/shared-schemas').TryCatchWorkflowNode;
        if (tryCatchNode.children) {
          collectBubblesInSteps(tryCatchNode.children);
        }
        if (tryCatchNode.catchBlock) {
          collectBubblesInSteps(tryCatchNode.catchBlock);
        }
      }
    }
  }

  // Collect all bubbles inside function calls (recursively)
  collectBubblesInSteps(workflow.root);

  const clonesReferencingOriginal = new Set<number>();
  for (const bubble of Object.values(bubbles)) {
    if (typeof bubble.clonedFromVariableId === 'number') {
      clonesReferencingOriginal.add(bubble.clonedFromVariableId);
    }
  }

  // Find bubbles not in steps
  const topLevelBubbleIds: number[] = [];
  for (const [id, bubble] of Object.entries(bubbles)) {
    const bubbleId = bubble.variableId || parseInt(id, 10);
    // Skips invocation clones, original bubbles
    if (
      clonesReferencingOriginal.has(bubbleId) ||
      bubblesInSteps.has(bubbleId)
    ) {
      continue;
    }
    topLevelBubbleIds.push(bubbleId);
  }

  return topLevelBubbleIds;
}
