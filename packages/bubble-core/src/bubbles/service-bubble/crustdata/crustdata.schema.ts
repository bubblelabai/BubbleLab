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

// ==========================================
// PersonDB In-Database Search Schemas
// ==========================================

// Filter operator types for PersonDB search
export const PersonDBFilterOperatorSchema = z.enum([
  '=', // Exact match (case-insensitive for text)
  '!=', // Not equal
  'in', // Matches any value in list (case-sensitive)
  'not_in', // Doesn't match any value in list
  '>', // Greater than
  '<', // Less than
  '=>', // Greater than or equal
  '=<', // Less than or equal
  '(.)', // Fuzzy text search (allows typos)
  '[.]', // Substring matching (no typos)
  'geo_distance', // Geographic radius search
]);

// Geo distance value for location-based filtering
export const GeoDistanceValueSchema = z.object({
  location: z
    .string()
    .describe('Center point location name (e.g., "San Francisco")'),
  distance: z.number().positive().describe('Radius distance'),
  unit: z
    .enum(['km', 'mi', 'miles', 'm', 'meters', 'ft', 'feet'])
    .default('km')
    .optional()
    .describe('Distance unit (default: km)'),
});

// Single filter condition for PersonDB search
export const PersonDBFilterConditionSchema = z.object({
  column: z
    .string()
    .describe('Field to filter on (e.g., "current_employers.title", "region")'),
  type: PersonDBFilterOperatorSchema.describe('Filter operator'),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
      GeoDistanceValueSchema,
    ])
    .describe('Value(s) to match'),
});

// Recursive filter group schema for complex AND/OR logic
export const PersonDBFilterGroupSchema: z.ZodType<PersonDBFilterGroup> = z.lazy(
  () =>
    z.object({
      op: z
        .enum(['and', 'or'])
        .describe('Logical operator to combine conditions'),
      conditions: z
        .array(
          z.union([PersonDBFilterConditionSchema, PersonDBFilterGroupSchema])
        )
        .describe('Array of conditions or nested groups'),
    })
);

// Combined filter type (can be single condition or group)
export const PersonDBFiltersSchema = z.union([
  PersonDBFilterConditionSchema,
  PersonDBFilterGroupSchema,
]);

// Sort criteria for PersonDB search
export const PersonDBSortSchema = z.object({
  column: z
    .string()
    .describe(
      'Field to sort by (e.g., "years_of_experience_raw", "num_of_connections")'
    ),
  order: z.enum(['asc', 'desc']).describe('Sort order'),
});

// Post-processing options for PersonDB search
export const PersonDBPostProcessingSchema = z.object({
  exclude_profiles: z
    .array(z.string())
    .max(50000)
    .optional()
    .describe('LinkedIn profile URLs to exclude (max 50,000)'),
  exclude_names: z
    .array(z.string())
    .optional()
    .describe('Names to exclude from results'),
});

// Employer schema for PersonDB profiles
export const PersonDBEmployerSchema = z
  .object({
    title: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
    name: z.string().nullable().optional(), // Alternative to company_name
    linkedin_id: z.string().nullable().optional(),
    company_linkedin_profile_url: z.string().nullable().optional(),
    company_website_domain: z.string().nullable().optional(),
    company_hq_location: z.string().nullable().optional(),
    company_type: z.string().nullable().optional(),
    company_headcount_latest: z.number().nullable().optional(),
    company_headcount_range: z.string().nullable().optional(),
    company_industries: z.array(z.string()).nullable().optional(),
    seniority_level: z.string().nullable().optional(),
    function_category: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    years_at_company_raw: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
  })
  .passthrough();

// Education schema for PersonDB profiles
export const PersonDBEducationSchema = z
  .object({
    degree_name: z.string().nullable().optional(),
    institute_name: z.string().nullable().optional(),
    field_of_study: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
  })
  .passthrough();

// Location details schema
export const PersonDBLocationDetailsSchema = z
  .object({
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    continent: z.string().nullable().optional(),
  })
  .passthrough();

