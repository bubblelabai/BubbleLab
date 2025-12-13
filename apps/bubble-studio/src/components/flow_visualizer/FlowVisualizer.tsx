import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw } from 'lucide-react';
import BubbleNode from './nodes/BubbleNode';
import InputSchemaNode from './nodes/InputSchemaNode';
import StepContainerNode from './nodes/StepContainerNode';
import {
  calculateBubblePosition,
  calculateStepContainerHeight,
  calculateHeaderHeight,
  STEP_CONTAINER_LAYOUT,
} from './stepContainerUtils';
import { calculateSubbubblePositionWithContext } from './nodePositioning';
import { FLOW_LAYOUT } from './flowLayoutConstants';
import TransformationNode from './nodes/TransformationNode';
import type { TransformationNodeData } from './nodes/TransformationNode';
import type { BubbleNodeData } from './nodes/BubbleNode';
import type {
  DependencyGraphNode,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { extractStepGraph, type StepData } from '@/utils/workflowToSteps';
import { useExecutionStore, getExecutionStore } from '@/stores/executionStore';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useUIStore } from '@/stores/uiStore';
import { useEditor } from '@/hooks/useEditor';
import CronScheduleNode from './nodes/CronScheduleNode';
import { useEditorStore } from '@/stores/editorStore';
import { getPearlChatStore } from '@/stores/pearlChatStore';
import { GeneratingOverlay } from './GeneratingOverlay';

// Keep backward compatibility - use the shared schema type
type ParsedBubble = ParsedBubbleWithInfo;

interface FlowVisualizerProps {
  flowId: number;
  onValidate?: () => void;
}

const nodeTypes = {
  bubbleNode: BubbleNode,
  inputSchemaNode: InputSchemaNode,
  cronScheduleNode: CronScheduleNode,
  stepContainerNode: StepContainerNode,
  transformationNode: TransformationNode,
};

const proOptions = { hideAttribution: true };

const sanitizeIdSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '') || 'segment';

// Executing bubble viewport preferences - now using FLOW_LAYOUT constants

// Edge label visibility
const SHOW_EDGE_LABELS = false; // Set to true to show conditional edge labels

function generateDependencyNodeId(
  dependencyNode: DependencyGraphNode,
  parentNodeId: string,
  path: string
): string {
  const candidate = (
    dependencyNode as DependencyGraphNode & { uniqueId?: string }
  ).uniqueId;
  if (candidate) {
    return candidate;
  }
  if (
    dependencyNode.variableId !== undefined &&
    dependencyNode.variableId !== null
  ) {
    return `dep-${dependencyNode.variableId}`;
  }
  const nameSegment = dependencyNode.name
    ? sanitizeIdSegment(dependencyNode.name)
    : 'dependency';
  const pathSegment = sanitizeIdSegment(path || '0');
  return `${parentNodeId}-${nameSegment}-${pathSegment}`;
}

