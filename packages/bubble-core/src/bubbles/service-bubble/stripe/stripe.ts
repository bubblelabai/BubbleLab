import { z } from 'zod';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleContext } from '../../../types/bubble.js';

// Stripe API base URL
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

export const StripeParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_customer'),
    email: z.string().email().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  }),
  z.object({
    operation: z.literal('create_subscription'),
    customerId: z.string().describe('The ID of the customer to subscribe.'),
    credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
    items: z
      .array(
        z.object({
          price: z
            .string()
            .describe('The ID of the price to subscribe the customer to.'),
          quantity: z
            .number()
            .optional()
            .describe(
              'The quantity of the price to subscribe the customer to.'
            ),
        })
      )
      .min(1, 'At least one item is required'),
    collection_method: z
      .enum(['charge_automatically', 'send_invoice'])
      .describe(
        "How to collect payment. 'charge_automatically' will try to bill the default payment method. 'send_invoice' will email an invoice."
      )
      .optional(),
    days_until_due: z
      .number()
      .optional()
      .describe(
        'Number of days before an invoice is due. Required if Collection Method is Send Invoice.'
      ),
    trial_period_days: z
      .number()
      .optional()
      .describe(
        'Integer representing the number of trial days the customer receives before the subscription bills for the first time.'
      ),
    default_payment_method: z
      .string()
      .optional()
      .describe(
        'ID of the default payment method for the subscription (e.g., `pm_...`).'
      ),
  }),
  z.object({
    operation: z.literal('cancel_subscription'),
    subscriptionId: z
      .string()
      .describe('The ID of the subscription to cancel.'),
    credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  }),
]);

const CustomerResultSchema = z.object({
  id: z.string().describe('The unique identifier for the customer.'),
  email: z
    .string()
    .email()
    .nullish()
    .describe('The email address of the customer.'),
  name: z.string().nullish().describe('The name of the customer.'),
  description: z.string().nullish().describe('A description of the customer.'),
  created: z.number().describe('Timestamp when the customer was created.'),
});

const SubscriptionResultSchema = z
  .object({
    id: z.string(),
    object: z.literal('subscription'),
    status: z.enum([
      'active',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'trialing',
      'paused',
    ]),
    customer: z.string(),
    collection_method: z.enum(['charge_automatically', 'send_invoice']),
    livemode: z.boolean(),
    created: z.number(),
    latest_invoice: z.string().nullable(),
    items: z.object({
      object: z.literal('list'),
      data: z.array(
        z.object({
          id: z.string(),
          price: z.object({ id: z.string() }),
          quantity: z.number(),
          current_period_start: z.number(),
          current_period_end: z.number(),
        })
      ),
      has_more: z.boolean(),
    }),
    cancel_at: z.number().nullable().optional(),
    trial_end: z.number().nullable().optional(),
    metadata: z.record(z.string()).nullable().optional(),
  })
  .passthrough();

export const StripeResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('create_customer')
      .describe('Creates a new customer object in Stripe.'),
    error: z.string().describe('Error message if the operation failed.'),
    success: z
      .boolean()
      .describe('Indicates whether the operation was successful.'),
    data: CustomerResultSchema.optional(),
  }),
  z.object({
    operation: z
      .literal('create_subscription')
      .describe('Creates a new subscription for a customer in Stripe.'),
    error: z.string().describe('Error message if the operation failed.'),
    success: z
      .boolean()
      .describe('Indicates whether the operation was successful.'),
    data: SubscriptionResultSchema.optional(),
  }),
  z.object({
    operation: z
      .literal('cancel_subscription')
      .describe('Cancels an existing subscription in Stripe.'),
    error: z.string().describe('Error message if the operation failed.'),
    success: z
      .boolean()
      .describe('Indicates whether the operation was successful.'),
    data: SubscriptionResultSchema.optional(),
  }),
]);

export type StripeParams = z.infer<typeof StripeParamsSchema>;
export type StripeResult = z.infer<typeof StripeResultSchema>;

export class StripeBubble<
  T extends StripeParams = StripeParams,
> extends ServiceBubble<
  T,
  Extract<StripeResult, { operation: T['operation'] }>
