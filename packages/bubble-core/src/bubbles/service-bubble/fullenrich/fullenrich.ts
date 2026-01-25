import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  FullEnrichParamsSchema,
  FullEnrichResultSchema,
  type FullEnrichParams,
  type FullEnrichParamsInput,
  type FullEnrichResult,
  type StartBulkEnrichmentParams,
  type GetEnrichmentResultParams,
  type StartReverseEmailLookupParams,
  type GetReverseEmailResultParams,
  type GetCreditBalanceParams,
  type CheckApiKeyParams,
} from './fullenrich.schema.js';

/**
 * API Error response structure
 */
interface FullEnrichApiError {
  code: string;
  message: string;
}

/**
 * FullEnrich Service Bubble
 *
 * B2B contact enrichment service for finding work emails, mobile phones,
 * and personal emails from contact information or LinkedIn profiles.
 *
 * Features:
 * - Bulk enrichment for up to 100 contacts at once
 * - Reverse email lookup to find contact info from email addresses
 * - LinkedIn profile enrichment for enhanced data
 * - Webhook support for real-time result delivery
 * - Credit-based pricing with balance tracking
 *
 * Use cases:
 * - Enrich leads with work emails and phone numbers
 * - Build sales prospecting pipelines
 * - Verify and update CRM contact data
 * - Find decision makers from LinkedIn profiles
 *
 * Credit Costs:
 * - Work email: 1 credit
 * - Personal email: 3 credits
 * - Mobile phone: 10 credits
 * - Reverse email lookup: 1 credit per match
 *
 * Security Features:
 * - API key authentication (Bearer token)
 * - Workspace-based access control
 * - Rate limiting protection
 */
export class FullEnrichBubble<
  T extends FullEnrichParamsInput = FullEnrichParamsInput,
