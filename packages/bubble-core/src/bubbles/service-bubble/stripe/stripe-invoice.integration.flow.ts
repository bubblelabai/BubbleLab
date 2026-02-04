import {
  BubbleFlow,
  StripeBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  customerId: string;
  invoiceWithItemsId: string;
  invoiceForItemTestId: string;
  invoiceItemId: string;
  sentInvoiceId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Stripe Invoice Integration Test workflow.
 */
export interface StripeInvoiceIntegrationTestPayload extends WebhookEvent {
  /**
   * Optional prefix for test resources to help identify them.
   * @canBeFile false
   */
  testPrefix?: string;

  /**
   * Email to send the test invoice to.
   * @canBeFile false
   */
  recipientEmail?: string;
}

/**
 * Stripe Invoice Integration Test Flow
 *
 * Tests the new invoice-related operations:
 * 1. Create a customer with test email
 * 2. Create invoice WITH items array (new feature) → verify total includes items
 * 3. Create a separate invoice for standalone item testing
 * 4. Create invoice item standalone (new operation) → verify attached to invoice
 * 5. Finalize the invoice with items
 * 6. Send invoice via Stripe email (new operation) → sends to test customer
 */
export class StripeInvoiceIntegrationTest extends BubbleFlow<'webhook/http'> {
  // ============================================================================
  // CUSTOMER OPERATIONS
  // ============================================================================

  private async createTestCustomer(name: string, email: string) {
    const result = await new StripeBubble({
      operation: 'create_customer',
      name,
      email,
      metadata: { test: 'invoice-integration-flow', created_by: 'bubblelab' },
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

  // ============================================================================
  // INVOICE OPERATIONS
  // ============================================================================

  private async createInvoiceWithItems(
    customerId: string,
    items: Array<{
      unit_amount: number;
      description?: string;
      quantity?: number;
    }>
  ) {
    const result = await new StripeBubble({
      operation: 'create_invoice',
      customer: customerId,
      auto_advance: false,
      collection_method: 'send_invoice',
      days_until_due: 30,
      items,
      metadata: { test: 'invoice-integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to create invoice with items: ${result.error}`);
    }

    return result.data.invoice;
  }

  private async createEmptyInvoice(customerId: string) {
    const result = await new StripeBubble({
      operation: 'create_invoice',
      customer: customerId,
      auto_advance: false,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: {
        test: 'invoice-integration-flow-item-test',
        created_by: 'bubblelab',
      },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to create empty invoice: ${result.error}`);
    }

    return result.data.invoice;
  }

  private async createInvoiceItem(
    customerId: string,
    invoiceId: string,
    unitAmount: number,
    description?: string
  ) {
    const result = await new StripeBubble({
      operation: 'create_invoice_item',
      customer: customerId,
      invoice: invoiceId,
      unit_amount: unitAmount,
      currency: 'usd',
      description,
      metadata: { test: 'invoice-integration-flow', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_invoice_item' ||
      !result.data.invoice_item
    ) {
      throw new Error(`Failed to create invoice item: ${result.error}`);
    }

    return result.data.invoice_item;
  }

  private async retrieveInvoice(invoiceId: string) {
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

  private async finalizeInvoice(invoiceId: string) {
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

  private async sendInvoice(invoiceId: string) {
    const result = await new StripeBubble({
      operation: 'send_invoice',
      invoice_id: invoiceId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'send_invoice' ||
      !result.data.invoice
    ) {
      throw new Error(`Failed to send invoice: ${result.error}`);
    }

    return result.data.invoice;
  }

  // ============================================================================
  // MAIN FLOW
  // ============================================================================

  async handle(payload: StripeInvoiceIntegrationTestPayload): Promise<Output> {
    const {
      testPrefix = 'BubbleLab Invoice Test',
      recipientEmail = 'zachzhong@bubblelab.ai',
    } = payload;
    const results: Output['testResults'] = [];
    const timestamp = Date.now();

    let customerId = '';
    let invoiceWithItemsId = '';
    let invoiceForItemTestId = '';
    let invoiceItemId = '';
    let sentInvoiceId = '';

    // ========================================================================
    // 1. CUSTOMER: Create test customer with recipient email
    // ========================================================================
    try {
      const customer = await this.createTestCustomer(
        `${testPrefix} Customer - ${timestamp}`,
        recipientEmail
      );
      customerId = customer.id;
      results.push({
        operation: 'create_customer',
        success: true,
        details: `Created customer: ${customer.id} (email: ${customer.email})`,
      });
    } catch (error) {
      results.push({
        operation: 'create_customer',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      // Can't continue without customer
      return {
        customerId,
        invoiceWithItemsId,
        invoiceForItemTestId,
        invoiceItemId,
        sentInvoiceId,
        testResults: results,
      };
    }

    // ========================================================================
    // 2. CREATE INVOICE WITH ITEMS ARRAY (New Feature)
    // ========================================================================
    try {
      const invoiceItems = [
        {
          unit_amount: 5000,
          description: 'Consulting services - January 2024',
        },
        { unit_amount: 2500, description: 'Setup fee' },
        { unit_amount: 1000, description: 'Support package', quantity: 2 },
      ];
      const expectedTotal = 5000 + 2500 + 1000 * 2; // 9500 cents = $95.00

      const invoice = await this.createInvoiceWithItems(
        customerId,
        invoiceItems
      );
      invoiceWithItemsId = invoice.id;

      const totalMatches = invoice.total === expectedTotal;
      results.push({
        operation: 'create_invoice (with items)',
        success: true,
        details: `Created invoice: ${invoice.id} | Total: $${invoice.total / 100} (expected: $${expectedTotal / 100}) | Items included: ${invoiceItems.length}`,
      });

      results.push({
        operation: 'verify_invoice_total',
        success: totalMatches,
        details: totalMatches
          ? `Invoice total ($${invoice.total / 100}) matches expected ($${expectedTotal / 100})`
          : `MISMATCH: Invoice total ($${invoice.total / 100}) != expected ($${expectedTotal / 100})`,
      });
    } catch (error) {
      results.push({
        operation: 'create_invoice (with items)',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 3. CREATE EMPTY INVOICE FOR STANDALONE ITEM TEST
    // ========================================================================
    try {
      const invoice = await this.createEmptyInvoice(customerId);
      invoiceForItemTestId = invoice.id;
      results.push({
        operation: 'create_invoice (empty for item test)',
        success: true,
        details: `Created empty invoice: ${invoice.id} | Total: $${invoice.total / 100}`,
      });
    } catch (error) {
      results.push({
        operation: 'create_invoice (empty for item test)',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 4. CREATE INVOICE ITEM STANDALONE (New Operation)
    // ========================================================================
    if (invoiceForItemTestId) {
      try {
        const invoiceItem = await this.createInvoiceItem(
          customerId,
          invoiceForItemTestId,
          3500,
          'Standalone line item - API consultation'
        );
        invoiceItemId = invoiceItem.id;
        results.push({
          operation: 'create_invoice_item',
          success: true,
          details: `Created invoice item: ${invoiceItem.id} | Amount: $${invoiceItem.amount / 100} | Invoice: ${invoiceItem.invoice}`,
        });

        // Verify the item is attached to the invoice by retrieving it
        const updatedInvoice = await this.retrieveInvoice(invoiceForItemTestId);
        const itemAttached = updatedInvoice.total === 3500;
        results.push({
          operation: 'verify_invoice_item_attached',
          success: itemAttached,
          details: itemAttached
            ? `Invoice total updated to $${updatedInvoice.total / 100} after adding item`
            : `FAILED: Invoice total is $${updatedInvoice.total / 100}, expected $35.00`,
        });
      } catch (error) {
        results.push({
          operation: 'create_invoice_item',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 5. FINALIZE INVOICE WITH ITEMS
    // ========================================================================
    if (invoiceWithItemsId) {
      try {
        const finalizedInvoice = await this.finalizeInvoice(invoiceWithItemsId);
        results.push({
          operation: 'finalize_invoice',
          success: finalizedInvoice.status === 'open',
          details: `Finalized invoice: ${finalizedInvoice.id} | Status: ${finalizedInvoice.status} | PDF: ${finalizedInvoice.invoice_pdf ?? 'N/A'}`,
        });
      } catch (error) {
        results.push({
          operation: 'finalize_invoice',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 6. SEND INVOICE VIA STRIPE EMAIL (New Operation)
    // ========================================================================
    if (invoiceWithItemsId) {
      try {
        const sentInvoice = await this.sendInvoice(invoiceWithItemsId);
        sentInvoiceId = sentInvoice.id;
        results.push({
          operation: 'send_invoice',
          success: true,
          details: `Sent invoice: ${sentInvoice.id} to ${recipientEmail} | Status: ${sentInvoice.status} | Hosted URL: ${sentInvoice.hosted_invoice_url ?? 'N/A'}`,
        });
      } catch (error) {
        results.push({
          operation: 'send_invoice',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    results.push({
      operation: 'SUMMARY',
      success: successCount === totalCount,
      details: `${successCount}/${totalCount} operations succeeded`,
    });

    return {
      customerId,
      invoiceWithItemsId,
      invoiceForItemTestId,
      invoiceItemId,
      sentInvoiceId,
      testResults: results,
    };
  }
}