> {
  public async testCredential(): Promise<boolean> {
    // Make a test API call to the Stripe API
    const response = await this.makeStripeApiCall(
      'GET',
      '/customers?limit=1',
      {}
    );
    if (response.success) {
      return true;
    }
    return false;
  }
  static readonly type = 'service' as const;
  static readonly service = 'stripe';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'stripe';
  static readonly schema = StripeParamsSchema;
  static readonly resultSchema = StripeResultSchema;
  static readonly shortDescription =
    "Interact with Stripe's API to manage payments, customers, and subscriptions.";
  static readonly longDescription =
    "The Stripe Bubble allows you to perform various operations using Stripe's API, such as creating customers, managing payments, and handling subscriptions. It requires an API key for authentication.";
  static readonly alias = 'stripe';

  constructor(
    params: T = {
      operation: 'create_customer',
      email: '',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    // If no credentials were injected, return undefined
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.STRIPE_SECRET_KEY];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<StripeResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<StripeResult> => {
        switch (operation) {
          case 'create_customer':
            return await this.createCustomer(this.params);
          case 'create_subscription':
            return await this.createSubscription(this.params);
          case 'cancel_subscription':
            return await this.cancelSubscription(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<StripeResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      return {
        success: false,
        operation: failedOperation,
        error: error instanceof Error ? error.message : String(error),
        data: undefined,
      } as Extract<StripeResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Make an API call to the Stripe API
   */
  private async makeStripeApiCall(
    httpMethod: 'GET' | 'POST' | 'DELETE' | 'PUT',
    endpoint: string,
    body?: Record<string, string>
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error('Stripe API key is required');
    }
    const url = `${STRIPE_API_BASE_URL}${endpoint}`;
    const formattedBody = body
      ? new URLSearchParams(body).toString()
      : undefined;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    if (formattedBody) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    try {
      const response = await fetch(url, {
        method: httpMethod,
        headers,
        body: formattedBody,
      });

      const data = await response.json();

      if (!response.ok) {
        // Stripe error format: { error: { type, message, code } }
        const stripeError = data as {
          error?: { message?: string; type?: string; code?: string };
        };
        return {
          success: false,
          error: stripeError.error?.message || 'Stripe API error',
          data: undefined,
        };
      }

      // Stripe returns the object directly on success
      return {
        success: true,
        data: data,
        error: undefined,
      };
    } catch (error) {
      throw new Error(
        `Stripe API call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createCustomer(
    params: Extract<StripeParams, { operation: 'create_customer' }>
  ): Promise<Extract<StripeResult, { operation: 'create_customer' }>> {
    const { email, name, description } = params;
    const body: Record<string, string> = {};
    if (email) {
      body['email'] = email;
    }
    if (name) {
      body['name'] = name;
    }
    if (description) {
      body['description'] = description;
    }

    const response = await this.makeStripeApiCall('POST', '/customers', body);
    return {
      operation: 'create_customer',
      data:
        response.success && response.data
          ? {
              id: (response.data as { id: string }).id,
              email:
                (response.data as { email?: string | null }).email ?? undefined,
              name:
                (response.data as { name?: string | null }).name ?? undefined,
              description:
                (response.data as { description?: string | null })
                  .description ?? undefined,
              created: (response.data as { created: number }).created,
            }
          : undefined,
      error: response.success ? '' : response.error || 'Unknown Error',
      success: response.success,
    };
  }

  private async createSubscription(
    params: Extract<StripeParams, { operation: 'create_subscription' }>
  ): Promise<Extract<StripeResult, { operation: 'create_subscription' }>> {
    const {
      customerId,
      items,
      collection_method,
      days_until_due,
      trial_period_days,
      default_payment_method,
    } = params;
    const body: Record<string, string> = {
      customer: customerId,
    };
    items.forEach((item, index) => {
      body[`items[${index}][price]`] = item.price;
      if (item.quantity) {
        body[`items[${index}][quantity]`] = String(item.quantity);
      }
    });
    if (collection_method) {
      body.collection_method = collection_method;
    }
    if (days_until_due) {
      body.days_until_due = String(days_until_due);
    }
    if (trial_period_days) {
      body.trial_period_days = String(trial_period_days);
    }
    if (default_payment_method) {
      body.default_payment_method = default_payment_method;
    }
    const response = await this.makeStripeApiCall(
      'POST',
      '/subscriptions',
      body
    );
    type SubscriptionData = z.infer<typeof SubscriptionResultSchema>;
    let result: SubscriptionData | undefined = undefined;
    if (response.success && response.data) {
      const parseResult = SubscriptionResultSchema.safeParse(response.data);
      if (parseResult.success) {
        result = parseResult.data;
      }
    }
    return {
      operation: 'create_subscription',
      error: response.success ? '' : response.error || 'Unknown Error',
      success: response.success,
      data: result,
    };
  }

  private async cancelSubscription(
    params: Extract<StripeParams, { operation: 'cancel_subscription' }>
  ): Promise<Extract<StripeResult, { operation: 'cancel_subscription' }>> {
    const { subscriptionId } = params;

    const response = await this.makeStripeApiCall(
      'DELETE',
      `/subscriptions/${subscriptionId}`,
      {}
    );
    type SubscriptionData = z.infer<typeof SubscriptionResultSchema>;

    let result: SubscriptionData | undefined = undefined;
    if (response.success && response.data) {
      const parseResult = SubscriptionResultSchema.safeParse(response.data);
      if (parseResult.success) {
        result = parseResult.data;
      }
    }
    return {
      operation: 'cancel_subscription',
      error: response.success ? '' : response.error || 'Unknown Error',
      success: response.success,
      data: result,
    };
  }
}
