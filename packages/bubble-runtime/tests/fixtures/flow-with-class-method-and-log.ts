import { z } from 'zod';
import {
  BubbleFlow,
  ResearchAgentTool,
  WebScrapeTool,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

// Define the structure for a single job listing using Zod
const JobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  url: z.string().url(),
});

// Define the expected array structure for the research result
const ResearchResultSchema = z.array(JobSchema);

// Define the input payload for the webhook trigger
export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  job_description: string;
}

// Define the output of the workflow
export interface Output {
  message: string;
}

// The main BubbleFlow class for the job search workflow
export class SoftwareJobSearchFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { email, job_description } = payload;

    // Validate the presence of required inputs
    if (!email || !job_description) {
      throw new Error('Email and job description are required in the payload.');
    }

    // Define the JSON schema for the expected research result.
    // This ensures the AI agent returns data in a structured format.
    const expectedResultSchema = `{
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "company": { "type": "string" },
          "location": { "type": "string" },
          "url": { "type": "string", "format": "uri" }
        },
        "required": ["title", "company", "location", "url"]
      }
    }`;

    // Step 1: Try searching with explicit nationwide location parameter
    const nationwideScraper = new WebScrapeTool({
      url: `https://www.ziprecruiter.com/jobs-search?search=${encodeURIComponent(job_description)}&location=United+States&radius=1000`,
      format: 'markdown',
    });

    const scrapeResult = await nationwideScraper.action();

    if (!scrapeResult.success) {
      this.logger?.error(
        `Failed to scrape ZipRecruiter nationwide: ${scrapeResult.error}`
      );
      // Fallback to general search if direct scrape fails
      const fallbackSearcher = new ResearchAgentTool({
        task: `Find the latest ${job_description} jobs nationwide across the United States on ZipRecruiter. Return at least 5 relevant jobs with direct application links. Focus on remote and nationwide positions.`,
        expectedResultSchema: expectedResultSchema,
      });

      const fallbackResult = await fallbackSearcher.action();

      if (!fallbackResult.success || !fallbackResult.data) {
        throw new Error(
          `Both scraping and search failed. Last error: ${fallbackResult.error || 'No data returned'}`
        );
      }

      const parsedFallbackResult = ResearchResultSchema.safeParse(
        fallbackResult.data.result
      );
      if (!parsedFallbackResult.success) {
        throw new Error(
          `Invalid data format: ${JSON.stringify(parsedFallbackResult.error.flatten())}`
        );
      }

      return await this.processJobsAndSendEmail(
        parsedFallbackResult.data,
        email,
        job_description
      );
    }

    // Check if the content shows location-specific results
    const content = scrapeResult.data.content.toLowerCase();
    const isLocationSpecific =
      content.includes('chicago, il') ||
      content.includes('in your area') ||
      (content.includes('no postings for') && content.includes('in'));

    if (isLocationSpecific) {
      this.logger?.info(
        'Detected location-specific results, switching to nationwide search approach'
      );

      // Try a different URL format for nationwide search
      const alternateScraper = new WebScrapeTool({
        url: `https://www.ziprecruiter.com/jobs/${encodeURIComponent(job_description)}?location=&radius=1000`,
        format: 'markdown',
      });

      const alternateResult = await alternateScraper.action();

      if (
        alternateResult.success &&
        !alternateResult.data.content.toLowerCase().includes('chicago, il')
      ) {
        return await this.extractJobsFromContent(
          alternateResult.data.content,
          expectedResultSchema,
          email,
          job_description
        );
      }

      // If still location-specific, use ResearchAgentTool for nationwide search
      const nationwideSearcher = new ResearchAgentTool({
        task: `Search ZipRecruiter for ${job_description} jobs NATIONWIDE across the entire United States. Find at least 5 relevant positions from different locations including remote opportunities. Make sure to get jobs from multiple states, not just one city.`,
        expectedResultSchema: expectedResultSchema,
      });

      const nationwideResult = await nationwideSearcher.action();

      if (!nationwideResult.success || !nationwideResult.data) {
        throw new Error(
          `Nationwide search failed: ${nationwideResult.error || 'No data returned'}`
        );
      }

      const parsedNationwideResult = ResearchResultSchema.safeParse(
        nationwideResult.data.result
      );
      if (!parsedNationwideResult.success) {
        throw new Error(
          `Invalid data format: ${JSON.stringify(parsedNationwideResult.error.flatten())}`
        );
      }

      return await this.processJobsAndSendEmail(
        parsedNationwideResult.data,
        email,
        job_description
      );
    }

    // Step 2: Use the scraped content to find and extract job information
    return await this.extractJobsFromContent(
      scrapeResult.data.content,
      expectedResultSchema,
      email,
      job_description
    );
  }

  private async extractJobsFromContent(
    content: string,
    schema: string,
    email: string,
    job_description: string
  ): Promise<Output> {
    const jobExtractor = new ResearchAgentTool({
      task: `Extract ${job_description} job listings from nationwide search results across the United States. Here is the content:\n\n${content}\n\nFocus on finding at least 5 relevant jobs from different locations across the US, including remote positions. Ensure you get jobs from multiple states/cities, not just one location. Extract title, company, location, and complete application URLs.`,
      expectedResultSchema: schema,
    });

    const extractionResult = await jobExtractor.action();

    if (!extractionResult.success || !extractionResult.data) {
      throw new Error(
        `Failed to extract jobs from nationwide content: ${extractionResult.error || 'No data returned'}`
      );
    }

    // Step 3: Validate the structure of the research result using Zod
    const parsedResult = ResearchResultSchema.safeParse(
      extractionResult.data.result
    );

    if (!parsedResult.success) {
      const validationError = `Job extraction returned data in an unexpected format. Details: ${JSON.stringify(
        parsedResult.error.flatten()
      )}`;
      this.logger?.error(validationError);
      throw new Error(validationError);
    }

    return await this.processJobsAndSendEmail(
      parsedResult.data,
      email,
      job_description
    );
  }

  private async processJobsAndSendEmail(
    jobs: z.infer<typeof ResearchResultSchema>,
    email: string,
    job_description: string
  ): Promise<Output> {
    if (jobs.length === 0) {
      this.logger?.info(
        'No jobs found nationwide on ZipRecruiter for the given description.'
      );
      return {
        message:
          'Search completed successfully, but no jobs were found nationwide on ZipRecruiter.',
      };
    }

    // Check if we got diverse locations
    const uniqueLocations = [...new Set(jobs.map((job) => job.location))];
    if (uniqueLocations.length === 1) {
      this.logger?.warn(
        `Warning: All jobs are from the same location: ${uniqueLocations[0]}`
      );
    }

    // Step 4: Format the job listings into an HTML email body
    const emailHtml = `
      <h1>🎯 Nationwide ZipRecruiter Job Search Results</h1>
      <p>Here are the latest <strong>${job_description}</strong> jobs from across the <strong>United States</strong> on <strong>ZipRecruiter</strong>:</p>
      <p><em>Found jobs in ${uniqueLocations.length} different location(s)</em></p>
      <ul>
        ${jobs
          .map(
            (job) => `
          <li>
            <strong>${job.title}</strong> at ${job.company} - <em>${job.location}</em>
            <br />
            <a href="${job.url}" style="color: #0066cc; text-decoration: underline;">Apply on ZipRecruiter</a>
          </li>
        `
          )
          .join('')}
      </ul>
      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
        <small>These results are sourced from across the United States via ZipRecruiter.</small>
      </p>
    `;

    // Step 5: Send the results via email using the Resend bubble
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: `🎯 Nationwide Jobs: ${job_description} (${jobs.length} positions)`,
      html: emailHtml,
    });

    const sendEmailResult = await emailSender.action();

    if (!sendEmailResult.success) {
      const emailError = `Failed to send email: ${sendEmailResult.error}`;
      throw new Error(emailError);
    }

    return {
      message: `Successfully found ${jobs.length} nationwide jobs from ${uniqueLocations.length} different locations on ZipRecruiter and sent the results to ${email}.`,
    };
  }
}
