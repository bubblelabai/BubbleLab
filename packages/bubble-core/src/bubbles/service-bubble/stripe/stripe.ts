import { z } from 'zod';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleContext } from '../../../types/bubble.js';

// Stripe API base URL
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

const StripeParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_customer'),
    email: z.string().email().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  }),
]);

const CustomerResultSchema = z.object({
  id: z.string().describe('The unique identifier for the customer.'),
  email: z
    .string()
    .email()
    .optional()
    .describe('The email address of the customer.'),
  name: z.string().optional().describe('The name of the customer.'),
  description: z.string().optional().describe('A description of the customer.'),
  created: z.number().describe('Timestamp when the customer was created.'),
});

const StripeResultSchema = z.discriminatedUnion('operation', [
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
              email: (response.data as { email?: string }).email,
              name: (response.data as { name?: string }).name,
              description: (response.data as { description?: string })
                .description,
              created: (response.data as { created: number }).created,
            }
          : undefined,
      error: response.success ? '' : response.error || 'Unknown error',
      success: response.success,
    };
  }
}
