import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Person profile schema for decision makers, CXOs, and founders
export const PersonProfileSchema = z
  .object({
    linkedin_profile_url: z.string().nullable().optional(),
    linkedin_flagship_url: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    profile_picture_url: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    twitter_handle: z.string().nullable().optional(),
    github_profile_id: z.string().nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    languages: z.array(z.string()).nullable().optional(),
    summary: z.string().nullable().optional(),
    // Employment history
    current_positions: z
      .array(
        z.object({
          title: z.string().nullable().optional(),
          company_name: z.string().nullable().optional(),
          company_linkedin_url: z.string().nullable().optional(),
          start_date: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
        })
      )
      .nullable()
      .optional(),
    past_positions: z
      .array(
        z.object({
          title: z.string().nullable().optional(),
          company_name: z.string().nullable().optional(),
          start_date: z.string().nullable().optional(),
          end_date: z.string().nullable().optional(),
        })
      )
      .nullable()
      .optional(),
    // Education
    education: z
      .array(
        z.object({
          institute_name: z.string().nullable().optional(),
          degree_name: z.string().nullable().optional(),
          field_of_study: z.string().nullable().optional(),
        })
      )
      .nullable()
      .optional(),
  })
  .passthrough()
  .describe('Person profile from Crustdata');

// Company info schema for enriched company data
export const CompanyInfoSchema = z
  .object({
    name: z.string().nullable().optional(),
    linkedin_id: z.number().nullable().optional(),
    linkedin_profile_url: z.string().nullable().optional(),
    company_website_domain: z.string().nullable().optional(),
    company_website: z.string().nullable().optional(),
    hq_country: z.string().nullable().optional(),
    hq_city: z.string().nullable().optional(),
    year_founded: z.number().nullable().optional(),
    headcount: z.number().nullable().optional(),
    linkedin_headcount: z.number().nullable().optional(),
    linkedin_followers: z.number().nullable().optional(),
    industry: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    all_industries: z.array(z.string()).nullable().optional(),
    estimated_revenue: z.string().nullable().optional(),
    funding_stage: z.string().nullable().optional(),
    total_funding: z.string().nullable().optional(),
    last_funding_round_date: z.string().nullable().optional(),
    last_funding_round_type: z.string().nullable().optional(),
  })
  .passthrough()
  .describe('Company information from Crustdata');

// Define the parameters schema for Crustdata operations
export const CrustdataParamsSchema = z.discriminatedUnion('operation', [
  // Identify operation - resolve company identifier to company_id (FREE)
  z.object({
    operation: z
      .literal('identify')
      .describe('Identify a company and get its Crustdata ID (FREE)'),
    query_company_name: z
      .string()
      .optional()
      .describe('Company name to search for'),
    query_company_website: z
      .string()
      .optional()
      .describe('Company website domain (e.g., "stripe.com")'),
    query_company_linkedin_url: z
      .string()
      .optional()
      .describe('Company LinkedIn URL'),
    count: z
      .number()
      .max(25)
      .default(1)
      .optional()
      .describe('Maximum number of results to return (default: 1, max: 25)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Enrich operation - get company data with specified fields (1 credit)
  z.object({
    operation: z
      .literal('enrich')
      .describe('Enrich company data with contacts (1 credit)'),
    company_domain: z
      .string()
      .optional()
      .describe('Company website domain (e.g., "stripe.com")'),
    company_linkedin_url: z
      .string()
      .optional()
      .describe('Company LinkedIn URL'),
    company_id: z
      .number()
      .optional()
      .describe('Crustdata company ID (from identify operation)'),
    fields: z
      .string()
      .default('decision_makers,cxos,founders.profiles')
      .optional()
      .describe(
        'Comma-separated fields to retrieve (default: "decision_makers,cxos,founders.profiles")'
      ),
    enrich_realtime: z
      .boolean()
      .default(false)
      .optional()
      .describe(
        'If true, fetch fresh data from LinkedIn (slower but more accurate)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Identify result - single company match
export const IdentifyResultItemSchema = z
  .object({
    company_id: z.number().nullable().optional(),
    company_name: z.string().nullable().optional(),
    linkedin_profile_url: z.string().nullable().optional(),
    company_website_domain: z.string().nullable().optional(),
    linkedin_headcount: z.number().nullable().optional(),
    score: z.number().nullable().optional(),
  })
  .passthrough()
  .describe('Company identification result');

// Define result schemas for different operations
export const CrustdataResultSchema = z.discriminatedUnion('operation', [
  // Identify operation result
  z.object({
    operation: z
      .literal('identify')
      .describe('Company identification operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    results: z
      .array(IdentifyResultItemSchema)
      .optional()
      .describe('Array of matching companies'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Enrich operation result
  z.object({
    operation: z.literal('enrich').describe('Company enrichment operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    company: CompanyInfoSchema.nullable()
      .optional()
      .describe('Enriched company information'),
    decision_makers: z
      .array(PersonProfileSchema)
      .nullable()
      .optional()
      .describe('Decision makers at the company'),
    cxos: z
      .array(PersonProfileSchema)
      .nullable()
      .optional()
      .describe('C-level executives at the company'),
    founders: z
      .object({
        profiles: z.array(PersonProfileSchema).nullable().optional(),
      })
      .nullable()
      .optional()
      .describe('Founders of the company'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type CrustdataResult = z.output<typeof CrustdataResultSchema>;
export type CrustdataParams = z.output<typeof CrustdataParamsSchema>;
export type CrustdataParamsInput = z.input<typeof CrustdataParamsSchema>;
export type PersonProfile = z.infer<typeof PersonProfileSchema>;
export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;
export type IdentifyResultItem = z.infer<typeof IdentifyResultItemSchema>;
