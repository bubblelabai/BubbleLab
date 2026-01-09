import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import {
  CrustdataBubble,
  type PersonProfile,
  type CompanyInfo,
} from '../service-bubble/crustdata/index.js';

// Contact schema with full profile information
const ContactSchema = z.object({
  // Basic info
  name: z.string().nullable().describe('Full name'),
  title: z.string().nullable().describe('Current job title'),
  headline: z.string().nullable().describe('LinkedIn headline'),
  linkedinUrl: z.string().nullable().describe('LinkedIn profile URL'),
  profilePictureUrl: z.string().nullable().describe('Profile picture URL'),

  // Contact info
  email: z.string().nullable().describe('Email address'),
  twitterHandle: z.string().nullable().describe('Twitter/X handle'),

  // Classification (CXOs prioritized)
  role: z
    .enum(['cxo', 'decision_maker', 'founder'])
    .describe('Role classification'),

  // Location
  location: z.string().nullable().describe('Location'),

  // Professional background
  skills: z.array(z.string()).nullable().describe('Professional skills'),
  languages: z.array(z.string()).nullable().describe('Languages spoken'),
  summary: z.string().nullable().describe('Professional summary'),

  // Work history
  currentEmployment: z
    .array(
      z.object({
        title: z.string().nullable().describe('Job title'),
        companyName: z.string().nullable().describe('Company name'),
        companyLinkedinUrl: z
          .string()
          .nullable()
          .describe('Company LinkedIn URL'),
        startDate: z.string().nullable().describe('Start date'),
        description: z.string().nullable().describe('Role description'),
      })
    )
    .nullable()
    .describe('Current employment positions'),

  pastEmployment: z
    .array(
      z.object({
        title: z.string().nullable().describe('Job title'),
        companyName: z.string().nullable().describe('Company name'),
        startDate: z.string().nullable().describe('Start date'),
        endDate: z.string().nullable().describe('End date'),
      })
    )
    .nullable()
    .describe('Past employment positions'),

  // Education
  education: z
    .array(
      z.object({
        instituteName: z.string().nullable().describe('Institution name'),
        degreeName: z.string().nullable().describe('Degree name'),
        fieldOfStudy: z.string().nullable().describe('Field of study'),
      })
    )
    .nullable()
    .describe('Education history'),
});

// Company info schema for the result
const CompanyInfoOutputSchema = z.object({
  name: z.string().nullable().describe('Company name'),
  linkedinUrl: z.string().nullable().describe('Company LinkedIn URL'),
  website: z.string().nullable().describe('Company website'),
  industry: z.string().nullable().describe('Industry'),
  description: z.string().nullable().describe('Company description'),
  headcount: z.number().nullable().describe('Employee count'),
  hqCity: z.string().nullable().describe('Headquarters city'),
  hqCountry: z.string().nullable().describe('Headquarters country'),
  yearFounded: z.number().nullable().describe('Year founded'),
  fundingStage: z.string().nullable().describe('Funding stage'),
  totalFunding: z.string().nullable().describe('Total funding raised'),
});

