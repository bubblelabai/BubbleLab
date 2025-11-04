import { z } from 'zod';
import {
  BubbleFlow,
  WebhookEvent,
  CronEvent,
  WebScrapeTool,
  GoogleSheetsBubble,
} from '@bubblelab/bubble-core';

// Define the output structure for the workflow
export interface Output {
  spreadsheetUrl: string;
  companiesProcessed: number;
  message: string;
}

// Define the custom input payload for the webhook trigger
export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetName: string;
  ycUrl?: string;
}

// Helper function to extract unique links using a regex
const extractUniqueLinks = (content: string, pattern: RegExp): string[] => {
  const matches = content.match(pattern) || [];
  // Remove parentheses and duplicates
  const cleanedLinks = matches.map((link) => link.slice(1, -1));
  return [...new Set(cleanedLinks)];
};

export class YCCompanyScraper extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      spreadsheetName = 'YC Companies Fall 2025',
      ycUrl = 'https://www.ycombinator.com/companies?batch=Fall%202025',
    } = payload;

    // 1. Scrape the main YC directory page to get company links
    this.logger?.info(`Scraping main directory: ${ycUrl}`);
    const mainPageScraper = new WebScrapeTool({ url: ycUrl });
    const mainPageResult = await mainPageScraper.action();

    if (!mainPageResult.success || !mainPageResult.data?.content) {
      throw new Error(`Failed to scrape main YC page: ${mainPageResult.error}`);
    }

    // 2. Extract individual company page URLs from the scraped content
    const companyLinks = extractUniqueLinks(
      mainPageResult.data.content,
      /\(https:\/\/www\.ycombinator\.com\/companies\/[^\)]+\)/g
    );
    this.logger?.info(`Found ${companyLinks.length} company links.`);

    if (companyLinks.length === 0) {
      this.logger?.info('No company links found. Exiting.');
      return {
        spreadsheetUrl: '',
        companiesProcessed: 0,
        message: 'No companies found on the directory page.',
      };
    }

    // 3. Create a new Google Sheet to store the results
    this.logger?.info(`Creating spreadsheet: ${spreadsheetName}`);
    const createSheetBubble = new GoogleSheetsBubble({
      operation: 'create_spreadsheet',
      title: spreadsheetName,
    });
    const createSheetResult = await createSheetBubble.action();

    const spreadsheetId = createSheetResult.data?.spreadsheet?.spreadsheetId;
    const spreadsheetUrl = createSheetResult.data?.spreadsheet?.spreadsheetUrl;

    if (!createSheetResult.success || !spreadsheetId || !spreadsheetUrl) {
      throw new Error(
        `Failed to create Google Sheet: ${createSheetResult.error}`
      );
    }
    this.logger?.info(`Spreadsheet created with ID: ${spreadsheetId}`);

    // 4. Add a header row to the newly created sheet
    const headers = [['Company Name', 'Description', 'Founder LinkedIn URLs']];
    const appendHeadersBubble = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A1',
      values: headers,
    });
    await appendHeadersBubble.action();

    // 5. Process companies in batches to avoid overwhelming the system
    const batchSize = 5;
    let companiesProcessed = 0;
    for (let i = 0; i < companyLinks.length; i += batchSize) {
      const batch = companyLinks.slice(i, i + batchSize);
      this.logger?.info(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

      const companyDataPromises = batch.map(async (companyUrl) => {
        try {
          // Scrape individual company page
          const companyPageScraper = new WebScrapeTool({ url: companyUrl });
          const companyPageResult = await companyPageScraper.action();

          if (!companyPageResult.success || !companyPageResult.data?.content) {
            this.logger?.error(
              `Failed to scrape ${companyUrl}: ${companyPageResult.error}`
            );
            return null;
          }

          const content = companyPageResult.data.content;

          // Extract company name (typically the first H1)
          const nameMatch = content.match(/^#\s*(.*)/m);
          const companyName = nameMatch ? nameMatch[1].trim() : 'N/A';

          // Extract description (text after the name and before founders)
          const descriptionMatch = content.match(/\n\n(.*?)\n\n/);
          const description = descriptionMatch
            ? descriptionMatch[1].trim()
            : 'N/A';

          // Extract founder LinkedIn URLs
          const linkedInUrls = extractUniqueLinks(
            content,
            /\(https:\/\/www\.linkedin\.com\/in\/[^\)]+\)/g
          );
          const linkedInUrlsString = linkedInUrls.join(', ');

          return [companyName, description, linkedInUrlsString];
        } catch (error) {
          this.logger?.error(
            `Error processing ${companyUrl}: ${(error as Error).message}`
          );
          return null;
        }
      });

      const results = await Promise.all(companyDataPromises);
      const validResults = results.filter((r) => r !== null) as string[][];

      // 6. Append the batch of valid results to the Google Sheet
      if (validResults.length > 0) {
        const appendDataBubble = new GoogleSheetsBubble({
          operation: 'append_values',
          spreadsheet_id: spreadsheetId,
          range: 'Sheet1!A1',
          values: validResults,
        });
        const appendResult = await appendDataBubble.action();
        if (appendResult.success) {
          companiesProcessed += validResults.length;
          this.logger?.info(
            `Successfully appended ${validResults.length} rows.`
          );
        } else {
          this.logger?.error(`Failed to append data: ${appendResult.error}`);
        }
      }
    }

    this.logger?.info('Workflow finished successfully.');
    return {
      spreadsheetUrl,
      companiesProcessed,
      message: `Successfully scraped ${companiesProcessed} companies and saved to Google Sheets.`,
    };
  }
}
