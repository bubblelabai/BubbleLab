import React, { useState, useEffect } from 'react';

interface InputParametersProps {
  flowName: string;
  inputsSchema: string;
  onInputsChange: (inputs: Record<string, unknown>) => void;
  onExecute?: () => void;
  isExecuting?: boolean;
}

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  // Array-specific properties
  minItems?: number;
  maxItems?: number;
  items?: {
    type?: string;
    properties?: Record<
      string,
      {
        type?: string;
        description?: string;
        required?: string[];
      }
    >;
    required?: string[];
  };
}

const isValidJSONString = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

const sanitizeJSONString = (jsonString: string): string => {
  if (!jsonString || typeof jsonString !== 'string') {
    return '{}';
  }

  // Trim whitespace and remove any trailing content after JSON
  const trimmed = jsonString.trim();

  // Try to find the end of the first valid JSON object/array
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') braceCount++;
    else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && bracketCount === 0) {
        endIndex = i + 1;
        break;
      }
    } else if (char === '[') bracketCount++;
    else if (char === ']') {
      bracketCount--;
      if (braceCount === 0 && bracketCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex > 0) {
    return trimmed.substring(0, endIndex);
  }

  return trimmed;
};

const parseJSONSchema = (schemaString: string): SchemaField[] => {
  if (!schemaString || typeof schemaString !== 'string') {
    console.warn('Invalid schema string provided to parseJSONSchema');
    return [];
  }

  try {
    // First, sanitize the JSON string
    const sanitizedSchema = sanitizeJSONString(schemaString);

    if (!isValidJSONString(sanitizedSchema)) {
      console.error('Schema string is not valid JSON after sanitization:', {
        original:
          schemaString.substring(0, 200) +
          (schemaString.length > 200 ? '...' : ''),
        sanitized:
          sanitizedSchema.substring(0, 200) +
          (sanitizedSchema.length > 200 ? '...' : ''),
      });
      return [];
    }

    const schema = JSON.parse(sanitizedSchema);

    if (!schema || typeof schema !== 'object') {
      console.error('Parsed schema is not a valid object:', schema);
      return [];
    }

    const fields: SchemaField[] = [];

    if (schema.properties && typeof schema.properties === 'object') {
      type PropertySchema = {
        type?: string;
        description?: string;
        minItems?: number;
        maxItems?: number;
        items?: {
          type?: string;
          properties?: Record<
            string,
            {
              type?: string;
              description?: string;
            }
          >;
          required?: string[];
        };
      };
      Object.entries(
        schema.properties as Record<string, PropertySchema>
      ).forEach(([key, value]: [string, PropertySchema]) => {
        if (value && typeof value === 'object') {
          fields.push({
            name: key,
            type: value.type || 'string',
            required:
              (Array.isArray(schema.required) &&
                schema.required.includes(key)) ||
              false,
            description: value.description,
            minItems: value.minItems,
            maxItems: value.maxItems,
            items: value.items,
          });
        }
      });
    }

    return fields;
  } catch (error) {
    console.error('Failed to parse JSON schema:', {
      error: error instanceof Error ? error.message : String(error),
      schema:
        schemaString.substring(0, 500) +
        (schemaString.length > 500 ? '...' : ''),
    });
    return [];
  }
};

