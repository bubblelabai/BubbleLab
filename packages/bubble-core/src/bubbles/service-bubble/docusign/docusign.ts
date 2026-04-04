import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  DocuSignParamsSchema,
  DocuSignResultSchema,
  type DocuSignParams,
  type DocuSignParamsInput,
  type DocuSignResult,
} from './docusign.schema.js';

/**
 * DocuSign Service Bubble
 *
 * eSignature integration for managing document signing workflows.
 *
 * Features:
 * - Create and send envelopes with documents and signers
 * - Create envelopes from pre-built templates
 * - Track envelope and recipient signing status
 * - Configure automatic reminders and expiration
 * - Download signed documents
 * - Void and resend envelopes
 *
 * Use cases:
 * - Automate agreement lifecycle (send, track, remind)
 * - Savings account agreement workflows
 * - Contract management and tracking
 * - Bulk envelope status monitoring
 */
export class DocuSignBubble<
  T extends DocuSignParamsInput = DocuSignParamsInput,
> extends ServiceBubble<
  T,
  Extract<DocuSignResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'docusign';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'docusign';
  static readonly schema = DocuSignParamsSchema;
  static readonly resultSchema = DocuSignResultSchema;
  static readonly shortDescription =
    'DocuSign eSignature integration for document signing workflows';
  static readonly longDescription = `
    DocuSign eSignature integration for managing document signing workflows.

    Features:
    - Create and send envelopes with documents and signers
    - Create envelopes from pre-built templates with role mapping
    - Track envelope and recipient signing status
    - Configure automatic reminders and envelope expiration
    - Download signed/completed documents
    - Void in-progress envelopes and resend notifications
    - List and search envelopes and templates

    Use cases:
    - Automate agreement lifecycle (generate, send, track, remind, escalate)
    - Savings account agreement workflows
    - Contract management and compliance tracking
    - Bulk envelope status monitoring for CS agents

    Security Features:
    - OAuth 2.0 authentication with DocuSign
    - Scoped access permissions
    - Secure document handling
  `;
  static readonly alias = 'docusign';

  /**
   * DocuSign credential format:
   * Base64-encoded JSON: { accessToken, accountId, baseUri }
   * The accountId identifies which DocuSign account to access.
   * The baseUri is the region-specific API base URL.
   */
  private parseCredentials(): {
    accessToken: string;
    accountId: string;
    baseUri: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const docusignCredRaw = credentials[CredentialType.DOCUSIGN_CRED];
    if (!docusignCredRaw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        accountId?: string;
        baseUri?: string;
      }>(docusignCredRaw);

      if (parsed.accessToken && parsed.accountId) {
        return {
          accessToken: parsed.accessToken,
          accountId: parsed.accountId,
          baseUri: parsed.baseUri
            ? `${parsed.baseUri}/restapi`
            : 'https://demo.docusign.net/restapi',
        };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token
      // In this case, we can't make API calls without accountId
    }

    return null;
  }

  constructor(
    params: T = {
      operation: 'list_envelopes',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('DocuSign credentials are required');
    }

    // Test by calling userinfo endpoint
    const response = await fetch(
      'https://account-d.docusign.com/oauth/userinfo',
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `DocuSign token validation failed (${response.status}): ${text}`
      );
    }
    return true;
  }

  private async makeDocuSignRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<any> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid DocuSign credentials. Expected base64-encoded JSON with { accessToken, accountId, baseUri }.'
      );
    }

    const url = `${creds.baseUri}/v2.1/accounts/${creds.accountId}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.errorCode || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(
        `DocuSign API error (${response.status}): ${errorMessage}`
      );
    }

    // Some endpoints return no content (204)
    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    // For binary responses (document downloads)
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<DocuSignResult, { operation: T['operation'] }>> {
    void context;
    const { operation } = this.params;

    try {
      const result = await (async (): Promise<DocuSignResult> => {
        const parsedParams = this.params as DocuSignParams;

        switch (operation) {
          case 'create_envelope':
            return await this.createEnvelope(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'create_envelope' }
              >
            );
          case 'create_envelope_from_template':
            return await this.createEnvelopeFromTemplate(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'create_envelope_from_template' }
              >
            );
          case 'get_envelope':
            return await this.getEnvelope(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'get_envelope' }
              >
            );
          case 'list_envelopes':
            return await this.listEnvelopes(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'list_envelopes' }
              >
            );
          case 'get_recipients':
            return await this.getRecipients(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'get_recipients' }
              >
            );
          case 'list_templates':
            return await this.listTemplates(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'list_templates' }
              >
            );
          case 'get_template':
            return await this.getTemplate(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'get_template' }
              >
            );
          case 'download_document':
            return await this.downloadDocument(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'download_document' }
              >
            );
          case 'void_envelope':
            return await this.voidEnvelope(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'void_envelope' }
              >
            );
          case 'resend_envelope':
            return await this.resendEnvelope(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'resend_envelope' }
              >
            );
          case 'bulk_send_from_template':
            return await this.bulkSendFromTemplate(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'bulk_send_from_template' }
              >
            );
          case 'get_signing_url':
            return await this.getSigningUrl(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'get_signing_url' }
              >
            );
          case 'correct_recipient':
            return await this.correctRecipient(
              parsedParams as Extract<
                DocuSignParams,
                { operation: 'correct_recipient' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<DocuSignResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<DocuSignResult, { operation: T['operation'] }>;
    }
  }

  private buildNotificationObject(params: {
    reminder_enabled?: boolean;
    reminder_delay?: string;
    reminder_frequency?: string;
    expire_enabled?: boolean;
    expire_after?: string;
    expire_warn?: string;
  }): object | undefined {
    const hasReminders = params.reminder_enabled !== undefined;
    const hasExpiration = params.expire_enabled !== undefined;
    if (!hasReminders && !hasExpiration) return undefined;

    const notification: any = { useAccountDefaults: 'false' };
    if (hasReminders) {
      notification.reminders = {
        reminderEnabled: String(params.reminder_enabled),
        reminderDelay: params.reminder_delay || '3',
        reminderFrequency: params.reminder_frequency || '5',
      };
    }
    if (hasExpiration) {
      notification.expirations = {
        expireEnabled: String(params.expire_enabled),
        expireAfter: params.expire_after || '30',
        expireWarn: params.expire_warn || '3',
      };
    }
    return notification;
  }

  /**
   * Check if base64 content is a valid PDF (starts with %PDF).
   * If not, wrap the decoded text in a minimal valid PDF.
   */
  private ensurePdfContent(
    base64Content: string,
    _fileName: string
  ): { base64: string; extension: string } {
    // Check if it's already a PDF
    try {
      const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
      if (decoded.startsWith('%PDF')) {
        return { base64: base64Content, extension: 'pdf' };
      }
    } catch {
      // If decoding fails, assume it's binary PDF data
      return { base64: base64Content, extension: 'pdf' };
    }

    // It's plain text — wrap in a minimal PDF with proper layout
    const text = Buffer.from(base64Content, 'base64').toString('utf-8');
    const pdf = this.textToMinimalPdf(text);

    return {
      base64: Buffer.from(pdf).toString('base64'),
      extension: 'pdf',
    };
  }

  /**
   * Convert plain text to a minimal valid PDF with proper formatting.
   * Uses Helvetica 10pt, 72pt margins, 14pt line spacing, with word wrapping.
   */
  private textToMinimalPdf(text: string): string {
    const PAGE_WIDTH = 612; // US Letter
    const PAGE_HEIGHT = 792;
    const MARGIN = 72; // 1 inch
    const FONT_SIZE = 10;
    const LINE_HEIGHT = 14;
    const CHARS_PER_LINE = 85; // Approximate for Helvetica 10pt at this width
    const TOP_Y = PAGE_HEIGHT - MARGIN;
    const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN) / LINE_HEIGHT);

    // Escape PDF special chars
    const escape = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    // Word-wrap and split into lines
    const rawLines = text.split('\n');
    const wrappedLines: string[] = [];
    for (const rawLine of rawLines) {
      if (rawLine.length === 0) {
        wrappedLines.push('');
        continue;
      }
      const words = rawLine.split(' ');
      let current = '';
      for (const word of words) {
        if (current.length + word.length + 1 > CHARS_PER_LINE) {
          wrappedLines.push(current);
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) wrappedLines.push(current);
    }

    // Split into pages
    const pages: string[][] = [];
    for (let i = 0; i < wrappedLines.length; i += LINES_PER_PAGE) {
      pages.push(wrappedLines.slice(i, i + LINES_PER_PAGE));
    }
    if (pages.length === 0) pages.push(['']);

    // Build PDF objects
    const objects: string[] = [];
    let objNum = 1;

    // Catalog
    const catalogNum = objNum++;
    objects.push(
      `${catalogNum} 0 obj\n<< /Type /Catalog /Pages ${catalogNum + 1} 0 R >>\nendobj`
    );

    // Pages
    const pagesNum = objNum++;
    const pageObjNums: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      pageObjNums.push(pagesNum + 1 + i * 2); // page obj numbers
    }
    objects.push(
      `${pagesNum} 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj`
    );

    // Font object number (will be assigned after pages)
    const fontObjNum = pagesNum + 1 + pages.length * 2;

    // Page + Content objects for each page
    for (let p = 0; p < pages.length; p++) {
      const pageNum = objNum++;
      const contentNum = objNum++;

      const lineCommands = pages[p]
        .map((line, i) => {
          const pos =
            i === 0 ? `${MARGIN} ${TOP_Y} Td` : `0 -${LINE_HEIGHT} Td`;
          return `${pos}\n(${escape(line)}) Tj`;
        })
        .join('\n');

      const stream = `BT\n/F1 ${FONT_SIZE} Tf\n${lineCommands}\nET`;

      objects.push(
        `${pageNum} 0 obj\n<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj`
      );
      objects.push(
        `${contentNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
      );
    }

    // Font
    objNum++;
    objects.push(
      `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`
    );

    // Build the PDF
    const body = objects.join('\n');
    const totalObjs = fontObjNum + 1;

    // Simplified xref — DocuSign is lenient with xref offsets for programmatic PDFs
    let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
    let offset = 9; // after %PDF-1.4\n
    for (const obj of objects) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
      offset += obj.length + 1;
    }

    return `%PDF-1.4\n${body}\n${xref}trailer\n<< /Size ${totalObjs} /Root ${catalogNum} 0 R >>\nstartxref\n${offset}\n%%EOF`;
  }

  private async createEnvelope(
    params: Extract<DocuSignParams, { operation: 'create_envelope' }>
  ): Promise<Extract<DocuSignResult, { operation: 'create_envelope' }>> {
    const body: any = {
      emailSubject: params.email_subject,
      status: params.status,
      documents: params.documents.map((doc, i) => {
        const isPdfName = (doc.name || '').toLowerCase().endsWith('.pdf');
        // Auto-convert text content to PDF if the file is named .pdf
        if (isPdfName) {
          const { base64, extension } = this.ensurePdfContent(
            doc.document_base64,
            doc.name
          );
          return {
            documentId: doc.document_id || String(i + 1),
            name: doc.name,
            fileExtension: extension,
            documentBase64: base64,
          };
        }
        return {
          documentId: doc.document_id || String(i + 1),
          name: doc.name,
          fileExtension: doc.file_extension,
          documentBase64: doc.document_base64,
        };
      }),
      recipients: {
        signers: params.signers.map((s, i) => {
          const signer: any = {
            email: s.email,
            name: s.name,
            recipientId: s.recipient_id || String(i + 1),
            routingOrder: s.routing_order,
          };
          if (s.tabs) {
            signer.tabs = {};
            if (s.tabs.sign_here?.length) {
              signer.tabs.signHereTabs = s.tabs.sign_here.map((t) => ({
                documentId: t.document_id,
                pageNumber: t.page_number,
                xPosition: t.x_position,
                yPosition: t.y_position,
              }));
            }
            if (s.tabs.date_signed?.length) {
              signer.tabs.dateSignedTabs = s.tabs.date_signed.map((t) => ({
                documentId: t.document_id,
                pageNumber: t.page_number,
                xPosition: t.x_position,
                yPosition: t.y_position,
              }));
            }
            if (s.tabs.text?.length) {
              signer.tabs.textTabs = s.tabs.text.map((t) => ({
                documentId: t.document_id,
                pageNumber: t.page_number,
                xPosition: t.x_position,
                yPosition: t.y_position,
                tabLabel: t.tab_label,
                value: t.value,
                required: t.required,
              }));
            }
          }
          return signer;
        }),
      },
    };

    if (params.cc_recipients?.length) {
      body.recipients.carbonCopies = params.cc_recipients.map((cc, i) => ({
        email: cc.email,
        name: cc.name,
        recipientId: cc.recipient_id || String(params.signers.length + i + 1),
        routingOrder: cc.routing_order,
      }));
    }

    if (params.email_body) {
      body.emailBlurb = params.email_body;
    }

    const notification = this.buildNotificationObject(params);
    if (notification) {
      body.notification = notification;
    }

    const response = await this.makeDocuSignRequest('/envelopes', 'POST', body);

    return {
      operation: 'create_envelope',
      success: true,
      envelope_id: response.envelopeId,
      status: response.status,
      status_date_time: response.statusDateTime,
      uri: response.uri,
      error: '',
    };
  }

  private async createEnvelopeFromTemplate(
    params: Extract<
      DocuSignParams,
      { operation: 'create_envelope_from_template' }
    >
  ): Promise<
    Extract<DocuSignResult, { operation: 'create_envelope_from_template' }>
  > {
    const body: any = {
      templateId: params.template_id,
      status: params.status,
      templateRoles: params.signers.map((s, i) => {
        const role: any = {
          email: s.email,
          name: s.name,
          roleName: s.role_name,
          recipientId: s.recipient_id || String(i + 1),
        };
        // Pre-fill template fields if provided
        if (params.template_data) {
          role.tabs = {
            textTabs: Object.entries(params.template_data).map(
              ([label, value]) => ({
                tabLabel: label,
                value,
              })
            ),
          };
        }
        return role;
      }),
    };

    if (params.cc_recipients?.length) {
      body.templateRoles.push(
        ...params.cc_recipients.map((cc, i) => ({
          email: cc.email,
          name: cc.name,
          roleName: cc.role_name,
          recipientId: cc.recipient_id || String(params.signers.length + i + 1),
        }))
      );
    }

    if (params.email_subject) body.emailSubject = params.email_subject;
    if (params.email_body) body.emailBlurb = params.email_body;

    const notification = this.buildNotificationObject(params);
    if (notification) body.notification = notification;

    const response = await this.makeDocuSignRequest('/envelopes', 'POST', body);

    return {
      operation: 'create_envelope_from_template',
      success: true,
      envelope_id: response.envelopeId,
      status: response.status,
      status_date_time: response.statusDateTime,
      uri: response.uri,
      error: '',
    };
  }

  private async getEnvelope(
    params: Extract<DocuSignParams, { operation: 'get_envelope' }>
  ): Promise<Extract<DocuSignResult, { operation: 'get_envelope' }>> {
    const response = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}`
    );

    return {
      operation: 'get_envelope',
      success: true,
      envelope_id: response.envelopeId,
      status: response.status,
      email_subject: response.emailSubject,
      sent_date_time: response.sentDateTime,
      completed_date_time: response.completedDateTime,
      declined_date_time: response.declinedDateTime,
      voided_date_time: response.voidedDateTime,
      status_changed_date_time: response.statusChangedDateTime,
      error: '',
    };
  }

  private async listEnvelopes(
    params: Extract<DocuSignParams, { operation: 'list_envelopes' }>
  ): Promise<Extract<DocuSignResult, { operation: 'list_envelopes' }>> {
    const queryParams = new URLSearchParams();

    // Default from_date to 30 days ago if not provided
    const fromDate =
      params.from_date ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    queryParams.set('from_date', fromDate);

    if (params.to_date) queryParams.set('to_date', params.to_date);
    if (params.status) queryParams.set('status', params.status);
    if (params.search_text) queryParams.set('search_text', params.search_text);
    if (params.count) queryParams.set('count', params.count);
    if (params.start_position)
      queryParams.set('start_position', params.start_position);
    if (params.order_by) queryParams.set('order_by', params.order_by);
    if (params.order) queryParams.set('order', params.order);

    const response = await this.makeDocuSignRequest(
      `/envelopes?${queryParams.toString()}`
    );

    const envelopes = (response.envelopes || []).map((env: any) => ({
      envelope_id: env.envelopeId,
      status: env.status,
      email_subject: env.emailSubject,
      sent_date_time: env.sentDateTime,
      completed_date_time: env.completedDateTime,
      status_changed_date_time: env.statusChangedDateTime,
    }));

    return {
      operation: 'list_envelopes',
      success: true,
      envelopes,
      result_set_size: response.resultSetSize,
      total_set_size: response.totalSetSize,
      next_uri: response.nextUri,
      error: '',
    };
  }

  private async getRecipients(
    params: Extract<DocuSignParams, { operation: 'get_recipients' }>
  ): Promise<Extract<DocuSignResult, { operation: 'get_recipients' }>> {
    const response = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/recipients`
    );

    const signers = (response.signers || []).map((s: any) => ({
      email: s.email,
      name: s.name,
      status: s.status,
      signed_date_time: s.signedDateTime,
      delivered_date_time: s.deliveredDateTime,
      declined_date_time: s.declinedDateTime,
      decline_reason: s.declinedReason,
      recipient_id: s.recipientId,
      routing_order: s.routingOrder,
    }));

    const ccRecipients = (response.carbonCopies || []).map((cc: any) => ({
      email: cc.email,
      name: cc.name,
      status: cc.status,
      recipient_id: cc.recipientId,
    }));

    return {
      operation: 'get_recipients',
      success: true,
      signers,
      cc_recipients: ccRecipients,
      error: '',
    };
  }

  private async listTemplates(
    params: Extract<DocuSignParams, { operation: 'list_templates' }>
  ): Promise<Extract<DocuSignResult, { operation: 'list_templates' }>> {
    const queryParams = new URLSearchParams();
    if (params.search_text) queryParams.set('search_text', params.search_text);
    if (params.count) queryParams.set('count', params.count);

    const query = queryParams.toString();
    const response = await this.makeDocuSignRequest(
      `/templates${query ? '?' + query : ''}`
    );

    const templates = (response.envelopeTemplates || []).map((t: any) => ({
      template_id: t.templateId,
      name: t.name,
      description: t.description,
      created: t.created,
      last_modified: t.lastModified,
    }));

    return {
      operation: 'list_templates',
      success: true,
      templates,
      result_set_size: response.resultSetSize,
      total_set_size: response.totalSetSize,
      error: '',
    };
  }

  private async getTemplate(
    params: Extract<DocuSignParams, { operation: 'get_template' }>
  ): Promise<Extract<DocuSignResult, { operation: 'get_template' }>> {
    const response = await this.makeDocuSignRequest(
      `/templates/${params.template_id}?include=recipients,tabs`
    );

    // Extract roles from template recipients (signers)
    const signers = response.recipients?.signers || [];
    const roles = signers.map((s: Record<string, unknown>) => ({
      role_name: (s.roleName as string) || '',
      role_id: (s.recipientId as string) || '',
      signing_order: (s.routingOrder as string) || '1',
    }));

    // Extract fields/tabs from all signers' tab definitions
    const fields: Array<{
      tab_label: string;
      tab_type: string;
      role_name: string;
    }> = [];

    for (const signer of signers) {
      const roleName = (signer.roleName as string) || '';
      const tabs = (signer.tabs || {}) as Record<string, unknown[]>;

      const tabTypeMap: Record<string, string> = {
        signHereTabs: 'signHere',
        dateSignedTabs: 'dateSigned',
        textTabs: 'text',
        fullNameTabs: 'fullName',
        emailTabs: 'email',
        companyTabs: 'company',
        titleTabs: 'title',
        checkboxTabs: 'checkbox',
        numberTabs: 'number',
        dateTabs: 'date',
      };

      for (const [tabKey, tabArray] of Object.entries(tabs)) {
        if (!Array.isArray(tabArray)) continue;
        const tabType = tabTypeMap[tabKey] || tabKey.replace(/Tabs$/, '');
        for (const tab of tabArray) {
          const t = tab as Record<string, unknown>;
          fields.push({
            tab_label: (t.tabLabel as string) || tabType,
            tab_type: tabType,
            role_name: roleName,
          });
        }
      }
    }

    return {
      operation: 'get_template',
      success: true,
      template_id: response.templateId,
      name: response.name,
      description: response.description,
      roles,
      fields,
      error: '',
    };
  }

  private async downloadDocument(
    params: Extract<DocuSignParams, { operation: 'download_document' }>
  ): Promise<Extract<DocuSignResult, { operation: 'download_document' }>> {
    const documentBase64 = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/documents/${params.document_id}`
    );

    return {
      operation: 'download_document',
      success: true,
      document_base64: documentBase64,
      document_name: `envelope_${params.envelope_id}_doc_${params.document_id}.pdf`,
      error: '',
    };
  }

  private async voidEnvelope(
    params: Extract<DocuSignParams, { operation: 'void_envelope' }>
  ): Promise<Extract<DocuSignResult, { operation: 'void_envelope' }>> {
    await this.makeDocuSignRequest(`/envelopes/${params.envelope_id}`, 'PUT', {
      status: 'voided',
      voidedReason: params.void_reason,
    });

    return {
      operation: 'void_envelope',
      success: true,
      envelope_id: params.envelope_id,
      error: '',
    };
  }

  private async resendEnvelope(
    params: Extract<DocuSignParams, { operation: 'resend_envelope' }>
  ): Promise<Extract<DocuSignResult, { operation: 'resend_envelope' }>> {
    // First get current recipients, then PUT them back with resend flag
    const recipients = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/recipients`
    );

    // Build the recipients payload with only signers who haven't completed
    const signers = (recipients.signers || [])
      .filter((s: Record<string, string>) => s.status !== 'completed')
      .map((s: Record<string, string>) => ({
        email: s.email,
        name: s.name,
        recipientId: s.recipientId,
      }));

    if (signers.length === 0) {
      return {
        operation: 'resend_envelope',
        success: true,
        envelope_id: params.envelope_id,
        error: 'All recipients have already completed signing.',
      };
    }

    await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/recipients?resend_envelope=true`,
      'PUT',
      { signers }
    );

    return {
      operation: 'resend_envelope',
      success: true,
      envelope_id: params.envelope_id,
      error: '',
    };
  }

  private async bulkSendFromTemplate(
    params: Extract<DocuSignParams, { operation: 'bulk_send_from_template' }>
  ): Promise<
    Extract<DocuSignResult, { operation: 'bulk_send_from_template' }>
  > {
    if (!params.recipients || params.recipients.length === 0) {
      return {
        operation: 'bulk_send_from_template',
        success: false,
        results: [],
        total_sent: 0,
        total_failed: 0,
        error: 'Recipients array is empty. At least one recipient is required.',
      };
    }

    const results: Array<{
      envelope_id?: string;
      status?: string;
      recipient_email: string;
      error?: string;
    }> = [];

    let totalSent = 0;
    let totalFailed = 0;

    for (const recipient of params.recipients) {
      try {
        const body: any = {
          templateId: params.template_id,
          status: 'sent',
          templateRoles: [
            {
              email: recipient.email,
              name: recipient.name,
              roleName: recipient.role_name,
            },
          ],
        };

        if (params.email_subject) body.emailSubject = params.email_subject;
        if (params.email_body) body.emailBlurb = params.email_body;

        const response = await this.makeDocuSignRequest(
          '/envelopes',
          'POST',
          body
        );
        results.push({
          envelope_id: response.envelopeId,
          status: response.status,
          recipient_email: recipient.email,
        });
        totalSent++;
      } catch (error) {
        results.push({
          recipient_email: recipient.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        totalFailed++;
      }
    }

    return {
      operation: 'bulk_send_from_template',
      success: totalSent > 0,
      results,
      total_sent: totalSent,
      total_failed: totalFailed,
      error:
        totalFailed > 0
          ? `${totalFailed} of ${params.recipients.length} sends failed.`
          : '',
    };
  }

  private async getSigningUrl(
    params: Extract<DocuSignParams, { operation: 'get_signing_url' }>
  ): Promise<Extract<DocuSignResult, { operation: 'get_signing_url' }>> {
    const body = {
      returnUrl: params.return_url,
      authenticationMethod: 'none',
      email: params.signer_email,
      userName: params.signer_name,
    };

    const response = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/views/recipient`,
      'POST',
      body
    );

    return {
      operation: 'get_signing_url',
      success: true,
      signing_url: response.url,
      error: '',
    };
  }

  private async correctRecipient(
    params: Extract<DocuSignParams, { operation: 'correct_recipient' }>
  ): Promise<Extract<DocuSignResult, { operation: 'correct_recipient' }>> {
    // First, get current recipients to find the recipientId for old_email
    const recipients = await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/recipients`
    );

    const signers = recipients.signers || [];
    const matchingSigner = signers.find(
      (s: any) => s.email.toLowerCase() === params.old_email.toLowerCase()
    );

    if (!matchingSigner) {
      return {
        operation: 'correct_recipient',
        success: false,
        envelope_id: params.envelope_id,
        old_email: params.old_email,
        new_email: params.new_email,
        error: `No recipient found with email "${params.old_email}" on envelope ${params.envelope_id}.`,
      };
    }

    // PUT updated recipient info
    await this.makeDocuSignRequest(
      `/envelopes/${params.envelope_id}/recipients`,
      'PUT',
      {
        signers: [
          {
            recipientId: matchingSigner.recipientId,
            email: params.new_email,
            name: params.new_name || matchingSigner.name,
          },
        ],
      }
    );

    return {
      operation: 'correct_recipient',
      success: true,
      envelope_id: params.envelope_id,
      old_email: params.old_email,
      new_email: params.new_email,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }
}
