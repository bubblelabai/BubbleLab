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
import BubbleNode from './BubbleNode';
import InputSchemaNode from './InputSchemaNode';
import type {
  DependencyGraphNode,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { useExecutionStore, getExecutionStore } from '../stores/executionStore';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useUIStore } from '../stores/uiStore';
import { useEditor } from '../hooks/useEditor';
import CronScheduleNode from './CronScheduleNode';
import { WebhookURLDisplay } from './WebhookURLDisplay';
import { getLiveOutputStore } from '@/stores/liveOutputStore';

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
};

const proOptions = { hideAttribution: true };

const sanitizeIdSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '') || 'segment';

// Executing bubble viewport preferences (tweak these)
const EXECUTION_LEFT_OFFSET_RATIO = 0.1; // 0 = center, 0.3 = ~30% from left
const EXECUTION_ZOOM = 1.0; // Set desired zoom when centering during execution

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
  const { data: currentFlow, loading } = useBubbleFlow(flowId);
  const { hasUnsavedChanges, setExecutionHighlight } = useEditor(flowId);
  // Select only needed execution store actions/state to avoid re-renders from events
  // Note: Individual nodes subscribe to their own state - FlowVisualizer only needs minimal state
  const setInputs = useExecutionStore(flowId, (s) => s.setInputs);
  const highlightedBubble = useExecutionStore(
    flowId,
    (s) => s.highlightedBubble
  );
  const isExecuting = useExecutionStore(flowId, (s) => s.isRunning);
  const runningBubbles = useExecutionStore(flowId, (s) => s.runningBubbles);
  const executionInputs = useExecutionStore(flowId, (s) => s.executionInputs);
  // Subscribe to expandedRootIds and suppressedRootIds so nodes/edges sync when toggled
  const expandedRootIds = useExecutionStore(flowId, (s) => s.expandedRootIds);
  const suppressedRootIds = useExecutionStore(
    flowId,
    (s) => s.suppressedRootIds
  );
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
    const entries = Object.entries(bubbleParameters);
    // Sort by startLine to ensure consistent ordering (matching edge creation logic)
    return entries.sort(([, a], [, b]) => {
      const aStartLine = (a as ParsedBubble)?.location?.startLine ?? 0;
      const bStartLine = (b as ParsedBubble)?.location?.startLine ?? 0;
      return aStartLine - bStartLine;
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

  // Auto-expand roots when execution starts (but don't auto-collapse when execution stops)
  // This prevents flicker when execution completes - sub-bubbles stay visible
  useEffect(() => {
    const executionStore = getExecutionStore(currentFlow?.id || flowId);
    const currentExpanded = executionStore.expandedRootIds;

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

      const parentNode =
        parentNodeId && nodes.find((n) => n.id === parentNodeId);
      const baseX = parentNode ? parentNode.position.x : 50;
      const baseY = parentNode ? parentNode.position.y : 50;

      const rowWidth =
        siblingsTotal > 1 ? (siblingsTotal - 1) * siblingHorizontalSpacing : 0;
      const initialPosition = {
        x: baseX - rowWidth / 2 + siblingIndex * siblingHorizontalSpacing,
        y: baseY + verticalSpacing,
      };

      // Use persisted position if available, otherwise use initial position
      const persistedPosition = persistedPositions.current.get(nodeId);
      const position = persistedPosition || initialPosition;

      // Note: Sub-bubbles will subscribe to their own execution state via BubbleNode

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position,
        draggable: true,
        data: {
          flowId: currentFlow?.id || flowId,
          bubble: subBubble,
          bubbleKey: nodeId,
          onHighlightChange: () => {
            // BubbleNode will handle store updates
          },
          onBubbleClick: () => {},
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
          rootId
        );
      });
    },
    [autoVisibleNodes, currentFlow, flowId]
  );

  // Convert bubbles to React Flow nodes and edges
  const initialNodesAndEdges = () => {
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
            x: startX - 450,
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
            x: startX - 450,
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

    // Create nodes for each bubble
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
  };

  // Track previous expandedRootIds and currentFlow to detect changes
  const prevExpandedRootIdsRef = useRef<string[]>([]);
  const prevFlowIdRef = useRef<number | undefined>(undefined);

  // Sync nodes and edges state with computed values, preserving positions
  useEffect(() => {
    const { initialNodes, initialEdges } = initialNodesAndEdges();

    const flowChanged = prevFlowIdRef.current !== currentFlow?.id;
    const expandedChanged =
      prevExpandedRootIdsRef.current.length !== expandedRootIds.length ||
      !prevExpandedRootIdsRef.current.every((id) =>
        expandedRootIds.includes(id)
      ) ||
      !expandedRootIds.every((id) =>
        prevExpandedRootIdsRef.current.includes(id)
      );

    setNodes((currentNodes) => {
      // If this is the first time we have nodes, just set them
      if (currentNodes.length === 0 || flowChanged) {
        prevExpandedRootIdsRef.current = expandedRootIds;
        prevFlowIdRef.current = currentFlow?.id;
        return initialNodes;
      }

      // If only expandedRootIds changed (not flow structure), use incremental updates
      if (expandedChanged && !flowChanged && currentFlow?.id) {
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
        return currentNodes;
      }

      // For flow structure changes, merge positions and update
      const updatedNodes = initialNodes.map((initialNode) => {
        const currentNode = currentNodes.find((n) => n.id === initialNode.id);
        if (currentNode) {
          // Keep the current position if node exists
          return { ...initialNode, position: currentNode.position };
        }
        return initialNode;
      });

      prevExpandedRootIdsRef.current = expandedRootIds;
      prevFlowIdRef.current = currentFlow?.id;
      return updatedNodes;
    });

    // For edges, only update if nodes changed
    setEdges((currentEdges) => {
      if (flowChanged) {
        prevExpandedRootIdsRef.current = expandedRootIds;
        prevFlowIdRef.current = currentFlow?.id;
        return initialEdges;
      }

      const currentEdgeIds = new Set(currentEdges.map((e) => e.id));
      const initialEdgeIds = new Set(initialEdges.map((e) => e.id));

      // If only expandedRootIds changed, use incremental edge updates
      if (expandedChanged && !flowChanged && currentFlow?.id) {
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
        return currentEdges;
      }

      return currentEdges;
    });
  }, [currentFlow, expandedRootIds]);

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
          const horizontalShift = (viewportWidth * 0.3) / zoom; // Shift right to position node on left

          setCenter(
            entryNode.position.x + horizontalShift,
            entryNode.position.y,
            {
              zoom: zoom,
              duration: 300,
            }
          );

          // Mark that we've set the initial view
          hasSetInitialView.current = true;
        }
      }, 100);

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

    lastCenteredBubbleIdRef.current = chosenId;
    const zoom = EXECUTION_ZOOM || 1;
    const viewportWidth = window.innerWidth;
    const horizontalShift =
      (viewportWidth * EXECUTION_LEFT_OFFSET_RATIO) / zoom;
    setCenter(node.position.x + horizontalShift, node.position.y, {
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onValidate}
                disabled={isExecuting}
                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sync with code
              </button>
              {hasUnsavedChanges && (
                <div className="bg-orange-500/20 border border-orange-500/50 px-3 py-1 rounded-lg text-xs font-medium text-orange-300">
                  Unsaved changes
                </div>
              )}
            </div>
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
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={onValidate}
            disabled={isExecuting}
            className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed disabled:border-gray-600/50 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-purple-300 hover:text-purple-200 disabled:text-gray-400 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Sync with code
          </button>
          {hasUnsavedChanges && (
            <div className="bg-orange-500/20 border border-orange-500/50 px-2 py-1 rounded text-xs font-medium text-orange-300">
              Unsaved
            </div>
          )}
          {currentFlow?.id ? (
            <WebhookURLDisplay flowId={currentFlow.id} />
          ) : null}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => {
          // When a bubble node is clicked, select its tab in the console panel
          if (node.type === 'bubbleNode') {
            getLiveOutputStore(flowId)
              ?.getState()
              .selectBubbleInConsole(node.id);
          }
        }}
        onPaneClick={() => {
          getExecutionStore(currentFlow?.id || flowId).highlightBubble(null);
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
