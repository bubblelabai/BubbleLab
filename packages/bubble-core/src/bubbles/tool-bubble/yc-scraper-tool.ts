import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';

// Y Combinator batch format: Season + Year (e.g., "W24", "S23", "F22", "Sp24")
// Seasons: W (Winter), S (Summer), F (Fall), Sp (Spring)

// Founder schema - represents a founder/person extracted from YC data
const YCFounderSchema = z.object({
  name: z.string().nullable().describe('Founder full name'),
  title: z.string().nullable().describe('Founder title/role at the company'),
  linkedinUrl: z.string().nullable().describe('LinkedIn profile URL'),
  bio: z.string().nullable().describe('Founder bio/description'),
  twitterUrl: z.string().nullable().describe('Twitter/X profile URL'),
});

// Company schema - represents a YC company
const YCCompanySchema = z.object({
  companyName: z.string().nullable().describe('Company name'),
  description: z.string().nullable().describe('Company description'),
  batch: z.string().nullable().describe('YC batch (e.g., W24, S23)'),
  website: z.string().nullable().describe('Company website URL'),
  ycUrl: z.string().nullable().describe('YC company page URL'),
  founders: z.array(YCFounderSchema).describe('List of founders'),
});

// Person output schema - flattened founder with company context
const YCPersonSchema = z.object({
  name: z.string().nullable().describe('Person full name'),
  title: z.string().nullable().describe('Title/role at the company'),
  currentEmployers: z
    .array(
      z.object({
        companyName: z.string().nullable().describe('Company name'),
      })
    )
    .describe('Current employers (YC companies)'),
  linkedinUrl: z.string().nullable().describe('LinkedIn profile URL'),
  twitterUrl: z.string().nullable().describe('Twitter/X profile URL'),
  bio: z.string().nullable().describe('Founder bio/description'),
  emails: z
    .array(z.string())
    .nullable()
    .describe('Email addresses (if available)'),
});

