import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

// Credentials field (common across all operations)
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credentials (injected at runtime)');

// ============================================================================
// DATA SCHEMAS (for results)
// ============================================================================

export const RampTransactionSchema = z
  .object({
    id: z.string().describe('Transaction ID'),
    amount: z.number().describe('Transaction amount'),
    currency_code: z.string().optional().describe('Currency code (e.g., USD)'),
    merchant_name: z.string().optional().describe('Merchant name'),
    merchant_descriptor: z.string().optional().describe('Merchant descriptor'),
    merchant_category_code: z
      .string()
      .optional()
      .describe('Merchant category code'),
    merchant_category_code_description: z
      .string()
      .optional()
      .describe('Merchant category description'),
    card_id: z.string().optional().describe('Card ID used for transaction'),
    card_holder: z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        department_name: z.string().optional(),
      })
      .passthrough()
      .optional()
      .describe('Card holder info'),
    state: z
      .string()
      .optional()
      .describe(
        'Transaction state (CLEARED, COMPLETION, DECLINED, ERROR, PENDING, PENDING_INITIATION)'
      ),
    memo: z.string().nullable().optional().describe('Transaction memo'),
    receipts: z
      .array(z.string())
      .optional()
      .describe('Receipt IDs attached to this transaction'),
    user_transaction_time: z
      .string()
      .optional()
      .describe('Transaction time in user timezone'),
    settlement_date: z.string().optional().describe('Settlement date'),
    sk_category_name: z.string().optional().describe('Ramp category name'),
  })
  .passthrough()
  .describe('Ramp transaction');

