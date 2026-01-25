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
  type PersonDBProfile,
  type PersonEnrichmentProfile,
  type PersonEnrichmentError,
} from './crustdata.schema.js';

const CRUSTDATA_BASE_URL = 'https://api.crustdata.com';

/**
 * Crustdata Service Bubble
 *
 * Low-level API wrapper for Crustdata company data enrichment and people search.
 *
 * Operations:
 * - identify: Resolve company name/domain/LinkedIn URL to company_id (FREE)
 * - enrich: Get company data with decision makers, CXOs, and founders (1 credit)
 * - person_search_db: In-database people search with advanced filtering (3 credits per 100 results)
 * - person_enrich: Enrich LinkedIn profiles with comprehensive data (3-5 credits per profile)
 *
 * Use cases:
 * - Lead generation and sales prospecting
 * - Company research and intelligence
 * - Contact discovery for outreach
 * - People search across companies with various filters
 * - LinkedIn profile enrichment with employment history, education, skills
 * - Reverse email lookup to find LinkedIn profiles
 *
 * Note: For agent-friendly usage, use CompanyEnrichmentTool or PeopleSearchTool instead.
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
    'Crustdata API for company data enrichment and people search';
  static readonly longDescription = `
    Crustdata service integration for company data enrichment, lead generation, and people search.

    Operations:
    - identify: Resolve company name/domain/LinkedIn URL to company_id (FREE)
    - enrich: Get company data with decision makers, CXOs, and founders (1 credit)
    - person_search_db: In-database people search with advanced filtering (3 credits per 100 results)
    - person_enrich: Enrich LinkedIn profiles with comprehensive data (3-5 credits per profile)

    Use cases:
    - Lead generation and sales prospecting
    - Company research and intelligence
    - Contact discovery for outreach
    - People search across companies with various filters
    - Find professionals by title, company, skills, location, etc.
    - Geographic radius search for local talent
    - LinkedIn profile enrichment with employment history, education, skills
    - Reverse email lookup to find LinkedIn profiles
    - Business email discovery for outreach

    Note: For agent-friendly usage, use CompanyEnrichmentTool or PeopleSearchTool instead.
  `;

  constructor(
    params: T = {
      operation: 'identify',
      query_company_name: '',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
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
          case 'person_search_db':
            return await this.personSearchDB(
              parsedParams as Extract<
                CrustdataParams,
                { operation: 'person_search_db' }
              >
            );
          case 'person_enrich':
            return await this.personEnrich(
              parsedParams as Extract<
                CrustdataParams,
                { operation: 'person_enrich' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      // Log token usage for billable operations
      if (result.success && this.context?.logger) {
        this.logUsage(operation, result);
      }

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

  /**
   * Log usage for billable Crustdata operations
   * - identify: $0.01 per company identified
   * - enrich: $0.10 per company enriched
   * - person_search_db: $0.03 per result
   */
  private logUsage(operation: string, result: CrustdataResult): void {
    const logger = this.context?.logger;
    if (!logger) return;

    switch (operation) {
      case 'identify': {
        // Identify charges $0.01 per company identified
        const identifyResult = result as Extract<
          CrustdataResult,
          { operation: 'identify' }
        >;
        const resultCount = identifyResult.results?.length ?? 0;
        if (resultCount > 0) {
          logger.logTokenUsage(
            {
              usage: resultCount,
              service: CredentialType.CRUSTDATA_API_KEY,
              unit: 'per_result',
              subService: 'identify',
            },
            `Crustdata identify: ${resultCount} companies identified`,
            {
              bubbleName: 'crustdata',
              variableId: this.context?.variableId,
              operationType: 'bubble_execution',
            }
          );
        }
        break;
      }
      case 'enrich': {
        // Enrich charges $0.10 per company enriched
        logger.logTokenUsage(
          {
            usage: 1,
            service: CredentialType.CRUSTDATA_API_KEY,
            unit: 'per_company',
            subService: 'enrich',
          },
          `Crustdata enrich: 1 company enriched`,
          {
            bubbleName: 'crustdata',
            variableId: this.context?.variableId,
            operationType: 'bubble_execution',
          }
        );
        break;
      }
      case 'person_search_db': {
        // PersonDB charges $0.03 per result
        const personSearchResult = result as Extract<
          CrustdataResult,
          { operation: 'person_search_db' }
        >;
        const resultCount = personSearchResult.profiles?.length ?? 0;
        if (resultCount > 0) {
          logger.logTokenUsage(
            {
              usage: resultCount,
              service: CredentialType.CRUSTDATA_API_KEY,
              unit: 'per_result',
              subService: 'person_search_db',
            },
            `Crustdata person_search_db: ${resultCount} results returned`,
            {
              bubbleName: 'crustdata',
              variableId: this.context?.variableId,
              operationType: 'bubble_execution',
            }
          );
        }
        break;
      }
      case 'person_enrich': {
        // Person Enrichment charges:
        // - Database: 3 credits per profile
        // - Real-time: 5 credits per profile
        // - +2 credits for business_email field
        // - Preview mode: 0 credits
        const personEnrichResult = result as Extract<
          CrustdataResult,
          { operation: 'person_enrich' }
        >;
        const profileCount = personEnrichResult.profiles?.length ?? 0;
        if (profileCount > 0) {
          logger.logTokenUsage(
            {
              usage: profileCount,
              service: CredentialType.CRUSTDATA_API_KEY,
              unit: 'per_profile',
              subService: 'person_enrich',
            },
            `Crustdata person_enrich: ${profileCount} profiles enriched`,
            {
              bubbleName: 'crustdata',
              variableId: this.context?.variableId,
              operationType: 'bubble_execution',
            }
          );
        }
        break;
      }
      default:
        break;
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

  /**
   * PersonDB In-Database Search
   * Searches for people profiles using advanced filtering with cursor-based pagination.
   * Credits: 3 per 100 results returned, 0 in preview mode
   *
   * @see People Discovery API Data Dictionary below for complete response structure
   */
  private async personSearchDB(
    params: Extract<CrustdataParams, { operation: 'person_search_db' }>
  ): Promise<Extract<CrustdataResult, { operation: 'person_search_db' }>> {
    const { filters, sorts, cursor, limit, preview, post_processing } = params;

    // Build request body
    const body: Record<string, unknown> = {
      filters,
    };

    if (sorts && sorts.length > 0) body.sorts = sorts;
    if (cursor) body.cursor = cursor;
    if (limit !== undefined) body.limit = limit;
    if (preview !== undefined) body.preview = preview;
    if (post_processing) body.post_processing = post_processing;

    const response = await fetch(
      `${CRUSTDATA_BASE_URL}/screener/persondb/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.chooseCredential()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Crustdata PersonDB search API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      operation: 'person_search_db',
      success: true,
      profiles: (data.profiles as PersonDBProfile[]) || [],
      total_count: (data.total_count as number) || 0,
      next_cursor: (data.next_cursor as string) || undefined,
      error: '',
    };
  }

  /**
   * Person Enrichment API
   * Enriches LinkedIn profiles with comprehensive data including employment history,
   * education, skills, and optionally business emails.
   *
   * Credits:
   * - Database enrichment: 3 credits per profile
   * - Real-time enrichment: 5 credits per profile
   * - Business email discovery: +2 credits per profile
   * - Preview mode: 0 credits
   */
  private async personEnrich(
    params: Extract<CrustdataParams, { operation: 'person_enrich' }>
  ): Promise<Extract<CrustdataResult, { operation: 'person_enrich' }>> {
    const {
      linkedin_profile_url,
      business_email,
      enrich_realtime,
      fields,
      preview,
    } = params;

    // Validate that at least one identifier is provided
    if (!linkedin_profile_url && !business_email) {
      return {
        operation: 'person_enrich',
        success: false,
        profiles: [],
        errors: [],
        error: 'You must provide either linkedin_profile_url or business_email',
      };
    }

    // Validate mutually exclusive parameters
    if (linkedin_profile_url && business_email) {
      return {
        operation: 'person_enrich',
        success: false,
        profiles: [],
        errors: [],
        error:
          'linkedin_profile_url and business_email are mutually exclusive. Provide only one.',
      };
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (linkedin_profile_url) {
      queryParams.set('linkedin_profile_url', linkedin_profile_url);
    }
    if (business_email) {
      queryParams.set('business_email', business_email);
    }
    if (enrich_realtime !== undefined) {
      queryParams.set('enrich_realtime', enrich_realtime.toString());
    }
    if (fields) {
      queryParams.set('fields', fields);
    }
    if (preview !== undefined) {
      queryParams.set('preview', preview.toString());
    }

    const response = await fetch(
      `${CRUSTDATA_BASE_URL}/screener/person/enrich?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${this.chooseCredential()}`,
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
      }
    );

    // Handle various response scenarios
    if (response.status === 400) {
      const errorText = await response.text();
      return {
        operation: 'person_enrich',
        success: false,
        profiles: [],
        errors: [],
        error: `Bad request: ${errorText}`,
      };
    }

    if (response.status === 404) {
      // Profile not found - return with error info
      const errorData = await response.json().catch(() => ({}));
      return {
        operation: 'person_enrich',
        success: true,
        profiles: [],
        errors: [errorData as PersonEnrichmentError],
        error: '',
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Crustdata Person Enrichment API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    // API returns an array of results (profiles and/or errors)
    const results = Array.isArray(data) ? data : [data];

    // Separate successful profiles from errors
    const profiles: PersonEnrichmentProfile[] = [];
    const errors: PersonEnrichmentError[] = [];

    for (const item of results) {
      if (item.error || item.error_code || item.message) {
        errors.push(item as PersonEnrichmentError);
      } else {
        profiles.push(item as PersonEnrichmentProfile);
      }
    }

    return {
      operation: 'person_enrich',
      success: true,
      profiles,
      errors: errors.length > 0 ? errors : undefined,
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
