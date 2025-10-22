import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput } from '../service-bubble/apify/types.js';

// Unified Instagram data types (service-agnostic)
const InstagramPostSchema = z.object({
  url: z.string().nullable().describe('Post URL'),
  caption: z.string().nullable().describe('Post caption text'),
  likesCount: z.number().nullable().describe('Number of likes'),
  commentsCount: z.number().nullable().describe('Number of comments'),
  ownerUsername: z.string().nullable().describe('Post owner username'),
  timestamp: z.string().nullable().describe('Post timestamp (ISO format)'),
  type: z
    .enum(['image', 'video', 'carousel'])
    .nullable()
    .describe('Post media type'),
  displayUrl: z.string().nullable().describe('Main display image URL'),
  hashtags: z.array(z.string()).nullable().describe('Hashtags in the post'),
});

const InstagramProfileSchema = z.object({
  username: z.string().describe('Instagram username'),
  fullName: z.string().nullable().describe('Full name'),
  bio: z.string().nullable().describe('Profile bio'),
  followersCount: z.number().nullable().describe('Number of followers'),
  followingCount: z.number().nullable().describe('Number of following'),
  postsCount: z.number().nullable().describe('Total posts'),
  isVerified: z.boolean().nullable().describe('Verification status'),
  profilePicUrl: z.string().nullable().describe('Profile picture URL'),
});

// Discriminated union for tool parameters (like resend.ts)
const InstagramToolParamsSchema = z.discriminatedUnion('operation', [
  // Scrape profile operation
  z.object({
    operation: z
      .literal('scrapeProfile')
      .describe('Scrape Instagram profiles and their posts'),
    profiles: z
      .array(z.string())
      .min(1, 'At least one Instagram username or URL is required')
      .describe(
        'Instagram usernames or profile URLs to scrape. Examples: ["@username", "https://www.instagram.com/username/"]'
      ),
    limit: z
      .number()
      .min(1)
      .max(200)
      .default(20)
      .optional()
      .describe('Maximum number of posts to fetch per profile (default: 20)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Required credentials (auto-injected)'),
  }),

  // Scrape hashtag operation
  z.object({
    operation: z
      .literal('scrapeHashtag')
      .describe('Scrape Instagram posts by hashtag'),
    hashtags: z
      .array(z.string())
      .min(1, 'At least one hashtag is required')
      .describe(
        'Hashtags to scrape. Examples: ["ai", "tech"] or ["https://www.instagram.com/explore/tags/ai"]'
      ),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .default(50)
      .optional()
      .describe('Maximum number of posts to fetch per hashtag (default: 50)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Required credentials (auto-injected)'),
  }),
]);

