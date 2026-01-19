import { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import {
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  Code2,
} from 'lucide-react';
import {
  getTriggerEventConfig,
  type BubbleTriggerEventRegistry,
} from '@bubblelab/shared-schemas';
import { parseJSONSchema } from '@/utils/inputSchemaParser';
import InputFieldsRenderer from '@/components/InputFieldsRenderer';
import { useExecutionStore } from '@/stores/executionStore';
import { useRunExecution } from '@/hooks/useRunExecution';
import { filterEmptyInputs } from '@/utils/inputUtils';
import { BUBBLE_COLORS } from '@/components/flow_visualizer/BubbleColors';
import { SERVICE_LOGOS } from '@/lib/integrations';
import { WebhookURLDisplay } from '@/components/WebhookURLDisplay';
import type { Components } from 'react-markdown';

interface ServiceTriggerNodeData {
  flowId: number;
  flowName: string;
  eventType: keyof BubbleTriggerEventRegistry;
  inputSchema?: Record<string, unknown>;
  isActive?: boolean;
  onFocusBubble?: (bubbleVariableId: string) => void;
}

interface ServiceTriggerNodeProps {
  data: ServiceTriggerNodeData;
}

/**
 * Compact markdown components for setup guide rendering
 */
const setupGuideMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-sm font-bold text-neutral-100 mb-2 mt-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-neutral-100 mb-1.5 mt-3 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-neutral-200 mb-1 mt-2 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-xs text-neutral-300 leading-relaxed mb-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 text-xs text-neutral-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 space-y-0.5 mb-2 text-xs text-neutral-300">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-neutral-300 leading-relaxed">{children}</li>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-neutral-700/50 text-rose-300 px-1 py-0.5 rounded text-[10px] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-neutral-900/50 text-neutral-300 p-2 rounded text-[10px] font-mono overflow-x-auto mb-2">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-neutral-900/50 rounded overflow-x-auto mb-2 text-[10px]">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-neutral-100">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-rose-400 hover:text-rose-300 underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

function ServiceTriggerNode({ data }: ServiceTriggerNodeProps) {
  const {
    flowId,
    flowName,
    eventType,
    inputSchema = {},
    isActive = true,
    onFocusBubble,
  } = data;

  // Payload schema is collapsed by default for clarity
  const [isPayloadExpanded, setIsPayloadExpanded] = useState(false);
  const [isSetupGuideExpanded, setIsSetupGuideExpanded] = useState(false);

  // Get trigger config from centralized registry
  const triggerConfig = getTriggerEventConfig(eventType);

  // Subscribe to execution store
  const executionInputs = useExecutionStore(flowId, (s) => s.executionInputs);
  const isExecuting = useExecutionStore(flowId, (s) => s.isRunning);
  const highlightedBubble = useExecutionStore(
    flowId,
    (s) => s.highlightedBubble
  );
  const setInput = useExecutionStore(flowId, (s) => s.setInput);

  // Get runFlow function with callback
  const { runFlow } = useRunExecution(flowId, { onFocusBubble });

  // Local state for input values
  const [inputValues, setInputValues] = useState<Record<string, unknown>>(
    executionInputs || {}
  );

  // Sync local state with store when executionInputs changes externally
  useEffect(() => {
    if (executionInputs && Object.keys(executionInputs).length > 0) {
      setInputValues(executionInputs);
    }
  }, [executionInputs]);

  // Parse input schema (use config schema if no custom schema provided)
  const effectiveSchema = useMemo(() => {
    if (inputSchema && Object.keys(inputSchema).length > 0) {
      return inputSchema;
    }
    return triggerConfig?.payloadSchema || {};
  }, [inputSchema, triggerConfig]);

  const schemaFields = useMemo(() => {
    if (typeof effectiveSchema === 'string') {
      return parseJSONSchema(effectiveSchema);
    }
    if (effectiveSchema.properties) {
      return Object.entries(
        effectiveSchema.properties as Record<string, Record<string, unknown>>
      ).map(([name, schema]) => ({
        name,
        type: (schema?.type as string) || 'string',
        required: Array.isArray(effectiveSchema.required)
          ? effectiveSchema.required.includes(name)
          : false,
        description: schema?.description as string,
        default: schema?.default,
        canBeFile: schema?.canBeFile as boolean | undefined,
      }));
    }
    return [];
  }, [effectiveSchema]);

  // Check if this node is highlighted
  const isHighlighted = highlightedBubble === 'service-trigger-node';

  // Get service logo
  const serviceLogo = triggerConfig
    ? SERVICE_LOGOS[triggerConfig.serviceName]
    : null;

  const handleInputChange = (fieldName: string, value: unknown) => {
    const newInputValues = { ...inputValues, [fieldName]: value };
    setInputValues(newInputValues);
    setInput(fieldName, value);
  };

  const handleExecuteFlow = async () => {
    const filteredInputs = filterEmptyInputs(executionInputs || {});
    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: filteredInputs,
    });
  };

  return (
    <div
      className={`bg-neutral-800/90 rounded-lg border overflow-hidden transition-all duration-300 w-[400px] ${
        isExecuting
          ? `${BUBBLE_COLORS.SERVICE_TRIGGER.border} shadow-lg shadow-rose-500/30 ${isHighlighted ? BUBBLE_COLORS.SELECTED.background : ''}`
          : !isActive
            ? `border-neutral-700 opacity-75 ${isHighlighted ? BUBBLE_COLORS.SELECTED.background : ''}`
            : isHighlighted
              ? `${BUBBLE_COLORS.SELECTED.border} ${BUBBLE_COLORS.SELECTED.background}`
              : 'border-neutral-600'
      }`}
    >
      {/* Output handle on the right to connect to first bubble */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={false}
        className={`w-3 h-3 ${
          isExecuting
            ? BUBBLE_COLORS.SERVICE_TRIGGER.handle
            : isHighlighted
              ? BUBBLE_COLORS.SELECTED.handle
              : isActive
                ? BUBBLE_COLORS.SERVICE_TRIGGER.handle
                : 'bg-neutral-500'
        }`}
        style={{ right: -6 }}
      />

      {/* Webhook URL Display (same as InputSchemaNode) */}
      <WebhookURLDisplay flowId={flowId} />

      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-600">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center ${
                isActive
                  ? BUBBLE_COLORS.SERVICE_TRIGGER.accent
                  : 'bg-neutral-600'
              } overflow-hidden`}
            >
              {serviceLogo ? (
                <img
                  src={serviceLogo}
                  alt={triggerConfig?.serviceName || 'Service'}
                  className="h-5 w-5 object-contain"
                />
              ) : (
                <Zap className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-neutral-100">
                {triggerConfig?.friendlyName || eventType}
              </h3>
              <p className="text-xs text-neutral-400 truncate" title={flowName}>
                {flowName}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {triggerConfig?.description && (
          <p className="text-xs text-neutral-400 mt-2">
            {triggerConfig.description}
          </p>
        )}
      </div>

      {/* Setup Guide (collapsible) */}
      {triggerConfig?.setupGuide && (
        <div className="border-b border-neutral-600">
          <button
            type="button"
            onClick={() => setIsSetupGuideExpanded(!isSetupGuideExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-medium">Setup Guide</span>
            </span>
            {isSetupGuideExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {isSetupGuideExpanded && (
            <div className="px-4 pb-4">
              <ReactMarkdown components={setupGuideMarkdownComponents}>
                {triggerConfig.setupGuide}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Payload Schema (collapsible, default collapsed) */}
      <div className="border-b border-neutral-600">
        <button
          type="button"
          onClick={() => setIsPayloadExpanded(!isPayloadExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-medium">Payload Schema</span>
            <span className="text-neutral-500 font-normal">
              ({schemaFields.length} field{schemaFields.length !== 1 ? 's' : ''}
              )
            </span>
          </span>
          {isPayloadExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {isPayloadExpanded && schemaFields.length > 0 && (
          <div className="px-4 pb-4 space-y-3">
            <InputFieldsRenderer
              schemaFields={schemaFields}
              inputValues={inputValues}
              onInputChange={handleInputChange}
              isExecuting={isExecuting}
            />
          </div>
        )}
        {isPayloadExpanded && schemaFields.length === 0 && (
          <div className="px-4 pb-4 text-xs text-neutral-500">
            No payload schema defined
          </div>
        )}
      </div>

      {/* Execute button */}
      <div className="p-4">
        <button
          type="button"
          onClick={handleExecuteFlow}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isExecuting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            !isExecuting
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }`}
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Test Flow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(ServiceTriggerNode);
