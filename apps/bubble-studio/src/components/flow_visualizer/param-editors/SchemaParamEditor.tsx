import { useState, useEffect } from 'react';
import { Pencil, Lock, ChevronDown, Plus } from 'lucide-react';
import type { MergedParam } from '@/utils/schemaUtils';
import { formatDisplayValue, parseValueForSchema } from '@/utils/schemaUtils';
import type { BubbleParameterType } from '@bubblelab/shared-schemas';

export interface SchemaParamEditorProps {
  /** Merged parameter with schema info and current value */
  param: MergedParam;
  /** Variable ID of the bubble */
  variableId: number;
  /** Callback to update parameter value */
  onValueChange: (
    paramName: string,
    newValue: unknown,
    paramType?: BubbleParameterType
  ) => void;
  /** Optional callback to view code for this param */
  onParamEditInCode?: (paramName: string) => void;
  /** Whether to allow adding new params that don't exist in code (default: true) */
  allowAddNew?: boolean;
}

/**
 * Map MergedParam.paramType to BubbleParameterType for adding new params
 */
function mapToBubbleParamType(
  paramType: MergedParam['paramType']
): BubbleParameterType {
  switch (paramType) {
    case 'string':
    case 'enum':
      return 'string' as BubbleParameterType;
    case 'number':
      return 'number' as BubbleParameterType;
    case 'boolean':
      return 'boolean' as BubbleParameterType;
    case 'array':
      return 'array' as BubbleParameterType;
    case 'object':
      return 'object' as BubbleParameterType;
    default:
      return 'string' as BubbleParameterType;
  }
}

/**
 * Get the initial value for adding a new parameter
 */
function getInitialValueForType(param: MergedParam): unknown {
  // Use default value if available
  if (param.defaultValue !== undefined) {
    return param.defaultValue;
  }

  // Otherwise, provide type-appropriate defaults
  switch (param.paramType) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    case 'enum':
      return param.enumOptions?.[0] ?? '';
    case 'string':
    default:
      return '';
  }
}

/**
 * Schema-aware parameter editor component
 * Renders appropriate input based on JSON Schema type
 */
