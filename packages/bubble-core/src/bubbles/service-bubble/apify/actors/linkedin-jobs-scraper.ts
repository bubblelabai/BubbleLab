import { z } from 'zod';

export const LinkedInJobsScraperInputSchema = z.object({
  urls: z
    .array(z.string().url())
    .min(1, 'At least one LinkedIn jobs search URL is required')
    .describe(
      'LinkedIn jobs search URLs. Go to linkedin jobs search page on incognito window (to access public version), search with required filters and once you are done, copy the full URL from address bar and pass it here. You can pass multiple search URLs'
    ),

  scrapeCompany: z
    .boolean()
    .default(true)
    .optional()
    .describe(
      'This will require additional scraping requests for each job record and take longer to scrape. Default value is true'
    ),

  count: z
    .number()
    .min(100)
    .optional()
    .describe('Limit number of jobs scraped'),
});

export const LinkedInJobSchema = z.object({
  id: z.string().optional().describe('LinkedIn job ID'),

  trackingId: z.string().optional().describe('Tracking ID for the job'),

  refId: z.string().optional().describe('Reference ID for the job'),

  link: z.string().optional().describe('Job posting URL'),

  title: z.string().optional().describe('Job title'),

  companyName: z.string().optional().describe('Company name'),

  companyLinkedinUrl: z.string().optional().describe('Company LinkedIn URL'),

  companyLogo: z.string().optional().describe('Company logo URL'),

  location: z.string().optional().describe('Job location'),

  salaryInfo: z
    .array(z.string())
    .optional()
    .describe('Salary information as array of strings'),

  postedAt: z
    .string()
    .optional()
    .describe('When the job was posted (YYYY-MM-DD format)'),

  benefits: z.array(z.string()).optional().describe('Job benefits'),

  descriptionHtml: z
    .string()
    .optional()
    .describe('Job description (HTML format)'),

  applicantsCount: z
    .string()
    .optional()
    .describe('Number of applicants as string'),

  applyUrl: z.string().optional().describe('Direct apply URL'),

  salary: z.string().optional().describe('Salary as string (may be empty)'),

  descriptionText: z
    .string()
    .optional()
    .describe('Job description (plain text)'),

  seniorityLevel: z.string().optional().describe('Seniority level'),

  employmentType: z
    .string()
    .optional()
    .describe('Employment type (Full-time, Part-time, etc.)'),

  jobFunction: z.string().optional().describe('Job function/role'),

  industries: z.string().optional().describe('Related industries'),

  inputUrl: z.string().optional().describe('Original search URL used'),

  companyAddress: z
    .object({
      type: z
        .string()
        .optional()
        .describe('Address type (e.g., "PostalAddress")'),
      streetAddress: z.string().optional().describe('Street address'),
      addressLocality: z.string().optional().describe('City'),
      addressRegion: z.string().optional().describe('State/Region'),
      postalCode: z.string().optional().describe('Postal/ZIP code'),
      addressCountry: z.string().optional().describe('Country code'),
    })
    .optional()
    .describe('Company address information'),

  companyWebsite: z.string().optional().describe('Company website URL'),

  companySlogan: z.string().optional().describe('Company slogan/tagline'),

  companyDescription: z.string().optional().describe('Company description'),

  companyEmployeesCount: z
    .number()
    .optional()
    .describe('Number of company employees'),
});

export type LinkedInJobsScraperInput = z.output<
  typeof LinkedInJobsScraperInputSchema
>;
export type LinkedInJob = z.output<typeof LinkedInJobSchema>;
