import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define the parameters schema for DocuSign operations
export const DocuSignParamsSchema = z.discriminatedUnion('operation', [
  // Create and send envelope
  z.object({
    operation: z
      .literal('create_envelope')
      .describe('Create and send a DocuSign envelope for signing'),
    email_subject: z
      .string()
      .min(1)
      .describe('Subject line for the envelope email'),
    documents: z
      .array(
        z.object({
          name: z
            .string()
            .describe('Document file name (e.g., "Agreement.pdf")'),
          file_extension: z
            .string()
            .optional()
            .default('pdf')
            .describe('File extension (pdf, docx, etc.)'),
          document_base64: z
            .string()
            .describe('Base64-encoded document content'),
          document_id: z
            .string()
            .optional()
            .default('1')
            .describe('Unique document identifier within the envelope'),
        })
      )
      .min(1)
      .describe('Documents to include in the envelope'),
    signers: z
      .array(
        z.object({
          email: z.string().email().describe('Signer email address'),
          name: z.string().describe('Signer full name'),
          recipient_id: z
            .string()
            .optional()
            .describe('Unique recipient identifier (auto-assigned if omitted)'),
          routing_order: z
            .string()
            .optional()
            .default('1')
            .describe('Order in which signers receive the envelope'),
          tabs: z
            .object({
              sign_here: z
                .array(
                  z.object({
                    document_id: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Document to place the tab on'),
                    page_number: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Page number for the tab'),
                    x_position: z
                      .string()
                      .optional()
                      .default('100')
                      .describe('X position on the page'),
                    y_position: z
                      .string()
                      .optional()
                      .default('100')
                      .describe('Y position on the page'),
                  })
                )
                .optional()
                .describe('Signature tab placements'),
              date_signed: z
                .array(
                  z.object({
                    document_id: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Document to place the tab on'),
                    page_number: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Page number for the tab'),
                    x_position: z
                      .string()
                      .optional()
                      .default('200')
                      .describe('X position on the page'),
                    y_position: z
                      .string()
                      .optional()
                      .default('100')
                      .describe('Y position on the page'),
                  })
                )
                .optional()
                .describe('Date signed tab placements'),
              text: z
                .array(
                  z.object({
                    document_id: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Document to place the tab on'),
                    page_number: z
                      .string()
                      .optional()
                      .default('1')
                      .describe('Page number for the tab'),
                    x_position: z.string().describe('X position on the page'),
                    y_position: z.string().describe('Y position on the page'),
                    tab_label: z.string().describe('Label for the text tab'),
                    value: z
                      .string()
                      .optional()
                      .describe('Pre-filled value for the text tab'),
                    required: z
                      .string()
                      .optional()
                      .default('true')
                      .describe('Whether the tab is required'),
                  })
                )
                .optional()
                .describe('Text input tab placements'),
            })
            .optional()
            .describe('Tab placements for this signer'),
        })
      )
      .min(1)
      .describe('Signers who need to sign the envelope'),
    cc_recipients: z
      .array(
        z.object({
          email: z.string().email().describe('CC recipient email address'),
          name: z.string().describe('CC recipient full name'),
          recipient_id: z
            .string()
            .optional()
            .describe('Unique recipient identifier'),
          routing_order: z
            .string()
            .optional()
            .default('1')
            .describe('Routing order'),
        })
      )
      .optional()
      .describe('CC recipients who receive a copy but do not sign'),
    email_body: z
      .string()
      .optional()
      .describe('Custom email body message for the envelope'),
    status: z
      .enum(['sent', 'created'])
      .optional()
      .default('sent')
      .describe(
        'Envelope status: "sent" to send immediately, "created" to save as draft'
      ),
    reminder_enabled: z
      .boolean()
      .optional()
      .describe('Enable automatic reminders'),
    reminder_delay: z
      .string()
      .optional()
      .describe('Days before first reminder is sent'),
    reminder_frequency: z
      .string()
      .optional()
      .describe('Days between subsequent reminders'),
    expire_enabled: z
      .boolean()
      .optional()
      .describe('Enable envelope expiration'),
    expire_after: z.string().optional().describe('Days until envelope expires'),
    expire_warn: z
      .string()
      .optional()
      .describe('Days before expiration to send warning'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create envelope from template
  z.object({
    operation: z
      .literal('create_envelope_from_template')
      .describe('Create and send an envelope using a DocuSign template'),
    template_id: z.string().min(1).describe('DocuSign template ID to use'),
    email_subject: z
      .string()
      .optional()
      .describe('Override the template email subject'),
    email_body: z
      .string()
      .optional()
      .describe('Override the template email body'),
    signers: z
      .array(
        z.object({
          email: z.string().email().describe('Signer email address'),
          name: z.string().describe('Signer full name'),
          role_name: z
            .string()
            .describe('Template role name to assign this signer to'),
          recipient_id: z
            .string()
            .optional()
            .describe('Unique recipient identifier'),
        })
      )
      .min(1)
      .describe('Signers mapped to template roles'),
    cc_recipients: z
      .array(
        z.object({
          email: z.string().email().describe('CC recipient email address'),
          name: z.string().describe('CC recipient full name'),
          role_name: z
            .string()
            .describe('Template role name for this CC recipient'),
          recipient_id: z
            .string()
            .optional()
            .describe('Unique recipient identifier'),
        })
      )
      .optional()
      .describe('CC recipients mapped to template roles'),
    status: z
      .enum(['sent', 'created'])
      .optional()
      .default('sent')
      .describe('Envelope status'),
    template_data: z
      .record(z.string())
      .optional()
      .describe(
        'Key-value pairs to pre-fill template fields (tab labels to values)'
      ),
    reminder_enabled: z
      .boolean()
      .optional()
      .describe('Enable automatic reminders'),
    reminder_delay: z
      .string()
      .optional()
      .describe('Days before first reminder'),
    reminder_frequency: z
      .string()
      .optional()
      .describe('Days between subsequent reminders'),
    expire_enabled: z
      .boolean()
      .optional()
      .describe('Enable envelope expiration'),
    expire_after: z.string().optional().describe('Days until envelope expires'),
    expire_warn: z
      .string()
      .optional()
      .describe('Days before expiration to warn'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get envelope status
  z.object({
    operation: z
      .literal('get_envelope')
      .describe('Get the status and details of an envelope'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List envelopes
  z.object({
    operation: z
      .literal('list_envelopes')
      .describe('List envelopes with optional filters'),
    from_date: z
      .string()
      .optional()
      .describe(
        'Start date for filtering (ISO 8601 format, e.g., "2024-01-01T00:00:00Z"). Defaults to 30 days ago.'
      ),
    to_date: z
      .string()
      .optional()
      .describe('End date for filtering (ISO 8601 format)'),
    status: z
      .string()
      .optional()
      .describe(
        'Filter by status: "sent", "completed", "declined", "voided", "created". Comma-separate for multiple.'
      ),
    search_text: z
      .string()
      .optional()
      .describe(
        'Search text to filter envelopes (searches subject, recipient names/emails)'
      ),
    count: z
      .string()
      .optional()
      .default('25')
      .describe('Number of envelopes to return (max 100)'),
    start_position: z
      .string()
      .optional()
      .describe('Starting position for pagination'),
    order_by: z
      .string()
      .optional()
      .describe('Field to order by (e.g., "last_modified", "created")'),
    order: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get recipients
  z.object({
    operation: z
      .literal('get_recipients')
      .describe('Get the recipient status details for an envelope'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List templates
  z.object({
    operation: z
      .literal('list_templates')
      .describe('List available DocuSign templates'),
    search_text: z
      .string()
      .optional()
      .describe('Search text to filter templates by name'),
    count: z
      .string()
      .optional()
      .default('25')
      .describe('Number of templates to return'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Download document
  z.object({
    operation: z
      .literal('download_document')
      .describe('Download a document from a completed envelope'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID'),
    document_id: z
      .string()
      .optional()
      .default('combined')
      .describe(
        'Document ID to download, or "combined" for all documents merged, or "certificate" for the certificate of completion'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Void envelope
  z.object({
    operation: z
      .literal('void_envelope')
      .describe('Void an in-progress envelope to cancel it'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID to void'),
    void_reason: z.string().min(1).describe('Reason for voiding the envelope'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Resend envelope
  z.object({
    operation: z
      .literal('resend_envelope')
      .describe('Resend notifications to recipients who have not yet signed'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID to resend'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Bulk send from template
  z.object({
    operation: z
      .literal('bulk_send_from_template')
      .describe(
        'Create and send one envelope per recipient using a DocuSign template'
      ),
    template_id: z.string().min(1).describe('DocuSign template ID to use'),
    recipients: z
      .array(
        z.object({
          email: z.string().email().describe('Recipient email address'),
          name: z.string().describe('Recipient full name'),
          role_name: z
            .string()
            .describe('Template role name to assign this recipient to'),
        })
      )
      .min(1)
      .describe('Array of recipients — one envelope is created per recipient'),
    email_subject: z
      .string()
      .optional()
      .describe('Override the template email subject'),
    email_body: z
      .string()
      .optional()
      .describe('Override the template email body'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get embedded signing URL
  z.object({
    operation: z
      .literal('get_signing_url')
      .describe('Generate an embedded signing URL for a recipient'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID'),
    signer_email: z
      .string()
      .email()
      .describe(
        'Email of the signer who will use the embedded signing session'
      ),
    signer_name: z.string().describe('Full name of the signer'),
    return_url: z
      .string()
      .describe('URL to redirect the signer to after signing is complete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Correct recipient
  z.object({
    operation: z
      .literal('correct_recipient')
      .describe('Update a recipient email or name on an in-progress envelope'),
    envelope_id: z.string().min(1).describe('DocuSign envelope ID'),
    old_email: z
      .string()
      .email()
      .describe(
        'Current email of the recipient to update (used to find recipientId)'
      ),
    new_email: z
      .string()
      .email()
      .describe('New email address for the recipient'),
    new_name: z
      .string()
      .optional()
      .describe('New name for the recipient (keeps existing name if omitted)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Result schemas
export const DocuSignResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_envelope'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Created envelope ID'),
    status: z.string().optional().describe('Envelope status'),
    status_date_time: z.string().optional().describe('Status timestamp'),
    uri: z.string().optional().describe('Envelope URI'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('create_envelope_from_template'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Created envelope ID'),
    status: z.string().optional().describe('Envelope status'),
    status_date_time: z.string().optional().describe('Status timestamp'),
    uri: z.string().optional().describe('Envelope URI'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('get_envelope'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Envelope ID'),
    status: z.string().optional().describe('Current envelope status'),
    email_subject: z.string().optional().describe('Envelope email subject'),
    sent_date_time: z
      .string()
      .optional()
      .describe('When the envelope was sent'),
    completed_date_time: z
      .string()
      .optional()
      .describe('When signing was completed'),
    declined_date_time: z
      .string()
      .optional()
      .describe('When the envelope was declined'),
    voided_date_time: z
      .string()
      .optional()
      .describe('When the envelope was voided'),
    status_changed_date_time: z
      .string()
      .optional()
      .describe('When status last changed'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('list_envelopes'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelopes: z
      .array(
        z.object({
          envelope_id: z.string().describe('Envelope ID'),
          status: z.string().describe('Envelope status'),
          email_subject: z.string().optional().describe('Email subject'),
          sent_date_time: z.string().optional().describe('When sent'),
          completed_date_time: z.string().optional().describe('When completed'),
          status_changed_date_time: z
            .string()
            .optional()
            .describe('Last status change'),
        })
      )
      .optional()
      .describe('List of envelopes'),
    result_set_size: z
      .string()
      .optional()
      .describe('Number of results returned'),
    total_set_size: z.string().optional().describe('Total matching envelopes'),
    next_uri: z.string().optional().describe('URI for next page of results'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('get_recipients'),
    success: z.boolean().describe('Whether the operation was successful'),
    signers: z
      .array(
        z.object({
          email: z.string().describe('Signer email'),
          name: z.string().describe('Signer name'),
          status: z
            .string()
            .describe(
              'Signer status (sent, delivered, completed, declined, etc.)'
            ),
          signed_date_time: z
            .string()
            .optional()
            .describe('When the signer signed'),
          delivered_date_time: z
            .string()
            .optional()
            .describe('When delivered to signer'),
          declined_date_time: z
            .string()
            .optional()
            .describe('When the signer declined'),
          decline_reason: z
            .string()
            .optional()
            .describe('Reason for declining'),
          recipient_id: z.string().optional().describe('Recipient ID'),
          routing_order: z.string().optional().describe('Routing order'),
        })
      )
      .optional()
      .describe('List of signers and their statuses'),
    cc_recipients: z
      .array(
        z.object({
          email: z.string().describe('CC recipient email'),
          name: z.string().describe('CC recipient name'),
          status: z.string().describe('Delivery status'),
          recipient_id: z.string().optional().describe('Recipient ID'),
        })
      )
      .optional()
      .describe('List of CC recipients'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('list_templates'),
    success: z.boolean().describe('Whether the operation was successful'),
    templates: z
      .array(
        z.object({
          template_id: z.string().describe('Template ID'),
          name: z.string().describe('Template name'),
          description: z.string().optional().describe('Template description'),
          created: z
            .string()
            .optional()
            .describe('When the template was created'),
          last_modified: z.string().optional().describe('When last modified'),
        })
      )
      .optional()
      .describe('List of templates'),
    result_set_size: z
      .string()
      .optional()
      .describe('Number of results returned'),
    total_set_size: z.string().optional().describe('Total matching templates'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('download_document'),
    success: z.boolean().describe('Whether the operation was successful'),
    document_base64: z
      .string()
      .optional()
      .describe('Base64-encoded document content'),
    document_name: z.string().optional().describe('Document file name'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('void_envelope'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Voided envelope ID'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('resend_envelope'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Resent envelope ID'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('bulk_send_from_template'),
    success: z.boolean().describe('Whether the operation was successful'),
    results: z
      .array(
        z.object({
          envelope_id: z.string().optional().describe('Created envelope ID'),
          status: z.string().optional().describe('Envelope status'),
          recipient_email: z.string().describe('Recipient email address'),
          error: z
            .string()
            .optional()
            .describe('Error message if this individual send failed'),
        })
      )
      .optional()
      .describe('Array of results, one per recipient'),
    total_sent: z
      .number()
      .optional()
      .describe('Number of envelopes successfully sent'),
    total_failed: z
      .number()
      .optional()
      .describe('Number of envelopes that failed'),
    error: z.string().describe('Error message if the entire operation failed'),
  }),
  z.object({
    operation: z.literal('get_signing_url'),
    success: z.boolean().describe('Whether the operation was successful'),
    signing_url: z.string().optional().describe('Embedded signing URL'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('correct_recipient'),
    success: z.boolean().describe('Whether the operation was successful'),
    envelope_id: z.string().optional().describe('Envelope ID'),
    old_email: z.string().optional().describe('Previous recipient email'),
    new_email: z.string().optional().describe('Updated recipient email'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type DocuSignResult = z.output<typeof DocuSignResultSchema>;
export type DocuSignParams = z.output<typeof DocuSignParamsSchema>;
export type DocuSignParamsInput = z.input<typeof DocuSignParamsSchema>;
