import { z } from 'zod';
import {
  BubbleFlow,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** The HTML string containing the formatted list of leads. */
  html: string;
  /** Number of leads found. */
  leadCount: number;
}

export interface RedditLeadScraperPayload extends WebhookEvent {
  /**
   * List of subreddits to scrape.
   * Defaults to ['agency', 'freelance', 'entrepreneur', 'artificialintelligence', 'marketing', 'SaaS'].
   */
  subreddits?: string[];

  /**
   * Keywords to filter posts by before sending to AI.
   * Defaults to ['AI automation', 'agency', 'freelance', 'client', 'service'].
   */
  keywords?: string[];

  /**
   * Number of posts to scrape per subreddit.
   * Defaults to 25.
   */
  postsPerSubreddit?: number;
}

interface RedditPost {
  title: string;
  url: string;
  author: string;
  selftext: string;
  subreddit: string;
  score: number;
  createdUtc: number;
}

export class RedditLeadScraperFlow extends BubbleFlow<'webhook/http'> {
  // Scrapes posts from a single subreddit using the RedditScrapeTool
  // Condition: Runs for each subreddit in the input list
  private async scrapeSubreddit(
    subreddit: string,
    limit: number
  ): Promise<RedditPost[]> {
    // Scrapes posts from the specified subreddit, sorting by 'new' to get the latest discussions.
    // Returns an array of post objects containing title, author, content, and metadata.
    const scraper = new RedditScrapeTool({
      subreddit, // Add the required subreddit parameter
      limit,
      sort: 'new',
    });

    const result = await scraper.action();

    if (!result.success) {
      console.error(`Failed to scrape r/${subreddit}: ${result.error}`);
      return [];
    }

    return result.data.posts as RedditPost[];
  }

  // Filters raw posts based on keywords to reduce noise before AI processing
  // Condition: Always runs after scraping to select relevant posts
  private filterPosts(posts: RedditPost[], keywords: string[]): RedditPost[] {
    return posts.filter((post) => {
      const content = `${post.title} ${post.selftext}`.toLowerCase();
      return keywords.some((keyword) =>
        content.includes(keyword.toLowerCase())
      );
    });
  }

  // Analyzes filtered posts to identify potential leads and formats them into HTML
  // Condition: Runs if there are filtered posts to analyze
  private async analyzeAndFormatLeads(posts: RedditPost[]): Promise<string> {
    // Prepare a simplified version of posts to save tokens
    const postsData = posts.map((p) => ({
      author: p.author,
      subreddit: p.subreddit,
      title: p.title,
      content: p.selftext.substring(0, 500), // Truncate long content
      url: p.url,
    }));

    // Uses Gemini Flash to analyze post content, identify users running agencies/freelancing,
    // and generate a clean HTML table with their details and reasoning.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: `You are a lead generation expert. Your task is to analyze Reddit posts to find users who are likely running an AI Automation Agency (AAA) or working as a freelancer in the AI/tech space.
      
      Look for indicators like:
      - "I run an agency..."
      - "My clients..."
      - "How do I get more clients for my AAA..."
      - "I'm a freelancer offering..."
      
      Ignore users who are just asking basic questions or looking to hire (unless they are also an agency owner).
      
      Output ONLY a valid HTML string containing a clean, styled table with the following columns:
      - User (link to reddit profile)
      - Subreddit
      - Context (Brief summary of why you think they are a lead)
      - Link (Link to the post)
      
      If no leads are found, return a simple HTML paragraph saying "No leads found matching the criteria."`,
      message: `Analyze these posts and find potential leads:\n${JSON.stringify(postsData)}`,
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI Agent failed: ${result.error}`);
    }

    return result.data.response;
  }

  // Main workflow orchestration
  async handle(payload: RedditLeadScraperPayload): Promise<Output> {
    const {
      subreddits = [
        'agency',
        'freelance',
        'entrepreneur',
        'artificialintelligence',
        'marketing',
        'SaaS',
      ],
      keywords = ['AI automation', 'agency', 'freelance', 'client', 'service'],
      postsPerSubreddit = 25,
    } = payload;

    // 1. Scrape all subreddits in parallel (batched)
    const allPosts: RedditPost[] = [];

    // Process in batches of 3 to avoid rate limits/overloading
    for (let i = 0; i < subreddits.length; i += 3) {
      const batch = subreddits.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map((sub) => this.scrapeSubreddit(sub, postsPerSubreddit))
      );
      batchResults.forEach((posts) => allPosts.push(...posts));
    }

    // 2. Filter posts locally
    const filteredPosts = this.filterPosts(allPosts, keywords);

    this.logger?.info(
      `Scraped ${allPosts.length} posts, filtered down to ${filteredPosts.length} relevant posts.`
    );

    // 3. Analyze with AI and generate HTML
    let htmlOutput = '<p>No relevant posts found to analyze.</p>';
    if (filteredPosts.length > 0) {
      htmlOutput = await this.analyzeAndFormatLeads(filteredPosts);
    }

    // 4. Log the result (as requested by instructions when output location is unknown)
    this.logger?.info('Generated HTML Report:');
    this.logger?.info(htmlOutput);

    return {
      html: htmlOutput,
      leadCount: filteredPosts.length, // Approximate, as AI might filter further
    };
  }
}
