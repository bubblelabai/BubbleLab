import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
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
import { useValidateCode } from '../hooks/useValidateCode';
import { useUIStore } from '../stores/uiStore';
import { useEditor } from '../hooks/useEditor';
import { API_BASE_URL } from '../env';
import CronScheduleNode from './CronScheduleNode';

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
  const { fitView } = useReactFlow();

  // Get all data from global stores
  const { data: currentFlow, loading } = useBubbleFlow(flowId);
  const executionState = useExecutionStore(flowId);
  const { data: availableCredentials } = useCredentials(API_BASE_URL);
  const { showEditor, showEditorPanel, hideEditorPanel } = useUIStore();
  const { hasUnsavedChanges, setExecutionHighlight, updateCronSchedule } =
    useEditor(flowId);
  const validateCodeMutation = useValidateCode({ flowId });

  // Initialize execution hook
  const { runFlow } = useRunExecution(flowId);

  // Extract stable methods from execution state
  const highlightBubble = executionState.highlightBubble;
  const setCredential = executionState.setCredential;
  const setInput = executionState.setInput;

  // Derive all state from global stores
  const bubbleParameters = currentFlow?.bubbleParameters || {};
  const highlightedBubble = executionState.highlightedBubble;
  const isExecuting = executionState.isRunning;
  const bubbleWithError = executionState.bubbleWithError;
  const runningBubbles = executionState.runningBubbles;
  const completedBubbles = executionState.completedBubbles;
  const executionInputs = executionState.executionInputs;
  const pendingCredentials = executionState.pendingCredentials;
  const requiredCredentials = currentFlow?.requiredCredentials || {};
  const flowName = currentFlow?.name;
  const inputsSchema = currentFlow?.inputSchema
    ? JSON.stringify(currentFlow.inputSchema)
    : undefined;

  // Local UI state for expanded/collapsed nodes
  const [expandedRootIds, setExpandedRootIds] = useState<string[]>([]);
  const [suppressedRootIds, setSuppressedRootIds] = useState<string[]>([]);

  const eventType = currentFlow?.eventType;
  const entryNodeId =
    eventType === 'schedule/cron' ? 'cron-schedule-node' : 'input-schema-node';

  const bubbleEntries = useMemo(
    () => Object.entries(bubbleParameters),
    [bubbleParameters]
  );

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
      executionState.setInputs(defaults);
      didInitDefaultsForFlow.current = currentFlow.id;
    }
  }, [
    currentFlow?.id,
    currentFlow?.defaultInputs,
    executionInputs,
    executionState.setInputs,
  ]);

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

  const toggleRootVisibility = useCallback(
    (nodeId: string) => {
      const isExpanded = expandedRootIds.includes(nodeId);
      if (isExpanded) {
        setExpandedRootIds((prev: string[]) =>
          prev.filter((id: string) => id !== nodeId)
        );
        if (!suppressedRootIds.includes(nodeId)) {
          setSuppressedRootIds((prev: string[]) => [...prev, nodeId]);
        }
      } else {
        setExpandedRootIds((prev: string[]) => [...prev, nodeId]);
        setSuppressedRootIds((prev: string[]) =>
          prev.filter((id: string) => id !== nodeId)
        );
      }
    },
    [expandedRootIds, suppressedRootIds]
  );

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
      const isRootSuppressed = suppressedRootIds.includes(rootId);
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

      // Check execution state for dependency bubble
      const dependencyVariableId = String(dependencyNode.variableId);
      const hasErrorState = bubbleWithError === dependencyVariableId;
      const isCompletedState = dependencyVariableId in completedBubbles;
      const executionStats = completedBubbles[dependencyVariableId];

      const node: Node = {
        id: nodeId,
        type: 'bubbleNode',
        position,
        data: {
          bubble: subBubble,
          bubbleKey: nodeId,
          onParameterChange: undefined,
          isHighlighted:
            highlightedBubble === String(dependencyNode.variableId),
          onHighlightChange: () =>
            highlightBubble(String(dependencyNode.variableId) || nodeId),
          onBubbleClick: () => {},
          hasError: hasErrorState,
          isCompleted: isCompletedState,
          isExecuting: runningBubbles.has(dependencyVariableId),
          executionStats: executionStats,
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
    [
      highlightedBubble,
      autoVisibleNodes,
      isExecuting,
      highlightBubble,
      suppressedRootIds,
      bubbleWithError,
      runningBubbles,
      completedBubbles,
    ]
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

    // Create entry node based on event type
    if (flowName) {
      if (eventType === 'schedule/cron') {
        // Create CronScheduleNode for cron events
        const cronScheduleNode: Node = {
          id: 'cron-schedule-node',
          type: 'cronScheduleNode',
          position: {
            x: startX - 450,
            y: baseY,
          },
          origin: [0, 0.5] as [number, number],
          data: {
            flowId: currentFlow?.id,
            flowName: flowName,
            cronSchedule: currentFlow?.cron || '0 0 * * *',
            isActive: currentFlow?.cronActive || false,
            inputSchema: currentFlow?.inputSchema || {},
            executionInputs: currentFlow?.defaultInputs || {},
            isPending: validateCodeMutation.isPending,
            onCronScheduleChange: (newSchedule: string) => {
              // Update the cron schedule in the editor store
              updateCronSchedule(newSchedule);

              // TODO: In the future, we might want to save this to the backend
              // For now, it's just stored locally in the editor
            },
            onDefaultInputChange: (fieldName: string, value: unknown) => {
              // Update the input value in the execution state
              setInput(fieldName, value);

              // TODO: In the future, we might want to save this to the backend
              // For now, it's just stored locally in the execution state
            },
            onExecuteFlow: async () => {
              await runFlow({
                validateCode: true,
                updateCredentials: true,
                inputs: executionInputs || {},
              });
            },
            isExecuting: isExecuting,
          },
        };
        nodes.push(cronScheduleNode);
      } else if (parsedFields.length > 0) {
        // Create InputSchemaNode for regular flows with input schema
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

      const rootExpanded = expandedRootIds.includes(nodeId);
      const rootSuppressed = suppressedRootIds.includes(nodeId);
      const hasErrorState = bubbleWithError === nodeId;
      const isCompletedState = nodeId in completedBubbles;
      const executionStats = completedBubbles[nodeId];

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
            showEditorPanel();
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
              if (!showEditor) {
                showEditorPanel();
              }

              // Highlight the parameter's location in the editor
              setExecutionHighlight({
                startLine: param.location.startLine,
                endLine: param.location.endLine,
              });
            }
          },
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
          isExecuting: runningBubbles.has(nodeId),
          executionStats: executionStats,
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
    validateCodeMutation.isPending,
    highlightBubble,
    setCredential,
    setInput,
    expandedRootIds,
    suppressedRootIds,
    currentFlow,
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
        </div>
      )}

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onPaneClick={() => {
          highlightBubble(null);
          hideEditorPanel();
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
