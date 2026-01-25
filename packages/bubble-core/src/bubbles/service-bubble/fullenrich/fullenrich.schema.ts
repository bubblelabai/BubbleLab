import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// ENRICH FIELDS ENUM
// ============================================================================

/**
 * Enum for enrichment fields that can be requested
 * - contact.emails: Work emails (1 credit)
 * - contact.personal_emails: Personal emails (3 credits)
 */
export const EnrichFieldEnum = z.enum([
  'contact.emails',
  'contact.personal_emails',
]);

// ============================================================================
// ENRICHMENT STATUS ENUM
// ============================================================================

/**
 * Status of an enrichment operation
 */
export const EnrichmentStatusEnum = z.enum([
  'CREATED',
  'IN_PROGRESS',
  'CANCELED',
  'CREDITS_INSUFFICIENT',
  'FINISHED',
  'RATE_LIMIT',
  'UNKNOWN',
]);

// ============================================================================
// SHARED DATA SCHEMAS
// ============================================================================

/**
 * Email object returned from enrichment
 */
export const EmailSchema = z
  .object({
    email: z.string().optional().describe('The email address'),
    status: z
      .string()
      .optional()
      .describe('Verification status of the email (e.g., valid, catch-all)'),
  })
  .describe('Email information with verification status');

/**
 * Phone object returned from enrichment
 */
export const PhoneSchema = z
  .object({
    phone: z.string().optional().describe('The phone number'),
    region: z.string().optional().describe('The region/country of the phone'),
  })
  .describe('Phone information with region');

/**
 * Social media link
 */
export const SocialMediaSchema = z
  .object({
    url: z.string().optional().describe('URL to the social media profile'),
    type: z
      .string()
      .optional()
      .describe(
        'Type of social media (LINKEDIN, TWITTER, FACEBOOK, GITHUB, etc.)'
      ),
  })
  .describe('Social media profile link');

/**
 * Company information from LinkedIn profile
 */
export const CompanyInfoSchema = z
  .object({
    name: z.string().optional().describe('Company name'),
    domain: z.string().optional().describe('Company domain'),
    linkedin_url: z.string().optional().describe('Company LinkedIn URL'),
    linkedin_id: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val !== undefined ? String(val) : undefined))
      .describe('Company LinkedIn ID'),
    industry: z
      .string()
      .optional()
      .describe('Industry the company operates in'),
    headquarters: z
      .object({
        city: z.string().optional().describe('City of headquarters'),
        country: z.string().optional().describe('Country of headquarters'),
      })
      .optional()
      .describe('Headquarters location'),
  })
  .describe('Company information');

/**
 * Professional profile information from LinkedIn
 */
export const ProfileSchema = z
  .object({
    linkedin_url: z.string().optional().describe('LinkedIn profile URL'),
    linkedin_id: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val !== undefined ? String(val) : undefined))
      .describe('LinkedIn profile ID'),
    linkedin_handle: z.string().optional().describe('LinkedIn handle/username'),
    headline: z.string().optional().describe('Professional headline'),
    location: z.string().optional().describe('Current location'),
    current_position: z
      .object({
        title: z.string().optional().describe('Current job title'),
        company: CompanyInfoSchema.optional().describe(
          'Current company information'
        ),
        start_date: z.string().optional().describe('Position start date'),
        end_date: z.string().optional().describe('Position end date'),
      })
      .optional()
      .describe('Current position details'),
  })
  .describe('Professional profile from LinkedIn');

/**
 * Enriched contact information
 */
export const EnrichedContactSchema = z
  .object({
    firstname: z.string().optional().describe('First name'),
    lastname: z.string().optional().describe('Last name'),
    domain: z.string().optional().describe('Company domain'),
    most_probable_email: z
      .string()
      .optional()
      .describe('Most likely work email address'),
    most_probable_personal_email: z
      .string()
      .optional()
      .describe('Most likely personal email address'),
    emails: z
      .array(EmailSchema)
      .optional()
      .describe('List of work email addresses found'),
    personal_emails: z
      .array(EmailSchema)
      .optional()
      .describe('List of personal email addresses found'),
    most_probable_phone: z
      .string()
      .optional()
      .describe('Most likely mobile phone number'),
    phones: z
      .array(PhoneSchema)
      .optional()
      .describe('List of phone numbers found'),
    social_medias: z
      .array(SocialMediaSchema)
      .optional()
      .describe('Social media profiles'),
    profile: ProfileSchema.optional().describe(
      'Professional profile information'
    ),
  })
  .describe('Enriched contact data');

