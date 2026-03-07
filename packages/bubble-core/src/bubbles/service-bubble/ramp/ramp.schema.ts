import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Credentials field (common across all operations)
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credentials (injected at runtime)');

// ============================================================================
// RESULT DATA SCHEMAS
// ============================================================================

export const RampTransactionSchema = z
  .object({
    id: z.string().optional().describe('Transaction ID'),
    amount: z.number().optional().describe('Transaction amount in cents'),
    currency_code: z.string().optional().describe('Currency code (e.g., USD)'),
    merchant_name: z.string().nullable().optional().describe('Merchant name'),
    merchant_descriptor: z
      .string()
      .nullable()
      .optional()
      .describe('Merchant descriptor'),
    card_holder: z
      .object({
        user_id: z.string().optional().describe('Card holder user ID'),
        first_name: z.string().optional().describe('Card holder first name'),
        last_name: z.string().optional().describe('Card holder last name'),
        department_name: z
          .string()
          .nullable()
          .optional()
          .describe('Card holder department'),
      })
      .passthrough()
      .optional()
      .describe('Card holder information'),
    card_id: z.string().nullable().optional().describe('Card ID'),
    state: z.string().optional().describe('Transaction state (e.g., CLEARED)'),
    user_transaction_time: z
      .string()
      .nullable()
      .optional()
      .describe('Transaction time'),
    settlement_date: z
      .string()
      .nullable()
      .optional()
      .describe('Settlement date'),
    memo: z.string().nullable().optional().describe('Transaction memo'),
    sk_category_name: z
      .string()
      .nullable()
      .optional()
      .describe('Spending category name'),
  })
  .passthrough()
  .describe('Ramp transaction');

export const RampUserSchema = z
  .object({
    id: z.string().optional().describe('User ID'),
    first_name: z.string().optional().describe('First name'),
    last_name: z.string().optional().describe('Last name'),
    email: z.string().optional().describe('Email address'),
    role: z.string().optional().describe('User role'),
    department_id: z.string().nullable().optional().describe('Department ID'),
    location_id: z.string().nullable().optional().describe('Location ID'),
    status: z.string().optional().describe('User status'),
  })
  .passthrough()
  .describe('Ramp user');

export const RampCardSchema = z
  .object({
    id: z.string().optional().describe('Card ID'),
    display_name: z.string().optional().describe('Card display name'),
    last_four: z.string().optional().describe('Last four digits'),
    card_program_id: z
      .string()
      .nullable()
      .optional()
      .describe('Card program ID'),
    state: z.string().optional().describe('Card state'),
    is_physical: z.boolean().optional().describe('Whether card is physical'),
    cardholder_id: z.string().optional().describe('Cardholder user ID'),
    cardholder_name: z.string().optional().describe('Cardholder name'),
    spending_restrictions: z
      .record(z.unknown())
      .optional()
      .describe('Spending restrictions'),
  })
  .passthrough()
  .describe('Ramp card');

export const RampDepartmentSchema = z
  .object({
    id: z.string().optional().describe('Department ID'),
    name: z.string().optional().describe('Department name'),
  })
  .passthrough()
  .describe('Ramp department');

export const RampLocationSchema = z
  .object({
    id: z.string().optional().describe('Location ID'),
    name: z.string().optional().describe('Location name'),
  })
  .passthrough()
  .describe('Ramp location');

export const RampSpendProgramSchema = z
  .object({
    id: z.string().optional().describe('Spend program ID'),
    display_name: z.string().optional().describe('Spend program display name'),
    description: z.string().nullable().optional().describe('Description'),
  })
  .passthrough()
  .describe('Ramp spend program');

export const RampLimitSchema = z
  .object({
    id: z.string().optional().describe('Limit/fund ID'),
    display_name: z.string().optional().describe('Limit display name'),
    state: z.string().optional().describe('Limit state'),
  })
  .passthrough()
  .describe('Ramp limit/fund');

