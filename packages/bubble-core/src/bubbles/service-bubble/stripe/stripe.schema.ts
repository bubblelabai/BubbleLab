import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - Stripe API Response Objects
// ============================================================================

export const StripeCustomerSchema = z
  .object({
    id: z.string().describe('Unique Stripe customer identifier (cus_xxx)'),
    name: z.string().nullable().optional().describe('Customer name'),
    email: z.string().nullable().optional().describe('Customer email address'),
    created: z.number().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the customer'),
  })
  .describe('Stripe customer object');

export const StripeProductSchema = z
  .object({
    id: z.string().describe('Unique Stripe product identifier (prod_xxx)'),
    name: z.string().describe('Product name'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Product description'),
    active: z.boolean().describe('Whether the product is currently available'),
    created: z.number().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the product'),
  })
  .describe('Stripe product object');

export const StripePriceSchema = z
  .object({
    id: z.string().describe('Unique Stripe price identifier (price_xxx)'),
    product: z.string().describe('ID of the product this price is for'),
    unit_amount: z
      .number()
      .nullable()
      .describe('Price in the smallest currency unit (e.g., cents)'),
    currency: z.string().describe('Three-letter ISO currency code'),
    type: z
      .enum(['one_time', 'recurring'])
      .describe('Type of pricing (one-time or recurring)'),
    active: z.boolean().describe('Whether the price is currently active'),
    created: z.number().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the price'),
  })
  .describe('Stripe price object');

export const StripePaymentLinkSchema = z
  .object({
    id: z
      .string()
      .describe('Unique Stripe payment link identifier (plink_xxx)'),
    url: z.string().describe('The public URL of the payment link'),
    active: z.boolean().describe('Whether the payment link is active'),
    created: z.number().optional().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the payment link'),
  })
  .describe('Stripe payment link object');

export const StripeInvoiceSchema = z
  .object({
    id: z.string().describe('Unique Stripe invoice identifier (in_xxx)'),
    customer: z.string().nullable().describe('ID of the customer'),
    status: z
      .enum(['draft', 'open', 'paid', 'uncollectible', 'void'])
      .nullable()
      .describe('Invoice status'),
    total: z.number().describe('Total amount in smallest currency unit'),
    currency: z.string().describe('Three-letter ISO currency code'),
    created: z.number().optional().describe('Unix timestamp of creation'),
    due_date: z
      .string()
      .nullable()
      .optional()
      .describe('ISO date string when the invoice is due'),
    hosted_invoice_url: z
      .string()
      .nullable()
      .optional()
      .describe('URL for the hosted invoice page'),
    invoice_pdf: z
      .string()
      .nullable()
      .optional()
      .describe('URL for the invoice PDF (only available after finalization)'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the invoice'),
  })
  .describe('Stripe invoice object');

export const StripeBalanceSchema = z
  .object({
    available: z
      .array(
        z.object({
          amount: z.number().describe('Amount available'),
          currency: z.string().describe('Currency code'),
        })
      )
      .describe('Funds available for payout'),
    pending: z
      .array(
        z.object({
          amount: z.number().describe('Amount pending'),
          currency: z.string().describe('Currency code'),
        })
      )
      .describe('Funds not yet available'),
  })
  .describe('Stripe account balance');

export const StripePaymentIntentSchema = z
  .object({
    id: z.string().describe('Unique payment intent identifier (pi_xxx)'),
    amount: z.number().describe('Amount in smallest currency unit'),
    currency: z.string().describe('Three-letter ISO currency code'),
    status: z
      .enum([
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'requires_capture',
        'canceled',
        'succeeded',
      ])
      .describe('Payment intent status'),
    customer: z
      .string()
      .nullable()
      .optional()
      .describe('Customer ID if attached'),
    created: z.number().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the payment intent'),
  })
  .describe('Stripe payment intent object');

export const StripeSubscriptionSchema = z
  .object({
    id: z.string().describe('Unique subscription identifier (sub_xxx)'),
    customer: z.string().describe('Customer ID'),
    status: z
      .enum([
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ])
      .describe('Subscription status'),
    current_period_start: z
      .number()
      .optional()
      .describe(
        'Start of current billing period (may be absent for incomplete subscriptions)'
      ),
    current_period_end: z
      .number()
      .optional()
      .describe(
        'End of current billing period (may be absent for incomplete subscriptions)'
      ),
    cancel_at_period_end: z
      .boolean()
      .describe('Whether subscription cancels at period end'),
    created: z.number().describe('Unix timestamp of creation'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata attached to the subscription'),
  })
  .describe('Stripe subscription object');

// ============================================================================
// CREDENTIALS FIELD - Required for all operations
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

// ============================================================================
// PARAMETERS SCHEMA - All Stripe Operations
// ============================================================================

export const StripeParamsSchema = z.discriminatedUnion('operation', [
  // Create Customer
  z.object({
    operation: z
      .literal('create_customer')
      .describe('Create a new customer in Stripe'),
    name: z
      .string()
      .min(1, 'Customer name is required')
      .describe('Customer name'),
    email: z
      .string()
      .email('Invalid email format')
      .optional()
      .describe('Customer email address'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the customer'),
    credentials: credentialsField,
  }),

  // List Customers
  z.object({
    operation: z
      .literal('list_customers')
      .describe('List customers from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of customers to return (1-100)'),
    email: z
      .string()
      .optional()
      .describe('Filter customers by email address (case-sensitive)'),
    credentials: credentialsField,
  }),

  // Create Product
  z.object({
    operation: z
      .literal('create_product')
      .describe('Create a new product in Stripe'),
    name: z
      .string()
      .min(1, 'Product name is required')
      .describe('Product name'),
    description: z.string().optional().describe('Product description'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the product'),
    credentials: credentialsField,
  }),

  // List Products
  z.object({
    operation: z.literal('list_products').describe('List products from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of products to return (1-100)'),
    active: z.boolean().optional().describe('Filter by active status'),
    credentials: credentialsField,
  }),

  // Create Price
  z.object({
    operation: z
      .literal('create_price')
      .describe('Create a new price for a product'),
    product: z
      .string()
      .min(1, 'Product ID is required')
      .describe('ID of the product this price is for'),
    unit_amount: z
      .number()
      .int()
      .min(0)
      .describe('Price in smallest currency unit (e.g., cents for USD)'),
    currency: z
      .string()
      .length(3, 'Currency must be 3-letter ISO code')
      .default('usd')
      .describe('Three-letter ISO currency code (e.g., "usd")'),
    recurring: z
      .object({
        interval: z
          .enum(['day', 'week', 'month', 'year'])
          .describe('Billing interval'),
        interval_count: z
          .number()
          .int()
          .min(1)
          .optional()
          .default(1)
          .describe('Number of intervals between billings'),
      })
      .optional()
      .describe('Recurring pricing details (omit for one-time prices)'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the price'),
    credentials: credentialsField,
  }),

  // List Prices
  z.object({
    operation: z.literal('list_prices').describe('List prices from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of prices to return (1-100)'),
    product: z.string().optional().describe('Filter by product ID'),
    active: z.boolean().optional().describe('Filter by active status'),
    credentials: credentialsField,
  }),

  // Create Payment Link
  z.object({
    operation: z
      .literal('create_payment_link')
      .describe('Create a payment link for a price'),
    price: z
      .string()
      .min(1, 'Price ID is required')
      .describe('ID of the price to create payment link for'),
    quantity: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('Quantity of items in the payment link'),
    redirect_url: z
      .string()
      .url('Invalid URL format')
      .optional()
      .describe('URL to redirect after successful payment'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the payment link'),
    credentials: credentialsField,
  }),

  // Create Invoice
  z.object({
    operation: z
      .literal('create_invoice')
      .describe('Create a new invoice for a customer'),
    customer: z
      .string()
      .min(1, 'Customer ID is required')
      .describe('ID of the customer to invoice'),
    auto_advance: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to auto-finalize the invoice'),
    collection_method: z
      .enum(['charge_automatically', 'send_invoice'])
      .optional()
      .default('charge_automatically')
      .describe('How to collect payment'),
    days_until_due: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Days until invoice is due (for send_invoice collection)'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the invoice'),
    credentials: credentialsField,
  }),

  // List Invoices
  z.object({
    operation: z.literal('list_invoices').describe('List invoices from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of invoices to return (1-100)'),
    customer: z.string().optional().describe('Filter by customer ID'),
    status: z
      .enum(['draft', 'open', 'paid', 'uncollectible', 'void'])
      .optional()
      .describe('Filter by invoice status'),
    credentials: credentialsField,
  }),

  // Retrieve Invoice
  z.object({
    operation: z
      .literal('retrieve_invoice')
      .describe('Retrieve a specific invoice by ID'),
    invoice_id: z
      .string()
      .min(1, 'Invoice ID is required')
      .describe('ID of the invoice to retrieve'),
    credentials: credentialsField,
  }),

  // Finalize Invoice
  z.object({
    operation: z
      .literal('finalize_invoice')
      .describe('Finalize a draft invoice to make it ready for payment'),
    invoice_id: z
      .string()
      .min(1, 'Invoice ID is required')
      .describe('ID of the draft invoice to finalize'),
    auto_advance: z
      .boolean()
      .optional()
      .describe(
        'Whether to automatically advance the invoice after finalizing'
      ),
    credentials: credentialsField,
  }),

  // Get Balance
  z.object({
    operation: z
      .literal('get_balance')
      .describe('Retrieve the current account balance'),
    credentials: credentialsField,
  }),

  // List Payment Intents
  z.object({
    operation: z
      .literal('list_payment_intents')
      .describe('List payment intents from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of payment intents to return (1-100)'),
    customer: z.string().optional().describe('Filter by customer ID'),
    credentials: credentialsField,
  }),

  // List Subscriptions
  z.object({
    operation: z
      .literal('list_subscriptions')
      .describe('List subscriptions from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of subscriptions to return (1-100)'),
    customer: z.string().optional().describe('Filter by customer ID'),
    status: z
      .enum([
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
        'all',
      ])
      .optional()
      .describe('Filter by subscription status'),
    credentials: credentialsField,
  }),

  // Cancel Subscription
  z.object({
    operation: z
      .literal('cancel_subscription')
      .describe('Cancel a subscription'),
    subscription_id: z
      .string()
      .min(1, 'Subscription ID is required')
      .describe('ID of the subscription to cancel'),
    cancel_at_period_end: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to cancel at the end of the current period'),
    credentials: credentialsField,
  }),

  // List Payment Links
  z.object({
    operation: z
      .literal('list_payment_links')
      .describe('List payment links from Stripe'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of payment links to return (1-100)'),
    active: z.boolean().optional().describe('Filter by active status'),
    credentials: credentialsField,
  }),

  // Create Subscription
  z.object({
    operation: z
      .literal('create_subscription')
      .describe('Create a new subscription for a customer'),
    customer: z
      .string()
      .min(1, 'Customer ID is required')
      .describe('ID of the customer to subscribe'),
    price: z
      .string()
      .min(1, 'Price ID is required')
      .describe('ID of the recurring price to subscribe to'),
    trial_period_days: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Number of trial period days before billing starts'),
    payment_behavior: z
      .enum(['default_incomplete', 'error_if_incomplete', 'allow_incomplete'])
      .optional()
      .default('default_incomplete')
      .describe(
        'How to handle payment failures. Use default_incomplete to create without payment method'
      ),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Arbitrary metadata to attach to the subscription'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMA - All Stripe Operation Results
// ============================================================================

export const StripeResultSchema = z.discriminatedUnion('operation', [
  // Create Customer Result
  z.object({
    operation: z.literal('create_customer'),
    success: z.boolean().describe('Whether the operation succeeded'),
    customer: StripeCustomerSchema.optional().describe(
      'Created customer object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Customers Result
  z.object({
    operation: z.literal('list_customers'),
    success: z.boolean().describe('Whether the operation succeeded'),
    customers: z
      .array(StripeCustomerSchema)
      .optional()
      .describe('List of customer objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create Product Result
  z.object({
    operation: z.literal('create_product'),
    success: z.boolean().describe('Whether the operation succeeded'),
    product: StripeProductSchema.optional().describe('Created product object'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Products Result
  z.object({
    operation: z.literal('list_products'),
    success: z.boolean().describe('Whether the operation succeeded'),
    products: z
      .array(StripeProductSchema)
      .optional()
      .describe('List of product objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create Price Result
  z.object({
    operation: z.literal('create_price'),
    success: z.boolean().describe('Whether the operation succeeded'),
    price: StripePriceSchema.optional().describe('Created price object'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Prices Result
  z.object({
    operation: z.literal('list_prices'),
    success: z.boolean().describe('Whether the operation succeeded'),
    prices: z
      .array(StripePriceSchema)
      .optional()
      .describe('List of price objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create Payment Link Result
  z.object({
    operation: z.literal('create_payment_link'),
    success: z.boolean().describe('Whether the operation succeeded'),
    payment_link: StripePaymentLinkSchema.optional().describe(
      'Created payment link object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create Invoice Result
  z.object({
    operation: z.literal('create_invoice'),
    success: z.boolean().describe('Whether the operation succeeded'),
    invoice: StripeInvoiceSchema.optional().describe('Created invoice object'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Invoices Result
  z.object({
    operation: z.literal('list_invoices'),
    success: z.boolean().describe('Whether the operation succeeded'),
    invoices: z
      .array(StripeInvoiceSchema)
      .optional()
      .describe('List of invoice objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Retrieve Invoice Result
  z.object({
    operation: z.literal('retrieve_invoice'),
    success: z.boolean().describe('Whether the operation succeeded'),
    invoice: StripeInvoiceSchema.optional().describe(
      'Retrieved invoice object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Finalize Invoice Result
  z.object({
    operation: z.literal('finalize_invoice'),
    success: z.boolean().describe('Whether the operation succeeded'),
    invoice: StripeInvoiceSchema.optional().describe(
      'Finalized invoice object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get Balance Result
  z.object({
    operation: z.literal('get_balance'),
    success: z.boolean().describe('Whether the operation succeeded'),
    balance: StripeBalanceSchema.optional().describe('Account balance'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Payment Intents Result
  z.object({
    operation: z.literal('list_payment_intents'),
    success: z.boolean().describe('Whether the operation succeeded'),
    payment_intents: z
      .array(StripePaymentIntentSchema)
      .optional()
      .describe('List of payment intent objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Subscriptions Result
  z.object({
    operation: z.literal('list_subscriptions'),
    success: z.boolean().describe('Whether the operation succeeded'),
    subscriptions: z
      .array(StripeSubscriptionSchema)
      .optional()
      .describe('List of subscription objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Cancel Subscription Result
  z.object({
    operation: z.literal('cancel_subscription'),
    success: z.boolean().describe('Whether the operation succeeded'),
    subscription: StripeSubscriptionSchema.optional().describe(
      'Canceled subscription object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List Payment Links Result
  z.object({
    operation: z.literal('list_payment_links'),
    success: z.boolean().describe('Whether the operation succeeded'),
    payment_links: z
      .array(StripePaymentLinkSchema)
      .optional()
      .describe('List of payment link objects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create Subscription Result
  z.object({
    operation: z.literal('create_subscription'),
    success: z.boolean().describe('Whether the operation succeeded'),
    subscription: StripeSubscriptionSchema.optional().describe(
      'Created subscription object'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type StripeParamsInput = z.input<typeof StripeParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation/transformation)
export type StripeParams = z.output<typeof StripeParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type StripeResult = z.output<typeof StripeResultSchema>;