> extends ServiceBubble<
  T,
  Extract<FullEnrichResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'fullenrich';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'fullenrich';
  static readonly schema = FullEnrichParamsSchema;
  static readonly resultSchema = FullEnrichResultSchema;
  static readonly shortDescription =
    'B2B contact enrichment for emails, phones, and LinkedIn data';
  static readonly longDescription = `
    FullEnrich B2B contact enrichment service for finding work emails,
    mobile phones, and personal emails from contact information or LinkedIn profiles.

    Features:
    - Bulk enrichment for up to 100 contacts at once
    - Reverse email lookup to find contact info from email addresses
    - LinkedIn profile enrichment for enhanced data (+5-20% better email rates, +10-60% better phone rates)
    - Webhook support for real-time result delivery
    - Credit-based pricing with balance tracking

    Use cases:
    - Enrich leads with work emails and phone numbers
    - Build sales prospecting pipelines
    - Verify and update CRM contact data
    - Find decision makers from LinkedIn profiles

    Credit Costs:
    - Work email: 1 credit
    - Personal email: 3 credits
    - Mobile phone: 10 credits
    - Reverse email lookup: 1 credit per match

    Security Features:
    - API key authentication (Bearer token)
    - Workspace-based access control
    - Rate limiting protection
  `;
  static readonly alias = 'enrich';

  private static readonly BASE_URL = 'https://app.fullenrich.com/api/v1';

  constructor(
    params: T = {
      operation: 'get_credit_balance',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  /**
   * Test if the API key is valid
   */
  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      return false;
    }

    try {
      const response = await fetch(
        `${FullEnrichBubble.BASE_URL}/account/keys/verify`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Make an API request to FullEnrich
   */
  private async makeApiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown
  ): Promise<T> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('FullEnrich API key is required');
    }

    const url = `${FullEnrichBubble.BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
    };

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      let errorMessage = `FullEnrich API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = (await response.json()) as FullEnrichApiError;
        if (errorData.message) {
          errorMessage = `FullEnrich API error: ${errorData.message} (${errorData.code})`;
        }
      } catch {
        // If we can't parse the error response, use the default message
      }

      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  }

  /**
   * Main action handler - routes to appropriate operation
   */
  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<FullEnrichResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<FullEnrichResult> => {
        // Cast to output type since base class already parsed input through Zod
        const parsedParams = this.params as FullEnrichParams;

        switch (operation) {
          case 'start_bulk_enrichment':
            return await this.startBulkEnrichment(
              parsedParams as StartBulkEnrichmentParams
            );
          case 'get_enrichment_result':
            return await this.getEnrichmentResult(
              parsedParams as GetEnrichmentResultParams
            );
          case 'start_reverse_email_lookup':
            return await this.startReverseEmailLookup(
              parsedParams as StartReverseEmailLookupParams
            );
          case 'get_reverse_email_result':
            return await this.getReverseEmailResult(
              parsedParams as GetReverseEmailResultParams
            );
          case 'get_credit_balance':
            return await this.getCreditBalance(
              parsedParams as GetCreditBalanceParams
            );
          case 'check_api_key':
            return await this.checkApiKey(parsedParams as CheckApiKeyParams);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<FullEnrichResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<FullEnrichResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Start bulk enrichment for contacts
   */
  private async startBulkEnrichment(
    params: StartBulkEnrichmentParams
  ): Promise<
    Extract<FullEnrichResult, { operation: 'start_bulk_enrichment' }>
  > {
    const { name, webhook_url, contacts } = params;

    // Transform contacts to API format
    const datas = contacts.map((contact) => ({
      firstname: contact.firstname,
      lastname: contact.lastname,
      domain: contact.domain,
      company_name: contact.company_name,
      linkedin_url: contact.linkedin_url,
      enrich_fields: contact.enrich_fields,
      custom: contact.custom,
    }));

    const body: Record<string, unknown> = {
      name,
      datas,
    };

    if (webhook_url) {
      body.webhook_url = webhook_url;
    }

    const response = await this.makeApiRequest<{ enrichment_id: string }>(
      '/contact/enrich/bulk',
      'POST',
      body
    );

    return {
      operation: 'start_bulk_enrichment',
      success: true,
      enrichment_id: response.enrichment_id,
      error: '',
    };
  }

  /**
   * Get enrichment result by ID
   */
  private async getEnrichmentResult(
    params: GetEnrichmentResultParams
  ): Promise<
    Extract<FullEnrichResult, { operation: 'get_enrichment_result' }>
  > {
    const { enrichment_id, force_results } = params;

    const queryParams = new URLSearchParams();
    if (force_results) {
      queryParams.set('forceResults', 'true');
    }

    const queryString = queryParams.toString();
    const endpoint = `/contact/enrich/bulk/${enrichment_id}${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeApiRequest<{
      id: string;
      name: string;
      status: string;
      datas: Array<{
        custom?: Record<string, string>;
        contact?: Record<string, unknown>;
      }>;
      cost?: { credits: number };
    }>(endpoint, 'GET');

    return {
      operation: 'get_enrichment_result',
      success: true,
      id: response.id,
      name: response.name,
      status: response.status as
        | 'CREATED'
        | 'IN_PROGRESS'
        | 'CANCELED'
        | 'CREDITS_INSUFFICIENT'
        | 'FINISHED'
        | 'RATE_LIMIT'
        | 'UNKNOWN',
      results: response.datas,
      cost: response.cost,
      error: '',
    };
  }

  /**
   * Start reverse email lookup
   */
  private async startReverseEmailLookup(
    params: StartReverseEmailLookupParams
  ): Promise<
    Extract<FullEnrichResult, { operation: 'start_reverse_email_lookup' }>
  > {
    const { name, webhook_url, emails } = params;

    // Transform emails to API format
    const data = emails.map((email) => ({ email }));

    const body: Record<string, unknown> = {
      name,
      data,
    };

    if (webhook_url) {
      body.webhook_url = webhook_url;
    }

    const response = await this.makeApiRequest<{ enrichment_id: string }>(
      '/contact/reverse/email/bulk',
      'POST',
      body
    );

    return {
      operation: 'start_reverse_email_lookup',
      success: true,
      enrichment_id: response.enrichment_id,
      error: '',
    };
  }

  /**
   * Get reverse email lookup result
   */
  private async getReverseEmailResult(
    params: GetReverseEmailResultParams
  ): Promise<
    Extract<FullEnrichResult, { operation: 'get_reverse_email_result' }>
  > {
    const { reverse_email_id } = params;

    const response = await this.makeApiRequest<{
      id: string;
      name: string;
      status: string;
      datas: Array<{
        input?: string;
        contact?: Record<string, unknown>;
      }>;
      cost?: { credits: number };
    }>(`/contact/reverse/email/bulk/${reverse_email_id}`, 'GET');

    return {
      operation: 'get_reverse_email_result',
      success: true,
      id: response.id,
      name: response.name,
      status: response.status as
        | 'CREATED'
        | 'IN_PROGRESS'
        | 'CANCELED'
        | 'CREDITS_INSUFFICIENT'
        | 'FINISHED'
        | 'RATE_LIMIT'
        | 'UNKNOWN',
      results: response.datas,
      cost: response.cost,
      error: '',
    };
  }

  /**
   * Get current credit balance
   */
  private async getCreditBalance(
    _params: GetCreditBalanceParams
  ): Promise<Extract<FullEnrichResult, { operation: 'get_credit_balance' }>> {
    const response = await this.makeApiRequest<{ balance: number }>(
      '/account/credits',
      'GET'
    );

    return {
      operation: 'get_credit_balance',
      success: true,
      balance: response.balance,
      error: '',
    };
  }

  /**
   * Check if API key is valid
   */
  private async checkApiKey(
    _params: CheckApiKeyParams
  ): Promise<Extract<FullEnrichResult, { operation: 'check_api_key' }>> {
    const response = await this.makeApiRequest<{ workspace_id: string }>(
      '/account/keys/verify',
      'GET'
    );

    return {
      operation: 'check_api_key',
      success: true,
      workspace_id: response.workspace_id,
      error: '',
    };
  }

  /**
   * Choose the appropriate credential for FullEnrich
   */
  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.FULLENRICH_API_KEY];
  }
}
