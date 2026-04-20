import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import {
  CrustdataBubble,
  PersonFunctionEnum,
  PersonSeniorityLevelEnum,
  type PersonDBProfile,
  type PersonDBFilters,
  type PersonDBFilterCondition,
  type PersonDBFilterGroup,
} from '../service-bubble/crustdata/index.js';
import { FullEnrichBubble } from '../service-bubble/fullenrich/index.js';
import {
  normalizeSeniorityLevels,
  normalizeFunctionCategories,
} from './people-search-utils.js';

/**
 * Sanitizes a LinkedIn URL by removing trailing slashes and normalizing the format.
 *
 * @param url - LinkedIn URL to sanitize
 * @returns Sanitized URL without trailing slashes, or null if invalid
 */
function sanitizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Trim whitespace
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Remove trailing slashes
  const sanitized = trimmed.replace(/\/+$/, '');

  // Basic validation: should be a LinkedIn URL
  if (!sanitized.includes('linkedin.com')) {
    return sanitized; // Return as-is if not a LinkedIn URL (let API handle validation)
  }

  return sanitized;
}

/**
 * Translate the tool's Crustdata-flavored seniority vocabulary to the values
 * FullEnrich's /people/search actually accepts. FullEnrich's seniority enum is:
 *   Owner, Founder, C-level, Partner, VP, Head, Director, Manager, Senior.
 *
 * Unknown inputs are passed through unchanged — FullEnrich accepts the request
 * but silently ignores unrecognized seniority values, so there is nothing to
 * gain from dropping them client-side. Callers targeting seniority levels FE
 * doesn't index (e.g. "Entry Level", "In Training") will get `warnings`
 * pointing that out.
 */
function mapSeniorityToFullEnrich(values: string[]): {
  mapped: string[];
  unknown: string[];
} {
  const table: Record<string, string[]> = {
    'owner / partner': ['Owner', 'Partner'],
    owner: ['Owner'],
    partner: ['Partner'],
    cxo: ['C-level'],
    'c-level': ['C-level'],
    'vice president': ['VP'],
    vp: ['VP'],
    head: ['Head'],
    director: ['Director'],
    'experienced manager': ['Manager'],
    'entry level manager': ['Manager'],
    manager: ['Manager'],
    strategic: ['Senior'],
    senior: ['Senior'],
    founder: ['Founder'],
  };
  const feEnum = new Set([
    'Owner',
    'Founder',
    'C-level',
    'Partner',
    'VP',
    'Head',
    'Director',
    'Manager',
    'Senior',
  ]);
  const mapped = new Set<string>();
  const unknown: string[] = [];
  for (const raw of values) {
    const key = raw.trim().toLowerCase();
    const hit = table[key];
    if (hit) {
      for (const v of hit) mapped.add(v);
      continue;
    }
    if (feEnum.has(raw)) {
      mapped.add(raw);
    } else {
      unknown.push(raw);
    }
  }
  return { mapped: Array.from(mapped), unknown };
}

/**
 * Translate Crustdata-flavored function categories to FullEnrich's top-level
 * function enum (see FE docs: Functions & Subfunctions). Unknown inputs are
 * tracked so callers can see in `warnings` which values FE ignored. FE's
 * subfunctions (e.g. "Recruiting/Talent Acquisition") are also accepted — if
 * the caller passes one directly we forward it unchanged.
 */
function mapFunctionCategoryToFullEnrich(values: string[]): {
  mapped: string[];
  unknown: string[];
} {
  // Top-level FE functions — any value here passes through.
  const feFunctions = new Set([
    'Administrative',
    'Agriculture & Environment',
    'Construction & Trades',
    'Consulting & Advisory',
    'Customer Service',
    'Design',
    'Education',
    'Energy & Utilities',
    'Entertainment & Gaming',
    'Executive & Leadership',
    'Finance',
    'Hospitality & Tourism',
    'Human Resources',
    'Legal',
    'Marketing',
    'Media & Communications',
    'Medical & Health',
    'Non-Profit & Government',
    'Not Employed',
    'Operations',
    'Personal & Home Services',
    'Product',
    'Project & Program Management',
    'Public Safety & Security',
    'Research & Science',
    'Retail & Consumer',
    'Sales',
    'Software',
    'Traditional Engineering',
    'Transportation & Logistics',
  ]);
  // Crustdata → FE translation (lowercased keys).
  const table: Record<string, string> = {
    accounting: 'Finance',
    administrative: 'Administrative',
    'arts and design': 'Design',
    'business development': 'Sales',
    'community and social services': 'Non-Profit & Government',
    consulting: 'Consulting & Advisory',
    education: 'Education',
    engineering: 'Software',
    entrepreneurship: 'Executive & Leadership',
    finance: 'Finance',
    'healthcare services': 'Medical & Health',
    'human resources': 'Human Resources',
    'information technology': 'Software',
    legal: 'Legal',
    marketing: 'Marketing',
    'media and communication': 'Media & Communications',
    'military and protective services': 'Public Safety & Security',
    operations: 'Operations',
    'product management': 'Product',
    'program and project management': 'Project & Program Management',
    purchasing: 'Operations',
    'quality assurance': 'Software',
    'real estate': 'Finance',
    research: 'Research & Science',
    sales: 'Sales',
    'customer success and support': 'Customer Service',
  };
  // Subfunctions FE indexes under top-level functions — agents sometimes want
  // this precision (e.g. "Recruiting/Talent Acquisition" instead of plain
  // "Human Resources"). Accept any as-is. Sourced from FE's published
  // "Accepted Filter Values → Functions & Subfunctions".
  const feSubfunctions = new Set([
    'Recruiting/Talent Acquisition',
    'HR Business Partner',
    'HR Operations',
    'HR Leadership',
    'Learning & Development',
    'Talent Management',
    'People Analytics',
    'Compensation & Benefits',
    'Employee Relations',
    'Organizational Development',
    'Customer Success',
    'Customer Support',
    'Customer Experience',
    'Customer Operations',
    'Client Services',
    'General Customer Service',
    'Software Engineering',
    'Backend Engineering',
    'Frontend Engineering',
    'Fullstack Engineering',
    'Data Engineering/Analytics',
    'DevOps',
    'Platform Engineering',
    'Site Reliability Engineering',
    'QA/Quality',
    'Cybersecurity',
    'Security Engineering',
    'Cloud Engineering',
    'Cloud Operations',
    'Database Engineering',
    'Database Administration',
    'Mobile Engineering',
    'AI/Machine Learning',
    'Solutions Architecture',
    'Technical Writing',
    'Product Management',
    'Product Marketing',
    'Product Owner',
    'Product Strategy',
    'Product Operations',
    'Product Analytics',
    'UX Research',
    'Technical Product Management',
    'Account Management',
    'Business Development',
    'Channel Sales',
    'Enterprise Sales',
    'Field Sales',
    'General Sales',
    'Inside Sales',
    'Partnership Sales',
    'Revenue Operations',
    'SDR/BDR',
    'Sales Enablement',
    'Sales Engineering',
    'Sales Operations',
    'Sales Leadership',
    'Brand Marketing',
    'Content Marketing',
    'Demand Generation',
    'Digital Marketing',
    'Email Marketing',
    'Event Marketing',
    'Growth Marketing',
    'Market Research',
    'Marketing Operations',
    'Public Relations',
    'SEO/SEM',
    'Social Media Marketing',
    'Accounting',
    'Audit',
    'Banking/Finance',
    'Controllers',
    'Corporate Finance',
    'Credit Analysis',
    'Finance Leadership',
    'Financial Planning & Analysis',
    'Financial Reporting',
    'Investment',
    'Investor Relations',
    'Mergers & Acquisitions',
    'Risk Management',
    'Tax',
    'Treasury',
  ]);
  const mapped = new Set<string>();
  const unknown: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (feFunctions.has(trimmed) || feSubfunctions.has(trimmed)) {
      mapped.add(trimmed);
      continue;
    }
    const hit = table[trimmed.toLowerCase()];
    if (hit) {
      mapped.add(hit);
      continue;
    }
    unknown.push(trimmed);
  }
  return { mapped: Array.from(mapped), unknown };
}