/**
 * Single enrichment record
 */
export const EnrichmentRecordSchema = z
  .object({
    custom: z
      .record(z.string())
      .optional()
      .describe('Custom metadata passed with the request'),
    contact: EnrichedContactSchema.optional().describe(
      'Enriched contact information'
    ),
  })
  .describe('Single enrichment result record');

/**
 * Cost information for an enrichment
 */
export const CostSchema = z
  .object({
    credits: z.number().optional().describe('Number of credits consumed'),
  })
  .describe('Credit cost information');

// ============================================================================
// REQUEST CONTACT SCHEMA (for bulk enrichment)
// ============================================================================

/**
 * Contact to be enriched
 */
export const ContactToEnrichSchema = z
  .object({
    firstname: z
      .string()
      .optional()
      .describe('First name of the contact (required if no linkedin_url)'),
    lastname: z
      .string()
      .optional()
      .describe('Last name of the contact (required if no linkedin_url)'),
    domain: z
      .string()
      .optional()
      .describe('Company domain (e.g., example.com)'),
    company_name: z.string().optional().describe('Company name'),
    linkedin_url: z
      .string()
      .optional()
      .describe(
        'LinkedIn profile URL (e.g., https://www.linkedin.com/in/johndoe/) - improves enrichment rates significantly'
      ),
    enrich_fields: z
      .array(EnrichFieldEnum)
      .optional()
      .default(['contact.emails'])
      .describe(
        'Fields to enrich: contact.emails (1 credit), contact.personal_emails (3 credits). Defaults to work emails only.'
      ),
    custom: z
      .record(z.string())
      .optional()
      .describe(
        'Custom metadata to pass through (e.g., CRM contact_id). Max 10 keys, 100 chars per value.'
      ),
  })
  .describe('Contact information to enrich');

// ============================================================================
// PARAMETERS SCHEMA (Discriminated Union)
// ============================================================================

