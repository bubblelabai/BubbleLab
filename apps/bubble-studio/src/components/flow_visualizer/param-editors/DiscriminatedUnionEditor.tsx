import { useMemo } from 'react';
import { Lock, Zap } from 'lucide-react';
import type {
  BubbleParameter,
  BubbleParameterType,
} from '@bubblelab/shared-schemas';
import type { JsonSchema } from '@/hooks/useBubbleSchema';
import {
  getOperationOptions,
  getParamsForOperation,
  getCurrentOperation,
} from '@/utils/schemaUtils';
import { SchemaParamEditor } from './SchemaParamEditor';

export interface DiscriminatedUnionEditorProps {
  /** The full schema with anyOf discriminated union */
  schema: JsonSchema;
  /** Runtime parameters from the bubble */
  runtimeParams: BubbleParameter[];
  /** Variable ID of the bubble */
  variableId: number;
  /** Callback to update parameter value */
  onValueChange: (
    paramName: string,
    newValue: unknown,
    paramType?: BubbleParameterType
  ) => void;
  /** Optional callback to view code for a param */
  onParamEditInCode?: (paramName: string) => void;
}

/**
 * Editor for discriminated union schemas (anyOf with operation discriminator)
 * Shows operation selector first, then renders params for selected operation
 */
export function DiscriminatedUnionEditor({
  schema,
  runtimeParams,
  variableId,
  onValueChange,
  onParamEditInCode,
}: DiscriminatedUnionEditorProps) {
  // Get all available operations from schema
  const operationOptions = useMemo(() => getOperationOptions(schema), [schema]);

  // Get current operation from runtime params
  const currentOperation = getCurrentOperation(runtimeParams);

  // Get the current operation info
  const currentOperationInfo = useMemo(
    () => operationOptions.find((op) => op.operation === currentOperation),
    [operationOptions, currentOperation]
  );

  // Get merged params for the current operation
  const operationParams = useMemo(() => {
    if (!currentOperation) return [];
    return getParamsForOperation(schema, currentOperation, runtimeParams);
  }, [schema, currentOperation, runtimeParams]);

  return (
    <div className="space-y-6">
      {/* Operation Selector */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-purple-400" />
          <p className="text-base font-semibold text-white">
            Operation
            <span className="text-red-400 ml-1">*</span>
          </p>
        </div>

        {currentOperationInfo?.description && (
          <p className="text-xs text-neutral-400 mb-3">
            {currentOperationInfo.description}
          </p>
        )}

        <div className="relative">
          {/* Operation is read-only - show as disabled input instead of dropdown */}
          <div className="w-full rounded-xl border border-neutral-700 bg-neutral-950/50 px-4 py-3 text-sm text-neutral-300">
            {currentOperation
              ? formatOperationName(currentOperation)
              : 'No operation set'}
          </div>
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
        </div>

        {/* Operation quick description */}
        {currentOperation && (
          <p className="mt-2 text-xs text-neutral-500">
            Required params: {currentOperationInfo?.requiredParams.length || 0}
          </p>
        )}
      </div>

      {/* Parameters for selected operation */}
      {currentOperation && operationParams.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
            {formatOperationName(currentOperation)} Parameters
          </h4>
          {operationParams.map((param) => (
            <SchemaParamEditor
              key={param.name}
              param={param}
              variableId={variableId}
              onValueChange={onValueChange}
              onParamEditInCode={onParamEditInCode}
            />
          ))}
        </div>
      )}

      {/* No operation selected message */}
      {!currentOperation && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">
            Select an operation above to configure its parameters
          </p>
        </div>
      )}

      {/* Operation selected but no additional params */}
      {currentOperation && operationParams.length === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">
            This operation has no additional parameters to configure
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Format operation name for display (e.g., "send_message" -> "Send Message")
 */
function formatOperationName(operation: string): string {
  return operation
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default DiscriminatedUnionEditor;