// PersonDB profile result schema (comprehensive)
export const PersonDBProfileSchema = z
  .object({
    person_id: z.number().optional(),
    name: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    location_details: PersonDBLocationDetailsSchema.nullable().optional(),
    location_city: z.string().nullable().optional(),
    location_state: z.string().nullable().optional(),
    location_country: z.string().nullable().optional(),
    linkedin_profile_url: z.string().nullable().optional(),
    flagship_profile_url: z.string().nullable().optional(),
    profile_picture_url: z.string().nullable().optional(),
    num_of_connections: z.number().nullable().optional(),
    years_of_experience_raw: z.number().nullable().optional(),
    recently_changed_jobs: z.boolean().nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    languages: z.array(z.string()).nullable().optional(),
    // Employment data
    current_employers: z.array(PersonDBEmployerSchema).nullable().optional(),
    past_employers: z.array(PersonDBEmployerSchema).nullable().optional(),
    all_employers: z.array(PersonDBEmployerSchema).nullable().optional(),
    // Education
    education_background: z
      .array(PersonDBEducationSchema)
      .nullable()
      .optional(),
    // Certifications and honors
    certifications: z
      .array(
        z
          .object({
            name: z.string().nullable().optional(),
            issued_date: z.string().nullable().optional(),
            issuing_authority: z.string().nullable().optional(),
          })
          .passthrough()
      )
      .nullable()
      .optional(),
    honors: z
      .array(
        z
          .object({
            title: z.string().nullable().optional(),
            issued_date: z.string().nullable().optional(),
            issuer: z.string().nullable().optional(),
          })
          .passthrough()
      )
      .nullable()
      .optional(),
    // Contact info (if available)
    emails: z.array(z.string()).nullable().optional(),
    websites: z.array(z.string()).nullable().optional(),
    twitter_handle: z.string().nullable().optional(),
  })
  .passthrough()
  .describe('PersonDB profile from Crustdata in-database search');

// Type for recursive filter group
export interface PersonDBFilterGroup {
  op: 'and' | 'or';
  conditions: Array<
    z.infer<typeof PersonDBFilterConditionSchema> | PersonDBFilterGroup
  >;
}

// Company info schema for enriched company data
export const CompanyInfoSchema = z
  .object({
    name: z.string().nullable().optional(),
    linkedin_id: z.string().nullable().optional(), // API returns string
    linkedin_profile_url: z.string().nullable().optional(),
    company_website_domain: z.string().nullable().optional(),
    company_website: z.string().nullable().optional(),
    hq_country: z.string().nullable().optional(),
    hq_city: z.string().nullable().optional(),
    year_founded: z.string().nullable().optional(), // API returns string
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

  // PersonDB Search operation - in-database people search (3 credits per 100 results)
  z.object({
    operation: z
      .literal('person_search_db')
      .describe(
        'Search people in database with advanced filtering (3 credits per 100 results)'
      ),
    filters: PersonDBFiltersSchema.describe(
      'Filter conditions - single condition or nested AND/OR groups'
    ),
    sorts: z
      .array(PersonDBSortSchema)
      .optional()
      .describe('Sort criteria to order results'),
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor from previous response'),
    limit: z
      .number()
      .max(1000)
      .default(20)
      .optional()
      .describe('Results per page (default: 20, max: 1,000)'),
    preview: z
      .boolean()
      .default(false)
      .optional()
      .describe('Preview mode returns basic profile details (0 credits)'),
    post_processing: PersonDBPostProcessingSchema.optional().describe(
      'Post-processing options like excluding profiles or names'
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

  // PersonDB Search operation result
  z.object({
    operation: z
      .literal('person_search_db')
      .describe('PersonDB search operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    profiles: z
      .array(PersonDBProfileSchema)
      .optional()
      .describe('Array of people profiles found'),
    total_count: z
      .number()
      .optional()
      .describe('Total number of profiles matching the search criteria'),
    next_cursor: z
      .string()
      .optional()
      .describe('Cursor for fetching the next page of results'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type CrustdataResult = z.output<typeof CrustdataResultSchema>;
export type CrustdataParams = z.output<typeof CrustdataParamsSchema>;
export type CrustdataParamsInput = z.input<typeof CrustdataParamsSchema>;
export type PersonProfile = z.infer<typeof PersonProfileSchema>;
export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;
export type IdentifyResultItem = z.infer<typeof IdentifyResultItemSchema>;

// PersonDB types
export type PersonDBFilterCondition = z.infer<
  typeof PersonDBFilterConditionSchema
>;
export type PersonDBFilters = z.infer<typeof PersonDBFiltersSchema>;
export type PersonDBSort = z.infer<typeof PersonDBSortSchema>;
export type PersonDBPostProcessing = z.infer<
  typeof PersonDBPostProcessingSchema
>;
export type PersonDBProfile = z.infer<typeof PersonDBProfileSchema>;
export type PersonDBEmployer = z.infer<typeof PersonDBEmployerSchema>;
export type PersonDBEducation = z.infer<typeof PersonDBEducationSchema>;
export type PersonDBLocationDetails = z.infer<
  typeof PersonDBLocationDetailsSchema
>;
export type GeoDistanceValue = z.infer<typeof GeoDistanceValueSchema>;
export type PersonDBFilterOperator = z.infer<
  typeof PersonDBFilterOperatorSchema
>;