// Tool parameters schema
const YCScraperToolParamsSchema = z.object({
  batch: z
    .string()
    .optional()
    .describe(
      '[ONEOF:source] YC batch to scrape (e.g., "W24" for Winter 2024, "S23" for Summer 2023).'
    ),

  url: z
    .string()
    .optional()
    .describe(
      '[ONEOF:source] Direct YC directory URL to scrape. Example: "https://www.ycombinator.com/companies?batch=Winter%202026". Use this for advanced filtering or full batch names.'
    ),

  maxCompanies: z
    .number()
    .min(1)
    .max(500)
    .default(50)
    .optional()
    .describe('Maximum number of companies to scrape (default: 50, max: 500)'),

  includeFounders: z
    .boolean()
    .default(true)
    .optional()
    .describe('Whether to scrape founder details (default: true)'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Tool result schema
const YCScraperToolResultSchema = z.object({
  // People array - flattened founders with company context
  people: z
    .array(YCPersonSchema)
    .describe('Array of founders/people extracted'),

  // Companies array - for those who want company-level data
  companies: z.array(YCCompanySchema).describe('Array of YC companies scraped'),

  // Metadata
  totalPeople: z.number().describe('Total number of people/founders found'),
  totalCompanies: z.number().describe('Total number of companies scraped'),
  batch: z.string().nullable().describe('YC batch that was scraped'),
  url: z.string().nullable().describe('URL that was scraped'),

  // Standard fields
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Type definitions
type YCScraperToolParams = z.output<typeof YCScraperToolParamsSchema>;
type YCScraperToolResult = z.output<typeof YCScraperToolResultSchema>;
type YCScraperToolParamsInput = z.input<typeof YCScraperToolParamsSchema>;
export type YCPerson = z.output<typeof YCPersonSchema>;
export type YCCompany = z.output<typeof YCCompanySchema>;
export type YCFounder = z.output<typeof YCFounderSchema>;

// Apify actor output types
interface ApifyYCFounder {
  name?: string | null;
  title?: string | null;
  linkedin?: string | null;
  bio?: string | null;
  x?: string | null;
}

interface ApifyYCCompany {
  company_name?: string | null;
  long_description?: string | null;
  short_description?: string | null;
  batch?: string | null;
  website?: string | null;
  yc_url?: string | null;
  founders?: ApifyYCFounder[];
}

/**
 * Y Combinator Scraper Tool
 *
 * Scrapes Y Combinator company directory to extract company and founder data.
 * Perfect for:
 * - Finding YC founders for networking/outreach
 * - Researching YC companies by batch
 * - Building databases of startup founders
 * - Lead generation targeting YC alumni
 *
 * Uses the Apify Y Combinator scraper actor behind the scenes.
 */
export class YCScraperTool extends ToolBubble<
  YCScraperToolParams,
  YCScraperToolResult
> {
  static readonly bubbleName: BubbleName = 'yc-scraper-tool';
  static readonly schema = YCScraperToolParamsSchema;
  static readonly resultSchema = YCScraperToolResultSchema;
  static readonly shortDescription =
    'Scrape Y Combinator directory for company and founder data. Find founders by batch (W24, S23, etc.) with LinkedIn profiles.';
  static readonly longDescription = `
    Y Combinator directory scraper for extracting company and founder data.

    **OPERATIONS:**
    - Scrape companies and founders by YC batch (e.g., W24, S23, W22)
    - Extract founder details including LinkedIn profiles, titles, and bios
    - Get company information including descriptions and websites

    **WHEN TO USE THIS TOOL:**
    - **YC founder outreach** - find founders from specific batches for networking
    - **Lead generation** - build lists of YC founders for sales/recruiting
    - **Research** - analyze YC companies by batch, industry, or founder background
    - **Competitive analysis** - research YC companies in specific sectors

    **BATCH FORMAT:**
    - W = Winter batch (January start)
    - S = Summer batch (June start)
    - Examples: W24 (Winter 2024), S23 (Summer 2023), W22 (Winter 2022)

    **OUTPUT:**
    - People array: Flattened list of founders with company context
    - Companies array: Company-level data with nested founders
    - LinkedIn URLs for direct founder outreach

    **TIPS:**
    - Start with smaller maxCompanies (20-50) for faster results
    - Use the batch parameter for easier filtering
    - Use url parameter for advanced filtering (industry, location, etc.)

    The tool uses Apify's Y Combinator scraper for reliable data extraction.
  `;
  static readonly alias = 'yc';
  static readonly type = 'tool';

  constructor(
    params: YCScraperToolParamsInput = {
      batch: 'W24',
      maxCompanies: 50,
      includeFounders: true,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<YCScraperToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'YC scraping requires Apify authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { batch, url, maxCompanies, includeFounders } = this.params;

      // Build the YC directory URL
      let scrapeUrl: string;
      if (batch) {
        // Convert batch format (e.g., "W24" -> "Winter 2024")
        const formattedBatch = this.formatBatchForUrl(batch);
        scrapeUrl = `https://www.ycombinator.com/companies?batch=${encodeURIComponent(formattedBatch)}`;
      } else if (url) {
        scrapeUrl = url;
      } else {
        return this.createErrorResult(
          'Either batch (e.g., "W24") or url parameter is required'
        );
      }

      // Call the Apify YC scraper
      const apifyScraper = new ApifyBubble(
        {
          actorId: 'michael.g/y-combinator-scraper',
          input: {
            scrape_founders: includeFounders ?? true,
            scrape_open_jobs: false,
            url: scrapeUrl,
            scrape_all_companies: false,
          },
          waitForFinish: true,
          timeout: 300000, // 5 minutes
          credentials: credentials,
          limit: maxCompanies || 50,
        },
        this.context,
        'ycScraper'
      );

      const result = await apifyScraper.action();

      if (!result.data.success) {
        return this.createErrorResult(
          result.data.error || 'YC scraper failed. Please try again.'
        );
      }

      const items = (result.data.items || []) as ApifyYCCompany[];

      // Limit to maxCompanies
      const limitedCompanies = items.slice(0, maxCompanies || 50);

      // Transform to our output format
      const companies = this.transformCompanies(limitedCompanies);
      const people = this.extractPeople(limitedCompanies);

      return {
        people,
        companies,
        totalPeople: people.length,
        totalCompanies: companies.length,
        batch: batch?.toUpperCase() || null,
        url: scrapeUrl,
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
   * Convert batch to full format for URL
   * Handles multiple input formats:
   * - "W24", "S23", "F22", "Sp24" -> "Winter 2024", "Summer 2023", "Fall 2022", "Spring 2024"
   * - "W2024", "S2023", "F2022", "Sp2024" -> full year variants
   * - "Winter 2024", "Summer 2023", "Fall 2022", "Spring 2024" -> pass through
   * - "winter2024", "Winter24", "fall24", "spring24" -> normalized format
   */
  private formatBatchForUrl(batch: string): string {
    const normalized = batch.trim();

    // Map short season codes to full names
    const seasonMap: Record<string, string> = {
      W: 'Winter',
      S: 'Summer',
      F: 'Fall',
      SP: 'Spring',
    };

    // Helper to get season name from code
    const getSeasonName = (code: string): string | undefined => {
      const upper = code.toUpperCase();
      return seasonMap[upper];
    };

    // Pattern 1: "Sp24" or "Sp2024" (Spring - check first since it's 2 chars)
    const springMatch = normalized.match(/^(sp)(\d{2,4})$/i);
    if (springMatch) {
      const [, , year] = springMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `Spring ${fullYear}`;
    }

    // Pattern 2: Short format "W24", "S24", or "F24"
    const shortMatch = normalized.match(/^([WSF])(\d{2})$/i);
    if (shortMatch) {
      const [, season, yearShort] = shortMatch;
      const seasonName = getSeasonName(season);
      return `${seasonName} 20${yearShort}`;
    }

    // Pattern 3: Short format with full year "W2024", "S2024", or "F2024"
    const shortFullYearMatch = normalized.match(/^([WSF])(\d{4})$/i);
    if (shortFullYearMatch) {
      const [, season, year] = shortFullYearMatch;
      const seasonName = getSeasonName(season);
      return `${seasonName} ${year}`;
    }

    // Pattern 4: Full name with 2-digit year "Winter24", "Summer24", "Fall24", "Spring24"
    const fullNameShortYearMatch = normalized.match(
      /^(winter|summer|fall|spring)\s*(\d{2})$/i
    );
    if (fullNameShortYearMatch) {
      const [, season, yearShort] = fullNameShortYearMatch;
      const seasonName =
        season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
      return `${seasonName} 20${yearShort}`;
    }

    // Pattern 5: Full name with 4-digit year "Winter2024", "Winter 2024", etc.
    const fullNameFullYearMatch = normalized.match(
      /^(winter|summer|fall|spring)\s*(\d{4})$/i
    );
    if (fullNameFullYearMatch) {
      const [, season, year] = fullNameFullYearMatch;
      const seasonName =
        season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
      return `${seasonName} ${year}`;
    }

    // No pattern matched - return as-is
    return batch;
  }

  /**
   * Create an error result
   */
  private createErrorResult(errorMessage: string): YCScraperToolResult {
    return {
      people: [],
      companies: [],
      totalPeople: 0,
      totalCompanies: 0,
      batch: this.params.batch?.toUpperCase() || null,
      url: this.params.url || null,
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Transform Apify companies to our format
   */
  private transformCompanies(items: ApifyYCCompany[]): YCCompany[] {
    return items.map((company) => ({
      companyName: company.company_name || null,
      description:
        company.long_description || company.short_description || null,
      batch: company.batch || null,
      website: company.website || null,
      ycUrl: company.yc_url || null,
      founders: (company.founders || []).map((founder) => ({
        name: founder.name || null,
        title: founder.title || null,
        linkedinUrl: founder.linkedin || null,
        bio: founder.bio || null,
        twitterUrl: founder.x || null,
      })),
    }));
  }

  /**
   * Extract and flatten founders into people array
   */
  private extractPeople(items: ApifyYCCompany[]): YCPerson[] {
    const people: YCPerson[] = [];

    for (const company of items) {
      const founders = company.founders || [];
      for (const founder of founders) {
        people.push({
          name: founder.name || null,
          title: founder.title || null,
          currentEmployers: [{ companyName: company.company_name || null }],
          linkedinUrl: founder.linkedin || null,
          twitterUrl: founder.x || null,
          bio: founder.bio || null,
          emails: null, // YC scraper doesn't provide emails
        });
      }
    }

    return people;
  }
}
