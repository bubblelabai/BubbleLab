/**
 * Reddit News Scraper Flow
 *
 * This is a simple BubbleFlow that scrapes Reddit and summarizes news posts.
 */
import {
  BubbleFlow,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Payload interface for the Reddit news flow
 */
interface RedditNewsPayload extends WebhookEvent {
  subreddit: string;
  limit: number;
}

/**
 * RedditNewsFlow - Scrapes Reddit and summarizes news
 *
 * This flow demonstrates:
 * - Using RedditScrapeTool to scrape subreddit posts
 * - Using AIAgentBubble to analyze and summarize content
 * - Simple 2-step workflow
 */
export class RedditNewsFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: RedditNewsPayload) {
    const subreddit = payload.subreddit || 'worldnews';
    const limit = payload.limit || 10;

    // Step 1: Scrape Reddit for posts
    const scrapeResult = await new RedditScrapeTool({
      subreddit: subreddit,
      sort: 'hot',
      limit: limit,
    }).action();

    if (!scrapeResult.success || !scrapeResult.data?.posts) {
      throw new Error('Failed to scrape Reddit or no posts found.');
    }

    const posts = scrapeResult.data.posts;

    // Format posts for AI
    const postsText = posts
      .map(
        (
          post: {
            title: string;
            score: number;
            selftext: string;
            postUrl: string;
          },
          i: number
        ) =>
          `${i + 1}. "${post.title}" (${post.score} upvotes)\n   ${post.selftext || 'No description'}\n   URL: ${post.postUrl}`
      )
      .join('\n\n');

    // Step 2: Summarize the news using AI
    const summaryResult = await new AIAgentBubble({
      message: `Here are the top ${posts.length} posts from r/${subreddit}:
  
  ${postsText}
  
  Please provide:
  1. A summary of the top 5 most important/popular news items
  2. Key themes or trends you notice
  3. A one-paragraph executive summary
  
  Format the response in a clear, readable way.`,
      model: {
        model: 'google/gemini-2.5-flash',
      },
      tools: [],
    }).action();

    return {
      subreddit,
      postsScraped: posts.length,
      summary: summaryResult.data?.response,
      timestamp: new Date().toISOString(),
      status: 'success',
    };
  }
}
