import { z } from 'zod';

// ============================================================================
// DATA SCHEMAS - Memberful GraphQL Response Objects
// ============================================================================

export const MemberfulPlanSchema = z
  .object({
    id: z.string().describe('Plan ID'),
    label: z
      .string()
      .describe('Plan display label (Memberful uses "label", not "name")'),
    slug: z.string().optional().describe('Plan URL slug'),
    priceCents: z.number().optional().describe('Price in cents'),
    intervalCount: z
      .number()
      .nullable()
      .optional()
      .describe('Billing interval count (e.g. 1 for monthly, 12 for yearly)'),
    intervalUnit: z
      .string()
      .nullable()
      .optional()
      .describe('Billing interval unit (month, year, etc.)'),
    type: z
      .string()
      .optional()
      .describe('Plan type (subscription, pass, etc.)'),
    forSale: z
      .boolean()
      .optional()
      .describe('Whether plan is currently for sale'),
  })
  .passthrough()
  .describe('Memberful plan object');

export const MemberfulSubscriptionSchema = z
  .object({
    id: z.string().describe('Subscription ID'),
    active: z.boolean().optional().describe('Whether subscription is active'),
    autorenew: z
      .boolean()
      .optional()
      .describe('Whether subscription auto-renews'),
    expiresAt: z
      .number()
      .nullable()
      .optional()
      .describe('Expiration unix timestamp (seconds)'),
    createdAt: z
      .number()
      .nullable()
      .optional()
      .describe('Created unix timestamp (seconds)'),
    plan: MemberfulPlanSchema.optional().describe('Associated plan'),
  })
  .passthrough()
  .describe('Memberful subscription object');

export const MemberfulMemberSchema = z
  .object({
    id: z.string().describe('Member ID'),
    email: z.string().optional().describe('Member email'),
    fullName: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Member full name (Memberful has no firstName/lastName — only fullName)'
      ),
    username: z.string().nullable().optional().describe('Username'),
    phoneNumber: z.string().nullable().optional().describe('Phone number'),
    totalSpendCents: z.number().optional().describe('Lifetime spend in cents'),
    totalOrders: z.number().optional().describe('Total orders count'),
    unrestrictedAccess: z
      .boolean()
      .optional()
      .describe('Whether member has unrestricted access'),
    subscriptions: z
      .array(MemberfulSubscriptionSchema)
      .optional()
      .describe('Active/historical subscriptions for this member'),
  })
  .passthrough()
  .describe('Memberful member object');

export const MemberfulOrderSchema = z
  .object({
    uuid: z
      .string()
      .describe(
        'Order UUID (Memberful uses "uuid" as its unique identifier — there is no integer "id" on Order)'
      ),
    totalCents: z
      .number()
      .nullable()
      .optional()
      .describe('Order total in cents'),
    currency: z.string().nullable().optional().describe('ISO currency code'),
    status: z.string().optional().describe('Order status enum'),
    type: z.string().nullable().optional().describe('Order type enum'),
    taxAmountCents: z
      .number()
      .nullable()
      .optional()
      .describe('Tax amount in cents'),
    couponDiscountAmountCents: z
      .number()
      .nullable()
      .optional()
      .describe('Coupon discount applied in cents'),
    createdAt: z
      .number()
      .nullable()
      .optional()
      .describe('Created unix timestamp (SECONDS, not milliseconds)'),
  })
  .passthrough()
  .describe('Memberful order object');

const PageInfoSchema = z
  .object({
    endCursor: z.string().nullable().optional(),
    hasNextPage: z.boolean().optional(),
  })
  .passthrough()
  .describe('Relay pagination info');

// ============================================================================
// OPERATION SCHEMAS - Input Parameters
// ============================================================================

const credentialsField = z
  .record(z.string())
  .optional()
  .describe('Credential mapping for authentication');

const ListMembersSchema = z.object({
  operation: z
    .literal('list_members')
    .describe(
      'List members on the site with pagination. Memberful does not support free-text search over members via API — filter client-side or use get_member with email for exact lookup.'
    ),
  state: z
    .enum(['active', 'inactive'])
    .optional()
    .describe(
      'Optional filter by MemberState (active/inactive — mapped to ACTIVE/INACTIVE on the wire)'
    ),
  first: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(25)
    .describe('Page size (max 100)'),
  after: z
    .string()
    .optional()
    .describe(
      'Cursor to fetch the next page (from previous response pageInfo.endCursor)'
    ),
  credentials: credentialsField,
});

