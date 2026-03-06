import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Shared field helpers
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const invoiceIdField = z
  .string()
  .min(1, 'Invoice ID is required')
  .describe('Xero invoice UUID');

const contactIdField = z
  .string()
  .min(1, 'Contact ID is required')
  .describe('Xero contact UUID');

// Line item schema for invoices
const LineItemSchema = z
  .object({
    Description: z.string().describe('Description of the line item'),
    Quantity: z
      .number()
      .optional()
      .default(1)
      .describe('Quantity of the line item (default 1)'),
    UnitAmount: z.number().describe('Unit price of the line item'),
    AccountCode: z
      .string()
      .optional()
      .describe(
        'Account code for the line item (e.g., "200" for Sales, "400" for Advertising)'
      ),
    TaxType: z
      .string()
      .optional()
      .describe('Tax type for the line item (e.g., "OUTPUT", "INPUT")'),
    ItemCode: z.string().optional().describe('Item code from Xero inventory'),
  })
  .describe('A single invoice line item');

// Parameter schema using discriminated union
export const XeroParamsSchema = z.discriminatedUnion('operation', [
  // Create invoice
  z.object({
    operation: z
      .literal('create_invoice')
      .describe('Create a new invoice in Xero'),
    type: z
      .enum(['ACCREC', 'ACCPAY'])
      .describe(
        'Invoice type: ACCREC for accounts receivable (sales invoice), ACCPAY for accounts payable (bill)'
      ),
    contact_id: z
      .string()
      .min(1)
      .describe('ContactID of the customer/supplier'),
    line_items: z
      .array(LineItemSchema)
      .min(1)
      .describe('Line items for the invoice'),
    date: z
      .string()
      .optional()
      .describe('Invoice date in YYYY-MM-DD format (defaults to today)'),
    due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    reference: z
      .string()
      .optional()
      .describe('Reference number for the invoice'),
    status: z
      .enum(['DRAFT', 'SUBMITTED', 'AUTHORISED'])
      .optional()
      .default('DRAFT')
      .describe('Invoice status (default DRAFT)'),
    currency_code: z
      .string()
      .optional()
      .describe('Currency code (e.g., "USD", "GBP", "AUD")'),
    credentials: credentialsField,
  }),

  // Get invoice
  z.object({
    operation: z
      .literal('get_invoice')
      .describe('Retrieve a single invoice by ID'),
    invoice_id: invoiceIdField,
    credentials: credentialsField,
  }),

  // List invoices
  z.object({
    operation: z
      .literal('list_invoices')
      .describe('List invoices with optional filters'),
    status: z
      .enum(['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED'])
      .optional()
      .describe('Filter by invoice status'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    where: z
      .string()
      .optional()
      .describe(
        'Xero filter expression (e.g., "Type==\\"ACCREC\\"", "Contact.Name==\\"John\\"")'
      ),
    credentials: credentialsField,
  }),

  // Create contact
  z.object({
    operation: z
      .literal('create_contact')
      .describe('Create a new contact (customer or supplier)'),
    name: z.string().min(1).describe('Contact name (required, must be unique)'),
    email: z.string().optional().describe('Contact email address'),
    first_name: z.string().optional().describe('First name'),
    last_name: z.string().optional().describe('Last name'),
    phone: z.string().optional().describe('Phone number'),
    account_number: z
      .string()
      .optional()
      .describe('Account number for the contact'),
    tax_number: z
      .string()
      .optional()
      .describe('Tax number (ABN, VAT, GST number)'),
    credentials: credentialsField,
  }),

  // Get contact
  z.object({
    operation: z
      .literal('get_contact')
      .describe('Retrieve a single contact by ID'),
    contact_id: contactIdField,
    credentials: credentialsField,
  }),

  // List contacts
  z.object({
    operation: z
      .literal('list_contacts')
      .describe('List contacts with optional filters'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    where: z
      .string()
      .optional()
      .describe('Xero filter expression (e.g., "Name.StartsWith(\\"John\\")")'),
    credentials: credentialsField,
  }),

  // List accounts
  z.object({
    operation: z.literal('list_accounts').describe('List chart of accounts'),
    type: z
      .string()
      .optional()
      .describe(
        'Filter by account type (e.g., "REVENUE", "EXPENSE", "BANK", "CURRENT")'
      ),
    credentials: credentialsField,
  }),

  // Get financial report
  z.object({
    operation: z
      .literal('get_report')
      .describe('Retrieve a financial report from Xero'),
    report_type: z
      .enum([
        'BalanceSheet',
        'ProfitAndLoss',
        'TrialBalance',
        'BankSummary',
        'ExecutiveSummary',
        'BudgetSummary',
        'AgedReceivablesByContact',
        'AgedPayablesByContact',
      ])
      .describe('The type of report to generate'),
    date: z
      .string()
      .optional()
      .describe(
        'Report date in YYYY-MM-DD format. "As at" date for BalanceSheet/TrialBalance/ExecutiveSummary. Not used for ProfitAndLoss (use from_date/to_date).'
      ),
    from_date: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format. Used by ProfitAndLoss, BankSummary, and aged reports.'
      ),
    to_date: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format. Used by ProfitAndLoss, BankSummary, and aged reports.'
      ),
    periods: z
      .number()
      .optional()
      .describe(
        'Number of comparison periods (1-11 for most reports, 1-12 for BudgetSummary)'
      ),
    timeframe: z
      .enum(['MONTH', 'QUARTER', 'YEAR'])
      .optional()
      .describe('Timeframe for comparison periods (MONTH, QUARTER, or YEAR)'),
    contact_id: z
      .string()
      .optional()
      .describe(
        'Contact UUID — required for AgedReceivablesByContact and AgedPayablesByContact'
      ),
    payments_only: z
      .boolean()
      .optional()
      .describe(
        'Set true for cash-basis reporting (BalanceSheet, ProfitAndLoss, TrialBalance only)'
      ),
    tracking_category_id: z
      .string()
      .optional()
      .describe('Optional tracking category ID to filter the report by'),
    tracking_option_id: z
      .string()
      .optional()
      .describe('Optional tracking option ID (requires tracking_category_id)'),
    credentials: credentialsField,
  }),
]);

