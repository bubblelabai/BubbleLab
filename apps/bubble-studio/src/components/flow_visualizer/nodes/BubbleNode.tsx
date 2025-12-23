import { memo, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CogIcon } from '@heroicons/react/24/outline';
import { BookOpen, Code } from 'lucide-react';
import { CredentialType, AvailableModels } from '@bubblelab/shared-schemas';
import type {
  AvailableModel,
  BubbleParameter,
} from '@bubblelab/shared-schemas';
import { CreateCredentialModal } from '@/pages/CredentialsPage';
import { useCreateCredential } from '@/hooks/useCredentials';
import { findLogoForBubble, findDocsUrlForBubble } from '@/lib/integrations';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import BubbleExecutionBadge from '@/components/flow_visualizer/BubbleExecutionBadge';
import BubbleDetailsOverlay from '@/components/flow_visualizer/BubbleDetailsOverlay';
import {
  BUBBLE_COLORS,
  BADGE_COLORS,
} from '@/components/flow_visualizer/BubbleColors';
import { useUIStore } from '@/stores/uiStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useCredentials } from '@/hooks/useCredentials';
import { API_BASE_URL } from '@/env';
import {
  getLiveOutputStore,
  useLiveOutputStore,
} from '@/stores/liveOutputStore';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useEditor } from '@/hooks/useEditor';
import { extractParamValue } from '@/utils/bubbleParamEditor';
import { getInlineParamConfigs } from '@/config/bubbleInlineParams';

