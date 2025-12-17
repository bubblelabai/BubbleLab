import { z } from 'zod';
import {
  BubbleFlow,
  RedditScrapeTool,
  AIAgentBubble,
  GoogleSheetsBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  processedCount: number;
  leadsFound: number;
}

export interface RedditLeadPayload extends WebhookEvent {
  /**
   * List of subreddits to monitor (e.g., ['SaaS', 'marketing', 'automation']).
   * @canBeFile false
   */
  subreddits: string[];

  /**
   * The Google Spreadsheet ID where leads will be saved.
   * Found in the URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   * @canBeFile false
   */
  spreadsheetId: string;

  /**
   * Number of posts to scrape per subreddit.
   * Defaults to 5 if not specified.
   */
  limit?: number;
}

interface LeadAnalysis {
  intent:
    | 'Buying / Automation Request (Hot Lead)'
    | 'System Showcase (Competitor Intel)'
    | 'Question (Content Idea)';
  relevanceScore: number;
  reason: string;
  painPoint: string | null;
  desiredSolution: string | null;
}

// Zod schema that matches the LeadAnalysis interface structure
const LeadAnalysisSchema = z.object({
  intent: z.enum([
    'Buying / Automation Request (Hot Lead)',
    'System Showcase (Competitor Intel)',
    'Question (Content Idea)',
  ]),
  relevanceScore: z.number().min(1).max(10),
  reason: z.string(),
  painPoint: z.string().nullable(),
  desiredSolution: z.string().nullable(),
});

interface RedditPost {
  title: string;
  url: string;
  author: string;
  score: number;
  numComments: number;
  createdUtc: number;
  postUrl: string;
  selftext: string;
  subreddit: string;
  isSelf: boolean;
  thumbnail?: string | null;
  domain?: string | null;
  postHint?: string | null;
  flair?: string | null;
  id?: string;
}

export class RedditLeadIntelligenceFlow extends BubbleFlow<'webhook/http'> {
  // Scrapes recent posts from a specific subreddit using the Reddit Scrape Tool
  private async scrapeSubreddit(subreddit: string, limit: number = 10) {
    // Scrapes posts from the specified subreddit with 'new' sort to get the latest discussions
    // Returns a list of posts containing title, content, url, and metadata
    const scraper = new RedditScrapeTool({
      subreddit: subreddit,
      limit: limit,
      sort: 'new',
      timeFilter: 'month',
    });

    const result = await scraper.action();

    if (!result.success) {
      this.logger?.error(`Failed to scrape r/${subreddit}: ${result.error}`);
      return [];
    }

    return result.data.posts || [];
  }