// Inner component that has access to ReactFlow instance
function FlowVisualizerInner({ flowId, onValidate }: FlowVisualizerProps) {
  const { setCenter, getNode } = useReactFlow();

  // Get all data from global stores
  // Poll every 10 seconds when flow is in pending/generating state (code is empty and no error)
  const { data: currentFlow, loading } = useBubbleFlow(flowId, {
    refetchInterval: (query) => {
      // Check if flow is in pending/generating state
      const data = query.state.data;
      const isPending =
        data &&
        (!data.code || data.code.trim() === '') &&
        !data.generationError;
      // Poll every 10 seconds (10000ms) when pending, otherwise no polling
      return isPending ? 10000 : false;
    },
  });
  const { unsavedCode, setExecutionHighlight } = useEditor(flowId);
  // Select only needed execution store actions/state to avoid re-renders from events
  // Note: Individual nodes subscribe to their own state - FlowVisualizer only needs minimal state
  const setInputs = useExecutionStore(flowId, (s) => s.setInputs);
  const highlightedBubble = useExecutionStore(
    flowId,
    (s) => s.highlightedBubble
  );
  const isExecuting = useExecutionStore(flowId, (s) => s.isRunning);
  const runningBubbles = useExecutionStore(flowId, (s) => s.runningBubbles);
  const completedBubbles = useExecutionStore(flowId, (s) => s.completedBubbles);
  const executionInputs = useExecutionStore(flowId, (s) => s.executionInputs);
  const pendingCredentials = useExecutionStore(
    flowId,
    (s) => s.pendingCredentials
  );
  // Subscribe to expandedRootIds so nodes/edges sync when toggled
  const expandedRootIds = useExecutionStore(flowId, (s) => s.expandedRootIds);
  // Derive all state from global stores
  const bubbleParameters = currentFlow?.bubbleParameters || {};
  const requiredCredentials = currentFlow?.requiredCredentials || {};
  const flowName = currentFlow?.name;
  const inputsSchema = currentFlow?.inputSchema
    ? JSON.stringify(currentFlow.inputSchema)
    : undefined;

  // Track if the initial view has been set to avoid auto-repositioning
  const hasSetInitialView = useRef(false);

  // State for nodes and edges to enable dragging
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Store persisted positions for all nodes (both main and sub-bubbles)
  const persistedPositions = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );

  const eventType = currentFlow?.eventType;
  const entryNodeId =
    eventType === 'schedule/cron' ? 'cron-schedule-node' : 'input-schema-node';

  const bubbleEntries = useMemo(() => {
    const entries = Object.entries(bubbleParameters).sort(([, a], [, b]) => {
      const aStart = (a as ParsedBubble)?.location?.startLine ?? 0;
      const bStart = (b as ParsedBubble)?.location?.startLine ?? 0;
      return aStart - bStart;
    });
    // Drop original bubbles that were cloned for invocation context
    const clonedFromSet = new Set(
      entries
        .map(
          ([, bubble]) => (bubble as ParsedBubbleWithInfo)?.clonedFromVariableId
        )
        .filter((id): id is number => typeof id === 'number')
    );
    return entries.filter(([, bubble]) => {
      const typedBubble = bubble as ParsedBubbleWithInfo;
      if (typedBubble.invocationCallSiteKey) return true;
      if (clonedFromSet.has(typedBubble.variableId)) {
        return false;
      }
      return true;
    });
  }, [bubbleParameters]);

  // Track if we've initialized defaults for this flow to avoid loops
  const didInitDefaultsForFlow = useRef<number | null>(null);

  // Initialize execution inputs from defaults once per flow (avoid loops)
  useEffect(() => {
    const defaults = currentFlow?.defaultInputs || {};
    const hasDefaults = Object.keys(defaults).length > 0;
    const hasExisting = Object.keys(executionInputs || {}).length > 0;
    if (
      currentFlow?.id &&
      didInitDefaultsForFlow.current !== currentFlow.id &&
      !hasExisting &&
      hasDefaults
    ) {
      setInputs(defaults);
      didInitDefaultsForFlow.current = currentFlow.id;
    }
  }, [currentFlow?.id, currentFlow?.defaultInputs, executionInputs, setInputs]);

  // Check if there are unsaved input changes (comparing executionInputs with flow's defaultInputs)
  const hasUnsavedInputChanges =
    currentFlow?.defaultInputs && executionInputs
      ? JSON.stringify(executionInputs) !==
        JSON.stringify(currentFlow.defaultInputs)
      : false;

  // Extract saved credentials from bubbleParameters (similar to FlowIDEView.tsx)
  const savedCredentials: Record<string, Record<string, number>> = {};
  if (currentFlow?.bubbleParameters) {
    Object.entries(currentFlow.bubbleParameters).forEach(
      ([key, bubbleData]) => {
        const bubble = bubbleData as Record<string, unknown>;
        const credentialsParam = (
          bubble.parameters as
            | Array<{ name: string; type?: string; value?: unknown }>
            | undefined
        )?.find((param) => param.name === 'credentials');

        if (
          credentialsParam &&
          credentialsParam.type === 'object' &&
          credentialsParam.value
        ) {
          const credValue = credentialsParam.value as Record<string, unknown>;
          const bubbleCredentials: Record<string, number> = {};

          Object.entries(credValue).forEach(([credType, credId]) => {
            if (typeof credId === 'number') {
              bubbleCredentials[credType] = credId;
            }
          });

          if (Object.keys(bubbleCredentials).length > 0) {
            savedCredentials[key] = bubbleCredentials;
          }
        }
      }
    );
  }

  // Check if there are unsaved credential changes (comparing pendingCredentials with saved credentials)
  const hasUnsavedCredentialChanges =
    JSON.stringify(pendingCredentials) !== JSON.stringify(savedCredentials);

  // Combined unsaved changes: code changes OR input changes OR credential changes
  const hasUnsavedChanges =
    unsavedCode || hasUnsavedInputChanges || hasUnsavedCredentialChanges;

  // Auto-expand roots when execution starts (but don't auto-collapse when execution stops)
  // This prevents flicker when execution completes - sub-bubbles stay visible
  useEffect(() => {
    const executionStore = getExecutionStore(currentFlow?.id || flowId);
    const currentExpanded = executionStore.expandedRootIds;

    if (isExecuting) {
      const allRoots: number[] = [];
      bubbleEntries.forEach(([key, bubbleData]) => {
        const bubble = bubbleData as ParsedBubbleWithInfo;
        if (bubble.dependencyGraph?.dependencies?.length) {
          const nodeId = bubble.variableId ?? parseInt(key, 10);
          if (!isNaN(nodeId)) {
            allRoots.push(nodeId);
          }
        }
      });
      // Only update if the roots are different
      const rootsEqual =
        allRoots.length === currentExpanded.length &&
        allRoots.every((id) => currentExpanded.includes(id)) &&
        currentExpanded.every((id) => allRoots.includes(id));
      if (!rootsEqual) {
        executionStore.setExpandedRootIds(allRoots);
      }
    } else {
      // Only clear if not already empty
      if (currentExpanded.length > 0) {
        executionStore.setExpandedRootIds([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExecuting, bubbleEntries]);

  const { dependencyParentMap, dependencyCanonicalIdMap } = useMemo(() => {
    const parentMap = new Map<string, string | null>();
    const canonicalMap = new Map<string, string>();

    const registerNode = (nodeId: string, parentNodeId: string | null) => {
      parentMap.set(nodeId, parentNodeId);
      canonicalMap.set(nodeId, nodeId);
    };

    const traverse = (
      dependencyNode: DependencyGraphNode,
      parentNodeId: string,
      path: string
    ) => {
      const nodeId = generateDependencyNodeId(
        dependencyNode,
        parentNodeId,
        path
      );
      registerNode(nodeId, parentNodeId);
      if (
        dependencyNode.variableId !== undefined &&
        dependencyNode.variableId !== null
      ) {
        const varKey = String(dependencyNode.variableId);
        parentMap.set(varKey, parentNodeId);
        canonicalMap.set(varKey, nodeId);
      }

      dependencyNode.dependencies?.forEach((child, idx) => {
        const childPath = path ? `${path}-${idx}` : `${idx}`;
        traverse(child, nodeId, childPath);
      });
    };

    bubbleEntries.forEach(([key, bubbleData]) => {
      const bubble = bubbleData;
      const parentNodeId = bubble.variableId
        ? String(bubble.variableId)
        : String(key);

      registerNode(parentNodeId, null);

      if (!bubble.dependencyGraph?.dependencies?.length) {
        return;
      }

      bubble.dependencyGraph.dependencies.forEach((dep, idx) => {
        traverse(dep, parentNodeId, `${idx}`);
      });
    });

    return {
      dependencyParentMap: parentMap,
      dependencyCanonicalIdMap: canonicalMap,
    };
  }, [bubbleEntries]);

  const autoVisibleNodes = useMemo(() => {
    if (!highlightedBubble) {
      return new Set<string>();
    }
    const visible = new Set<string>();
    const visited = new Set<string>();

    let current: string | null =
      dependencyCanonicalIdMap.get(highlightedBubble) || highlightedBubble;

    while (current && !visited.has(current)) {
      visited.add(current);
      visible.add(current);
      const parent = dependencyParentMap.get(current);
      if (!parent) {
        break;
      }
      const canonicalParent = dependencyCanonicalIdMap.get(parent) || parent;
      visible.add(canonicalParent);
      current = canonicalParent;
    }

    return visible;
  }, [highlightedBubble, dependencyParentMap, dependencyCanonicalIdMap]);

  // Helper function to create nodes from dependency graph
  const createNodesFromDependencyGraph = useCallback(
    (
      dependencyNode: DependencyGraphNode,
      parentBubble: ParsedBubble,
      nodes: Node[],
      edges: Edge[],
      level: number = 0,
      parentNodeId?: string,
      siblingIndex: number = 0,
      siblingsTotal: number = 1,
      path: string = '',
      rootId: number = -1,
      usedHandlesMap?: Map<
        string,
        { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
      >
    ) => {
      const subBubble: ParsedBubble = {
        variableId: dependencyNode.variableId || -1,
        bubbleName: dependencyNode.name,
        variableName: dependencyNode.variableName || dependencyNode.name,
        className: `${dependencyNode.name}Bubble`,
        nodeType:
          (dependencyNode as DependencyGraphNode & { nodeType?: string })
            .nodeType || 'tool',
        hasAwait: false,
        hasActionCall: false,
        location: parentBubble.location,
        parameters: [],
        dependencyGraph: dependencyNode,
      };

      const parentIdForNode = parentNodeId
        ? parentNodeId
        : parentBubble.variableId
          ? String(parentBubble.variableId)
          : parentBubble.bubbleName;
      // Use the same ID format as regular bubbles: variableId if available, otherwise generate synthetic ID
      const nodeId =
        dependencyNode.variableId !== undefined &&
        dependencyNode.variableId !== null &&
        dependencyNode.variableId !== -1
          ? String(dependencyNode.variableId)
          : generateDependencyNodeId(dependencyNode, parentIdForNode, path);

      const isNodeAutoVisible = autoVisibleNodes.has(nodeId);
      // Read execution state directly from store (BubbleNode subscribes for UI updates)
      const executionState = getExecutionStore(currentFlow?.id || flowId);
      const rootExpanded = executionState.expandedRootIds.includes(rootId);
      const isRootSuppressed =
        executionState.suppressedRootIds.includes(rootId);
      const isExecutingLocal = executionState.isRunning;
      const shouldRender =
        isExecutingLocal ||
        ((rootExpanded || (isExecutingLocal && isNodeAutoVisible)) &&
          !isRootSuppressed);

      if (!shouldRender) {
        return;
      }

      const parentNode = parentNodeId
        ? nodes.find((n) => n.id === parentNodeId)
        : undefined;

      // Get all step container nodes for positioning context
      const allStepNodes = nodes.filter((n) => n.type === 'stepContainerNode');

      // Find container node if parent is inside a step container
      const containerNode = parentNode?.parentId
        ? nodes.find((n) => n.id === parentNode.parentId) || null
        : null;

      // Calculate position using the positioning utility
      const persistedPosition = persistedPositions.current.get(nodeId);
      const position = calculateSubbubblePositionWithContext(
        parentNode,
        containerNode,
        allStepNodes,
        siblingIndex,
        siblingsTotal,
        persistedPosition
      );

      // Note: Sub-bubbles will subscribe to their own execution state via BubbleNode

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position,
        draggable: true,
        zIndex: FLOW_LAYOUT.Z_INDEX.SUBBUBBLE_BASE + level, // Sub-bubbles appear above other nodes, deeper levels on top
        data: {
          flowId: currentFlow?.id || flowId,
          bubble: subBubble,
          bubbleKey: nodeId,
          onHighlightChange: () => {
            // BubbleNode will handle store updates
          },
          onBubbleClick: () => {},
          usedHandles: usedHandlesMap?.get(nodeId),
        },
      };
      nodes.push(node);

      if (parentNodeId && nodes.some((n) => n.id === parentNodeId)) {
        // Read highlightedBubble directly from store (already in dependency array for reactivity)
        const currentHighlighted = getExecutionStore(
          currentFlow?.id || flowId
        ).highlightedBubble;
        const isEdgeHighlighted =
          currentHighlighted === parentNodeId ||
          currentHighlighted === nodeId ||
          currentHighlighted === String(dependencyNode.variableId);
        edges.push({
          id: `${parentNodeId}-${nodeId}`,
          source: parentNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          style: {
            stroke: isEdgeHighlighted ? '#9333ea' : '#9ca3af',
            strokeWidth: isEdgeHighlighted ? 3 : 2,
          },
        });
      }

      dependencyNode.dependencies?.forEach((childDep, idx, arr) => {
        createNodesFromDependencyGraph(
          childDep,
          parentBubble,
          nodes,
          edges,
          level + 1,
          nodeId,
          idx,
          arr.length,
          path ? `${path}-${idx}` : `${idx}`,
          rootId,
          usedHandlesMap
        );
      });
    },
    [autoVisibleNodes, currentFlow, flowId]
  );

  // Generate within-step edges (connects bubbles vertically inside each step)
  const generateWithinStepEdges = useCallback(
    (
      steps: StepData[],
      bubbles: Record<number, ParsedBubbleWithInfo>,
      completedBubbles: Record<string, { totalTime: number; count: number }>,
      runningBubbles: Set<string>
    ): Edge[] => {
      const edges: Edge[] = [];

      for (const step of steps) {
        const stepBubbles = step.bubbleIds
          .map((id) => bubbles[id])
          .filter(Boolean)
          .sort((a, b) => a.location.startLine - b.location.startLine);

        // Connect each bubble to next in sequence (vertical flow)
        for (let i = 0; i < stepBubbles.length - 1; i++) {
          const source = stepBubbles[i];
          const target = stepBubbles[i + 1];

          const sourceNodeId = String(source.variableId);
          const targetNodeId = String(target.variableId);

          // Check if target bubble is executing or completed
          const targetKey = String(target.variableId);
          const isTargetExecuting = runningBubbles.has(targetKey);
          const isTargetCompleted = !!completedBubbles[targetKey];

          // Edge stays green once execution starts (either executing or completed)
          const isHighlighted = isTargetExecuting || isTargetCompleted;

          let edgeColor: string;
          let strokeWidth: number;
          let strokeDasharray: string | undefined;
          let strokeOpacity: number | undefined;

          if (isHighlighted) {
            // Highlighted edges: solid, thick, bright green
            edgeColor = '#22c55e'; // green-500
            strokeWidth = 3;
            strokeDasharray = undefined;
            strokeOpacity = 1;
          } else {
            // Non-highlighted edges: dashed, thin, subtle
            edgeColor = '#6b7280'; // gray-500
            strokeWidth = 1;
            strokeDasharray = '6,3';
            strokeOpacity = 0.4;
          }

          edges.push({
            id: `internal-${step.id}-${source.variableId}-to-${target.variableId}`,
            source: sourceNodeId,
            target: targetNodeId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'straight',
            animated: false,
            zIndex: isHighlighted ? 10 : 0, // Highlighted edges render on top
            style: {
              stroke: edgeColor,
              strokeWidth,
              strokeDasharray,
              strokeOpacity,
            },
          });
        }
      }

      return edges;
    },
    []
  );

  /**
   * Determine which steps are completed or executing based on bubble execution state
   * Returns a map of stepId -> { isCompleted: boolean, isExecuting: boolean }
   */
  const getStepExecutionState = useCallback(
    (
      steps: StepData[],
      completedBubbles: Record<string, { totalTime: number; count: number }>,
      runningBubbles: Set<string>
    ): Map<string, { isCompleted: boolean; isExecuting: boolean }> => {
      const stepState = new Map<
        string,
        { isCompleted: boolean; isExecuting: boolean }
      >();

      for (const step of steps) {
        let isCompleted = false;
        let isExecuting = false;

        // Check transformation steps
        if (step.isTransformation && step.transformationData?.variableId) {
          const transformationKey = String(step.transformationData.variableId);
          if (completedBubbles[transformationKey]) {
            isCompleted = true;
          }
          if (runningBubbles.has(transformationKey)) {
            isExecuting = true;
          }
        } else {
          // Check if any bubble in this step is completed
          for (const bubbleId of step.bubbleIds) {
            const bubbleKey = String(bubbleId);
            if (completedBubbles[bubbleKey]) {
              isCompleted = true;
              break;
            }
          }

          // Check if any bubble in this step is currently executing
          for (const bubbleId of step.bubbleIds) {
            const bubbleKey = String(bubbleId);
            if (runningBubbles.has(bubbleKey)) {
              isExecuting = true;
              break;
            }
          }
        }

        stepState.set(step.id, { isCompleted, isExecuting });
      }

      return stepState;
    },
    []
  );

  /**
   * Determine which edges should be highlighted based on step execution state
   * Traces the full execution path from start to executing/completed steps
   * Returns a map of edgeId -> { isCompleted: boolean, isExecuting: boolean }
   */
  const getEdgeHighlightState = useCallback(
    (
      stepEdges: Array<{ sourceStepId: string; targetStepId: string }>,
      stepState: Map<string, { isCompleted: boolean; isExecuting: boolean }>,
      steps: StepData[]
    ): Map<string, { isCompleted: boolean; isExecuting: boolean }> => {
      const edgeState = new Map<
        string,
        { isCompleted: boolean; isExecuting: boolean }
      >();

      // Build a map of stepId -> all incoming edges (for reverse traversal)
      const incomingEdgesMap = new Map<
        string,
        Array<{ sourceStepId: string; targetStepId: string }>
      >();
      for (const stepEdge of stepEdges) {
        if (!incomingEdgesMap.has(stepEdge.targetStepId)) {
          incomingEdgesMap.set(stepEdge.targetStepId, []);
        }
        incomingEdgesMap.get(stepEdge.targetStepId)!.push(stepEdge);
      }

      // Build a map of stepId -> step data for quick lookup
      const stepMap = new Map<string, StepData>();
      for (const step of steps) {
        stepMap.set(step.id, step);
      }

      // Find all steps that are executing or completed
      const executedSteps = new Set<string>();
      for (const [stepId, state] of stepState.entries()) {
        if (state.isExecuting || state.isCompleted) {
          executedSteps.add(stepId);
        }
      }

      // For each executed step, trace back the entire path to highlight all edges in the path
      const visitedSteps = new Set<string>();

      /**
       * Recursively trace back from a step to find all edges in its execution path
       * This ensures we highlight the entire branching path, not just the direct incoming edge
       */
      const tracePath = (stepId: string) => {
        if (visitedSteps.has(stepId)) {
          return;
        }
        visitedSteps.add(stepId);

        // Get all incoming edges to this step
        const incomingEdges = incomingEdgesMap.get(stepId) || [];

        for (const edge of incomingEdges) {
          const edgeId = `${edge.sourceStepId}-to-${edge.targetStepId}`;
          const targetState = stepState.get(edge.targetStepId);

          // Mark this edge as part of the execution path
          // Use the target step's state to determine if it's executing or completed
          edgeState.set(edgeId, {
            isCompleted: targetState?.isCompleted || false,
            isExecuting: targetState?.isExecuting || false,
          });

          // Recursively trace back from the source step to highlight the full path
          tracePath(edge.sourceStepId);
        }
      };

      // Trace path from all executed steps to highlight the entire execution path
      for (const stepId of executedSteps) {
        tracePath(stepId);
      }

      // Also mark direct edges to executed steps (in case they weren't caught by tracePath)
      for (const stepEdge of stepEdges) {
        const edgeId = `${stepEdge.sourceStepId}-to-${stepEdge.targetStepId}`;
        const targetState = stepState.get(stepEdge.targetStepId);

        if (
          targetState &&
          (targetState.isExecuting || targetState.isCompleted)
        ) {
          // This edge leads to an executed step, so it's part of the path
          if (!edgeState.has(edgeId)) {
            edgeState.set(edgeId, {
              isCompleted: targetState.isCompleted,
              isExecuting: targetState.isExecuting,
            });
          }
        }
      }

      // Initialize all edges (those not in the path remain unhighlighted)
      for (const stepEdge of stepEdges) {
        const edgeId = `${stepEdge.sourceStepId}-to-${stepEdge.targetStepId}`;
        if (!edgeState.has(edgeId)) {
          edgeState.set(edgeId, { isCompleted: false, isExecuting: false });
        }
      }

      return edgeState;
    },
    []
  );

  // Convert bubbles to React Flow nodes and edges
  const initialNodesAndEdges = () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const horizontalSpacing = FLOW_LAYOUT.SEQUENTIAL.HORIZONTAL_SPACING;
    const baseY = FLOW_LAYOUT.SEQUENTIAL.BASE_Y;
    const startX = FLOW_LAYOUT.SEQUENTIAL.START_X;

    // Determine entry bubble as the one with the smallest startLine
    let smallestStartLine = Number.POSITIVE_INFINITY;
    bubbleEntries.forEach(([, bubbleData]) => {
      const typedBubbleData = bubbleData as Partial<ParsedBubble>;
      const startLine =
        typedBubbleData?.location?.startLine ?? Number.MAX_SAFE_INTEGER;
      if (startLine < smallestStartLine) {
        smallestStartLine = startLine;
      }
    });

    // Parse input schema
    type SimpleField = {
      name: string;
      type?: string;
      required?: boolean;
      description?: string;
      default?: unknown;
      canBeFile?: boolean;
      properties?: Record<
        string,
        {
          type?: string;
          description?: string;
          default?: unknown;
          required?: boolean;
          canBeFile?: boolean;
        }
      >;
      requiredProperties?: string[];
    };
    const parsedFields: SimpleField[] = (() => {
      if (!inputsSchema) return [];
      try {
        const schema = JSON.parse(inputsSchema);
        const req: string[] = Array.isArray(schema.required)
          ? schema.required
          : [];
        const props = schema.properties || {};
        return Object.entries(props).map(([name, val]: [string, unknown]) => {
          const valObj = val as
            | {
                type?: string;
                description?: string;
                default?: unknown;
                canBeFile?: boolean;
                properties?: Record<
                  string,
                  {
                    type?: string;
                    description?: string;
                    default?: unknown;
                    canBeFile?: boolean;
                  }
                >;
                required?: string[];
              }
            | undefined;

          // Handle object types with properties (including nested objects)
          if (valObj?.type === 'object' && valObj.properties) {
            const objectRequired = Array.isArray(valObj.required)
              ? valObj.required
              : [];

            // Recursively process nested properties
            const processProperties = (
              props: Record<string, unknown>
            ): Record<
              string,
              {
                type?: string;
                description?: string;
                default?: unknown;
                required?: boolean;
                canBeFile?: boolean;
                properties?: Record<
                  string,
                  {
                    type?: string;
                    description?: string;
                    default?: unknown;
                    required?: boolean;
                    canBeFile?: boolean;
                  }
                >;
                requiredProperties?: string[];
              }
            > => {
              return Object.entries(props).reduce(
                (acc, [propName, propValue]) => {
                  const propSchema = propValue as {
                    type?: string;
                    description?: string;
                    default?: unknown;
                    canBeFile?: boolean;
                    properties?: Record<string, unknown>;
                    required?: string[];
                  };

                  // If this property is also an object, recursively process it
                  if (propSchema.type === 'object' && propSchema.properties) {
                    const nestedRequired = Array.isArray(propSchema.required)
                      ? propSchema.required
                      : [];
                    acc[propName] = {
                      type: propSchema.type,
                      description: propSchema.description,
                      default: propSchema.default,
                      required: objectRequired.includes(propName),
                      canBeFile: propSchema.canBeFile,
                      properties: processProperties(propSchema.properties),
                      requiredProperties: nestedRequired,
                    };
                  } else {
                    acc[propName] = {
                      type: propSchema?.type,
                      description: propSchema?.description,
                      default: propSchema?.default,
                      required: objectRequired.includes(propName),
                      canBeFile: propSchema?.canBeFile,
                    };
                  }
                  return acc;
                },
                {} as Record<
                  string,
                  {
                    type?: string;
                    description?: string;
                    default?: unknown;
                    required?: boolean;
                    canBeFile?: boolean;
                    properties?: Record<
                      string,
                      {
                        type?: string;
                        description?: string;
                        default?: unknown;
                        required?: boolean;
                        canBeFile?: boolean;
                      }
                    >;
                    requiredProperties?: string[];
                  }
                >
              );
            };

            return {
              name,
              type: valObj.type,
              required: req.includes(name),
              description: valObj.description,
              default: valObj.default,
              canBeFile: valObj.canBeFile,
              properties: processProperties(valObj.properties),
              requiredProperties: objectRequired,
            };
          }

          return {
            name,
            type: valObj?.type,
            required: req.includes(name),
            description: valObj?.description,
            default: (valObj as { default?: unknown } | undefined)?.default,
            canBeFile: valObj?.canBeFile,
          };
        });
      } catch {
        return [];
      }
    })();

    // Create entry node based on event type
    if (flowName) {
      if (eventType === 'schedule/cron') {
        // Create CronScheduleNode for cron events
        const entryNodeId = 'cron-schedule-node';
        const persistedEntryPos = persistedPositions.current.get(entryNodeId);
        const cronScheduleNode: Node = {
          id: entryNodeId,
          type: 'cronScheduleNode',
          position: persistedEntryPos || {
            x: startX - FLOW_LAYOUT.SEQUENTIAL.ENTRY_NODE_OFFSET,
            y: baseY,
          },
          origin: [0, 0.5] as [number, number],
          draggable: true,
          data: {
            flowId: currentFlow?.id || flowId,
            flowName: flowName,
            cronSchedule: currentFlow?.cron || '0 0 * * *',
            isActive: currentFlow?.cronActive || false,
            inputSchema: currentFlow?.inputSchema || {},
          },
        };
        nodes.push(cronScheduleNode);
      } else {
        // Create InputSchemaNode for regular flows (with or without input schema)
        const entryNodeId = 'input-schema-node';
        const persistedEntryPos = persistedPositions.current.get(entryNodeId);
        const inputSchemaNode: Node = {
          id: entryNodeId,
          type: 'inputSchemaNode',
          position: persistedEntryPos || {
            x: startX - FLOW_LAYOUT.SEQUENTIAL.ENTRY_NODE_OFFSET,
            y: baseY,
          },
          origin: [0, 0.5] as [number, number],
          draggable: true,
          data: {
            flowId: currentFlow?.id || flowId,
            flowName: flowName,
            schemaFields: parsedFields,
          },
        };
        nodes.push(inputSchemaNode);
      }
    }

    // Extract steps with control flow graph from workflow
    const stepGraph = extractStepGraph(currentFlow?.workflow, bubbleParameters);
    console.log('stepGraph', stepGraph);
    const steps = stepGraph.steps;
    const stepEdges = stepGraph.edges;

    // Determine step and edge execution state for highlighting
    const stepState = getStepExecutionState(
      steps,
      completedBubbles,
      runningBubbles
    );
    const edgeState = getEdgeHighlightState(stepEdges, stepState, steps);

    // Check if we should fallback to sequential horizontal layout
    // Conditions: 1. No workflow attribute exists, OR 2. There are unparsed bubbles
    const hasWorkflow =
      currentFlow?.workflow && Object.keys(currentFlow.workflow).length > 0;

    // Find bubbles that are not in any step (unparsed bubbles)
    const bubblesInSteps = new Set<number>();
    steps.forEach((step) => {
      step.bubbleIds.forEach((id) => bubblesInSteps.add(id));
    });
    const unparsedBubbles = bubbleEntries.filter(([, bubbleData]) => {
      const bubble = bubbleData;
      const id = bubble.variableId;
      return !bubblesInSteps.has(id);
    });
    const stepsInMain = steps.filter((step) => step.id == 'step-main');

    const shouldUseSequentialLayout =
      !hasWorkflow || unparsedBubbles.length > 0 || stepsInMain.length > 0;

    // Calculate which handles are used for each step/transformation/bubble node
    // Define this before sequential/step-based layout branches
    const usedHandlesMap = new Map<
      string,
      { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
    >();

    const markHandleUsed = (
      nodeId: string,
      handle: 'top' | 'bottom' | 'left' | 'right'
    ) => {
      if (!usedHandlesMap.has(nodeId)) {
        usedHandlesMap.set(nodeId, {});
      }
      usedHandlesMap.get(nodeId)![handle] = true;
    };

    // Use sequential horizontal layout as fallback
    if (shouldUseSequentialLayout) {
      // Track handles for sequential layout edges
      const mainBubbles = bubbleEntries
        .map(([key, bubbleData]) => {
          const typedBubbleData = bubbleData as Partial<ParsedBubble>;
          return {
            key,
            nodeId: typedBubbleData?.variableId
              ? String(typedBubbleData.variableId)
              : String(key),
            startLine: typedBubbleData?.location?.startLine || 0,
          };
        })
        .filter((bubble) => bubble.startLine > 0)
        .sort((a, b) => a.startLine - b.startLine);

      // Entry node to first bubble
      if (flowName && mainBubbles.length > 0) {
        const firstBubbleId = mainBubbles[0].nodeId;
        markHandleUsed(entryNodeId, 'right'); // source
        markHandleUsed(firstBubbleId, 'left'); // target
      }

      // Sequential bubble-to-bubble connections
      for (let i = 0; i < mainBubbles.length - 1; i++) {
        const sourceNodeId = mainBubbles[i].nodeId;
        const targetNodeId = mainBubbles[i + 1].nodeId;
        markHandleUsed(sourceNodeId, 'right'); // source
        markHandleUsed(targetNodeId, 'left'); // target
      }

      // Create nodes for each bubble (sequential horizontal layout)
      bubbleEntries.forEach(([key, bubbleData], index) => {
        const bubble = bubbleData;
        const nodeId = bubble.variableId
          ? String(bubble.variableId)
          : String(key);

        // Use persisted position if available, otherwise use initial position
        const persistedPosition = persistedPositions.current.get(nodeId);
        const initialPosition = {
          x: startX + index * horizontalSpacing,
          y: baseY,
        };

        const node: Node = {
          id: nodeId,
          type: 'bubbleNode',
          position: persistedPosition || initialPosition,
          origin: [0, 0.5] as [number, number],
          draggable: true,
          data: {
            flowId: currentFlow?.id || flowId,
            bubble,
            bubbleKey: key,
            requiredCredentialTypes: (() => {
              const keyCandidates = [
                String(bubble.variableId),
                bubble.variableName,
                bubble.bubbleName,
              ];
              const credentialsKeyForBubble =
                keyCandidates.find(
                  (k) =>
                    k &&
                    Array.isArray(
                      (requiredCredentials as Record<string, unknown>)[k]
                    )
                ) || bubble.bubbleName;
              return (
                (requiredCredentials as Record<string, string[]>)[
                  credentialsKeyForBubble
                ] || []
              );
            })(),
            onHighlightChange: () => {
              // BubbleNode will handle store updates
            },
            onBubbleClick: () => {
              useUIStore.getState().showEditorPanel();
              setExecutionHighlight({
                startLine: bubble.location.startLine,
                endLine: bubble.location.endLine,
              });
            },
            onParamEditInCode: (paramName: string) => {
              // Find the parameter in the bubble's parameters
              const param = bubble.parameters.find((p) => p.name === paramName);
              if (param && param.location) {
                // Open editor if not visible
                if (!useUIStore.getState().showEditor) {
                  useUIStore.getState().showEditorPanel();
                }

                // Highlight the parameter's location in the editor
                setExecutionHighlight({
                  startLine: param.location.startLine,
                  endLine: param.location.endLine,
                });
              }
            },
            hasSubBubbles: !!bubble.dependencyGraph?.dependencies?.length,
            usedHandles: usedHandlesMap.get(nodeId),
          },
        };
        nodes.push(node);

        // Create sub-bubbles from dependency graph
        if (bubble.dependencyGraph?.dependencies) {
          const rootId = bubble.variableId ?? parseInt(key, 10);
          bubble.dependencyGraph.dependencies.forEach((dep, idx, arr) => {
            createNodesFromDependencyGraph(
              dep,
              bubble,
              nodes,
              edges,
              1,
              nodeId,
              idx,
              arr.length,
              `${idx}`,
              rootId,
              usedHandlesMap
            );
          });
        }
      });

      // Connect entry node to first bubble
      if (
        flowName &&
        mainBubbles.length > 0 &&
        nodes.some((n) => n.id === entryNodeId)
      ) {
        const firstBubbleId = mainBubbles[0].nodeId;
        if (nodes.some((n) => n.id === firstBubbleId)) {
          edges.push({
            id: `${entryNodeId}-to-first-bubble`,
            source: entryNodeId,
            target: firstBubbleId,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'straight',
            animated: true,
            style: {
              stroke: eventType === 'schedule/cron' ? '#9333ea' : '#60a5fa',
              strokeWidth: 2,
              strokeDasharray: '5,5',
            },
          });
        }
      }

      // Connect main bubbles sequentially
      for (let i = 0; i < mainBubbles.length - 1; i++) {
        const sourceNodeId = mainBubbles[i].nodeId;
        const targetNodeId = mainBubbles[i + 1].nodeId;

        if (
          nodes.some((n) => n.id === sourceNodeId) &&
          nodes.some((n) => n.id === targetNodeId)
        ) {
          // Read highlightedBubble directly from store (nodes/edges sync happens when needed)
          const currentHighlighted = getExecutionStore(
            currentFlow?.id || flowId
          ).highlightedBubble;
          const isSequentialEdgeHighlighted =
            currentHighlighted === sourceNodeId ||
            currentHighlighted === targetNodeId;

          edges.push({
            id: `sequential-${sourceNodeId}-${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'straight',
            animated: true,
            style: {
              stroke: isSequentialEdgeHighlighted ? '#9333ea' : '#9ca3af',
              strokeWidth: isSequentialEdgeHighlighted ? 3 : 2,
              strokeDasharray: '5,5',
            },
          });
        }
      }

      return { initialNodes: nodes, initialEdges: edges };
    }

    /**
     * Calculate the height of a step based on its type and content
     */
    function calculateStepHeight(step: StepData): number {
      if (step.isTransformation && step.transformationData) {
        // Transformation nodes only show header (no code), so use fixed height
        return FLOW_LAYOUT.TRANSFORMATION.FIXED_HEIGHT;
      } else {
        // Step container height calculation (matching StepContainerNode.tsx)
        const stepHeaderHeight = calculateHeaderHeight(
          step.functionName,
          step.description
        );
        return calculateStepContainerHeight(
          step.bubbleIds.length,
          stepHeaderHeight
        );
      }
    }

    /**
     * Calculate hierarchical layout positions for steps based on branch structure
     */
    function calculateHierarchicalLayout(
      steps: StepData[]
    ): Map<string, { x: number; y: number }> {
      const positionMap = new Map<string, { x: number; y: number }>();
      const heightMap = new Map<string, number>();

      // Calculate heights for all steps
      for (const step of steps) {
        heightMap.set(step.id, calculateStepHeight(step));
      }

      // Layout parameters
      const startX = FLOW_LAYOUT.HIERARCHICAL.START_X;
      const startY = FLOW_LAYOUT.HIERARCHICAL.START_Y;
      const minVerticalSpacing = FLOW_LAYOUT.HIERARCHICAL.MIN_VERTICAL_SPACING;
      const horizontalSpacing = FLOW_LAYOUT.HIERARCHICAL.HORIZONTAL_SPACING;

      // Build adjacency map: parent -> children (using step.parentStepId)
      const childrenMap = new Map<string, StepData[]>();
      const parentMap = new Map<string, string>();

      // Build map of all parents for each step from edges (for convergence detection)
      const allParentsMap = new Map<string, string[]>();
      for (const stepEdge of stepEdges) {
        if (!allParentsMap.has(stepEdge.targetStepId)) {
          allParentsMap.set(stepEdge.targetStepId, []);
        }
        allParentsMap.get(stepEdge.targetStepId)!.push(stepEdge.sourceStepId);
      }

      for (const step of steps) {
        if (step.parentStepId) {
          if (!childrenMap.has(step.parentStepId)) {
            childrenMap.set(step.parentStepId, []);
          }
          childrenMap.get(step.parentStepId)!.push(step);
          parentMap.set(step.id, step.parentStepId);
        }
      }

      // Find root steps (no parent)
      const rootSteps = steps.filter((s) => !s.parentStepId);

      // Track visited nodes
      const visited = new Set<string>();

      /**
       * Recursively layout steps in tree structure
       */
      function layoutSubtree(
        stepId: string,
        x: number,
        y: number,
        depth: number
      ): number {
        if (visited.has(stepId)) {
          return x;
        }
        visited.add(stepId);

        // Position current step (will be adjusted later if it's a convergence point)
        positionMap.set(stepId, { x, y });

        // Get children
        const children = childrenMap.get(stepId) || [];

        if (children.length === 0) {
          return x;
        }

        // Get the height of the current step
        const currentStepHeight =
          heightMap.get(stepId) || FLOW_LAYOUT.HIERARCHICAL.DEFAULT_HEIGHT;

        // Sort children by branch type (then before else) for consistent layout
        const sortedChildren = [...children].sort((a, b) => {
          const order = { then: 0, sequential: 1, else: 2 };
          const aOrder = order[a.branchType || 'sequential'];
          const bOrder = order[b.branchType || 'sequential'];
          return aOrder - bOrder;
        });

        let currentX = x;

        // Layout children horizontally – all children (sequential and branches) are spread
        // around the parent X to avoid overlapping at the same level.
        for (let i = 0; i < sortedChildren.length; i++) {
          const child = sortedChildren[i];

          // Offset all children horizontally based on index
          const branchOffset =
            (i - (sortedChildren.length - 1) / 2) * horizontalSpacing;
          const childX = x + branchOffset;

          // Calculate child Y position based on parent's bottom + minimum spacing
          const childY = y + currentStepHeight + minVerticalSpacing;

          // Recursively layout child's subtree
          const subtreeEndX = layoutSubtree(
            child.id,
            childX,
            childY,
            depth + 1
          );

          // Update currentX for next sibling
          if (i < sortedChildren.length - 1) {
            currentX = subtreeEndX + horizontalSpacing;
          }
        }

        return currentX;
      }

      // Layout from each root
      let currentRootX = startX;
      for (const rootStep of rootSteps) {
        const endX = layoutSubtree(rootStep.id, currentRootX, startY, 0);
        currentRootX = endX + horizontalSpacing;
      }

      // Post-process: Re-position convergence points after all parents are positioned
      // This ensures convergence points are properly centered even if parents were laid out in different subtrees
      // We need to iterate multiple times until positions stabilize (in case convergence points depend on other convergence points)
      let changed = true;
      let iterations = 0;
      const maxIterations = 10; // Safety limit (not a layout constant, but a convergence limit)

      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        for (const step of steps) {
          const allParents = allParentsMap.get(step.id) || [];
          if (allParents.length > 1) {
            const parentPositions = allParents
              .map((parentId) => {
                const pos = positionMap.get(parentId);
                const height =
                  heightMap.get(parentId) ||
                  FLOW_LAYOUT.HIERARCHICAL.DEFAULT_HEIGHT;
                return pos ? { ...pos, height } : undefined;
              })
              .filter(
                (pos): pos is { x: number; y: number; height: number } =>
                  pos !== undefined
              );

            if (parentPositions.length > 0) {
              const minX = Math.min(...parentPositions.map((p) => p.x));
              const maxX = Math.max(...parentPositions.map((p) => p.x));
              const centerX = (minX + maxX) / 2;

              // Calculate Y position based on the bottom of the lowest parent
              const maxBottomY = Math.max(
                ...parentPositions.map((p) => p.y + p.height)
              );
              const stepY = maxBottomY + minVerticalSpacing;

              const currentPos = positionMap.get(step.id);
              if (
                !currentPos ||
                Math.abs(currentPos.x - centerX) > 1 ||
                Math.abs(currentPos.y - stepY) > 1
              ) {
                positionMap.set(step.id, { x: centerX, y: stepY });
                changed = true;
              }
            }
          }
        }
      }

      return positionMap;
    }

    const stepPositions = calculateHierarchicalLayout(steps);

    // Track handles for step-based layout edges

    // Entry node to first step connection
    if (flowName && steps.length > 0) {
      const firstRootStep = steps.find((s) => !s.parentStepId);
      if (firstRootStep) {
        markHandleUsed(entryNodeId, 'right'); // source
        markHandleUsed(firstRootStep.id, 'left'); // target
      }
    }

    // Step-to-step connections
    for (const stepEdge of stepEdges) {
      markHandleUsed(stepEdge.sourceStepId, 'bottom'); // source
      markHandleUsed(stepEdge.targetStepId, 'top'); // target
    }

    // Within-step bubble connections (vertical flow inside step containers)
    for (const step of steps) {
      if (step.isTransformation) continue; // Skip transformation steps

      const stepBubbles = step.bubbleIds
        .map((id) => bubbleParameters[id])
        .filter(Boolean)
        .sort((a, b) => a.location.startLine - b.location.startLine);

      // Connect each bubble to next in sequence (vertical flow)
      for (let i = 0; i < stepBubbles.length - 1; i++) {
        const source = stepBubbles[i];
        const target = stepBubbles[i + 1];

        const sourceNodeId = String(source.variableId);
        const targetNodeId = String(target.variableId);

        markHandleUsed(sourceNodeId, 'bottom'); // source
        markHandleUsed(targetNodeId, 'top'); // target
      }
    }

    // Sub-bubble connections (dependency graph)
    const markSubBubbleHandles = (
      parentNodeId: string,
      dependencyNode: DependencyGraphNode,
      path: string
    ) => {
      const childNodeId =
        dependencyNode.variableId !== undefined &&
        dependencyNode.variableId !== null &&
        dependencyNode.variableId !== -1
          ? String(dependencyNode.variableId)
          : generateDependencyNodeId(dependencyNode, parentNodeId, path);

      // Parent bubble uses bottom handle (source), child uses top handle (target)
      markHandleUsed(parentNodeId, 'bottom');
      markHandleUsed(childNodeId, 'top');

      // Recursively mark handles for nested sub-bubbles
      dependencyNode.dependencies?.forEach((child, idx) => {
        markSubBubbleHandles(
          childNodeId,
          child,
          path ? `${path}-${idx}` : `${idx}`
        );
      });
    };

    // Mark handles for all dependency graphs
    bubbleEntries.forEach(([key, bubbleData]) => {
      const bubble = bubbleData;
      const parentNodeId = bubble.variableId
        ? String(bubble.variableId)
        : String(key);

      if (bubble.dependencyGraph?.dependencies) {
        bubble.dependencyGraph.dependencies.forEach((dep, idx) => {
          markSubBubbleHandles(parentNodeId, dep, `${idx}`);
        });
      }
    });

    // Create step container nodes or transformation nodes with hierarchical positions
    steps.forEach((step) => {
      const stepNodeId = step.id;
      const stepPosition =
        stepPositions.get(stepNodeId) ||
        FLOW_LAYOUT.HIERARCHICAL.DEFAULT_POSITION;

      // Check if this is a transformation step
      if (step.isTransformation && step.transformationData) {
        const transformationNode = {
          id: stepNodeId,
          type: 'transformationNode',
          position: stepPosition,
          draggable: true,
          data: {
            flowId: currentFlow?.id || flowId,
            transformationId: stepNodeId,
            onTransformationClick: () => {
              console.log('onTransformationClick', step.transformationData);
              useUIStore.getState().showEditorPanel();
              setExecutionHighlight({
                startLine: step.location.startLine,
                endLine: step.location.endLine,
              });
            },
            transformationInfo: {
              functionName: step.functionName,
              description: step.description,
              code: step.transformationData.code,
              arguments: step.transformationData.arguments,
              location: step.location,
              isAsync: step.isAsync,
              variableName: step.transformationData.variableName,
              variableId: step.transformationData.variableId,
            },
            usedHandles: usedHandlesMap.get(stepNodeId),
          },
          style: {
            zIndex: -1,
          },
        };
        nodes.push(transformationNode);
      } else {
        const stepNode: Node = {
          id: stepNodeId,
          type: 'stepContainerNode',
          position: stepPosition,
          draggable: true,
          data: {
            flowId: currentFlow?.id || flowId,
            stepId: stepNodeId,
            stepInfo: {
              functionName: step.functionName,
              description: step.description,
              location: step.location,
              isAsync: step.isAsync,
            },
            bubbleIds: step.bubbleIds,
            usedHandles: usedHandlesMap.get(stepNodeId),
          },
          style: {
            zIndex: -1, // Behind bubbles
          },
        };
        nodes.push(stepNode);
      }
    });

    // Create bubble nodes for each step (allows duplicate bubbles in different steps)
    // Skip transformation steps as they don't contain bubbles
    steps.forEach((step) => {
      if (step.isTransformation) {
        return; // Skip transformation steps
      }

      // Calculate dynamic header height for this step
      const stepHeaderHeight = calculateHeaderHeight(
        step.functionName,
        step.description
      );

      step.bubbleIds.forEach((bubbleId, bubbleIndexInStep) => {
        // Find the bubble data
        const bubbleEntry = bubbleEntries.find(([key, bubbleData]) => {
          const bubble = bubbleData;
          const id = bubble.variableId ? bubble.variableId : parseInt(key);
          return id === bubbleId;
        });

        if (!bubbleEntry) {
          console.warn(
            `[FlowVisualizer] Bubble ${bubbleId} not found in bubbleParameters`
          );
          return;
        }

        const [key, bubbleData] = bubbleEntry;
        const bubble = bubbleData;

        // Use the bubble's variableId or key as the node ID (consistent with sequential layout)
        const nodeId = bubble.variableId
          ? String(bubble.variableId)
          : String(key);

        // Position inside step container (relative to step)
        // Uses layout constants from StepContainerNode for consistency
        const initialPosition = calculateBubblePosition(
          bubbleIndexInStep,
          stepHeaderHeight
        );

        const node: Node = {
          id: nodeId,
          type: 'bubbleNode',
          position: initialPosition,
          origin: [0, 0] as [number, number], // Position by top-left for consistent spacing
          draggable: true,
          parentId: step.id, // Set parent relationship to the step
          extent: [
            [
              STEP_CONTAINER_LAYOUT.PADDING,
              stepHeaderHeight + STEP_CONTAINER_LAYOUT.PADDING, // Start of content area including padding
            ],
            [
              STEP_CONTAINER_LAYOUT.WIDTH - STEP_CONTAINER_LAYOUT.PADDING,
              calculateStepContainerHeight(
                step.bubbleIds.length,
                stepHeaderHeight
              ) - STEP_CONTAINER_LAYOUT.PADDING,
            ],
          ] as [[number, number], [number, number]], // Constrain to content area below header
          data: {
            flowId: currentFlow?.id || flowId,
            bubble,
            bubbleKey: key,
            requiredCredentialTypes: (() => {
              const keyCandidates = [
                String(bubble.variableId),
                bubble.variableName,
                bubble.bubbleName,
              ];
              const credentialsKeyForBubble =
                keyCandidates.find(
                  (k) =>
                    k &&
                    Array.isArray(
                      (requiredCredentials as Record<string, unknown>)[k]
                    )
                ) || bubble.bubbleName;
              return (
                (requiredCredentials as Record<string, string[]>)[
                  credentialsKeyForBubble
                ] || []
              );
            })(),
            onHighlightChange: () => {
              // BubbleNode will handle store updates
            },
            onBubbleClick: () => {
              useUIStore.getState().showEditorPanel();
              setExecutionHighlight({
                startLine: bubble.location.startLine,
                endLine: bubble.location.endLine,
              });
            },
            onParamEditInCode: (paramName: string) => {
              // Find the parameter in the bubble's parameters
              const param = bubble.parameters.find((p) => p.name === paramName);
              if (param && param.location) {
                // Open editor if not visible
                if (!useUIStore.getState().showEditor) {
                  useUIStore.getState().showEditorPanel();
                }

                // Highlight the parameter's location in the editor
                setExecutionHighlight({
                  startLine: param.location.startLine,
                  endLine: param.location.endLine,
                });
              }
            },
            hasSubBubbles: !!bubble.dependencyGraph?.dependencies?.length,
            usedHandles: usedHandlesMap.get(nodeId),
          },
        };
        nodes.push(node);

        // Create sub-bubbles from dependency graph
        if (bubble.dependencyGraph?.dependencies) {
          bubble.dependencyGraph.dependencies.forEach((dep, idx, arr) => {
            createNodesFromDependencyGraph(
              dep,
              bubble,
              nodes,
              edges,
              1,
              nodeId,
              idx,
              arr.length,
              `${idx}`,
              bubbleId,
              usedHandlesMap
            );
          });
        }
      });
    });

    // Generate step-to-step edges (connects step containers with branch labels)

    // Entry node to first step (if exists)
    if (
      flowName &&
      nodes.some((n) => n.id === entryNodeId) &&
      steps.length > 0
    ) {
      const firstRootStep = steps.find((s) => !s.parentStepId);
      if (firstRootStep) {
        const firstStepState = stepState.get(firstRootStep.id);

        // Edge stays green once execution starts (either executing or completed)
        const isHighlighted =
          firstStepState?.isExecuting || firstStepState?.isCompleted;

        let edgeColor: string;
        let strokeWidth: number;
        let strokeDasharray: string | undefined;
        let strokeOpacity: number | undefined;

        if (isHighlighted) {
          // Highlighted edges: solid, thick, bright green
          edgeColor = '#22c55e'; // green-500
          strokeWidth = 4;
          strokeDasharray = undefined;
          strokeOpacity = 1;
        } else {
          // Non-highlighted edges: dashed, thin, subtle
          edgeColor = '#6b7280'; // gray-500
          strokeWidth = 1.5;
          strokeDasharray = '8,4';
          strokeOpacity = 0.4;
        }

        edges.push({
          id: 'entry-to-first-step',
          source: entryNodeId,
          target: firstRootStep.id,
          sourceHandle: 'right',
          targetHandle: 'left',
          // Slightly curved but mostly straight
          type: 'simplebezier',
          animated: true,
          zIndex: isHighlighted ? 10 : 0, // Highlighted edges render on top
          style: {
            stroke: edgeColor,
            strokeWidth,
            strokeDasharray,
            strokeOpacity,
          },
        });
      }
    }

    // Generate edges from step graph (includes conditional branches with labels)
    for (const stepEdge of stepEdges) {
      const isConditional = stepEdge.edgeType === 'conditional';
      const edgeId = `${stepEdge.sourceStepId}-to-${stepEdge.targetStepId}`;
      const highlightState = edgeState.get(edgeId);

      // Determine edge color and style based on execution state
      // Edge stays green once execution starts (either executing or completed)
      const isHighlighted =
        highlightState?.isExecuting || highlightState?.isCompleted;

      let edgeColor: string;
      let strokeWidth: number;
      let strokeDasharray: string | undefined;
      let strokeOpacity: number | undefined;

      if (isHighlighted) {
        // Highlighted edges: solid, thick, bright green - clearly visible
        edgeColor = '#22c55e'; // green-500
        strokeWidth = 4; // Thicker for better visibility
        strokeDasharray = undefined; // Solid line - no dashes
        strokeOpacity = 1; // Fully opaque
      } else {
        // Non-highlighted edges: dashed, thin, subtle gray - fade into background
        edgeColor = '#6b7280'; // gray-500 (lighter than before)
        strokeWidth = isConditional ? 1.5 : 1.5; // Thinner
        strokeDasharray = '8,4'; // Dashed - more subtle
        strokeOpacity = 0.4; // Semi-transparent to fade into background
      }

      const edge: Edge = {
        id: edgeId,
        source: stepEdge.sourceStepId,
        target: stepEdge.targetStepId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        // Slightly curved, more organic than straight/step lines
        type: 'simplebezier',
        animated: true,
        zIndex: isHighlighted ? 10 : 0, // Highlighted edges render on top
        label: SHOW_EDGE_LABELS ? stepEdge.label : undefined,
        labelStyle: SHOW_EDGE_LABELS
          ? {
              fill: edgeColor,
              fontWeight: 600,
              fontSize: 12,
            }
          : undefined,
        labelBgStyle: SHOW_EDGE_LABELS
          ? {
              fill: '#1e1e1e',
              fillOpacity: 0.9,
            }
          : undefined,
        labelBgPadding: SHOW_EDGE_LABELS
          ? ([8, 4] as [number, number])
          : undefined,
        labelBgBorderRadius: SHOW_EDGE_LABELS ? 4 : undefined,
        style: {
          stroke: edgeColor,
          strokeWidth,
          strokeDasharray,
          strokeOpacity,
        },
      };
      edges.push(edge);
    }

    // Generate within-step edges (connects bubbles vertically inside each step)
    const internalEdges = generateWithinStepEdges(
      steps,
      bubbleParameters,
      completedBubbles,
      runningBubbles
    );
    edges.push(...internalEdges);

    return { initialNodes: nodes, initialEdges: edges };
  };

  // Track previous expandedRootIds and currentFlow to detect changes
  const prevExpandedRootIdsRef = useRef<number[]>([]);
  const prevFlowRef = useRef<typeof currentFlow>(undefined);

  // Sync nodes and edges state with computed values, preserving positions
  useEffect(() => {
    const { initialNodes, initialEdges } = initialNodesAndEdges();

    // Check if flow ID changed
    const flowIdChanged = prevFlowRef.current?.id !== currentFlow?.id;

    // Check if bubbleParameters changed (compare by serializing keys and variableIds)
    const prevBubbleParams = prevFlowRef.current?.bubbleParameters || {};
    const currentBubbleParams = currentFlow?.bubbleParameters || {};
    const prevWorkflow = prevFlowRef.current?.workflow || {};
    const currentWorkflow = currentFlow?.workflow || {};
    const workflowChanged =
      JSON.stringify(prevWorkflow) !== JSON.stringify(currentWorkflow);
    const prevBubbleKeys = JSON.stringify(
      Object.keys(prevBubbleParams)
        .sort()
        .map((key) => {
          const bubble = prevBubbleParams[key] as
            | { variableId?: number }
            | undefined;
          return `${key}:${bubble?.variableId ?? 'no-id'}`;
        })
    );
    const currentBubbleKeys = JSON.stringify(
      Object.keys(currentBubbleParams)
        .sort()
        .map((key) => {
          const bubble = currentBubbleParams[key] as
            | { variableId?: number }
            | undefined;
          return `${key}:${bubble?.variableId ?? 'no-id'}`;
        })
    );
    const bubbleParametersChanged =
      prevBubbleKeys !== currentBubbleKeys || workflowChanged;

    // Check if eventType changed (affects entry node type and edge connections)
    const eventTypeChanged =
      prevFlowRef.current?.eventType !== currentFlow?.eventType;

    // Structure changed if flow ID changed OR bubbleParameters changed OR eventType changed
    const structureChanged =
      flowIdChanged || bubbleParametersChanged || eventTypeChanged;

    const expandedChanged =
      prevExpandedRootIdsRef.current.length !== expandedRootIds.length ||
      !prevExpandedRootIdsRef.current.every((id) =>
        expandedRootIds.includes(id)
      ) ||
      !expandedRootIds.every((id) =>
        prevExpandedRootIdsRef.current.includes(id)
      );

    // Check if currentFlow data changed (e.g., cronActive, inputSchema, etc.)
    const flowDataChanged = prevFlowRef.current !== currentFlow;

    setNodes((currentNodes) => {
      // If this is the first time we have nodes, just set them
      if (currentNodes.length === 0 || structureChanged) {
        prevExpandedRootIdsRef.current = expandedRootIds;
        prevFlowRef.current = currentFlow;
        return initialNodes;
      }

      // If only expandedRootIds changed (not flow structure), use incremental updates
      if (expandedChanged && !structureChanged && currentFlow?.id) {
        const currentNodeIds = new Set(currentNodes.map((n) => n.id));
        const initialNodeIds = new Set(initialNodes.map((n) => n.id));

        // Find nodes to add and remove
        const nodesToAdd = initialNodes.filter(
          (n) => !currentNodeIds.has(n.id)
        );
        const nodesToRemove = currentNodes.filter(
          (n) => !initialNodeIds.has(n.id)
        );

        // Build node changes for incremental update
        const nodeChanges: NodeChange[] = [
          ...nodesToRemove.map(
            (n) => ({ type: 'remove', id: n.id }) as NodeChange
          ),
          ...nodesToAdd.map((n) => {
            const existingPos = persistedPositions.current.get(n.id);
            return {
              type: 'add',
              item: { ...n, position: existingPos || n.position },
            } as NodeChange;
          }),
        ];

        prevExpandedRootIdsRef.current = expandedRootIds;

        if (nodeChanges.length > 0) {
          return applyNodeChanges(nodeChanges, currentNodes);
        }
        // Even if no nodes were added/removed, we still need to update node data
        // (e.g., when cronActive changes), so fall through to the merge logic below
      }

      // For flow data changes (like cronActive) or structure changes, merge positions and update
      // Only skip if nothing has changed at all
      if (!flowDataChanged && !expandedChanged && !structureChanged) {
        return currentNodes;
      }

      const updatedNodes = initialNodes.map((initialNode) => {
        const currentNode = currentNodes.find((n) => n.id === initialNode.id);
        if (currentNode) {
          // Keep the current position if node exists
          return { ...initialNode, position: currentNode.position };
        }
        return initialNode;
      });

      prevExpandedRootIdsRef.current = expandedRootIds;
      prevFlowRef.current = currentFlow;
      return updatedNodes;
    });

    // For edges, regenerate when structure changes (including bubbleParameters)
    setEdges((currentEdges) => {
      if (structureChanged) {
        prevExpandedRootIdsRef.current = expandedRootIds;
        prevFlowRef.current = currentFlow;
        return initialEdges;
      }

      const currentEdgeIds = new Set(currentEdges.map((e) => e.id));
      const initialEdgeIds = new Set(initialEdges.map((e) => e.id));

      // If only expandedRootIds changed, use incremental edge updates
      if (expandedChanged && !structureChanged && currentFlow?.id) {
        const edgesToAdd = initialEdges.filter(
          (e) => !currentEdgeIds.has(e.id)
        );
        const edgesToRemove = currentEdges.filter(
          (e) => !initialEdgeIds.has(e.id)
        );

        if (edgesToAdd.length > 0 || edgesToRemove.length > 0) {
          const edgeChanges: EdgeChange[] = [
            ...edgesToRemove.map(
              (e) => ({ type: 'remove', id: e.id }) as EdgeChange
            ),
            ...edgesToAdd.map((e) => ({ type: 'add', item: e }) as EdgeChange),
          ];
          return applyEdgeChanges(edgeChanges, currentEdges);
        }
        // If no edges were added/removed but currentFlow changed, return the new edges
        // to ensure edge styling is updated (e.g., cron node color changes)
        return initialEdges;
      }

      // If flow data changed (like cronActive), update edges
      if (flowDataChanged) {
        return initialEdges;
      }

      // If execution state changed (completedBubbles or runningBubbles), update edge styles
      // Merge existing edges with updated styles from initialEdges to preserve positions
      const updatedEdges = initialEdges.map((newEdge) => {
        const existingEdge = currentEdges.find((e) => e.id === newEdge.id);
        if (existingEdge) {
          // Preserve existing edge properties, but update style for highlighting
          return { ...existingEdge, style: newEdge.style };
        }
        return newEdge;
      });

      // Add any edges that exist in currentEdges but not in initialEdges (e.g., sub-bubble edges)
      const newEdgeIds = new Set(initialEdges.map((e) => e.id));
      const edgesToKeep = currentEdges.filter((e) => !newEdgeIds.has(e.id));

      return [...updatedEdges, ...edgesToKeep];
    });
  }, [
    currentFlow,
    expandedRootIds,
    completedBubbles,
    runningBubbles,
    isExecuting,
  ]);

  // Reset view initialization flag when flowId changes
  useEffect(() => {
    hasSetInitialView.current = false;
  }, [flowId]);

  // Auto-position view on entry node only on initial load
  useEffect(() => {
    if (nodes.length > 0 && !hasSetInitialView.current) {
      // Small delay to ensure nodes are rendered before positioning
      const timer = setTimeout(() => {
        // Find the entry node (input-schema-node or cron-schedule-node)
        const entryNode = getNode(entryNodeId);
        if (entryNode) {
          const zoom = 1; // Much more zoomed in

          // Position the entry node towards the left (about 20% from the left edge)
          // setCenter will center the given coordinates in the viewport
          // To position the node 20% from left instead of centered (50%), we shift the center point right
          const viewportWidth = window.innerWidth;
          const horizontalShift = (viewportWidth * 0.15) / zoom; // Shift right to position node on left

          setCenter(
            entryNode.position.x + horizontalShift,
            entryNode.position.y,
            {
              zoom: zoom,
              duration: FLOW_LAYOUT.VIEWPORT.CENTER_DURATION,
            }
          );

          // Mark that we've set the initial view
          hasSetInitialView.current = true;
        }
      }, FLOW_LAYOUT.VIEWPORT.INITIAL_VIEW_DELAY);

      return () => clearTimeout(timer);
    }
  }, [nodes.length, getNode, setCenter, entryNodeId]);

  // While executing, center the currently running parent bubble (if multiple, pick the top-most by startLine)
  const lastCenteredBubbleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isExecuting) {
      lastCenteredBubbleIdRef.current = null;
      return;
    }
    // Early return if no running bubbles to prevent unnecessary renders
    if (!runningBubbles || runningBubbles.size === 0) {
      lastCenteredBubbleIdRef.current = null;
      return;
    }

    // Build a map of main bubbleId -> startLine for ordering
    const idToStartLine = new Map<string, number>();
    bubbleEntries.forEach(([, bubbleData]) => {
      const b = bubbleData as ParsedBubble;
      const id = b.variableId ? String(b.variableId) : String(b.bubbleName);
      const startLine = b?.location?.startLine ?? Number.MAX_SAFE_INTEGER;
      idToStartLine.set(id, startLine);
    });

    // Choose the running bubble with the smallest startLine (top-most parent)
    let chosenId: string | null = null;
    let bestLine = Number.MAX_SAFE_INTEGER;
    for (const id of runningBubbles) {
      const line = idToStartLine.get(id);
      if (line !== undefined && line < bestLine) {
        bestLine = line;
        chosenId = id;
      }
    }

    if (!chosenId) return;
    if (lastCenteredBubbleIdRef.current === chosenId) return;

    const node = getNode(chosenId);
    if (!node) return;

    // Calculate absolute position (account for parent if node is inside a step container)
    let absoluteX = node.position.x;
    let absoluteY = node.position.y;

    if (node.parentId) {
      // Node is inside a step container - get parent and calculate absolute position
      const parentNode = getNode(node.parentId);
      if (parentNode) {
        absoluteX = parentNode.position.x + node.position.x;
        absoluteY = parentNode.position.y + node.position.y;
      }
    }

    lastCenteredBubbleIdRef.current = chosenId;
    const zoom = FLOW_LAYOUT.VIEWPORT.EXECUTION_ZOOM;
    const viewportWidth = window.innerWidth;
    const horizontalShift =
      (viewportWidth * FLOW_LAYOUT.VIEWPORT.EXECUTION_LEFT_OFFSET_RATIO) / zoom;
    setCenter(absoluteX + horizontalShift, absoluteY, {
      duration: 250,
      zoom,
    });
  }, [isExecuting, runningBubbles, bubbleEntries, getNode, setCenter]);

  // 🔍 BUBBLE DEBUG: Log bubble state changes (after flowNodes is defined)
  // useEffect(() => {
  //   logBubbleDebugInfo(flowId, bubbleParameters, executionState, currentFlow, flowNodes);
  // }, [flowId, bubbleParameters, executionState.isRunning, executionState.isValidating, executionState.highlightedBubble, currentFlow.data, flowNodes]);

  // Handle node changes (position updates, etc.)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Persist positions when nodes are dragged or moved
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.id) {
        persistedPositions.current.set(change.id, change.position);
      }
    });
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Show loading state
  if (loading) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ backgroundColor: '#1e1e1e' }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-purple-400 text-lg mb-2">Loading Flow...</p>
          <p className="text-gray-500 text-sm">
            Processing flow data and setting up visualization
          </p>
        </div>
      </div>
    );
  }

  // Show generation error state
  if (currentFlow?.generationError) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ backgroundColor: '#1e1e1e' }}
      >
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-red-400 text-lg mb-2 font-medium">
            Code Generation Failed
          </p>
          <p className="text-gray-400 text-sm mb-4">
            {currentFlow.generationError}
          </p>
          <button
            type="button"
            onClick={() => {
              // TODO: Implement retry generation
              console.log('Retry generation for flow', flowId);
            }}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Retry Generation
          </button>
        </div>
      </div>
    );
  }

  // Check if code is empty and no error (generating state)
  // If there's an error, we show the error state instead
  const isGenerating =
    (!currentFlow?.code || currentFlow.code.trim() === '') &&
    !currentFlow?.generationError;

  // Note: We no longer early return when there are no bubbles
  // The entry node (InputSchemaNode or CronScheduleNode) should always be visible

  return (
    <div
      className="h-full overflow-hidden relative"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {onValidate && !isGenerating && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={onValidate}
            disabled={isExecuting}
            className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Sync changes
          </button>
          {hasUnsavedChanges && (
            <div className="bg-orange-500/20 border border-orange-500/50 px-2 py-1 rounded text-xs font-medium text-orange-300">
              Unsaved
            </div>
          )}
        </div>
      )}

      {/* Show blank state when code is empty (generating in Pearl) */}
      {isGenerating ? (
        <GeneratingOverlay />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node) => {
            const executionStore = getExecutionStore(currentFlow?.id || flowId);
            const pearlChatStore = getPearlChatStore(currentFlow?.id || flowId);

            if (node.type === 'stepContainerNode') {
              const stepData = node.data as unknown as {
                stepId: string;
                stepInfo: {
                  functionName: string;
                  description?: string;
                  location: { startLine: number; endLine: number };
                  isAsync: boolean;
                };
              };
              const functionName = stepData.stepInfo.functionName;

              // Highlight the step container
              executionStore.highlightBubble(node.id);

              console.log('addStepToContext', functionName);

              // Add step to context (automatically clears bubble and transformation context)
              pearlChatStore.getState().addStepToContext(functionName);

              // Open Pearl panel
              useUIStore.getState().openConsolidatedPanelWith('pearl');
            } else if (node.type === 'transformationNode') {
              const transformationInfo = (
                node.data as unknown as TransformationNodeData
              ).transformationInfo;
              const functionName = transformationInfo.functionName;

              // Highlight the transformation node
              executionStore.highlightBubble(node.id);

              console.log('addTransformationToContext', functionName);

              // Add transformation to context (automatically clears bubble context)
              pearlChatStore
                .getState()
                .addTransformationToContext(functionName);

              // Open Pearl panel
              useUIStore.getState().openConsolidatedPanelWith('pearl');
            } else if (node.type === 'bubbleNode') {
              // For bubble nodes, use variableId
              const bubbleData = (node.data as unknown as BubbleNodeData)
                .bubble;
              const bubbleId = bubbleData.variableId
                ? String(bubbleData.variableId)
                : node.id;

              // Highlight the bubble
              executionStore.highlightBubble(bubbleId);

              // Set execution highlight in editor
              if (
                bubbleData.location.startLine > 0 &&
                bubbleData.location.endLine > 0
              ) {
                setExecutionHighlight({
                  startLine: bubbleData.location.startLine,
                  endLine: bubbleData.location.endLine,
                });
              }

              // Clear and set context
              pearlChatStore.getState().clearBubbleContext();
              const contextKey = bubbleData.variableId
                ? bubbleData.variableId
                : Number(node.id);

              pearlChatStore.getState().addBubbleToContext(contextKey);
              useUIStore.getState().openConsolidatedPanelWith('pearl');
            } else if (
              node.type === 'inputSchemaNode' ||
              node.type === 'cronScheduleNode'
            ) {
              // Highlight the entry node
              executionStore.highlightBubble(node.id);
              // Clear the bubble context (entry nodes don't have bubble context)
              pearlChatStore.getState().clearBubbleContext();
              useUIStore.getState().openConsolidatedPanelWith('pearl');
            }
          }}
          onPaneClick={() => {
            // Dismiss the highlighted bubble
            getExecutionStore(currentFlow?.id || flowId).highlightBubble(null);
            useEditorStore.getState().clearExecutionHighlight();

            // Clear the bubble context
            useUIStore.getState().openConsolidatedPanelWith('pearl');
            getPearlChatStore(currentFlow?.id || flowId)
              .getState()
              .clearBubbleContext();
          }}
          proOptions={proOptions}
          minZoom={FLOW_LAYOUT.VIEWPORT.MIN_ZOOM}
          maxZoom={FLOW_LAYOUT.VIEWPORT.MAX_ZOOM}
          defaultViewport={{
            x: 0,
            y: 0,
            zoom: FLOW_LAYOUT.VIEWPORT.INITIAL_ZOOM,
          }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
        >
          <Controls className="!bg-neutral-900 !border-neutral-600 [&_button]:!bg-neutral-800 [&_button]:!text-neutral-200 [&_button]:!border-neutral-600 [&_button:hover]:!bg-neutral-700" />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      )}
    </div>
  );
}

// Main component that provides ReactFlow context
export default function FlowVisualizer(props: FlowVisualizerProps) {
  return (
    <ReactFlowProvider>
      <FlowVisualizerInner {...props} />
    </ReactFlowProvider>
  );
}
