interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: unknown;
  /** Controls whether file upload is enabled for this field. Defaults to true for string fields. */
  canBeFile?: boolean;
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
}

interface InputField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  value?: unknown;
}

const isValidJSONString = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

const sanitizeJSONString = (str: string): string => {
  // Remove any potential BOM or invisible characters
  let trimmed = str.trim();

  // Remove any leading/trailing whitespace or newlines
  trimmed = trimmed.replace(/^\s+|\s+$/g, '');

  // Remove any potential markdown code block markers
  if (trimmed.startsWith('```json')) {
    trimmed = trimmed.substring(7);
  }
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.substring(3);
  }
  if (trimmed.endsWith('```')) {
    trimmed = trimmed.substring(0, trimmed.length - 3);
  }

  // Remove any leading/trailing whitespace again
  trimmed = trimmed.replace(/^\s+|\s+$/g, '');

  return trimmed;
};

export const parseJSONSchema = (schemaString: string): SchemaField[] => {
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
        default?: unknown;
        canBeFile?: boolean;
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
            default: value.default,
            canBeFile: value.canBeFile,
            minItems: value.minItems,
            maxItems: value.maxItems,
            items: value.items,
          });
        }
      });
    }

    return fields;
  } catch (error) {
    console.error('Error parsing JSON schema:', {
      error: error instanceof Error ? error.message : String(error),
      schema:
        schemaString.substring(0, 500) +
        (schemaString.length > 500 ? '...' : ''),
    });
    return [];
  }
};

export const convertSchemaFieldsToInputFields = (
  schemaFields: SchemaField[]
): InputField[] => {
  return schemaFields.map((field) => ({
    name: field.name,
    type: field.type,
    required: field.required,
    description: field.description,
    value: undefined, // Start with no value
  }));
};

export const parseInputSchemaToFields = (
  inputsSchema: string
): InputField[] => {
  const schemaFields = parseJSONSchema(inputsSchema);
  return convertSchemaFieldsToInputFields(schemaFields);
};

/**
 * Detects if a parameter value references any of the schema field names
 * This includes:
 * - Template literal expressions: ${fieldName}
 * - Direct variable references
 * - Property access: payload.fieldName
 * - Destructured variables in the value
 */