  // Analyzes a single Reddit post using AI to classify intent and score relevance
  // Condition: Runs for every scraped post to determine if it's a potential lead
  private async analyzePost(post: RedditPost): Promise<LeadAnalysis | null> {
    const prompt = `
    Analyze this Reddit post for sales intent.
    
    Subreddit: r/${post.subreddit}
    Title: ${post.title}
    Content: ${post.selftext || '(Link Post)'}
    
    Classify the intent into ONLY one of these categories:
    1. "Buying / Automation Request (Hot Lead)" - User is actively looking for a tool, service, alternative, or solution.
    2. "System Showcase (Competitor Intel)" - User is sharing a product, tool, workflow, startup, or solution they built or use.
    3. "Question (Content Idea)" - User is asking for advice, learning, opinions, or general guidance.
    
    Give a Relevance Score from 1–10 based on how closely the post matches a business that sells software, AI, automation, or services.
    8–10 = strong match, actionable
    5–7 = moderate, worth watching
    1–4 = low value
    
    Explain why in 1-2 short sentences.
    
    If intent is "Buying / Automation Request (Hot Lead)", extract:
    - Pain Point
    - Desired Solution
    `;

    // Uses Gemini 2.5 Flash with structured output schema to ensure the response matches LeadAnalysis format
    // The expectedOutputSchema parameter automatically enables JSON mode and validates the output structure
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt:
        'You are a lead intelligence expert. Analyze Reddit posts and classify them by sales intent.',
      message: prompt,
      expectedOutputSchema: LeadAnalysisSchema,
    });

    const result = await agent.action();

    if (!result.success) {
      this.logger?.error(
        `AI analysis failed for post ${post.id}: ${result.error}`
      );
      return null;
    }

    try {
      // Parse the response using the schema - the AI already returns structured JSON
      const analysis = JSON.parse(result.data.response) as LeadAnalysis;
      return analysis;
    } catch (e) {
      this.logger?.error(`Failed to parse AI response: ${e}`);
      return null;
    }
  }

  // Formats the post and analysis data into a row for Google Sheets
  private formatRow(post: RedditPost, analysis: LeadAnalysis): string[] {
    const date = new Date(post.createdUtc * 1000).toISOString().split('T')[0];
    return [
      date,
      post.subreddit,
      post.title,
      post.postUrl,
      analysis.intent,
      analysis.relevanceScore.toString(),
      analysis.reason,
      analysis.painPoint || '',
      analysis.desiredSolution || '',
    ];
  }

  // Appends a batch of formatted rows to the Google Sheet
  // Condition: Only runs if there are valid rows to save
  private async saveToSheet(
    spreadsheetId: string,
    rows: string[][]
  ): Promise<boolean> {
    if (rows.length === 0) return true;

    this.logger?.info(`Saving ${rows.length} rows to Google Sheets...`);

    // Appends the analyzed lead data to the 'Sheet1' tab (or default first sheet)
    // Uses USER_ENTERED input option so Google Sheets parses dates and numbers correctly
    const sheets = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A1',
      values: rows,
      value_input_option: 'USER_ENTERED',
    });

    const result = await sheets.action();

    if (!result.success) {
      this.logger?.error(`Failed to save to Google Sheets: ${result.error}`);
      return false;
    }

    this.logger?.info(
      `Successfully saved ${rows.length} rows. Updated range: ${result.data.updated_range}`
    );
    return true;
  }

  async handle(payload: RedditLeadPayload): Promise<Output> {
    const {
      subreddits = ['SaaS', 'automation', 'marketing'],
      spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      limit = 5,
    } = payload;

    let totalProcessed = 0;
    let leadsFound = 0;
    const failedSubreddits: string[] = [];

    for (const subreddit of subreddits) {
      this.logger?.info(`Processing r/${subreddit}...`);

      const posts = await this.scrapeSubreddit(subreddit, limit);

      // If scraping failed (empty array), track it and continue
      if (posts.length === 0) {
        failedSubreddits.push(subreddit);
        this.logger?.warn(
          `Skipping r/${subreddit} - no posts retrieved (subreddit may not exist or is private)`
        );
        continue;
      }

      const rowsToSave: string[][] = [];

      for (const post of posts) {
        const analysis = await this.analyzePost(post);

        if (analysis) {
          totalProcessed++;
          // We save everything, but track "leads" as high relevance
          if (analysis.relevanceScore >= 8) {
            leadsFound++;
          }

          rowsToSave.push(this.formatRow(post, analysis));
        }
      }

      if (rowsToSave.length > 0) {
        await this.saveToSheet(spreadsheetId, rowsToSave);
      }
    }

    const successfulCount = subreddits.length - failedSubreddits.length;
    let message = `Successfully processed ${totalProcessed} posts across ${successfulCount} subreddit${successfulCount !== 1 ? 's' : ''}. Found ${leadsFound} high-relevance leads.`;

    if (failedSubreddits.length > 0) {
      message += ` | Failed subreddits (check spelling/case): ${failedSubreddits.join(', ')}`;
    }

    return {
      message,
      processedCount: totalProcessed,
      leadsFound: leadsFound,
    };
  }
}
