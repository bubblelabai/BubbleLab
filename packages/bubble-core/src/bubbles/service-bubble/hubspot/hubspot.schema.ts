import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Shared field helpers
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const objectTypeField = z
  .enum(['contacts', 'companies', 'deals', 'tickets'])
  .describe(
    'HubSpot CRM object type to operate on (contacts, companies, deals, or tickets)'
  );

const propertiesField = z
  .record(z.string(), z.string())
  .describe(
    'Object properties as key-value pairs. Common contact properties: email, firstname, lastname, phone, company. Common company properties: name, domain, industry. Common deal properties: dealname, pipeline, dealstage, amount. Common ticket properties: subject, content, hs_pipeline, hs_pipeline_stage. NOTE: Tickets REQUIRE hs_pipeline_stage (and usually hs_pipeline) to be set on creation.'
  );

const propertiesListField = z
  .array(z.string())
  .optional()
  .describe(
    'List of property names to include in the response. If not specified, default properties are returned.'
  );

const recordIdField = z
  .string()
  .min(1, 'Record ID is required')
  .describe('HubSpot record ID');

// Property definition fields
const propertyTypeField = z
  .enum(['string', 'number', 'date', 'datetime', 'enumeration', 'bool'])
  .describe(
    'Property data type. "string" for text, "number" for numeric, "date" for date-only, "datetime" for date+time, "enumeration" for option sets, "bool" for yes/no.'
  );

const propertyFieldTypeField = z
  .enum([
    'text',
    'textarea',
    'number',
    'date',
    'file',
    'select',
    'radio',
    'checkbox',
    'booleancheckbox',
    'calculation_equation',
    'html',
    'phonenumber',
  ])
  .describe(
    'How the property appears in HubSpot UI. Must be compatible with the property type.'
  );

const PropertyOptionSchema = z.object({
  label: z.string().describe('Display label for the option'),
  value: z.string().describe('Internal value for the option'),
  description: z.string().optional().describe('Description of the option'),
  displayOrder: z.number().optional().describe('Display order (lower = first)'),
  hidden: z
    .boolean()
    .optional()
    .describe('Whether this option is hidden from forms'),
});

const propertyNameField = z
  .string()
  .min(1, 'Property name is required')
  .describe('Internal property name (snake_case, e.g. "favorite_food")');

// Filter schema for search operations
const FilterSchema = z
  .object({
    propertyName: z
      .string()
      .describe('Property name to filter on (e.g., "email", "firstname")'),
    operator: z
      .enum([
        'EQ',
        'NEQ',
        'LT',
        'LTE',
        'GT',
        'GTE',
        'BETWEEN',
        'IN',
        'NOT_IN',
        'HAS_PROPERTY',
        'NOT_HAS_PROPERTY',
        'CONTAINS_TOKEN',
        'NOT_CONTAINS_TOKEN',
      ])
      .describe('Filter operator'),
    value: z.string().optional().describe('Value to compare against'),
    highValue: z
      .string()
      .optional()
      .describe('Upper bound value for BETWEEN operator'),
    values: z
      .array(z.string())
      .optional()
      .describe('Array of values for IN/NOT_IN operators'),
  })
  .describe('A single filter condition');

const FilterGroupSchema = z
  .object({
    filters: z
      .array(FilterSchema)
      .min(1)
      .describe('Filters within this group (combined with AND)'),
  })
  .describe(
    'A group of filters combined with AND. Multiple groups are combined with OR.'
  );

// Pipeline object types (only deals and tickets have pipelines)
const pipelineObjectTypeField = z
  .enum(['deals', 'tickets'])
  .describe('Object type that supports pipelines (deals or tickets)');

