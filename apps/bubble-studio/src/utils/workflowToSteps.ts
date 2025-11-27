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
  bubbleIds: string[]; // IDs of bubbles inside this step
  controlFlowNodes: WorkflowNode[]; // if/for/while nodes for edge generation
  // Branch information for hierarchical layout
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
 * Recursively walks the workflow tree to build branch relationships
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

  interface ProcessContext {
    parentStepIds?: string[]; // Multiple parent step IDs for convergence
    branchType?: 'then' | 'else' | 'sequential';
    isElseIf?: boolean; // Track if this is part of else-if chain
    edgeLabel?: string; // Pre-determined edge label (for else-if chains)
  }

  /**
   * Process workflow nodes recursively, tracking branches
   * Returns an array of last step IDs (for handling convergence/merge points)
   */
  function processNodes(
    nodes: WorkflowNode[],
    context: ProcessContext = {}
  ): string[] {
    let lastStepIds: string[] = context.parentStepIds || [];

    for (const node of nodes) {
      if (node.type === 'function_call') {
        const functionCallNode = node as FunctionCallWorkflowNode;

        // Only process function calls with method definitions (class methods)
        if (!functionCallNode.methodDefinition) {
          continue;
        }

        // Extract bubbles and control flow nodes
        const bubbleIds = extractBubbleIdsByLineRange(
          functionCallNode.methodDefinition.location,
          bubbles
        );
        const controlFlowNodes = extractControlFlowNodes(
          functionCallNode.children || []
        );

        const stepId = `step-${stepCounter++}`;

        // Use the first parent for the step data (arbitrary choice)
        const parentStepId =
          lastStepIds.length > 0 ? lastStepIds[0] : undefined;

        const step: StepData = {
          id: stepId,
          functionName: functionCallNode.functionName,
          description: functionCallNode.description,
          isAsync: functionCallNode.methodDefinition.isAsync,
          location: functionCallNode.location,
          bubbleIds,
          controlFlowNodes,
          parentStepId,
          branchType: context.branchType,
          branchLabel: context.edgeLabel, // Use pre-determined label if provided
        };

        steps.push(step);

        // Create edges from ALL parent steps to this step (convergence/merge point)
        console.log(
          `[StepGraph] Creating step ${stepId} (${functionCallNode.functionName}) with ${lastStepIds.length} parent(s):`,
          lastStepIds
        );

        for (const sourceStepId of lastStepIds) {
          const edge: StepEdge = {
            sourceStepId,
            targetStepId: stepId,
            edgeType:
              context.branchType === 'sequential'
                ? 'sequential'
                : 'conditional',
            branchType: context.branchType,
          };

          // Use pre-determined label if provided (for else-if chains)
          if (context.edgeLabel) {
            edge.label = context.edgeLabel;
          }

          edges.push(edge);
          console.log(
            `[StepGraph]   Edge: ${sourceStepId} → ${stepId} (${edge.edgeType}, label: ${edge.label || 'none'})`
          );
        }

        // Update lastStepIds to point to this new step
        lastStepIds = [stepId];

        // Process children recursively (may contain if/else branches)
        if (functionCallNode.children && functionCallNode.children.length > 0) {
          processNodes(functionCallNode.children, {
            parentStepIds: [stepId],
            branchType: 'sequential',
          });
        }
      } else if (node.type === 'transformation_function') {
        // Handle transformation functions (inline code transformations)
        const transformationNode = node as unknown as {
          type: 'transformation_function';
          functionName: string;
          description?: string;
          code: string;
          arguments: string;
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
        const parentStepId =
          lastStepIds.length > 0 ? lastStepIds[0] : undefined;

        const step: StepData = {
          id: stepId,
          functionName: transformationNode.functionName,
          description: transformationNode.description,
          isAsync: transformationNode.methodDefinition?.isAsync ?? false,
          location: {
            startLine: transformationNode.location.startLine,
            endLine: transformationNode.location.endLine,
          },
          bubbleIds: [], // Transformations don't contain bubbles
          controlFlowNodes: [],
          parentStepId,
          branchType: context.branchType,
          branchLabel: context.edgeLabel,
          isTransformation: true,
          transformationData: {
            code: transformationNode.code,
            arguments: transformationNode.arguments,
            variableName: transformationNode.variableDeclaration?.variableName,
          },
        };

        steps.push(step);

        // Create edges from ALL parent steps to this step
        console.log(
          `[StepGraph] Creating transformation step ${stepId} (${transformationNode.functionName}) with ${lastStepIds.length} parent(s):`,
          lastStepIds
        );

        for (const sourceStepId of lastStepIds) {
          const edge: StepEdge = {
            sourceStepId,
            targetStepId: stepId,
            edgeType:
              context.branchType === 'sequential'
                ? 'sequential'
                : 'conditional',
            branchType: context.branchType,
          };

          if (context.edgeLabel) {
            edge.label = context.edgeLabel;
          }

          edges.push(edge);
          console.log(
            `[StepGraph]   Edge: ${sourceStepId} → ${stepId} (${edge.edgeType}, label: ${edge.label || 'none'})`
          );
        }

        // Update lastStepIds to point to this new step
        lastStepIds = [stepId];
      } else if (node.type === 'if') {
        const ifNode =
          node as import('@bubblelab/shared-schemas').ControlFlowWorkflowNode;

        const condition = ifNode.condition || 'condition';

        // Determine the label for the 'then' branch
        // If this is part of an else-if chain, use "else if", otherwise use "if"
        const thenLabel = context.isElseIf
          ? `else if ${condition}`
          : `if ${condition}`;

        // Collect last step IDs from all branches for convergence
        const branchEndSteps: string[] = [];

        // Process 'then' branch
        if (ifNode.children && ifNode.children.length > 0) {
          const thenLastSteps = processNodes(ifNode.children, {
            parentStepIds: lastStepIds, // Pass ALL parent step IDs
            branchType: 'then',
            edgeLabel: thenLabel,
          });

          branchEndSteps.push(...thenLastSteps);
        }

        // Process 'else' branch (could be else or else-if)
        if (ifNode.elseBranch && ifNode.elseBranch.length > 0) {
          // Check if else branch starts with another 'if' (else-if chain)
          const isElseIf =
            ifNode.elseBranch.length === 1 &&
            ifNode.elseBranch[0].type === 'if';

          if (isElseIf) {
            // For else-if, process the nested if with isElseIf flag
            // The nested if will handle its own labeling
            const elseLastSteps = processNodes(ifNode.elseBranch, {
              parentStepIds: lastStepIds, // Pass ALL parent step IDs
              branchType: 'then', // The else-if behaves like a then branch
              isElseIf: true,
            });

            branchEndSteps.push(...elseLastSteps);
          } else {
            // For pure else, process with "else" label
            const elseLastSteps = processNodes(ifNode.elseBranch, {
              parentStepIds: lastStepIds, // Pass ALL parent step IDs
              branchType: 'else',
              edgeLabel: 'else',
            });

            branchEndSteps.push(...elseLastSteps);
          }
        } else {
          // No else branch - the current lastStepIds could also be the end if the condition is false
          // (This represents the case where the if condition fails and we skip to the next statement)
          branchEndSteps.push(...lastStepIds);
        }

        // Update lastStepIds to ALL branch endings (convergence point)
        lastStepIds = branchEndSteps.length > 0 ? branchEndSteps : lastStepIds;

        // Debug: Log branch convergence
        console.log(
          `[StepGraph] After if/else, lastStepIds (convergence):`,
          lastStepIds
        );
      } else if (node.type === 'parallel_execution') {
        const parallelNode = node as ParallelExecutionWorkflowNode;

        // Track all parallel task steps
        const parallelStepIds: string[] = [];

        // Create a separate step for each direct child in Promise.all
        for (const child of parallelNode.children) {
          if (child.type === 'function_call') {
            const functionCallNode = child as FunctionCallWorkflowNode;

            if (!functionCallNode.methodDefinition) {
              continue;
            }

            const bubbleIds = extractBubbleIdsByLineRange(
              functionCallNode.methodDefinition.location,
              bubbles
            );
            const controlFlowNodes = extractControlFlowNodes(
              functionCallNode.children || []
            );

            const stepId = `step-${stepCounter++}`;
            const parentStepId =
              lastStepIds.length > 0 ? lastStepIds[0] : undefined;

            const step: StepData = {
              id: stepId,
              functionName: functionCallNode.functionName,
              description: functionCallNode.description,
              isAsync: functionCallNode.methodDefinition.isAsync,
              location: functionCallNode.location,
              bubbleIds,
              controlFlowNodes,
              parentStepId,
              branchType: 'then',
            };

            steps.push(step);

            // Create edges from all parent steps
            for (const sourceStepId of lastStepIds) {
              edges.push({
                sourceStepId,
                targetStepId: stepId,
                edgeType: 'sequential',
                branchType: 'sequential',
              });
            }

            parallelStepIds.push(stepId);
          }
        }

        // After parallel execution, all parallel steps are potential parents
        if (parallelStepIds.length > 0) {
          lastStepIds = parallelStepIds;
        }
      }
    }

    return lastStepIds;
  }

  // Process the workflow root
  processNodes(workflow.root);

  // Handle top-level bubbles (not inside any function call)
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
      branchType: 'sequential',
    };
    steps.unshift(mainStep);

    // Update edges to connect from main step
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

      // Extract bubbles by line range - includes ALL bubbles in the method
      // (even those in arrow functions, .map() callbacks, etc.)
      const bubbleIds = extractBubbleIdsByLineRange(
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

          // Extract bubbles by line range
          const bubbleIds = extractBubbleIdsByLineRange(
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
          });

          stepIndex++;
        } else if (child.type === 'bubble') {
          // Handle bubbles directly in Promise.all (less common)
          const bubbleId = String(child.variableId);
          const stepId = `step-${stepIndex}`;
          steps.push({
            id: stepId,
            functionName: 'Parallel Task',
            description: 'Bubble in Promise.all',
            isAsync: true,
            location: parallelNode.location,
            bubbleIds: [bubbleId],
            controlFlowNodes: [],
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
    });
  }

  return steps;
}