export function detectSchemaFieldReferences(
  paramValue: unknown,
  schemaFieldNames: string[]
): string[] {
  const foundFields: string[] = [];

  if (typeof paramValue !== 'string') {
    return foundFields;
  }

  const normalizedFieldNames = schemaFieldNames.map((name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  // Pattern 1: Template literal expressions: ${fieldName}
  const templateLiteralRegex = /\$\{([^}]+)\}/g;
  let match;
  while ((match = templateLiteralRegex.exec(paramValue)) !== null) {
    const expression = match[1].trim();

    // Extract the base variable name (handle payload.field, object.field, etc)
    const variableMatch = expression.match(/(?:^|\.)([\w]+)/g);
    if (variableMatch) {
      variableMatch.forEach((varName) => {
        const cleanVar = varName.replace('.', '').toLowerCase();
        const fieldIndex = normalizedFieldNames.indexOf(cleanVar);
        if (
          fieldIndex !== -1 &&
          !foundFields.includes(schemaFieldNames[fieldIndex])
        ) {
          foundFields.push(schemaFieldNames[fieldIndex]);
        }
      });
    }
  }

  // Pattern 2: Property access: payload.fieldName
  const propertyAccessRegex = /\bpayload\.(\w+)/g;
  while ((match = propertyAccessRegex.exec(paramValue)) !== null) {
    const fieldName = match[1];
    const normalizedField = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fieldIndex = normalizedFieldNames.indexOf(normalizedField);
    if (
      fieldIndex !== -1 &&
      !foundFields.includes(schemaFieldNames[fieldIndex])
    ) {
      foundFields.push(schemaFieldNames[fieldIndex]);
    }
  }

  // Pattern 3: Direct variable references (word boundaries)
  // This is more aggressive and checks if any schema field name appears as a standalone word
  schemaFieldNames.forEach((fieldName) => {
    // Create a regex that matches the field name as a whole word (not part of another word)
    const wordBoundaryRegex = new RegExp(`\\b${fieldName}\\b`, 'i');
    if (
      wordBoundaryRegex.test(paramValue) &&
      !foundFields.includes(fieldName)
    ) {
      foundFields.push(fieldName);
    }
  });

  return foundFields;
}

/**
 * Checks if a bubble's parameters reference any of the schema fields
 */
export function bubbleReferencesSchemaFields(
  bubbleParameters: Array<{ name: string; value: unknown }>,
  schemaFieldNames: string[]
): boolean {
  // Check parameter names (exact match)
  const paramNames = bubbleParameters.map((p) => p.name.toLowerCase());
  const normalizedFieldNames = schemaFieldNames.map((f) => f.toLowerCase());

  if (paramNames.some((name) => normalizedFieldNames.includes(name))) {
    return true;
  }

  // Check parameter values for references
  for (const param of bubbleParameters) {
    const referencedFields = detectSchemaFieldReferences(
      param.value,
      schemaFieldNames
    );
    if (referencedFields.length > 0) {
      return true;
    }
  }

  return false;
}

// Helper function to extract input schema from code [that is pasted in]
export function extractInputSchemaFromCode(code: string): string {
  try {
    // Look for interface that extends WebhookEvent (common pattern)
    const webhookInterfaceMatch = code.match(
      /export\s+interface\s+(\w+)\s+extends\s+WebhookEvent\s*\{([^}]+)\}/
    );

    if (webhookInterfaceMatch) {
      const interfaceName = webhookInterfaceMatch[1];
      const interfaceBody = webhookInterfaceMatch[2];

      // Parse the interface properties
      const properties: Record<
        string,
        { type: string; description: string; items?: { type: string } }
      > = {};
      const required: string[] = [];

      // Split by semicolon or newline and parse each property
      const propertyLines = interfaceBody
        .split(/[;\n]/)
        .filter((line) => line.trim());

      for (const line of propertyLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Match property: type pattern, handling optional properties
        const propertyMatch = trimmed.match(/(\w+)(\??):\s*([^;]+)/);
        if (propertyMatch) {
          const [, propertyName, optional, propertyType] = propertyMatch;
          const isOptional = optional === '?';

          // Convert TypeScript types to JSON Schema types
          let jsonType = 'string';
          let description = '';

          if (propertyType.includes('number')) {
            jsonType = 'number';
          } else if (propertyType.includes('boolean')) {
            jsonType = 'boolean';
          } else if (propertyType.includes('string[]')) {
            jsonType = 'array';
            properties[propertyName] = {
              type: 'array',
              items: { type: 'string' },
              description: `Array of strings for ${propertyName}`,
            };
            if (!isOptional) required.push(propertyName);
            continue;
          } else if (propertyType.includes('[]')) {
            jsonType = 'array';
          }

          // Extract comments for description
          const commentMatch = trimmed.match(/\/\/\s*(.+)$/);
          if (commentMatch) {
            description = commentMatch[1];
          } else {
            // Generate description based on property name
            description = `${propertyName
              .replace(/([A-Z])/g, ' $1')
              .toLowerCase()
              .trim()}`;
          }

          properties[propertyName] = {
            type: jsonType,
            description: description,
          };

          if (!isOptional) {
            required.push(propertyName);
          }
        }
      }

      // Create JSON schema
      const schema = {
        type: 'object',
        properties,
        required,
        title: interfaceName,
      };

      return JSON.stringify(schema, null, 2);
    }

    // Fallback: look for any interface with webhook-like properties
    const anyInterfaceMatch = code.match(
      /export\s+interface\s+(\w+)\s*\{([^}]+)\}/
    );
    if (anyInterfaceMatch) {
      return `{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Input message or data"
    }
  },
  "required": ["message"],
  "title": "CustomInput"
}`;
    }

    return '';
  } catch (error) {
    console.warn('Failed to extract input schema from code:', error);
    return '';
  }
}