export const RampReimbursementSchema = z
  .object({
    id: z.string().optional().describe('Reimbursement ID'),
    amount: z.number().optional().describe('Reimbursement amount in cents'),
    currency: z.string().optional().describe('Currency code'),
    merchant: z.string().nullable().optional().describe('Merchant name'),
    user_id: z.string().optional().describe('User who submitted'),
  })
  .passthrough()
  .describe('Ramp reimbursement');

export const RampBillSchema = z
  .object({
    id: z.string().optional().describe('Bill ID'),
    amount: z.number().optional().describe('Bill amount'),
    vendor_name: z.string().nullable().optional().describe('Vendor name'),
    status: z.string().optional().describe('Bill status'),
  })
  .passthrough()
  .describe('Ramp bill');

export const RampVendorSchema = z
  .object({
    id: z.string().optional().describe('Vendor ID'),
    name: z.string().optional().describe('Vendor name'),
  })
  .passthrough()
  .describe('Ramp vendor');

export const RampBusinessSchema = z
  .object({
    id: z.string().optional().describe('Business ID'),
    name: z.string().optional().describe('Business name'),
  })
  .passthrough()
  .describe('Ramp business info');

// ============================================================================
// PARAMETERS SCHEMA (discriminated union)
// ============================================================================

export const RampParamsSchema = z.discriminatedUnion('operation', [
  // -------------------------------------------------------------------------
  // list_transactions
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_transactions')
      .describe('List transactions with optional filters'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    from_date: z
      .string()
      .optional()
      .describe(
        'Filter transactions from this date (ISO 8601 format, e.g. 2024-01-01T00:00:00Z)'
      ),
    to_date: z
      .string()
      .optional()
      .describe(
        'Filter transactions up to this date (ISO 8601 format, e.g. 2024-12-31T23:59:59Z)'
      ),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_transaction
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_transaction')
      .describe('Get a specific transaction by ID'),
    transaction_id: z
      .string()
      .min(1, 'Transaction ID is required')
      .describe('Transaction ID'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_users
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_users').describe('List users in the business'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_user
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_user').describe('Get a specific user by ID'),
    user_id: z.string().min(1, 'User ID is required').describe('User ID'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_cards
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_cards').describe('List cards'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_card
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_card').describe('Get a specific card by ID'),
    card_id: z.string().min(1, 'Card ID is required').describe('Card ID'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_departments
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_departments')
      .describe('List departments in the business'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_locations
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_locations')
      .describe('List locations in the business'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_spend_programs
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_spend_programs').describe('List spend programs'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_limits
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_limits').describe('List spend limits/funds'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_reimbursements
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_reimbursements').describe('List reimbursements'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    from_date: z
      .string()
      .optional()
      .describe('Filter reimbursements from this date (ISO 8601 format)'),
    to_date: z
      .string()
      .optional()
      .describe('Filter reimbursements up to this date (ISO 8601 format)'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_bills
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_bills').describe('List bills'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    from_date: z
      .string()
      .optional()
      .describe('Filter bills from this date (ISO 8601 format)'),
    to_date: z
      .string()
      .optional()
      .describe('Filter bills up to this date (ISO 8601 format)'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_vendors
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_vendors').describe('List vendors'),
    page_size: z
      .number()
      .min(2)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results per page (2-100)'),
    start: z
      .string()
      .optional()
      .describe('Cursor ID from previous page for pagination'),
    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_business
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_business').describe('Get business information'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

export const RampResultSchema = z.discriminatedUnion('operation', [
  // list_transactions result
  z.object({
    operation: z.literal('list_transactions'),
    success: z.boolean().describe('Whether the operation was successful'),
    transactions: z
      .array(RampTransactionSchema)
      .optional()
      .describe('List of transactions'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_transaction result
  z.object({
    operation: z.literal('get_transaction'),
    success: z.boolean().describe('Whether the operation was successful'),
    transaction: RampTransactionSchema.optional().describe(
      'Transaction details'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_users result
  z.object({
    operation: z.literal('list_users'),
    success: z.boolean().describe('Whether the operation was successful'),
    users: z.array(RampUserSchema).optional().describe('List of users'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_user result
  z.object({
    operation: z.literal('get_user'),
    success: z.boolean().describe('Whether the operation was successful'),
    user: RampUserSchema.optional().describe('User details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_cards result
  z.object({
    operation: z.literal('list_cards'),
    success: z.boolean().describe('Whether the operation was successful'),
    cards: z.array(RampCardSchema).optional().describe('List of cards'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_card result
  z.object({
    operation: z.literal('get_card'),
    success: z.boolean().describe('Whether the operation was successful'),
    card: RampCardSchema.optional().describe('Card details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_departments result
  z.object({
    operation: z.literal('list_departments'),
    success: z.boolean().describe('Whether the operation was successful'),
    departments: z
      .array(RampDepartmentSchema)
      .optional()
      .describe('List of departments'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_locations result
  z.object({
    operation: z.literal('list_locations'),
    success: z.boolean().describe('Whether the operation was successful'),
    locations: z
      .array(RampLocationSchema)
      .optional()
      .describe('List of locations'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_spend_programs result
  z.object({
    operation: z.literal('list_spend_programs'),
    success: z.boolean().describe('Whether the operation was successful'),
    spend_programs: z
      .array(RampSpendProgramSchema)
      .optional()
      .describe('List of spend programs'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_limits result
  z.object({
    operation: z.literal('list_limits'),
    success: z.boolean().describe('Whether the operation was successful'),
    limits: z
      .array(RampLimitSchema)
      .optional()
      .describe('List of spend limits/funds'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_reimbursements result
  z.object({
    operation: z.literal('list_reimbursements'),
    success: z.boolean().describe('Whether the operation was successful'),
    reimbursements: z
      .array(RampReimbursementSchema)
      .optional()
      .describe('List of reimbursements'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_bills result
  z.object({
    operation: z.literal('list_bills'),
    success: z.boolean().describe('Whether the operation was successful'),
    bills: z.array(RampBillSchema).optional().describe('List of bills'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_vendors result
  z.object({
    operation: z.literal('list_vendors'),
    success: z.boolean().describe('Whether the operation was successful'),
    vendors: z.array(RampVendorSchema).optional().describe('List of vendors'),
    has_more: z.boolean().optional().describe('Whether there are more results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_business result
  z.object({
    operation: z.literal('get_business'),
    success: z.boolean().describe('Whether the operation was successful'),
    business: RampBusinessSchema.optional().describe('Business information'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// OUTPUT type: What's stored internally (after validation/transformation)
export type RampParams = z.output<typeof RampParamsSchema>;

// INPUT type: What users pass (before validation)
export type RampParamsInput = z.input<typeof RampParamsSchema>;

// RESULT type: Always output (after validation)
export type RampResult = z.output<typeof RampResultSchema>;

// Operation-specific parameter types
export type RampListTransactionsParams = Extract<
  RampParams,
  { operation: 'list_transactions' }
>;
export type RampGetTransactionParams = Extract<
  RampParams,
  { operation: 'get_transaction' }
>;
export type RampListUsersParams = Extract<
  RampParams,
  { operation: 'list_users' }
>;
export type RampGetUserParams = Extract<RampParams, { operation: 'get_user' }>;
export type RampListCardsParams = Extract<
  RampParams,
  { operation: 'list_cards' }
>;
export type RampGetCardParams = Extract<RampParams, { operation: 'get_card' }>;
export type RampListDepartmentsParams = Extract<
  RampParams,
  { operation: 'list_departments' }
>;
export type RampListLocationsParams = Extract<
  RampParams,
  { operation: 'list_locations' }
>;
export type RampListSpendProgramsParams = Extract<
  RampParams,
  { operation: 'list_spend_programs' }
>;
export type RampListLimitsParams = Extract<
  RampParams,
  { operation: 'list_limits' }
>;
export type RampListReimbursementsParams = Extract<
  RampParams,
  { operation: 'list_reimbursements' }
>;
export type RampListBillsParams = Extract<
  RampParams,
  { operation: 'list_bills' }
>;
export type RampListVendorsParams = Extract<
  RampParams,
  { operation: 'list_vendors' }
>;
export type RampGetBusinessParams = Extract<
  RampParams,
  { operation: 'get_business' }
>;