/**
 * Extract bubble IDs from workflow node children
 * Recursively searches for nodes of type 'bubble'
 */
function extractBubbleIdsFromChildren(children: WorkflowNode[]): string[] {
  const bubbleIds: string[] = [];

  for (const child of children) {
    if (child.type === 'bubble') {
      // Bubble nodes have variableId
      bubbleIds.push(String(child.variableId));
    } else if ('children' in child && Array.isArray(child.children)) {
      // Recursively search in nested children (e.g., inside if/for blocks)
      bubbleIds.push(...extractBubbleIdsFromChildren(child.children));
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
): string[] {
  const bubbleIds: string[] = [];

  for (const bubble of Object.values(allBubbles)) {
    if (
      bubble.location.startLine >= location.startLine &&
      bubble.location.endLine <= location.endLine
    ) {
      bubbleIds.push(String(bubble.variableId));
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
): string[] {
  // Get all bubble IDs that are inside function calls or parallel execution
  const bubblesInSteps = new Set<string>();

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

  // Find bubbles not in steps
  const topLevelBubbleIds: string[] = [];
  for (const [id, bubble] of Object.entries(bubbles)) {
    const bubbleId = String(bubble.variableId || id);
    if (!bubblesInSteps.has(bubbleId)) {
      topLevelBubbleIds.push(bubbleId);
    }
  }

  return topLevelBubbleIds;
}