const GetMemberSchema = z.object({
  operation: z
    .literal('get_member')
    .describe(
      'Get a single member by ID or email. Exactly one of id/email required.'
    ),
  id: z
    .string()
    .optional()
    .describe('[ONEOF:lookup] Member ID — uses Memberful member(id:) query'),
  email: z
    .string()
    .optional()
    .describe(
      '[ONEOF:lookup] Member email — uses Memberful memberByEmail(email:) query'
    ),
  credentials: credentialsField,
});

const ListSubscriptionsSchema = z.object({
  operation: z
    .literal('list_subscriptions')
    .describe('List subscriptions on the site with pagination'),
  first: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(25)
    .describe('Page size (max 100)'),
  after: z.string().optional().describe('Cursor to fetch the next page'),
  credentials: credentialsField,
});

const ListPlansSchema = z.object({
  operation: z
    .literal('list_plans')
    .describe('List all membership plans on the site'),
  credentials: credentialsField,
});

const ListOrdersSchema = z.object({
  operation: z
    .literal('list_orders')
    .describe('List orders on the site with pagination'),
  first: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(25)
    .describe('Page size (max 100)'),
  after: z.string().optional().describe('Cursor to fetch the next page'),
  credentials: credentialsField,
});

const RawQuerySchema = z.object({
  operation: z
    .literal('raw_query')
    .describe(
      'Execute an arbitrary GraphQL query against the Memberful admin API. Use this for any fields not covered by the other operations.'
    ),
  query: z.string().describe('GraphQL query or mutation document'),
  variables: z
    .record(z.unknown())
    .optional()
    .describe('GraphQL variables object'),
  credentials: credentialsField,
});

// ============================================================================
// COMBINED SCHEMAS
// ============================================================================

export const MemberfulParamsSchema = z.discriminatedUnion('operation', [
  ListMembersSchema,
  GetMemberSchema,
  ListSubscriptionsSchema,
  ListPlansSchema,
  ListOrdersSchema,
  RawQuerySchema,
]);

export type MemberfulParams = z.output<typeof MemberfulParamsSchema>;
export type MemberfulParamsInput = z.input<typeof MemberfulParamsSchema>;

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

const ListMembersResultSchema = z.object({
  operation: z.literal('list_members'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z
    .object({
      members: z.array(MemberfulMemberSchema),
      pageInfo: PageInfoSchema.optional(),
    })
    .optional(),
});

const GetMemberResultSchema = z.object({
  operation: z.literal('get_member'),
  success: z.boolean(),
  error: z.string().default(''),
  data: MemberfulMemberSchema.optional(),
});

const ListSubscriptionsResultSchema = z.object({
  operation: z.literal('list_subscriptions'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z
    .object({
      subscriptions: z.array(MemberfulSubscriptionSchema),
      pageInfo: PageInfoSchema.optional(),
    })
    .optional(),
});

const ListPlansResultSchema = z.object({
  operation: z.literal('list_plans'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z
    .object({
      plans: z.array(MemberfulPlanSchema),
    })
    .optional(),
});

const ListOrdersResultSchema = z.object({
  operation: z.literal('list_orders'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z
    .object({
      orders: z.array(MemberfulOrderSchema),
      pageInfo: PageInfoSchema.optional(),
    })
    .optional(),
});

const RawQueryResultSchema = z.object({
  operation: z.literal('raw_query'),
  success: z.boolean(),
  error: z.string().default(''),
  data: z.unknown().optional().describe('Raw GraphQL response data field'),
});

export const MemberfulResultSchema = z.discriminatedUnion('operation', [
  ListMembersResultSchema,
  GetMemberResultSchema,
  ListSubscriptionsResultSchema,
  ListPlansResultSchema,
  ListOrdersResultSchema,
  RawQueryResultSchema,
]);

export type MemberfulResult = z.infer<typeof MemberfulResultSchema>;