export const FullEnrichParamsSchema = z.discriminatedUnion('operation', [
  // Start Bulk Enrichment
  z.object({
    operation: z
      .literal('start_bulk_enrichment')
      .describe(
        'Start enrichment for up to 100 contacts. Results delivered via webhook or polling.'
      ),
    name: z
      .string()
      .min(1, 'Enrichment name is required')
      .describe(
        'Name for this enrichment batch (appears in FullEnrich dashboard for easy search)'
      ),
    webhook_url: z
      .string()
      .optional()
      .describe(
        'Webhook URL to receive results when enrichment completes. Recommended over polling.'
      ),
    contacts: z
      .array(ContactToEnrichSchema)
      .min(1, 'At least one contact is required')
      .max(100, 'Maximum 100 contacts per batch')
      .describe('List of contacts to enrich (1-100 contacts)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get Enrichment Result
  z.object({
    operation: z
      .literal('get_enrichment_result')
      .describe(
        'Retrieve results of a bulk enrichment. Use webhook instead for real-time updates.'
      ),
    enrichment_id: z
      .string()
      .uuid('Enrichment ID must be a valid UUID')
      .describe('UUID of the enrichment to retrieve'),
    force_results: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Return partial results even if enrichment is incomplete (may yield incomplete data)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Start Reverse Email Lookup
  z.object({
    operation: z
      .literal('start_reverse_email_lookup')
      .describe(
        'Find contact info from email addresses. 1 credit per successful match.'
      ),
    name: z
      .string()
      .min(1, 'Lookup name is required')
      .describe('Name for this reverse lookup batch'),
    webhook_url: z
      .string()
      .optional()
      .describe(
        'Webhook URL to receive results when lookup completes. Recommended over polling.'
      ),
    emails: z
      .array(z.string().email('Each item must be a valid email address'))
      .min(1, 'At least one email is required')
      .describe('List of email addresses to look up'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get Reverse Email Result
  z.object({
    operation: z
      .literal('get_reverse_email_result')
      .describe('Retrieve results of a reverse email lookup'),
    reverse_email_id: z
      .string()
      .uuid('Reverse email ID must be a valid UUID')
      .describe('UUID of the reverse email lookup to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get Credit Balance
  z.object({
    operation: z
      .literal('get_credit_balance')
      .describe('Get current credit balance for your workspace'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Check API Key
  z.object({
    operation: z
      .literal('check_api_key')
      .describe('Verify if your API key is valid'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// ============================================================================
// RESULT SCHEMAS (Discriminated Union)
// ============================================================================

export const FullEnrichResultSchema = z.discriminatedUnion('operation', [
  // Start Bulk Enrichment Result
  z.object({
    operation: z.literal('start_bulk_enrichment'),
    success: z.boolean().describe('Whether the operation was successful'),
    enrichment_id: z
      .string()
      .uuid()
      .optional()
      .describe('UUID of the created enrichment batch'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get Enrichment Result
  z.object({
    operation: z.literal('get_enrichment_result'),
    success: z.boolean().describe('Whether the operation was successful'),
    id: z.string().uuid().optional().describe('Enrichment ID'),
    name: z.string().optional().describe('Enrichment name'),
    status: EnrichmentStatusEnum.optional().describe('Enrichment status'),
    results: z
      .array(EnrichmentRecordSchema)
      .optional()
      .describe('Enriched contact records'),
    cost: CostSchema.optional().describe('Credit cost information'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Start Reverse Email Lookup Result
  z.object({
    operation: z.literal('start_reverse_email_lookup'),
    success: z.boolean().describe('Whether the operation was successful'),
    enrichment_id: z
      .string()
      .uuid()
      .optional()
      .describe('UUID of the created reverse email lookup'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get Reverse Email Result
  z.object({
    operation: z.literal('get_reverse_email_result'),
    success: z.boolean().describe('Whether the operation was successful'),
    id: z.string().uuid().optional().describe('Reverse email lookup ID'),
    name: z.string().optional().describe('Lookup name'),
    status: EnrichmentStatusEnum.optional().describe('Lookup status'),
    results: z
      .array(
        z.object({
          input: z.string().optional().describe('Email address submitted'),
          contact: EnrichedContactSchema.optional().describe(
            'Contact information found'
          ),
        })
      )
      .optional()
      .describe('Reverse email lookup results'),
    cost: CostSchema.optional().describe('Credit cost information'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get Credit Balance Result
  z.object({
    operation: z.literal('get_credit_balance'),
    success: z.boolean().describe('Whether the operation was successful'),
    balance: z.number().optional().describe('Current credit balance'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Check API Key Result
  z.object({
    operation: z.literal('check_api_key'),
    success: z.boolean().describe('Whether the operation was successful'),
    workspace_id: z
      .string()
      .optional()
      .describe('Workspace ID if key is valid'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type FullEnrichParamsInput = z.input<typeof FullEnrichParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation)
export type FullEnrichParams = z.output<typeof FullEnrichParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type FullEnrichResult = z.output<typeof FullEnrichResultSchema>;

// Operation-specific types for internal method parameters
export type StartBulkEnrichmentParams = Extract<
  FullEnrichParams,
  { operation: 'start_bulk_enrichment' }
>;
export type GetEnrichmentResultParams = Extract<
  FullEnrichParams,
  { operation: 'get_enrichment_result' }
>;
export type StartReverseEmailLookupParams = Extract<
  FullEnrichParams,
  { operation: 'start_reverse_email_lookup' }
>;
export type GetReverseEmailResultParams = Extract<
  FullEnrichParams,
  { operation: 'get_reverse_email_result' }
>;
export type GetCreditBalanceParams = Extract<
  FullEnrichParams,
  { operation: 'get_credit_balance' }
>;
export type CheckApiKeyParams = Extract<
  FullEnrichParams,
  { operation: 'check_api_key' }
>;
