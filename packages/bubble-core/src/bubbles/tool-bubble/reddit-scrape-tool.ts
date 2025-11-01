import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// Reddit post structure schema
const RedditPostSchema = z.object({
  title: z.string().describe('Post title'),
  url: z.string().describe('Post URL (external link or Reddit permalink)'),
  author: z.string().describe('Username of the post author'),
  score: z.number().describe('Post upvote score'),
  numComments: z.number().describe('Number of comments on the post'),
  createdUtc: z.number().describe('Post creation timestamp (Unix UTC)'),
  postUrl: z.string().describe('Reddit url to the post'),
  selftext: z
    .string()
    .describe(
      "Post content text (for text posts/self posts). Empty for link posts which don't have text content."
    ),
  subreddit: z.string().describe('Subreddit name'),
  postHint: z
    .string()
    .nullable()
    .optional()
    .describe('Post type hint (image, video, link, etc.)'),
  isSelf: z
    .boolean()
    .describe('Whether this is a text post (true) or link post (false)'),
  thumbnail: z.string().optional().describe('Thumbnail image URL if available'),
  domain: z.string().optional().describe('Domain of external link'),
  flair: z.string().optional().describe('Post flair text'),
});

// Define the parameters schema for the Reddit Scrape Tool
const RedditScrapeToolParamsSchema = z.object({
  subreddit: z
    .string()
    .min(1, 'Subreddit name is required')
    .transform((val) => {
      // Strip "r/" prefix if present (be tolerant of input format)
      return val.startsWith('r/') ? val.substring(2) : val;
    })
    .pipe(
      z
        .string()
        .regex(
          /^[a-zA-Z0-9_]+$/,
          'Subreddit name can only contain letters, numbers, and underscores'
        )
    )
    .describe('Name of the subreddit to scrape (with or without r/ prefix)'),

  limit: z
    .number()
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000')
    .default(100)
    .describe('Maximum number of posts to fetch (1-1000, default: 25)'),

  sort: z
    .enum(['hot', 'new', 'top', 'rising'])
    .default('hot')
    .describe('Sorting method for posts (default: hot)'),

  timeFilter: z
    .enum(['hour', 'day', 'week', 'month', 'year', 'all'])
    .optional()
    .describe('Time filter for "top" sort (only applies when sort=top)'),

  filterToday: z
    .boolean()
    .default(false)
    .describe('Filter results to only include posts from today'),

  includeStickied: z
    .boolean()
    .default(false)
    .describe('Include stickied/pinned posts in results'),

  minScore: z
    .number()
    .optional()
    .describe('Minimum upvote score required for posts'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Optional credentials for enhanced features'),
});

// Result schema for the Reddit scrape tool
const RedditScrapeToolResultSchema = z.object({
  posts: z.array(RedditPostSchema).describe('Array of scraped Reddit posts'),

  metadata: z
    .object({
      subreddit: z.string().describe('Subreddit that was scraped'),
      requestedLimit: z.number().describe('Number of posts requested'),
      actualCount: z.number().describe('Actual number of posts returned'),
      filteredCount: z.number().describe('Number of posts after filtering'),
      sort: z.string().describe('Sorting method used'),
      timeFilter: z.string().optional().describe('Time filter used (if any)'),
      scrapedAt: z.string().describe('ISO timestamp when scraping occurred'),
      apiEndpoint: z.string().describe('Reddit API endpoint used'),
    })
    .describe('Metadata about the scraping operation'),

  success: z.boolean().describe('Whether the scraping was successful'),
  error: z.string().describe('Error message if scraping failed'),
});

// Type definitions
type RedditScrapeToolParams = z.output<typeof RedditScrapeToolParamsSchema>;
type RedditScrapeToolResult = z.output<typeof RedditScrapeToolResultSchema>;
type RedditScrapeToolParamsInput = z.input<typeof RedditScrapeToolParamsSchema>;
type RedditPost = z.output<typeof RedditPostSchema>;

export class RedditScrapeTool extends ToolBubble<
  RedditScrapeToolParams,
  RedditScrapeToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'reddit-scrape-tool';
  static readonly schema = RedditScrapeToolParamsSchema;
  static readonly resultSchema = RedditScrapeToolResultSchema;
  static readonly shortDescription =
    'Scrapes posts from any Reddit subreddit with flexible filtering and sorting options';
  static readonly longDescription = `
    A specialized tool for scraping Reddit posts from any subreddit with comprehensive filtering and sorting capabilities.
    
    🔥 Core Features:
    - Scrape posts from any public subreddit
    - Multiple sorting options (hot, new, top, rising)
    - Flexible post limits (1-1000 posts with pagination)
    - Time-based filtering for top posts
    - Today-only filtering option
    - Score-based filtering
    - Stickied post inclusion/exclusion
    
    📊 Post Data Extracted:
    - Title, author, and content
    - Upvote scores and comment counts
    - Creation timestamps and permalinks
    - Post types (text vs link posts)
    - External URLs and domains
    - Thumbnails and flairs
    - Comprehensive metadata
    
    🎯 Use Cases:
    - Monitor specific subreddits for trends
    - Gather posts for content analysis
    - Track community engagement metrics
    - Feed Reddit data into other workflows
    - Research subreddit activity patterns
    - Content aggregation and curation
    
    ⚡ Technical Features:
    - Uses Reddit's official JSON API
    - No authentication required for public posts
    - Respects Reddit's rate limiting
    - Handles large subreddits efficiently
    - Robust error handling and validation
    - Clean, structured data output
    
    Perfect for integration with AI agents, data analysis workflows, and content monitoring systems.
  `;
  static readonly alias = 'reddit';
  static readonly type = 'tool';

  constructor(
    params: RedditScrapeToolParamsInput = {
      subreddit: 'news',
      limit: 25,
      sort: 'hot',
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(
    context?: BubbleContext
  ): Promise<RedditScrapeToolResult> {
    void context; // Context available but not currently used

    const { subreddit, limit, sort, timeFilter } = this.params;
    const scrapedAt = new Date().toISOString();

    try {
      console.log(
        `[RedditScrapeTool] Scraping r/${subreddit} with ${limit} ${sort} posts`
      );

      // Fetch posts with pagination support (up to 1000 posts)
      const rawPosts = await this.fetchPostsWithPagination();
      console.log(`[RedditScrapeTool] Found ${rawPosts.length} raw posts`);

      // Apply filters
      const filteredPosts = this.applyFilters(rawPosts);
      console.log(
        `[RedditScrapeTool] ${filteredPosts.length} posts after filtering`
      );

      // Limit results
      const finalPosts = filteredPosts.slice(0, limit);

      return {
        posts: finalPosts,
        metadata: {
          subreddit,
          requestedLimit: limit,
          actualCount: rawPosts.length,
          filteredCount: filteredPosts.length,
          sort,
          timeFilter,
          scrapedAt,
          apiEndpoint: this.buildRedditApiUrl(),
        },
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[RedditScrapeTool] Scraping error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        posts: [],
        metadata: {
          subreddit,
          requestedLimit: limit,
          actualCount: 0,
          filteredCount: 0,
          sort,
          timeFilter,
          scrapedAt,
          apiEndpoint: this.buildRedditApiUrl(),
        },
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build the Reddit JSON API URL with optional pagination
   */
  private buildRedditApiUrl(after?: string): string {
    const { subreddit, sort, timeFilter } = this.params;

    // Use max limit of 100 per request (Reddit API limit)
    // Add raw_json=1 to get unprocessed JSON content (helps ensure full selftext)
    let url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100&raw_json=1`;

    // Add time filter for top posts
    if (sort === 'top' && timeFilter) {
      url += `&t=${timeFilter}`;
    }

    // Add pagination parameter if provided
    if (after) {
      url += `&after=${after}`;
    }

    return url;
  }

  /**
   * Fetch posts with pagination support (up to 1000 posts)
   * Makes multiple requests if needed, using the 'after' parameter for pagination
   */
  private async fetchPostsWithPagination(): Promise<RedditPost[]> {
    const { limit } = this.params;
    const allPosts: RedditPost[] = [];
    let after: string | null = null;
    const maxRequests = Math.ceil(limit / 100); // Max 100 posts per request

    for (
      let requestNum = 0;
      requestNum < maxRequests && allPosts.length < limit;
      requestNum++
    ) {
      const apiUrl = this.buildRedditApiUrl(after || undefined);

      if (requestNum === 0) {
        console.log(`[RedditScrapeTool] API endpoint: ${apiUrl}`);
      } else {
        console.log(`[RedditScrapeTool] Fetching page ${requestNum + 1}...`);
      }

      try {
        // Fetch data from Reddit's JSON API
        const redditData = await this.fetchRedditData(apiUrl);

        // Parse and process posts
        const posts = this.parseRedditResponse(redditData);
        allPosts.push(...posts);

        // Stop if we've collected enough posts
        if (allPosts.length >= limit) {
          break;
        }

        // Get the 'after' parameter for next page
        after = redditData?.data?.after || null;

        // If no more posts available, break
        if (!after || posts.length === 0) {
          break;
        }

        // Respect rate limits - add a small delay between requests
        if (requestNum < maxRequests - 1 && allPosts.length < limit) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
        }
      } catch (error) {
        console.error(
          `[RedditScrapeTool] Error fetching page ${requestNum + 1}:`,
          error
        );
        // If we have some posts, return what we have
        if (allPosts.length > 0) {
          break;
        }
        // If this is the first request and it fails, throw the error
        throw error;
      }
    }

    return allPosts;
  }

  /**
   * Get a random user agent to avoid being blocked
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Fetch data from Reddit's JSON API
   */
  private async fetchRedditData(url: string): Promise<any> {
    const https = await import('https');

    return new Promise((resolve, reject) => {
      const request = https.get(
        url,
        {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
          },
        },
        (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            if (response.statusCode === 200) {
              try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
              } catch (parseError) {
                reject(
                  new Error(
                    `Failed to parse Reddit JSON response: ${parseError}`
                  )
                );
              }
            } else {
              reject(
                new Error(
                  `Reddit API returned status ${response.statusCode}: ${response.statusMessage}`
                )
              );
            }
          });
        }
      );

      request.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      request.setTimeout(15000, () => {
        request.destroy();
        reject(
          new Error(
            'Request timeout - Reddit API did not respond within 15 seconds'
          )
        );
      });
    });
  }

  /**
   * Parse Reddit JSON response into standardized post objects
   */
  private parseRedditResponse(data: any): RedditPost[] {
    const posts: RedditPost[] = [];

    try {
      if (data?.data?.children) {
        for (const child of data.data.children) {
          const post = child.data;

          // Skip if not a post (could be an ad or other content)
          if (!post || !post.title) continue;

          // Extract selftext - for text posts (is_self=true), this contains the post content
          // For link posts (is_self=false), selftext will be empty (expected - they don't have text content)
          // Try selftext_html as fallback if selftext is empty but post is marked as self post
          let selftext = post.selftext || '';
          const isSelfPost = post.is_self || false;

          // If selftext is empty but we have selftext_html and it's a self post, try to use HTML version
          // (though we prefer plain text, this is a fallback)
          if (isSelfPost && !selftext && post.selftext_html) {
            // For now, we'll use selftext_html as a fallback (could decode HTML if needed)
            selftext = post.selftext_html;
            console.warn(
              `[RedditScrapeTool] Text post "${post.title.substring(0, 50)}..." has empty selftext, using selftext_html`
            );
          }

          // Debug logging for text posts without any content (might indicate an API issue)
          if (isSelfPost && !selftext && !post.selftext_html) {
            console.warn(
              `[RedditScrapeTool] Text post "${post.title.substring(0, 50)}..." has no content (empty selftext and selftext_html)`
            );
          }

          posts.push({
            title: post.title,
            url: post.url || '',
            author: post.author || '[deleted]',
            score: post.score || 0,
            numComments: post.num_comments || 0,
            createdUtc: post.created_utc || 0,
            postUrl: post.permalink
              ? `https://reddit.com${post.permalink}`
              : '',
            selftext: selftext,
            subreddit: post.subreddit || this.params.subreddit,
            postHint: post.post_hint || null,
            isSelf: isSelfPost,
            thumbnail:
              post.thumbnail !== 'self' && post.thumbnail !== 'default'
                ? post.thumbnail
                : undefined,
            domain: post.domain || undefined,
            flair: post.link_flair_text || undefined,
          });
        }
      }
    } catch (error) {
      console.error('[RedditScrapeTool] Error parsing Reddit response:', error);
      throw new Error(`Failed to parse Reddit data: ${error}`);
    }

    return posts;
  }

  /**
   * Apply various filters to the posts
   */
  private applyFilters(posts: RedditPost[]): RedditPost[] {
    let filtered = [...posts];

    // Filter out stickied posts if not requested
    if (!this.params.includeStickied) {
      // Note: Reddit's JSON API typically marks stickied posts with 'stickied: true'
      // but we'll filter based on common patterns since we don't have that field in our schema
      filtered = filtered.filter(
        (post) => !post.title.toLowerCase().includes('[sticky]')
      );
    }

    // Apply minimum score filter
    if (this.params.minScore !== undefined) {
      filtered = filtered.filter((post) => post.score >= this.params.minScore!);
    }

    // Filter to today's posts if requested
    if (this.params.filterToday) {
      const now = new Date();
      const todayStart =
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() /
        1000;
      filtered = filtered.filter((post) => post.createdUtc >= todayStart);
    }

    return filtered;
  }
}

// Export types for external use
export type { RedditPost, RedditScrapeToolParams, RedditScrapeToolResult };
