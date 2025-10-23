import { memo, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { ExternalLink } from 'lucide-react';
import type { CredentialResponse } from '@bubblelab/shared-schemas';
import { CredentialType } from '@bubblelab/shared-schemas';
import { CreateCredentialModal } from '../pages/CredentialsPage';
import { useCreateCredential } from '../hooks/useCredentials';
import { findLogoForBubble, findDocsUrlForBubble } from '../lib/integrations';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import BubbleExecutionBadge from './BubbleExecutionBadge';
import { BUBBLE_COLORS, BADGE_COLORS } from './BubbleColors';

interface BubbleNodeData {
  bubble: ParsedBubbleWithInfo;
  bubbleKey: string | number;
  onParameterChange?: (paramName: string, newValue: unknown) => void;
  isHighlighted?: boolean;
  onHighlightChange?: () => void;
  onBubbleClick?: () => void;
  hasMissingRequirements?: boolean;
  // Credentials props for this bubble
  requiredCredentialTypes?: string[];
  availableCredentials?: CredentialResponse[];
  selectedBubbleCredentials?: Record<string, number>;
  onCredentialSelectionChange?: (
    credType: string,
    credId: number | null
  ) => void;
  // Request to edit a specific parameter in code (show code + highlight line)
  onParamEditInCode?: (paramName: string) => void;
  hasSubBubbles?: boolean;
  areSubBubblesVisible?: boolean;
  onToggleSubBubbles?: () => void;
  // Error state
  hasError?: boolean;
  // Completion state
  isCompleted?: boolean;
  // Execution state
  isExecuting?: boolean;
  executionStats?: { totalTime: number; count: number };
}

interface BubbleNodeProps {
  data: BubbleNodeData;
}

function BubbleNode({ data }: BubbleNodeProps) {
  const {
    bubble,
    isHighlighted,
    onHighlightChange,
    onBubbleClick,
    hasMissingRequirements = false,
    requiredCredentialTypes = [],
    availableCredentials = [],
    selectedBubbleCredentials = {},
    onCredentialSelectionChange,
    hasSubBubbles = false,
    areSubBubblesVisible = false,
    onToggleSubBubbles,
    hasError = false,
    isCompleted = false,
    isExecuting = false,
    executionStats,
  } = data;

  const [isExpanded, setIsExpanded] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [createModalForType, setCreateModalForType] = useState<string | null>(
    null
  );

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
    onHighlightChange?.();
    onBubbleClick?.();
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
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`w-3 h-3 ${hasError ? BUBBLE_COLORS.ERROR.handle : isExecuting ? BUBBLE_COLORS.RUNNING.handle : isCompleted ? BUBBLE_COLORS.COMPLETED.handle : isHighlighted ? BUBBLE_COLORS.SELECTED.handle : BUBBLE_COLORS.DEFAULT.handle}`}
        style={{ bottom: -6 }}
      />
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
        {(hasError ||
          isCompleted ||
          isExecuting ||
          hasMissingRequirements ||
          bubble.parameters.length > 0) && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex-shrink-0 p-1 hover:bg-neutral-600 rounded transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUpIcon className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-neutral-400" />
                )}
              </button>
            )}
          </div>
        )}
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
              <p className="text-xs text-neutral-400 truncate mt-1">
                {bubble.bubbleName}
              </p>
              {bubble.location && bubble.location.startLine > 0 && (
                <p className="text-xs text-neutral-500 truncate mt-1">
                  Line {bubble.location.startLine}:{bubble.location.startCol}
                  {bubble.location.startLine !== bubble.location.endLine &&
                    ` - ${bubble.location.endLine}:${bubble.location.endCol}`}
                </p>
              )}
              {docsUrl && (
                <div className="mt-2">
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800/60 text-neutral-300 border border-neutral-600 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
                    title="Open documentation"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Docs</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credentials Section - Full Width, Left Aligned */}
        {requiredCredentialTypes.length > 0 && (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-blue-300">
              Credentials
            </label>
            <div className="grid grid-cols-1 gap-2">
              {requiredCredentialTypes.map((credType) => {
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
                      {systemCred && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-neutral-600 text-neutral-200 rounded">
                          System Managed
                        </span>
                      )}
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
                        onCredentialSelectionChange?.(credType, credId);
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
                      <option value="__ADD_NEW__">+ Add New Credential…</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                {data.onParamEditInCode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onParamEditInCode?.(param.name);
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

      {hasSubBubbles && onToggleSubBubbles && (
        <div className="px-4 py-3 border-t border-neutral-600 bg-neutral-800/70">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSubBubbles();
            }}
            className={`w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded ${
              areSubBubblesVisible
                ? 'bg-purple-700/40 text-purple-200 border border-purple-500/60'
                : 'bg-purple-900/40 text-purple-200 border border-purple-700/60 hover:bg-purple-800/50'
            }`}
          >
            {areSubBubblesVisible ? 'Hide Sub Bubbles' : 'Show Sub Bubbles'}
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
            onCredentialSelectionChange?.(createModalForType, created.id);
            setCreateModalForType(null);
          }}
        />
      )}
    </div>
  );
}

export default memo(BubbleNode);
