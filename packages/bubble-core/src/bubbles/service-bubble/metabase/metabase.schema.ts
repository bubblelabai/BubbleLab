import { z } from 'zod';

// ============================================================================
// DATA SCHEMAS - Metabase API Response Objects
// ============================================================================

export const MetabaseDashcardSchema = z
  .object({
    id: z.number().describe('Unique dashcard identifier'),
    card_id: z.number().nullable().describe('ID of the card in this dashcard'),
    card: z
      .object({
        id: z
          .number()
          .nullable()
          .optional()
          .describe('Card ID (null/absent for text/heading dashcards)'),
        name: z
          .string()
          .nullable()
          .optional()
          .describe('Card name (null/absent for text/heading dashcards)'),
        display: z.string().optional().describe('Card display type'),
        description: z
          .string()
          .nullable()
          .optional()
          .describe('Card description'),
      })
      .passthrough()
      .nullable()
      .optional()
      .describe('Embedded card metadata (null for virtual/text dashcards)'),
    row: z.number().describe('Row position on dashboard grid'),
    col: z.number().describe('Column position on dashboard grid'),
    size_x: z.number().describe('Width in grid units'),
    size_y: z.number().describe('Height in grid units'),
  })
  .passthrough()
  .describe('Dashboard card (dashcard) object');

export const MetabaseDashboardSchema = z
  .object({
    id: z.number().describe('Unique dashboard identifier'),
    name: z.string().describe('Dashboard name'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Dashboard description'),
    collection_id: z
      .number()
      .nullable()
      .optional()
      .describe('Collection the dashboard belongs to'),
    dashcards: z
      .array(MetabaseDashcardSchema)
      .optional()
      .describe('List of dashcards on this dashboard'),
    parameters: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('Dashboard filter parameters'),
    created_at: z.string().optional().describe('Creation timestamp'),
    updated_at: z.string().optional().describe('Last update timestamp'),
  })
  .passthrough()
  .describe('Metabase dashboard object');

export const MetabaseDashboardListItemSchema = z
  .object({
    id: z.number().describe('Unique dashboard identifier'),
    name: z.string().describe('Dashboard name'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Dashboard description'),
    collection_id: z
      .number()
      .nullable()
      .optional()
      .describe('Collection the dashboard belongs to'),
    model: z.string().optional().describe('Entity model type'),
    created_at: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('Dashboard list item');

export const MetabaseCardSchema = z
  .object({
    id: z.number().describe('Unique card identifier'),
    name: z.string().describe('Card name'),
    description: z.string().nullable().optional().describe('Card description'),
    display: z.string().optional().describe('Visualization type'),
    collection_id: z
      .number()
      .nullable()
      .optional()
      .describe('Collection the card belongs to'),
    database_id: z
      .number()
      .nullable()
      .optional()
      .describe('Database this card queries'),
    dataset_query: z
      .record(z.unknown())
      .optional()
      .describe('The query definition'),
    result_metadata: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('Column metadata from the result'),
    created_at: z.string().optional().describe('Creation timestamp'),
    updated_at: z.string().optional().describe('Last update timestamp'),
  })
  .passthrough()
  .describe('Metabase card (saved question) object');

export const MetabaseQueryResultSchema = z
  .object({
    rows: z.array(z.array(z.unknown())).describe('Result data rows'),
    cols: z
      .array(
        z
          .object({
            name: z.string().describe('Column name'),
            display_name: z
              .string()
              .optional()
              .describe('Display name for column'),
            base_type: z
              .string()
              .optional()
              .describe('Base data type of column'),
          })
          .passthrough()
      )
      .describe('Column metadata'),
    row_count: z.number().optional().describe('Total number of rows returned'),
    status: z.string().optional().describe('Query execution status'),
  })
  .passthrough()
  .describe('Flattened Metabase query result — rows and cols at top level');

// ============================================================================
// OPERATION SCHEMAS - Input Parameters
// ============================================================================

const credentialsField = z
  .record(z.string())
  .optional()
  .describe('Credential mapping for authentication');

const GetDashboardSchema = z.object({
  operation: z.literal('get_dashboard').describe('Get dashboard by ID'),
  dashboard_id: z.number().describe('The dashboard ID to retrieve'),
  credentials: credentialsField,
});

const ListDashboardsSchema = z.object({
  operation: z
    .literal('list_dashboards')
    .describe('List all available dashboards'),
  credentials: credentialsField,
});

const GetCardSchema = z.object({
  operation: z.literal('get_card').describe('Get card metadata by ID'),
  card_id: z.number().describe('The card ID to retrieve'),
  credentials: credentialsField,
});

const QueryCardSchema = z.object({
  operation: z
    .literal('query_card')
    .describe("Execute a card's query and return results"),
  card_id: z.number().describe('The card ID to query'),
  pivot: z
    .boolean()
    .optional()
    .describe(
      'Use the pivot endpoint (/api/card/pivot/:id/query) for pivot-table results'
    ),
  parameters: z
    .record(z.unknown())
    .optional()
    .describe('Optional query parameters (filters)'),
  credentials: credentialsField,
});

// ============================================================================
// COMBINED SCHEMAS
// ============================================================================

export const MetabaseParamsSchema = z.discriminatedUnion('operation', [
  GetDashboardSchema,
  ListDashboardsSchema,
  GetCardSchema,
  QueryCardSchema,
]);

export type MetabaseParams = z.output<typeof MetabaseParamsSchema>;
export type MetabaseParamsInput = z.input<typeof MetabaseParamsSchema>;

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

const GetDashboardResultSchema = z.object({
  operation: z.literal('get_dashboard'),
  success: z.boolean(),
  error: z.string().default(''),
  data: MetabaseDashboardSchema.optional(),
});

const ListDashboardsResultSchema = z.object({
  operation: z.literal('list_dashboards'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z
    .object({
      dashboards: z.array(MetabaseDashboardListItemSchema),
      total: z.number(),
    })
    .optional(),
});

const GetCardResultSchema = z.object({
  operation: z.literal('get_card'),
  success: z.boolean(),
  error: z.string().default(''),
  data: MetabaseCardSchema.optional(),
});

const QueryCardResultSchema = z.object({
  operation: z.literal('query_card'),
  success: z.boolean(),
  error: z.string().default(''),
  data: MetabaseQueryResultSchema.optional(),
});

export const MetabaseResultSchema = z.discriminatedUnion('operation', [
  GetDashboardResultSchema,
  ListDashboardsResultSchema,
  GetCardResultSchema,
  QueryCardResultSchema,
]);

export type MetabaseResult = z.infer<typeof MetabaseResultSchema>;
