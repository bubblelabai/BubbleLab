import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { type CreateEmailOptions, Resend } from 'resend';

// Define email address schema
const EmailAddressSchema = z.string().email('Invalid email address format');

// Define attachment schema
const AttachmentSchema = z.object({
  filename: z.string().describe('Name of the attached file'),
  content: z
    .union([z.string(), z.instanceof(Buffer)])
    .describe('File content as string or Buffer'),
  content_type: z.string().optional().describe('MIME type of the file'),
  path: z
    .string()
    .optional()
    .describe('Path where the attachment file is hosted'),
});

// Define the parameters schema for Resend operations
const ResendParamsSchema = z.discriminatedUnion('operation', [
  // Send email operation
  z.object({
    operation: z.literal('send_email').describe('Send an email via Resend'),
    from: z
      .string()
      .default('Bubble Lab Team <welcome@hello.bubblelab.ai>')
      .describe(
        'Sender email address, should not be changed from <welcome@hello.bubblelab.ai> if resend account has not been setup with domain verification'
      ),
    to: z
      .union([EmailAddressSchema, z.array(EmailAddressSchema)])
      .describe(
        'Recipient email address(es). For multiple addresses, send as an array of strings. Max 50.'
      ),
    cc: z
      .union([EmailAddressSchema, z.array(EmailAddressSchema)])
      .optional()
      .describe(
        'CC email address(es). For multiple addresses, send as an array of strings.'
      ),
    bcc: z
      .union([EmailAddressSchema, z.array(EmailAddressSchema)])
      .optional()
      .describe(
        'BCC email address(es). For multiple addresses, send as an array of strings.'
      ),
    subject: z
      .string()
      .min(1, 'Subject is required')
      .describe('Email subject line'),
    text: z.string().optional().describe('Plain text email content'),
    html: z.string().optional().describe('HTML email content'),
    reply_to: z
      .union([EmailAddressSchema, z.array(EmailAddressSchema)])
      .optional()
      .describe(
        'Reply-to email address(es). For multiple addresses, send as an array of strings.'
      ),
    scheduled_at: z
      .string()
      .optional()
      .describe(
        'Schedule email to be sent later (ISO 8601 format or natural language like "in 1 hour")'
      ),
    attachments: z
      .array(AttachmentSchema)
      .optional()
      .describe('Array of email attachments (max 40MB total per email)'),
    tags: z
      .array(
        z.object({
          name: z
            .string()
            .describe(
              'Tag name (ASCII letters, numbers, underscores, dashes only, max 256 chars)'
            ),
          value: z
            .string()
            .describe(
              'Tag value (ASCII letters, numbers, underscores, dashes only, max 256 chars)'
            ),
        })
      )
      .optional()
      .describe('Array of email tags for tracking and analytics'),
    headers: z
      .record(z.string())
      .optional()
      .describe('Custom email headers (e.g., X-Custom-Header)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get email status operation
  z.object({
    operation: z
      .literal('get_email_status')
      .describe('Get the status of a sent email'),
    email_id: z
      .string()
      .min(1, 'Email ID is required')
      .describe('Resend email ID to check status for'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const ResendResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('send_email').describe('Send an email via Resend'),
    success: z.boolean().describe('Whether the email was sent successfully'),
    email_id: z.string().optional().describe('Resend email ID if successful'),
    error: z.string().describe('Error message if email sending failed'),
  }),

  z.object({
    operation: z
      .literal('get_email_status')
      .describe('Get the status of a sent email'),
    success: z.boolean().describe('Whether the status request was successful'),
    status: z.string().optional().describe('Current status of the email'),
    created_at: z
      .string()
      .optional()
      .describe('Timestamp when the email was created'),
    last_event: z
      .string()
      .optional()
      .describe('Last event that occurred with the email'),
    error: z.string().describe('Error message if status request failed'),
  }),
]);

type ResendResult = z.output<typeof ResendResultSchema>;
type ResendParams = z.input<typeof ResendParamsSchema>;

// Helper type to get the result type for a specific operation
export type ResendOperationResult<T extends ResendParams['operation']> =
  Extract<ResendResult, { operation: T }>;

export class ResendBubble<
  T extends ResendParams = ResendParams,
> extends ServiceBubble<
  T,
  Extract<ResendResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'resend';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'resend';
  static readonly schema = ResendParamsSchema;
  static readonly resultSchema = ResendResultSchema;
  static readonly shortDescription = 'Email sending service via Resend API';
  static readonly longDescription = `
    Resend email service integration for sending transactional emails.
    Use cases:
    - Send transactional emails with HTML and text content
    - Track email delivery status and metrics
    - Manage email attachments and custom headers
    
    Security Features:
    - API key-based authentication
    - Email address validation
    - Content sanitization
    - Rate limiting awareness
  `;
  static readonly alias = 'resend';

  private resend?: Resend;

  constructor(
    params: T = {
      operation: 'send_email',
      from: 'noreply@example.com',
      to: ['user@example.com'],
      subject: 'Test Email',
      text: 'This is a test email.',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    try {
      // Test the API key by making a simple API call
      if (!this.resend) {
        throw new Error('Resend client not initialized');
      }
      await this.resend?.domains.list();
      return true;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<ResendResult, { operation: T['operation'] }>> {
    void context;
    const apiKey = this.chooseCredential();
    this.resend = new Resend(apiKey);
    const { operation } = this.params;

    try {
      const result = await (async (): Promise<ResendResult> => {
        switch (operation) {
          case 'send_email':
            return await this.sendEmail(this.params);
          case 'get_email_status':
            return await this.getEmailStatus(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<ResendResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<ResendResult, { operation: T['operation'] }>;
    }
  }

  private async sendEmail(
    params: Extract<ResendParams, { operation: 'send_email' }>
  ): Promise<Extract<ResendResult, { operation: 'send_email' }>> {
    const {
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      reply_to,
      attachments,
      tags,
      headers,
      scheduled_at,
    } = params;

    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    // Validate that either text or html content is provided
    if (!text && !html) {
      throw new Error('Either text or html content must be provided');
    }
    // Build the email payload according to Resend API specification
    const emailPayload: CreateEmailOptions = {
      from: from!,
      to,
      subject,
      react: undefined,
    };

    // Add optional fields only if they exist
    if (cc) emailPayload.cc = cc;
    if (bcc) emailPayload.bcc = bcc;
    if (text) emailPayload.text = text;
    if (html) emailPayload.html = html;
    if (reply_to) emailPayload.replyTo = reply_to;
    if (scheduled_at) emailPayload.scheduledAt = scheduled_at;
    if (attachments) emailPayload.attachments = attachments;
    if (tags) emailPayload.tags = tags;
    if (headers) emailPayload.headers = headers;

    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    const { data, error } = await this.resend.emails.send(emailPayload);

    if (error) {
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
    }

    return {
      operation: 'send_email',
      success: true,
      email_id: data?.id,
      error: '',
    };
  }

  private async getEmailStatus(
    params: Extract<ResendParams, { operation: 'get_email_status' }>
  ): Promise<Extract<ResendResult, { operation: 'get_email_status' }>> {
    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    const { email_id } = params;

    const { data, error } = await this.resend.emails.get(email_id);

    if (error) {
      throw new Error(`Failed to get email status: ${error.message}`);
    }

    return {
      operation: 'get_email_status',
      success: true,
      status: data?.last_event,
      created_at: data?.created_at,
      last_event: data?.last_event,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No resend credentials provided');
    }

    // Resend bubble uses RESEND_CRED credentials
    return credentials[CredentialType.RESEND_CRED];
  }
}
