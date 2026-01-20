import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import {
  CrustdataBubble,
  type PersonDBProfile,
  type PersonDBFilters,
  type PersonDBFilterCondition,
  type PersonDBFilterGroup,
} from '../service-bubble/crustdata/index.js';

// Simplified person result schema with full profile information
const PersonResultSchema = z.object({
  // Basic info
  name: z.string().nullable().describe('Full name'),
  title: z.string().nullable().describe('Current job title'),
  headline: z.string().nullable().describe('LinkedIn headline'),
  linkedinUrl: z.string().nullable().describe('LinkedIn profile URL'),
  profilePictureUrl: z.string().nullable().describe('Profile picture URL'),

  // Contact info
  emails: z.array(z.string()).nullable().describe('Email addresses'),
  twitterHandle: z.string().nullable().describe('Twitter/X handle'),
  websites: z
    .array(z.string())
    .nullable()
    .describe('Personal/professional websites'),

  // Classification
  seniorityLevel: z
    .string()
    .nullable()
    .describe('Seniority level (CXO, Vice President, Director, etc.)'),
  yearsOfExperience: z
    .number()
    .nullable()
    .describe('Total years of professional experience'),
  recentlyChangedJobs: z
    .boolean()
    .nullable()
    .describe('Whether this person recently changed jobs'),

  // Location
  location: z.string().nullable().describe('Location/region'),
  locationCity: z.string().nullable().describe('City'),
  locationCountry: z.string().nullable().describe('Country'),

  // Professional background
  skills: z.array(z.string()).nullable().describe('Professional skills'),
  languages: z.array(z.string()).nullable().describe('Languages spoken'),
  summary: z.string().nullable().describe('Professional summary'),
  numConnections: z
    .number()
    .nullable()
    .describe('Number of LinkedIn connections'),

  // Work history
  currentEmployers: z
    .array(
      z.object({
        title: z.string().nullable().describe('Job title'),
        companyName: z.string().nullable().describe('Company name'),
        companyLinkedinUrl: z
          .string()
          .nullable()
          .describe('Company LinkedIn URL'),
        seniorityLevel: z.string().nullable().describe('Seniority level'),
        functionCategory: z.string().nullable().describe('Function category'),
        startDate: z.string().nullable().describe('Start date'),
        yearsAtCompany: z.number().nullable().describe('Years at company'),
        companyHeadcount: z.number().nullable().describe('Company headcount'),
        companyIndustries: z
          .array(z.string())
          .nullable()
          .describe('Company industries'),
      })
    )
    .nullable()
    .describe('Current employment'),

  pastEmployers: z
    .array(
      z.object({
        title: z.string().nullable().describe('Job title'),
        companyName: z.string().nullable().describe('Company name'),
        startDate: z.string().nullable().describe('Start date'),
        endDate: z.string().nullable().describe('End date'),
      })
    )
    .nullable()
    .describe('Past employment'),

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

// Geo distance search schema
const GeoDistanceSearchSchema = z.object({
  location: z
    .string()
    .describe('Center point location (e.g., "San Francisco", "New York City")'),
  radiusMiles: z
    .number()
    .positive()
    .describe('Search radius in miles (e.g., 75)'),
});

// Tool parameters - comprehensive, agent-friendly interface
const PeopleSearchToolParamsSchema = z.object({
  // ===== PRIMARY SEARCH CRITERIA (at least one required) =====
  companyName: z
    .string()
    .optional()
    .describe(
      'Current company name to search within (e.g., "Google", "Microsoft")'
    ),
  companyLinkedinUrl: z
    .string()
    .optional()
    .describe(
      'Company LinkedIn URL for precise matching (e.g., "https://www.linkedin.com/company/google")'
    ),
  jobTitle: z
    .string()
    .optional()
    .describe(
      'Current job title to search for (e.g., "Software Engineer", "CEO"). Use jobTitles array for multiple titles.'
    ),
  jobTitles: z
    .array(z.string())
    .optional()
    .describe(
      'Multiple job titles to search for with OR logic (e.g., ["Senior Hardware Engineer", "Technical Product Manager"]). Use this when searching for people with any of several roles.'
    ),
  location: z
    .string()
    .optional()
    .describe(
      'Location/region to filter by with fuzzy matching (e.g., "San Francisco Bay Area", "New York")'
    ),

  // ===== GEO RADIUS SEARCH =====
  locationRadius: GeoDistanceSearchSchema.optional().describe(
    'Geographic radius search - find people within X miles of a location'
  ),

  // ===== SKILLS & EXPERIENCE =====
  skills: z
    .array(z.string())
    .optional()
    .describe(
      'Skills to filter by (e.g., ["Python", "Machine Learning", "React"])'
    ),
  languages: z
    .array(z.string())
    .optional()
    .describe('Languages spoken (e.g., ["English", "Spanish", "Mandarin"])'),
  minYearsExperience: z
    .number()
    .optional()
    .describe('Minimum total years of professional experience'),
  maxYearsExperience: z
    .number()
    .optional()
    .describe('Maximum total years of professional experience'),

  // ===== SENIORITY & FUNCTION =====
  seniorityLevels: z
    .array(z.string())
    .optional()
    .describe(
      'Seniority levels (e.g., ["CXO", "Vice President", "Director", "Manager", "Senior", "Entry"])'
    ),
  functionCategories: z
    .array(z.string())
    .optional()
    .describe(
      'Job function categories (e.g., ["Engineering", "Sales", "Marketing", "Finance", "Operations", "HR"])'
    ),

  // ===== COMPANY FILTERS =====
  companyIndustries: z
    .array(z.string())
    .optional()
    .describe(
      'Company industries to filter by (e.g., ["Technology", "Healthcare", "Finance"])'
    ),
  minCompanyHeadcount: z
    .number()
    .optional()
    .describe(
      'Minimum company employee count (e.g., 100 for companies with 100+ employees)'
    ),
  maxCompanyHeadcount: z
    .number()
    .optional()
    .describe(
      'Maximum company employee count (e.g., 1000 for companies under 1000 employees)'
    ),
  minYearsAtCompany: z
    .number()
    .optional()
    .describe('Minimum years at current company (tenure filter)'),

  // ===== PAST EMPLOYMENT =====
  pastCompanyName: z
    .string()
    .optional()
    .describe(
      'Past company name - find people who previously worked at a company'
    ),
  pastJobTitle: z
    .string()
    .optional()
    .describe(
      'Past job title - find people who previously held a specific title'
    ),

  // ===== EDUCATION =====
  schoolName: z
    .string()
    .optional()
    .describe('School/university name (e.g., "Stanford University", "MIT")'),

  // ===== LOCATION SPECIFICS =====
  country: z
    .string()
    .optional()
    .describe(
      'Country to filter by (e.g., "United States", "United Kingdom", "Germany")'
    ),
  city: z
    .string()
    .optional()
    .describe(
      'City to filter by (e.g., "San Francisco", "New York", "London")'
    ),

  // ===== STATUS FILTERS =====
  recentlyChangedJobs: z
    .boolean()
    .optional()
    .describe(
      'Filter to people who recently changed jobs (useful for outreach)'
    ),
  minConnections: z
    .number()
    .optional()
    .describe('Minimum number of LinkedIn connections'),

  // ===== EXCLUSIONS =====
  excludeCompanies: z
    .array(z.string())
    .optional()
    .describe('Company names to exclude from results'),
  excludeProfiles: z
    .array(z.string())
    .optional()
    .describe('LinkedIn profile URLs to exclude from results'),

  // ===== PAGINATION =====
  limit: z
    .number()
    .max(100)
    .default(20)
    .optional()
    .describe('Maximum results to return (default: 20, max: 100)'),

  // Credentials (auto-injected)
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Tool result schema
const PeopleSearchToolResultSchema = z.object({
  people: z.array(PersonResultSchema).describe('List of people found'),
  totalCount: z.number().describe('Total number of people available'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Type definitions
type PeopleSearchToolParams = z.output<typeof PeopleSearchToolParamsSchema>;
type PeopleSearchToolResult = z.output<typeof PeopleSearchToolResultSchema>;
type PeopleSearchToolParamsInput = z.input<typeof PeopleSearchToolParamsSchema>;
export type PersonResult = z.output<typeof PersonResultSchema>;
export type PeopleSearchResult = PeopleSearchToolResult;

/**
 * People Search Tool
 *
 * Agent-friendly tool for searching and discovering professionals.
 * Uses the Crustdata PersonDB in-database search API for fast, comprehensive results.
 *
 * Features:
 * - Search by company name/URL, job title, location, or skills
 * - Filter by seniority level (CXO, VP, Director, etc.)
 * - Filter by years of experience
 * - Full profiles with work history and education
 * - Exclude specific companies or profiles
 *
 * Use cases:
 * - Find specific professionals at a company
 * - Search for people by job title across companies
 * - Discover professionals with specific skills
 * - Find senior executives (CXOs, VPs, Directors)
 * - Sales prospecting and lead generation
 *
 * Credits: 3 credits per 100 results returned
 */
export class PeopleSearchTool extends ToolBubble<
  PeopleSearchToolParams,
  PeopleSearchToolResult
> {
  static readonly bubbleName: BubbleName = 'people-search-tool';
  static readonly schema = PeopleSearchToolParamsSchema;
  static readonly resultSchema = PeopleSearchToolResultSchema;
  static readonly shortDescription =
    'Comprehensive people search by company, title, location, skills, and more';
  static readonly longDescription = `
    Comprehensive people search tool for finding and discovering professionals.
    Uses the Crustdata PersonDB in-database search for fast, comprehensive results.

    **SEARCH CRITERIA (at least one required):**
    - Company: companyName, companyLinkedinUrl, pastCompanyName
    - Job Title: jobTitle (single), jobTitles (multiple with OR logic), pastJobTitle
    - Location: location (fuzzy), locationRadius (geo search), country, city
    - Skills & Experience: skills, languages, minYearsExperience, maxYearsExperience
    - Seniority & Function: seniorityLevels, functionCategories
    - Company Attributes: companyIndustries, minCompanyHeadcount, maxCompanyHeadcount
    - Education: schoolName
    - Status: recentlyChangedJobs, minConnections, minYearsAtCompany

    **GEO RADIUS SEARCH:**
    Use locationRadius to find people within X miles of a location:
    - locationRadius: { location: "San Francisco", radiusMiles: 75 }
    - locationRadius: { location: "New York City", radiusMiles: 50 }

    **WHAT YOU GET:**
    - Full name, current title, and headline
    - LinkedIn profile URL and email addresses
    - Complete current and past work history with company details
    - Education background with degrees and fields of study
    - Skills, languages, seniority level, and years of experience
    - Location details (city, country, region)

    **EXAMPLE USE CASES:**
    - companyName: "Stripe" → find people currently at Stripe
    - jobTitle: "CEO", seniorityLevels: ["CXO"] → find CEOs
    - jobTitles: ["Senior Hardware Engineer", "Technical Product Manager"] → find people with either role
    - locationRadius: { location: "Austin", radiusMiles: 75 }, jobTitle: "Engineer" → engineers within 75 miles of Austin
    - pastCompanyName: "Google", companyName: "Startup" → ex-Googlers at startups
    - skills: ["Python", "ML"], minYearsExperience: 5 → experienced ML engineers
    - companyIndustries: ["Healthcare"], functionCategories: ["Sales"] → healthcare sales professionals
    - schoolName: "Stanford", seniorityLevels: ["CXO", "Vice President"] → Stanford alum executives
    - recentlyChangedJobs: true, companyName: "Meta" → recent Meta hires (good for outreach)
    - minCompanyHeadcount: 1000, maxCompanyHeadcount: 5000 → mid-size company employees

    **CREDITS:** 3 credits per 100 results returned
  `;
  static readonly alias = 'people';
  static readonly type = 'tool';

  constructor(
    params: PeopleSearchToolParamsInput = {} as PeopleSearchToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<PeopleSearchToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.CRUSTDATA_API_KEY]) {
      return this.createErrorResult(
        'People search requires CRUSTDATA_API_KEY credential. Please configure it in your settings.'
      );
    }

    try {
      const {
        // Primary search criteria
        companyName,
        companyLinkedinUrl,
        jobTitle,
        jobTitles,
        location,
        // Geo radius search
        locationRadius,
        // Skills & experience
        skills,
        languages,
        minYearsExperience,
        maxYearsExperience,
        // Seniority & function
        seniorityLevels,
        functionCategories,
        // Company filters
        companyIndustries,
        minCompanyHeadcount,
        maxCompanyHeadcount,
        minYearsAtCompany,
        // Past employment
        pastCompanyName,
        pastJobTitle,
        // Education
        schoolName,
        // Location specifics
        country,
        city,
        // Status filters
        recentlyChangedJobs,
        minConnections,
        // Exclusions
        excludeCompanies,
        excludeProfiles,
        // Pagination
        limit = 20,
      } = this.params;

      // Validate at least one search criteria is provided
      const hasSearchCriteria =
        companyName ||
        companyLinkedinUrl ||
        jobTitle ||
        (jobTitles && jobTitles.length > 0) ||
        location ||
        locationRadius ||
        (skills && skills.length > 0) ||
        (languages && languages.length > 0) ||
        minYearsExperience !== undefined ||
        maxYearsExperience !== undefined ||
        (seniorityLevels && seniorityLevels.length > 0) ||
        (functionCategories && functionCategories.length > 0) ||
        (companyIndustries && companyIndustries.length > 0) ||
        minCompanyHeadcount !== undefined ||
        maxCompanyHeadcount !== undefined ||
        minYearsAtCompany !== undefined ||
        pastCompanyName ||
        pastJobTitle ||
        schoolName ||
        country ||
        city ||
        recentlyChangedJobs !== undefined ||
        minConnections !== undefined;

      if (!hasSearchCriteria) {
        return this.createErrorResult(
          'At least one search criteria is required. Available options: companyName, companyLinkedinUrl, jobTitle, jobTitles, location, locationRadius, skills, languages, seniorityLevels, functionCategories, companyIndustries, minCompanyHeadcount, maxCompanyHeadcount, minYearsExperience, maxYearsExperience, minYearsAtCompany, pastCompanyName, pastJobTitle, schoolName, country, city, recentlyChangedJobs, minConnections'
        );
      }

      // Build filter conditions (can include both simple conditions and nested OR groups)
      const conditions: (PersonDBFilterCondition | PersonDBFilterGroup)[] = [];

      // ===== CURRENT COMPANY FILTERS =====
      if (companyLinkedinUrl) {
        conditions.push({
          column: 'current_employers.company_linkedin_profile_url',
          type: '=',
          value: companyLinkedinUrl,
        });
      } else if (companyName) {
        conditions.push({
          column: 'current_employers.name',
          type: '(.)',
          value: companyName,
        });
      }

      // Current job title(s) with fuzzy matching
      // Merge jobTitle and jobTitles into a single list, then use OR logic if multiple
      const allJobTitles: string[] = [];
      if (jobTitle) {
        allJobTitles.push(jobTitle);
      }
      if (jobTitles && jobTitles.length > 0) {
        allJobTitles.push(...jobTitles);
      }

      if (allJobTitles.length === 1) {
        // Single title - simple condition
        conditions.push({
          column: 'current_employers.title',
          type: '(.)',
          value: allJobTitles[0],
        });
      } else if (allJobTitles.length > 1) {
        // Multiple titles - OR condition group
        const titleConditions: PersonDBFilterCondition[] = allJobTitles.map(
          (title) => ({
            column: 'current_employers.title',
            type: '(.)' as const,
            value: title,
          })
        );
        conditions.push({
          op: 'or',
          conditions: titleConditions,
        } as PersonDBFilterGroup);
      }

      // ===== LOCATION FILTERS =====
      // Geo radius search takes priority over fuzzy location
      if (locationRadius) {
        conditions.push({
          column: 'region',
          type: 'geo_distance',
          value: {
            location: locationRadius.location,
            distance: locationRadius.radiusMiles,
            unit: 'mi',
          },
        });
      } else if (location) {
        conditions.push({
          column: 'region',
          type: '(.)',
          value: location,
        });
      }

      // Country filter
      if (country) {
        conditions.push({
          column: 'location_country',
          type: '(.)',
          value: country,
        });
      }

      // City filter
      if (city) {
        conditions.push({
          column: 'location_city',
          type: '(.)',
          value: city,
        });
      }

      // ===== SKILLS & EXPERIENCE FILTERS =====
      if (skills && skills.length > 0) {
        conditions.push({
          column: 'skills',
          type: 'in',
          value: skills,
        });
      }

      if (languages && languages.length > 0) {
        conditions.push({
          column: 'languages',
          type: 'in',
          value: languages,
        });
      }

      if (minYearsExperience !== undefined) {
        conditions.push({
          column: 'years_of_experience_raw',
          type: '=>',
          value: minYearsExperience,
        });
      }

      if (maxYearsExperience !== undefined) {
        conditions.push({
          column: 'years_of_experience_raw',
          type: '=<',
          value: maxYearsExperience,
        });
      }

      // ===== SENIORITY & FUNCTION FILTERS =====
      if (seniorityLevels && seniorityLevels.length > 0) {
        conditions.push({
          column: 'current_employers.seniority_level',
          type: 'in',
          value: seniorityLevels,
        });
      }

      if (functionCategories && functionCategories.length > 0) {
        conditions.push({
          column: 'current_employers.function_category',
          type: 'in',
          value: functionCategories,
        });
      }

      // ===== COMPANY ATTRIBUTE FILTERS =====
      if (companyIndustries && companyIndustries.length > 0) {
        conditions.push({
          column: 'current_employers.company_industries',
          type: 'in',
          value: companyIndustries,
        });
      }

      if (minCompanyHeadcount !== undefined) {
        conditions.push({
          column: 'current_employers.company_headcount_latest',
          type: '=>',
          value: minCompanyHeadcount,
        });
      }

      if (maxCompanyHeadcount !== undefined) {
        conditions.push({
          column: 'current_employers.company_headcount_latest',
          type: '=<',
          value: maxCompanyHeadcount,
        });
      }

      if (minYearsAtCompany !== undefined) {
        conditions.push({
          column: 'current_employers.years_at_company_raw',
          type: '=>',
          value: minYearsAtCompany,
        });
      }

      // ===== PAST EMPLOYMENT FILTERS =====
      if (pastCompanyName) {
        conditions.push({
          column: 'past_employers.name',
          type: '(.)',
          value: pastCompanyName,
        });
      }

      if (pastJobTitle) {
        conditions.push({
          column: 'past_employers.title',
          type: '(.)',
          value: pastJobTitle,
        });
      }

      // ===== EDUCATION FILTERS =====
      if (schoolName) {
        conditions.push({
          column: 'education_background.institute_name',
          type: '(.)',
          value: schoolName,
        });
      }

      // ===== STATUS FILTERS =====
      if (recentlyChangedJobs !== undefined) {
        conditions.push({
          column: 'recently_changed_jobs',
          type: '=',
          value: recentlyChangedJobs,
        });
      }

      if (minConnections !== undefined) {
        conditions.push({
          column: 'num_of_connections',
          type: '=>',
          value: minConnections,
        });
      }

      // ===== EXCLUSION FILTERS =====
      if (excludeCompanies && excludeCompanies.length > 0) {
        conditions.push({
          column: 'current_employers.name',
          type: 'not_in',
          value: excludeCompanies,
        });
      }

      // Build the filter structure
      let filters: PersonDBFilters;
      if (conditions.length === 1) {
        filters = conditions[0];
      } else {
        filters = {
          op: 'and',
          conditions,
        } as PersonDBFilterGroup;
      }

      // Build post-processing options
      const postProcessing = excludeProfiles?.length
        ? { exclude_profiles: excludeProfiles }
        : undefined;

      // Call the Crustdata PersonDB search API
      const searchBubble = new CrustdataBubble(
        {
          operation: 'person_search_db',
          filters,
          limit,
          post_processing: postProcessing,
          credentials,
        },
        this.context
      );

      const searchResult = await searchBubble.action();

      if (!searchResult.data.success) {
        return this.createErrorResult(
          `Search failed: ${searchResult.data.error}`
        );
      }

      // Type assertion for person_search_db result
      const personSearchData = searchResult.data as {
        operation: 'person_search_db';
        success: boolean;
        profiles?: PersonDBProfile[];
        total_count?: number;
        next_cursor?: string;
        error: string;
      };

      // Transform results
      const people = this.transformProfiles(personSearchData.profiles || []);

      return {
        people,
        totalCount: personSearchData.total_count || people.length,
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
   * Transform API profiles to simplified format
   */
  private transformProfiles(profiles: PersonDBProfile[]): PersonResult[] {
    return profiles.map((profile) => this.transformProfile(profile));
  }

  /**
   * Transform a single PersonDB profile to PersonResult format
   */
  private transformProfile(profile: PersonDBProfile): PersonResult {
    // Get current employer info for title and seniority
    const currentEmployer = profile.current_employers?.[0];

    // Transform current employers
    const currentEmployers = profile.current_employers
      ? profile.current_employers.map((emp) => ({
          title: emp.title || null,
          companyName: emp.company_name || emp.name || null,
          companyLinkedinUrl: emp.company_linkedin_profile_url || null,
          seniorityLevel: emp.seniority_level || null,
          functionCategory: emp.function_category || null,
          startDate: emp.start_date || null,
          yearsAtCompany: emp.years_at_company_raw || null,
          companyHeadcount: emp.company_headcount_latest || null,
          companyIndustries: emp.company_industries || null,
        }))
      : null;

    // Transform past employers
    const pastEmployers = profile.past_employers
      ? profile.past_employers.map((emp) => ({
          title: emp.title || null,
          companyName: emp.company_name || emp.name || null,
          startDate: emp.start_date || null,
          endDate: emp.end_date || null,
        }))
      : null;

    // Transform education
    const education = profile.education_background
      ? profile.education_background.map((edu) => ({
          instituteName: edu.institute_name || null,
          degreeName: edu.degree_name || null,
          fieldOfStudy: edu.field_of_study || null,
        }))
      : null;

    return {
      name: profile.name || null,
      title: currentEmployer?.title || null,
      headline: profile.headline || null,
      linkedinUrl:
        profile.linkedin_profile_url || profile.flagship_profile_url || null,
      profilePictureUrl: profile.profile_picture_url || null,
      emails: profile.emails || null,
      twitterHandle: profile.twitter_handle || null,
      websites: profile.websites || null,
      seniorityLevel: currentEmployer?.seniority_level || null,
      yearsOfExperience: profile.years_of_experience_raw || null,
      recentlyChangedJobs: profile.recently_changed_jobs || null,
      location: profile.region || null,
      locationCity:
        profile.location_city || profile.location_details?.city || null,
      locationCountry:
        profile.location_country || profile.location_details?.country || null,
      skills: profile.skills || null,
      languages: profile.languages || null,
      summary: profile.summary || null,
      numConnections: profile.num_of_connections || null,
      currentEmployers,
      pastEmployers,
      education,
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(errorMessage: string): PeopleSearchToolResult {
    return {
      people: [],
      totalCount: 0,
      success: false,
      error: errorMessage,
    };
  }
}