export interface BubbleNodeData {
  flowId: number;
  bubble: ParsedBubbleWithInfo;
  bubbleKey: string | number;
  requiredCredentialTypes?: string[]; // Static data from flow - not execution state
  onParameterChange?: (paramName: string, newValue: unknown) => void;
  onHighlightChange?: () => void;
  onBubbleClick?: () => void;
  // Request to edit a specific parameter in code (show code + highlight line)
  onParamEditInCode?: (paramName: string) => void;
  hasSubBubbles?: boolean;
  isCustomToolBubble?: boolean; // Whether this bubble is inside a custom tool container (rendered smaller)
  usedHandles?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

interface BubbleNodeProps {
  data: BubbleNodeData;
}

/**
 * Generic inline params component - renders based on config
 */
interface BubbleInlineParamsProps {
  bubbleName: string | undefined;
  variableId: number;
  getParam: (
    variableId: number,
    paramName: string
  ) => BubbleParameter | undefined;
  updateBubbleParam: (
    variableId: number,
    paramName: string,
    newValue: unknown
  ) => void;
  onOpenDetails: () => void;
}

function BubbleInlineParams({
  bubbleName,
  variableId,
  getParam,
  updateBubbleParam,
  onOpenDetails,
}: BubbleInlineParamsProps) {
  const configs = getInlineParamConfigs(bubbleName);

  if (configs.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {configs.map((config) => {
        const extracted = extractParamValue(
          getParam(variableId, config.paramName),
          config.paramPath,
          bubbleName
        );

        if (!extracted?.shouldBeEditable) {
          return null;
        }

        const value = extracted.value;

        // Model dropdown
        if (config.isModel && config.inlineDisplay === 'dropdown') {
          return (
            <div key={config.paramName} className="space-y-1">
              <label className="block text-xs font-medium text-purple-300">
                {config.label || config.paramName}
              </label>
              <select
                title={`Select ${config.label || config.paramName}`}
                value={value as string}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  updateBubbleParam(
                    variableId,
                    config.paramPath,
                    e.target.value
                  )
                }
                className="w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-500 rounded text-neutral-100 focus:border-purple-500 focus:outline-none"
              >
                {AvailableModels.options.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        // Preview (truncated text that opens details on click)
        if (
          config.inlineDisplay === 'preview' &&
          typeof value === 'string' &&
          value
        ) {
          return (
            <div key={config.paramName} className="space-y-1">
              <label className="block text-xs font-medium text-purple-300">
                {config.label || config.paramName}
              </label>
              <p
                className="px-2 py-1.5 text-[11px] bg-neutral-800 border border-neutral-600 rounded text-neutral-300 truncate cursor-pointer hover:bg-neutral-700 transition-colors"
                title={value}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails();
                }}
              >
                {value.length > 80 ? value.substring(0, 80) + '...' : value}
              </p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function BubbleNode({ data }: BubbleNodeProps) {
  const {
    flowId,
    bubble,
    bubbleKey,
    requiredCredentialTypes: propRequiredCredentialTypes = [],
    onBubbleClick,
    onParamEditInCode,
    hasSubBubbles = false,
    isCustomToolBubble = false,
    usedHandles = {},
  } = data;

  // Determine the bubble ID for store lookups (prefer variableId, fallback to bubbleKey)
  const bubbleId = bubble.variableId
    ? String(bubble.variableId)
    : String(bubbleKey);

  // Determine numeric root ID for expansion checks (expandedRootIds/suppressedRootIds are number[])
  const rootId =
    bubble.variableId ??
    (typeof bubbleKey === 'number'
      ? bubbleKey
      : parseInt(String(bubbleKey), 10));

  // Determine credentials key (try variableId, variableName, bubbleName, fallback to bubbleKey)
  const credentialsKey = String(
    bubble.variableId || bubble.variableName || bubble.bubbleName || bubbleKey
  );

  // Subscribe to execution store state for this bubble (using selectors to avoid re-renders from events)
  const highlightedBubble = useExecutionStore(
    flowId,
    (s) => s.highlightedBubble
  );
  const bubbleWithError = useExecutionStore(flowId, (s) => s.bubbleWithError);
  const bubbleResults = useExecutionStore(flowId, (s) => s.bubbleResults);
  const runningBubbles = useExecutionStore(flowId, (s) => s.runningBubbles);
  const completedBubbles = useExecutionStore(flowId, (s) => s.completedBubbles);
  const pendingCredentials = useExecutionStore(
    flowId,
    (s) => s.pendingCredentials
  );

  // Get actions from store
  const setCredential = useExecutionStore(flowId, (s) => s.setCredential);
  const toggleRootExpansion = useExecutionStore(
    flowId,
    (s) => s.toggleRootExpansion
  );

  // Get flow data to find clones
  const { data: currentFlow } = useBubbleFlow(flowId);

  // Get editor functions for accessing/updating params
  const { getParam, updateBubbleParam } = useEditor(flowId);

  // Get sub-bubble visibility state from store
  const expandedRootIds = useExecutionStore(flowId, (s) => s.expandedRootIds);
  const suppressedRootIds = useExecutionStore(
    flowId,
    (s) => s.suppressedRootIds
  );

  // Compute if sub-bubbles are visible (local to this bubble node)
  const areSubBubblesVisibleLocal = useMemo(() => {
    if (!hasSubBubbles) return false;
    if (isNaN(rootId)) return false;
    const rootExpanded = expandedRootIds.includes(rootId);
    const rootSuppressed = suppressedRootIds.includes(rootId);
    return rootExpanded && !rootSuppressed;
  }, [hasSubBubbles, expandedRootIds, suppressedRootIds, rootId]);

  // Get available credentials
  const { data: availableCredentials = [] } = useCredentials(API_BASE_URL);

  // Subscribe to selected event index and tab reactively (causes re-render when changed)
  const selectedEventIndexByVariableId = useLiveOutputStore(
    flowId,
    (s) => s.selectedEventIndexByVariableId
  );
  const selectedTab = useLiveOutputStore(flowId, (s) => s.selectedTab);
  const selectedEventIndex = selectedEventIndexByVariableId[bubbleId];

  // Get total event count for this bubble to determine if we're on first/last
  const liveOutputStore = getLiveOutputStore(flowId);
  const orderedItems = liveOutputStore?.getState().getOrderedItems() || [];
  const bubbleGroup = orderedItems.find(
    (item) => item.kind === 'group' && item.name === bubbleId
  );
  const totalEvents =
    bubbleGroup && bubbleGroup.kind === 'group' ? bubbleGroup.events.length : 0;
  const lastEventIndex = Math.max(0, totalEvents - 1);

  // Check if this bubble is the one currently being viewed in console
  const activeItem =
    selectedTab.kind === 'item' ? orderedItems[selectedTab.index] : null;
  const isThisBubbleActiveInConsole =
    activeItem?.kind === 'group' && activeItem.name === bubbleId;

  // Determine if Input or Output button should be highlighted
  // Only highlight if this bubble is the active one in the console
  const isInputSelected =
    isThisBubbleActiveInConsole && selectedEventIndex === 0;
  const isOutputSelected =
    isThisBubbleActiveInConsole &&
    selectedEventIndex === lastEventIndex &&
    totalEvents > 0;

  // Determine bubble-specific state
  const isHighlighted =
    highlightedBubble === bubbleKey || highlightedBubble === bubbleId;

  // Check for errors: either fatal error OR result.success === false
  const resultSuccess = bubbleResults[bubbleId];
  const hasError =
    bubbleWithError === bubbleId ||
    (resultSuccess !== undefined && resultSuccess === false);

  const isExecuting = runningBubbles.has(bubbleId);
  const isCompleted = bubbleId in completedBubbles;
  const executionStats = completedBubbles[bubbleId];

  // Get selected credentials for this bubble
  const selectedBubbleCredentials = pendingCredentials[credentialsKey] || {};

  // Get required credential types - prefer prop (from flow.requiredCredentials), fallback to bubble parameters
  const requiredCredentialTypes = useMemo(() => {
    if (propRequiredCredentialTypes.length > 0) {
      return propRequiredCredentialTypes;
    }
    // Fallback: derive from bubble's credentials parameter
    const credParams = bubble.parameters.find((p) => p.name === 'credentials');
    if (
      !credParams ||
      typeof credParams.value !== 'object' ||
      !credParams.value
    ) {
      return [];
    }
    const credValue = credParams.value as Record<string, unknown>;
    return Object.keys(credValue);
  }, [propRequiredCredentialTypes, bubble.parameters]);

  // Check if credentials are missing
  const hasMissingRequirements = requiredCredentialTypes.some((credType) => {
    if (SYSTEM_CREDENTIALS.has(credType as CredentialType)) return false;
    const selectedId = selectedBubbleCredentials[credType];
    return selectedId === undefined || selectedId === null;
  });

  const handleCredentialChange = (credType: string, credId: number | null) => {
    // Update credential for this bubble
    setCredential(credentialsKey, credType, credId);

    if (!currentFlow?.bubbleParameters) return;

    const bubbleParameters = currentFlow.bubbleParameters;

    // If this is a clone (has invocationCallSiteKey), also update the original
    if (
      bubble.invocationCallSiteKey &&
      bubble.clonedFromVariableId !== undefined
    ) {
      // Find the original bubble (where variableId matches clonedFromVariableId)
      Object.entries(bubbleParameters).forEach(([key, otherBubble]) => {
        if (otherBubble.variableId === bubble.clonedFromVariableId) {
          // This is the original - update its credential too
          setCredential(key, credType, credId);
        }
      });
    }

    // If this is an original bubble (no invocationCallSiteKey), also update all its clones
    if (!bubble.invocationCallSiteKey) {
      // Find all clones of this bubble (clones have clonedFromVariableId matching this bubble's variableId)
      Object.entries(bubbleParameters).forEach(([key, otherBubble]) => {
        if (
          otherBubble.invocationCallSiteKey &&
          otherBubble.clonedFromVariableId === bubble.variableId
        ) {
          // This is a clone - update its credential too
          setCredential(key, credType, credId);
        }
      });
    }
  };

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [createModalForType, setCreateModalForType] = useState<string | null>(
    null
  );
  const [showDocsTooltip, setShowDocsTooltip] = useState(false);
  const [showCodeTooltip, setShowCodeTooltip] = useState(false);

  const { showEditor } = useUIStore();
  const logo = useMemo(
    () =>
      findLogoForBubble({
        bubbleName: bubble?.bubbleName,
        className: bubble?.className,
        variableName: bubble?.variableName,
      }),
    [bubble?.bubbleName, bubble?.className, bubble?.variableName]
  );

  const docsUrl = useMemo(
    () =>
      findDocsUrlForBubble({
        bubbleName: bubble?.bubbleName,
        className: bubble?.className,
        variableName: bubble?.variableName,
      }),
    [bubble?.bubbleName, bubble?.className, bubble?.variableName]
  );

  const isSystemCredential = useMemo(() => {
    return (credType: CredentialType) => SYSTEM_CREDENTIALS.has(credType);
  }, []);

  const getCredentialsForType = (credType: string) => {
    return availableCredentials.filter(
      (cred) => cred.credentialType === credType
    );
  };

  const createCredentialMutation = useCreateCredential();

  const handleErrorClick = () => {
    // Navigate to the console showing this bubble's last log
    const liveOutputStore = getLiveOutputStore(flowId);
    liveOutputStore?.getState().selectBubbleInConsole(bubbleId);
  };
  // Determine if this is a sub-bubble based on variableId being negative or having a uniqueId with dots
  const isSubBubble =
    bubble.variableId < 0 ||
    (bubble.dependencyGraph?.uniqueId?.includes('.') ?? false);

  // Bubbles inside custom tool containers or sub-bubbles are rendered smaller
  const isSmallBubble = isSubBubble || isCustomToolBubble;

  return (
    <div
      className={`bg-neutral-800/90 rounded-lg border transition-all duration-300 cursor-pointer ${
        isCompleted ? 'overflow-visible' : 'overflow-hidden'
      } ${
        isSmallBubble
          ? 'bg-gray-600 border-gray-500 scale-75 w-64' // Sub-bubbles and custom tool bubbles are smaller and darker
          : 'bg-gray-700 border-gray-600 w-80' // Main bubbles fixed width
      } ${
        isExecuting
          ? `${BUBBLE_COLORS.RUNNING.border} ${isHighlighted ? BUBBLE_COLORS.SELECTED.background : BUBBLE_COLORS.RUNNING.background}`
          : hasError
            ? `${BUBBLE_COLORS.ERROR.border} ${isHighlighted ? BUBBLE_COLORS.SELECTED.background : BUBBLE_COLORS.ERROR.background}`
            : isCompleted
              ? `${BUBBLE_COLORS.COMPLETED.border} ${isHighlighted ? BUBBLE_COLORS.SELECTED.background : BUBBLE_COLORS.COMPLETED.background}`
              : isHighlighted
                ? `${BUBBLE_COLORS.SELECTED.border} ${BUBBLE_COLORS.SELECTED.background}`
                : BUBBLE_COLORS.DEFAULT.border
      }`}
      onClick={() => {
        // Don't open overlay if credential creation modal is open
        if (createModalForType) return;
        onBubbleClick?.();
        setIsDetailsOpen(true);
      }}
    >
      {/* Node handles for horizontal (main flow) and vertical (dependencies) connections */}
      {/* Left Handle - Shows "Input" button after execution - only render if used */}
      {usedHandles.left && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            isConnectable={false}
            className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
            style={{ left: -6, opacity: isCompleted ? 0 : 1 }}
          />
          {isCompleted && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-lg border transition-all duration-300 hover:scale-105 cursor-pointer backdrop-blur-sm"
              style={{
                left: '0',
                backgroundColor: hasError
                  ? 'rgba(239, 68, 68, 0.9)'
                  : 'rgba(245, 245, 244, 0.95)',
                borderColor: hasError
                  ? '#dc2626'
                  : isInputSelected
                    ? 'rgba(99, 102, 241, 0.9)'
                    : 'rgba(212, 212, 211, 0.8)',
                borderWidth: isInputSelected ? '2.5px' : '1.5px',
                color: hasError ? '#ffffff' : 'rgba(23, 23, 23, 0.95)',
                boxShadow: isInputSelected
                  ? '0 0 0 2px rgba(99, 102, 241, 0.3)'
                  : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();

                // Navigate to console with first output
                const liveOutputStore = getLiveOutputStore(flowId);
                if (liveOutputStore) {
                  liveOutputStore.getState().selectBubbleInConsole(bubbleId);
                  // Set to first event (index 0)
                  liveOutputStore.getState().setSelectedEventIndex(bubbleId, 0);
                }
              }}
            >
              Input
            </div>
          )}
        </div>
      )}

      {/* Right Handle - Shows "Output" button after execution - only render if used */}
      {usedHandles.right && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            isConnectable={false}
            className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
            style={{ right: -6, opacity: isCompleted ? 0 : 1 }}
          />
          {isCompleted && (
            <div
              className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-lg border transition-all duration-300 hover:scale-105 cursor-pointer backdrop-blur-sm"
              style={{
                right: '0',
                backgroundColor: hasError
                  ? 'rgba(239, 68, 68, 0.9)'
                  : 'rgba(23, 23, 23, 0.95)',
                borderColor: hasError
                  ? '#dc2626'
                  : isOutputSelected
                    ? 'rgba(99, 102, 241, 0.9)'
                    : 'rgba(64, 64, 64, 0.8)',
                borderWidth: isOutputSelected ? '2.5px' : '1.5px',
                color: hasError ? '#ffffff' : 'rgba(245, 245, 244, 0.95)',
                boxShadow: isOutputSelected
                  ? '0 0 0 2px rgba(99, 102, 241, 0.3)'
                  : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                const liveOutputStore = getLiveOutputStore(flowId);
                if (liveOutputStore) {
                  // Navigate to console with last output
                  liveOutputStore.getState().selectBubbleInConsole(bubbleId);
                  // Get ordered items to find event count for this bubble
                  const orderedItems = liveOutputStore
                    .getState()
                    .getOrderedItems();
                  const bubbleGroup = orderedItems.find(
                    (item) => item.kind === 'group' && item.name === bubbleId
                  );
                  if (bubbleGroup && bubbleGroup.kind === 'group') {
                    // Set to last event (eventCount - 1 for 0-based index)
                    const lastIndex = Math.max(
                      0,
                      bubbleGroup.events.length - 1
                    );
                    liveOutputStore
                      .getState()
                      .setSelectedEventIndex(bubbleId, lastIndex);
                  }
                }
              }}
            >
              Output
            </div>
          )}
        </div>
      )}

      {/* Bottom handle - only render if used */}
      {usedHandles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={false}
          className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ bottom: -6 }}
        />
      )}

      {/* Top handle - only render if used */}
      {usedHandles.top && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          isConnectable={false}
          className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
          style={{ top: -6 }}
        />
      )}

      {/* Header */}
      <div
        className={`p-4 relative ${bubble.parameters.length > 0 ? 'border-b border-neutral-600' : ''}`}
      >
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {(hasError ||
            isCompleted ||
            isExecuting ||
            hasMissingRequirements ||
            bubble.parameters.length > 0) && (
            <>
              {/* Show Error badge when error, otherwise show standard badge */}
              {hasError ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleErrorClick();
                  }}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-600/40 hover:bg-red-500/30 transition-colors cursor-pointer"
                  title="View error in console"
                >
                  <span>❌</span>
                  <span>Error</span>
                </button>
              ) : (
                <BubbleExecutionBadge
                  hasError={false}
                  isCompleted={isCompleted}
                  isExecuting={isExecuting}
                  executionStats={executionStats}
                  bubbleId={bubbleId}
                  flowId={flowId}
                />
              )}
              {!hasError && !isExecuting && hasMissingRequirements && (
                <div className="flex-shrink-0">
                  <div
                    title="Missing credentials"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${BADGE_COLORS.MISSING.background} ${BADGE_COLORS.MISSING.text} border ${BADGE_COLORS.MISSING.border}`}
                  >
                    <span>⚠️</span>
                    <span>Missing</span>
                  </div>
                </div>
              )}
            </>
          )}
          {!isSmallBubble && (
            <div className="relative">
              <button
                title={'View Code'}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBubbleClick?.();
                }}
                onMouseEnter={() => setShowCodeTooltip(true)}
                onMouseLeave={() => setShowCodeTooltip(false)}
                className="inline-flex items-center justify-center p-1.5 rounded text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              {showCodeTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs font-medium text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap border border-neutral-700 z-50">
                  {showEditor ? 'Hide Code' : 'View Code'}
                </div>
              )}
            </div>
          )}
          {docsUrl && (
            <div className="relative">
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setShowDocsTooltip(true)}
                onMouseLeave={() => setShowDocsTooltip(false)}
                className="inline-flex items-center justify-center p-1.5 rounded text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </a>
              {showDocsTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs font-medium text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap border border-neutral-700 z-50">
                  See Docs
                </div>
              )}
            </div>
          )}
        </div>
        {/* Icon on top, details below */}
        <div className="w-full">
          <div className="mb-3">
            {logo && !logoError ? (
              <img
                src={logo.file}
                alt={`${logo.name} logo`}
                className="h-8 w-8 object-contain"
                loading="lazy"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  isHighlighted ? 'bg-purple-600' : 'bg-blue-600'
                }`}
              >
                <CogIcon className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex items-start gap-3 w-full">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-neutral-100 truncate">
                {bubble.variableName}
              </h3>
              {bubble.description && (
                <p className="text-xs text-neutral-400 mt-1.5 break-words">
                  {bubble.description}
                </p>
              )}
              {/* <p className="text-xs text-neutral-400 truncate mt-1">
                {bubble.bubbleName}
              </p> */}
              {/* {bubble.location && bubble.location.startLine > 0 && (
                <p className="text-xs text-neutral-500 truncate mt-1">
                  Line {bubble.location.startLine}:{bubble.location.startCol}
                  {bubble.location.startLine !== bubble.location.endLine &&
                    ` - ${bubble.location.endLine}:${bubble.location.endCol}`}
                </p>
              )} */}
            </div>
          </div>
        </div>

        {/* Credentials Section - Full Width, Left Aligned */}
        {(() => {
          const filteredCredentialTypes = requiredCredentialTypes.filter(
            (credType) => {
              const systemCred = isSystemCredential(credType as CredentialType);
              const hasSelection =
                selectedBubbleCredentials[credType] !== undefined &&
                selectedBubbleCredentials[credType] !== null;

              // Hide system credentials that are using the default (no selection)
              if (systemCred && !hasSelection) {
                return false;
              }
              return true;
            }
          );

          // Only show the entire credentials section if there are credentials to display
          if (filteredCredentialTypes.length === 0) {
            return null;
          }

          return (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-blue-300">
                Credentials
              </label>
              <div className="grid grid-cols-1 gap-2">
                {filteredCredentialTypes.map((credType) => {
                  const availableForType = getCredentialsForType(credType);
                  const systemCred = isSystemCredential(
                    credType as CredentialType
                  );
                  const isMissingSelection =
                    !systemCred &&
                    (selectedBubbleCredentials[credType] === undefined ||
                      selectedBubbleCredentials[credType] === null);

                  return (
                    <div key={credType} className={`space-y-1`}>
                      <label className="block text-[11px] text-neutral-300">
                        {credType}
                        {/* {systemCred && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-neutral-600 text-neutral-200 rounded">
                          System Managed
                        </span>
                      )} */}
                        {!systemCred && availableForType.length > 0 && (
                          <span className="text-red-400 ml-1">*</span>
                        )}
                      </label>
                      <select
                        title={`${bubble.bubbleName} ${credType}`}
                        value={
                          selectedBubbleCredentials[credType] !== undefined &&
                          selectedBubbleCredentials[credType] !== null
                            ? String(selectedBubbleCredentials[credType])
                            : ''
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__ADD_NEW__') {
                            setCreateModalForType(credType);
                            return;
                          }
                          const credId = val ? parseInt(val, 10) : null;
                          handleCredentialChange(credType, credId);
                        }}
                        className={`w-full px-2 py-1 text-xs bg-neutral-700 border ${isMissingSelection ? 'border-amber-500' : 'border-neutral-500'} rounded text-neutral-100`}
                      >
                        <option value="">
                          {systemCred
                            ? 'Use system default'
                            : 'Select credential...'}
                        </option>
                        {availableForType.map((cred) => (
                          <option key={cred.id} value={String(cred.id)}>
                            {cred.name || `${cred.credentialType} (${cred.id})`}
                          </option>
                        ))}
                        <option disabled>────────────</option>
                        <option value="__ADD_NEW__">
                          + Add New Credential…
                        </option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Inline Params - Model dropdowns & preview text based on config */}
        <BubbleInlineParams
          bubbleName={bubble.bubbleName}
          variableId={bubble.variableId}
          getParam={getParam}
          updateBubbleParam={updateBubbleParam}
          onOpenDetails={() => setIsDetailsOpen(true)}
        />
      </div>

      {hasSubBubbles && (
        <div className="px-4 py-3 border-t border-neutral-600 bg-neutral-800/70">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!isNaN(rootId)) {
                toggleRootExpansion(rootId);
              }
            }}
            className={`w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded ${
              areSubBubblesVisibleLocal
                ? 'bg-purple-700/40 text-purple-200 border border-purple-500/60'
                : 'bg-purple-900/40 text-purple-200 border border-purple-700/60 hover:bg-purple-800/50'
            }`}
          >
            {areSubBubblesVisibleLocal
              ? 'Hide Sub Bubbles'
              : 'Show Sub Bubbles'}
          </button>
        </div>
      )}
      <BubbleDetailsOverlay
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        flowId={flowId}
        bubble={bubble}
        logo={logo}
        logoErrored={logoError}
        docsUrl={docsUrl}
        requiredCredentialTypes={requiredCredentialTypes}
        selectedBubbleCredentials={selectedBubbleCredentials}
        availableCredentials={availableCredentials}
        onCredentialChange={handleCredentialChange}
        onParamEditInCode={onParamEditInCode}
        onViewCode={() => onBubbleClick?.()}
        showEditor={showEditor}
      />

      {/* Create Credential Modal */}
      {createModalForType && (
        <CreateCredentialModal
          isOpen={!!createModalForType}
          onClose={() => setCreateModalForType(null)}
          onSubmit={(data) => createCredentialMutation.mutateAsync(data)}
          isLoading={createCredentialMutation.isPending}
          lockedCredentialType={createModalForType as CredentialType}
          lockType
          onSuccess={(created) => {
            if (createModalForType) {
              handleCredentialChange(createModalForType, created.id);
            }
            setCreateModalForType(null);
          }}
        />
      )}
    </div>
  );
}

export default memo(BubbleNode);
