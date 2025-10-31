import { memo, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CogIcon } from '@heroicons/react/24/outline';
import { BookOpen, Code, Info } from 'lucide-react';
import { CredentialType } from '@bubblelab/shared-schemas';
import { CreateCredentialModal } from '../pages/CredentialsPage';
import { useCreateCredential } from '../hooks/useCredentials';
import { findLogoForBubble, findDocsUrlForBubble } from '../lib/integrations';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import BubbleExecutionBadge from './BubbleExecutionBadge';
import { BUBBLE_COLORS, BADGE_COLORS } from './BubbleColors';
import { useUIStore } from '../stores/uiStore';
import { useExecutionStore } from '../stores/executionStore';
import { useCredentials } from '../hooks/useCredentials';
import { API_BASE_URL } from '../env';

interface BubbleNodeData {
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
}

interface BubbleNodeProps {
  data: BubbleNodeData;
}

function BubbleNode({ data }: BubbleNodeProps) {
  const {
    flowId,
    bubble,
    bubbleKey,
    requiredCredentialTypes: propRequiredCredentialTypes = [],
    onHighlightChange,
    onBubbleClick,
    onParamEditInCode,
    hasSubBubbles = false,
  } = data;

  // Determine the bubble ID for store lookups (prefer variableId, fallback to bubbleKey)
  const bubbleId = bubble.variableId
    ? String(bubble.variableId)
    : String(bubbleKey);

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
  const runningBubbles = useExecutionStore(flowId, (s) => s.runningBubbles);
  const completedBubbles = useExecutionStore(flowId, (s) => s.completedBubbles);
  const pendingCredentials = useExecutionStore(
    flowId,
    (s) => s.pendingCredentials
  );

  // Get actions from store
  const highlightBubble = useExecutionStore(flowId, (s) => s.highlightBubble);
  const setCredential = useExecutionStore(flowId, (s) => s.setCredential);
  const toggleRootExpansion = useExecutionStore(
    flowId,
    (s) => s.toggleRootExpansion
  );

  // Get sub-bubble visibility state from store
  const expandedRootIds = useExecutionStore(flowId, (s) => s.expandedRootIds);
  const suppressedRootIds = useExecutionStore(
    flowId,
    (s) => s.suppressedRootIds
  );

  // Compute if sub-bubbles are visible (local to this bubble node)
  const areSubBubblesVisibleLocal = useMemo(() => {
    if (!hasSubBubbles) return false;
    const rootExpanded = expandedRootIds.includes(bubbleId);
    const rootSuppressed = suppressedRootIds.includes(bubbleId);
    return rootExpanded && !rootSuppressed;
  }, [hasSubBubbles, expandedRootIds, suppressedRootIds, bubbleId]);

  // Get available credentials
  const { data: availableCredentials = [] } = useCredentials(API_BASE_URL);

  // Determine bubble-specific state
  const isHighlighted =
    highlightedBubble === bubbleKey || highlightedBubble === bubbleId;
  const hasError = bubbleWithError === bubbleId;
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
    setCredential(credentialsKey, credType, credId);
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [createModalForType, setCreateModalForType] = useState<string | null>(
    null
  );
  const [showDocsTooltip, setShowDocsTooltip] = useState(false);
  const [showExpandTooltip, setShowExpandTooltip] = useState(false);
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

  // Separate parameters into display and sensitive categories
  const displayParams = bubble.parameters.filter(
    (param) => param.name !== 'credentials' && !param.name.includes('env')
  );
  const sensitiveEnvParams = bubble.parameters.filter((param) =>
    param.name.includes('env')
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

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 47) + '...' : value;
    }
    if (typeof value === 'object' && value !== null) {
      const jsonStr = JSON.stringify(value);
      return jsonStr.length > 50 ? jsonStr.substring(0, 47) + '...' : jsonStr;
    }
    return String(value);
  };

  const handleClick = () => {
    // Update store highlight state (convert to string for consistency)
    highlightBubble(String(bubbleKey));
    onHighlightChange?.();
  };

  // Determine if this is a sub-bubble based on variableId being negative or having a uniqueId with dots
  const isSubBubble =
    bubble.variableId < 0 ||
    (bubble.dependencyGraph?.uniqueId?.includes('.') ?? false);

  return (
    <div
      className={`bg-neutral-800/90 rounded-lg border overflow-hidden transition-all duration-300 ${
        isSubBubble
          ? 'bg-gray-600 border-gray-500 scale-75 w-64' // Sub-bubbles are smaller and darker
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
      onClick={handleClick}
    >
      {/* Node handles for horizontal (main flow) and vertical (dependencies) connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
        style={{ right: -6 }}
      />
      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
        style={{ bottom: -6 }}
      />
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
        style={{ top: -6 }}
      />

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
              <BubbleExecutionBadge
                hasError={hasError}
                isCompleted={isCompleted}
                isExecuting={isExecuting}
                executionStats={executionStats}
              />
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
              {bubble.parameters.length > 0 && (
                <div className="relative">
                  <button
                    title={isExpanded ? 'Collapse' : 'Details'}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    onMouseEnter={() => setShowExpandTooltip(true)}
                    onMouseLeave={() => setShowExpandTooltip(false)}
                    className="inline-flex items-center justify-center p-1.5 rounded text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  {showExpandTooltip && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs font-medium text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap border border-neutral-700 z-50">
                      {isExpanded ? 'Collapse' : 'Details'}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {!isSubBubble && (
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
              // When Details is collapsed, only show credentials that need configuring
              if (!isExpanded) {
                const systemCred = isSystemCredential(
                  credType as CredentialType
                );
                const hasSelection =
                  selectedBubbleCredentials[credType] !== undefined &&
                  selectedBubbleCredentials[credType] !== null;

                // Hide system credentials that are using the default (no selection)
                if (systemCred && !hasSelection) {
                  return false;
                }
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
      </div>

      {/* Parameters (collapsible) */}
      {isExpanded && bubble.parameters.length > 0 && (
        <div className="p-4 space-y-3 border-b border-neutral-600">
          {displayParams.map((param) => (
            <div key={param.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-300">
                  {param.name}
                  <span className="ml-1 text-neutral-500">({param.type})</span>
                </label>
                {onParamEditInCode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onParamEditInCode?.(param.name);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 px-1"
                  >
                    View in code
                  </button>
                )}
              </div>
              {/* Display parameter value as read-only */}
              <div className="px-2 py-1 text-xs bg-neutral-900 border border-neutral-600 rounded text-neutral-300">
                {formatValue(param.value)}
              </div>
            </div>
          ))}

          {/* Sensitive ENV params remain hidden */}
          {sensitiveEnvParams.map((param) => (
            <div key={param.name} className="space-y-1">
              <label className="block text-xs font-medium text-yellow-300">
                {param.name}
                <span className="ml-1 text-neutral-500">({param.type})</span>
              </label>
              <div className="px-2 py-1 text-xs bg-yellow-900 border border-yellow-600 rounded text-yellow-300">
                [Hidden for security]
              </div>
            </div>
          ))}
        </div>
      )}

      {hasSubBubbles && (
        <div className="px-4 py-3 border-t border-neutral-600 bg-neutral-800/70">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleRootExpansion(bubbleId);
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
