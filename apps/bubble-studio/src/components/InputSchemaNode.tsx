import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, FileInput } from 'lucide-react';
import InputFieldsRenderer from './InputFieldsRenderer';
import { useExecutionStore } from '../stores/executionStore';
import { useRunExecution } from '../hooks/useRunExecution';

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
}

interface InputSchemaNodeData {
  flowId: number;
  flowName: string;
  schemaFields: SchemaField[];
}

interface InputSchemaNodeProps {
  data: InputSchemaNodeData;
}

function InputSchemaNode({ data }: InputSchemaNodeProps) {
  const { flowId, schemaFields } = data;

  // Subscribe to execution store (using selectors to avoid re-renders from events)
  const executionInputs = useExecutionStore(flowId, (s) => s.executionInputs);
  const isExecuting = useExecutionStore(flowId, (s) => s.isRunning);

  // Get actions from store
  const setInput = useExecutionStore(flowId, (s) => s.setInput);

  // Get runFlow function
  const { runFlow } = useRunExecution(flowId);

  // Handle input changes
  const handleInputChange = (fieldName: string, value: unknown) => {
    setInput(fieldName, value);
  };

  // Check if there are any required fields that are missing
  const missingRequiredFields = useMemo(() => {
    return schemaFields
      .filter((field) => field.required)
      .filter(
        (field) =>
          (executionInputs[field.name] === undefined ||
            executionInputs[field.name] === '') &&
          field.default === undefined
      );
  }, [schemaFields, executionInputs]);

  const hasMissingRequired = missingRequiredFields.length > 0;

  // Check if form is valid (no missing required fields)
  const isFormValid = !hasMissingRequired;

  // Handle execute flow
  const handleExecuteFlow = async () => {
    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: executionInputs || {},
    });
  };

  return (
    <div
      className={`bg-neutral-800/90 rounded-lg border overflow-hidden transition-all duration-300 w-80 ${
        isExecuting
          ? 'border-blue-400 shadow-lg shadow-blue-500/30'
          : hasMissingRequired
            ? 'border-amber-500'
            : 'border-neutral-600'
      }`}
    >
      {/* Output handle on the right to connect to first bubble */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`w-3 h-3 ${isExecuting ? 'bg-blue-400' : 'bg-blue-400'}`}
        style={{ right: -6 }}
      />

      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileInput className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                Flow Inputs
              </h3>
            </div>
          </div>
          {/* Removed Collapse/Expand toggle; section is always expanded */}
        </div>

        {/* Status indicator */}
        {hasMissingRequired && !isExecuting && (
          <div className="mt-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-600/40">
              <span>⚠️</span>
              <span>
                {missingRequiredFields.length} required field
                {missingRequiredFields.length !== 1 ? 's' : ''} missing
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input fields (always expanded) */}
      <div className="p-4 space-y-3">
        <InputFieldsRenderer
          schemaFields={schemaFields}
          inputValues={executionInputs}
          onInputChange={handleInputChange}
          isExecuting={isExecuting}
        />
      </div>

      {/* Execute button */}
      <div className="p-4 border-t border-neutral-600">
        <button
          type="button"
          onClick={handleExecuteFlow}
          disabled={!isFormValid || isExecuting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            isFormValid && !isExecuting
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }`}
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Execute Flow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(InputSchemaNode);