export const InputParameters: React.FC<InputParametersProps> = ({
  flowName,
  inputsSchema,
  onInputsChange,
  onExecute,
  isExecuting = false,
}) => {
  // Generate storage key based on flow name and inputs schema
  const storageKey = `flow-inputs-${flowName}-${btoa(inputsSchema || '').slice(0, 10)}`;
  console.log(
    '[InputParameters] Generated storage key:',
    storageKey,
    'for flowName:',
    flowName
  );

  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [inputTypes, setInputTypes] = useState<Record<string, 'text' | 'file'>>(
    {}
  );
  const [arrayItemCounts, setArrayItemCounts] = useState<
    Record<string, number>
  >({});
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  // State for custom field names and edit mode
  const [customFieldNames, setCustomFieldNames] = useState<
    Record<string, string>
  >({});
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<string>('');

  const schemaFields = parseJSONSchema(inputsSchema);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    console.log(
      '[InputParameters] Attempting to load from localStorage with key:',
      storageKey
    );
    try {
      const saved = localStorage.getItem(storageKey);
      console.log('[InputParameters] Raw saved data:', saved);

      if (saved) {
        const parsedData = JSON.parse(saved);
        console.log('[InputParameters] Parsed saved data:', parsedData);

        // Only load if data exists and is valid
        let dataLoaded = false;
        if (parsedData.inputs && typeof parsedData.inputs === 'object') {
          setInputs(parsedData.inputs);
          dataLoaded = true;
        }
        if (parsedData.fileNames && typeof parsedData.fileNames === 'object') {
          setFileNames(parsedData.fileNames);
          dataLoaded = true;
        }
        if (
          parsedData.inputTypes &&
          typeof parsedData.inputTypes === 'object'
        ) {
          setInputTypes(parsedData.inputTypes);
          dataLoaded = true;
        }
        if (
          parsedData.arrayItemCounts &&
          typeof parsedData.arrayItemCounts === 'object'
        ) {
          setArrayItemCounts(parsedData.arrayItemCounts);
          dataLoaded = true;
        }
        if (
          parsedData.customFieldNames &&
          typeof parsedData.customFieldNames === 'object'
        ) {
          setCustomFieldNames(parsedData.customFieldNames);
          dataLoaded = true;
        }
        setHasLoadedFromStorage(dataLoaded);
      } else {
        console.log('[InputParameters] No saved data found in localStorage');
      }
    } catch (error) {
      console.warn('[InputParameters] Error loading saved inputs:', error);
    }

    // Mark as initialized after loading attempt (successful or not)
    setHasInitialized(true);
  }, [storageKey]);

  // Save data to localStorage whenever inputs change (but only after initialization)
  useEffect(() => {
    if (!hasInitialized) {
      console.log('[InputParameters] Skipping save - not yet initialized');
      return;
    }

    try {
      const dataToSave = {
        inputs,
        fileNames,
        inputTypes,
        arrayItemCounts,
        customFieldNames,
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log(
        '[InputParameters] Saving inputs to localStorage:',
        dataToSave
      );
    } catch (error) {
      console.warn('[InputParameters] Error saving inputs:', error);
    }
  }, [
    inputs,
    fileNames,
    inputTypes,
    arrayItemCounts,
    customFieldNames,
    storageKey,
    hasInitialized,
  ]);

  // Notify parent component when inputs change
  useEffect(() => {
    onInputsChange(inputs);
  }, [inputs, onInputsChange]);

  const handleInputChange = (fieldName: string, value: unknown) => {
    setInputs((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:mime/type;base64, prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      setFileNames((prev) => ({
        ...prev,
        [fieldName]: file.name,
      }));

      // Check if this is a nested array property
      if (fieldName.includes('[') && fieldName.includes(']')) {
        // Parse nested array object property like "images[0].data"
        const objectMatch = fieldName.match(/^(.+?)\[(\d+)\]\.(.+)$/);
        if (objectMatch) {
          const [, arrayFieldName, indexStr, propName] = objectMatch;
          const itemIndex = parseInt(indexStr, 10);

          setInputs((prev) => {
            const newInputs = { ...prev };
            const currentArray =
              (newInputs[arrayFieldName] as Record<string, unknown>[]) || [];
            if (!currentArray[itemIndex]) {
              currentArray[itemIndex] = {};
            }
            (currentArray[itemIndex] as Record<string, unknown>)[propName] =
              base64;
            newInputs[arrayFieldName] = currentArray;
            return newInputs;
          });
          return;
        }

        // Parse simple array item like "tags[0]"
        const simpleMatch = fieldName.match(/^(.+?)\[(\d+)\]$/);
        if (simpleMatch) {
          const [, arrayFieldName, indexStr] = simpleMatch;
          const itemIndex = parseInt(indexStr, 10);

          setInputs((prev) => {
            const newInputs = { ...prev };
            const currentArray = (newInputs[arrayFieldName] as unknown[]) || [];
            currentArray[itemIndex] = base64;
            newInputs[arrayFieldName] = currentArray;
            return newInputs;
          });
          return;
        }
      }

      // Regular field (non-nested)
      handleInputChange(fieldName, base64);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  // Function to clear saved inputs from localStorage
  const clearSavedInputs = () => {
    try {
      localStorage.removeItem(storageKey);
      setInputs({});
      setFileNames({});
      setInputTypes({});
      setArrayItemCounts({});
      setCustomFieldNames({});
      setHasLoadedFromStorage(false);
      console.log('[InputParameters] Cleared saved inputs');
    } catch (error) {
      console.warn('[InputParameters] Error clearing saved inputs:', error);
    }
  };

  // Helper function to get display name for a field
  const getFieldDisplayName = (fieldName: string): string => {
    if (customFieldNames[fieldName]) {
      return customFieldNames[fieldName];
    }

    // For nested array properties like "images[0].data", show just the property name by default
    const nestedMatch = fieldName.match(/^.+\[\d+\]\.(.+)$/);
    if (nestedMatch) {
      return nestedMatch[1]; // Return just the property name (e.g., "data" from "images[0].data")
    }

    return fieldName;
  };

  // Functions for handling field name editing
  const startEditingFieldName = (fieldName: string) => {
    setEditingFieldName(fieldName);
    setEditingFieldValue(getFieldDisplayName(fieldName));
  };

  const saveFieldName = () => {
    if (editingFieldName && editingFieldValue.trim()) {
      setCustomFieldNames((prev) => ({
        ...prev,
        [editingFieldName]: editingFieldValue.trim(),
      }));
    }
    setEditingFieldName(null);
    setEditingFieldValue('');
  };

  const cancelEditingFieldName = () => {
    setEditingFieldName(null);
    setEditingFieldValue('');
  };

  // Editable field name component
  const EditableFieldName: React.FC<{
    fieldName: string;
    required: boolean;
    className?: string;
  }> = ({ fieldName, required, className = '' }) => {
    const isEditing = editingFieldName === fieldName;
    const displayName = getFieldDisplayName(fieldName);

    if (isEditing) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <input
            title="Field name"
            type="text"
            value={editingFieldValue}
            onChange={(e) => setEditingFieldValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveFieldName();
              } else if (e.key === 'Escape') {
                cancelEditingFieldName();
              }
            }}
            onBlur={saveFieldName}
            autoFocus
            className="text-sm font-medium text-foreground bg-background border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-info-20"
          />
          <button
            type="button"
            onClick={saveFieldName}
            className="text-xs text-green-400 hover:text-green-300 transition-colors"
            title="Save"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={cancelEditingFieldName}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 group ${className}`}>
        <label className="block text-sm font-medium text-foreground">
          {displayName}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <button
          type="button"
          onClick={() => startEditingFieldName(fieldName)}
          className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground-80 transition-all duration-200 p-1 rounded-full hover:bg-muted"
          title="Edit field name"
        >
          ✏️
        </button>
      </div>
    );
  };

  const toggleInputType = (fieldName: string) => {
    setInputTypes((prev) => ({
      ...prev,
      [fieldName]: prev[fieldName] === 'file' ? 'text' : 'file',
    }));

    // Clear the input when switching types
    setInputs((prev) => ({
      ...prev,
      [fieldName]: '',
    }));

    // Clear filename if switching away from file
    if (inputTypes[fieldName] === 'file') {
      setFileNames((prev) => {
        const newFileNames = { ...prev };
        delete newFileNames[fieldName];
        return newFileNames;
      });
    }
  };

  // Initialize array item counts based on schema constraints
  const getInitialArrayItemCount = (field: SchemaField): number => {
    if (field.type !== 'array') return 0;
    if (
      field.minItems !== undefined &&
      field.maxItems !== undefined &&
      field.minItems === field.maxItems
    ) {
      return field.minItems; // Fixed size array
    }
    return field.minItems || 1; // Dynamic array starts with minItems or 1
  };

  const addArrayItem = (fieldName: string) => {
    setArrayItemCounts((prev) => ({
      ...prev,
      [fieldName]: (prev[fieldName] || 1) + 1,
    }));
  };

  const removeArrayItem = (fieldName: string, index: number) => {
    setArrayItemCounts((prev) => ({
      ...prev,
      [fieldName]: Math.max((prev[fieldName] || 1) - 1, 1),
    }));

    // Clean up the input data for removed items
    setInputs((prev) => {
      const newInputs = { ...prev };
      const currentArray = (newInputs[fieldName] as unknown[]) || [];
      currentArray.splice(index, 1);
      newInputs[fieldName] = currentArray;
      return newInputs;
    });
  };

  const handleArrayItemChange = (
    fieldName: string,
    itemIndex: number,
    itemValue: unknown
  ) => {
    setInputs((prev) => {
      const newInputs = { ...prev };
      const currentArray = (newInputs[fieldName] as unknown[]) || [];
      currentArray[itemIndex] = itemValue;
      newInputs[fieldName] = currentArray;
      return newInputs;
    });
  };

  const renderArrayField = (field: SchemaField) => {
    const itemCount =
      arrayItemCounts[field.name] || getInitialArrayItemCount(field);
    const isFixedSize =
      field.minItems !== undefined &&
      field.maxItems !== undefined &&
      field.minItems === field.maxItems;
    const canAddMore = !field.maxItems || itemCount < field.maxItems;
    const canRemove = !field.minItems || itemCount > field.minItems;

    return (
      <div key={field.name} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EditableFieldName
              fieldName={field.name}
              required={field.required}
            />
            <span className="text-xs text-muted-foreground">
              {isFixedSize
                ? `(${field.minItems} items required)`
                : field.minItems && field.maxItems
                  ? `(${field.minItems}-${field.maxItems} items)`
                  : field.minItems
                    ? `(min ${field.minItems} items)`
                    : field.maxItems
                      ? `(max ${field.maxItems} items)`
                      : '(array)'}
            </span>
          </div>
          {!isFixedSize && canAddMore && (
            <button
              type="button"
              onClick={() => addArrayItem(field.name)}
              className="text-xs px-3 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all duration-200 flex items-center gap-1"
            >
              <span>+</span>
              Add More
            </button>
          )}
        </div>

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}

        <div className="space-y-3 pl-4 border-l-2 border-gray-700">
          {Array.from({ length: itemCount }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground-80">
                  Item {index + 1}
                </span>
                {!isFixedSize && canRemove && itemCount > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem(field.name, index)}
                    className="text-xs px-2 py-1 bg-red-600/20 text-red-300 border border-red-500/30 rounded hover:bg-red-600/30 transition-all duration-200"
                  >
                    ×
                  </button>
                )}
              </div>
              {renderArrayItem(field, index)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArrayItem = (field: SchemaField, itemIndex: number) => {
    if (!field.items) return null;

    // Handle array of objects (like the images case)
    if (field.items.type === 'object' && field.items.properties) {
      return (
        <div className="space-y-3 bg-background border border-border rounded-lg p-4">
          {Object.entries(field.items.properties).map(
            ([propName, propSchema]) => {
              const fullFieldName = `${field.name}[${itemIndex}].${propName}`;
              const isFileInput = inputTypes[fullFieldName] === 'file';
              const currentValue = (
                (inputs[field.name] as Record<string, unknown>[])?.[
                  itemIndex
                ] as Record<string, unknown>
              )?.[propName];

              return (
                <div key={propName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <EditableFieldName
                      fieldName={fullFieldName}
                      required={
                        field.items?.required?.includes(propName) || false
                      }
                      className="text-xs font-medium text-foreground-80"
                    />
                    <button
                      type="button"
                      onClick={() => toggleInputType(fullFieldName)}
                      className={`text-xs px-2 py-1 rounded-full transition-all duration-200 ${
                        isFileInput
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {isFileInput ? '📁 File' : '📝 Text'}
                    </button>
                  </div>

                  {propSchema.description && (
                    <p className="text-xs text-muted-foreground">
                      {propSchema.description}
                    </p>
                  )}

                  {isFileInput ? (
                    <div className="space-y-2">
                      <input
                        title={`${propName} for item ${itemIndex + 1}`}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(fullFieldName, file);
                          }
                        }}
                        className="w-full text-sm text-foreground-80 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer border border-border rounded-lg bg-background focus:border-info focus:outline-none focus:ring-2 focus:ring-info-20 transition-all duration-200"
                        accept=".pdf,.doc,.docx,.txt,image/*,.json,.csv,.xlsx"
                      />
                      {fileNames[fullFieldName] && (
                        <div className="flex items-center gap-2 text-xs bg-muted px-3 py-2 rounded-lg border border-border">
                          <span className="text-green-400">✅</span>
                          <span className="text-foreground-80">
                            {fileNames[fullFieldName]}
                          </span>
                          <span className="text-green-400 ml-auto">Ready</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type={propSchema.type === 'number' ? 'number' : 'text'}
                      value={
                        typeof currentValue === 'string' ||
                        typeof currentValue === 'number'
                          ? currentValue
                          : ''
                      }
                      onChange={(e) => {
                        const newValue =
                          propSchema.type === 'number'
                            ? e.target.value
                              ? Number(e.target.value)
                              : ''
                            : e.target.value;

                        // Update the nested object value
                        setInputs((prev) => {
                          const newInputs = { ...prev };
                          const currentArray =
                            (newInputs[field.name] as Record<
                              string,
                              unknown
                            >[]) || [];
                          if (!currentArray[itemIndex]) {
                            currentArray[itemIndex] = {};
                          }
                          (currentArray[itemIndex] as Record<string, unknown>)[
                            propName
                          ] = newValue;
                          newInputs[field.name] = currentArray;
                          return newInputs;
                        });
                      }}
                      placeholder={
                        propSchema.description || `Enter ${propName}...`
                      }
                      className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-info focus:border-info transition-all duration-200 text-sm"
                    />
                  )}
                </div>
              );
            }
          )}
        </div>
      );
    }

    // Handle array of simple types (string, number, etc.)
    const isFileInput = inputTypes[`${field.name}[${itemIndex}]`] === 'file';
    const currentValue = (inputs[field.name] as unknown[])?.[itemIndex];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Value</span>
          <button
            type="button"
            onClick={() => toggleInputType(`${field.name}[${itemIndex}]`)}
            className={`text-xs px-2 py-1 rounded-full transition-all duration-200 ${
              isFileInput
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            {isFileInput ? '📁 File' : '📝 Text'}
          </button>
        </div>

        {isFileInput ? (
          <div className="space-y-2">
            <input
              title={`${field.name} item ${itemIndex + 1}`}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(`${field.name}[${itemIndex}]`, file);
                }
              }}
              className="w-full text-sm text-foreground-80 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer border border-border rounded-lg bg-background focus:border-info focus:outline-none focus:ring-2 focus:ring-info-20 transition-all duration-200"
              accept=".pdf,.doc,.docx,.txt,image/*,.json,.csv,.xlsx"
            />
            {fileNames[`${field.name}[${itemIndex}]`] && (
              <div className="flex items-center gap-2 text-xs bg-muted px-3 py-2 rounded-lg border border-border">
                <span className="text-green-400">✅</span>
                <span className="text-foreground-80">
                  {fileNames[`${field.name}[${itemIndex}]`]}
                </span>
                <span className="text-green-400 ml-auto">Ready</span>
              </div>
            )}
          </div>
        ) : (
          <input
            type={field.items?.type === 'number' ? 'number' : 'text'}
            value={
              typeof currentValue === 'string' ||
              typeof currentValue === 'number'
                ? currentValue
                : ''
            }
            onChange={(e) => {
              const newValue =
                field.items?.type === 'number'
                  ? e.target.value
                    ? Number(e.target.value)
                    : ''
                  : e.target.value;
              handleArrayItemChange(field.name, itemIndex, newValue);
            }}
            placeholder={field.items?.type || 'Enter value...'}
            className="w-full px-3 py-2 bg-muted border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-info focus:border-info transition-all duration-200 text-sm"
          />
        )}
      </div>
    );
  };

  const renderField = (field: SchemaField) => {
    // Handle array fields
    if (field.type === 'array') {
      return renderArrayField(field);
    }

    // Handle non-array fields (existing logic)
    const value = inputs[field.name];
    const isFileInput = inputTypes[field.name] === 'file';

    return (
      <div key={field.name} className="space-y-3">
        <div className="flex items-center justify-between">
          <EditableFieldName fieldName={field.name} required={field.required} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleInputType(field.name)}
              className={`text-xs px-2 py-1 rounded-full transition-all duration-200 ${
                isFileInput
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {isFileInput ? '📁 File' : '📝 Text'}
            </button>
          </div>
        </div>

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}

        {isFileInput ? (
          // File upload input
          <div className="space-y-2">
            <input
              title={field.name}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(field.name, file);
                }
              }}
              className="w-full text-sm text-foreground-80 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer border border-border rounded-lg bg-background focus:border-info focus:outline-none focus:ring-2 focus:ring-info-20 transition-all duration-200"
              accept=".pdf,.doc,.docx,.txt,image/*,.json,.csv,.xlsx"
            />
            {fileNames[field.name] && (
              <div className="flex items-center gap-2 text-xs bg-muted px-3 py-2 rounded-lg border border-border">
                <span className="text-green-400">✅</span>
                <span className="text-foreground-80">
                  {fileNames[field.name]}
                </span>
                <span className="text-green-400 ml-auto">Ready</span>
              </div>
            )}
          </div>
        ) : (
          // Regular text input
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            value={
              typeof value === 'string' || typeof value === 'number'
                ? value
                : ''
            }
            onChange={(e) => {
              const newValue =
                field.type === 'number'
                  ? e.target.value
                    ? Number(e.target.value)
                    : ''
                  : e.target.value;
              handleInputChange(field.name, newValue);
            }}
            placeholder={field.description || `Enter ${field.name}...`}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-info focus:border-info transition-all duration-200"
            required={field.required}
          />
        )}
      </div>
    );
  };

  return (
    <div className="bg-muted border border-border rounded-lg p-6 hover:border-gray-600 transition-all duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">📝</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Input Parameters
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure inputs for your flow execution
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearSavedInputs}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border hover:border-gray-500 transition-all duration-200 flex items-center gap-1"
          title="Clear all saved input values"
        >
          <span>🗑️</span>
          Reset
        </button>
      </div>

      {schemaFields.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted-foreground bg-background border border-border rounded-lg p-3 flex items-center gap-2">
              <span className="text-blue-400">💡</span>
              <span>
                Each field can be switched between text input and file upload
                using the toggle button
              </span>
            </div>
            {hasLoadedFromStorage && (
              <div className="text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
                <span className="text-green-400">💾</span>
                <span>Previously saved input values have been restored</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {schemaFields.map(renderField)}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-background border border-border rounded-lg">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-muted-foreground">⚡</span>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No input parameters required
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            This flow can be executed directly without additional inputs
          </p>
          {onExecute && (
            <button
              type="button"
              onClick={onExecute}
              disabled={isExecuting}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Executing...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Execute Now
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