/**
 * FullEnrich uses LinkedIn's industry taxonomy (~400 canonical values like
 * "Software Development", "IT Services and IT Consulting", "Financial
 * Services"). Shorthand like "SaaS" or "AI" silently zeros out the search on
 * FE, so we (a) alias the common shorthand to canonical FE values and (b)
 * allow any value that matches a canonical industry exactly.
 *
 * Keep `FE_INDUSTRY_ALIASES` focused on values agents plausibly type. The
 * full taxonomy is too long to enumerate here — if a value matches no alias
 * and isn't already canonical, we return it as `unknown` so the caller can
 * fail the request with a pointer to the FE docs.
 */
const FE_INDUSTRY_ALIASES: Record<string, string[]> = {
  saas: ['Software Development'],
  software: ['Software Development'],
  'software development': ['Software Development'],
  ai: ['Technology, Information and Internet'],
  'artificial intelligence': ['Technology, Information and Internet'],
  'machine learning': ['Technology, Information and Internet'],
  tech: ['Technology, Information and Internet'],
  technology: ['Technology, Information and Internet'],
  internet: ['Technology, Information and Internet'],
  fintech: ['Financial Services'],
  finance: ['Financial Services'],
  banking: ['Banking'],
  insurance: ['Insurance'],
  healthcare: ['Hospitals and Health Care'],
  health: ['Hospitals and Health Care'],
  biotech: ['Biotechnology Research'],
  pharma: ['Pharmaceutical Manufacturing'],
  ecommerce: ['Retail'],
  'e-commerce': ['Retail'],
  retail: ['Retail'],
  consulting: ['Business Consulting and Services'],
  'management consulting': ['Business Consulting and Services'],
  'it services': ['IT Services and IT Consulting'],
  it: ['IT Services and IT Consulting'],
  manufacturing: ['Manufacturing'],
  automotive: ['Motor Vehicle Manufacturing', 'Automotive'],
  media: [
    'Online Audio and Video Media',
    'Broadcast Media Production and Distribution',
  ],
  entertainment: ['Entertainment Providers'],
  education: ['Education'],
  government: ['Government Administration'],
  nonprofit: ['Non-profit Organizations'],
  'non-profit': ['Non-profit Organizations'],
  agency: ['Marketing Services', 'Advertising Services'],
  marketing: ['Marketing Services'],
  advertising: ['Advertising Services'],
  law: ['Law Practice', 'Legal Services'],
  legal: ['Legal Services'],
  realestate: ['Real Estate'],
  'real estate': ['Real Estate'],
  construction: ['Construction'],
  energy: ['Oil and Gas', 'Renewable Energy Power Generation', 'Utilities'],
  telecom: ['Telecommunications'],
  telecommunications: ['Telecommunications'],
  logistics: ['Transportation, Logistics, Supply Chain and Storage'],
  'supply chain': ['Transportation, Logistics, Supply Chain and Storage'],
  airline: ['Airlines and Aviation'],
  aviation: ['Airlines and Aviation'],
  hospitality: ['Hospitality'],
  staffing: ['Staffing and Recruiting'],
  recruiting: ['Staffing and Recruiting'],
  vc: ['Venture Capital and Private Equity Principals'],
  'venture capital': ['Venture Capital and Private Equity Principals'],
  pe: ['Venture Capital and Private Equity Principals'],
  'private equity': ['Venture Capital and Private Equity Principals'],
  b2b: ['Business Consulting and Services', 'Software Development'],
  'b2b software': ['Software Development'],
};

/**
 * Canonical FE industry values (subset). Used for exact-match passthrough —
 * we don't enumerate all ~400; a value not in aliases and not in this list is
 * rejected with a pointer at the FE docs. This covers the canonical values
 * most common for tech/sales prospecting.
 */
const FE_INDUSTRY_CANONICAL = new Set([
  'Software Development',
  'Technology, Information and Internet',
  'Technology, Information and Media',
  'Financial Services',
  'Banking',
  'Insurance',
  'Hospitals and Health Care',
  'Health, Wellness & Fitness',
  'Biotechnology Research',
  'Pharmaceutical Manufacturing',
  'Retail',
  'Business Consulting and Services',
  'IT Services and IT Consulting',
  'Manufacturing',
  'Motor Vehicle Manufacturing',
  'Automotive',
  'Online Audio and Video Media',
  'Broadcast Media Production and Distribution',
  'Entertainment Providers',
  'Education',
  'Higher Education',
  'Government Administration',
  'Non-profit Organizations',
  'Marketing Services',
  'Advertising Services',
  'Law Practice',
  'Legal Services',
  'Real Estate',
  'Construction',
  'Oil and Gas',
  'Renewable Energy Power Generation',
  'Utilities',
  'Telecommunications',
  'Transportation, Logistics, Supply Chain and Storage',
  'Airlines and Aviation',
  'Hospitality',
  'Staffing and Recruiting',
  'Venture Capital and Private Equity Principals',
  'Computer Games',
  'Defense and Space Manufacturing',
  'E-Learning Providers',
  'Food and Beverage Services',
  'Research Services',
  'Investment Management',
  'Investment Banking',
  'Capital Markets',
]);

