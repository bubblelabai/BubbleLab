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
    .describe('Operation to perform'),

  usernames: z
    .array(z.string())
    .optional()
    .describe('Twitter usernames to scrape (without @) (for scrapeProfile)'),

  queries: z
    .array(z.string())
    .optional()
    .describe('Search queries (for search)'),

  urls: z
    .array(z.string())
    .optional()
    .describe('Direct URLs to scrape (for scrapeUrl)'),

  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20)
    .optional()
    .describe('Maximum number of tweets to scrape per query'),

  // Filters
  onlyVerified: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter: Verified users only'),
  onlyBlue: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter: Blue verified users only'),
  onlyImage: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter: Tweets with images only'),
  onlyVideo: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter: Tweets with videos only'),

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

export class TwitterTool extends ToolBubble<
  TwitterToolParams,
  TwitterToolResult
> {
  static readonly bubbleName: BubbleName = 'twitter-tool';
  static readonly schema = TwitterToolParamsSchema;
  static readonly resultSchema = TwitterToolResultSchema;
  static readonly shortDescription =
    'Scrape Twitter/X profiles, tweets, and search results.';
  static readonly longDescription = `
    Universal Twitter/X scraping tool.
    
    Operations:
    - scrapeProfile: Get tweets from user profiles
    - search: Search for tweets by keyword or hashtag
    - scrapeUrl: Scrape specific Tweet URLs
    
    Uses Apify's apidojo/twitter-user-scraper.
  `;
  static readonly alias = 'twitter';
  static readonly type = 'tool';

  constructor(
    params: TwitterToolParamsInput = {
      operation: 'scrapeProfile',
      usernames: ['elonmusk'],
      limit: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<TwitterToolResult> {
    const credentials = this.params.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'Twitter scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;
      const result = await this.runScraper();

      return {
        operation,
        tweets: result.tweets,
        totalTweets: result.tweets.length,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private createErrorResult(errorMessage: string): TwitterToolResult {
    return {
      operation: this.params.operation,
      tweets: [],
      totalTweets: 0,
      success: false,
      error: errorMessage,
    };
  }

  private async runScraper(): Promise<{
    tweets: z.infer<typeof TwitterTweetSchema>[];
    success: boolean;
    error: string;
  }> {
    const { operation, limit } = this.params;

    let input: any = {
      tweetsDesired: limit,
      onlyVerifiedUsers: this.params.onlyVerified,
      onlyTwitterBlue: this.params.onlyBlue,
      onlyImage: this.params.onlyImage,
      onlyVideo: this.params.onlyVideo,
    };

    if (operation === 'scrapeProfile') {
      if (!this.params.usernames?.length) {
        return { tweets: [], success: false, error: 'Usernames required' };
      }
      input.twitterHandles = this.params.usernames;
    } else if (operation === 'search') {
      if (!this.params.queries?.length) {
        return { tweets: [], success: false, error: 'Queries required' };
      }
      input.searchTerms = this.params.queries;
    } else if (operation === 'scrapeUrl') {
      if (!this.params.urls?.length) {
        return { tweets: [], success: false, error: 'URLs required' };
      }
      input.urls = this.params.urls;
    }

    const scraper = new ApifyBubble<'apidojo/twitter-user-scraper'>(
      {
        actorId: 'apidojo/twitter-user-scraper',
        input,
        waitForFinish: true,
        timeout: 180000,
        credentials: this.params.credentials,
      },
      this.context,
      'twitterScraper'
    );

    const apifyResult = await scraper.action();

    if (!apifyResult.data.success) {
      return {
        tweets: [],
        success: false,
        error: apifyResult.data.error || 'Failed to scrape Twitter',
      };
    }

    const items = apifyResult.data.items || [];
    const tweets = this.transformTweets(items);

    return {
      tweets,
      success: true,
      error: '',
    };
  }

  private transformTweets(
    items: ActorOutput<'apidojo/twitter-user-scraper'>[]
  ): z.infer<typeof TwitterTweetSchema>[] {
    return items.map((item) => ({
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
        ? item.media.map((m) => ({
            type: m.type || null,
            url: m.url || null,
            width: m.width || null,
            height: m.height || null,
            duration: m.duration || null,
          }))
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