// Parameter schema using discriminated union
export const HubSpotParamsSchema = z.discriminatedUnion('operation', [
  // =====================================================================
  // Record CRUD
  // =====================================================================

  // Create record
  z.object({
    operation: z.literal('create_record').describe('Create a new CRM record'),
    object_type: objectTypeField,
    properties: propertiesField,
    credentials: credentialsField,
  }),

  // Get record
  z.object({
    operation: z
      .literal('get_record')
      .describe('Retrieve a single CRM record by ID'),
    object_type: objectTypeField,
    record_id: recordIdField,
    properties: propertiesListField,
    credentials: credentialsField,
  }),

  // Update record
  z.object({
    operation: z
      .literal('update_record')
      .describe('Update an existing CRM record'),
    object_type: objectTypeField,
    record_id: recordIdField,
    properties: propertiesField,
    credentials: credentialsField,
  }),

  // Delete (archive) record
  z.object({
    operation: z
      .literal('delete_record')
      .describe('Archive (soft-delete) a CRM record'),
    object_type: objectTypeField,
    record_id: recordIdField,
    credentials: credentialsField,
  }),

  // Search records
  z.object({
    operation: z
      .literal('search_records')
      .describe('Search CRM records with filters'),
    object_type: objectTypeField,
    filter_groups: z
      .array(FilterGroupSchema)
      .min(1)
      .describe(
        'Filter groups for the search query. Groups are combined with OR, filters within a group with AND.'
      ),
    properties: propertiesListField,
    limit: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .default(10)
      .describe('Maximum number of results to return (1-200, default 10)'),
    after: z
      .string()
      .optional()
      .describe('Pagination cursor for next page of results'),
    credentials: credentialsField,
  }),

  // Batch create records
  z.object({
    operation: z
      .literal('batch_create_records')
      .describe('Create multiple CRM records in a single API call'),
    object_type: objectTypeField,
    records: z
      .array(
        z.object({
          properties: propertiesField,
        })
      )
      .min(1)
      .max(100)
      .describe('Array of records to create (max 100)'),
    credentials: credentialsField,
  }),

  // Batch update records
  z.object({
    operation: z
      .literal('batch_update_records')
      .describe('Update multiple CRM records in a single API call'),
    object_type: objectTypeField,
    records: z
      .array(
        z.object({
          id: z.string().describe('Record ID to update'),
          properties: propertiesField,
        })
      )
      .min(1)
      .max(100)
      .describe('Array of records to update (max 100)'),
    credentials: credentialsField,
  }),

  // Batch delete (archive) records
  z.object({
    operation: z
      .literal('batch_delete_records')
      .describe('Archive multiple CRM records in a single API call'),
    object_type: objectTypeField,
    record_ids: z
      .array(z.string())
      .min(1)
      .max(100)
      .describe('Array of record IDs to archive (max 100)'),
    credentials: credentialsField,
  }),

  // =====================================================================
  // Properties
  // =====================================================================

  // List properties
  z.object({
    operation: z
      .literal('list_properties')
      .describe('List all property definitions for a CRM object type'),
    object_type: objectTypeField,
    credentials: credentialsField,
  }),

  // Get property
  z.object({
    operation: z
      .literal('get_property')
      .describe('Retrieve a single property definition by name'),
    object_type: objectTypeField,
    property_name: propertyNameField,
    credentials: credentialsField,
  }),

  // Create property
  z.object({
    operation: z
      .literal('create_property')
      .describe('Create a new custom property definition'),
    object_type: objectTypeField,
    name: propertyNameField,
    label: z.string().describe('Display label (e.g. "Favorite Food")'),
    type: propertyTypeField,
    fieldType: propertyFieldTypeField,
    groupName: z
      .string()
      .describe(
        'Property group name (e.g. "contactinformation", "dealinformation")'
      ),
    description: z.string().optional().describe('Description of the property'),
    hasUniqueValue: z
      .boolean()
      .optional()
      .describe('Whether this property must have unique values across records'),
    options: z
      .array(PropertyOptionSchema)
      .optional()
      .describe(
        'Options for enumeration-type properties (select, radio, checkbox)'
      ),
    calculationFormula: z
      .string()
      .optional()
      .describe('Formula for calculation_equation fieldType properties'),
    credentials: credentialsField,
  }),

  // Update property
  z.object({
    operation: z
      .literal('update_property')
      .describe('Update an existing property definition'),
    object_type: objectTypeField,
    property_name: propertyNameField,
    label: z.string().optional().describe('New display label'),
    description: z.string().optional().describe('New description'),
    groupName: z.string().optional().describe('New property group name'),
    type: propertyTypeField.optional(),
    fieldType: propertyFieldTypeField.optional(),
    options: z
      .array(PropertyOptionSchema)
      .optional()
      .describe('Updated options for enumeration-type properties'),
    credentials: credentialsField,
  }),

  // Delete property
  z.object({
    operation: z
      .literal('delete_property')
      .describe(
        'Delete a custom property definition (cannot delete default properties)'
      ),
    object_type: objectTypeField,
    property_name: propertyNameField,
    credentials: credentialsField,
  }),

  // =====================================================================
  // Associations
  // =====================================================================

  // List associations
  z.object({
    operation: z
      .literal('list_associations')
      .describe('List all records associated with a given record'),
    from_object_type: objectTypeField.describe('Source object type'),
    from_record_id: recordIdField.describe('Source record ID'),
    to_object_type: objectTypeField.describe(
      'Target object type to list associations for'
    ),
    credentials: credentialsField,
  }),

  // Create association
  z.object({
    operation: z
      .literal('create_association')
      .describe('Create a default association (link) between two CRM records'),
    from_object_type: objectTypeField.describe('Source object type'),
    from_record_id: z.string().describe('Source record ID'),
    to_object_type: objectTypeField.describe('Target object type'),
    to_record_id: z.string().describe('Target record ID'),
    credentials: credentialsField,
  }),

  // Remove association
  z.object({
    operation: z
      .literal('remove_association')
      .describe('Remove all associations between two specific records'),
    from_object_type: objectTypeField.describe('Source object type'),
    from_record_id: z.string().describe('Source record ID'),
    to_object_type: objectTypeField.describe('Target object type'),
    to_record_id: z.string().describe('Target record ID'),
    credentials: credentialsField,
  }),

  // =====================================================================
  // Pipelines
  // =====================================================================

  // List pipelines
  z.object({
    operation: z
      .literal('list_pipelines')
      .describe('List all pipelines and their stages for deals or tickets'),
    object_type: pipelineObjectTypeField,
    credentials: credentialsField,
  }),

  // =====================================================================
  // Notes (Engagements)
  // =====================================================================

  // Create note
  z.object({
    operation: z
      .literal('create_note')
      .describe('Create a note and associate it with CRM records'),
    note_body: z.string().describe('Note content (supports HTML formatting)'),
    associations: z
      .array(
        z.object({
          object_type: objectTypeField,
          record_id: z
            .string()
            .describe('Record ID to associate the note with'),
        })
      )
      .min(1)
      .describe('Records to associate the note with'),
    timestamp: z
      .string()
      .optional()
      .describe('ISO 8601 timestamp for the note (defaults to current time)'),
    credentials: credentialsField,
  }),

  // =====================================================================
  // Account
  // =====================================================================

  // Get account info
  z.object({
    operation: z
      .literal('get_account_info')
      .describe(
        'Retrieve HubSpot account details including portal ID, timezone, and currency'
      ),
    credentials: credentialsField,
  }),
]);

