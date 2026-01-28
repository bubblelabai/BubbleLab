import {
  BubbleFlow,
  StripeBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  customerId: string;
  productId: string;
  priceId: string;
  recurringPriceId: string;
  paymentLinkId: string;
  invoiceId: string;
  subscriptionId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Stripe Integration Test workflow.
 */
export interface StripeIntegrationTestPayload extends WebhookEvent {
  /**
   * Optional prefix for test resources to help identify them.
   * @canBeFile false
   */
  testPrefix?: string;
}

/**
 * Stripe Integration Test Flow
 *
 * Tests all major Stripe operations end-to-end with verification:
 * 1. Create a customer → verify in list_customers
 * 2. Create a product → verify in list_products
 * 3. Create a one-time price → verify in list_prices
 * 4. Create a recurring price (for subscription) → verify in list_prices
 * 5. Create a payment link → verify in list_payment_links
 * 6. Create an invoice → verify in list_invoices → finalize_invoice → retrieve_invoice (get PDF URL)
 * 7. Create a subscription → verify in list_subscriptions
 * 8. Cancel subscription → verify status changed
 * 9. Get account balance
 * 10. List payment intents
 */
export class StripeIntegrationTest extends BubbleFlow<'webhook/http'> {
  // ============================================================================
  // CUSTOMER OPERATIONS
  // ============================================================================

  private async createTestCustomer(name: string, email: string) {
    const result = await new StripeBubble({
      operation: 'create_customer',
      name,
      email,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_customer' ||
      !result.data.customer
    ) {
      throw new Error(`Failed to create customer: ${result.error}`);
    }

    return result.data.customer;
  }

  private async listCustomers(limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_customers',
      limit,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_customers' ||
      !result.data.customers
    ) {
      throw new Error(`Failed to list customers: ${result.error}`);
    }

    return result.data.customers;
  }

  // ============================================================================
  // PRODUCT OPERATIONS
  // ============================================================================

  private async createTestProduct(name: string, description: string) {
    const result = await new StripeBubble({
      operation: 'create_product',
      name,
      description,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_product' ||
      !result.data.product
    ) {
      throw new Error(`Failed to create product: ${result.error}`);
    }

    return result.data.product;
  }

  private async listProducts(limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_products',
      limit,
      active: true,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_products' ||
      !result.data.products
    ) {
      throw new Error(`Failed to list products: ${result.error}`);
    }

    return result.data.products;
  }

  // ============================================================================
  // PRICE OPERATIONS
  // ============================================================================

  private async createTestPrice(
    productId: string,
    unitAmount: number,
    currency: string = 'usd',
    recurring?: { interval: 'day' | 'week' | 'month' | 'year' }
  ) {
    const result = await new StripeBubble({
      operation: 'create_price',
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_price' ||
      !result.data.price
    ) {
      throw new Error(`Failed to create price: ${result.error}`);
    }

    return result.data.price;
  }

  private async listPrices(productId?: string, limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_prices',
      limit,
      product: productId,
      active: true,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_prices' ||
      !result.data.prices
    ) {
      throw new Error(`Failed to list prices: ${result.error}`);
    }

    return result.data.prices;
  }

  // ============================================================================
  // PAYMENT LINK OPERATIONS
  // ============================================================================

  private async createTestPaymentLink(priceId: string, quantity: number = 1) {
    const result = await new StripeBubble({
      operation: 'create_payment_link',
      price: priceId,
      quantity,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_payment_link' ||
      !result.data.payment_link
    ) {
      throw new Error(`Failed to create payment link: ${result.error}`);
    }

    return result.data.payment_link;
  }

  private async listPaymentLinks(limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_payment_links',
      limit,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_payment_links' ||
      !result.data.payment_links
    ) {
      throw new Error(`Failed to list payment links: ${result.error}`);
    }

    return result.data.payment_links;
  }

  // ============================================================================
  // INVOICE OPERATIONS
  // ============================================================================

  private async createTestInvoice(customerId: string) {
    const result = await new StripeBubble({
      operation: 'create_invoice',
      customer: customerId,
      auto_advance: false,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to create invoice: ${result.error}`);
    }

    return result.data.invoice;
  }

  private async listInvoices(customerId?: string, limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_invoices',
      limit,
      customer: customerId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_invoices' ||
      !result.data.invoices
    ) {
      throw new Error(`Failed to list invoices: ${result.error}`);
    }

    return result.data.invoices;
  }

  private async retrieveTestInvoice(invoiceId: string) {
    const result = await new StripeBubble({
      operation: 'retrieve_invoice',
      invoice_id: invoiceId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'retrieve_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to retrieve invoice: ${result.error}`);
    }

    return result.data.invoice;
  }

  private async finalizeTestInvoice(invoiceId: string) {
    const result = await new StripeBubble({
      operation: 'finalize_invoice',
      invoice_id: invoiceId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'finalize_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to finalize invoice: ${result.error}`);
    }

    return result.data.invoice;
  }

  // ============================================================================
  // SUBSCRIPTION OPERATIONS
  // ============================================================================

  private async createTestSubscription(customerId: string, priceId: string) {
    const result = await new StripeBubble({
      operation: 'create_subscription',
      customer: customerId,
      price: priceId,
      metadata: { test: 'integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_subscription' ||
      !result.data.subscription
    ) {
      throw new Error(`Failed to create subscription: ${result.error}`);
    }

    return result.data.subscription;
  }

  private async listSubscriptions(customerId?: string, limit: number = 10) {
    const result = await new StripeBubble({
      operation: 'list_subscriptions',
      limit,
      customer: customerId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_subscriptions' ||
      !result.data.subscriptions
    ) {
      throw new Error(`Failed to list subscriptions: ${result.error}`);
    }

    return result.data.subscriptions;
  }

  private async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = false
  ) {
    const result = await new StripeBubble({
      operation: 'cancel_subscription',
      subscription_id: subscriptionId,
      cancel_at_period_end: atPeriodEnd,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'cancel_subscription' ||
      !result.data.subscription
    ) {
      throw new Error(`Failed to cancel subscription: ${result.error}`);
    }

    return result.data.subscription;
  }

  // ============================================================================
  // BALANCE OPERATIONS
  // ============================================================================

  private async getAccountBalance() {
    const result = await new StripeBubble({
      operation: 'get_balance',
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'get_balance' ||
      !result.data.balance
    ) {
      throw new Error(`Failed to get balance: ${result.error}`);
    }

    return result.data.balance;
  }

  // ============================================================================
  // LISTING OPERATIONS
  // ============================================================================

  private async listPaymentIntents(limit: number = 5) {
    const result = await new StripeBubble({
      operation: 'list_payment_intents',
      limit,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_payment_intents' ||
      !result.data.payment_intents
    ) {
      throw new Error(`Failed to list payment intents: ${result.error}`);
    }

    return result.data.payment_intents;
  }

  // ============================================================================
  // MAIN FLOW
  // ============================================================================

  async handle(payload: StripeIntegrationTestPayload): Promise<Output> {
    const { testPrefix = 'BubbleLab Test' } = payload;
    const results: Output['testResults'] = [];
    const timestamp = Date.now();

    let customerId = '';
    let productId = '';
    let priceId = '';
    let recurringPriceId = '';
    let paymentLinkId = '';
    let invoiceId = '';
    let subscriptionId = '';

    // ========================================================================
    // 1. CUSTOMER: Create and verify
    // ========================================================================
    try {
      const customer = await this.createTestCustomer(
        `${testPrefix} Customer - ${timestamp}`,
        `test-${timestamp}@bubblelab.test`
      );
      customerId = customer.id;
      results.push({
        operation: 'create_customer',
        success: true,
        details: `Created customer: ${customer.id}`,
      });

      // Verify in list
      const customers = await this.listCustomers(10);
      const found = customers.find((c) => c.id === customerId);
      results.push({
        operation: 'list_customers (verify)',
        success: !!found,
        details: found
          ? `Verified: customer ${customerId} found in list`
          : `FAILED: customer ${customerId} not found in list`,
      });
    } catch (error) {
      results.push({
        operation: 'create_customer',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 2. PRODUCT: Create and verify
    // ========================================================================
    try {
      const product = await this.createTestProduct(
        `${testPrefix} Product - ${timestamp}`,
        `Integration test product`
      );
      productId = product.id;
      results.push({
        operation: 'create_product',
        success: true,
        details: `Created product: ${product.id}`,
      });

      // Verify in list
      const products = await this.listProducts(10);
      const found = products.find((p) => p.id === productId);
      results.push({
        operation: 'list_products (verify)',
        success: !!found,
        details: found
          ? `Verified: product ${productId} found in list`
          : `FAILED: product ${productId} not found in list`,
      });
    } catch (error) {
      results.push({
        operation: 'create_product',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 3. PRICE (one-time): Create and verify
    // ========================================================================
    if (productId) {
      try {
        const price = await this.createTestPrice(productId, 1999, 'usd');
        priceId = price.id;
        results.push({
          operation: 'create_price (one-time)',
          success: true,
          details: `Created price: ${price.id} ($${(price.unit_amount || 0) / 100})`,
        });

        // Verify in list
        const prices = await this.listPrices(productId, 10);
        const found = prices.find((p) => p.id === priceId);
        results.push({
          operation: 'list_prices (verify one-time)',
          success: !!found,
          details: found
            ? `Verified: price ${priceId} found in list`
            : `FAILED: price ${priceId} not found in list`,
        });
      } catch (error) {
        results.push({
          operation: 'create_price (one-time)',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 4. PRICE (recurring): Create for subscription testing
    // ========================================================================
    if (productId) {
      try {
        const price = await this.createTestPrice(productId, 999, 'usd', {
          interval: 'month',
        });
        recurringPriceId = price.id;
        results.push({
          operation: 'create_price (recurring)',
          success: true,
          details: `Created recurring price: ${price.id} ($${(price.unit_amount || 0) / 100}/month)`,
        });

        // Verify in list
        const prices = await this.listPrices(productId, 10);
        const found = prices.find((p) => p.id === recurringPriceId);
        results.push({
          operation: 'list_prices (verify recurring)',
          success: !!found,
          details: found
            ? `Verified: recurring price ${recurringPriceId} found in list`
            : `FAILED: recurring price ${recurringPriceId} not found in list`,
        });
      } catch (error) {
        results.push({
          operation: 'create_price (recurring)',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 5. PAYMENT LINK: Create and verify
    // ========================================================================
    if (priceId) {
      try {
        const paymentLink = await this.createTestPaymentLink(priceId, 1);
        paymentLinkId = paymentLink.id;
        results.push({
          operation: 'create_payment_link',
          success: true,
          details: `Created payment link: ${paymentLink.id}`,
        });

        // Verify in list
        const paymentLinks = await this.listPaymentLinks(10);
        const found = paymentLinks.find((pl) => pl.id === paymentLinkId);
        results.push({
          operation: 'list_payment_links (verify)',
          success: !!found,
          details: found
            ? `Verified: payment link ${paymentLinkId} found in list`
            : `FAILED: payment link ${paymentLinkId} not found in list`,
        });
      } catch (error) {
        results.push({
          operation: 'create_payment_link',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 6. INVOICE: Create, verify, finalize, and retrieve with PDF
    // ========================================================================
    if (customerId) {
      try {
        const invoice = await this.createTestInvoice(customerId);
        invoiceId = invoice.id;
        results.push({
          operation: 'create_invoice',
          success: true,
          details: `Created invoice: ${invoice.id} (status: ${invoice.status}, due: ${invoice.due_date ?? 'N/A'})`,
        });

        // Verify in list
        const invoices = await this.listInvoices(customerId, 10);
        const found = invoices.find((i) => i.id === invoiceId);
        results.push({
          operation: 'list_invoices (verify)',
          success: !!found,
          details: found
            ? `Verified: invoice ${invoiceId} found in list`
            : `FAILED: invoice ${invoiceId} not found in list`,
        });

        // Finalize the invoice to generate PDF URL
        const finalizedInvoice = await this.finalizeTestInvoice(invoiceId);
        results.push({
          operation: 'finalize_invoice',
          success: true,
          details: `Finalized invoice: ${finalizedInvoice.id} (status: ${finalizedInvoice.status}, due: ${finalizedInvoice.due_date ?? 'N/A'})`,
        });

        // Retrieve invoice to get full details including PDF URL
        const retrievedInvoice = await this.retrieveTestInvoice(invoiceId);
        results.push({
          operation: 'retrieve_invoice',
          success: true,
          details: `Retrieved invoice: ${retrievedInvoice.id} | Due: ${retrievedInvoice.due_date ?? 'N/A'} | PDF: ${retrievedInvoice.invoice_pdf ?? 'N/A'} | Hosted URL: ${retrievedInvoice.hosted_invoice_url ?? 'N/A'}`,
        });
      } catch (error) {
        results.push({
          operation: 'create_invoice',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 7. SUBSCRIPTION: Create and verify
    // ========================================================================
    if (customerId && recurringPriceId) {
      try {
        const subscription = await this.createTestSubscription(
          customerId,
          recurringPriceId
        );
        subscriptionId = subscription.id;
        results.push({
          operation: 'create_subscription',
          success: true,
          details: `Created subscription: ${subscription.id} (status: ${subscription.status})`,
        });

        // Verify in list
        const subscriptions = await this.listSubscriptions(customerId, 10);
        const found = subscriptions.find((s) => s.id === subscriptionId);
        results.push({
          operation: 'list_subscriptions (verify)',
          success: !!found,
          details: found
            ? `Verified: subscription ${subscriptionId} found in list (status: ${found.status})`
            : `FAILED: subscription ${subscriptionId} not found in list`,
        });
      } catch (error) {
        results.push({
          operation: 'create_subscription',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 8. CANCEL SUBSCRIPTION: Cancel and verify status
    // ========================================================================
    if (subscriptionId) {
      try {
        const canceled = await this.cancelSubscription(subscriptionId, false);
        results.push({
          operation: 'cancel_subscription',
          success: true,
          details: `Canceled subscription: ${canceled.id} (status: ${canceled.status})`,
        });

        // Verify status changed in list
        const subscriptions = await this.listSubscriptions(customerId, 10);
        const found = subscriptions.find((s) => s.id === subscriptionId);
        results.push({
          operation: 'list_subscriptions (verify canceled)',
          success: found?.status === 'canceled',
          details: found
            ? `Verified: subscription status is '${found.status}'`
            : `FAILED: subscription ${subscriptionId} not found`,
        });
      } catch (error) {
        results.push({
          operation: 'cancel_subscription',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 9. GET BALANCE
    // ========================================================================
    try {
      const balance = await this.getAccountBalance();
      const availableTotal = balance.available.reduce(
        (sum, b) => sum + b.amount,
        0
      );
      const pendingTotal = balance.pending.reduce(
        (sum, b) => sum + b.amount,
        0
      );
      results.push({
        operation: 'get_balance',
        success: true,
        details: `Available: ${availableTotal}, Pending: ${pendingTotal}`,
      });
    } catch (error) {
      results.push({
        operation: 'get_balance',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 10. LIST PAYMENT INTENTS
    // ========================================================================
    try {
      const paymentIntents = await this.listPaymentIntents(5);
      results.push({
        operation: 'list_payment_intents',
        success: true,
        details: `Listed ${paymentIntents.length} payment intents`,
      });
    } catch (error) {
      results.push({
        operation: 'list_payment_intents',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      customerId,
      productId,
      priceId,
      recurringPriceId,
      paymentLinkId,
      invoiceId,
      subscriptionId,
      testResults: results,
    };
  }
}
