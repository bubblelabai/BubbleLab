import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
import type {
  CredentialType,
  CredentialResponse,
  DependencyGraphNode,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import { useExecutionStore } from '../stores/executionStore';
import { useUIStore } from '../stores/uiStore';

// Keep backward compatibility - use the shared schema type
type ParsedBubble = ParsedBubbleWithInfo;

interface FlowVisualizerProps {
  bubbleParameters: Record<string | number, ParsedBubbleWithInfo>;
  onParameterChange?: (
    bubbleKey: string | number,
    paramName: string,
    newValue: unknown
  ) => void;
  // Highlighting props
  highlightedBubble?: string | null;
  onHighlightChange?: (bubbleKey: string | null) => void;
  onBubbleClick?: (
    bubbleKey: string | number,
    bubble: ParsedBubbleWithInfo
  ) => void;
  // Request editing a parameter in code (show code + highlight specific line)
  onParamEditInCode?: (
    bubbleKey: string | number,
    bubble: ParsedBubbleWithInfo,
    paramName: string
  ) => void;
  // Credentials props
  requiredCredentials?: Record<string, string[]>;
  availableCredentials?: CredentialResponse[];
  selectedCredentials?: Record<string, Record<string, number>>;
  onCredentialsPendingChange?: (
    bubbleName: string,
    credType: string,
    credId: number | null
  ) => void;
  // Flow inputs/execute props (shown on entry bubble)
  flowName?: string;
  inputsSchema?: string;
  onInputsChange?: (inputs: Record<string, unknown>) => void;
  onExecute?: () => void;
  isExecuting?: boolean;
  isFormValid?: boolean;
  // Flow input values and per-field update
  executionInputs?: Record<string, unknown>;
  onExecutionInputChange?: (fieldName: string, value: unknown) => void;
  // Loading state (flow creation or fetching flow details)
  isLoading?: boolean;
  // Validate button props
  onValidate?: () => void;
  isRunning?: boolean;
  // Error state
  bubbleWithError?: string | null;
  // Completion state
  completedBubbles?: Record<string, number>;
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
function FlowVisualizerInner({
  bubbleParameters,
  onParameterChange,
  highlightedBubble,
  onHighlightChange,
  onBubbleClick,
  onParamEditInCode,
  requiredCredentials,
  availableCredentials,
  selectedCredentials,
  onCredentialsPendingChange,
  flowName,
  inputsSchema,
  onInputsChange,
  onExecute,
  isExecuting,
  isFormValid,
  executionInputs,
  onExecutionInputChange,
  isLoading,
  onValidate,
  isRunning,
  bubbleWithError,
  completedBubbles = {},
}: FlowVisualizerProps) {
  const { fitView, getViewport, setViewport } = useReactFlow();

  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  const setCredential = useExecutionStore(
    selectedFlowId,
    (state) => state.setCredential
  );

  const bubbleEntries = useMemo(
    () => Object.entries(bubbleParameters),
    [bubbleParameters]
  );

  const [expandedRootIds, setExpandedRootIds] = useState<string[]>([]);
  const [suppressedRootIds, setSuppressedRootIds] = useState<string[]>([]);

  // When execution starts, expand all roots with dependencies; when it stops, collapse all
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
      setExpandedRootIds(allRoots);
    } else {
      setExpandedRootIds([]);
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
    setExpandedRootIds((prev) => {
      const isExpanded = prev.includes(nodeId);
      const next = isExpanded
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId];
      // Manage suppression so Hide acts as a master control
      setSuppressedRootIds((suppressed) => {
        if (isExpanded) {
          // User clicked Hide -> suppress auto-visibility for this root
          return suppressed.includes(nodeId)
            ? suppressed
            : [...suppressed, nodeId];
        }
        // User clicked Show -> remove suppression for this root
        return suppressed.filter((id) => id !== nodeId);
      });
      return next;
    });
  }, []);

  // When execution highlights any sub-bubble, auto-expand the entire root branch once,
  // unless the user explicitly suppressed it via Hide. Only applies while executing.
  useEffect(() => {
    if (!isExecuting || !highlightedBubble) return;
    let current: string | undefined =
      dependencyCanonicalIdMap.get(highlightedBubble) || highlightedBubble;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const parent = dependencyParentMap.get(current);
      if (!parent) break;
      current = dependencyCanonicalIdMap.get(parent) || parent;
    }
    const rootId = current;
    if (!rootId) return;
    // Respect user suppression
    if (suppressedRootIds.includes(rootId)) return;
    setExpandedRootIds((prev) =>
      prev.includes(rootId) ? prev : [...prev, rootId]
    );
  }, [
    highlightedBubble,
    dependencyParentMap,
    dependencyCanonicalIdMap,
    suppressedRootIds,
    isExecuting,
  ]);

  // Helper function to create nodes from dependency graph, placing dependencies BELOW their parent
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
      const verticalSpacing = 220; // Distance between parent and its dependency row
      const siblingHorizontalSpacing = 200; // Space between sibling dependency nodes

      // Create a sub-bubble for the dependency
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
      const isRootSuppressed = suppressedRootIds.includes(rootId);
      const shouldRender =
        isExecuting ||
        ((rootExpanded || (isExecuting && isNodeAutoVisible)) &&
          !isRootSuppressed);

      if (!shouldRender) {
        return;
      }

      // Position relative to parent
      const parentNode =
        parentNodeId && nodes.find((n) => n.id === parentNodeId);
      const baseX = parentNode ? parentNode.position.x : 50;
      const baseY = parentNode ? parentNode.position.y : 50;

      // Center siblings under the parent
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
          onParameterChange: undefined, // Sub-bubbles don't have editable parameters
          isHighlighted:
            highlightedBubble === nodeId ||
            highlightedBubble === String(dependencyNode.variableId),
          onHighlightChange: onHighlightChange
            ? () =>
                onHighlightChange(String(dependencyNode.variableId) || nodeId)
            : undefined,
          onBubbleClick: onBubbleClick
            ? () => onBubbleClick(nodeId, subBubble)
            : undefined,
        },
      };
      nodes.push(node);

      // Create edge from parent to this node (ensure parent exists)
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

      // Recursively create nodes for dependencies
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
    [
      highlightedBubble,
      onHighlightChange,
      onBubbleClick,
      autoVisibleNodes,
      suppressedRootIds,
      isExecuting,
    ]
  );

  // Convert bubbles to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const horizontalSpacing = 450; // Increased space between nodes horizontally
    const baseY = 300; // Moved up to prevent top cutoff
    const startX = 50; // Reduced left padding

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

    // Parse a minimal JSON schema to fields for inline inputs
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

    // Build helpers for validation mapping

    // Determine which required credentials and inputs are missing per bubble
    const requiredByKey = requiredCredentials || {};
    const selectedByKey = selectedCredentials || {};

    const isSystemCredential = (credType: CredentialType) => {
      return SYSTEM_CREDENTIALS.has(credType);
    };

    // Create InputSchemaNode as the first node (if schema exists)
    if (parsedFields.length > 0 && flowName) {
      const inputSchemaNode: Node = {
        id: 'input-schema-node',
        type: 'inputSchemaNode',
        position: {
          x: startX - 450, // Position it before the first bubble
          y: baseY,
        },
        origin: [0, 0.5] as [number, number],
        data: {
          flowName: flowName,
          schemaFields: parsedFields,
          executionInputs: executionInputs || {},
          onExecutionInputChange: onExecutionInputChange || (() => {}),
          onExecuteFlow: onExecute,
          isExecuting: isExecuting,
          isFormValid: isFormValid,
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

      // Determine which key in requiredCredentials applies to this bubble
      const keyCandidates = [
        String(bubble.variableId),
        bubble.variableName,
        bubble.bubbleName,
      ];
      const credentialsKeyForBubble =
        keyCandidates.find(
          (k) =>
            k && Array.isArray((requiredByKey as Record<string, unknown>)[k])
        ) || bubble.bubbleName;

      // Determine missing credentials for this bubble
      const requiredCredTypes =
        (requiredByKey as Record<string, string[]>)[credentialsKeyForBubble] ||
        [];

      const missingCreds = requiredCredTypes.some((credType) => {
        if (isSystemCredential(credType as CredentialType)) return false;
        const selected =
          (selectedByKey as Record<string, Record<string, number>>)[
            credentialsKeyForBubble
          ] || {};
        const selectedId = selected[credType];
        return selectedId === undefined || selectedId === null;
      });

      const rootExpanded = expandedRootIds.includes(nodeId);
      const rootSuppressed = suppressedRootIds.includes(nodeId);

      const hasErrorState = bubbleWithError === nodeId;
      if (hasErrorState) {
        console.log(
          '🔴 Setting error state for bubble:',
          nodeId,
          'bubbleWithError:',
          bubbleWithError
        );
      }

      const isCompletedState = nodeId in completedBubbles;
      const executionTimeMs = completedBubbles[nodeId];

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position: {
          x: startX + index * horizontalSpacing, // Horizontal layout: each node spaced horizontally with offset
          y: baseY, // Fixed Y position for all nodes
        },
        // Add origin positioning to center-align nodes vertically
        origin: [0, 0.5] as [number, number],
        data: {
          bubble,
          bubbleKey: key,
          hasMissingRequirements: missingCreds,
          hasMissingCredentials: missingCreds,
          onParameterChange: onParameterChange
            ? (paramName: string, newValue: unknown) =>
                onParameterChange(key, paramName, newValue)
            : undefined,
          isHighlighted: highlightedBubble === key,
          onHighlightChange: onHighlightChange
            ? () => onHighlightChange(key)
            : undefined,
          onBubbleClick: onBubbleClick
            ? () => onBubbleClick(key, bubble)
            : undefined,
          onParamEditInCode: onParamEditInCode
            ? (paramName: string) => onParamEditInCode(key, bubble, paramName)
            : undefined,
          hasSubBubbles: !!bubble.dependencyGraph?.dependencies?.length,
          areSubBubblesVisible:
            isExecuting || (rootExpanded && !rootSuppressed),
          onToggleSubBubbles: bubble.dependencyGraph?.dependencies?.length
            ? () => toggleRootVisibility(nodeId)
            : undefined,
          // Credentials-specific data
          requiredCredentialTypes: requiredCredentials
            ? requiredCredentials[credentialsKeyForBubble] || []
            : [],
          availableCredentials: availableCredentials || [],
          selectedBubbleCredentials: selectedCredentials
            ? selectedCredentials[credentialsKeyForBubble] || {}
            : {},
          onCredentialSelectionChange: (
            credType: string,
            credId: number | null
          ) => {
            setCredential(String(bubble.variableId), credType, credId);
          },
          // Error state
          hasError: hasErrorState,
          // Completion state
          isCompleted: isCompletedState,
          executionTimeMs: executionTimeMs,
        },
      };
      nodes.push(node);

      // Create sub-bubbles from dependency graph (positioned beneath parent)
      if (bubble.dependencyGraph?.dependencies) {
        bubble.dependencyGraph.dependencies.forEach((dep, idx, arr) => {
          createNodesFromDependencyGraph(
            dep,
            bubble,
            nodes,
            edges,
            1, // level
            nodeId, // parentNodeId
            idx,
            arr.length,
            `${idx}`,
            rootExpanded,
            nodeId
          );
        });
      }
    });

    // Add sequential flow connections between main bubbles (based on line numbers)
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
      .sort((a, b) => a.startLine - b.startLine); // Sort by line number

    // Connect InputSchemaNode to the first bubble (if input schema node exists)
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
            stroke: '#60a5fa', // Blue to match the input schema node theme
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
        });
      }
    }

    // Connect main bubbles sequentially (different color from dependency edges)
    for (let i = 0; i < mainBubbles.length - 1; i++) {
      const sourceNodeId = mainBubbles[i].nodeId;
      const targetNodeId = mainBubbles[i + 1].nodeId;

      // Ensure both nodes exist
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
          sourceHandle: 'right', // Connect from right side of source node
          targetHandle: 'left', // Connect to left side of target node
          type: 'straight', // Different type for sequential flow
          animated: true, // Now animated like dependency edges
          style: {
            stroke: isSequentialEdgeHighlighted ? '#9333ea' : '#9ca3af', // Purple/gray for sequence flow
            strokeWidth: isSequentialEdgeHighlighted ? 3 : 2,
            strokeDasharray: '5,5', // Dashed line to distinguish from dependency edges
          },
        });
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [
    bubbleEntries,
    onParamEditInCode,
    suppressedRootIds,
    bubbleParameters,
    expandedRootIds,
    autoVisibleNodes,
    onParameterChange,
    highlightedBubble,
    onHighlightChange,
    onBubbleClick,
    requiredCredentials,
    availableCredentials,
    selectedCredentials,
    onCredentialsPendingChange,
    flowName,
    inputsSchema,
    onInputsChange,
    onExecute,
    isExecuting,
    isFormValid,
    executionInputs,
    onExecutionInputChange,
    createNodesFromDependencyGraph,
    toggleRootVisibility,
    bubbleWithError,
    completedBubbles,
  ]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Use ref to track previous initialNodes to detect actual changes
  const prevInitialNodesRef = useRef(initialNodes);

  // Track if we've done the initial fit view - only auto-fit once per flow
  const hasInitialFitRef = useRef(false);

  // Track the set of bubble IDs to detect when we switch to a completely different flow
  const prevBubbleIdsRef = useRef<string>(
    Object.keys(bubbleParameters).sort().join(',')
  );

  // Update nodes when inputs that affect node rendering change, preserving user positions
  useEffect(() => {
    const prevInitialNodes = prevInitialNodesRef.current;
    const currentBubbleIds = Object.keys(bubbleParameters).sort().join(',');
    const prevBubbleIds = prevBubbleIdsRef.current;

    // Reset the fit flag if we've switched to a different flow (different set of bubbles)
    if (currentBubbleIds !== prevBubbleIds) {
      hasInitialFitRef.current = false;
      prevBubbleIdsRef.current = currentBubbleIds;
    }

    // Check for structural changes (nodes added/removed or IDs changed)
    const hasStructuralChange =
      prevInitialNodes.length !== initialNodes.length ||
      !prevInitialNodes.every(
        (prevNode, index) => prevNode.id === initialNodes[index]?.id
      );

    if (hasStructuralChange) {
      // When updating nodes, preserve existing positions where possible
      setFlowNodes((currentNodes) => {
        const updatedNodes = initialNodes.map((initNode) => {
          const existingNode = currentNodes.find(
            (node) => node.id === initNode.id
          );
          return existingNode
            ? { ...initNode, position: existingNode.position }
            : initNode;
        });
        return updatedNodes;
      });
    } else {
      // No structural change, just update node data in place to preserve positions and zoom
      setFlowNodes((currentNodes) => {
        return currentNodes.map((currentNode) => {
          const updatedNode = initialNodes.find((n) => n.id === currentNode.id);
          return updatedNode
            ? { ...updatedNode, position: currentNode.position }
            : currentNode;
        });
      });
    }

    // Always update edges as they don't have user-modified positions
    setFlowEdges(initialEdges);

    // Auto-fit viewport on first load or when switching to a new flow (not on data-only changes)
    if (initialNodes.length > 0 && !hasInitialFitRef.current) {
      hasInitialFitRef.current = true;
      setTimeout(() => {
        // Check if InputSchemaNode exists
        const inputSchemaNode = initialNodes.find(
          (node) => node.id === 'input-schema-node'
        );

        // If there are more than 4 main bubbles, fit to InputSchemaNode + first 4 bubbles
        const mainBubbleCount = bubbleEntries.length;
        if (mainBubbleCount > 4) {
          // Find the first 4 main bubble nodes
          const firstFourMainBubbles = initialNodes
            .filter((node) => {
              // Check if this is a main bubble (not a dependency sub-bubble)
              const bubbleKey = node.data.bubbleKey;
              const bubbleIndex = bubbleEntries.findIndex(
                ([key]) => String(key) === String(bubbleKey)
              );
              return bubbleIndex >= 0 && bubbleIndex < 4;
            })
            .slice(0, 4);

          // Include InputSchemaNode if it exists
          const nodesToFit = inputSchemaNode
            ? [inputSchemaNode, ...firstFourMainBubbles]
            : firstFourMainBubbles;

          if (nodesToFit.length > 0) {
            fitView({
              nodes: nodesToFit,
              padding: 0.1,
              includeHiddenNodes: false,
              minZoom: 0.1,
              maxZoom: 1.5,
            });
          }
        } else {
          // Default behavior for 4 or fewer bubbles - include InputSchemaNode if exists
          if (inputSchemaNode) {
            // Fit to InputSchemaNode + all main bubbles
            const mainBubbleNodes = initialNodes.filter((node) => {
              const bubbleKey = node.data.bubbleKey;
              return bubbleEntries.some(
                ([key]) => String(key) === String(bubbleKey)
              );
            });
            const nodesToFit = [inputSchemaNode, ...mainBubbleNodes];
            fitView({
              nodes: nodesToFit,
              padding: 0.1,
              includeHiddenNodes: false,
              minZoom: 0.1,
              maxZoom: 1.5,
            });
          } else {
            // No InputSchemaNode, fit all nodes
            fitView({
              padding: 0.1,
              includeHiddenNodes: false,
              minZoom: 0.1,
              maxZoom: 1.5,
            });
          }
        }
      }, 200);
    }

    // Update the ref for next comparison
    prevInitialNodesRef.current = initialNodes;
  }, [
    bubbleEntries,
    initialNodes,
    initialEdges,
    setFlowNodes,
    setFlowEdges,
    fitView,
    isExecuting,
  ]);

  // When credential-related props change, refresh node data in place to trigger rerender
  useEffect(() => {
    setFlowNodes((existing) =>
      existing.map((node) => {
        const updated = initialNodes.find((n) => n.id === node.id);
        return updated ? { ...node, data: updated.data } : node;
      })
    );
  }, [
    selectedCredentials,
    requiredCredentials,
    availableCredentials,
    onCredentialsPendingChange,
    initialNodes,
    setFlowNodes,
  ]);

  // Auto-scroll to center highlighted bubble during execution
  useEffect(() => {
    if (highlightedBubble && isExecuting && flowNodes.length > 0) {
      const highlightedNode = flowNodes.find(
        (node) =>
          node.id === highlightedBubble ||
          node.data.bubbleKey === highlightedBubble ||
          String(
            (node.data as { bubble?: { variableId?: number } }).bubble
              ?.variableId
          ) === highlightedBubble
      );

      if (highlightedNode) {
        // Use setTimeout to ensure the node is rendered before centering
        setTimeout(() => {
          try {
            // Calculate the center position for the highlighted node
            const nodeX = highlightedNode.position.x;
            const nodeY = highlightedNode.position.y;

            // Calculate the new viewport to center the node
            const newX = -nodeX + window.innerWidth * 0.4; // Center horizontally with some offset
            const newY = -nodeY + window.innerHeight * 0.4; // Center vertically with some offset

            // Set the new viewport with animation
            setViewport({ x: newX, y: newY, zoom: 0.8 }, { duration: 800 });

            // Also try fitView as backup
            setTimeout(() => {
              fitView({
                nodes: [highlightedNode],
                padding: 0.2,
                includeHiddenNodes: false,
                minZoom: 0.3,
                maxZoom: 1.0,
                duration: 800,
              });
            }, 100);
          } catch (error) {
            console.error('Error in auto-scroll:', error);
          }
        }, 100);
      }
    }
  }, [
    highlightedBubble,
    isExecuting,
    flowNodes,
    fitView,
    getViewport,
    setViewport,
  ]);

  const onConnect = useCallback((params: Connection) => {
    // Handle new connections if needed
    console.log('Connection created:', params);
  }, []);

  // Show loading state when flow is being created or fetched
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
          <p className="text-gray-500 text-sm">
            Generate or run code to see the flow visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-hidden relative"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {/* Sync with Code Button - Top Left */}
      {onValidate && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={onValidate}
            disabled={isRunning}
            className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Sync with code
          </button>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => {
          // Deselect when clicking on empty area
          onHighlightChange?.(null);
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