// HubSpot record schema for response data
const HubSpotRecordSchema = z
  .object({
    id: z.string().describe('Record ID'),
    properties: z.record(z.string(), z.unknown()).describe('Record properties'),
    createdAt: z.string().optional().describe('Creation timestamp'),
    updatedAt: z.string().optional().describe('Last update timestamp'),
    archived: z.boolean().optional().describe('Whether the record is archived'),
  })
  .describe('A HubSpot CRM record');

// Generic JSON result field
const jsonDataField = z.record(z.string(), z.unknown()).optional();
const jsonArrayField = z.array(z.record(z.string(), z.unknown())).optional();

// Result schema
export const HubSpotResultSchema = z.discriminatedUnion('operation', [
  // Record CRUD results
  z.object({
    operation: z.literal('create_record'),
    success: z.boolean(),
    record: HubSpotRecordSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_record'),
    success: z.boolean(),
    record: HubSpotRecordSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_record'),
    success: z.boolean(),
    record: HubSpotRecordSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_record'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('search_records'),
    success: z.boolean(),
    results: z.array(HubSpotRecordSchema).optional(),
    total: z.number().optional(),
    paging: z
      .object({
        next: z.object({ after: z.string() }).optional(),
      })
      .optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('batch_create_records'),
    success: z.boolean(),
    results: z.array(HubSpotRecordSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('batch_update_records'),
    success: z.boolean(),
    results: z.array(HubSpotRecordSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('batch_delete_records'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Property results
  z.object({
    operation: z.literal('list_properties'),
    success: z.boolean(),
    properties: jsonArrayField,
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_property'),
    success: z.boolean(),
    property: jsonDataField,
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_property'),
    success: z.boolean(),
    property: jsonDataField,
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_property'),
    success: z.boolean(),
    property: jsonDataField,
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_property'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Association results
  z.object({
    operation: z.literal('list_associations'),
    success: z.boolean(),
    associations: jsonArrayField,
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_association'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('remove_association'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Pipeline results
  z.object({
    operation: z.literal('list_pipelines'),
    success: z.boolean(),
    pipelines: jsonArrayField,
    error: z.string(),
  }),

  // Note results
  z.object({
    operation: z.literal('create_note'),
    success: z.boolean(),
    note: z
      .object({
        id: z.string().describe('Note ID'),
        properties: z
          .record(z.string(), z.unknown())
          .describe('Note properties including hs_note_body, hs_timestamp'),
      })
      .optional(),
    error: z.string(),
  }),

  // Account results
  z.object({
    operation: z.literal('get_account_info'),
    success: z.boolean(),
    account: jsonDataField,
    error: z.string(),
  }),
]);

export type HubSpotParams = z.output<typeof HubSpotParamsSchema>;
export type HubSpotParamsInput = z.input<typeof HubSpotParamsSchema>;
export type HubSpotResult = z.output<typeof HubSpotResultSchema>;
