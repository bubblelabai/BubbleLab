import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, FileInput } from 'lucide-react';
import InputFieldsRenderer from './InputFieldsRenderer';
import { useExecutionStore } from '../stores/executionStore';
import { useRunExecution } from '../hooks/useRunExecution';
import { filterEmptyInputs } from '../utils/inputUtils';

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  properties?: Record<
    string,
    {
      type?: string;
      description?: string;
      default?: unknown;
      required?: boolean;
      properties?: Record<
        string,
        {
          type?: string;
          description?: string;
          default?: unknown;
          required?: boolean;
        }
      >;
      requiredProperties?: string[];
    }
  >;
  requiredProperties?: string[];
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
      .filter((field) => {
        const value = executionInputs[field.name];
        // For object types, check if it's an object and has required properties
        if (field.type === 'object' && field.properties) {
          if (typeof value !== 'object' || value === null) {
            return field.default === undefined;
          }
          // Check if required nested properties are missing (including nested objects)
          if (field.requiredProperties) {
            const missingNested = field.requiredProperties.filter(
              (propName) => {
                const propValue = (value as Record<string, unknown>)[propName];
                const isEmpty =
                  propValue === undefined ||
                  propValue === '' ||
                  (Array.isArray(propValue) && propValue.length === 0);
                const propField = field.properties?.[propName];

                // If this property is also an object, check its required properties
                if (
                  propField?.type === 'object' &&
                  propField.properties &&
                  propField.requiredProperties
                ) {
                  if (
                    typeof propValue !== 'object' ||
                    propValue === null ||
                    Array.isArray(propValue)
                  ) {
                    return isEmpty && propField.default === undefined;
                  }
                  // Check nested required properties
                  const nestedMissing = propField.requiredProperties.filter(
                    (nestedPropName) => {
                      const nestedPropValue = (
                        propValue as Record<string, unknown>
                      )[nestedPropName];
                      const nestedIsEmpty =
                        nestedPropValue === undefined ||
                        nestedPropValue === '' ||
                        (Array.isArray(nestedPropValue) &&
                          nestedPropValue.length === 0);
                      const nestedPropField =
                        propField.properties?.[nestedPropName];
                      return (
                        nestedIsEmpty && nestedPropField?.default === undefined
                      );
                    }
                  );
                  return nestedMissing.length > 0;
                }

                return isEmpty && propField?.default === undefined;
              }
            );
            return missingNested.length > 0;
          }
          return false;
        }
        const isEmpty =
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);
        return isEmpty && field.default === undefined;
      });
  }, [schemaFields, executionInputs]);

  const hasMissingRequired = missingRequiredFields.length > 0;

  // Check if form is valid (no missing required fields)
  const isFormValid = !hasMissingRequired;

  // Handle execute flow
  const handleExecuteFlow = async () => {
    // Filter out empty values (empty strings, undefined, empty arrays) so defaults are used
    const filteredInputs = filterEmptyInputs(executionInputs || {});

    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: filteredInputs,
    });
  };

  return (
    <div
      className={`bg-neutral-800/90 rounded-xl border overflow-hidden transition-all duration-300 w-96 shadow-xl ${
        isExecuting
          ? 'border-blue-400 shadow-blue-500/30'
          : hasMissingRequired
            ? 'border-amber-500/50 shadow-amber-500/10'
            : 'border-neutral-700 hover:border-neutral-600'
      }`}
    >
      {/* Output handle on the right to connect to first bubble */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={false}
        className={`w-3 h-3 ${isExecuting ? 'bg-blue-400' : 'bg-blue-400'}`}
        style={{ right: -6 }}
      />

      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <FileInput className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100 tracking-tight">
                Flow Inputs
              </h3>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        {hasMissingRequired && !isExecuting && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
      <div className="p-6">
        <InputFieldsRenderer
          schemaFields={schemaFields}
          inputValues={executionInputs}
          onInputChange={handleInputChange}
          isExecuting={isExecuting}
        />
      </div>

      {/* Execute button */}
      <div className="px-6 pb-6 pt-2">
        <button
          type="button"
          onClick={handleExecuteFlow}
          disabled={!isFormValid || isExecuting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
            isFormValid && !isExecuting
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
          }`}
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Execute Flow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(InputSchemaNode);
