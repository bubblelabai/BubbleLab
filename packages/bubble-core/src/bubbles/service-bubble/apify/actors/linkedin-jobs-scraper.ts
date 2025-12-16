import { z } from 'zod';

export const LinkedInJobsScraperInputSchema = z.object({
  search: z
    .string()
    .min(1, 'Search keyword is required')
    .describe('Job title, keyword, or company name to search for'),

  location: z
    .string()
    .optional()
    .describe(
      'Location for job search (e.g., "New York", "Remote", "United States")'
    ),

  datePosted: z
    .enum(['', 'past-24h', 'past-week', 'past-month', 'any-time'])
    .default('any-time')
    .optional()
    .describe('Filter jobs by when they were posted'),

  experienceLevel: z
    .array(
      z.enum([
        'internship',
        'entry-level',
        'associate',
        'mid-senior',
        'director',
        'executive',
      ])
    )
    .optional()
    .describe('Filter by experience level'),

  jobType: z
    .array(
      z.enum([
        'full-time',
        'part-time',
        'contract',
        'temporary',
        'volunteer',
        'internship',
        'other',
      ])
    )
    .optional()
    .describe('Filter by job type'),

  workplaceType: z
    .array(z.enum(['on-site', 'remote', 'hybrid']))
    .optional()
    .describe('Filter by workplace type (on-site, remote, hybrid)'),

  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(100)
    .optional()
    .describe('Maximum number of jobs to scrape (default: 100)'),
});

export const LinkedInJobSchema = z.object({
  jobId: z.string().optional().describe('LinkedIn job ID'),

  title: z.string().optional().describe('Job title'),

  company: z
    .object({
      name: z.string().optional().describe('Company name'),
      url: z.string().optional().describe('Company LinkedIn URL'),
    })
    .optional()
    .describe('Company information'),

  location: z.string().optional().describe('Job location'),

  description: z.string().optional().describe('Job description (full text)'),

  descriptionHtml: z
    .string()
    .optional()
    .describe('Job description (HTML format)'),

  employmentType: z
    .string()
    .optional()
    .describe('Employment type (Full-time, Part-time, etc.)'),

  seniorityLevel: z.string().optional().describe('Seniority level'),

  industries: z.array(z.string()).optional().describe('Related industries'),

  jobFunctions: z.array(z.string()).optional().describe('Job functions/roles'),

  postedAt: z.string().optional().describe('When the job was posted'),

  postedTimestamp: z.number().optional().describe('Posted time as timestamp'),

  applicants: z.number().optional().describe('Number of applicants'),

  url: z.string().optional().describe('Job posting URL'),

  applyUrl: z.string().optional().describe('Direct apply URL'),

  workplaceType: z
    .string()
    .optional()
    .describe('Workplace type (On-site, Remote, Hybrid)'),

  salary: z
    .object({
      from: z.number().optional(),
      to: z.number().optional(),
      currency: z.string().optional(),
      period: z.string().optional(),
    })
    .optional()
    .describe('Salary information if available'),

  skills: z.array(z.string()).optional().describe('Required skills'),
});

export type LinkedInJobsScraperInput = z.output<
  typeof LinkedInJobsScraperInputSchema
>;
export type LinkedInJob = z.output<typeof LinkedInJobSchema>;
