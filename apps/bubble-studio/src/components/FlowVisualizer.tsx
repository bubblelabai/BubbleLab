import { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw } from 'lucide-react';
import BubbleNode from './BubbleNode';
import InputSchemaNode from './InputSchemaNode';
import { useRunExecution } from '@/hooks/useRunExecution';
import type {
  CredentialType,
  DependencyGraphNode,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import { useExecutionStore } from '../stores/executionStore';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useCredentials } from '../hooks/useCredentials';
import { API_BASE_URL } from '../env';

// Keep backward compatibility - use the shared schema type
type ParsedBubble = ParsedBubbleWithInfo;

interface FlowVisualizerProps {
  flowId: number | null;
  onValidate?: () => void;
}

const nodeTypes = {
  bubbleNode: BubbleNode,
  inputSchemaNode: InputSchemaNode,
};

const proOptions = { hideAttribution: true };

const sanitizeIdSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '') || 'segment';

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
  const { fitView, getViewport, setViewport } = useReactFlow();

  // Get all data from global stores
  const currentFlow = useBubbleFlow(flowId);
  const executionState = useExecutionStore(flowId);
  const { data: availableCredentials } = useCredentials(API_BASE_URL);

  // Initialize execution hook
  const { runFlow } = useRunExecution(flowId);

  // Extract stable methods from execution state
  const highlightBubble = executionState.highlightBubble;
  const setCredential = executionState.setCredential;
  const setInput = executionState.setInput;

  // Derive all state from global stores
  const bubbleParameters = currentFlow.data?.bubbleParameters || {};
  const highlightedBubble = executionState.highlightedBubble;
  const isExecuting = executionState.isRunning;
  const bubbleWithError = executionState.bubbleWithError;
  const completedBubbles = executionState.completedBubbles;
  const executionInputs = executionState.executionInputs;
  const pendingCredentials = executionState.pendingCredentials;
  const requiredCredentials = currentFlow.data?.requiredCredentials || {};
  const flowName = currentFlow.data?.name;
  const inputsSchema = currentFlow.data?.inputSchema
    ? JSON.stringify(currentFlow.data.inputSchema)
    : undefined;
  const isLoading = currentFlow.loading;

  // Local UI state for expanded/collapsed nodes
  const expandedRootIdsRef = useRef<string[]>([]);
  const suppressedRootIdsRef = useRef<string[]>([]);

  const bubbleEntries = useMemo(
    () => Object.entries(bubbleParameters),
    [bubbleParameters]
  );

  console.log('Completed bubbles:', completedBubbles);

  // Auto-expand roots when execution starts
  useEffect(() => {
    if (isExecuting) {
      const allRoots: string[] = [];
      bubbleEntries.forEach(([key, bubbleData]) => {
        const bubble = bubbleData as ParsedBubbleWithInfo;
        if (bubble.dependencyGraph?.dependencies?.length) {
          const nodeId = bubble.variableId
            ? String(bubble.variableId)
            : String(key);
          allRoots.push(nodeId);
        }
      });
      expandedRootIdsRef.current = allRoots;
    } else {
      expandedRootIdsRef.current = [];
    }
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

  const toggleRootVisibility = useCallback((nodeId: string) => {
    const isExpanded = expandedRootIdsRef.current.includes(nodeId);
    if (isExpanded) {
      expandedRootIdsRef.current = expandedRootIdsRef.current.filter(
        (id: string) => id !== nodeId
      );
      if (!suppressedRootIdsRef.current.includes(nodeId)) {
        suppressedRootIdsRef.current = [
          ...suppressedRootIdsRef.current,
          nodeId,
        ];
      }
    } else {
      expandedRootIdsRef.current = [...expandedRootIdsRef.current, nodeId];
      suppressedRootIdsRef.current = suppressedRootIdsRef.current.filter(
        (id: string) => id !== nodeId
      );
    }
  }, []);

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
      rootExpanded: boolean = false,
      rootId: string = ''
    ) => {
      const verticalSpacing = 220;
      const siblingHorizontalSpacing = 200;

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
      const nodeId = generateDependencyNodeId(
        dependencyNode,
        parentIdForNode,
        path
      );

      const isNodeAutoVisible = autoVisibleNodes.has(nodeId);
      const isRootSuppressed = suppressedRootIdsRef.current.includes(rootId);
      const shouldRender =
        isExecuting ||
        ((rootExpanded || (isExecuting && isNodeAutoVisible)) &&
          !isRootSuppressed);

      if (!shouldRender) {
        return;
      }

      const parentNode =
        parentNodeId && nodes.find((n) => n.id === parentNodeId);
      const baseX = parentNode ? parentNode.position.x : 50;
      const baseY = parentNode ? parentNode.position.y : 50;

      const rowWidth =
        siblingsTotal > 1 ? (siblingsTotal - 1) * siblingHorizontalSpacing : 0;
      const position = {
        x: baseX - rowWidth / 2 + siblingIndex * siblingHorizontalSpacing,
        y: baseY + verticalSpacing,
      };

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position,
        data: {
          bubble: subBubble,
          bubbleKey: nodeId,
          onParameterChange: undefined,
          isHighlighted:
            highlightedBubble === nodeId ||
            highlightedBubble === String(dependencyNode.variableId),
          onHighlightChange: () =>
            highlightBubble(String(dependencyNode.variableId) || nodeId),
          onBubbleClick: () => {
            // Handle bubble click
          },
        },
      };
      nodes.push(node);

      if (parentNodeId && nodes.some((n) => n.id === parentNodeId)) {
        const isEdgeHighlighted =
          highlightedBubble === parentNodeId ||
          highlightedBubble === nodeId ||
          highlightedBubble === String(dependencyNode.variableId);
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
          rootExpanded,
          rootId
        );
      });
    },
    [highlightedBubble, autoVisibleNodes, isExecuting, highlightBubble]
  );

  // Convert bubbles to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const horizontalSpacing = 450;
    const baseY = 300;
    const startX = 50;

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
            | { type?: string; description?: string; default?: unknown }
            | undefined;
          return {
            name,
            type: valObj?.type,
            required: req.includes(name),
            description: valObj?.description,
            default: (valObj as { default?: unknown } | undefined)?.default,
          };
        });
      } catch {
        return [];
      }
    })();

    // Create InputSchemaNode if needed
    if (parsedFields.length > 0 && flowName) {
      const inputSchemaNode: Node = {
        id: 'input-schema-node',
        type: 'inputSchemaNode',
        position: {
          x: startX - 450,
          y: baseY,
        },
        origin: [0, 0.5] as [number, number],
        data: {
          flowName: flowName,
          schemaFields: parsedFields,
          executionInputs: executionInputs || {},
          onExecutionInputChange: (fieldName: string, value: unknown) => {
            setInput(fieldName, value);
          },
          onExecuteFlow: async () => {
            await runFlow({
              validateCode: true,
              updateCredentials: true,
              inputs: executionInputs || {},
            });
          },
          isExecuting: isExecuting,
          isFormValid: true,
        },
      };
      nodes.push(inputSchemaNode);
    }

    // Create nodes for each bubble
    bubbleEntries.forEach(([key, bubbleData], index) => {
      const bubble = bubbleData;
      const nodeId = bubble.variableId
        ? String(bubble.variableId)
        : String(key);

      const keyCandidates = [
        String(bubble.variableId),
        bubble.variableName,
        bubble.bubbleName,
      ];
      const credentialsKeyForBubble =
        keyCandidates.find(
          (k) =>
            k &&
            Array.isArray((requiredCredentials as Record<string, unknown>)[k])
        ) || bubble.bubbleName;

      const requiredCredTypes =
        (requiredCredentials as Record<string, string[]>)[
          credentialsKeyForBubble
        ] || [];

      const missingCreds = requiredCredTypes.some((credType) => {
        if (SYSTEM_CREDENTIALS.has(credType as CredentialType)) return false;
        const selected =
          (pendingCredentials as Record<string, Record<string, number>>)[
            credentialsKeyForBubble
          ] || {};
        const selectedId = selected[credType];
        return selectedId === undefined || selectedId === null;
      });

      const rootExpanded = expandedRootIdsRef.current.includes(nodeId);
      const rootSuppressed = suppressedRootIdsRef.current.includes(nodeId);
      const hasErrorState = bubbleWithError === nodeId;
      const isCompletedState = nodeId in completedBubbles;
      const executionTimeMs = completedBubbles[nodeId];

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position: {
          x: startX + index * horizontalSpacing,
          y: baseY,
        },
        origin: [0, 0.5] as [number, number],
        data: {
          bubble,
          bubbleKey: key,
          hasMissingRequirements: missingCreds,
          hasMissingCredentials: missingCreds,
          onParameterChange: undefined,
          isHighlighted: highlightedBubble === key,
          onHighlightChange: () => highlightBubble(key),
          onBubbleClick: () => {
            highlightBubble(String(key));
          },
          onParamEditInCode: undefined,
          hasSubBubbles: !!bubble.dependencyGraph?.dependencies?.length,
          areSubBubblesVisible:
            isExecuting || (rootExpanded && !rootSuppressed),
          onToggleSubBubbles: bubble.dependencyGraph?.dependencies?.length
            ? () => toggleRootVisibility(nodeId)
            : undefined,
          requiredCredentialTypes: requiredCredentials
            ? requiredCredentials[credentialsKeyForBubble] || []
            : [],
          availableCredentials: availableCredentials || [],
          selectedBubbleCredentials: pendingCredentials
            ? pendingCredentials[credentialsKeyForBubble] || {}
            : {},
          onCredentialSelectionChange: (
            credType: string,
            credId: number | null
          ) => {
            setCredential(String(bubble.variableId), credType, credId);
          },
          hasError: hasErrorState,
          isCompleted: isCompletedState,
          executionTimeMs: executionTimeMs,
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
            rootExpanded,
            nodeId
          );
        });
      }
    });

    // Add sequential flow connections
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

    // Connect InputSchemaNode to first bubble
    if (
      parsedFields.length > 0 &&
      flowName &&
      mainBubbles.length > 0 &&
      nodes.some((n) => n.id === 'input-schema-node')
    ) {
      const firstBubbleId = mainBubbles[0].nodeId;
      if (nodes.some((n) => n.id === firstBubbleId)) {
        edges.push({
          id: 'input-schema-to-first-bubble',
          source: 'input-schema-node',
          target: firstBubbleId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'straight',
          animated: true,
          style: {
            stroke: '#60a5fa',
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
        const isSequentialEdgeHighlighted =
          highlightedBubble === sourceNodeId ||
          highlightedBubble === targetNodeId;

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
  }, [
    bubbleEntries,
    highlightedBubble,
    requiredCredentials,
    availableCredentials,
    pendingCredentials,
    flowName,
    inputsSchema,
    isExecuting,
    executionInputs,
    createNodesFromDependencyGraph,
    toggleRootVisibility,
    bubbleWithError,
    completedBubbles,
    highlightBubble,
    setCredential,
    setInput,
  ]);

  // Auto-fit view when nodes load or change
  useEffect(() => {
    if (initialNodes.length > 0) {
      // Small delay to ensure nodes are rendered before fitting
      const timer = setTimeout(() => {
        fitView({
          padding: 0.2, // 20% padding around nodes
          duration: 300, // Smooth animation
          maxZoom: 1.0, // Don't zoom in too much
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initialNodes.length, flowId, fitView]);

  // 🔍 BUBBLE DEBUG: Log bubble state changes (after flowNodes is defined)
  // useEffect(() => {
  //   logBubbleDebugInfo(flowId, bubbleParameters, executionState, currentFlow, flowNodes);
  // }, [flowId, bubbleParameters, executionState.isRunning, executionState.isValidating, executionState.highlightedBubble, currentFlow.data, flowNodes]);

  const onConnect = useCallback((params: Connection) => {
    console.log('Connection created:', params);
  }, []);

  // Show loading state
  if (isLoading) {
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

  if (Object.keys(bubbleParameters).length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ backgroundColor: '#1e1e1e' }}
      >
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">No bubbles to display</p>
          <p className="text-gray-500 text-sm mb-4">
            The flow code needs to be validated to extract bubble parameters
          </p>
          {onValidate && (
            <button
              type="button"
              onClick={onValidate}
              disabled={isExecuting}
              className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Sync with code
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-hidden relative"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {onValidate && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={onValidate}
            disabled={isExecuting}
            className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Sync with code
          </button>
        </div>
      )}

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onPaneClick={() => {
          highlightBubble(null);
        }}
        proOptions={proOptions}
        minZoom={0.1}
        maxZoom={2.0}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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
