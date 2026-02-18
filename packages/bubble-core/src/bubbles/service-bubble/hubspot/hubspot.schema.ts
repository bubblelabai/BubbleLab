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
    'Object properties as key-value pairs. Common contact properties: email, firstname, lastname, phone, company. Common company properties: name, domain, industry. Common deal properties: dealname, pipeline, dealstage, amount. Common ticket properties: subject, content, hs_pipeline, hs_pipeline_stage.'
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

// Parameter schema using discriminated union
export const HubSpotParamsSchema = z.discriminatedUnion('operation', [
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

// Result schema
export const HubSpotResultSchema = z.discriminatedUnion('operation', [
  // Create result
  z.object({
    operation: z.literal('create_record').describe('Create a new CRM record'),
    success: z.boolean().describe('Whether the operation was successful'),
    record: HubSpotRecordSchema.optional().describe('Created record'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get result
  z.object({
    operation: z
      .literal('get_record')
      .describe('Retrieve a single CRM record by ID'),
    success: z.boolean().describe('Whether the operation was successful'),
    record: HubSpotRecordSchema.optional().describe('Retrieved record'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Update result
  z.object({
    operation: z
      .literal('update_record')
      .describe('Update an existing CRM record'),
    success: z.boolean().describe('Whether the operation was successful'),
    record: HubSpotRecordSchema.optional().describe('Updated record'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Search result
  z.object({
    operation: z
      .literal('search_records')
      .describe('Search CRM records with filters'),
    success: z.boolean().describe('Whether the operation was successful'),
    results: z
      .array(HubSpotRecordSchema)
      .optional()
      .describe('Matching records'),
    total: z.number().optional().describe('Total number of matching records'),
    paging: z
      .object({
        next: z
          .object({
            after: z.string().describe('Cursor for the next page'),
          })
          .optional()
          .describe('Pagination info for the next page'),
      })
      .optional()
      .describe('Pagination information'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type HubSpotParams = z.output<typeof HubSpotParamsSchema>;
export type HubSpotParamsInput = z.input<typeof HubSpotParamsSchema>;
export type HubSpotResult = z.output<typeof HubSpotResultSchema>;
