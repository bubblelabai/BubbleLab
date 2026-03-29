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
]);

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
]);

export type SalesforceParams = z.output<typeof SalesforceParamsSchema>;
export type SalesforceParamsInput = z.input<typeof SalesforceParamsSchema>;
export type SalesforceResult = z.output<typeof SalesforceResultSchema>;
