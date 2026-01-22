import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  BubbleParameter,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { BubbleParameterType } from '@bubblelab/shared-schemas';
import { useBubbleSchema } from '@/hooks/useBubbleSchema';
import {
  isDiscriminatedUnionSchema,
  mergeSchemaWithParams,
} from '@/utils/schemaUtils';
import { SchemaParamEditor } from './SchemaParamEditor';
import { DiscriminatedUnionEditor } from './DiscriminatedUnionEditor';
import { ParamEditor } from './ParamEditor';

export interface SchemaParamsSectionProps {
  /** The bubble being edited */
  bubble: ParsedBubbleWithInfo;
  /** Callback to update a parameter value */
  updateBubbleParam: (
    variableId: number,
    paramName: string,
    newValue: unknown,
    paramType?: BubbleParameterType
  ) => void;
  /** Optional callback to view code for a param */
  onParamEditInCode?: (paramName: string) => void;
  /** Param names to exclude from display (e.g., model params shown separately) */
  excludedParamNames?: string[];
}

/**
 * Main orchestrator component for schema-aware parameter editing
 *
 * Handles:
 * - Loading schema from bubbles.json
 * - Detecting discriminated unions vs simple schemas
 * - Rendering appropriate editor components
 * - Falling back to legacy ParamEditor when no schema available
 */
export function SchemaParamsSection({
  bubble,
  updateBubbleParam,
  onParamEditInCode,
  excludedParamNames = [],
}: SchemaParamsSectionProps) {
  // Load schema for this bubble
  const { schema, isLoading } = useBubbleSchema(bubble.bubbleName);

  // Filter out excluded params, credentials, and env params
  const displayParams = useMemo(
    () =>
      bubble.parameters.filter((param) => {
        if (
          param.name === 'credentials' ||
          param.type === BubbleParameterType.ENV
        ) {
          return false;
        }
        if (excludedParamNames.includes(param.name)) {
          return false;
        }
        return true;
      }),
    [bubble.parameters, excludedParamNames]
  );

  // Get sensitive env params for warning display
  const sensitiveEnvParams = useMemo(
    () =>
      bubble.parameters.filter(
        (param) => param.type === BubbleParameterType.ENV
      ),
    [bubble.parameters]
  );

  // Handle value change (with optional paramType for adding new params)
  const handleValueChange = (
    paramName: string,
    newValue: unknown,
    paramType?: BubbleParameterType
  ) => {
    updateBubbleParam(bubble.variableId, paramName, newValue, paramType);
  };

  // Check if schema is a discriminated union
  const isDiscriminatedUnion = useMemo(
    () => isDiscriminatedUnionSchema(schema),
    [schema]
  );

  // For non-discriminated schemas, merge with runtime params
  const mergedParams = useMemo(() => {
    if (!schema || isDiscriminatedUnion) return [];
    return mergeSchemaWithParams(schema, displayParams);
  }, [schema, isDiscriminatedUnion, displayParams]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
        <span className="ml-2 text-sm text-neutral-400">Loading schema...</span>
      </div>
    );
  }

  // Render discriminated union editor
  if (schema && isDiscriminatedUnion) {
    return (
      <div className="space-y-6">
        <DiscriminatedUnionEditor
          schema={schema}
          runtimeParams={displayParams}
          variableId={bubble.variableId}
          onValueChange={handleValueChange}
          onParamEditInCode={onParamEditInCode}
        />

        {/* Sensitive env params warning */}
        {sensitiveEnvParams.length > 0 && (
          <SensitiveParamsWarning params={sensitiveEnvParams} />
        )}
      </div>
    );
  }

  // Render schema-based params (if schema available)
  if (schema && mergedParams.length > 0) {
    return (
      <div className="space-y-5">
        {mergedParams.map((param) => (
          <SchemaParamEditor
            key={param.name}
            param={param}
            variableId={bubble.variableId}
            onValueChange={handleValueChange}
            onParamEditInCode={onParamEditInCode}
          />
        ))}

        {/* Sensitive env params warning */}
        {sensitiveEnvParams.length > 0 && (
          <SensitiveParamsWarning params={sensitiveEnvParams} />
        )}
      </div>
    );
  }

  // Fallback: No schema or empty params - use legacy ParamEditor
  if (displayParams.length === 0 && sensitiveEnvParams.length === 0) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-6 text-sm text-neutral-400">
        This bubble does not define parameters.
      </p>
    );
  }

  // Fallback: Use legacy ParamEditor when no schema
  return (
    <div className="space-y-5">
      {displayParams.map((param) => (
        <ParamEditor
          key={param.name}
          param={param}
          variableId={bubble.variableId}
          bubbleName={bubble.bubbleName}
          updateBubbleParam={updateBubbleParam}
          onParamEditInCode={onParamEditInCode}
        />
      ))}

      {/* Sensitive env params warning */}
      {sensitiveEnvParams.length > 0 && (
        <SensitiveParamsWarning params={sensitiveEnvParams} />
      )}
    </div>
  );
}

/**
 * Warning component for sensitive environment parameters
 */
function SensitiveParamsWarning({ params }: { params: BubbleParameter[] }) {
  return (
    <div className="rounded-2xl border border-yellow-900 bg-yellow-950/40 p-5 text-yellow-200">
      <p className="text-base font-semibold">Hidden environment parameters</p>
      <p className="mt-2 text-sm opacity-80">
        The following parameters contain environment secrets and are hidden for
        security:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {params.map((param) => (
          <li key={param.name}>{param.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default SchemaParamsSection;
