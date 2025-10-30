import { memo, useState } from 'react';
import { Plus, Minus, Paperclip, X } from 'lucide-react';
import {
  MAX_BYTES,
  bytesToMB,
  isAllowedType,
  isTextLike,
  readTextFile,
  compressPngToBase64,
} from '../utils/fileUtils';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );
  const [uploadedFileNames, setUploadedFileNames] = useState<
    Record<string, string>
  >({});

  const setError = (fieldName: string, msg: string | null) => {
    setFieldErrors((prev) => ({ ...prev, [fieldName]: msg }));
  };

  const handleFileChange = async (fieldName: string, file: File | null) => {
    if (!file) return;
    setError(fieldName, null);

    if (!isAllowedType(file)) {
      setError(
        fieldName,
        'Unsupported file type. Allowed: html, csv, txt, png'
      );
      return;
    }

    try {
      if (isTextLike(file)) {
        if (file.size > MAX_BYTES) {
          setError(
            fieldName,
            `File too large. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
          );
          return;
        }
        const text = await readTextFile(file);
        onInputChange(fieldName, text);
        setUploadedFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
      } else {
        // PNG path: compress client-side, convert to base64 (no data URL prefix)
        const base64 = await compressPngToBase64(file);
        const approxBytes = Math.floor((base64.length * 3) / 4);
        if (approxBytes > MAX_BYTES) {
          setError(
            fieldName,
            `Image too large after compression. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
          );
          return;
        }
        onInputChange(fieldName, base64);
        setUploadedFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
      }
    } catch {
      setError(fieldName, 'Failed to read or process file');
    }
  };

  const handleDeleteFile = (fieldName: string) => {
    setUploadedFileNames((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    onInputChange(fieldName, '');
    setError(fieldName, null);
  };
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
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={
                      uploadedFileNames[field.name] &&
                      (field.type === undefined || field.type === 'string')
                        ? uploadedFileNames[field.name]
                        : field.type === 'array'
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
                      const newValue = e.target.value;
                      if (field.type === 'array') {
                        try {
                          const parsedValue = JSON.parse(newValue);
                          onInputChange(field.name, parsedValue);
                        } catch {
                          onInputChange(field.name, newValue);
                        }
                      } else {
                        onInputChange(field.name, newValue);
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
                    disabled={
                      isExecuting ||
                      field.type === undefined ||
                      field.type === 'string'
                        ? !!uploadedFileNames[field.name]
                        : false
                    }
                    className={`w-full px-2 py-1.5 text-xs bg-neutral-900 border ${
                      isMissing
                        ? 'border-amber-500 focus:border-amber-400'
                        : 'border-neutral-600 focus:border-blue-500'
                    } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                      isMissing
                        ? 'focus:ring-amber-500/50'
                        : 'focus:ring-blue-500/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                      (field.type === undefined || field.type === 'string') &&
                      uploadedFileNames[field.name]
                        ? 'pr-14'
                        : field.type === undefined || field.type === 'string'
                          ? 'pr-7'
                          : ''
                    }`}
                  />
                  {(field.type === undefined || field.type === 'string') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {uploadedFileNames[field.name] ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(field.name)}
                            disabled={isExecuting}
                            className="p-0.5 hover:bg-neutral-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Delete uploaded file for ${field.name}`}
                          >
                            <X className="w-3 h-3 text-neutral-400 hover:text-neutral-200" />
                          </button>
                          <Paperclip className="w-3 h-3 text-neutral-300" />
                        </>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".html,.csv,.txt,image/png"
                            disabled={isExecuting}
                            aria-label={`Upload file for ${field.name}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              handleFileChange(field.name, f);
                              // reset so selecting the same file again triggers onChange
                              e.currentTarget.value = '';
                            }}
                          />
                          <Paperclip
                            className={`w-3 h-3 transition-colors ${
                              isExecuting
                                ? 'text-neutral-600 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {fieldErrors[field.name] && (
                  <div className="text-[10px] text-amber-300">
                    {fieldErrors[field.name]}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(InputFieldsRenderer);
