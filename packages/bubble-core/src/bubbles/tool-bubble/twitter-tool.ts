import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput } from '../service-bubble/apify/types.js';

// Unified Twitter data types
const TwitterUserSchema = z.object({
  id: z.string().nullable().describe('User ID'),
  name: z.string().nullable().describe('User display name'),
  userName: z.string().nullable().describe('User handle (username)'),
  description: z.string().nullable().describe('User bio'),
  isVerified: z.boolean().nullable().describe('Whether user is verified'),
  isBlueVerified: z
    .boolean()
    .nullable()
    .describe('Whether user has Twitter Blue'),
  profilePicture: z.string().nullable().describe('Profile picture URL'),
  followers: z.number().nullable().describe('Number of followers'),
  following: z.number().nullable().describe('Number of following'),
  tweetsCount: z.number().nullable().describe('Total number of tweets'),
  url: z.string().nullable().describe('Profile URL'),
  createdAt: z.string().nullable().describe('Account creation date'),
});

const TwitterTweetSchema = z.object({
  id: z.string().nullable().describe('Tweet ID'),
  url: z.string().nullable().describe('Tweet URL'),
  text: z.string().nullable().describe('Tweet text content'),
  author: TwitterUserSchema.nullable().describe('Tweet author information'),
  createdAt: z.string().nullable().describe('Tweet creation date (ISO format)'),
  stats: z
    .object({
      retweetCount: z.number().nullable(),
      replyCount: z.number().nullable(),
      likeCount: z.number().nullable(),
      quoteCount: z.number().nullable(),
      viewCount: z.number().nullable(),
      bookmarkCount: z.number().nullable(),
    })
    .nullable()
    .describe('Tweet engagement statistics'),
  lang: z.string().nullable().describe('Tweet language code'),
  media: z
    .array(
      z.object({
        type: z.string().nullable(),
        url: z.string().nullable(),
        width: z.number().nullable(),
        height: z.number().nullable(),
        duration: z.number().nullable(),
      })
    )
    .nullable()
    .describe('Media attachments'),
  entities: z
    .object({
      hashtags: z.array(z.string()).nullable(),
      urls: z.array(z.string()).nullable(),
      mentions: z.array(z.string()).nullable(),
    })
    .nullable()
    .describe('Tweet entities'),
  isRetweet: z.boolean().nullable(),
  isQuote: z.boolean().nullable(),
  isReply: z.boolean().nullable(),
});

const TwitterToolParamsSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'search', 'scrapeUrl'])
    .describe(
      'Operation to perform: scrapeProfile (get tweets from user handles), search (search tweets by query), scrapeUrl (scrape specific Twitter URLs)'
    ),

  // === scrapeProfile operation ===
  twitterHandles: z
    .array(z.string())
    .optional()
    .describe(
      '[scrapeProfile] Twitter handles/usernames to scrape (without @). Example: ["elonmusk", "OpenAI"]'
    ),

  // === search operation ===
  searchTerms: z
    .array(z.string())
    .optional()
    .describe(
      '[search] Search queries. Supports advanced search syntax: https://github.com/igorbrigadir/twitter-advanced-search. Example: ["AI news", "#machinelearning"]'
    ),

  // === scrapeUrl operation ===
  startUrls: z
    .array(z.string())
    .optional()
    .describe(
      '[scrapeUrl] Direct Twitter URLs to scrape. Supports Tweet, Profile, Search, or List URLs. Example: ["https://twitter.com/elonmusk/status/123456"]'
    ),

  // === Common options ===
  maxItems: z
    .number()
    .min(1)
    .max(1000)
    .default(20)
    .optional()
    .describe('Maximum number of tweets to return (default: 20, max: 1000)'),

  sort: z
    .enum(['Top', 'Latest'])
    .optional()
    .describe(
      '[search only] Sort results by "Top" (most relevant) or "Latest" (most recent)'
    ),

  tweetLanguage: z
    .string()
    .optional()
    .describe(
      'Filter tweets by language using ISO 639-1 code (e.g., "en" for English, "es" for Spanish)'
    ),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

const TwitterToolResultSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'search', 'scrapeUrl'])
    .describe('Operation that was performed'),

  tweets: z.array(TwitterTweetSchema).describe('Array of scraped tweets'),

  totalTweets: z.number().describe('Total number of tweets scraped'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type TwitterToolParams = z.output<typeof TwitterToolParamsSchema>;
type TwitterToolResult = z.output<typeof TwitterToolResultSchema>;
type TwitterToolParamsInput = z.input<typeof TwitterToolParamsSchema>;
export type TwitterTweet = z.output<typeof TwitterTweetSchema>;
export type TwitterUser = z.output<typeof TwitterUserSchema>;

// Helper type to get the result type for a specific operation
export type TwitterOperationResult<T extends TwitterToolParams['operation']> =
  Extract<TwitterToolResult, { operation: T }>;

/**
 * Generic Twitter/X scraping tool with unified interface
 *
 * This tool abstracts away the underlying scraping service (currently Apify)
 * and provides a simple, opinionated interface for Twitter data extraction.
 *
 * Supports three operations:
 * - scrapeProfile: Scrape user profiles and their tweets
 * - search: Search for tweets by keywords or hashtags
 * - scrapeUrl: Scrape specific Twitter URLs (tweets, profiles, searches, lists)
 *
 * Future versions can add support for other services (BrightData, custom scrapers)
 * while maintaining the same interface.
 */
export class TwitterTool extends ToolBubble<
  TwitterToolParams,
  TwitterToolResult
> {
  static readonly bubbleName: BubbleName = 'twitter-tool';
  static readonly schema = TwitterToolParamsSchema;
  static readonly resultSchema = TwitterToolResultSchema;
  static readonly shortDescription =
    'Scrape Twitter/X profiles, tweets, and search results with a simple, unified interface.';
  static readonly longDescription = `
    Universal Twitter/X scraping tool that provides a simple, opinionated interface for extracting Twitter data.
    
    **OPERATIONS:**
    1. **scrapeProfile**: Scrape user profiles and their tweets
       - Get tweets from specific user handles
       - Track influencer or brand accounts
       - Monitor user activity and engagement
    
    2. **search**: Search for tweets by keywords or hashtags
       - Find tweets by search terms or hashtags
       - Monitor brand mentions and campaigns
       - Research trending topics and conversations
       - Supports advanced search syntax (see Twitter advanced search)
    
    3. **scrapeUrl**: Scrape specific Twitter URLs
       - Scrape individual tweets, profiles, search results, or lists
       - Extract data from specific Twitter URLs
       - Useful for targeted data collection
    
    **WHEN TO USE THIS TOOL:**
    - **Any Twitter scraping task** - profiles, tweets, searches, engagement data
    - **Social media research** - influencer analysis, competitor monitoring
    - **Content gathering** - tweets, replies, retweets, engagement metrics
    - **Market research** - brand mentions, user sentiment on Twitter
    - **Trend analysis** - hashtag tracking, viral content discovery
    - **Real-time monitoring** - track conversations and mentions
    
    **DO NOT USE research-agent-tool or web-scrape-tool for Twitter** - This tool is specifically optimized for Twitter and provides:
    - Unified data format across all Twitter sources
    - Automatic service selection and optimization
    - Rate limiting and reliability handling
    - Clean, structured data ready for analysis
    
    **Simple Interface:**
    Just specify the operation and provide Twitter handles, search terms, or URLs to get back clean, structured data.
    The tool automatically handles:
    - Handle normalization (accepts handles with or without @)
    - Service selection (currently Apify, future: multiple sources)
    - Data transformation to unified format
    - Error handling and retries
    
    **What you get:**
    - Tweets with text, engagement stats, timestamps
    - Author information (for scrapeProfile operation)
    - Hashtags, mentions, and URLs
    - Media attachments
    - Language and metadata
    
    **Use cases:**
    - Influencer analysis and discovery
    - Brand monitoring and sentiment analysis
    - Competitor research on Twitter
    - Content strategy and trend analysis
    - Market research through Twitter data
    - Campaign performance tracking
    - Hashtag research and optimization
    - Real-time event monitoring
    
    The tool uses best-available services behind the scenes while maintaining a consistent, simple interface.
  `;
  static readonly alias = 'twitter';
  static readonly type = 'tool';

  constructor(
    params: TwitterToolParamsInput = {
      operation: 'scrapeProfile',
      twitterHandles: ['elonmusk'],
      maxItems: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<TwitterToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'Twitter scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;

      // Validate required fields based on operation
      if (
        operation === 'scrapeProfile' &&
        (!this.params.twitterHandles || this.params.twitterHandles.length === 0)
      ) {
        return this.createErrorResult(
          'twitterHandles array is required for scrapeProfile operation'
        );
      }

      if (
        operation === 'search' &&
        (!this.params.searchTerms || this.params.searchTerms.length === 0)
      ) {
        return this.createErrorResult(
          'searchTerms array is required for search operation'
        );
      }

      if (
        operation === 'scrapeUrl' &&
        (!this.params.startUrls || this.params.startUrls.length === 0)
      ) {
        return this.createErrorResult(
          'startUrls array is required for scrapeUrl operation'
        );
      }

      const result = await (async (): Promise<TwitterToolResult> => {
        switch (operation) {
          case 'scrapeProfile':
            return await this.handleScrapeProfile(this.params);
          case 'search':
            return await this.handleSearch(this.params);
          case 'scrapeUrl':
            return await this.handleScrapeUrl(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result;
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Create an error result
   */
  private createErrorResult(errorMessage: string): TwitterToolResult {
    const { operation } = this.params;

    return {
      operation: operation || 'scrapeProfile',
      tweets: [],
      totalTweets: 0,
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Handle scrapeProfile operation
   */
  private async handleScrapeProfile(
    params: TwitterToolParams
  ): Promise<TwitterToolResult> {
    // Normalize handles (remove @ if present)
    const normalizedHandles = this.normalizeHandles(params.twitterHandles!);

    // Use Apify service to scrape profiles
    const result = await this.scrapeWithApifyProfiles(
      normalizedHandles,
      params.maxItems || 20,
      params.tweetLanguage,
      params.credentials
    );

    return {
      operation: 'scrapeProfile',
      tweets: result.tweets,
      totalTweets: result.totalTweets,
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Handle search operation
   */
  private async handleSearch(
    params: TwitterToolParams
  ): Promise<TwitterToolResult> {
    // Use Apify service to search tweets
    const result = await this.scrapeWithApifySearch(
      params.searchTerms!,
      params.maxItems || 20,
      params.sort,
      params.tweetLanguage,
      params.credentials
    );

    return {
      operation: 'search',
      tweets: result.tweets,
      totalTweets: result.totalTweets,
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Handle scrapeUrl operation
   */
  private async handleScrapeUrl(
    params: TwitterToolParams
  ): Promise<TwitterToolResult> {
    // Use Apify service to scrape URLs
    const result = await this.scrapeWithApifyUrls(
      params.startUrls!,
      params.maxItems || 20,
      params.tweetLanguage,
      params.credentials
    );

    return {
      operation: 'scrapeUrl',
      tweets: result.tweets,
      totalTweets: result.totalTweets,
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Scrape profiles using Apify service
   * This is the current implementation - future versions could add other services
   */
  private async scrapeWithApifyProfiles(
    handles: string[],
    maxItems: number,
    tweetLanguage?: string,
    credentials?: Record<string, string>
  ): Promise<{
    tweets: z.infer<typeof TwitterTweetSchema>[];
    totalTweets: number;
    success: boolean;
    error: string;
  }> {
    const input: Record<string, unknown> = {
      twitterHandles: handles,
      maxItems,
    };

    if (tweetLanguage) {
      input.tweetLanguage = tweetLanguage;
    }

    const tweetProfileScraper = new ApifyBubble<'apidojo/tweet-scraper'>(
      {
        actorId: 'apidojo/tweet-scraper',
        input,
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        limit: maxItems,
        credentials,
      },
      this.context,
      'tweetProfileScraper'
    );

    const apifyResult = await tweetProfileScraper.action();

    if (!apifyResult.data.success) {
      return {
        tweets: [],
        totalTweets: 0,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape Twitter profiles. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];
    const tweets = this.transformTweets(items);

    return {
      tweets,
      totalTweets: tweets.length,
      success: true,
      error: '',
    };
  }

  /**
   * Search tweets using Apify service
   * This is the current implementation - future versions could add other services
   */
  private async scrapeWithApifySearch(
    searchTerms: string[],
    maxItems: number,
    sort?: 'Top' | 'Latest',
    tweetLanguage?: string,
    credentials?: Record<string, string>
  ): Promise<{
    tweets: z.infer<typeof TwitterTweetSchema>[];
    totalTweets: number;
    success: boolean;
    error: string;
  }> {
    const input: Record<string, unknown> = {
      searchTerms,
      maxItems,
    };

    if (sort) {
      input.sort = sort;
    }
    if (tweetLanguage) {
      input.tweetLanguage = tweetLanguage;
    }

    const tweetSearcher = new ApifyBubble<'apidojo/tweet-scraper'>(
      {
        actorId: 'apidojo/tweet-scraper',
        input,
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        limit: maxItems,
        credentials,
      },
      this.context,
      'tweetSearcher'
    );

    const apifyResult = await tweetSearcher.action();

    if (!apifyResult.data.success) {
      return {
        tweets: [],
        totalTweets: 0,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to search Twitter. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];
    const tweets = this.transformTweets(items);

    return {
      tweets,
      totalTweets: tweets.length,
      success: true,
      error: '',
    };
  }

  /**
   * Scrape URLs using Apify service
   * This is the current implementation - future versions could add other services
   */
  private async scrapeWithApifyUrls(
    urls: string[],
    maxItems: number,
    tweetLanguage?: string,
    credentials?: Record<string, string>
  ): Promise<{
    tweets: z.infer<typeof TwitterTweetSchema>[];
    totalTweets: number;
    success: boolean;
    error: string;
  }> {
    const input: Record<string, unknown> = {
      startUrls: urls,
      maxItems,
    };

    if (tweetLanguage) {
      input.tweetLanguage = tweetLanguage;
    }

    const tweetUrlScraper = new ApifyBubble<'apidojo/tweet-scraper'>(
      {
        actorId: 'apidojo/tweet-scraper',
        input,
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        limit: maxItems,
        credentials,
      },
      this.context,
      'tweetUrlScraper'
    );

    const apifyResult = await tweetUrlScraper.action();

    if (!apifyResult.data.success) {
      return {
        tweets: [],
        totalTweets: 0,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape Twitter URLs. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];
    const tweets = this.transformTweets(items);

    return {
      tweets,
      totalTweets: tweets.length,
      success: true,
      error: '',
    };
  }

  /**
   * Normalize Twitter handles (remove @ if present)
   */
  private normalizeHandles(handles: string[]): string[] {
    return handles.map((handle) => {
      // Remove @ if present
      return handle.startsWith('@') ? handle.slice(1) : handle;
    });
  }

  private transformTweets(
    items: ActorOutput<'apidojo/tweet-scraper'>[]
  ): z.infer<typeof TwitterTweetSchema>[] {
    return items.map((item: ActorOutput<'apidojo/tweet-scraper'>) => ({
      id: item.id || null,
      url: item.url || null,
      text: item.text || null,
      author: item.author
        ? {
            id: item.author.id || null,
            name: item.author.name || null,
            userName: item.author.userName || null,
            description: item.author.description || null,
            isVerified: item.author.isVerified || null,
            isBlueVerified: item.author.isBlueVerified || null,
            profilePicture: item.author.profilePicture || null,
            followers: item.author.followers || null,
            following: item.author.following || null,
            tweetsCount: item.author.tweetsCount || null,
            url: item.author.url || null,
            createdAt: item.author.createdAt || null,
          }
        : null,
      createdAt: item.createdAt || null,
      stats: {
        retweetCount: item.retweetCount || null,
        replyCount: item.replyCount || null,
        likeCount: item.likeCount || null,
        quoteCount: item.quoteCount || null,
        viewCount: item.viewCount || null,
        bookmarkCount: item.bookmarkCount || null,
      },
      lang: item.lang || null,
      media: item.media
        ? item.media.map((m) => {
            if (typeof m === 'string') {
              return {
                type: null,
                url: m,
                width: null,
                height: null,
                duration: null,
              };
            }
            return {
              type: m.type || null,
              url: m.url || null,
              width: m.width || null,
              height: m.height || null,
              duration: m.duration || null,
            };
          })
        : null,
      entities: item.entities
        ? {
            hashtags: item.entities.hashtags
              ? item.entities.hashtags.map((h) => h.text || '').filter((t) => t)
              : null,
            urls: item.entities.urls
              ? item.entities.urls.map((u) => u.url || '').filter((u) => u)
              : null,
            mentions: item.entities.userMentions
              ? item.entities.userMentions
                  .map((m) => m.screenName || '')
                  .filter((m) => m)
              : null,
          }
        : null,
      isRetweet: item.isRetweet || null,
      isQuote: item.isQuote || null,
      isReply: item.isReply || null,
    }));
  }
}
