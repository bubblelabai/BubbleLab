import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  XeroParamsSchema,
  XeroResultSchema,
  type XeroParams,
  type XeroParamsInput,
  type XeroResult,
} from './xero.schema.js';

/**
 * Xero Accounting Service Bubble
 *
 * Xero accounting integration for managing invoices, contacts, and accounts.
 *
 * Features:
 * - Create, retrieve, and list invoices (sales and purchase)
 * - Create, retrieve, and list contacts (customers and suppliers)
 * - List chart of accounts
 *
 * Use cases:
 * - Invoice creation and management
 * - Customer and supplier contact management
 * - Financial reporting and account tracking
 *
 * Security Features:
 * - OAuth 2.0 authentication with Xero
 * - Scoped access permissions
 * - Secure credential handling with tenant isolation
 */
export class XeroBubble<
  T extends XeroParamsInput = XeroParamsInput,
> extends ServiceBubble<T, Extract<XeroResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'xero';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'xero';
  static readonly schema = XeroParamsSchema;
  static readonly resultSchema = XeroResultSchema;
  static readonly shortDescription =
    'Xero accounting integration for invoices, contacts, and accounts';
  static readonly longDescription = `
    Xero accounting service integration for financial management.

    Features:
    - Create, retrieve, and list invoices (accounts receivable and payable)
    - Create, retrieve, and list contacts (customers and suppliers)
    - List chart of accounts with filtering
    - Multi-tenant support for managing multiple Xero organizations

    Use cases:
    - Automated invoice creation and tracking
    - Customer and supplier contact management
    - Financial data synchronization and reporting
    - Accounts payable and receivable automation

    Security Features:
    - OAuth 2.0 authentication with Xero
    - Scoped access permissions for accounting operations
    - Tenant-isolated API access
    - Secure credential handling and validation
  `;
  static readonly alias = 'accounting';

  constructor(
    params: T = {
      operation: 'list_invoices',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Xero credentials are required');
    }

    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Organisation',
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Xero-Tenant-Id': creds.tenantId,
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Xero API error (${response.status}): ${text}`);
    }
    return true;
  }

  /**
   * Xero credential format:
   * Base64-encoded JSON: { accessToken, tenantId }
   * The tenantId identifies which Xero organization to access.
   */
  private parseCredentials(): {
    accessToken: string;
    tenantId: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const xeroCredRaw = credentials[CredentialType.XERO_CRED];
    if (!xeroCredRaw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        tenantId?: string;
      }>(xeroCredRaw);

      if (parsed.accessToken && parsed.tenantId) {
        return {
          accessToken: parsed.accessToken,
          tenantId: parsed.tenantId,
        };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token (validator path)
      // In this case, we can't make API calls without tenantId
    }

    return null;
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }

  private async makeXeroApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<any> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid Xero credentials. Expected base64-encoded JSON with { accessToken, tenantId }.'
      );
    }

    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://api.xero.com/api.xro/2.0${endpoint}`;

    const requestInit: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Xero-Tenant-Id': creds.tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<XeroResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<XeroResult> => {
        const parsedParams = this.params as XeroParams;
        switch (operation) {
          case 'create_invoice':
            return await this.createInvoice(
              parsedParams as Extract<
                XeroParams,
                { operation: 'create_invoice' }
              >
            );
          case 'get_invoice':
            return await this.getInvoice(
              parsedParams as Extract<XeroParams, { operation: 'get_invoice' }>
            );
          case 'list_invoices':
            return await this.listInvoices(
              parsedParams as Extract<
                XeroParams,
                { operation: 'list_invoices' }
              >
            );
          case 'create_contact':
            return await this.createContact(
              parsedParams as Extract<
                XeroParams,
                { operation: 'create_contact' }
              >
            );
          case 'get_contact':
            return await this.getContact(
              parsedParams as Extract<XeroParams, { operation: 'get_contact' }>
            );
          case 'list_contacts':
            return await this.listContacts(
              parsedParams as Extract<
                XeroParams,
                { operation: 'list_contacts' }
              >
            );
          case 'list_accounts':
            return await this.listAccounts(
              parsedParams as Extract<
                XeroParams,
                { operation: 'list_accounts' }
              >
            );
          case 'get_report':
            return await this.getReport(
              parsedParams as Extract<XeroParams, { operation: 'get_report' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<XeroResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<XeroResult, { operation: T['operation'] }>;
    }
  }

  private async createInvoice(
    params: Extract<XeroParams, { operation: 'create_invoice' }>
  ): Promise<Extract<XeroResult, { operation: 'create_invoice' }>> {
    const invoiceBody: Record<string, unknown> = {
      Type: params.type,
      Contact: { ContactID: params.contact_id },
      LineItems: params.line_items,
      Status: params.status || 'DRAFT',
    };

    if (params.date) invoiceBody.Date = params.date;
    if (params.due_date) invoiceBody.DueDate = params.due_date;
    if (params.reference) invoiceBody.Reference = params.reference;
    if (params.currency_code) invoiceBody.CurrencyCode = params.currency_code;

    const response = await this.makeXeroApiRequest(
      '/Invoices',
      'POST',
      invoiceBody
    );

    const invoice = response.Invoices?.[0];
    return {
      operation: 'create_invoice',
      success: true,
      invoice: invoice
        ? {
            InvoiceID: invoice.InvoiceID,
            InvoiceNumber: invoice.InvoiceNumber,
            Type: invoice.Type,
            Status: invoice.Status,
            Contact: invoice.Contact,
            Date: invoice.Date,
            DueDate: invoice.DueDate,
            Total: invoice.Total,
            AmountDue: invoice.AmountDue,
            AmountPaid: invoice.AmountPaid,
            CurrencyCode: invoice.CurrencyCode,
            Reference: invoice.Reference,
            LineItems: invoice.LineItems,
          }
        : undefined,
      error: '',
    };
  }

  private async getInvoice(
    params: Extract<XeroParams, { operation: 'get_invoice' }>
  ): Promise<Extract<XeroResult, { operation: 'get_invoice' }>> {
    const response = await this.makeXeroApiRequest(
      `/Invoices/${params.invoice_id}`
    );

    const invoice = response.Invoices?.[0];
    return {
      operation: 'get_invoice',
      success: true,
      invoice: invoice
        ? {
            InvoiceID: invoice.InvoiceID,
            InvoiceNumber: invoice.InvoiceNumber,
            Type: invoice.Type,
            Status: invoice.Status,
            Contact: invoice.Contact,
            Date: invoice.Date,
            DueDate: invoice.DueDate,
            Total: invoice.Total,
            AmountDue: invoice.AmountDue,
            AmountPaid: invoice.AmountPaid,
            CurrencyCode: invoice.CurrencyCode,
            Reference: invoice.Reference,
            LineItems: invoice.LineItems,
          }
        : undefined,
      error: '',
    };
  }

  private async listInvoices(
    params: Extract<XeroParams, { operation: 'list_invoices' }>
  ): Promise<Extract<XeroResult, { operation: 'list_invoices' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.where) queryParams.set('where', params.where);
    if (params.status) {
      const existingWhere = queryParams.get('where');
      const statusFilter = `Status=="${params.status}"`;
      queryParams.set(
        'where',
        existingWhere ? `${existingWhere} AND ${statusFilter}` : statusFilter
      );
    }

    const queryString = queryParams.toString();
    const endpoint = `/Invoices${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeXeroApiRequest(endpoint);

    return {
      operation: 'list_invoices',
      success: true,
      invoices: (response.Invoices || []).map((inv: any) => ({
        InvoiceID: inv.InvoiceID,
        InvoiceNumber: inv.InvoiceNumber,
        Type: inv.Type,
        Status: inv.Status,
        Contact: inv.Contact,
        Date: inv.Date,
        DueDate: inv.DueDate,
        Total: inv.Total,
        AmountDue: inv.AmountDue,
        AmountPaid: inv.AmountPaid,
        CurrencyCode: inv.CurrencyCode,
        Reference: inv.Reference,
      })),
      error: '',
    };
  }

  private async createContact(
    params: Extract<XeroParams, { operation: 'create_contact' }>
  ): Promise<Extract<XeroResult, { operation: 'create_contact' }>> {
    const contactBody: Record<string, unknown> = {
      Name: params.name,
    };

    if (params.email) contactBody.EmailAddress = params.email;
    if (params.first_name) contactBody.FirstName = params.first_name;
    if (params.last_name) contactBody.LastName = params.last_name;
    if (params.account_number)
      contactBody.AccountNumber = params.account_number;
    if (params.tax_number) contactBody.TaxNumber = params.tax_number;
    if (params.phone) {
      contactBody.Phones = [
        { PhoneType: 'DEFAULT', PhoneNumber: params.phone },
      ];
    }

    const response = await this.makeXeroApiRequest(
      '/Contacts',
      'POST',
      contactBody
    );

    const contact = response.Contacts?.[0];
    return {
      operation: 'create_contact',
      success: true,
      contact: contact
        ? {
            ContactID: contact.ContactID,
            Name: contact.Name,
            FirstName: contact.FirstName,
            LastName: contact.LastName,
            EmailAddress: contact.EmailAddress,
            AccountNumber: contact.AccountNumber,
            TaxNumber: contact.TaxNumber,
            ContactStatus: contact.ContactStatus,
            Phones: contact.Phones,
            Addresses: contact.Addresses,
          }
        : undefined,
      error: '',
    };
  }

  private async getContact(
    params: Extract<XeroParams, { operation: 'get_contact' }>
  ): Promise<Extract<XeroResult, { operation: 'get_contact' }>> {
    const response = await this.makeXeroApiRequest(
      `/Contacts/${params.contact_id}`
    );

    const contact = response.Contacts?.[0];
    return {
      operation: 'get_contact',
      success: true,
      contact: contact
        ? {
            ContactID: contact.ContactID,
            Name: contact.Name,
            FirstName: contact.FirstName,
            LastName: contact.LastName,
            EmailAddress: contact.EmailAddress,
            AccountNumber: contact.AccountNumber,
            TaxNumber: contact.TaxNumber,
            ContactStatus: contact.ContactStatus,
            Phones: contact.Phones,
            Addresses: contact.Addresses,
          }
        : undefined,
      error: '',
    };
  }

  private async listContacts(
    params: Extract<XeroParams, { operation: 'list_contacts' }>
  ): Promise<Extract<XeroResult, { operation: 'list_contacts' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.where) queryParams.set('where', params.where);

    const queryString = queryParams.toString();
    const endpoint = `/Contacts${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeXeroApiRequest(endpoint);

    return {
      operation: 'list_contacts',
      success: true,
      contacts: (response.Contacts || []).map((c: any) => ({
        ContactID: c.ContactID,
        Name: c.Name,
        FirstName: c.FirstName,
        LastName: c.LastName,
        EmailAddress: c.EmailAddress,
        AccountNumber: c.AccountNumber,
        TaxNumber: c.TaxNumber,
        ContactStatus: c.ContactStatus,
        Phones: c.Phones,
        Addresses: c.Addresses,
      })),
      error: '',
    };
  }

  private async listAccounts(
    params: Extract<XeroParams, { operation: 'list_accounts' }>
  ): Promise<Extract<XeroResult, { operation: 'list_accounts' }>> {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.set('where', `Type=="${params.type}"`);

    const queryString = queryParams.toString();
    const endpoint = `/Accounts${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeXeroApiRequest(endpoint);

    return {
      operation: 'list_accounts',
      success: true,
      accounts: (response.Accounts || []).map((a: any) => ({
        AccountID: a.AccountID,
        Code: a.Code,
        Name: a.Name,
        Type: a.Type,
        Status: a.Status,
        Description: a.Description,
        Class: a.Class,
        TaxType: a.TaxType,
      })),
      error: '',
    };
  }

  private async getReport(
    params: Extract<XeroParams, { operation: 'get_report' }>
  ): Promise<Extract<XeroResult, { operation: 'get_report' }>> {
    // Validate aged reports require contact_id
    if (
      (params.report_type === 'AgedReceivablesByContact' ||
        params.report_type === 'AgedPayablesByContact') &&
      !params.contact_id
    ) {
      return {
        operation: 'get_report',
        success: false,
        error: `contact_id is required for ${params.report_type}`,
      };
    }

    const queryParams = new URLSearchParams();
    if (params.date) queryParams.set('date', params.date);
    if (params.from_date) queryParams.set('fromDate', params.from_date);
    if (params.to_date) queryParams.set('toDate', params.to_date);
    if (params.contact_id) queryParams.set('contactID', params.contact_id);
    if (params.payments_only) queryParams.set('paymentsOnly', 'true');
    if (params.periods) queryParams.set('periods', String(params.periods));

    // BudgetSummary uses numeric timeframe (1=month, 3=quarter, 12=year)
    if (params.timeframe) {
      if (params.report_type === 'BudgetSummary') {
        const numericTimeframe =
          params.timeframe === 'MONTH'
            ? '1'
            : params.timeframe === 'QUARTER'
              ? '3'
              : '12';
        queryParams.set('timeframe', numericTimeframe);
      } else {
        queryParams.set('timeframe', params.timeframe);
      }
    }

    if (params.tracking_category_id)
      queryParams.set('trackingCategoryID', params.tracking_category_id);
    if (params.tracking_option_id)
      queryParams.set('trackingOptionID', params.tracking_option_id);

    const queryString = queryParams.toString();
    const endpoint = `/Reports/${params.report_type}${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeXeroApiRequest(endpoint);

    const report = response.Reports?.[0];
    if (!report) {
      return {
        operation: 'get_report',
        success: false,
        error: 'No report data returned from Xero',
      };
    }

    // Parse the abstract rows/cells structure into a cleaner format
    const parseRows = (rows: any[]): any[] =>
      (rows || []).map((row: any) => ({
        rowType: row.RowType,
        ...(row.Title ? { title: row.Title } : {}),
        ...(row.Cells
          ? {
              cells: row.Cells.map((cell: any) => ({
                value: cell.Value ?? '',
                ...(cell.Attributes?.find((a: any) => a.Id === 'account')?.Value
                  ? {
                      accountId: cell.Attributes.find(
                        (a: any) => a.Id === 'account'
                      ).Value,
                    }
                  : {}),
              })),
            }
          : {}),
        ...(row.Rows ? { rows: parseRows(row.Rows) } : {}),
      }));

    return {
      operation: 'get_report',
      success: true,
      report: {
        reportName: report.ReportName,
        reportType: report.ReportType,
        reportDate: report.ReportDate,
        reportTitles: report.ReportTitles,
        rows: parseRows(report.Rows),
      },
      error: '',
    };
  }
}
