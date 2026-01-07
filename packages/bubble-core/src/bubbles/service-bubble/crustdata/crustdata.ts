import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  CrustdataParamsSchema,
  CrustdataResultSchema,
  type CrustdataParams,
  type CrustdataParamsInput,
  type CrustdataResult,
  type PersonProfile,
} from './crustdata.schema.js';

const CRUSTDATA_BASE_URL = 'https://api.crustdata.com';

/**
 * Crustdata Service Bubble
 *
 * Low-level API wrapper for Crustdata company data enrichment.
 *
 * Operations:
 * - identify: Resolve company name/domain/LinkedIn URL to company_id (FREE)
 * - enrich: Get company data with decision makers, CXOs, and founders (1 credit)
 *
 * Use cases:
 * - Lead generation and sales prospecting
 * - Company research and intelligence
 * - Contact discovery for outreach
 *
 * Note: For agent-friendly usage, use CompanyEnrichmentTool instead.
 */
export class CrustdataBubble<
  T extends CrustdataParamsInput = CrustdataParamsInput,
> extends ServiceBubble<
  T,
  Extract<CrustdataResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'crustdata';
  static readonly authType = 'api-key' as const;
  static readonly bubbleName = 'crustdata';
  static readonly schema = CrustdataParamsSchema;
  static readonly resultSchema = CrustdataResultSchema;
  static readonly shortDescription =
    'Crustdata API for company data enrichment';
  static readonly longDescription = `
    Crustdata service integration for company data enrichment and lead generation.

    Operations:
    - identify: Resolve company name/domain/LinkedIn URL to company_id (FREE)
    - enrich: Get company data with decision makers, CXOs, and founders (1 credit)

    Use cases:
    - Lead generation and sales prospecting
    - Company research and intelligence
    - Contact discovery for outreach

    Note: For agent-friendly usage, use CompanyEnrichmentTool instead.
  `;

  constructor(
    params: T = {
      operation: 'identify',
      query_company_name: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      return false;
    }

    try {
      // Test the credentials by calling identify with a known company
      const response = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_company_website: 'stripe.com',
          count: 1,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<CrustdataResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<CrustdataResult> => {
        const parsedParams = this.params as CrustdataParams;
        switch (operation) {
          case 'identify':
            return await this.identify(
              parsedParams as Extract<
                CrustdataParams,
                { operation: 'identify' }
              >
            );
          case 'enrich':
            return await this.enrich(
              parsedParams as Extract<CrustdataParams, { operation: 'enrich' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<CrustdataResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<CrustdataResult, { operation: T['operation'] }>;
    }
  }

  private async identify(
    params: Extract<CrustdataParams, { operation: 'identify' }>
  ): Promise<Extract<CrustdataResult, { operation: 'identify' }>> {
    const {
      query_company_name,
      query_company_website,
      query_company_linkedin_url,
      count,
    } = params;

    // Build request body with only provided fields
    const body: Record<string, unknown> = {};
    if (query_company_name) body.query_company_name = query_company_name;
    if (query_company_website)
      body.query_company_website = query_company_website;
    if (query_company_linkedin_url)
      body.query_company_linkedin_url = query_company_linkedin_url;
    if (count) body.count = count;

    // Validate at least one identifier is provided
    if (
      !query_company_name &&
      !query_company_website &&
      !query_company_linkedin_url
    ) {
      return {
        operation: 'identify',
        success: false,
        results: [],
        error:
          'At least one of query_company_name, query_company_website, or query_company_linkedin_url is required',
      };
    }

    const response = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.chooseCredential()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle 404 as empty results (company not found)
    if (response.status === 404) {
      return {
        operation: 'identify',
        success: true,
        results: [],
        error: '',
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Crustdata identify API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // API returns array of results
    const results = Array.isArray(data) ? data : [data];

    return {
      operation: 'identify',
      success: true,
      results: results.map((item: Record<string, unknown>) => ({
        company_id: item.company_id as number | null,
        company_name: item.company_name as string | null,
        linkedin_profile_url: item.linkedin_profile_url as string | null,
        company_website_domain: item.company_website_domain as string | null,
        linkedin_headcount: item.linkedin_headcount as number | null,
        score: item.score as number | null,
      })),
      error: '',
    };
  }

  private async enrich(
    params: Extract<CrustdataParams, { operation: 'enrich' }>
  ): Promise<Extract<CrustdataResult, { operation: 'enrich' }>> {
    const {
      company_domain,
      company_linkedin_url,
      company_id,
      fields,
      enrich_realtime,
    } = params;

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (company_domain) queryParams.set('company_domain', company_domain);
    if (company_linkedin_url)
      queryParams.set('company_linkedin_url', company_linkedin_url);
    if (company_id !== undefined)
      queryParams.set('company_id', company_id.toString());
    if (fields) queryParams.set('fields', fields);
    if (enrich_realtime !== undefined)
      queryParams.set('enrich_realtime', enrich_realtime.toString());

    // Validate at least one identifier is provided
    if (!company_domain && !company_linkedin_url && company_id === undefined) {
      return {
        operation: 'enrich',
        success: false,
        company: null,
        decision_makers: null,
        cxos: null,
        founders: null,
        error:
          'At least one of company_domain, company_linkedin_url, or company_id is required',
      };
    }

    const response = await fetch(
      `${CRUSTDATA_BASE_URL}/screener/company?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${this.chooseCredential()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Crustdata enrich API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // API returns an array of company objects
    // Each company object contains the enriched data directly (not nested under 'company')
    const companies = Array.isArray(data) ? data : [data];
    const firstCompany = companies[0] as Record<string, unknown> | undefined;

    return {
      operation: 'enrich',
      success: true,
      company: firstCompany || null,
      decision_makers:
        (firstCompany?.decision_makers as PersonProfile[] | null) || null,
      cxos: (firstCompany?.cxos as PersonProfile[] | null) || null,
      founders:
        (firstCompany?.founders as {
          profiles?: PersonProfile[] | null;
        } | null) || null,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Crustdata credentials provided');
    }

    return credentials[CredentialType.CRUSTDATA_API_KEY];
  }
}
