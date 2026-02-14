import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - PostHog API Response Types
// ============================================================================

/**
 * PostHog event object from events API
 */
export const PosthogEventSchema = z
  .object({
    id: z
      .string()
      .optional()
      .describe('Event identifier (returned by API as id)'),
    uuid: z
      .string()
      .optional()
      .describe('Unique event identifier (legacy field name)'),
    event: z.string().describe('Event name (e.g., $pageview, user_signed_up)'),
    distinct_id: z.string().describe('Distinct ID of the person'),
    properties: z.record(z.unknown()).optional().describe('Event properties'),
    timestamp: z.string().optional().describe('ISO 8601 event timestamp'),
    created_at: z.string().optional().describe('ISO 8601 creation timestamp'),
    elements: z.array(z.unknown()).optional().describe('DOM elements captured'),
    elements_chain: z.string().optional().describe('Serialized element chain'),
  })
  .describe('PostHog event record');

/**
 * PostHog person object from persons API
 */
export const PosthogPersonSchema = z
  .object({
    id: z.string().describe('Internal person ID (UUID)'),
    uuid: z.string().optional().describe('Person UUID'),
    distinct_ids: z
      .array(z.string())
      .describe('All distinct IDs associated with this person'),
    properties: z
      .record(z.unknown())
      .optional()
      .describe('Person properties (set via $set)'),
    created_at: z.string().optional().describe('ISO 8601 creation timestamp'),
  })
  .describe('PostHog person record');

/**
 * PostHog insight object from insights API
 */
export const PosthogInsightSchema = z
  .object({
    id: z.number().describe('Insight ID'),
    short_id: z.string().optional().describe('Short ID for sharing'),
    name: z.string().optional().nullable().describe('Insight name'),
    description: z
      .string()
      .optional()
      .nullable()
      .describe('Insight description'),
    result: z.unknown().optional().describe('Computed insight results'),
    filters: z
      .record(z.unknown())
      .optional()
      .describe('Insight filter configuration'),
    created_at: z.string().optional().describe('ISO 8601 creation timestamp'),
    last_refresh: z
      .string()
      .optional()
      .nullable()
      .describe('Last time the insight was refreshed'),
    last_modified_at: z
      .string()
      .optional()
      .describe('ISO 8601 last modification timestamp'),
  })
  .describe('PostHog insight record');

/**
 * HogQL query result
 */
export const PosthogQueryResultSchema = z
  .object({
    columns: z
      .array(z.string())
      .optional()
      .describe('Column names in the result'),
    results: z
      .array(z.array(z.unknown()))
      .optional()
      .describe('Rows of query results'),
    types: z
      .array(z.union([z.string(), z.array(z.string())]))
      .optional()
      .describe('Column types in the result'),
    hasMore: z
      .boolean()
      .nullable()
      .optional()
      .describe('Whether there are more rows available'),
    limit: z.number().optional().describe('Number of rows returned'),
    offset: z.number().optional().describe('Offset of the first row'),
  })
  .describe('HogQL query result');

/**
 * PostHog project object from projects API
 */
export const PosthogProjectSchema = z
  .object({
    id: z
      .number()
      .describe('Project ID (use this as project_id in other operations)'),
    uuid: z.string().optional().describe('Project UUID'),
    name: z.string().describe('Project name'),
    organization: z.string().optional().describe('Organization ID'),
    created_at: z.string().optional().describe('ISO 8601 creation timestamp'),
    timezone: z.string().optional().describe('Project timezone (e.g., UTC)'),
    is_demo: z.boolean().optional().describe('Whether this is a demo project'),
  })
  .describe('PostHog project record');

// ============================================================================
// PARAMETER SCHEMAS - Discriminated Union for Multiple Operations
// ============================================================================