// Xero record schemas for response data
const XeroInvoiceSchema = z
  .object({
    InvoiceID: z.string().describe('Invoice UUID'),
    InvoiceNumber: z.string().optional().describe('Invoice number'),
    Type: z.string().describe('Invoice type (ACCREC or ACCPAY)'),
    Status: z.string().describe('Invoice status'),
    Contact: z
      .object({
        ContactID: z.string(),
        Name: z.string().optional(),
      })
      .optional()
      .describe('Associated contact'),
    Date: z.string().optional().describe('Invoice date'),
    DueDate: z.string().optional().describe('Due date'),
    SubTotal: z.number().optional().describe('Total before tax'),
    Total: z.number().optional().describe('Total amount including tax'),
    AmountDue: z.number().optional().describe('Amount due'),
    AmountPaid: z.number().optional().describe('Amount paid'),
    CurrencyCode: z.string().optional().describe('Currency code'),
    Reference: z.string().optional().describe('Reference'),
    LineItems: z.array(z.record(z.unknown())).optional().describe('Line items'),
  })
  .describe('A Xero invoice');

const XeroContactSchema = z
  .object({
    ContactID: z.string().describe('Contact UUID'),
    Name: z.string().describe('Contact name'),
    FirstName: z.string().optional().describe('First name'),
    LastName: z.string().optional().describe('Last name'),
    EmailAddress: z.string().optional().describe('Email address'),
    AccountNumber: z.string().optional().describe('Account number'),
    TaxNumber: z.string().optional().describe('Tax number'),
    ContactStatus: z.string().optional().describe('Contact status'),
    Phones: z.array(z.record(z.unknown())).optional().describe('Phone numbers'),
    Addresses: z.array(z.record(z.unknown())).optional().describe('Addresses'),
  })
  .describe('A Xero contact');

const XeroAccountSchema = z
  .object({
    AccountID: z.string().describe('Account UUID'),
    Code: z.string().optional().describe('Account code'),
    Name: z.string().describe('Account name'),
    Type: z.string().describe('Account type'),
    Status: z.string().optional().describe('Account status'),
    Description: z.string().optional().describe('Account description'),
    Class: z.string().optional().describe('Account class'),
    TaxType: z.string().optional().describe('Tax type'),
  })
  .describe('A Xero account');

// Result schema
export const XeroResultSchema = z.discriminatedUnion('operation', [
  // Create invoice result
  z.object({
    operation: z.literal('create_invoice'),
    success: z.boolean().describe('Whether the operation was successful'),
    invoice: XeroInvoiceSchema.optional().describe('Created invoice'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get invoice result
  z.object({
    operation: z.literal('get_invoice'),
    success: z.boolean().describe('Whether the operation was successful'),
    invoice: XeroInvoiceSchema.optional().describe('Retrieved invoice'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List invoices result
  z.object({
    operation: z.literal('list_invoices'),
    success: z.boolean().describe('Whether the operation was successful'),
    invoices: z
      .array(XeroInvoiceSchema)
      .optional()
      .describe('List of invoices'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create contact result
  z.object({
    operation: z.literal('create_contact'),
    success: z.boolean().describe('Whether the operation was successful'),
    contact: XeroContactSchema.optional().describe('Created contact'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get contact result
  z.object({
    operation: z.literal('get_contact'),
    success: z.boolean().describe('Whether the operation was successful'),
    contact: XeroContactSchema.optional().describe('Retrieved contact'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List contacts result
  z.object({
    operation: z.literal('list_contacts'),
    success: z.boolean().describe('Whether the operation was successful'),
    contacts: z
      .array(XeroContactSchema)
      .optional()
      .describe('List of contacts'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List accounts result
  z.object({
    operation: z.literal('list_accounts'),
    success: z.boolean().describe('Whether the operation was successful'),
    accounts: z
      .array(XeroAccountSchema)
      .optional()
      .describe('List of accounts'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get report result
  z.object({
    operation: z.literal('get_report'),
    success: z.boolean().describe('Whether the operation was successful'),
    report: z
      .object({
        reportName: z.string().describe('Report title'),
        reportType: z.string().describe('Report type identifier'),
        reportDate: z.string().optional().describe('Report date'),
        reportTitles: z
          .array(z.string())
          .optional()
          .describe('Report title lines (e.g., org name, date range)'),
        rows: z
          .array(
            z.object({
              rowType: z
                .string()
                .describe('Row type: Header, Section, Row, SummaryRow'),
              title: z.string().optional().describe('Section title'),
              cells: z
                .array(
                  z.object({
                    value: z.string().describe('Cell display value'),
                    accountId: z
                      .string()
                      .optional()
                      .describe('Account UUID if this row is an account'),
                  })
                )
                .optional()
                .describe('Cell values for this row'),
              rows: z
                .array(z.record(z.unknown()))
                .optional()
                .describe('Nested rows within a section'),
            })
          )
          .describe('Report rows'),
      })
      .optional()
      .describe('Parsed report data'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type XeroParams = z.output<typeof XeroParamsSchema>;
export type XeroParamsInput = z.input<typeof XeroParamsSchema>;
export type XeroResult = z.output<typeof XeroResultSchema>;