export function SchemaParamEditor({
  param,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  variableId,
  onValueChange,
  onParamEditInCode,
}: SchemaParamEditorProps) {
  const formattedValue = formatDisplayValue(param.value);
  const [editValue, setEditValue] = useState(formattedValue);

  // Sync local state when param.value changes
  useEffect(() => setEditValue(formattedValue), [formattedValue]);

  const handleBlur = () => {
    if (editValue !== formattedValue) {
      const parsedValue = parseValueForSchema(editValue, param.paramType);
      onValueChange(param.name, parsedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditValue(formattedValue);
      e.currentTarget.blur();
    }
  };

  // Render boolean toggle
  const renderBooleanToggle = () => {
    const boolValue = param.value === true || param.value === 'true';
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={boolValue}
          title={`${param.name}: ${boolValue ? 'On' : 'Off'}`}
          onClick={() => onValueChange(param.name, !boolValue)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-neutral-900 ${
            boolValue ? 'bg-purple-600' : 'bg-neutral-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              boolValue ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-neutral-300">
          {boolValue ? 'true' : 'false'}
        </span>
      </div>
    );
  };

  // Render enum dropdown
  const renderEnumDropdown = () => {
    const options = param.enumOptions || [];
    const currentValue = formatDisplayValue(param.value);

    return (
      <div className="mt-3 relative">
        <select
          title={param.name}
          value={currentValue}
          onChange={(e) => onValueChange(param.name, e.target.value)}
          className="w-full appearance-none rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 pr-10 text-sm text-neutral-200 focus:border-purple-500 focus:outline-none cursor-pointer"
        >
          {!param.hasRuntimeValue && (
            <option value="" disabled>
              Select {param.name}...
            </option>
          )}
          {options.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
      </div>
    );
  };

  // Render number input
  const renderNumberInput = () => {
    return (
      <input
        type="text"
        inputMode="numeric"
        className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200 font-mono focus:border-purple-500 focus:outline-none"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        title={param.name}
        placeholder={
          param.defaultValue !== undefined
            ? String(param.defaultValue)
            : undefined
        }
      />
    );
  };

  // Render string input (single line or multiline)
  const renderStringInput = () => {
    const isMultiline =
      formattedValue.includes('\n') || formattedValue.length > 50;

    if (isMultiline) {
      return (
        <textarea
          className="mt-3 w-full min-h-[120px] max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200 font-mono focus:border-purple-500 focus:outline-none resize-y"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditValue(formattedValue);
              e.currentTarget.blur();
            }
          }}
          title={param.name}
          placeholder={
            param.defaultValue !== undefined
              ? String(param.defaultValue)
              : undefined
          }
        />
      );
    }

    return (
      <input
        type="text"
        className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200 font-mono focus:border-purple-500 focus:outline-none"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        title={param.name}
        placeholder={
          param.defaultValue !== undefined
            ? String(param.defaultValue)
            : undefined
        }
      />
    );
  };

  // Render read-only display for non-editable params
  const renderReadOnly = () => {
    return (
      <pre className="mt-3 w-full max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-neutral-700 bg-neutral-950/50 px-4 py-3 text-sm text-neutral-400 font-mono">
        {formattedValue ||
          (param.defaultValue !== undefined
            ? `(default: ${param.defaultValue})`
            : '(not set)')}
      </pre>
    );
  };

  // Render "Add Parameter" button for params not yet in code
  const renderAddButton = () => {
    const handleAdd = () => {
      const initialValue = getInitialValueForType(param);
      const bubbleParamType = mapToBubbleParamType(param.paramType);
      onValueChange(param.name, initialValue, bubbleParamType);
    };

    return (
      <button
        type="button"
        onClick={handleAdd}
        className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-purple-500/50 bg-purple-500/10 px-4 py-3 text-sm font-medium text-purple-300 transition-all hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-200 w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Add {param.name}
        {param.defaultValue !== undefined && (
          <span className="text-purple-400/70 font-normal">
            (default: {formatDisplayValue(param.defaultValue)})
          </span>
        )}
      </button>
    );
  };

  // Render the appropriate editor based on type
  const renderEditor = () => {
    // Show add button for editable params that don't exist in code yet
    if (!param.hasRuntimeValue && param.isEditable) {
      return renderAddButton();
    }

    if (!param.isEditable) {
      return renderReadOnly();
    }

    switch (param.paramType) {
      case 'boolean':
        return renderBooleanToggle();
      case 'enum':
        return renderEnumDropdown();
      case 'number':
        return renderNumberInput();
      case 'string':
        return renderStringInput();
      default:
        return renderReadOnly();
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
      {/* Header with name, type, badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-semibold text-white">
            {param.name}
            {param.isRequired && <span className="text-red-400 ml-1">*</span>}
          </p>
          <span className="text-sm text-neutral-500">({param.paramType})</span>
          {!param.hasRuntimeValue && param.isEditable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/30">
              <Plus className="h-3 w-3" />
              Not in code
            </span>
          ) : param.isEditable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-300 border border-purple-500/30">
              <Pencil className="h-3 w-3" />
              Editable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400 border border-neutral-700">
              <Lock className="h-3 w-3" />
              Read-only
            </span>
          )}
        </div>
        {onParamEditInCode && (
          <button
            type="button"
            onClick={() => onParamEditInCode(param.name)}
            className="text-sm font-medium text-purple-300 transition hover:text-purple-200"
          >
            View Code
          </button>
        )}
      </div>

      {/* Description */}
      {param.description && (
        <p className="mt-2 text-xs text-neutral-400">{param.description}</p>
      )}

      {/* Editor */}
      {renderEditor()}
    </div>
  );
}

export default SchemaParamEditor;