export const PosthogParamsSchema = z.discriminatedUnion('operation', [
  // List projects operation
  z.object({
    operation: z
      .literal('list_projects')
      .describe(
        'List all projects accessible with your API key — use this to discover valid project_id values'
      ),
    host: z
      .string()
      .optional()
      .default('https://us.posthog.com')
      .describe(
        'PostHog host URL (e.g., https://us.posthog.com, https://eu.posthog.com, or your self-hosted URL)'
      ),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Maximum number of projects to return (1-100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List events operation
  z.object({
    operation: z
      .literal('list_events')
      .describe('List recent events with optional filtering'),
    project_id: z
      .string()
      .min(1)
      .describe('PostHog project ID (found in Project Settings)'),
    host: z
      .string()
      .optional()
      .default('https://us.posthog.com')
      .describe(
        'PostHog host URL (e.g., https://us.posthog.com, https://eu.posthog.com, or your self-hosted URL)'
      ),
    event: z
      .string()
      .optional()
      .describe('Filter by event name (e.g., $pageview, user_signed_up)'),
    person_id: z.string().optional().describe('Filter events by person ID'),
    distinct_id: z.string().optional().describe('Filter events by distinct ID'),
    after: z
      .string()
      .optional()
      .describe('Only return events after this ISO 8601 timestamp'),
    before: z
      .string()
      .optional()
      .describe('Only return events before this ISO 8601 timestamp'),
    properties: z
      .string()
      .optional()
      .describe(
        'JSON-encoded array of property filters (e.g., [{"key":"$browser","value":"Chrome","operator":"exact"}])'
      ),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Maximum number of events to return (1-1000)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // HogQL query operation
  z.object({
    operation: z
      .literal('query')
      .describe('Execute a HogQL query for custom analytics'),
    project_id: z
      .string()
      .min(1)
      .describe('PostHog project ID (found in Project Settings)'),
    host: z
      .string()
      .optional()
      .default('https://us.posthog.com')
      .describe(
        'PostHog host URL (e.g., https://us.posthog.com, https://eu.posthog.com, or your self-hosted URL)'
      ),
    query: z
      .string()
      .min(1)
      .describe(
        'HogQL query to execute (SQL-like syntax, e.g., SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get person operation
  z.object({
    operation: z
      .literal('get_person')
      .describe('Look up a person profile by distinct ID or search'),
    project_id: z
      .string()
      .min(1)
      .describe('PostHog project ID (found in Project Settings)'),
    host: z
      .string()
      .optional()
      .default('https://us.posthog.com')
      .describe(
        'PostHog host URL (e.g., https://us.posthog.com, https://eu.posthog.com, or your self-hosted URL)'
      ),
    distinct_id: z
      .string()
      .optional()
      .describe('Look up person by distinct ID'),
    search: z
      .string()
      .optional()
      .describe('Search for persons by email or name in person properties'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of persons to return (1-100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get insight operation
  z.object({
    operation: z
      .literal('get_insight')
      .describe("Retrieve a saved insight's results by ID"),
    project_id: z
      .string()
      .min(1)
      .describe('PostHog project ID (found in Project Settings)'),
    host: z
      .string()
      .optional()
      .default('https://us.posthog.com')
      .describe(
        'PostHog host URL (e.g., https://us.posthog.com, https://eu.posthog.com, or your self-hosted URL)'
      ),
    insight_id: z
      .number()
      .min(1)
      .describe('Numeric ID of the insight to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// ============================================================================
// RESULT SCHEMAS - Discriminated Union for Operation Results
// ============================================================================

export const PosthogResultSchema = z.discriminatedUnion('operation', [
  // List projects result
  z.object({
    operation: z.literal('list_projects').describe('List projects operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    projects: z
      .array(PosthogProjectSchema)
      .optional()
      .describe('List of projects'),
    next: z
      .string()
      .optional()
      .nullable()
      .describe('URL for fetching the next page of results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List events result
  z.object({
    operation: z.literal('list_events').describe('List events operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    events: z.array(PosthogEventSchema).optional().describe('List of events'),
    next: z
      .string()
      .optional()
      .nullable()
      .describe('URL for fetching the next page of results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // HogQL query result
  z.object({
    operation: z.literal('query').describe('HogQL query operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    columns: z
      .array(z.string())
      .optional()
      .describe('Column names in the result'),
    results: z
      .array(z.array(z.unknown()))
      .optional()
      .describe('Rows of query results'),
    types: z
      .array(z.union([z.string(), z.array(z.string())]))
      .optional()
      .describe('Column types in the result'),
    hasMore: z
      .boolean()
      .nullable()
      .optional()
      .describe('Whether more rows are available'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get person result
  z.object({
    operation: z.literal('get_person').describe('Get person operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    persons: z
      .array(PosthogPersonSchema)
      .optional()
      .describe('List of matching persons'),
    next: z
      .string()
      .optional()
      .nullable()
      .describe('URL for fetching the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get insight result
  z.object({
    operation: z.literal('get_insight').describe('Get insight operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    insight: PosthogInsightSchema.optional().describe(
      'Insight details and results'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type PosthogParamsInput = z.input<typeof PosthogParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation/transformation)
export type PosthogParams = z.output<typeof PosthogParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type PosthogResult = z.output<typeof PosthogResultSchema>;

// Data types
export type PosthogEvent = z.output<typeof PosthogEventSchema>;
export type PosthogPerson = z.output<typeof PosthogPersonSchema>;
export type PosthogInsight = z.output<typeof PosthogInsightSchema>;
export type PosthogQueryResult = z.output<typeof PosthogQueryResultSchema>;
export type PosthogProject = z.output<typeof PosthogProjectSchema>;

// Operation-specific types (for internal method parameters)
export type PosthogListProjectsParams = Extract<
  PosthogParams,
  { operation: 'list_projects' }
>;
export type PosthogListEventsParams = Extract<
  PosthogParams,
  { operation: 'list_events' }
>;
export type PosthogQueryParams = Extract<PosthogParams, { operation: 'query' }>;
export type PosthogGetPersonParams = Extract<
  PosthogParams,
  { operation: 'get_person' }
>;
export type PosthogGetInsightParams = Extract<
  PosthogParams,
  { operation: 'get_insight' }
>;