export const RampCardSchema = z
  .object({
    id: z.string().describe('Card ID'),
    display_name: z.string().optional().describe('Card display name'),
    last_four: z.string().optional().describe('Last four digits of card'),
    cardholder_id: z.string().optional().describe('Cardholder user ID'),
    cardholder_name: z.string().optional().describe('Cardholder name'),
    is_physical: z.boolean().optional().describe('Whether card is physical'),
    state: z
      .string()
      .optional()
      .describe(
        'Card state (ACTIVE, CHIP_LOCKED, SUSPENDED, TERMINATED, UNACTIVATED)'
      ),
    spending_restrictions: z
      .record(z.unknown())
      .optional()
      .describe('Spending restrictions on the card'),
    entity_id: z.string().optional().describe('Business entity ID'),
    created_at: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('Ramp card');

export const RampUserSchema = z
  .object({
    id: z.string().describe('User ID'),
    email: z.string().optional().describe('User email'),
    first_name: z.string().optional().describe('First name'),
    last_name: z.string().optional().describe('Last name'),
    role: z
      .string()
      .optional()
      .describe(
        'User role (BUSINESS_ADMIN, BUSINESS_USER, BUSINESS_OWNER, etc.)'
      ),
    status: z
      .string()
      .optional()
      .describe(
        'User status (USER_ACTIVE, USER_INACTIVE, INVITE_PENDING, etc.)'
      ),
    department_id: z.string().optional().describe('Department ID'),
    location_id: z.string().optional().describe('Location ID'),
    manager_id: z.string().optional().describe('Manager user ID'),
    is_manager: z.boolean().optional().describe('Whether user is a manager'),
    phone: z.string().optional().describe('Phone number'),
  })
  .passthrough()
  .describe('Ramp user');

export const RampReimbursementSchema = z
  .object({
    id: z.string().describe('Reimbursement ID'),
    amount: z.number().describe('Reimbursement amount'),
    currency: z.string().optional().describe('Currency code'),
    direction: z
      .string()
      .optional()
      .describe('Direction (BUSINESS_TO_USER, USER_TO_BUSINESS)'),
    state: z.string().optional().describe('Reimbursement state'),
    type: z
      .string()
      .optional()
      .describe(
        'Reimbursement type (MILEAGE, OUT_OF_POCKET, PAYBACK_FULL, etc.)'
      ),
    user_id: z.string().optional().describe('User ID'),
    user_full_name: z.string().optional().describe('User full name'),
    merchant: z.string().nullable().optional().describe('Merchant name'),
    memo: z.string().nullable().optional().describe('Memo'),
    transaction_date: z.string().optional().describe('Transaction date'),
    created_at: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('Ramp reimbursement');

export const RampDepartmentSchema = z
  .object({
    id: z.string().describe('Department ID'),
    name: z.string().describe('Department name'),
  })
  .passthrough()
  .describe('Ramp department');

export const RampVendorSchema = z
  .object({
    id: z.string().describe('Vendor ID'),
    name: z.string().optional().describe('Vendor name'),
    email: z.string().optional().describe('Vendor contact email'),
    phone: z.string().optional().describe('Vendor phone'),
  })
  .passthrough()
  .describe('Ramp vendor');

export const RampBusinessSchema = z
  .object({
    id: z.string().describe('Business ID'),
    business_name_on_card: z
      .string()
      .optional()
      .describe('Business name on card'),
    business_name_legal: z.string().optional().describe('Legal business name'),
    initial_approved_limit: z
      .number()
      .optional()
      .describe('Initial approved limit'),
    current_billing_period_start_date: z
      .string()
      .optional()
      .describe('Current billing period start'),
    current_billing_period_end_date: z
      .string()
      .optional()
      .describe('Current billing period end'),
  })
  .passthrough()
  .describe('Ramp business info');

export const RampStatementSchema = z
  .object({
    id: z.string().describe('Statement ID'),
    start_date: z.string().optional().describe('Statement start date'),
    end_date: z.string().optional().describe('Statement end date'),
    total_amount: z.number().optional().describe('Total amount'),
    status: z.string().optional().describe('Statement status'),
  })
  .passthrough()
  .describe('Ramp statement');

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

    department_id: z.string().optional().describe('Filter by department ID'),

    user_id: z.string().optional().describe('Filter by user ID'),

    card_id: z.string().optional().describe('Filter by card ID'),

    merchant_id: z.string().optional().describe('Filter by merchant ID'),

    state: z
      .string()
      .optional()
      .describe(
        'Filter by transaction state (CLEARED, COMPLETION, DECLINED, ERROR, PENDING, PENDING_INITIATION)'
      ),

    from_date: z
      .string()
      .optional()
      .describe('Filter transactions from this date (ISO 8601)'),

    to_date: z
      .string()
      .optional()
      .describe('Filter transactions to this date (ISO 8601)'),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z
      .string()
      .optional()
      .describe('Cursor for pagination (ID of last item from previous page)'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_transaction
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_transaction')
      .describe('Get details for a specific transaction'),

    transaction_id: z
      .string()
      .min(1, 'Transaction ID is required')
      .describe('The transaction ID to fetch'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_cards
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_cards')
      .describe('List cards with optional filters'),

    user_id: z.string().optional().describe('Filter cards by user ID'),

    display_name: z
      .string()
      .optional()
      .describe('Filter cards by display name'),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_card
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_card')
      .describe('Get details for a specific card'),

    card_id: z
      .string()
      .min(1, 'Card ID is required')
      .describe('The card ID to fetch'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_users
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_users')
      .describe('List users with optional filters'),

    department_id: z
      .string()
      .optional()
      .describe('Filter users by department ID'),

    role: z
      .string()
      .optional()
      .describe(
        'Filter by role (BUSINESS_ADMIN, BUSINESS_USER, BUSINESS_OWNER, etc.)'
      ),

    status: z
      .string()
      .optional()
      .describe(
        'Filter by status (USER_ACTIVE, USER_INACTIVE, INVITE_PENDING, etc.)'
      ),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_user
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_user')
      .describe('Get details for a specific user'),

    user_id: z
      .string()
      .min(1, 'User ID is required')
      .describe('The user ID to fetch'),

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
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_reimbursement
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_reimbursement')
      .describe('Get details for a specific reimbursement'),

    reimbursement_id: z
      .string()
      .min(1, 'Reimbursement ID is required')
      .describe('The reimbursement ID to fetch'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_departments
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_departments').describe('List all departments'),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_vendors
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_vendors').describe('List all vendors'),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // get_business
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_business')
      .describe('Get company/business information'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // list_statements
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_statements').describe('List billing statements'),

    page_size: z
      .number()
      .min(2)
      .max(1000)
      .optional()
      .default(50)
      .describe('Number of results per page (2-1000)'),

    start: z.string().optional().describe('Cursor for pagination'),

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
    data: z
      .array(RampTransactionSchema)
      .optional()
      .describe('List of transactions'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
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

  // list_cards result
  z.object({
    operation: z.literal('list_cards'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z.array(RampCardSchema).optional().describe('List of cards'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_card result
  z.object({
    operation: z.literal('get_card'),
    success: z.boolean().describe('Whether the operation was successful'),
    card: RampCardSchema.optional().describe('Card details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_users result
  z.object({
    operation: z.literal('list_users'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z.array(RampUserSchema).optional().describe('List of users'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_user result
  z.object({
    operation: z.literal('get_user'),
    success: z.boolean().describe('Whether the operation was successful'),
    user: RampUserSchema.optional().describe('User details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_reimbursements result
  z.object({
    operation: z.literal('list_reimbursements'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z
      .array(RampReimbursementSchema)
      .optional()
      .describe('List of reimbursements'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_reimbursement result
  z.object({
    operation: z.literal('get_reimbursement'),
    success: z.boolean().describe('Whether the operation was successful'),
    reimbursement: RampReimbursementSchema.optional().describe(
      'Reimbursement details'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_departments result
  z.object({
    operation: z.literal('list_departments'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z
      .array(RampDepartmentSchema)
      .optional()
      .describe('List of departments'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_vendors result
  z.object({
    operation: z.literal('list_vendors'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z.array(RampVendorSchema).optional().describe('List of vendors'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_business result
  z.object({
    operation: z.literal('get_business'),
    success: z.boolean().describe('Whether the operation was successful'),
    business: RampBusinessSchema.optional().describe('Business details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_statements result
  z.object({
    operation: z.literal('list_statements'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z
      .array(RampStatementSchema)
      .optional()
      .describe('List of statements'),
    has_more: z.boolean().optional().describe('Whether more results exist'),
    next_cursor: z.string().optional().describe('Cursor for the next page'),
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
