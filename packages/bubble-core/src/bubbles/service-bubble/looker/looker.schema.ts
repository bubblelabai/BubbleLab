import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Shared field helpers
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const instanceUrlField = z
  .string()
  .min(1, 'Looker instance URL is required')
  .describe(
    'Looker instance URL (e.g. "mycompany.cloud.looker.com" or "https://mycompany.cloud.looker.com"). Do not include /api/4.0/'
  );

const limitField = z
  .number()
  .min(1)
  .max(5000)
  .optional()
  .default(500)
  .describe('Maximum number of results to return (1-5000, default 500)');

// Parameter schema using discriminated union
export const LookerParamsSchema = z.discriminatedUnion('operation', [
  // Run inline query against a LookML model/explore
  z.object({
    operation: z
      .literal('run_inline_query')
      .describe(
        'Run a query against a LookML model/explore with specified fields, filters, and sorts'
      ),
    instance_url: instanceUrlField,
    model: z
      .string()
      .min(1)
      .describe(
        'LookML model name to query (e.g. "ecommerce", "marketing_analytics")'
      ),
    explore: z
      .string()
      .min(1)
      .describe(
        'Explore name within the model (e.g. "orders", "users", "sessions")'
      ),
    fields: z
      .array(z.string())
      .min(1)
      .describe(
        'List of field names to include in the query (e.g. ["orders.count", "users.city", "orders.total_revenue"])'
      ),
    filters: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'Filters to apply as key-value pairs (e.g. {"orders.created_date": "last 7 days", "users.country": "USA"})'
      ),
    sorts: z
      .array(z.string())
      .optional()
      .describe(
        'Sort order for results (e.g. ["orders.count desc", "users.city asc"])'
      ),
    limit: limitField,
    credentials: credentialsField,
  }),

  // Get results from a saved Look
  z.object({
    operation: z
      .literal('get_look')
      .describe('Fetch results from a saved Look by its ID'),
    instance_url: instanceUrlField,
    look_id: z
      .number()
      .describe('Numeric ID of the saved Look to retrieve results from'),
    limit: limitField,
    result_format: z
      .enum(['json', 'csv', 'txt'])
      .optional()
      .default('json')
      .describe('Format for the results (default: json)'),
    credentials: credentialsField,
  }),

  // Get dashboard metadata and tile results
  z.object({
    operation: z
      .literal('get_dashboard')
      .describe(
        'Fetch dashboard metadata including title, description, filters, and tile definitions'
      ),
    instance_url: instanceUrlField,
    dashboard_id: z
      .string()
      .min(1)
      .describe(
        'Dashboard ID (numeric string or slug, e.g. "42" or "sales::quarterly_review")'
      ),
    credentials: credentialsField,
  }),

  // List available LookML models
  z.object({
    operation: z
      .literal('list_models')
      .describe('List all available LookML models on this Looker instance'),
    instance_url: instanceUrlField,
    credentials: credentialsField,
  }),

  // List explores within a model
  z.object({
    operation: z
      .literal('list_explores')
      .describe(
        'List all explores available within a specific LookML model, including their fields and descriptions'
      ),
    instance_url: instanceUrlField,
    model: z.string().min(1).describe('LookML model name to list explores for'),
    credentials: credentialsField,
  }),

  // List saved Looks
  z.object({
    operation: z
      .literal('list_looks')
      .describe('List saved Looks accessible to the authenticated user'),
    instance_url: instanceUrlField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // List dashboards
  z.object({
    operation: z
      .literal('list_dashboards')
      .describe('List dashboards accessible to the authenticated user'),
    instance_url: instanceUrlField,
    limit: limitField,
    credentials: credentialsField,
  }),
]);

// Flexible record for Looker data rows
const LookerRecordSchema = z
  .record(z.string(), z.unknown())
  .describe('A data row from a Looker query result');

// Model summary
const LookerModelSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  explores: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

// Explore detail
const LookerExploreSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  fields: z
    .object({
      dimensions: z
        .array(
          z.object({
            name: z.string(),
            label: z.string().optional(),
            type: z.string().optional(),
            description: z.string().optional(),
          })
        )
        .optional(),
      measures: z
        .array(
          z.object({
            name: z.string(),
            label: z.string().optional(),
            type: z.string().optional(),
            description: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

// Look summary
const LookerLookSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  model: z
    .object({
      id: z.string().optional(),
      label: z.string().optional(),
    })
    .optional(),
  space: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

// Dashboard summary
const LookerDashboardSummarySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  folder: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

// Dashboard detail
const LookerDashboardDetailSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  dashboard_filters: z
    .array(
      z.object({
        name: z.string().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
        default_value: z.string().optional(),
      })
    )
    .optional(),
  dashboard_elements: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
        look_id: z.number().optional(),
        query: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
});

// Result schema
export const LookerResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('run_inline_query'),
    success: z.boolean(),
    data: z.array(LookerRecordSchema).optional(),
    rowCount: z.number().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_look'),
    success: z.boolean(),
    data: z.array(LookerRecordSchema).optional(),
    look: LookerLookSchema.optional(),
    rowCount: z.number().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_dashboard'),
    success: z.boolean(),
    dashboard: LookerDashboardDetailSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_models'),
    success: z.boolean(),
    models: z.array(LookerModelSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_explores'),
    success: z.boolean(),
    explores: z.array(LookerExploreSchema).optional(),
    model: z.string().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_looks'),
    success: z.boolean(),
    looks: z.array(LookerLookSchema).optional(),
    totalCount: z.number().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_dashboards'),
    success: z.boolean(),
    dashboards: z.array(LookerDashboardSummarySchema).optional(),
    totalCount: z.number().optional(),
    error: z.string(),
  }),
]);

export type LookerParams = z.output<typeof LookerParamsSchema>;
export type LookerParamsInput = z.input<typeof LookerParamsSchema>;
export type LookerResult = z.output<typeof LookerResultSchema>;
