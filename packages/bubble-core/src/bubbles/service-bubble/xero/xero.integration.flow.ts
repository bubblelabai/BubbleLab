import {
  BubbleFlow,
  XeroBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  contactId: string;
  invoiceId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class XeroIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let contactId = '';
    let invoiceId = '';

    // ===== ACCOUNT TESTS =====

    // 1. List accounts
    try {
      const listAccounts = await new XeroBubble({
        operation: 'list_accounts',
      }).action();

      results.push({
        operation: 'list_accounts',
        success: listAccounts.success,
        details: listAccounts.success
          ? `Found ${listAccounts.data?.accounts?.length || 0} accounts`
          : listAccounts.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_accounts',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== CONTACT TESTS =====

    // 2. Create contact with edge case characters
    try {
      const createContact = await new XeroBubble({
        operation: 'create_contact',
        name: `Test O'Brien \u00e9l\u00e8ve ${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        first_name: 'Test',
        last_name: "O'Brien",
        phone: '+1-555-0123',
      }).action();

      contactId = createContact.data?.contact?.ContactID || '';
      results.push({
        operation: 'create_contact',
        success: createContact.success,
        details: createContact.success
          ? `Created contact: ${contactId}`
          : createContact.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_contact',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Get contact
    if (contactId) {
      try {
        const getContact = await new XeroBubble({
          operation: 'get_contact',
          contact_id: contactId,
        }).action();

        results.push({
          operation: 'get_contact',
          success: getContact.success,
          details: getContact.success
            ? `Retrieved contact: ${getContact.data?.contact?.Name}`
            : getContact.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_contact',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 4. List contacts
    try {
      const listContacts = await new XeroBubble({
        operation: 'list_contacts',
        page: 1,
      }).action();

      results.push({
        operation: 'list_contacts',
        success: listContacts.success,
        details: listContacts.success
          ? `Found ${listContacts.data?.contacts?.length || 0} contacts`
          : listContacts.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_contacts',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== INVOICE TESTS =====

    // 5. Create invoice (using created contact if available)
    if (contactId) {
      try {
        const createInvoice = await new XeroBubble({
          operation: 'create_invoice',
          type: 'ACCREC',
          contact_id: contactId,
          line_items: [
            {
              Description: `Integration test item ${Date.now()}`,
              Quantity: 2,
              UnitAmount: 49.99,
              AccountCode: '200',
            },
            {
              Description: 'Special chars test: \u00e9\u00e0\u00fc\u00f1',
              Quantity: 1,
              UnitAmount: 25.0,
            },
          ],
          reference: `TEST-${Date.now()}`,
          status: 'DRAFT',
        }).action();

        invoiceId = createInvoice.data?.invoice?.InvoiceID || '';
        results.push({
          operation: 'create_invoice',
          success: createInvoice.success,
          details: createInvoice.success
            ? `Created invoice: ${invoiceId} (${createInvoice.data?.invoice?.InvoiceNumber})`
            : createInvoice.error,
        });
      } catch (error) {
        results.push({
          operation: 'create_invoice',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 6. Get invoice
    if (invoiceId) {
      try {
        const getInvoice = await new XeroBubble({
          operation: 'get_invoice',
          invoice_id: invoiceId,
        }).action();

        results.push({
          operation: 'get_invoice',
          success: getInvoice.success,
          details: getInvoice.success
            ? `Retrieved invoice: ${getInvoice.data?.invoice?.InvoiceNumber} (Total: ${getInvoice.data?.invoice?.Total})`
            : getInvoice.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_invoice',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 7. List invoices (with status filter)
    try {
      const listInvoices = await new XeroBubble({
        operation: 'list_invoices',
        status: 'DRAFT',
        page: 1,
      }).action();

      results.push({
        operation: 'list_invoices',
        success: listInvoices.success,
        details: listInvoices.success
          ? `Found ${listInvoices.data?.invoices?.length || 0} draft invoices`
          : listInvoices.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_invoices',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      contactId,
      invoiceId,
      testResults: results,
    };
  }
}
