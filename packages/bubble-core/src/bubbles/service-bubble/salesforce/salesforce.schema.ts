import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Shared field helpers
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const recordIdField = z
  .string()
  .min(1, 'Record ID is required')
  .describe(
    'Salesforce record ID (15 or 18 character ID, e.g. "001xx000003DGbYAAW")'
  );

const fieldsListField = z
  .array(z.string())
  .optional()
  .describe(
    'List of field API names to include in the response. If not specified, all accessible fields are returned. Common Account fields: Id, Name, Industry, BillingCity, AnnualRevenue, Website, Phone, AccountNumber, Type, OwnerId'
  );

// Parameter schema using discriminated union
export const SalesforceParamsSchema = z.discriminatedUnion('operation', [
  // Get account by Salesforce ID
  z.object({
    operation: z
      .literal('get_account')
      .describe('Retrieve a Salesforce Account record by its ID'),
    record_id: recordIdField,
    fields: fieldsListField,
    credentials: credentialsField,
  }),

  // Search accounts by field values using SOQL
  z.object({
    operation: z
      .literal('search_accounts')
      .describe(
        'Search Salesforce Account records by field values using SOQL WHERE conditions'
      ),
    where_clause: z
      .string()
      .describe(
        "SOQL WHERE clause for filtering accounts (e.g. \"Name = 'Acme Corp'\" or \"AccountNumber = 'BIZ-12345'\" or \"Industry = 'Technology' AND BillingState = 'CA'\")"
      ),
    fields: fieldsListField,
    limit: z
      .number()
      .min(1)
      .max(2000)
      .optional()
      .default(100)
      .describe('Maximum number of results to return (1-2000, default 100)'),
    credentials: credentialsField,
  }),

  // Get contact by Salesforce ID
  z.object({
    operation: z
      .literal('get_contact')
      .describe('Retrieve a Salesforce Contact record by its ID'),
    record_id: recordIdField,
    fields: fieldsListField,
    credentials: credentialsField,
  }),

  // Search contacts by field values using SOQL
  z.object({
    operation: z
      .literal('search_contacts')
      .describe(
        'Search Salesforce Contact records by field values using SOQL WHERE conditions'
      ),
    where_clause: z
      .string()
      .describe(
        'SOQL WHERE clause for filtering contacts (e.g. "Email = \'john@example.com\'" or "LastName = \'Smith\'" or "AccountId = \'001xx000003DGbY\'")'
      ),
    fields: fieldsListField,
    limit: z
      .number()
      .min(1)
      .max(2000)
      .optional()
      .default(100)
      .describe('Maximum number of results to return (1-2000, default 100)'),
    credentials: credentialsField,
  }),

  // Run arbitrary SOQL query
  z.object({
    operation: z
      .literal('query')
      .describe(
        'Execute an arbitrary SOQL (Salesforce Object Query Language) query'
      ),
    soql: z
      .string()
      .min(1, 'SOQL query is required')
      .describe(
        'Full SOQL query string (e.g. "SELECT Id, Name, Industry FROM Account WHERE AnnualRevenue > 1000000 ORDER BY Name LIMIT 10")'
      ),
    credentials: credentialsField,
  }),

  // Describe an sObject — return its fields with API name + UI label
  z.object({
    operation: z
      .literal('describe_object')
      .describe(
        'Return all fields of a Salesforce object with both API name and user-facing label. Use this to resolve label-vs-API-name mismatches (especially custom fields like "Saving Status" → Treasury_Status__c) before constructing SOQL.'
      ),
    object_name: z
      .string()
      .min(1, 'Object name is required')
      .describe(
        'API name of the sObject to describe (e.g. "Account", "Contact", "Opportunity", or a custom object like "MyCustomObject__c")'
      ),
    credentials: credentialsField,
  }),

  // List all sObjects available in the org
  z.object({
    operation: z
      .literal('list_objects')
      .describe(
        'List all sObjects in the connected Salesforce org with their API name and label. Use this when the user references an object by its UI label and the API name is not obvious.'
      ),
    include_custom_only: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'If true, only return custom objects (suffixed __c). Defaults to false (returns all queryable objects).'
      ),
    credentials: credentialsField,
  }),
]);

// Compact field metadata returned by describe_object
const SalesforceFieldMetadataSchema = z.object({
  apiName: z
    .string()
    .describe('API/backend name of the field (use this in SOQL)'),
  label: z.string().describe('User-facing label shown in the Salesforce UI'),
  type: z
    .string()
    .describe('Salesforce field type (e.g. "string", "picklist")'),
  custom: z.boolean().describe('Whether this is a custom field (suffixed __c)'),
  picklistValues: z
    .array(z.string())
    .optional()
    .describe('For picklist fields, the allowed values'),
  referenceTo: z
    .array(z.string())
    .optional()
    .describe('For reference/lookup fields, the sObject(s) referenced'),
});

// Compact sObject metadata returned by list_objects
const SalesforceObjectMetadataSchema = z.object({
  apiName: z.string().describe('API name of the sObject (use this in SOQL)'),
  label: z.string().describe('User-facing label shown in the Salesforce UI'),
  custom: z
    .boolean()
    .describe('Whether this is a custom object (suffixed __c)'),
  queryable: z
    .boolean()
    .describe('Whether this object can be queried via SOQL'),
});

// Salesforce record — flexible schema since fields vary by query
const SalesforceRecordSchema = z
  .record(z.string(), z.unknown())
  .describe('A Salesforce record with its fields');

// Result schema
export const SalesforceResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('get_account'),
    success: z.boolean(),
    record: SalesforceRecordSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('search_accounts'),
    success: z.boolean(),
    records: z.array(SalesforceRecordSchema).optional(),
    totalSize: z.number().optional(),
    done: z.boolean().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_contact'),
    success: z.boolean(),
    record: SalesforceRecordSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('search_contacts'),
    success: z.boolean(),
    records: z.array(SalesforceRecordSchema).optional(),
    totalSize: z.number().optional(),
    done: z.boolean().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('query'),
    success: z.boolean(),
    records: z.array(z.record(z.string(), z.unknown())).optional(),
    totalSize: z.number().optional(),
    done: z.boolean().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('describe_object'),
    success: z.boolean(),
    object_name: z.string().optional(),
    object_label: z.string().optional(),
    fields: z.array(SalesforceFieldMetadataSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_objects'),
    success: z.boolean(),
    objects: z.array(SalesforceObjectMetadataSchema).optional(),
    error: z.string(),
  }),
]);

export type SalesforceParams = z.output<typeof SalesforceParamsSchema>;
export type SalesforceParamsInput = z.input<typeof SalesforceParamsSchema>;
export type SalesforceResult = z.output<typeof SalesforceResultSchema>;
