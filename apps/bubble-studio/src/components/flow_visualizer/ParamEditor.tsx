import { useState, useMemo } from 'react';
import { Pencil, Lock } from 'lucide-react';
import type { BubbleParameter } from '@bubblelab/shared-schemas';
import { extractParamValue } from '@/utils/bubbleParamEditor';

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

interface ParamEditorProps {
  param: BubbleParameter;
  variableId: number;
  bubbleName?: string;
  updateBubbleParam: (
    variableId: number,
    paramName: string,
    newValue: unknown
  ) => void;
  onParamEditInCode?: (paramName: string) => void;
}

export function ParamEditor({
  param,
  variableId,
  bubbleName,
  updateBubbleParam,
  onParamEditInCode,
}: ParamEditorProps) {
  const extracted = extractParamValue(param, param.name, bubbleName);
  const isEditable = extracted?.shouldBeEditable ?? false;
  const formattedValue = formatValue(extracted?.value ?? param.value);
  const [editValue, setEditValue] = useState(formattedValue);
  const isMultiline =
    formattedValue.includes('\n') || formattedValue.length > 50;

  // Sync local state when param.value changes (e.g., from code editor)
  useMemo(() => setEditValue(formattedValue), [formattedValue]);

  const handleBlur = () => {
    if (editValue !== formattedValue) {
      updateBubbleParam(variableId, param.name, editValue);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-white">
            {param.name}
            {param.type && (
              <span className="ml-2 text-sm text-neutral-400">
                ({param.type})
              </span>
            )}
          </p>
          {isEditable ? (
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
      {isEditable ? (
        isMultiline ? (
          <textarea
            className="mt-3 w-full min-h-[120px] max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200 font-mono focus:border-purple-500 focus:outline-none resize-y"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            title={param.name}
          />
        ) : (
          <input
            type="text"
            className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-3 text-sm text-neutral-200 font-mono focus:border-purple-500 focus:outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            title={param.name}
          />
        )
      ) : (
        <pre className="mt-3 w-full max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-neutral-700 bg-neutral-950/50 px-4 py-3 text-sm text-neutral-400 font-mono">
          {formattedValue}
        </pre>
      )}
    </div>
  );
}

export default ParamEditor;
