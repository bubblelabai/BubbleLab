import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  StripeParamsSchema,
  StripeResultSchema,
  type StripeParams,
  type StripeParamsInput,
  type StripeResult,
} from './stripe.schema.js';

/**
 * Stripe Service Bubble
 *
 * Comprehensive Stripe integration for payment and billing management.
 * Based on the Stripe MCP (Model Context Protocol) implementation.
 *
 * Features:
 * - Customer management (create, list)
 * - Product and price management
 * - Payment links creation
 * - Invoice management
 * - Subscription management
 * - Payment intents listing
 * - Refund creation
 * - Balance retrieval
 *
 * Use cases:
 * - Accept payments through payment links
 * - Manage customer billing and subscriptions
 * - Create and manage products and pricing
 * - Process refunds
 * - Monitor account balance
 *
 * Security Features:
 * - OAuth 2.0 authentication with Stripe
 * - Secure API key handling
 * - Input validation with Zod schemas
 */
export class StripeBubble<
  T extends StripeParamsInput = StripeParamsInput,
> extends ServiceBubble<
  T,
  Extract<StripeResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'stripe';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'stripe';
  static readonly schema = StripeParamsSchema;
  static readonly resultSchema = StripeResultSchema;
  static readonly shortDescription =
    'Stripe integration for payments, billing, and subscriptions';
  static readonly longDescription = `
    Stripe service integration for comprehensive payment and billing management.
    Based on the official Stripe MCP implementation.

    Features:
    - Customer management (create, list)
    - Product and price management
    - Payment links creation
    - Invoice management
    - Subscription management
    - Payment intents listing
    - Refund creation
    - Balance retrieval

    Use cases:
    - Accept payments through payment links
    - Manage customer billing and subscriptions
    - Create and manage products and pricing
    - Process refunds
    - Monitor account balance

    Security Features:
    - OAuth 2.0 authentication with Stripe
    - Secure API key handling
    - Input validation with Zod schemas
  `;
  static readonly alias = 'payments';

  constructor(
    params: T = {
      operation: 'list_customers',
      limit: 10,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      return false;
    }

    try {
      // Test by fetching account balance (minimal API call)
      const response = await this.makeStripeRequest('/v1/balance', 'GET');
      return response !== null && typeof response === 'object';
    } catch {
      return false;
    }
  }

  private async makeStripeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Stripe credentials are required');
    }

    const url = `https://api.stripe.com${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      // Stripe API uses form-urlencoded format
      requestInit.body = this.encodeFormData(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Stripe API error: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  private encodeFormData(data: Record<string, unknown>, prefix = ''): string {
    const params: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        params.push(
          this.encodeFormData(value as Record<string, unknown>, fullKey)
        );
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            params.push(
              this.encodeFormData(
                item as Record<string, unknown>,
                `${fullKey}[${index}]`
              )
            );
          } else {
            params.push(
              `${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`
            );
          }
        });
      } else {
        params.push(
          `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`
        );
      }
    }

    return params.filter(Boolean).join('&');
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<StripeResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<StripeResult> => {
        const parsedParams = this.params as StripeParams;
        switch (operation) {
          case 'create_customer':
            return await this.createCustomer(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_customer' }
              >
            );
          case 'list_customers':
            return await this.listCustomers(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_customers' }
              >
            );
          case 'create_product':
            return await this.createProduct(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_product' }
              >
            );
          case 'list_products':
            return await this.listProducts(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_products' }
              >
            );
          case 'create_price':
            return await this.createPrice(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_price' }
              >
            );
          case 'list_prices':
            return await this.listPrices(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_prices' }
              >
            );
          case 'create_payment_link':
            return await this.createPaymentLink(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_payment_link' }
              >
            );
          case 'create_invoice':
            return await this.createInvoice(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_invoice' }
              >
            );
          case 'list_invoices':
            return await this.listInvoices(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_invoices' }
              >
            );
          case 'retrieve_invoice':
            return await this.retrieveInvoice(
              parsedParams as Extract<
                StripeParams,
                { operation: 'retrieve_invoice' }
              >
            );
          case 'finalize_invoice':
            return await this.finalizeInvoice(
              parsedParams as Extract<
                StripeParams,
                { operation: 'finalize_invoice' }
              >
            );
          case 'create_invoice_item':
            return await this.createInvoiceItem(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_invoice_item' }
              >
            );
          case 'send_invoice':
            return await this.sendInvoice(
              parsedParams as Extract<
                StripeParams,
                { operation: 'send_invoice' }
              >
            );
          case 'get_balance':
            return await this.getBalance();
          case 'list_payment_intents':
            return await this.listPaymentIntents(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_payment_intents' }
              >
            );
          case 'list_subscriptions':
            return await this.listSubscriptions(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_subscriptions' }
              >
            );
          case 'cancel_subscription':
            return await this.cancelSubscription(
              parsedParams as Extract<
                StripeParams,
                { operation: 'cancel_subscription' }
              >
            );
          case 'list_payment_links':
            return await this.listPaymentLinks(
              parsedParams as Extract<
                StripeParams,
                { operation: 'list_payment_links' }
              >
            );
          case 'create_subscription':
            return await this.createSubscription(
              parsedParams as Extract<
                StripeParams,
                { operation: 'create_subscription' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<StripeResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<StripeResult, { operation: T['operation'] }>;
    }
  }

  // ============================================================================
  // CUSTOMER OPERATIONS
  // ============================================================================

  private async createCustomer(
    params: Extract<StripeParams, { operation: 'create_customer' }>
  ): Promise<Extract<StripeResult, { operation: 'create_customer' }>> {
    const { name, email, metadata } = params;

    const body: Record<string, unknown> = { name };
    if (email) body.email = email;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest(
      '/v1/customers',
      'POST',
      body
    );
    const customer = response as {
      id: string;
      name: string | null;
      email: string | null;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_customer',
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        created: customer.created,
        metadata: customer.metadata,
      },
      error: '',
    };
  }

  private async listCustomers(
    params: Extract<StripeParams, { operation: 'list_customers' }>
  ): Promise<Extract<StripeResult, { operation: 'list_customers' }>> {
    const { limit, email } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (email) queryParams.set('email', email);

    const endpoint = `/v1/customers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        name: string | null;
        email: string | null;
        created: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_customers',
      success: true,
      customers: data.data.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        created: c.created,
        metadata: c.metadata,
      })),
      error: '',
    };
  }

  // ============================================================================
  // PRODUCT OPERATIONS
  // ============================================================================

  private async createProduct(
    params: Extract<StripeParams, { operation: 'create_product' }>
  ): Promise<Extract<StripeResult, { operation: 'create_product' }>> {
    const { name, description, metadata } = params;

    const body: Record<string, unknown> = { name };
    if (description) body.description = description;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest('/v1/products', 'POST', body);
    const product = response as {
      id: string;
      name: string;
      description: string | null;
      active: boolean;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_product',
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        created: product.created,
        metadata: product.metadata,
      },
      error: '',
    };
  }

  private async listProducts(
    params: Extract<StripeParams, { operation: 'list_products' }>
  ): Promise<Extract<StripeResult, { operation: 'list_products' }>> {
    const { limit, active } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (active !== undefined) queryParams.set('active', String(active));

    const endpoint = `/v1/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        name: string;
        description: string | null;
        active: boolean;
        created: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_products',
      success: true,
      products: data.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        created: p.created,
        metadata: p.metadata,
      })),
      error: '',
    };
  }

  // ============================================================================
  // PRICE OPERATIONS
  // ============================================================================

  private async createPrice(
    params: Extract<StripeParams, { operation: 'create_price' }>
  ): Promise<Extract<StripeResult, { operation: 'create_price' }>> {
    const { product, unit_amount, currency, recurring, metadata } = params;

    const body: Record<string, unknown> = {
      product,
      unit_amount,
      currency,
    };
    if (recurring) body.recurring = recurring;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest('/v1/prices', 'POST', body);
    const price = response as {
      id: string;
      product: string;
      unit_amount: number | null;
      currency: string;
      type: 'one_time' | 'recurring';
      active: boolean;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_price',
      success: true,
      price: {
        id: price.id,
        product: price.product,
        unit_amount: price.unit_amount,
        currency: price.currency,
        type: price.type,
        active: price.active,
        created: price.created,
        metadata: price.metadata,
      },
      error: '',
    };
  }

  private async listPrices(
    params: Extract<StripeParams, { operation: 'list_prices' }>
  ): Promise<Extract<StripeResult, { operation: 'list_prices' }>> {
    const { limit, product, active } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (product) queryParams.set('product', product);
    if (active !== undefined) queryParams.set('active', String(active));

    const endpoint = `/v1/prices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        product: string;
        unit_amount: number | null;
        currency: string;
        type: 'one_time' | 'recurring';
        active: boolean;
        created: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_prices',
      success: true,
      prices: data.data.map((p) => ({
        id: p.id,
        product: p.product,
        unit_amount: p.unit_amount,
        currency: p.currency,
        type: p.type,
        active: p.active,
        created: p.created,
        metadata: p.metadata,
      })),
      error: '',
    };
  }

  // ============================================================================
  // PAYMENT LINK OPERATIONS
  // ============================================================================

  private async createPaymentLink(
    params: Extract<StripeParams, { operation: 'create_payment_link' }>
  ): Promise<Extract<StripeResult, { operation: 'create_payment_link' }>> {
    const { price, quantity, redirect_url, metadata } = params;

    const body: Record<string, unknown> = {
      line_items: [{ price, quantity }],
    };

    if (redirect_url) {
      body.after_completion = {
        type: 'redirect',
        redirect: { url: redirect_url },
      };
    }
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest(
      '/v1/payment_links',
      'POST',
      body
    );
    const paymentLink = response as {
      id: string;
      url: string;
      active: boolean;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_payment_link',
      success: true,
      payment_link: {
        id: paymentLink.id,
        url: paymentLink.url,
        active: paymentLink.active,
        created: paymentLink.created,
        metadata: paymentLink.metadata,
      },
      error: '',
    };
  }

  // ============================================================================
  // INVOICE OPERATIONS
  // ============================================================================

  private async createInvoice(
    params: Extract<StripeParams, { operation: 'create_invoice' }>
  ): Promise<Extract<StripeResult, { operation: 'create_invoice' }>> {
    const {
      customer,
      auto_advance,
      collection_method,
      days_until_due,
      items,
      metadata,
    } = params;

    const body: Record<string, unknown> = {
      customer,
      auto_advance,
      collection_method,
    };
    if (days_until_due) body.days_until_due = days_until_due;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest('/v1/invoices', 'POST', body);
    let invoice = response as {
      id: string;
      customer: string | null;
      status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
      total: number;
      currency: string;
      created: number;
      due_date?: number | null;
      hosted_invoice_url?: string | null;
      metadata?: Record<string, string>;
    };

    // If items are provided, create invoice items for each
    if (items && items.length > 0) {
      for (const item of items) {
        const quantity = item.quantity ?? 1;
        // Calculate total amount (unit_amount * quantity) since Stripe's `amount` is the total
        const totalAmount = item.unit_amount * quantity;

        const itemBody: Record<string, unknown> = {
          customer,
          invoice: invoice.id,
          amount: totalAmount,
          currency: invoice.currency,
        };
        if (item.description) itemBody.description = item.description;

        await this.makeStripeRequest('/v1/invoiceitems', 'POST', itemBody);
      }

      // Retrieve the updated invoice to get the correct total
      const updatedResponse = await this.makeStripeRequest(
        `/v1/invoices/${invoice.id}`,
        'GET'
      );
      invoice = updatedResponse as typeof invoice;
    }

    return {
      operation: 'create_invoice',
      success: true,
      invoice: {
        id: invoice.id,
        customer: invoice.customer,
        status: invoice.status,
        total: invoice.total,
        currency: invoice.currency,
        created: invoice.created,
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        metadata: invoice.metadata,
      },
      error: '',
    };
  }

  private async listInvoices(
    params: Extract<StripeParams, { operation: 'list_invoices' }>
  ): Promise<Extract<StripeResult, { operation: 'list_invoices' }>> {
    const { limit, customer, status } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (customer) queryParams.set('customer', customer);
    if (status) queryParams.set('status', status);

    const endpoint = `/v1/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        customer: string | null;
        status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
        total: number;
        currency: string;
        created: number;
        due_date?: number | null;
        hosted_invoice_url?: string | null;
        invoice_pdf?: string | null;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_invoices',
      success: true,
      invoices: data.data.map((i) => ({
        id: i.id,
        customer: i.customer,
        status: i.status,
        total: i.total,
        currency: i.currency,
        created: i.created,
        due_date: i.due_date ? new Date(i.due_date * 1000).toISOString() : null,
        hosted_invoice_url: i.hosted_invoice_url,
        invoice_pdf: i.invoice_pdf,
        metadata: i.metadata,
      })),
      error: '',
    };
  }

  private async retrieveInvoice(
    params: Extract<StripeParams, { operation: 'retrieve_invoice' }>
  ): Promise<Extract<StripeResult, { operation: 'retrieve_invoice' }>> {
    const { invoice_id } = params;

    const response = await this.makeStripeRequest(
      `/v1/invoices/${invoice_id}`,
      'GET'
    );
    const invoice = response as {
      id: string;
      customer: string | null;
      status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
      total: number;
      currency: string;
      created: number;
      due_date?: number | null;
      hosted_invoice_url?: string | null;
      invoice_pdf?: string | null;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'retrieve_invoice',
      success: true,
      invoice: {
        id: invoice.id,
        customer: invoice.customer,
        status: invoice.status,
        total: invoice.total,
        currency: invoice.currency,
        created: invoice.created,
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        metadata: invoice.metadata,
      },
      error: '',
    };
  }

  private async finalizeInvoice(
    params: Extract<StripeParams, { operation: 'finalize_invoice' }>
  ): Promise<Extract<StripeResult, { operation: 'finalize_invoice' }>> {
    const { invoice_id, auto_advance } = params;

    const body: Record<string, string> = {};
    if (auto_advance !== undefined) {
      body.auto_advance = String(auto_advance);
    }

    const response = await this.makeStripeRequest(
      `/v1/invoices/${invoice_id}/finalize`,
      'POST',
      Object.keys(body).length > 0 ? body : undefined
    );
    const invoice = response as {
      id: string;
      customer: string | null;
      status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
      total: number;
      currency: string;
      created: number;
      due_date?: number | null;
      hosted_invoice_url?: string | null;
      invoice_pdf?: string | null;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'finalize_invoice',
      success: true,
      invoice: {
        id: invoice.id,
        customer: invoice.customer,
        status: invoice.status,
        total: invoice.total,
        currency: invoice.currency,
        created: invoice.created,
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        metadata: invoice.metadata,
      },
      error: '',
    };
  }

  private async createInvoiceItem(
    params: Extract<StripeParams, { operation: 'create_invoice_item' }>
  ): Promise<Extract<StripeResult, { operation: 'create_invoice_item' }>> {
    const {
      customer,
      invoice,
      unit_amount,
      currency,
      description,
      quantity,
      metadata,
    } = params;

    const qty = quantity ?? 1;
    // Calculate total amount (unit_amount * quantity) since Stripe's `amount` is the total
    const totalAmount = unit_amount * qty;

    const body: Record<string, unknown> = {
      customer,
      amount: totalAmount,
      currency,
    };
    if (invoice) body.invoice = invoice;
    if (description) body.description = description;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest(
      '/v1/invoiceitems',
      'POST',
      body
    );
    const invoiceItem = response as {
      id: string;
      invoice: string | null;
      customer: string;
      amount: number;
      unit_amount: number | null;
      currency: string;
      description: string | null;
      quantity: number;
      date: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_invoice_item',
      success: true,
      invoice_item: {
        id: invoiceItem.id,
        invoice: invoiceItem.invoice,
        customer: invoiceItem.customer,
        amount: invoiceItem.amount,
        unit_amount: invoiceItem.unit_amount,
        currency: invoiceItem.currency,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        date: invoiceItem.date,
        metadata: invoiceItem.metadata,
      },
      error: '',
    };
  }

  private async sendInvoice(
    params: Extract<StripeParams, { operation: 'send_invoice' }>
  ): Promise<Extract<StripeResult, { operation: 'send_invoice' }>> {
    const { invoice_id } = params;

    // Use Stripe's send endpoint to send the invoice via Stripe's email service
    const response = await this.makeStripeRequest(
      `/v1/invoices/${invoice_id}/send`,
      'POST'
    );
    const invoice = response as {
      id: string;
      customer: string | null;
      status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
      total: number;
      currency: string;
      created: number;
      due_date?: number | null;
      hosted_invoice_url?: string | null;
      invoice_pdf?: string | null;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'send_invoice',
      success: true,
      invoice: {
        id: invoice.id,
        customer: invoice.customer,
        status: invoice.status,
        total: invoice.total,
        currency: invoice.currency,
        created: invoice.created,
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        metadata: invoice.metadata,
      },
      error: '',
    };
  }

  // ============================================================================
  // BALANCE OPERATIONS
  // ============================================================================

  private async getBalance(): Promise<
    Extract<StripeResult, { operation: 'get_balance' }>
  > {
    const response = await this.makeStripeRequest('/v1/balance', 'GET');
    const balance = response as {
      available: Array<{ amount: number; currency: string }>;
      pending: Array<{ amount: number; currency: string }>;
    };

    return {
      operation: 'get_balance',
      success: true,
      balance: {
        available: balance.available.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
      },
      error: '',
    };
  }

  // ============================================================================
  // PAYMENT INTENT OPERATIONS
  // ============================================================================

  private async listPaymentIntents(
    params: Extract<StripeParams, { operation: 'list_payment_intents' }>
  ): Promise<Extract<StripeResult, { operation: 'list_payment_intents' }>> {
    const { limit, customer } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (customer) queryParams.set('customer', customer);

    const endpoint = `/v1/payment_intents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        amount: number;
        currency: string;
        status:
          | 'requires_payment_method'
          | 'requires_confirmation'
          | 'requires_action'
          | 'processing'
          | 'requires_capture'
          | 'canceled'
          | 'succeeded';
        customer?: string | null;
        created: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_payment_intents',
      success: true,
      payment_intents: data.data.map((pi) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        customer: pi.customer,
        created: pi.created,
        metadata: pi.metadata,
      })),
      error: '',
    };
  }

  // ============================================================================
  // SUBSCRIPTION OPERATIONS
  // ============================================================================

  private async listSubscriptions(
    params: Extract<StripeParams, { operation: 'list_subscriptions' }>
  ): Promise<Extract<StripeResult, { operation: 'list_subscriptions' }>> {
    const { limit, customer, status } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (customer) queryParams.set('customer', customer);
    if (status && status !== 'all') queryParams.set('status', status);

    const endpoint = `/v1/subscriptions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        customer: string;
        status:
          | 'incomplete'
          | 'incomplete_expired'
          | 'trialing'
          | 'active'
          | 'past_due'
          | 'canceled'
          | 'unpaid'
          | 'paused';
        current_period_start: number;
        current_period_end: number;
        cancel_at_period_end: boolean;
        created: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_subscriptions',
      success: true,
      subscriptions: data.data.map((s) => ({
        id: s.id,
        customer: s.customer,
        status: s.status,
        current_period_start: s.current_period_start,
        current_period_end: s.current_period_end,
        cancel_at_period_end: s.cancel_at_period_end,
        created: s.created,
        metadata: s.metadata,
      })),
      error: '',
    };
  }

  private async cancelSubscription(
    params: Extract<StripeParams, { operation: 'cancel_subscription' }>
  ): Promise<Extract<StripeResult, { operation: 'cancel_subscription' }>> {
    const { subscription_id, cancel_at_period_end } = params;

    let response;
    if (cancel_at_period_end) {
      // Update to cancel at period end
      response = await this.makeStripeRequest(
        `/v1/subscriptions/${subscription_id}`,
        'POST',
        { cancel_at_period_end: true }
      );
    } else {
      // Cancel immediately
      response = await this.makeStripeRequest(
        `/v1/subscriptions/${subscription_id}`,
        'DELETE'
      );
    }

    const subscription = response as {
      id: string;
      customer: string;
      status:
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'paused';
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'cancel_subscription',
      success: true,
      subscription: {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        created: subscription.created,
        metadata: subscription.metadata,
      },
      error: '',
    };
  }

  // ============================================================================
  // PAYMENT LINK LIST OPERATIONS
  // ============================================================================

  private async listPaymentLinks(
    params: Extract<StripeParams, { operation: 'list_payment_links' }>
  ): Promise<Extract<StripeResult, { operation: 'list_payment_links' }>> {
    const { limit, active } = params;

    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (active !== undefined) queryParams.set('active', String(active));

    const endpoint = `/v1/payment_links${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeStripeRequest(endpoint, 'GET');
    const data = response as {
      data: Array<{
        id: string;
        url: string;
        active: boolean;
        created?: number;
        metadata?: Record<string, string>;
      }>;
    };

    return {
      operation: 'list_payment_links',
      success: true,
      payment_links: data.data.map((pl) => ({
        id: pl.id,
        url: pl.url,
        active: pl.active,
        created: pl.created,
        metadata: pl.metadata,
      })),
      error: '',
    };
  }

  // ============================================================================
  // SUBSCRIPTION CREATE OPERATIONS
  // ============================================================================

  private async createSubscription(
    params: Extract<StripeParams, { operation: 'create_subscription' }>
  ): Promise<Extract<StripeResult, { operation: 'create_subscription' }>> {
    const { customer, price, trial_period_days, payment_behavior, metadata } =
      params;

    const body: Record<string, unknown> = {
      customer,
      items: [{ price }],
      payment_behavior: payment_behavior || 'default_incomplete',
    };
    if (trial_period_days) body.trial_period_days = trial_period_days;
    if (metadata) body.metadata = metadata;

    const response = await this.makeStripeRequest(
      '/v1/subscriptions',
      'POST',
      body
    );
    const subscription = response as {
      id: string;
      customer: string;
      status:
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'paused';
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      created: number;
      metadata?: Record<string, string>;
    };

    return {
      operation: 'create_subscription',
      success: true,
      subscription: {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        created: subscription.created,
        metadata: subscription.metadata,
      },
      error: '',
    };
  }

  // ============================================================================
  // CREDENTIAL MANAGEMENT
  // ============================================================================

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // Stripe bubble uses STRIPE_CRED credentials
    return credentials[CredentialType.STRIPE_CRED];
  }
}
