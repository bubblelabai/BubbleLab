import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
}

interface InputFieldsRendererProps {
  schemaFields: SchemaField[];
  inputValues: Record<string, unknown>;
  onInputChange: (fieldName: string, value: unknown) => void;
  isExecuting?: boolean;
  className?: string;
}

function InputFieldsRenderer({
  schemaFields,
  inputValues,
  onInputChange,
  isExecuting = false,
  className = '',
}: InputFieldsRendererProps) {
  if (schemaFields.length === 0) {
    return (
      <div className={`text-xs text-neutral-400 text-center py-2 ${className}`}>
        No input parameters defined
      </div>
    );
  }

  return (
    <div className={className}>
      {schemaFields.map((field) => {
        const isNumber = field.type === 'number';
        const currentValue = inputValues[field.name] as
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
              {field.required && <span className="text-red-400 ml-1">*</span>}
              {field.type && (
                <span className="ml-1 text-neutral-500">({field.type})</span>
              )}
            </label>
            {field.description && (
              <div className="text-[10px] text-neutral-500 mb-1">
                {field.description}
              </div>
            )}
            {isNumber ? (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    const numValue =
                      typeof currentValue === 'number' ? currentValue : 0;
                    onInputChange(field.name, numValue - 1);
                  }}
                  disabled={isExecuting}
                  aria-label={`Decrease ${field.name}`}
                  className="p-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  value={
                    typeof currentValue === 'string' ||
                    typeof currentValue === 'number'
                      ? currentValue
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || val === '-') {
                      onInputChange(field.name, val);
                    } else {
                      const numVal = Number(val);
                      if (!isNaN(numVal)) {
                        onInputChange(field.name, numVal);
                      }
                    }
                  }}
                  placeholder={
                    field.default !== undefined
                      ? String(field.default)
                      : field.description || `Enter ${field.name}...`
                  }
                  disabled={isExecuting}
                  className={`flex-1 px-2 py-1.5 text-xs bg-neutral-900 border-t border-b ${
                    isMissing
                      ? 'border-amber-500 focus:border-amber-400'
                      : 'border-neutral-600 focus:border-blue-500'
                  } text-neutral-100 placeholder-neutral-500 text-center focus:outline-none focus:ring-1 ${
                    isMissing
                      ? 'focus:ring-amber-500/50'
                      : 'focus:ring-blue-500/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const numValue =
                      typeof currentValue === 'number' ? currentValue : 0;
                    onInputChange(field.name, numValue + 1);
                  }}
                  disabled={isExecuting}
                  aria-label={`Increase ${field.name}`}
                  className="p-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <input
                type="text"
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
                      onInputChange(field.name, parsedValue);
                    } catch {
                      // If parsing fails, store as string temporarily
                      // This allows users to type partial JSON
                      onInputChange(field.name, e.target.value);
                    }
                  } else {
                    onInputChange(field.name, e.target.value);
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
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(InputFieldsRenderer);
