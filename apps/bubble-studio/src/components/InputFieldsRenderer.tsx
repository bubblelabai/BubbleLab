import { memo, useState } from 'react';
import { Plus, Minus, Paperclip, X } from 'lucide-react';
import {
  MAX_FILE_SIZE_BYTES,
  bytesToMB,
  isAllowedType,
  isTextLike,
  isImageFile,
  isPdfFile,
  readTextFile,
  readFileAsBase64,
  compressImageToBase64,
  FILE_INPUT_ACCEPT,
  TEXT_FILE_INPUT_ACCEPT,
  ALLOWED_FILE_TYPES_DISPLAY,
} from '../utils/fileUtils';
import AutoResizeTextarea from './AutoResizeTextarea';
import { GoogleFilePicker } from './GoogleFilePicker';

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  /** Controls whether file upload is enabled for this field. Defaults to true for string fields. */
  canBeFile?: boolean;
  /** Controls whether Google Picker UI is enabled for this field. If true, shows Google Drive picker button. */
  canBeGoogleFile?: boolean;
  properties?: Record<
    string,
    {
      type?: string;
      description?: string;
      default?: unknown;
      required?: boolean;
      canBeFile?: boolean;
      canBeGoogleFile?: boolean;
      properties?: Record<
        string,
        {
          type?: string;
          description?: string;
          default?: unknown;
          required?: boolean;
          canBeFile?: boolean;
        }
      >;
      requiredProperties?: string[];
    }
  >;
  requiredProperties?: string[];
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
  // Track uploaded file names for array entries: fieldName -> index -> fileName
  const [arrayEntryFileNames, setArrayEntryFileNames] = useState<
    Record<string, Record<number, string>>
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
        `Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES_DISPLAY}`
      );
      return;
    }

    try {
      if (isTextLike(file)) {
        // Text files: read as text
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(
            fieldName,
            `File too large. Max ${bytesToMB(MAX_FILE_SIZE_BYTES).toFixed(1)} MB`
          );
          return;
        }
        const text = await readTextFile(file);
        onInputChange(fieldName, text);
        setUploadedFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
      } else if (isPdfFile(file)) {
        // PDF files: read as base64 (no compression)
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(
            fieldName,
            `File too large. Max ${bytesToMB(MAX_FILE_SIZE_BYTES).toFixed(1)} MB`
          );
          return;
        }
        const base64 = await readFileAsBase64(file);
        onInputChange(fieldName, base64);
        setUploadedFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
      } else if (isImageFile(file)) {
        // Image files: compress client-side, convert to base64 (no data URL prefix)
        const base64 = await compressImageToBase64(file);
        const approxBytes = Math.floor((base64.length * 3) / 4);
        if (approxBytes > MAX_FILE_SIZE_BYTES) {
          setError(
            fieldName,
            `Image too large after compression. Max ${bytesToMB(MAX_FILE_SIZE_BYTES).toFixed(1)} MB`
          );
          return;
        }
        onInputChange(fieldName, base64);
        setUploadedFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
      } else {
        // Fallback: read as base64
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(
            fieldName,
            `File too large. Max ${bytesToMB(MAX_FILE_SIZE_BYTES).toFixed(1)} MB`
          );
          return;
        }
        const base64 = await readFileAsBase64(file);
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

  const handleArrayFileChange = async (
    fieldName: string,
    index: number,
    file: File | null
  ) => {
    if (!file) return;
    setError(`${fieldName}[${index}]`, null);

    // Only allow text files for array entries
    if (!isTextLike(file)) {
      setError(
        `${fieldName}[${index}]`,
        `Only text files allowed (${TEXT_FILE_INPUT_ACCEPT})`
      );
      return;
    }

    if (!isAllowedType(file)) {
      setError(
        `${fieldName}[${index}]`,
        `Unsupported file type. Allowed: ${TEXT_FILE_INPUT_ACCEPT}`
      );
      return;
    }

    try {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(
          `${fieldName}[${index}]`,
          `File too large. Max ${bytesToMB(MAX_FILE_SIZE_BYTES).toFixed(1)} MB`
        );
        return;
      }
      const text = await readTextFile(file);
      const currentArray = Array.isArray(inputValues[fieldName])
        ? (inputValues[fieldName] as string[])
        : [];
      const newArray = [...currentArray];
      newArray[index] = text;
      onInputChange(fieldName, newArray);
      setArrayEntryFileNames((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          [index]: file.name,
        },
      }));
    } catch {
      setError(`${fieldName}[${index}]`, 'Failed to read file');
    }
  };

  const handleDeleteArrayFile = (fieldName: string, index: number) => {
    setArrayEntryFileNames((prev) => {
      const next = { ...prev };
      if (next[fieldName]) {
        const fieldEntries = { ...next[fieldName] };
        delete fieldEntries[index];
        next[fieldName] = fieldEntries;
      }
      return next;
    });
    const currentArray = Array.isArray(inputValues[fieldName])
      ? (inputValues[fieldName] as string[])
      : [];
    const newArray = [...currentArray];
    newArray[index] = '';
    onInputChange(fieldName, newArray);
    setError(`${fieldName}[${index}]`, null);
  };

  const handleAddArrayEntry = (fieldName: string, field: SchemaField) => {
    const currentArray = Array.isArray(inputValues[fieldName])
      ? (inputValues[fieldName] as string[])
      : [];

    // Determine default value for new entry
    let defaultValue = '';
    if (field.default !== undefined) {
      if (Array.isArray(field.default) && field.default.length > 0) {
        // If default is an array, use the first item as template
        defaultValue = String(field.default[0]);
      } else if (typeof field.default === 'string') {
        // If default is a string, use it
        defaultValue = field.default;
      }
    }

    onInputChange(fieldName, [...currentArray, defaultValue]);
  };

  const handleRemoveArrayEntry = (fieldName: string, index: number) => {
    const currentArray = Array.isArray(inputValues[fieldName])
      ? (inputValues[fieldName] as string[])
      : [];
    const newArray = currentArray.filter((_, i) => i !== index);
    onInputChange(fieldName, newArray.length > 0 ? newArray : []);

    // Clean up file name tracking and reindex
    setArrayEntryFileNames((prev) => {
      const next = { ...prev };
      if (next[fieldName]) {
        const fieldEntries = { ...next[fieldName] };
        // Remove the deleted entry
        delete fieldEntries[index];
        // Reindex: shift all entries after the deleted index down by 1
        const reindexed: Record<number, string> = {};
        Object.entries(fieldEntries).forEach(([key, fileName]) => {
          const oldIndex = Number(key);
          if (oldIndex < index) {
            reindexed[oldIndex] = fileName;
          } else if (oldIndex > index) {
            reindexed[oldIndex - 1] = fileName;
          }
        });
        next[fieldName] = reindexed;
      }
      return next;
    });
  };

  const handleArrayEntryChange = (
    fieldName: string,
    index: number,
    value: string
  ) => {
    const currentArray = Array.isArray(inputValues[fieldName])
      ? (inputValues[fieldName] as string[])
      : [];
    const newArray = [...currentArray];
    newArray[index] = value;
    onInputChange(fieldName, newArray);
    // Clear file name if user types manually
    if (value && arrayEntryFileNames[fieldName]?.[index]) {
      setArrayEntryFileNames((prev) => {
        const next = { ...prev };
        if (next[fieldName]) {
          const fieldEntries = { ...next[fieldName] };
          delete fieldEntries[index];
          next[fieldName] = fieldEntries;
        }
        return next;
      });
    }
  };

  // Helper function to detect if a field is a Google file ID field
  // Checks explicit canBeGoogleFile first, then falls back to regex pattern matching
  const isGoogleFileField = (field: SchemaField): boolean => {
    // If explicitly set via @canBeGoogleFile JSDoc tag, use that
    if (field.canBeGoogleFile === true) {
      return true;
    }
    if (field.canBeGoogleFile === false) {
      return false;
    }
    // Otherwise, use regex pattern matching as fallback for backwards compatibility
    // Match common Google-related file ID field names while avoiding false positives
    return /\b(google[_\s-]*)?(spreadsheet|sheet|document|doc|drive|folder|file)[_\s-]*id\b/i.test(
      field.name
    );
  };

  // Helper function to determine Google file type from field name
  const getGoogleFileType = (
    fieldName: string
  ): 'spreadsheet' | 'document' | 'folder' | 'any' => {
    if (/spreadsheet/i.test(fieldName)) return 'spreadsheet';
    if (/document/i.test(fieldName)) return 'document';
    if (/folder/i.test(fieldName)) return 'folder';
    return 'any';
  };

  // Handler for Google Picker selection
  const handleGoogleFileSelect = (
    fieldName: string,
    fileId: string,
    fileName: string
  ) => {
    onInputChange(fieldName, fileId);
    // Optionally show the file name as feedback
    console.log(`Selected ${fileName} with ID: ${fileId}`);
  };

  if (schemaFields.length === 0) {
    return (
      <div
        className={`text-center py-6 px-4 bg-neutral-800/30 rounded-lg border border-dashed border-neutral-600 ${className}`}
      >
        <div className="text-xs text-neutral-400">
          No input parameters defined
        </div>
        <div className="text-[10px] text-neutral-500 mt-1">
          This flow doesn't require any inputs
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {schemaFields.map((field) => {
        const isNumber = field.type === 'number';
        const isArray = field.type === 'array';
        const isObject = field.type === 'object' && field.properties;
        const currentValue = inputValues[field.name] as
          | string
          | number
          | string[]
          | Record<string, unknown>
          | undefined;
        const isMissing =
          field.required &&
          (currentValue === undefined ||
            currentValue === '' ||
            (Array.isArray(currentValue) && currentValue.length === 0)) &&
          field.default === undefined;

        return (
          <div
            key={field.name}
            className="pb-2 border-b border-neutral-700/30 last:border-b-0 last:pb-0"
          >
            <label className="block text-xs font-semibold text-neutral-200 mb-1">
              {field.name}
              {field.required && (
                <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">
                  REQUIRED
                </span>
              )}
              {field.type && (
                <span className="ml-2 text-[10px] font-normal text-neutral-400">
                  {field.type === 'string'
                    ? '• text'
                    : field.type === 'array'
                      ? '• list'
                      : field.type === 'object'
                        ? '• object'
                        : `• ${field.type}`}
                </span>
              )}
            </label>
            {field.description && (
              <div className="text-[10px] text-neutral-400 mb-1.5">
                {field.description}
              </div>
            )}
            {isArray ? (
              <div>
                {Array.isArray(currentValue) && currentValue.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentValue.map((entry, index) => {
                      const entryFileName =
                        arrayEntryFileNames[field.name]?.[index];
                      const entryError = fieldErrors[`${field.name}[${index}]`];
                      return (
                        <div key={index} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-neutral-500 w-6 flex-shrink-0">
                              {index + 1}.
                            </span>
                            <div className="relative flex-1">
                              <AutoResizeTextarea
                                value={typeof entry === 'string' ? entry : ''}
                                onChange={(
                                  e: React.ChangeEvent<HTMLTextAreaElement>
                                ) => {
                                  handleArrayEntryChange(
                                    field.name,
                                    index,
                                    e.target.value
                                  );
                                }}
                                data-field={field.name}
                                data-index={index}
                                placeholder={`Enter entry ${index + 1}...`}
                                disabled={isExecuting || !!entryFileName}
                                className={`w-full px-2 py-1.5 text-xs bg-neutral-900 border ${
                                  entryError
                                    ? 'border-amber-500 focus:border-amber-400'
                                    : 'border-neutral-600 focus:border-blue-500'
                                } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                                  entryError
                                    ? 'focus:ring-amber-500/50'
                                    : 'focus:ring-blue-500/50'
                                } disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none ${
                                  field.canBeFile !== false
                                    ? entryFileName
                                      ? 'pr-20'
                                      : 'pr-10'
                                    : 'pr-8'
                                }`}
                              />
                              <div className="absolute right-2 top-2 flex items-center gap-1">
                                {field.canBeFile !== false && (
                                  <>
                                    {entryFileName ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteArrayFile(
                                              field.name,
                                              index
                                            )
                                          }
                                          disabled={isExecuting}
                                          className="p-0.5 hover:bg-neutral-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          aria-label={`Delete uploaded file for entry ${index + 1}`}
                                        >
                                          <X className="w-3 h-3 text-neutral-400 hover:text-neutral-200" />
                                        </button>
                                        <Paperclip className="w-3 h-3 text-neutral-300" />
                                      </>
                                    ) : (
                                      <label
                                        className="cursor-pointer group"
                                        title="Upload file"
                                      >
                                        <input
                                          type="file"
                                          className="hidden"
                                          accept={TEXT_FILE_INPUT_ACCEPT}
                                          disabled={isExecuting}
                                          aria-label={`Upload file for entry ${index + 1}`}
                                          onChange={(e) => {
                                            const f =
                                              e.target.files?.[0] || null;
                                            handleArrayFileChange(
                                              field.name,
                                              index,
                                              f
                                            );
                                            e.currentTarget.value = '';
                                          }}
                                        />
                                        <Paperclip
                                          className={`w-3.5 h-3.5 transition-all ${
                                            isExecuting
                                              ? 'text-neutral-600 cursor-not-allowed'
                                              : 'text-neutral-400 group-hover:text-blue-400 group-hover:scale-110'
                                          }`}
                                        />
                                      </label>
                                    )}
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveArrayEntry(field.name, index)
                                  }
                                  disabled={isExecuting}
                                  className="p-0.5 hover:bg-neutral-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label={`Remove entry ${index + 1}`}
                                >
                                  <Minus className="w-3 h-3 text-neutral-400 hover:text-red-400" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {entryFileName && (
                            <div className="ml-7 text-[10px] text-neutral-400">
                              📎 {entryFileName}
                            </div>
                          )}
                          {entryError && (
                            <div className="ml-7 text-[10px] text-amber-300">
                              {entryError}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {!Array.isArray(currentValue) || currentValue.length === 0 ? (
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="text-[10px] text-neutral-400">
                      {field.default !== undefined ? (
                        <>
                          {Array.isArray(field.default)
                            ? `${field.default.length} default ${field.default.length === 1 ? 'value' : 'values'}`
                            : `Default: ${String(field.default)}`}
                        </>
                      ) : (
                        'No entries'
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddArrayEntry(field.name, field)}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded border border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Entry</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddArrayEntry(field.name, field)}
                    disabled={isExecuting}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded border border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Entry</span>
                  </button>
                )}
                {fieldErrors[field.name] && (
                  <div className="text-[10px] text-amber-300">
                    {fieldErrors[field.name]}
                  </div>
                )}
              </div>
            ) : isObject ? (
              <div className="space-y-2">
                <div className="bg-neutral-900/50 rounded border border-neutral-700 p-3 space-y-3">
                  {field.properties &&
                    Object.entries(field.properties).map(
                      ([propName, propSchema]) => {
                        const objectValue =
                          typeof currentValue === 'object' &&
                          currentValue !== null &&
                          !Array.isArray(currentValue)
                            ? (currentValue as Record<string, unknown>)
                            : {};
                        const propValue = objectValue[propName];
                        const propRequired = propSchema.required || false;
                        const propIsMissing =
                          propRequired &&
                          (propValue === undefined ||
                            propValue === '' ||
                            (Array.isArray(propValue) &&
                              propValue.length === 0)) &&
                          propSchema.default === undefined;

                        const handleObjectPropertyChange = (
                          nestedPropName: string,
                          value: unknown
                        ) => {
                          const currentObj =
                            typeof currentValue === 'object' &&
                            currentValue !== null &&
                            !Array.isArray(currentValue)
                              ? { ...(currentValue as Record<string, unknown>) }
                              : {};
                          currentObj[nestedPropName] = value;
                          onInputChange(field.name, currentObj);
                        };

                        // Check if this property is also an object
                        const isNestedObject =
                          propSchema.type === 'object' && propSchema.properties;

                        return (
                          <div
                            key={propName}
                            className="pb-2 border-b border-neutral-700/30 last:border-b-0 last:pb-0"
                          >
                            <label className="block text-xs font-semibold text-neutral-300 mb-1">
                              {propName}
                              {propRequired && (
                                <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">
                                  REQUIRED
                                </span>
                              )}
                              {propSchema.type && (
                                <span className="ml-2 text-[10px] font-normal text-neutral-500">
                                  {propSchema.type === 'string'
                                    ? '• text'
                                    : propSchema.type === 'array'
                                      ? '• list'
                                      : propSchema.type === 'number'
                                        ? '• number'
                                        : propSchema.type === 'object'
                                          ? '• object'
                                          : `• ${propSchema.type}`}
                                </span>
                              )}
                            </label>
                            {propSchema.description && (
                              <div className="text-[10px] text-neutral-500 mb-1.5">
                                {propSchema.description}
                              </div>
                            )}
                            {isNestedObject ? (
                              // Recursively render nested object
                              <div className="mt-2 bg-neutral-800/50 rounded border border-neutral-600 p-2.5 space-y-2.5">
                                {propSchema.properties &&
                                  Object.entries(propSchema.properties).map(
                                    ([nestedPropName, nestedPropSchema]) => {
                                      const nestedObjectValue =
                                        typeof propValue === 'object' &&
                                        propValue !== null &&
                                        !Array.isArray(propValue)
                                          ? (propValue as Record<
                                              string,
                                              unknown
                                            >)
                                          : {};
                                      const nestedPropValue =
                                        nestedObjectValue[nestedPropName];
                                      const nestedPropRequired =
                                        nestedPropSchema.required || false;
                                      const nestedPropIsMissing =
                                        nestedPropRequired &&
                                        (nestedPropValue === undefined ||
                                          nestedPropValue === '' ||
                                          (Array.isArray(nestedPropValue) &&
                                            nestedPropValue.length === 0)) &&
                                        nestedPropSchema.default === undefined;

                                      const handleNestedObjectPropertyChange = (
                                        deepPropName: string,
                                        value: unknown
                                      ) => {
                                        const nestedObj =
                                          typeof propValue === 'object' &&
                                          propValue !== null &&
                                          !Array.isArray(propValue)
                                            ? {
                                                ...(propValue as Record<
                                                  string,
                                                  unknown
                                                >),
                                              }
                                            : {};
                                        nestedObj[deepPropName] = value;
                                        handleObjectPropertyChange(
                                          propName,
                                          nestedObj
                                        );
                                      };

                                      return (
                                        <div
                                          key={nestedPropName}
                                          className="pb-2 border-b border-neutral-600/30 last:border-b-0 last:pb-0"
                                        >
                                          <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                                            {nestedPropName}
                                            {nestedPropRequired && (
                                              <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">
                                                REQUIRED
                                              </span>
                                            )}
                                            {nestedPropSchema.type && (
                                              <span className="ml-2 text-[9px] font-normal text-neutral-600">
                                                {nestedPropSchema.type ===
                                                'string'
                                                  ? '• text'
                                                  : nestedPropSchema.type ===
                                                      'array'
                                                    ? '• list'
                                                    : nestedPropSchema.type ===
                                                        'number'
                                                      ? '• number'
                                                      : `• ${nestedPropSchema.type}`}
                                              </span>
                                            )}
                                          </label>
                                          {nestedPropSchema.description && (
                                            <div className="text-[9px] text-neutral-600 mb-1.5">
                                              {nestedPropSchema.description}
                                            </div>
                                          )}
                                          {nestedPropSchema.type ===
                                          'number' ? (
                                            <div className="flex items-center">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const numValue =
                                                    typeof nestedPropValue ===
                                                    'number'
                                                      ? nestedPropValue
                                                      : 0;
                                                  handleNestedObjectPropertyChange(
                                                    nestedPropName,
                                                    numValue - 1
                                                  );
                                                }}
                                                disabled={isExecuting}
                                                aria-label={`Decrease ${nestedPropName}`}
                                                className="p-1 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-500 transition-colors"
                                              >
                                                <Minus className="w-2.5 h-2.5" />
                                              </button>
                                              <input
                                                type="text"
                                                value={
                                                  typeof nestedPropValue ===
                                                    'string' ||
                                                  typeof nestedPropValue ===
                                                    'number'
                                                    ? nestedPropValue
                                                    : ''
                                                }
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (
                                                    val === '' ||
                                                    val === '-'
                                                  ) {
                                                    handleNestedObjectPropertyChange(
                                                      nestedPropName,
                                                      val
                                                    );
                                                  } else {
                                                    const numVal = Number(val);
                                                    if (!isNaN(numVal)) {
                                                      handleNestedObjectPropertyChange(
                                                        nestedPropName,
                                                        numVal
                                                      );
                                                    }
                                                  }
                                                }}
                                                placeholder={
                                                  nestedPropSchema.default !==
                                                  undefined
                                                    ? String(
                                                        nestedPropSchema.default
                                                      )
                                                    : nestedPropSchema.description ||
                                                      `Enter ${nestedPropName}...`
                                                }
                                                disabled={isExecuting}
                                                className={`nodrag flex-1 px-2 py-1 text-[11px] bg-neutral-900 border-t border-b ${
                                                  nestedPropIsMissing
                                                    ? 'border-amber-500 focus:border-amber-400'
                                                    : 'border-neutral-500 focus:border-blue-500'
                                                } text-neutral-100 placeholder-neutral-500 text-center focus:outline-none focus:ring-1 ${
                                                  nestedPropIsMissing
                                                    ? 'focus:ring-amber-500/50'
                                                    : 'focus:ring-blue-500/50'
                                                } disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const numValue =
                                                    typeof nestedPropValue ===
                                                    'number'
                                                      ? nestedPropValue
                                                      : 0;
                                                  handleNestedObjectPropertyChange(
                                                    nestedPropName,
                                                    numValue + 1
                                                  );
                                                }}
                                                disabled={isExecuting}
                                                aria-label={`Increase ${nestedPropName}`}
                                                className="p-1 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-500 transition-colors"
                                              >
                                                <Plus className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <AutoResizeTextarea
                                              value={
                                                typeof nestedPropValue ===
                                                  'string' ||
                                                typeof nestedPropValue ===
                                                  'number'
                                                  ? String(nestedPropValue)
                                                  : ''
                                              }
                                              onChange={(
                                                e: React.ChangeEvent<HTMLTextAreaElement>
                                              ) => {
                                                handleNestedObjectPropertyChange(
                                                  nestedPropName,
                                                  e.target.value
                                                );
                                              }}
                                              placeholder={
                                                nestedPropSchema.default !==
                                                undefined
                                                  ? String(
                                                      nestedPropSchema.default
                                                    )
                                                  : nestedPropSchema.description ||
                                                    `Enter ${nestedPropName}...`
                                              }
                                              disabled={isExecuting}
                                              className={`w-full px-2 py-1 text-[11px] bg-neutral-900 border ${
                                                nestedPropIsMissing
                                                  ? 'border-amber-500 focus:border-amber-400'
                                                  : 'border-neutral-500 focus:border-blue-500'
                                              } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                                                nestedPropIsMissing
                                                  ? 'focus:ring-amber-500/50'
                                                  : 'focus:ring-blue-500/50'
                                              } disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none`}
                                            />
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                              </div>
                            ) : propSchema.type === 'number' ? (
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const numValue =
                                      typeof propValue === 'number'
                                        ? propValue
                                        : 0;
                                    handleObjectPropertyChange(
                                      propName,
                                      numValue - 1
                                    );
                                  }}
                                  disabled={isExecuting}
                                  aria-label={`Decrease ${propName}`}
                                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="text"
                                  value={
                                    typeof propValue === 'string' ||
                                    typeof propValue === 'number'
                                      ? propValue
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                      handleObjectPropertyChange(propName, val);
                                    } else {
                                      const numVal = Number(val);
                                      if (!isNaN(numVal)) {
                                        handleObjectPropertyChange(
                                          propName,
                                          numVal
                                        );
                                      }
                                    }
                                  }}
                                  placeholder={
                                    propSchema.default !== undefined
                                      ? String(propSchema.default)
                                      : propSchema.description ||
                                        `Enter ${propName}...`
                                  }
                                  disabled={isExecuting}
                                  className={`nodrag flex-1 px-2 py-1.5 text-xs bg-neutral-900 border-t border-b ${
                                    propIsMissing
                                      ? 'border-amber-500 focus:border-amber-400'
                                      : 'border-neutral-600 focus:border-blue-500'
                                  } text-neutral-100 placeholder-neutral-500 text-center focus:outline-none focus:ring-1 ${
                                    propIsMissing
                                      ? 'focus:ring-amber-500/50'
                                      : 'focus:ring-blue-500/50'
                                  } disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const numValue =
                                      typeof propValue === 'number'
                                        ? propValue
                                        : 0;
                                    handleObjectPropertyChange(
                                      propName,
                                      numValue + 1
                                    );
                                  }}
                                  disabled={isExecuting}
                                  aria-label={`Increase ${propName}`}
                                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <AutoResizeTextarea
                                value={
                                  typeof propValue === 'string' ||
                                  typeof propValue === 'number'
                                    ? String(propValue)
                                    : ''
                                }
                                onChange={(
                                  e: React.ChangeEvent<HTMLTextAreaElement>
                                ) => {
                                  handleObjectPropertyChange(
                                    propName,
                                    e.target.value
                                  );
                                }}
                                placeholder={
                                  propSchema.default !== undefined
                                    ? String(propSchema.default)
                                    : propSchema.description ||
                                      `Enter ${propName}...`
                                }
                                disabled={isExecuting}
                                className={`w-full px-2 py-1.5 text-xs bg-neutral-900 border ${
                                  propIsMissing
                                    ? 'border-amber-500 focus:border-amber-400'
                                    : 'border-neutral-600 focus:border-blue-500'
                                } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                                  propIsMissing
                                    ? 'focus:ring-amber-500/50'
                                    : 'focus:ring-blue-500/50'
                                } disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none`}
                              />
                            )}
                          </div>
                        );
                      }
                    )}
                </div>
              </div>
            ) : isNumber ? (
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
                  className={`nodrag flex-1 px-2 py-1.5 text-xs bg-neutral-900 border-t border-b ${
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
              <div className="space-y-1">
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <AutoResizeTextarea
                      value={
                        uploadedFileNames[field.name] &&
                        (field.type === undefined || field.type === 'string') &&
                        field.canBeFile !== false
                          ? uploadedFileNames[field.name]
                          : typeof currentValue === 'string' ||
                              typeof currentValue === 'number'
                            ? String(currentValue)
                            : ''
                      }
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        onInputChange(field.name, e.target.value);
                      }}
                      placeholder={
                        field.default !== undefined
                          ? String(field.default)
                          : field.description || `Enter ${field.name}...`
                      }
                      disabled={
                        isExecuting ||
                        ((field.type === undefined ||
                          field.type === 'string') &&
                        field.canBeFile !== false
                          ? !!uploadedFileNames[field.name]
                          : false)
                      }
                      className={`w-full px-2 py-1.5 text-xs bg-neutral-900 border ${
                        isMissing
                          ? 'border-amber-500 focus:border-amber-400'
                          : 'border-neutral-600 focus:border-blue-500'
                      } rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                        isMissing
                          ? 'focus:ring-amber-500/50'
                          : 'focus:ring-blue-500/50'
                      } disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none ${
                        (field.type === undefined || field.type === 'string') &&
                        field.canBeFile !== false &&
                        uploadedFileNames[field.name]
                          ? 'pr-14'
                          : (field.type === undefined ||
                                field.type === 'string') &&
                              field.canBeFile !== false
                            ? 'pr-7'
                            : ''
                      }`}
                    />
                    {(field.type === undefined || field.type === 'string') &&
                      field.canBeFile !== false && (
                        <div className="absolute right-2 top-2 flex items-center gap-1">
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
                            <label
                              className="cursor-pointer group"
                              title={`Upload file (${ALLOWED_FILE_TYPES_DISPLAY})`}
                            >
                              <input
                                type="file"
                                className="hidden"
                                accept={FILE_INPUT_ACCEPT}
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
                                className={`w-3.5 h-3.5 transition-all ${
                                  isExecuting
                                    ? 'text-neutral-600 cursor-not-allowed'
                                    : 'text-neutral-400 group-hover:text-blue-400 group-hover:scale-110'
                                }`}
                              />
                            </label>
                          )}
                        </div>
                      )}
                  </div>
                  {/* Google File Picker Button */}
                  {isGoogleFileField(field) && (
                    <div className="w-10">
                      <GoogleFilePicker
                        fileType={getGoogleFileType(field.name)}
                        onSelect={(fileId, fileName) =>
                          handleGoogleFileSelect(field.name, fileId, fileName)
                        }
                        disabled={isExecuting}
                      />
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