function mapIndustryToFullEnrich(values: string[]): {
  mapped: string[];
  unknown: string[];
} {
  const mapped = new Set<string>();
  const unknown: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (FE_INDUSTRY_CANONICAL.has(trimmed)) {
      mapped.add(trimmed);
      continue;
    }
    const aliased = FE_INDUSTRY_ALIASES[trimmed.toLowerCase()];
    if (aliased) {
      for (const v of aliased) mapped.add(v);
      continue;
    }
    unknown.push(trimmed);
  }
  return { mapped: Array.from(mapped), unknown };
}

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
    .describe(
      'Personal/professional websites. Crustdata-only — always null on FullEnrich results.'
    ),

  // Enriched email data (from FullEnrich if enabled)
  enrichedWorkEmail: z
    .string()
    .nullable()
    .optional()
    .describe('Work email found via FullEnrich'),
  enrichedPersonalEmail: z
    .string()
    .nullable()
    .optional()
    .describe('Personal email found via FullEnrich'),
  enrichedWorkEmails: z
    .array(
      z.object({
        email: z.string(),
        status: z.string().optional(),
      })
    )
    .nullable()
    .optional()
    .describe('All work emails found via FullEnrich'),
  enrichedPersonalEmails: z
    .array(
      z.object({
        email: z.string(),
        status: z.string().optional(),
      })
    )
    .nullable()
    .optional()
    .describe('All personal emails found via FullEnrich'),

  // Classification
  seniorityLevel: z
    .string()
    .nullable()
    .describe('Seniority level (CXO, Vice President, Director, etc.)'),
  yearsOfExperience: z
    .number()
    .nullable()
    .describe(
      'Total years of professional experience. Crustdata-only — always null on FullEnrich results.'
    ),
  recentlyChangedJobs: z
    .boolean()
    .nullable()
    .describe(
      'Whether this person recently changed jobs. Crustdata-only — always null on FullEnrich results.'
    ),

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
    .describe(
      'Number of LinkedIn connections. Crustdata-only — always null on FullEnrich results.'
    ),

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
        companyDomainUrl: z
          .string()
          .nullable()
          .describe('Company website domain'),
        seniorityLevel: z.string().nullable().describe('Seniority level'),
        functionCategory: z.string().nullable().describe('Function category'),
        startDate: z
          .union([z.string(), z.number()])
          .nullable()
          .describe('Start date'),
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
        startDate: z
          .union([z.string(), z.number()])
          .nullable()
          .describe('Start date'),
        endDate: z
          .union([z.string(), z.number()])
          .nullable()
          .describe('End date'),
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
  // ===== PROVIDER =====
  provider: z
    .enum(['crustdata', 'fullenrich'])
    .default('fullenrich')
    .describe(
      "Search provider. Default: 'fullenrich'. Leave unset unless you need a filter FullEnrich cannot honor. On the FullEnrich provider every string filter is sent with exact_match=true so results are strictly scoped (e.g. companyName='Stripe' will NOT also return 'Stripes' or ex-Stripe folks). Filters the FullEnrich provider DOES NOT SUPPORT (the tool returns a hard error if any of these are set while provider='fullenrich'): locationRadius, minYearsExperience, maxYearsExperience, minConnections, excludeCompanies, excludeProfiles, companyLinkedinUrl. Enumerated filters (seniorityLevels, functionCategories, companyIndustries) are validated against FullEnrich's taxonomy and return a hard error with the accepted values if an unknown value is passed — no silent soft-match. Everything else — including languages, schoolName, pastJobTitle, minYearsAtCompany, recentlyChangedJobs — is supported on BOTH providers."
    ),

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
      `Seniority levels. Valid values: ${(PersonSeniorityLevelEnum._def.values as readonly string[]).join(', ')}. Examples: ["CXO", "Vice President", "Director", "Experienced Manager", "Senior"]`
    ),
  functionCategories: z
    .array(z.string())
    .optional()
    .describe(
      `Job function categories. Valid values: ${(PersonFunctionEnum._def.values as readonly string[]).join(', ')}. Examples: ["Engineering", "Sales", "Marketing", "Finance", "Operations", "Human Resources"]`
    ),

  // ===== COMPANY FILTERS =====
  companyIndustries: z
    .array(z.string())
    .optional()
    .describe(
      'Company industries to filter by with fuzzy matching (e.g., ["Technology", "SaaS", "Finance", "Fintech"]). Uses fuzzy text search, so partial terms like "Technology" will match "IT Services and IT Consulting", "Software Development", etc. Multiple values use OR logic.'
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
    .max(1000)
    .default(100)
    .optional()
    .describe('Maximum results to return (default: 100, max: 1000)'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Pagination cursor from previous response. Use to fetch the next page of results.'
    ),

  // ===== EMAIL ENRICHMENT (requires FULLENRICH_API_KEY) =====
  enrichEmails: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Enrich emails for found people via FullEnrich bulk enrichment as a post step. Applies to BOTH providers. Requires FULLENRICH_API_KEY credential. Costs 1 credit per work email, 3 credits per personal email. IMPORTANT: this is a SLOW operation — FullEnrich's bulk pipeline typically takes 30–120 seconds per batch (polls every 5s up to a 120s cap). If the cap trips, affected people are returned without emails and the result's `warnings` array explains which batches timed out. Consider surfacing a progress UI on user-facing flows."
    ),
  includePersonalEmails: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'When enrichEmails is true, also search for personal emails (costs 3 additional credits per person)'
    ),

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
  nextCursor: z
    .string()
    .optional()
    .describe(
      'Pagination cursor for fetching the next page. Pass this as the cursor parameter in the next request. Undefined when no more results are available.'
    ),
  warnings: z
    .array(z.string())
    .optional()
    .describe(
      'Non-fatal signals from the tool — e.g. filters that were requested but the chosen provider does not support (and were therefore ignored). Useful for surfacing why a search returned fewer results than expected.'
    ),
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
 * Agent-friendly tool for searching and discovering professionals. Defaults to
 * FullEnrich's /people/search; falls back to Crustdata PersonDB only when the
 * caller opts in (provider='crustdata') or relies on a filter FullEnrich
 * doesn't support (locationRadius, functionCategories, schoolName, pastJobTitle,
 * minYearsExperience/maxYearsExperience, recentlyChangedJobs, minConnections,
 * excludeCompanies, excludeProfiles, languages).
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
    'Comprehensive people search by company, title, location, skills, with optional email enrichment';
  static readonly longDescription = `
    Comprehensive people search tool for finding and discovering professionals.

    **PROVIDERS:**
    - \`fullenrich\` (DEFAULT, preferred): FullEnrich /people/search. Returns LinkedIn profiles,
      titles, locations, employment history, and work emails when available.
    - \`crustdata\`: Crustdata PersonDB. Wider filter set (geo radius, function category,
      school name, recent-job-change, connection count, exclusions), but requires
      CRUSTDATA_API_KEY and falls back here only when you genuinely need one of the
      crustdata-only filters.

    Leave \`provider\` unset (or pass \`'fullenrich'\`) unless you need a filter FullEnrich
    doesn't support — the tool will silently drop unsupported filters on FullEnrich, so
    check the per-filter notes below before choosing.

    **HOW TO GET HIGH-QUALITY LEADS:**
    1. Prefer an explicit \`jobTitles\` list (e.g. \`["Customer Success Manager",
       "CSM", "Senior Customer Success Manager"]\`) for precise role targeting.
       FullEnrich's \`seniorityLevels\` and \`functionCategories\` are ML-derived
       tags on each person and are imperfect — a person titled "VP of Strategic
       Finance" may still surface in a Software/VP search. jobTitles matched with
       exact_match=true are much more reliable.
    2. Combine filters. \`jobTitles\` + \`country\` + \`minCompanyHeadcount\` +
       \`companyIndustries\` is the canonical high-precision recipe.
    3. Use \`companyName\` for single-company searches — with exact_match=true it
       won't leak into sister companies (e.g. "Stripe" won't also match "Stripes").
    4. On FullEnrich the enumerated filters (seniorityLevels, functionCategories,
       companyIndustries) are validated against FE's taxonomy. An unknown value
       produces a hard error listing the acceptable values — read the error and
       fix your input.

    **SEARCH CRITERIA (at least one required):**
    Everything below is supported on BOTH providers unless tagged
    *(crustdata only)*. Invalid filters for the selected provider produce a
    hard error (not silent soft-matching).
    - Company: companyName, companyLinkedinUrl *(crustdata only)*, pastCompanyName
    - Job Title: jobTitle (single), jobTitles (multiple with OR logic), pastJobTitle
    - Location: location (fuzzy), country, city, locationRadius *(crustdata only)*
    - Skills & Experience: skills, languages, minYearsExperience / maxYearsExperience *(crustdata only)*
    - Seniority & Function: seniorityLevels, functionCategories
    - Company Attributes: companyIndustries, minCompanyHeadcount, maxCompanyHeadcount
    - Education: schoolName
    - Status: recentlyChangedJobs, minYearsAtCompany, minConnections *(crustdata only)*
    - Exclusions: excludeCompanies *(crustdata only)*, excludeProfiles *(crustdata only)*
    - Email enrichment: enrichEmails, includePersonalEmails (both providers)

    **SENIORITY LEVELS (valid values):**
    ${(PersonSeniorityLevelEnum._def.values as readonly string[]).map((v) => `- ${v}`).join('\n    ')}

    **FUNCTION CATEGORIES (valid values):**
    ${(PersonFunctionEnum._def.values as readonly string[]).map((v) => `- ${v}`).join('\n    ')}

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
    - functionCategories: ["Engineering", "Product Management"], seniorityLevels: ["Director", "Vice President"] → engineering and product leaders

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
    const { provider } = this.params;
    if (provider === 'fullenrich') {
      return this.searchFullEnrich();
    }
    return this.searchCrustdata();
  }

  private async searchCrustdata(): Promise<PeopleSearchToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.CRUSTDATA_API_KEY]) {
      return this.createErrorResult(
        'People search via Crustdata requires CRUSTDATA_API_KEY credential. Please configure it in your settings.'
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
        limit = 100,
        cursor,
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
      // Sanitize LinkedIn URL to remove trailing slashes
      const sanitizedCompanyLinkedinUrl =
        sanitizeLinkedInUrl(companyLinkedinUrl);
      if (sanitizedCompanyLinkedinUrl) {
        conditions.push({
          column: 'current_employers.company_linkedin_profile_url',
          type: '=',
          value: sanitizedCompanyLinkedinUrl,
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
      // Normalize user input to match valid API enum values (case-insensitive, aliases, fuzzy)
      if (seniorityLevels && seniorityLevels.length > 0) {
        const normalizedSeniority = normalizeSeniorityLevels(seniorityLevels);
        if (normalizedSeniority.length > 0) {
          conditions.push({
            column: 'current_employers.seniority_level',
            type: 'in',
            value: normalizedSeniority,
          });
        }
      }

      if (functionCategories && functionCategories.length > 0) {
        const normalizedFunctions =
          normalizeFunctionCategories(functionCategories);
        if (normalizedFunctions.length > 0) {
          conditions.push({
            column: 'current_employers.function_category',
            type: 'in',
            value: normalizedFunctions,
          });
        }
      }

      // ===== COMPANY ATTRIBUTE FILTERS =====
      // Company industries with fuzzy matching (allows partial matches like "Technology", "SaaS")
      if (companyIndustries && companyIndustries.length > 0) {
        if (companyIndustries.length === 1) {
          // Single industry - simple condition with fuzzy matching
          conditions.push({
            column: 'current_employers.company_industries',
            type: '(.)',
            value: companyIndustries[0],
          });
        } else {
          // Multiple industries - OR condition group with fuzzy matching
          const industryConditions: PersonDBFilterCondition[] =
            companyIndustries.map((industry) => ({
              column: 'current_employers.company_industries',
              type: '(.)' as const,
              value: industry,
            }));
          conditions.push({
            op: 'or',
            conditions: industryConditions,
          } as PersonDBFilterGroup);
        }
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
      // Sanitize LinkedIn URLs in excludeProfiles to remove trailing slashes
      const sanitizedExcludeProfiles = excludeProfiles?.length
        ? excludeProfiles
            .map((url) => sanitizeLinkedInUrl(url))
            .filter((url): url is string => url !== null)
        : undefined;
      const postProcessing = sanitizedExcludeProfiles?.length
        ? { exclude_profiles: sanitizedExcludeProfiles }
        : undefined;

      // Call the Crustdata PersonDB search API
      const searchBubble = new CrustdataBubble(
        {
          operation: 'person_search_db',
          filters,
          limit,
          cursor,
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
      let people = this.transformProfiles(personSearchData.profiles || []);
      const enrichmentWarnings: string[] = [];

      // Email enrichment if requested and FULLENRICH_API_KEY is available
      const { enrichEmails, includePersonalEmails } = this.params;
      if (
        enrichEmails &&
        credentials[CredentialType.FULLENRICH_API_KEY] &&
        people.length > 0
      ) {
        const enrichResult = await this.enrichPeopleEmails(
          people,
          credentials,
          includePersonalEmails ?? false
        );
        people = enrichResult.people;
        enrichmentWarnings.push(...enrichResult.warnings);
      }

      return {
        people,
        totalCount: personSearchData.total_count || people.length,
        nextCursor: personSearchData.next_cursor,
        ...(enrichmentWarnings.length > 0 && { warnings: enrichmentWarnings }),
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
   * Search via FullEnrich v2 /people/search. Maps tool params to FullEnrich
   * filters, collecting warnings for any filter the provider cannot honor so
   * callers can see why results may look narrower than expected.
   *
   * When `enrichEmails=true`, runs the FullEnrich bulk-enrichment pipeline as a
   * post step (same path as the Crustdata branch) because /people/search does
   * not return emails by itself.
   */
  private async searchFullEnrich(): Promise<PeopleSearchToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.FULLENRICH_API_KEY]) {
      return this.createErrorResult(
        'People search via FullEnrich requires FULLENRICH_API_KEY credential. Please configure it in your settings.'
      );
    }

    const {
      companyName,
      companyLinkedinUrl,
      jobTitle,
      jobTitles,
      location,
      locationRadius,
      skills,
      languages,
      minYearsExperience,
      maxYearsExperience,
      seniorityLevels,
      functionCategories,
      companyIndustries,
      minCompanyHeadcount,
      maxCompanyHeadcount,
      minYearsAtCompany,
      pastCompanyName,
      pastJobTitle,
      schoolName,
      country,
      city,
      recentlyChangedJobs,
      minConnections,
      excludeCompanies,
      excludeProfiles,
      enrichEmails,
      includePersonalEmails,
      limit = 100,
      cursor,
    } = this.params;

    // Hard-fail on filters FullEnrich cannot honor. Surfacing a clear error
    // is better than silently producing wrong results — agents will see the
    // error in their build-run-validate loop and fix the code upstream.
    const crustdataOnly: string[] = [];
    if (locationRadius) crustdataOnly.push('locationRadius');
    if (companyLinkedinUrl)
      crustdataOnly.push('companyLinkedinUrl (exact URL match)');
    if (minConnections !== undefined) crustdataOnly.push('minConnections');
    if (excludeCompanies?.length) crustdataOnly.push('excludeCompanies');
    if (excludeProfiles?.length) crustdataOnly.push('excludeProfiles');
    if (minYearsExperience !== undefined)
      crustdataOnly.push('minYearsExperience');
    if (maxYearsExperience !== undefined)
      crustdataOnly.push('maxYearsExperience');
    if (crustdataOnly.length > 0) {
      return this.createErrorResult(
        `The following filters are only supported by the Crustdata provider, but the current request routes to FullEnrich: ${crustdataOnly.join(', ')}. Either (a) remove these filters, or (b) set provider="crustdata".`
      );
    }

    // Build title list (merge jobTitle + jobTitles)
    const allJobTitles: string[] = [];
    if (jobTitle) allJobTitles.push(jobTitle);
    if (jobTitles?.length) allJobTitles.push(...jobTitles);

    // Build location list (raw strings — FE accepts any granularity: continent,
    // country, state, sub-region, or city).
    const allLocations: string[] = [];
    if (location) allLocations.push(location);
    if (city) allLocations.push(city);
    if (country) allLocations.push(country);

    // Validate at least one FE-supported criteria is set
    const hasCriteria =
      allJobTitles.length > 0 ||
      allLocations.length > 0 ||
      !!companyName ||
      !!pastCompanyName ||
      !!pastJobTitle ||
      !!schoolName ||
      (skills && skills.length > 0) ||
      (languages && languages.length > 0) ||
      (seniorityLevels && seniorityLevels.length > 0) ||
      (functionCategories && functionCategories.length > 0) ||
      (companyIndustries && companyIndustries.length > 0) ||
      minCompanyHeadcount !== undefined ||
      maxCompanyHeadcount !== undefined ||
      minYearsAtCompany !== undefined ||
      recentlyChangedJobs === true;

    if (!hasCriteria) {
      return this.createErrorResult(
        'FullEnrich people search requires at least one supported filter (companyName, jobTitle/jobTitles, location/city/country, skills, languages, seniorityLevels, functionCategories, companyIndustries, min/maxCompanyHeadcount, minYearsAtCompany, pastCompanyName, pastJobTitle, schoolName, recentlyChangedJobs).'
      );
    }

    // Strict validate enumerated filters before we call FE. Any unknown value
    // produces a hard error with exact guidance on what FE accepts — this
    // replaces the old soft-warn-and-soft-match behaviour that let agents
    // silently receive wrong-category results.
    const seniorityResult = seniorityLevels?.length
      ? mapSeniorityToFullEnrich(seniorityLevels)
      : { mapped: [] as string[], unknown: [] as string[] };
    if (seniorityResult.unknown.length > 0) {
      return this.createErrorResult(
        `Unknown seniorityLevels values for FullEnrich: ${seniorityResult.unknown.join(', ')}. FullEnrich accepts: Owner, Founder, C-level, Partner, VP, Head, Director, Manager, Senior. Set provider="crustdata" for the extra Crustdata-only values (Entry Level, In Training, Experienced Manager, Entry Level Manager, Strategic).`
      );
    }

    const functionResult = functionCategories?.length
      ? mapFunctionCategoryToFullEnrich(functionCategories)
      : { mapped: [] as string[], unknown: [] as string[] };
    if (functionResult.unknown.length > 0) {
      return this.createErrorResult(
        `Unknown functionCategories values for FullEnrich: ${functionResult.unknown.join(', ')}. Use one of FullEnrich's top-level functions (Administrative, Consulting & Advisory, Customer Service, Design, Education, Executive & Leadership, Finance, Human Resources, Legal, Marketing, Media & Communications, Medical & Health, Non-Profit & Government, Operations, Product, Project & Program Management, Public Safety & Security, Research & Science, Retail & Consumer, Sales, Software, Traditional Engineering, Transportation & Logistics) or a documented subfunction (e.g. "Recruiting/Talent Acquisition", "Customer Success", "Software Engineering"). Full list: https://docs.fullenrich.com/ → Accepted Filter Values.`
      );
    }

    const industryResult = companyIndustries?.length
      ? mapIndustryToFullEnrich(companyIndustries)
      : { mapped: [] as string[], unknown: [] as string[] };
    if (industryResult.unknown.length > 0) {
      return this.createErrorResult(
        `Unknown companyIndustries values for FullEnrich: ${industryResult.unknown.join(', ')}. FullEnrich uses LinkedIn's industry taxonomy — common shorthand like "SaaS" is auto-mapped, but other values must match the canonical taxonomy (e.g. "Software Development", "Financial Services", "IT Services and IT Consulting", "Hospitals and Health Care"). Full list: https://docs.fullenrich.com/ → Accepted Filter Values → Company Industry.`
      );
    }

    // FullEnrich caps at limit=100 per request
    const feLimit = Math.min(limit, 100);
    const warnings: string[] = [];

    try {
      const headcountRange: { min?: number; max?: number } = {};
      if (minCompanyHeadcount !== undefined)
        headcountRange.min = minCompanyHeadcount;
      if (maxCompanyHeadcount !== undefined)
        headcountRange.max = maxCompanyHeadcount;

      // exact_match: true disables FE's default fuzzy matching ("Stripe" would
      // otherwise also match "Stripes" and ex-Stripe folks). We default this
      // on for every string filter since the tool's users overwhelmingly want
      // strict matches for prospecting lists.
      const asExactFilter = (v: string) => ({ value: v, exact_match: true });

      const people_search = await new FullEnrichBubble(
        {
          operation: 'people_search',
          limit: feLimit,
          ...(allJobTitles.length > 0 && {
            current_position_titles: allJobTitles.map(asExactFilter),
          }),
          ...(companyName && {
            current_company_names: [asExactFilter(companyName)],
          }),
          ...(pastCompanyName && {
            past_company_names: [asExactFilter(pastCompanyName)],
          }),
          ...(pastJobTitle && {
            past_position_titles: [asExactFilter(pastJobTitle)],
          }),
          ...(schoolName && {
            person_universities: [asExactFilter(schoolName)],
          }),
          ...(allLocations.length > 0 && {
            person_locations: allLocations.map(asExactFilter),
          }),
          ...(skills?.length && {
            person_skills: skills.map(asExactFilter),
          }),
          ...(languages?.length && {
            person_languages: languages.map(asExactFilter),
          }),
          ...(seniorityResult.mapped.length > 0 && {
            current_position_seniority_level:
              seniorityResult.mapped.map(asExactFilter),
          }),
          ...(functionResult.mapped.length > 0 && {
            current_position_job_functions:
              functionResult.mapped.map(asExactFilter),
          }),
          ...(industryResult.mapped.length > 0 && {
            current_company_industries:
              industryResult.mapped.map(asExactFilter),
          }),
          ...((minCompanyHeadcount !== undefined ||
            maxCompanyHeadcount !== undefined) && {
            current_company_headcounts: [headcountRange],
          }),
          ...(minYearsAtCompany !== undefined && {
            current_company_years_at: [{ min: minYearsAtCompany }],
          }),
          ...(recentlyChangedJobs === true && {
            // "Recently changed jobs" → last 90 days since last job change.
            current_company_days_since_last_job_change: [{ max: 90 }],
          }),
          ...(cursor && { search_after: cursor }),
          credentials,
        },
        this.context,
        'people_search'
      ).action();

      if (!people_search.success) {
        return this.createErrorResult(
          people_search.error || 'FullEnrich people search failed'
        );
      }

      const data = people_search.data as {
        people?: Array<Record<string, unknown>>;
        metadata?: {
          total: number;
          offset?: number;
          search_after?: string;
        };
      };

      let people: PersonResult[] = (data.people ?? []).map((p) =>
        this.transformFullEnrichPerson(p)
      );

      // Post-enrichment step: /people/search returns profile data but not
      // emails, so when the caller asks for enrichEmails we reuse the existing
      // bulk-enrichment pipeline that the Crustdata branch uses.
      if (enrichEmails && people.length > 0) {
        const enrichResult = await this.enrichPeopleEmails(
          people,
          credentials,
          includePersonalEmails ?? false
        );
        people = enrichResult.people;
        warnings.push(...enrichResult.warnings);
      }

      return {
        people,
        totalCount: data.metadata?.total ?? people.length,
        nextCursor: data.metadata?.search_after,
        ...(warnings.length > 0 && { warnings }),
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
   * Normalize a FullEnrich person record to the shared PersonResult shape.
   */
  private transformFullEnrichPerson(p: Record<string, unknown>): PersonResult {
    // Extract a string URL from FullEnrich's social-profile object shape:
    //   { linkedin: { id, url, handle, ... } }  → url
    //   or sometimes a bare string
    const extractSocialUrl = (
      profiles: unknown,
      key: 'linkedin' | 'twitter'
    ): string | null => {
      if (!profiles || typeof profiles !== 'object') return null;
      const entry = (profiles as Record<string, unknown>)[key];
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const url = (entry as Record<string, unknown>).url;
        if (typeof url === 'string') return url;
        const handle = (entry as Record<string, unknown>).handle;
        if (typeof handle === 'string') return handle;
      }
      return null;
    };

    const fullName =
      (p.full_name as string | undefined) ??
      [p.first_name as string | undefined, p.last_name as string | undefined]
        .filter(Boolean)
        .join(' ');

    const employment = (p.employment ?? {}) as Record<string, unknown>;
    const current = (employment.current ?? {}) as Record<string, unknown>;
    const allEmployments = Array.isArray(employment.all)
      ? (employment.all as Array<Record<string, unknown>>)
      : [];

    const social = (p.social_profiles ?? {}) as Record<string, unknown>;
    const loc = (p.location ?? {}) as Record<string, unknown>;

    // Coerce arbitrary date-ish input to string|number|null.
    const toDate = (v: unknown): string | number | null => {
      if (typeof v === 'string' || typeof v === 'number') return v;
      return null;
    };

    const mapCurrentEmployer = (e: Record<string, unknown>) => {
      const company = (e.company ?? {}) as Record<string, unknown>;
      const companySocial = (company.social_profiles ?? {}) as Record<
        string,
        unknown
      >;
      const industryObj = company.industry as
        | Record<string, unknown>
        | undefined;
      const mainIndustry =
        industryObj && typeof industryObj === 'object'
          ? (industryObj.main_industry as string | undefined)
          : undefined;
      return {
        title: (e.title as string | undefined) ?? null,
        companyName:
          (company.name as string | undefined) ??
          (e.company_name as string | undefined) ??
          null,
        companyLinkedinUrl: extractSocialUrl(companySocial, 'linkedin'),
        companyDomainUrl:
          (company.domain as string | undefined) ??
          (e.company_domain as string | undefined) ??
          null,
        seniorityLevel: (e.seniority as string | undefined) ?? null,
        functionCategory: Array.isArray(e.job_functions)
          ? (((e.job_functions as Array<Record<string, unknown>>)[0]
              ?.function as string | undefined) ?? null)
          : null,
        startDate: toDate(e.start_at ?? e.start_date),
        yearsAtCompany: null,
        companyHeadcount: (company.headcount as number | undefined) ?? null,
        companyIndustries: mainIndustry ? [mainIndustry] : null,
      };
    };

    const mapPastEmployer = (e: Record<string, unknown>) => {
      const company = (e.company ?? {}) as Record<string, unknown>;
      return {
        title: (e.title as string | undefined) ?? null,
        companyName:
          (company.name as string | undefined) ??
          (e.company_name as string | undefined) ??
          null,
        startDate: toDate(e.start_at ?? e.start_date),
        endDate: toDate(e.end_at ?? e.end_date),
      };
    };

    const currentEmployers = allEmployments
      .filter((e) => e.is_current === true)
      .map(mapCurrentEmployer);
    const pastEmployers = allEmployments
      .filter((e) => e.is_current !== true)
      .map(mapPastEmployer);

    // If employment.current has data but wasn't in employment.all with is_current,
    // prepend it to currentEmployers.
    if (Object.keys(current).length > 0 && currentEmployers.length === 0) {
      currentEmployers.push(mapCurrentEmployer(current));
    }

    const education = Array.isArray(p.educations)
      ? (p.educations as Array<Record<string, unknown>>).map((e) => ({
          instituteName: (e.school_name as string | undefined) ?? null,
          degreeName: (e.degree as string | undefined) ?? null,
          fieldOfStudy: (e.field_of_study as string | undefined) ?? null,
        }))
      : null;

    const skills = Array.isArray(p.skills)
      ? ((p.skills as unknown[]).filter(
          (s) => typeof s === 'string'
        ) as string[])
      : null;

    const languages = Array.isArray(p.languages)
      ? ((p.languages as unknown[]).filter(
          (l) => typeof l === 'string'
        ) as string[])
      : null;

    // /people/search occasionally returns a contact block with email data on
    // results the person already surfaced elsewhere in FullEnrich's pipeline.
    // Populate both the canonical `emails` array and the `enriched*` mirrors so
    // callers that read either shape see the data.
    const contact = (p.contact ?? {}) as Record<string, unknown>;
    const mostProbableEmail =
      (contact.most_probable_email as string | undefined) ?? null;
    const mostProbablePersonalEmail =
      (contact.most_probable_personal_email as string | undefined) ?? null;
    const contactEmails = Array.isArray(contact.emails)
      ? (contact.emails as Array<Record<string, unknown>>)
          .map((e) => ({
            email: (e.email as string | undefined) ?? '',
            status: e.status as string | undefined,
          }))
          .filter((e) => e.email.length > 0)
      : null;
    const contactPersonalEmails = Array.isArray(contact.personal_emails)
      ? (contact.personal_emails as Array<Record<string, unknown>>)
          .map((e) => ({
            email: (e.email as string | undefined) ?? '',
            status: e.status as string | undefined,
          }))
          .filter((e) => e.email.length > 0)
      : null;
    const mergedEmails = new Set<string>();
    if (mostProbableEmail) mergedEmails.add(mostProbableEmail);
    if (mostProbablePersonalEmail) mergedEmails.add(mostProbablePersonalEmail);
    contactEmails?.forEach((e) => mergedEmails.add(e.email));
    contactPersonalEmails?.forEach((e) => mergedEmails.add(e.email));

    return {
      name: fullName || null,
      title: (current.title as string | undefined) ?? null,
      headline: (p.headline as string | undefined) ?? null,
      linkedinUrl: extractSocialUrl(social, 'linkedin'),
      profilePictureUrl: (p.profile_picture_url as string | undefined) ?? null,
      emails: mergedEmails.size > 0 ? Array.from(mergedEmails) : null,
      twitterHandle: extractSocialUrl(social, 'twitter'),
      websites: null,
      enrichedWorkEmail: mostProbableEmail,
      enrichedPersonalEmail: mostProbablePersonalEmail,
      enrichedWorkEmails: contactEmails,
      enrichedPersonalEmails: contactPersonalEmails,
      seniorityLevel: (current.seniority as string | undefined) ?? null,
      yearsOfExperience: (p.years_of_experience as number | undefined) ?? null,
      recentlyChangedJobs: null,
      location:
        (loc.raw as string | undefined) ??
        (loc.full as string | undefined) ??
        ([loc.city, loc.region, loc.country]
          .filter((v) => typeof v === 'string')
          .join(', ') ||
          null),
      locationCity: (loc.city as string | undefined) ?? null,
      locationCountry: (loc.country as string | undefined) ?? null,
      skills,
      languages,
      summary: (p.summary as string | undefined) ?? null,
      numConnections: null,
      currentEmployers: currentEmployers.length > 0 ? currentEmployers : null,
      pastEmployers: pastEmployers.length > 0 ? pastEmployers : null,
      education,
    } as PersonResult;
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
          companyDomainUrl: emp.company_website_domain || null,
          seniorityLevel: emp.seniority_level || null,
          functionCategory: emp.function_category || null,
          startDate:
            emp.start_date !== null && emp.start_date !== undefined
              ? typeof emp.start_date === 'number'
                ? String(emp.start_date)
                : emp.start_date
              : null,
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
          startDate:
            emp.start_date !== null && emp.start_date !== undefined
              ? typeof emp.start_date === 'number'
                ? String(emp.start_date)
                : emp.start_date
              : null,
          endDate:
            emp.end_date !== null && emp.end_date !== undefined
              ? typeof emp.end_date === 'number'
                ? String(emp.end_date)
                : emp.end_date
              : null,
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

  /**
   * Enrich people with email data using FullEnrich.
   *
   * Batches up to 100 contacts per request and polls every 5s up to 120s per
   * batch. Bulk enrichment is slow by design — expect 30–120s of wall time for
   * a full batch. Returns both the enriched people and a list of warning
   * strings so callers can surface "emails failed to arrive" to the user
   * instead of silently returning un-enriched people.
   */
  private async enrichPeopleEmails(
    people: PersonResult[],
    credentials: Partial<Record<CredentialType, string>>,
    includePersonalEmails: boolean
  ): Promise<{ people: PersonResult[]; warnings: string[] }> {
    const warnings: string[] = [];
    // Build contacts for enrichment (only those with LinkedIn URLs or name+company)
    const contactsToEnrich: Array<{
      index: number;
      firstname: string;
      lastname: string;
      linkedin_url?: string;
      domain?: string;
      company_name?: string;
    }> = [];

    for (let i = 0; i < people.length; i++) {
      const person = people[i];

      // Parse name into first/last
      const nameParts = (person.name || '').trim().split(/\s+/);
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';

      // Get company info from current employer
      const currentEmployer = person.currentEmployers?.[0];
      const domain = currentEmployer?.companyDomainUrl || undefined;
      const company_name = currentEmployer?.companyName || undefined;
      const linkedin_url = person.linkedinUrl || undefined;

      // Need at least LinkedIn URL or (name + company info) for enrichment
      if (linkedin_url || (firstname && (domain || company_name))) {
        contactsToEnrich.push({
          index: i,
          firstname,
          lastname,
          linkedin_url,
          domain,
          company_name,
        });
      }
    }

    if (contactsToEnrich.length === 0) {
      return { people, warnings }; // No contacts to enrich
    }

    // Determine enrich fields
    const enrich_fields: ('contact.emails' | 'contact.personal_emails')[] = [
      'contact.emails',
    ];
    if (includePersonalEmails) {
      enrich_fields.push('contact.personal_emails');
    }

    // Start bulk enrichment (max 100 contacts per batch)
    const batchSize = 100;
    const enrichedPeople = [...people];

    for (
      let batchStart = 0;
      batchStart < contactsToEnrich.length;
      batchStart += batchSize
    ) {
      const batch = contactsToEnrich.slice(batchStart, batchStart + batchSize);

      try {
        // Start enrichment
        const find_email = await new FullEnrichBubble(
          {
            operation: 'start_bulk_enrichment',
            name: `PeopleSearchTool-${Date.now()}`,
            contacts: batch.map((c, batchIndex) => ({
              firstname: c.firstname,
              lastname: c.lastname,
              linkedin_url: c.linkedin_url,
              domain: c.domain,
              company_name: c.company_name,
              enrich_fields,
              custom: { index: String(batchIndex) }, // Track position in batch
            })),
            credentials,
          },
          this.context,
          'find_email'
        ).action();

        if (!find_email.success || !find_email.data?.enrichment_id) {
          warnings.push(
            `Email enrichment batch ${batchStart / batchSize + 1} failed to start: ${find_email.error || 'unknown error'}. People in this batch are returned without enriched emails.`
          );
          continue;
        }

        const enrichmentId = find_email.data.enrichment_id;

        // Poll until done (max 120 seconds). 5s interval keeps request count
        // reasonable (~24 polls max) vs. the old 3s cadence — enrichment takes
        // 30–120s typically, so the extra 2s granularity doesn't matter.
        const maxWaitMs = 120000;
        const pollIntervalMs = 5000;
        const startTime = Date.now();
        let finished = false;
        let finalStatus: string | undefined;

        while (Date.now() - startTime < maxWaitMs) {
          await this.sleep(pollIntervalMs);

          const poll_email = await new FullEnrichBubble(
            {
              operation: 'get_enrichment_result',
              enrichment_id: enrichmentId,
              force_results: false,
              credentials,
            },
            this.context,
            'poll_email'
          ).action();

          if (!poll_email.success) {
            continue;
          }

          const status = poll_email.data?.status;
          finalStatus = status;

          if (
            status === 'FINISHED' ||
            status === 'CANCELED' ||
            status === 'CREDITS_INSUFFICIENT'
          ) {
            finished = true;
            // Extract results
            const results = poll_email.data?.results as
              | Array<{
                  custom?: Record<string, string>;
                  contact?: {
                    most_probable_email?: string;
                    most_probable_personal_email?: string;
                    emails?: Array<{ email?: string; status?: string }>;
                    personal_emails?: Array<{
                      email?: string;
                      status?: string;
                    }>;
                  };
                }>
              | undefined;

            if (results) {
              for (const result of results) {
                const batchIndex = parseInt(result.custom?.index || '-1', 10);
                if (batchIndex >= 0 && batchIndex < batch.length) {
                  const originalIndex = batch[batchIndex].index;
                  const contact = result.contact;

                  if (contact) {
                    // Merge enriched emails into main emails array
                    const existingEmails =
                      enrichedPeople[originalIndex].emails || [];
                    const newEmails = new Set(existingEmails);

                    // Add work emails
                    if (contact.most_probable_email) {
                      newEmails.add(contact.most_probable_email);
                    }
                    contact.emails?.forEach((e) => {
                      if (e.email) newEmails.add(e.email);
                    });

                    // Add personal emails
                    if (contact.most_probable_personal_email) {
                      newEmails.add(contact.most_probable_personal_email);
                    }
                    contact.personal_emails?.forEach((e) => {
                      if (e.email) newEmails.add(e.email);
                    });

                    enrichedPeople[originalIndex] = {
                      ...enrichedPeople[originalIndex],
                      // Override emails with merged list (enriched emails first)
                      emails: newEmails.size > 0 ? Array.from(newEmails) : null,
                      enrichedWorkEmail: contact.most_probable_email || null,
                      enrichedPersonalEmail:
                        contact.most_probable_personal_email || null,
                      enrichedWorkEmails:
                        contact.emails?.map((e) => ({
                          email: e.email || '',
                          status: e.status,
                        })) || null,
                      enrichedPersonalEmails:
                        contact.personal_emails?.map((e) => ({
                          email: e.email || '',
                          status: e.status,
                        })) || null,
                    };
                  }
                }
              }
            }
            break; // Done with this batch
          }
        }

        if (!finished) {
          warnings.push(
            `Email enrichment batch ${batchStart / batchSize + 1} did not complete within ${maxWaitMs / 1000}s (last status: ${finalStatus ?? 'unknown'}). People in this batch are returned without enriched emails.`
          );
        } else if (finalStatus === 'CANCELED') {
          warnings.push(
            `Email enrichment batch ${batchStart / batchSize + 1} was canceled. People in this batch are returned without enriched emails.`
          );
        } else if (finalStatus === 'CREDITS_INSUFFICIENT') {
          warnings.push(
            `Email enrichment batch ${batchStart / batchSize + 1} stopped due to insufficient FullEnrich credits. Partial results only.`
          );
        }
      } catch (err) {
        warnings.push(
          `Email enrichment batch ${batchStart / batchSize + 1} threw: ${err instanceof Error ? err.message : String(err)}. People in this batch are returned without enriched emails.`
        );
        continue;
      }
    }

    return { people: enrichedPeople, warnings };
  }

  /**
   * Sleep helper for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
