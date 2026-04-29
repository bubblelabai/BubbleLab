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

const InstagramReelSchema = z.object({
  url: z.string().nullable().describe('Reel URL'),
  shortCode: z.string().nullable().describe('Instagram short code'),
  caption: z.string().nullable().describe('Reel caption'),
  ownerUsername: z.string().nullable().describe('Reel owner username'),
  ownerFullName: z.string().nullable().describe('Reel owner full name'),
  timestamp: z.string().nullable().describe('Reel timestamp (ISO format)'),
  videoUrl: z.string().nullable().describe('CDN video URL'),
  downloadedVideo: z
    .string()
    .nullable()
    .describe(
      'Direct MP4 download URL — only populated when includeDownloadedVideo=true'
    ),
  videoDuration: z.number().nullable().describe('Reel duration in seconds'),
  videoViewCount: z.number().nullable().describe('Video view count'),
  videoPlayCount: z.number().nullable().describe('Video play count'),
  likesCount: z.number().nullable().describe('Number of likes'),
  commentsCount: z.number().nullable().describe('Number of comments'),
  sharesCount: z
    .number()
    .nullable()
    .describe('Number of shares — only populated when includeSharesCount=true'),
  hashtags: z.array(z.string()).nullable().describe('Hashtags in the reel'),
  mentions: z
    .array(z.string())
    .nullable()
    .describe('User mentions in the reel'),
  transcript: z
    .string()
    .nullable()
    .describe(
      'Auto-generated speech transcript — only populated when includeTranscript=true'
    ),
  musicArtist: z.string().nullable().describe('Music artist name'),
  musicTitle: z.string().nullable().describe('Music/song title'),
  displayUrl: z.string().nullable().describe('Display thumbnail URL'),
});

// Gemini-compatible single object schema with optional fields
const InstagramToolParamsSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'scrapeHashtag', 'scrapeReels'])
    .describe(
      'Operation to perform: scrapeProfile for user profiles, scrapeHashtag for hashtag posts, scrapeReels for reels (with optional transcript)'
    ),

  // Profile scraping fields (optional)
  profiles: z
    .array(z.string())
    .optional()
    .describe(
      'Instagram usernames or profile URLs to scrape (for scrapeProfile operation). Examples: ["@username", "https://www.instagram.com/username/"]'
    ),

  // Hashtag scraping fields (optional)
  hashtags: z
    .array(z.string())
    .optional()
    .describe(
      'Hashtags to scrape (for scrapeHashtag operation). Examples: ["ai", "tech"] or ["https://www.instagram.com/explore/tags/ai"]'
    ),

  // Reel scraping fields (optional)
  targets: z
    .array(z.string())
    .optional()
    .describe(
      'Instagram usernames, profile URLs, profile IDs, or direct reel URLs (for scrapeReels operation). You can mix forms in one array — e.g., ["ryanbailey.cb", "https://www.instagram.com/p/DXIlvPbj2PY/"] pulls reels from a profile AND scrapes a specific reel in one call. Other valid examples: ["ryanbailey.cb"], ["https://www.instagram.com/ryanbailey.cb/"], ["https://www.instagram.com/p/DXIlvPbj2PY/"]'
    ),
  includeTranscript: z
    .boolean()
    .optional()
    .describe(
      'For scrapeReels: extract auto-generated speech transcripts of each reel (paid add-on)'
    ),
  includeSharesCount: z
    .boolean()
    .optional()
    .describe(
      'For scrapeReels: extract number of shares for each reel (paid add-on)'
    ),
  includeDownloadedVideo: z
    .boolean()
    .optional()
    .describe(
      'For scrapeReels: include a direct MP4 download URL (a string URL — NOT video bytes — populated in the `downloadedVideo` field of each reel) for each reel. Paid add-on.'
    ),
  skipPinnedPosts: z
    .boolean()
    .optional()
    .describe('For scrapeReels: exclude pinned reels from results'),
  onlyPostsNewerThan: z
    .string()
    .optional()
    .describe(
      'For scrapeReels: only return reels posted on or after this date. Accepts YYYY-MM-DD, ISO timestamp, or relative like "1 day" / "2 weeks"'
    ),
  timeoutSecs: z
    .number()
    .min(60)
    .max(1800)
    .optional()
    .describe(
      'For scrapeReels: max seconds to wait for the Apify actor (default 600). Bump if you enable includeTranscript on >2 reels — transcript generation adds ~1-2 min per reel.'
    ),

  // Common fields
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20)
    .optional()
    .describe(
      'Maximum number of items to fetch (default: 20 for profiles/reels, 50 for hashtags)'
    ),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Gemini-compatible single result schema
const InstagramToolResultSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'scrapeHashtag', 'scrapeReels'])
    .describe('Operation that was performed'),

  // Posts data (only for scrapeProfile / scrapeHashtag)
  posts: z
    .array(InstagramPostSchema)
    .optional()
    .describe(
      'Array of Instagram posts scraped (only for scrapeProfile / scrapeHashtag operations — for scrapeReels see the `reels` field)'
    ),

  // Reels data (only for scrapeReels operation)
  reels: z
    .array(InstagramReelSchema)
    .optional()
    .describe(
      'Reels with reel-specific fields like transcript, video URL, share count (only for scrapeReels operation)'
    ),

  // Profile data (only for scrapeProfile operation)
  profiles: z
    .array(InstagramProfileSchema)
    .optional()
    .describe(
      'Profile information for each scraped profile (only for scrapeProfile operation)'
    ),

  // Hashtag data (only for scrapeHashtag operation)
  scrapedHashtags: z
    .array(z.string())
    .optional()
    .describe(
      'List of hashtags that were scraped (only for scrapeHashtag operation)'
    ),

  // Profile data (only for scrapeProfile operation)
  scrapedProfiles: z
    .array(z.string())
    .optional()
    .describe(
      'List of profile usernames that were scraped (only for scrapeProfile operation)'
    ),

  // Target data (only for scrapeReels operation)
  scrapedTargets: z
    .array(z.string())
    .optional()
    .describe(
      'List of inputs that were scraped (only for scrapeReels operation)'
    ),

  // Common fields
  totalPosts: z.number().describe('Total number of posts/reels scraped'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Type definitions
type InstagramToolParams = z.output<typeof InstagramToolParamsSchema>;
type InstagramToolResult = z.output<typeof InstagramToolResultSchema>;
type InstagramToolParamsInput = z.input<typeof InstagramToolParamsSchema>;
export type InstagramPost = z.output<typeof InstagramPostSchema>;
export type InstagramProfile = z.output<typeof InstagramProfileSchema>;
export type InstagramReel = z.output<typeof InstagramReelSchema>;

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
export class InstagramTool extends ToolBubble<
  InstagramToolParams,
  InstagramToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'instagram-tool';
  static readonly schema = InstagramToolParamsSchema;
  static readonly resultSchema = InstagramToolResultSchema;
  static readonly shortDescription =
    'Scrape Instagram profiles and posts with a simple, unified interface. Works with individual user profiles and hashtags.';
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

    3. **scrapeReels**: Scrape reels from a profile or directly from reel URLs
       - Get reels with video URLs, view/play counts, hashtags, music info
       - Optionally extract auto-generated speech transcripts (paid add-on)
       - Optionally extract share counts and direct MP4 download URLs (paid add-ons)
       - Filter by date with onlyPostsNewerThan, skip pinned reels with skipPinnedPosts
       - **Latency note**: transcript generation adds ~1-2 min per reel. Default timeout is 10 min (600s); for >5 reels with includeTranscript, bump via the timeoutSecs param.
    
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
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<InstagramToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'Instagram scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;

      // Validate required fields based on operation
      if (
        operation === 'scrapeProfile' &&
        (!this.params.profiles || this.params.profiles.length === 0)
      ) {
        return this.createErrorResult(
          'Profiles array is required for scrapeProfile operation'
        );
      }

      if (
        operation === 'scrapeHashtag' &&
        (!this.params.hashtags || this.params.hashtags.length === 0)
      ) {
        return this.createErrorResult(
          'Hashtags array is required for scrapeHashtag operation'
        );
      }

      if (
        operation === 'scrapeReels' &&
        (!this.params.targets || this.params.targets.length === 0)
      ) {
        if (this.params.profiles && this.params.profiles.length > 0) {
          return this.createErrorResult(
            'scrapeReels uses the `targets` field, not `profiles`. Move your input to `targets` — it accepts usernames, profile URLs, profile IDs, or direct reel URLs.'
          );
        }
        return this.createErrorResult(
          'Targets array is required for scrapeReels operation. Pass usernames, profile URLs, or direct reel URLs in the `targets` field.'
        );
      }

      const result = await (async (): Promise<InstagramToolResult> => {
        switch (operation) {
          case 'scrapeProfile':
            return await this.handleScrapeProfile(this.params);
          case 'scrapeHashtag':
            return await this.handleScrapeHashtag(this.params);
          case 'scrapeReels':
            return await this.handleScrapeReels(this.params);
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
  private createErrorResult(errorMessage: string): InstagramToolResult {
    const { operation } = this.params;

    return {
      operation: operation || 'scrapeProfile',
      posts: operation === 'scrapeReels' ? undefined : [],
      reels: operation === 'scrapeReels' ? [] : undefined,
      profiles: operation === 'scrapeProfile' ? [] : undefined,
      scrapedProfiles: operation === 'scrapeProfile' ? [] : undefined,
      scrapedHashtags: operation === 'scrapeHashtag' ? [] : undefined,
      scrapedTargets: operation === 'scrapeReels' ? [] : undefined,
      totalPosts: 0,
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Handle scrapeProfile operation
   */
  private async handleScrapeProfile(
    params: InstagramToolParams
  ): Promise<InstagramToolResult> {
    // Normalize profile inputs to URLs
    const instagramUrls = this.normalizeProfiles(params.profiles!);

    // Use Apify service to scrape profiles
    const result = await this.scrapeWithApifyProfiles(
      instagramUrls,
      params.limit || 20
    );

    return {
      operation: 'scrapeProfile',
      posts: result.posts,
      profiles: result.profiles,
      scrapedProfiles: result.scrapedProfiles,
      totalPosts: result.totalPosts,
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Handle scrapeHashtag operation
   */
  private async handleScrapeHashtag(
    params: InstagramToolParams
  ): Promise<InstagramToolResult> {
    // Use Apify service to scrape hashtags
    const result = await this.scrapeWithApifyHashtags(
      params.hashtags!,
      params.limit || 50,
      params.credentials
    );

    return {
      operation: 'scrapeHashtag',
      posts: result.posts,
      scrapedHashtags: result.scrapedHashtags,
      totalPosts: result.totalPosts,
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Handle scrapeReels operation
   */
  private async handleScrapeReels(
    params: InstagramToolParams
  ): Promise<InstagramToolResult> {
    const targets = params.targets!;

    const scrape_reels_apify = new ApifyBubble<'apify/instagram-reel-scraper'>(
      {
        actorId: 'apify/instagram-reel-scraper',
        input: {
          username: targets,
          resultsLimit: params.limit || 20,
          skipPinnedPosts: params.skipPinnedPosts ?? false,
          includeSharesCount: params.includeSharesCount ?? false,
          includeTranscript: params.includeTranscript ?? false,
          includeDownloadedVideo: params.includeDownloadedVideo ?? false,
          ...(params.onlyPostsNewerThan
            ? { onlyPostsNewerThan: params.onlyPostsNewerThan }
            : {}),
        },
        waitForFinish: true,
        timeout: (params.timeoutSecs ?? 600) * 1000,
        credentials: params.credentials,
        limit: params.limit || 20,
      },
      this.context,
      'scrape_reels_apify'
    );

    const apifyResult = await scrape_reels_apify.action();

    if (!apifyResult.data.success) {
      return {
        operation: 'scrapeReels',
        reels: [],
        scrapedTargets: targets,
        totalPosts: 0,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape Instagram reels. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];
    const reels = this.extractReels(items);

    return {
      operation: 'scrapeReels',
      reels,
      scrapedTargets: targets,
      totalPosts: reels.length,
      success: true,
      error: '',
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
  ): Promise<{
    posts: InstagramPost[];
    totalPosts: number;
    scrapedHashtags: string[];
    success: boolean;
    error: string;
  }> {
    // Normalize hashtags for Apify (remove # symbol and clean format)
    const normalizedHashtags = this.normalizeHashtags(hashtags);

    const scrape_hashtag_apify =
      new ApifyBubble<'apify/instagram-hashtag-scraper'>(
        {
          actorId: 'apify/instagram-hashtag-scraper',
          input: {
            hashtags: normalizedHashtags,
            resultsLimit: limit,
          },
          waitForFinish: true,
          timeout: 180000, // 3 minutes
          credentials,
          limit: limit,
        },
        this.context,
        'scrape_hashtag_apify'
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
   * Normalize hashtags for Apify actor
   * Removes # symbol and cleans format to match Apify requirements
   */
  private normalizeHashtags(hashtags: string[]): string[] {
    return hashtags.map((hashtag) => {
      // Remove # symbol if present
      let cleanHashtag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;

      // Remove any URL parts if it's a full Instagram hashtag URL
      if (cleanHashtag.includes('instagram.com/explore/tags/')) {
        cleanHashtag = cleanHashtag.split('instagram.com/explore/tags/')[1];
        // Remove any trailing slashes or query parameters
        cleanHashtag = cleanHashtag.split('/')[0].split('?')[0];
      }

      // Clean any remaining special characters that Apify doesn't like
      // Keep only alphanumeric characters and underscores
      cleanHashtag = cleanHashtag.replace(/[^a-zA-Z0-9_]/g, '');

      return cleanHashtag;
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
  ): Promise<{
    posts: InstagramPost[];
    profiles: InstagramProfile[];
    totalPosts: number;
    scrapedProfiles: string[];
    success: boolean;
    error: string;
  }> {
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
        limit: limit,
        timeout: 180000, // 3 minutes
        credentials: this.params.credentials,
      },
      this.context,
      'scrape_profile_apify'
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
   * Extract reels from reel scraper results
   * Reel scraper returns reels directly (not nested under profiles)
   */
  private extractReels(
    items: ActorOutput<'apify/instagram-reel-scraper'>[]
  ): InstagramReel[] {
    const reels: InstagramReel[] = [];

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      const anyItem = item as Record<string, unknown>;
      const music = (anyItem.musicInfo ?? null) as Record<
        string,
        unknown
      > | null;

      reels.push({
        url: (anyItem.url as string) || null,
        shortCode: (anyItem.shortCode as string) || null,
        caption: (anyItem.caption as string) || null,
        ownerUsername: (anyItem.ownerUsername as string) || null,
        ownerFullName: (anyItem.ownerFullName as string) || null,
        timestamp: (anyItem.timestamp as string) || null,
        videoUrl: (anyItem.videoUrl as string) || null,
        downloadedVideo: (anyItem.downloadedVideo as string) || null,
        videoDuration: (anyItem.videoDuration as number) ?? null,
        videoViewCount: (anyItem.videoViewCount as number) ?? null,
        videoPlayCount: (anyItem.videoPlayCount as number) ?? null,
        likesCount: (anyItem.likesCount as number) ?? null,
        commentsCount: (anyItem.commentsCount as number) ?? null,
        sharesCount: (anyItem.sharesCount as number) ?? null,
        hashtags: (anyItem.hashtags as string[]) || null,
        mentions: (anyItem.mentions as string[]) || null,
        transcript: (anyItem.transcript as string) || null,
        musicArtist: (music?.artist_name as string) || null,
        musicTitle: (music?.song_name as string) || null,
        displayUrl: (anyItem.displayUrl as string) || null,
      });
    }

    return reels;
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