// Tool parameters - simple, agent-friendly interface
const CompanyEnrichmentToolParamsSchema = z.object({
  companyIdentifier: z
    .string()
    .min(1)
    .describe(
      'Company name, domain (e.g., "stripe.com"), or LinkedIn URL. Auto-detects type.'
    ),
  limit: z
    .number()
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum contacts to return (default: 10)'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Tool result schema
const CompanyEnrichmentToolResultSchema = z.object({
  contacts: z.array(ContactSchema).describe('List of contacts at the company'),
  company: CompanyInfoOutputSchema.nullable().describe('Company information'),
  totalContacts: z.number().describe('Total number of contacts found'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Type definitions
type CompanyEnrichmentToolParams = z.output<
  typeof CompanyEnrichmentToolParamsSchema
>;
type CompanyEnrichmentToolResult = z.output<
  typeof CompanyEnrichmentToolResultSchema
>;
type CompanyEnrichmentToolParamsInput = z.input<
  typeof CompanyEnrichmentToolParamsSchema
>;
export type Contact = z.output<typeof ContactSchema>;
export type CompanyEnrichmentResult = CompanyEnrichmentToolResult;

/**
 * Company Enrichment Tool
 *
 * Agent-friendly tool for company enrichment and lead generation.
 * Takes a simple company identifier (name, domain, or LinkedIn URL)
 * and returns key contacts with full profiles.
 *
 * Features:
 * - Auto-detects identifier type (name, domain, LinkedIn URL)
 * - Returns CXOs, decision makers, and founders
 * - Full contact profiles with work history and education
 * - Prioritized results (CXOs first, then decision makers, then founders)
 *
 * Uses CrustdataBubble under the hood with a two-step process:
 * 1. Identify company (FREE) to get company_id
 * 2. Enrich company (1 credit) to get contacts
 */
export class CompanyEnrichmentTool extends ToolBubble<
  CompanyEnrichmentToolParams,
  CompanyEnrichmentToolResult
> {
  static readonly bubbleName: BubbleName = 'company-enrichment-tool';
  static readonly schema = CompanyEnrichmentToolParamsSchema;
  static readonly resultSchema = CompanyEnrichmentToolResultSchema;
  static readonly shortDescription =
    'Get key contacts (executives, decision makers) from any company for lead generation';
  static readonly longDescription = `
    Company enrichment tool for lead generation and sales prospecting.

    **SIMPLE INTERFACE:**
    Just provide a company name, domain, or LinkedIn URL to get key contacts.
    The tool automatically:
    - Detects the identifier type
    - Identifies the company
    - Enriches with contact data
    - Returns prioritized contacts (CXOs first)

    **WHAT YOU GET:**
    - Contact names and titles
    - LinkedIn profiles and email addresses
    - Work history and education
    - Skills and professional summary

    **CONTACT TYPES (prioritized):**
    1. CXOs - C-level executives (CEO, CTO, CFO, etc.)
    2. Decision makers - VP, Director, Head of, etc.
    3. Founders - Company founders

    **USE CASES:**
    - Sales prospecting - find decision makers to reach out to
    - Lead generation - build contact lists for outreach
    - Company research - understand company leadership
    - Competitive intelligence - track competitor executives
    - Partnership opportunities - find the right contacts

    **EXAMPLES:**
    - "stripe.com" - get contacts from Stripe
    - "Anthropic" - search by company name
    - "https://www.linkedin.com/company/openai" - use LinkedIn URL

    **CREDITS:**
    - Identify operation: FREE
    - Enrich operation: 1 credit per company
  `;
  static readonly alias = 'enrich';
  static readonly type = 'tool';

  constructor(
    params: CompanyEnrichmentToolParamsInput = {
      companyIdentifier: 'stripe.com',
      limit: 10,
    } as CompanyEnrichmentToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<CompanyEnrichmentToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.CRUSTDATA_API_KEY]) {
      return this.createErrorResult(
        'Company enrichment requires CRUSTDATA_API_KEY credential. Please configure it in your settings.'
      );
    }

    try {
      const { companyIdentifier, limit = 10 } = this.params;

      // Step 1: Detect identifier type and identify company
      const identifierType = this.detectIdentifierType(companyIdentifier);
      const identifyParams = this.buildIdentifyParams(
        identifierType,
        companyIdentifier
      );

      const identifyBubble = new CrustdataBubble(
        {
          operation: 'identify',
          ...identifyParams,
          credentials,
        },
        this.context
      );

      const identifyResult = await identifyBubble.action();

      if (!identifyResult.data.success) {
        return this.createErrorResult(
          `Failed to identify company: ${identifyResult.data.error}`
        );
      }

      const results = identifyResult.data.results || [];
      if (results.length === 0 || !results[0]?.company_id) {
        return this.createErrorResult(
          `No company found matching "${companyIdentifier}". Try using a domain (e.g., "stripe.com") or LinkedIn URL for better results.`
        );
      }

      const companyId = results[0].company_id;

      // Step 2: Enrich company to get contacts
      const enrichBubble = new CrustdataBubble(
        {
          operation: 'enrich',
          company_id: companyId,
          fields: 'decision_makers,cxos,founders.profiles',
          credentials,
        },
        this.context
      );

      const enrichResult = await enrichBubble.action();

      if (!enrichResult.data.success) {
        return this.createErrorResult(
          `Failed to enrich company: ${enrichResult.data.error}`
        );
      }
      console.log("enrichResult.data", enrichResult.data);

      // Step 3: Transform and merge contacts
      const contacts = this.transformContacts(
        enrichResult.data.cxos || [],
        enrichResult.data.decision_makers || [],
        enrichResult.data.founders?.profiles || [],
        limit
      );

      const company = this.transformCompanyInfo(enrichResult.data.company);

      return {
        contacts,
        company,
        totalContacts: contacts.length,
        success: true,
        error: '',
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Detect identifier type from the input string
   */
  private detectIdentifierType(
    identifier: string
  ): 'linkedin' | 'domain' | 'name' {
    // LinkedIn URL
    if (
      identifier.includes('linkedin.com/company') ||
      identifier.includes('linkedin.com/in')
    ) {
      return 'linkedin';
    }

    // Domain: has dot and no spaces, doesn't look like a sentence
    if (identifier.includes('.') && !identifier.includes(' ')) {
      return 'domain';
    }

    // Default to name
    return 'name';
  }

  /**
   * Build identify params based on identifier type
   */
  private buildIdentifyParams(
    type: 'linkedin' | 'domain' | 'name',
    identifier: string
  ): {
    query_company_name?: string;
    query_company_website?: string;
    query_company_linkedin_url?: string;
  } {
    switch (type) {
      case 'linkedin':
        return { query_company_linkedin_url: identifier };
      case 'domain':
        return { query_company_website: identifier };
      case 'name':
        return { query_company_name: identifier };
    }
  }

  /**
   * Transform and merge contacts from different sources
   * Priority: CXOs > Decision Makers > Founders
   */
  private transformContacts(
    cxos: PersonProfile[],
    decisionMakers: PersonProfile[],
    founders: PersonProfile[],
    limit: number
  ): Contact[] {
    const contacts: Contact[] = [];
    const seenLinkedInUrls = new Set<string>();

    // Helper to add contacts without duplicates
    const addContacts = (
      profiles: PersonProfile[],
      role: 'cxo' | 'decision_maker' | 'founder'
    ) => {
      for (const profile of profiles) {
        if (contacts.length >= limit) break;

        // Dedupe by LinkedIn URL
        const linkedinUrl =
          profile.linkedin_profile_url || profile.linkedin_flagship_url;
        if (linkedinUrl && seenLinkedInUrls.has(linkedinUrl)) continue;
        if (linkedinUrl) seenLinkedInUrls.add(linkedinUrl);

        contacts.push(this.transformProfile(profile, role));
      }
    };

    // Add in priority order
    addContacts(cxos, 'cxo');
    addContacts(decisionMakers, 'decision_maker');
    addContacts(founders, 'founder');

    return contacts;
  }

  /**
   * Transform a single profile to Contact format
   */
  private transformProfile(
    profile: PersonProfile,
    role: 'cxo' | 'decision_maker' | 'founder'
  ): Contact {
    return {
      name:
        profile.name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        null,
      title: profile.title || null,
      headline: profile.headline || null,
      linkedinUrl:
        profile.linkedin_profile_url || profile.linkedin_flagship_url || null,
      profilePictureUrl: profile.profile_picture_url || null,
      email: profile.email || null,
      twitterHandle: profile.twitter_handle || null,
      role,
      location: profile.location || null,
      skills: profile.skills || null,
      languages: profile.languages || null,
      summary: profile.summary || null,
      currentEmployment: profile.current_positions
        ? profile.current_positions.map((pos) => ({
            title: pos.title || null,
            companyName: pos.company_name || null,
            companyLinkedinUrl: pos.company_linkedin_url || null,
            startDate: pos.start_date || null,
            description: pos.description || null,
          }))
        : null,
      pastEmployment: profile.past_positions
        ? profile.past_positions.map((pos) => ({
            title: pos.title || null,
            companyName: pos.company_name || null,
            startDate: pos.start_date || null,
            endDate: pos.end_date || null,
          }))
        : null,
      education: profile.education
        ? profile.education.map((edu) => ({
            instituteName: edu.institute_name || null,
            degreeName: edu.degree_name || null,
            fieldOfStudy: edu.field_of_study || null,
          }))
        : null,
    };
  }

  /**
   * Transform company info to output format
   */
  private transformCompanyInfo(
    company: CompanyInfo | null | undefined
  ): z.output<typeof CompanyInfoOutputSchema> | null {
    if (!company) return null;

    return {
      name: company.name || null,
      linkedinUrl: company.linkedin_profile_url || null,
      website:
        company.company_website || company.company_website_domain || null,
      industry: company.industry || null,
      description: company.description || null,
      headcount: company.headcount || company.linkedin_headcount || null,
      hqCity: company.hq_city || null,
      hqCountry: company.hq_country || null,
      yearFounded: company.year_founded ? parseInt(company.year_founded) : null,
      fundingStage: company.funding_stage || null,
      totalFunding: company.total_funding || null,
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(errorMessage: string): CompanyEnrichmentToolResult {
    return {
      contacts: [],
      company: null,
      totalContacts: 0,
      success: false,
      error: errorMessage,
    };
  }
}
