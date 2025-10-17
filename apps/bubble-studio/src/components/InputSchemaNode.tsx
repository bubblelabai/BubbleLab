import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, FileInput } from 'lucide-react';

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
}

interface InputSchemaNodeData {
  flowName: string;
  schemaFields: SchemaField[];
  executionInputs: Record<string, unknown>;
  onExecutionInputChange: (fieldName: string, value: unknown) => void;
  onExecuteFlow?: () => void;
  isExecuting?: boolean;
  isFormValid?: boolean;
}

interface InputSchemaNodeProps {
  data: InputSchemaNodeData;
}

function InputSchemaNode({ data }: InputSchemaNodeProps) {
  const {
    flowName,
    schemaFields,
    executionInputs,
    onExecutionInputChange,
    onExecuteFlow,
    isExecuting = false,
    isFormValid = false,
  } = data;

  const [isExpanded, setIsExpanded] = useState(true);

  // Check if there are any required fields that are missing
  const missingRequiredFields = schemaFields
    .filter((field) => field.required)
    .filter(
      (field) =>
        (executionInputs[field.name] === undefined ||
          executionInputs[field.name] === '') &&
        field.default === undefined
    );

  const hasMissingRequired = missingRequiredFields.length > 0;

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
      <div className="p-4 border-b border-neutral-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileInput className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                Flow Inputs
              </h3>
              <p className="text-xs text-neutral-400">{flowName}</p>
            </div>
          </div>
          {schemaFields.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
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

      {/* Input fields */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {schemaFields.length === 0 ? (
            <div className="text-xs text-neutral-400 text-center py-2">
              No input parameters defined
            </div>
          ) : (
            schemaFields.map((field) => {
              const isNumber = field.type === 'number';
              const currentValue = executionInputs[field.name] as
                | string
                | number
                | undefined;
              const isMissing =
                field.required &&
                (currentValue === undefined || currentValue === '') &&
                field.default === undefined;

              return (
                <div key={field.name} className="space-y-1">
                  <label className="block text-[11px] font-medium text-neutral-300">
                    {field.name}
                    {field.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                    {field.type && (
                      <span className="ml-1 text-neutral-500">
                        ({field.type})
                      </span>
                    )}
                  </label>
                  {field.description && (
                    <div className="text-[10px] text-neutral-500 mb-1">
                      {field.description}
                    </div>
                  )}
                  <input
                    type={isNumber ? 'number' : 'text'}
                    value={
                      field.type === 'array'
                        ? Array.isArray(currentValue)
                          ? JSON.stringify(currentValue)
                          : typeof currentValue === 'string'
                            ? currentValue
                            : ''
                        : typeof currentValue === 'string' ||
                            typeof currentValue === 'number'
                          ? currentValue
                          : ''
                    }
                    onChange={(e) => {
                      if (field.type === 'array') {
                        // For array types, try to parse the JSON string
                        try {
                          const parsedValue = JSON.parse(e.target.value);
                          onExecutionInputChange(field.name, parsedValue);
                        } catch {
                          // If parsing fails, store as string temporarily
                          // This allows users to type partial JSON
                          onExecutionInputChange(field.name, e.target.value);
                        }
                      } else if (isNumber) {
                        onExecutionInputChange(
                          field.name,
                          e.target.value ? Number(e.target.value) : ''
                        );
                      } else {
                        onExecutionInputChange(field.name, e.target.value);
                      }
                    }}
                    placeholder={
                      field.type === 'array'
                        ? Array.isArray(field.default)
                          ? JSON.stringify(field.default)
                          : '["item1","item2"]'
                        : field.default !== undefined
                          ? String(field.default)
                          : field.description || `Enter ${field.name}...`
                    }
                    disabled={isExecuting}
                    className={`w-full px-2 py-1.5 text-xs bg-neutral-900 border ${
                      isMissing
                        ? 'border-amber-500 focus:border-amber-400'
                        : 'border-neutral-600 focus:border-blue-500'
                    } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                      isMissing
                        ? 'focus:ring-amber-500/50'
                        : 'focus:ring-blue-500/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Execute button */}
      {onExecuteFlow && (
        <div className="p-4 border-t border-neutral-600">
          <button
            type="button"
            onClick={onExecuteFlow}
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
      )}
    </div>
  );
}

export default memo(InputSchemaNode);