// Discriminated union for result schemas
const InstagramToolResultSchema = z.discriminatedUnion('operation', [
  // Scrape profile result
  z.object({
    operation: z
      .literal('scrapeProfile')
      .describe('Scrape Instagram profiles and their posts'),
    posts: z
      .array(InstagramPostSchema)
      .describe('Array of Instagram posts from all profiles'),
    profiles: z
      .array(InstagramProfileSchema)
      .describe('Profile information for each scraped profile'),
    totalPosts: z.number().describe('Total number of posts scraped'),
    scrapedProfiles: z
      .array(z.string())
      .describe('List of profiles that were scraped'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Scrape hashtag result
  z.object({
    operation: z
      .literal('scrapeHashtag')
      .describe('Scrape Instagram posts by hashtag'),
    posts: z
      .array(InstagramPostSchema)
      .describe('Array of Instagram posts from hashtag search'),
    totalPosts: z.number().describe('Total number of posts scraped'),
    scrapedHashtags: z
      .array(z.string())
      .describe('List of hashtags that were scraped'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// Type definitions
type InstagramToolParams = z.output<typeof InstagramToolParamsSchema>;
type InstagramToolResult = z.output<typeof InstagramToolResultSchema>;
type InstagramToolParamsInput = z.input<typeof InstagramToolParamsSchema>;
export type InstagramPost = z.output<typeof InstagramPostSchema>;
export type InstagramProfile = z.output<typeof InstagramProfileSchema>;

// Helper type to get the result type for a specific operation
export type InstagramOperationResult<
  T extends InstagramToolParams['operation'],
> = Extract<InstagramToolResult, { operation: T }>;

/**
 * Generic Instagram scraping tool with unified interface
 *
 * This tool abstracts away the underlying scraping service (currently Apify)
 * and provides a simple, opinionated interface for Instagram data extraction.
 *
 * Supports two operations:
 * - scrapeProfile: Scrape user profiles and their posts
 * - scrapeHashtag: Scrape posts by hashtag
 *
 * Future versions can add support for other services (BrightData, custom scrapers)
 * while maintaining the same interface.
 */
export class InstagramTool<
  T extends InstagramToolParams = InstagramToolParams,
> extends ToolBubble<
  T,
  Extract<InstagramToolResult, { operation: T['operation'] }>
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'instagram-tool';
  static readonly schema = InstagramToolParamsSchema;
  static readonly resultSchema = InstagramToolResultSchema;
  static readonly shortDescription =
    'Scrape Instagram profiles and posts with a simple, unified interface';
  static readonly longDescription = `
    Universal Instagram scraping tool that provides a simple, opinionated interface for extracting Instagram data.
    
    **OPERATIONS:**
    1. **scrapeProfile**: Scrape user profiles and their posts
       - Get profile information (bio, followers, verified status)
       - Fetch recent posts from specific users
       - Track influencer or brand accounts
    
    2. **scrapeHashtag**: Scrape posts by hashtag
       - Find trending content by hashtag
       - Monitor brand mentions and campaigns
       - Research hashtag performance
    
    **WHEN TO USE THIS TOOL:**
    - **Any Instagram scraping task** - profiles, posts, hashtags, engagement data
    - **Social media research** - influencer analysis, competitor monitoring
    - **Content gathering** - posts, captions, hashtags, engagement metrics
    - **Market research** - brand mentions, user sentiment on Instagram
    - **Trend analysis** - hashtag tracking, viral content discovery
    
    **DO NOT USE research-agent-tool or web-scrape-tool for Instagram** - This tool is specifically optimized for Instagram and provides:
    - Unified data format across all Instagram sources
    - Automatic service selection and optimization
    - Rate limiting and reliability handling
    - Clean, structured data ready for analysis
    
    **Simple Interface:**
    Just specify the operation and provide Instagram usernames/URLs or hashtags to get back clean, structured data.
    The tool automatically handles:
    - URL normalization (accepts usernames, profile URLs, hashtag URLs)
    - Service selection (currently Apify, future: multiple sources)
    - Data transformation to unified format
    - Error handling and retries
    
    **What you get:**
    - Posts with captions, likes, comments, timestamps
    - Profile information (for scrapeProfile operation)
    - Hashtags and engagement metrics
    - Owner information
    
    **Use cases:**
    - Influencer analysis and discovery
    - Brand monitoring and sentiment analysis
    - Competitor research on Instagram
    - Content strategy and trend analysis
    - Market research through Instagram data
    - Campaign performance tracking
    - Hashtag research and optimization
    
    The tool uses best-available services behind the scenes while maintaining a consistent, simple interface.
  `;
  static readonly alias = 'ig';
  static readonly type = 'tool';

  constructor(
    params: InstagramToolParamsInput = {
      operation: 'scrapeProfile',
      profiles: ['@instagram'],
      limit: 20,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<
    Extract<InstagramToolResult, { operation: T['operation'] }>
  > {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'Instagram scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;

      const result = await (async (): Promise<InstagramToolResult> => {
        switch (operation) {
          case 'scrapeProfile':
            return await this.handleScrapeProfile(this.params);
          case 'scrapeHashtag':
            return await this.handleScrapeHashtag(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<
        InstagramToolResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Create an error result based on the operation type
   */
  private createErrorResult(
    errorMessage: string
  ): Extract<InstagramToolResult, { operation: T['operation'] }> {
    const { operation } = this.params;

    if (operation === 'scrapeProfile') {
      return {
        operation: 'scrapeProfile',
        posts: [] as InstagramPost[],
        profiles: [] as InstagramProfile[],
        totalPosts: 0,
        scrapedProfiles: [] as string[],
        success: false,
        error: errorMessage,
      } as Extract<InstagramToolResult, { operation: T['operation'] }>;
    } else {
      return {
        operation: 'scrapeHashtag',
        posts: [] as InstagramPost[],
        totalPosts: 0,
        scrapedHashtags: [] as string[],
        success: false,
        error: errorMessage,
      } as Extract<InstagramToolResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Handle scrapeProfile operation
   */
  private async handleScrapeProfile(
    params: Extract<InstagramToolParams, { operation: 'scrapeProfile' }>
  ): Promise<Extract<InstagramToolResult, { operation: 'scrapeProfile' }>> {
    // Normalize profile inputs to URLs
    const instagramUrls = this.normalizeProfiles(params.profiles);

    // Use Apify service to scrape profiles
    const result = await this.scrapeWithApifyProfiles(
      instagramUrls,
      params.limit || 20
    );

    return {
      operation: 'scrapeProfile',
      ...result,
    };
  }

  /**
   * Handle scrapeHashtag operation
   */
  private async handleScrapeHashtag(
    params: Extract<InstagramToolParams, { operation: 'scrapeHashtag' }>
  ): Promise<Extract<InstagramToolResult, { operation: 'scrapeHashtag' }>> {
    // Use Apify service to scrape hashtags
    const result = await this.scrapeWithApifyHashtags(
      params.hashtags,
      params.limit || 50,
      params.credentials
    );

    return {
      operation: 'scrapeHashtag',
      ...result,
    };
  }

  /**
   * Scrape hashtags using Apify service
   * This is the current implementation - future versions could add other services
   */
  private async scrapeWithApifyHashtags(
    hashtags: string[],
    limit: number,
    credentials?: Record<string, string>
  ): Promise<
    Omit<
      Extract<InstagramToolResult, { operation: 'scrapeHashtag' }>,
      'operation'
    >
  > {
    const scrape_hashtag_apify =
      new ApifyBubble<'apify/instagram-hashtag-scraper'>(
        {
          actorId: 'apify/instagram-hashtag-scraper',
          input: {
            hashtags,
            resultsLimit: limit,
          },
          waitForFinish: true,
          timeout: 180000, // 3 minutes
          credentials,
        },
        this.context
      );

    const apifyResult = await scrape_hashtag_apify.action();

    if (!apifyResult.data.success) {
      return {
        posts: [] as InstagramPost[],
        totalPosts: 0,
        scrapedHashtags: hashtags,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape Instagram hashtags. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];

    // Transform hashtag scraper results to unified post format
    const posts = this.extractHashtagPosts(items);

    return {
      posts,
      totalPosts: posts.length,
      scrapedHashtags: hashtags,
      success: true,
      error: '',
    };
  }

  /**
   * Normalize various profile inputs to Instagram URLs
   * Accepts: @username, username, https://instagram.com/username/
   */
  private normalizeProfiles(profiles: string[]): string[] {
    return profiles.map((profile) => {
      // Already a full URL
      if (profile.startsWith('https://www.instagram.com/')) {
        return profile;
      }

      // Remove @ if present
      const cleanUsername = profile.startsWith('@')
        ? profile.slice(1)
        : profile;

      // Convert to profile URL
      return `https://www.instagram.com/${cleanUsername}/`;
    });
  }

  /**
   * Scrape profiles using Apify service
   * This is the current implementation - future versions could add other services
   * Always fetches both profile details and posts for maximum flexibility
   */
  private async scrapeWithApifyProfiles(
    urls: string[],
    limit: number
  ): Promise<
    Omit<
      Extract<InstagramToolResult, { operation: 'scrapeProfile' }>,
      'operation'
    >
  > {
    // Always use 'details' to get both profile information AND posts
    const scrape_profile_apify = new ApifyBubble<'apify/instagram-scraper'>(
      {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: urls,
          resultsType: 'details', // Always fetch full details (profile + posts)
          resultsLimit: limit,
        },
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        credentials: this.params.credentials,
      },
      this.context
    );

    const apifyResult = await scrape_profile_apify.action();

    if (!apifyResult.data.success) {
      return {
        posts: [],
        profiles: [],
        totalPosts: 0,
        scrapedProfiles: urls.map(this.extractUsername),
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape Instagram. Please try again.',
      };
    }

    // Now items is automatically typed as InstagramPost[] - no casting needed!
    const items = apifyResult.data.items || [];

    // Extract posts from the results
    const posts = this.extractPosts(items);

    // Extract profile information from the results
    const profiles = this.extractProfileInfo(items);

    return {
      posts,
      profiles,
      totalPosts: posts.length,
      scrapedProfiles: urls.map(this.extractUsername),
      success: true,
      error: '',
    };
  }

  /**
   * Extract username from Instagram URL
   */
  private extractUsername(url: string): string {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? match[1] : url;
  }

  /**
   * Normalize post type to standard enum
   */
  private normalizePostType(
    type: string | null | undefined
  ): 'image' | 'video' | 'carousel' | null {
    if (!type) return null;

    const normalized = type.toLowerCase();
    if (normalized === 'image' || normalized === 'photo') return 'image';
    if (normalized === 'video') return 'video';
    if (normalized === 'carousel' || normalized === 'sidecar')
      return 'carousel';

    return null;
  }

  /**
   * Extract posts from Apify results
   * Handles both 'details' and 'posts' resultsType formats
   */
  private extractPosts(
    items: ActorOutput<'apify/instagram-scraper'>[]
  ): InstagramPost[] {
    const posts: InstagramPost[] = [];

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const anyItem = item;

      // Check if this item has posts nested (details format)
      if (anyItem.latestPosts && Array.isArray(anyItem.latestPosts)) {
        // Format from 'details' resultsType - posts are nested
        for (const post of anyItem.latestPosts) {
          posts.push({
            url: post.url || null,
            caption: post.caption || null,
            likesCount: post.likesCount || null,
            commentsCount: post.commentsCount || null,
            ownerUsername: anyItem.username || post.ownerUsername || null,
            timestamp: post.timestamp || null,
            type: this.normalizePostType(post.type),
            displayUrl: post.displayUrl || null,
            hashtags: post.hashtags || null,
          });
        }
      }
    }

    return posts;
  }

  /**
   * Extract profile information from Apify results
   * Handles the 'details' resultsType format
   */
  private extractProfileInfo(
    items: ActorOutput<'apify/instagram-scraper'>[]
  ): InstagramProfile[] {
    const profiles: InstagramProfile[] = [];

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const anyItem = item;

      // Check if this item has profile-level information (details format)
      if (anyItem.username) {
        profiles.push({
          username: anyItem.username || '',
          fullName: anyItem.fullName || '',
          bio: anyItem.biography || '',
          followersCount: anyItem.followersCount || 0,
          followingCount: anyItem.followsCount || 0,
          postsCount: anyItem.postsCount || null,
          isVerified: anyItem.verified || false,
          profilePicUrl: anyItem.profilePicUrl || '',
        });
      }
    }

    return profiles;
  }

  /**
   * Extract posts from hashtag scraper results
   * Hashtag scraper returns posts directly (not nested)
   */
  private extractHashtagPosts(
    items: ActorOutput<'apify/instagram-hashtag-scraper'>[]
  ): InstagramPost[] {
    const posts: InstagramPost[] = [];

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const anyItem = item;

      // Hashtag scraper returns posts directly at the top level
      posts.push({
        url: anyItem.url || null,
        caption: anyItem.caption || null,
        likesCount: anyItem.likesCount || null,
        commentsCount: anyItem.commentsCount || null,
        ownerUsername: anyItem.ownerUsername || null,
        timestamp: anyItem.timestamp || null,
        type: this.normalizePostType(anyItem.type),
        displayUrl: anyItem.displayUrl || null,
        hashtags: anyItem.hashtags || null,
      });
    }

    return posts;
  }
}
