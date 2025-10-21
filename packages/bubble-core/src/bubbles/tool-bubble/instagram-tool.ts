import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify.js';

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

// Simple, opinionated tool parameters
const InstagramToolParamsSchema = z.object({
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
  includeProfileInfo: z
    .boolean()
    .default(false)
    .optional()
    .describe('Include profile information (bio, followers, etc.)'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Unified result schema
const InstagramToolResultSchema = z.object({
  posts: z
    .array(InstagramPostSchema)
    .describe('Array of Instagram posts from all profiles'),
  profiles: z
    .array(InstagramProfileSchema)
    .optional()
    .describe('Profile information (if includeProfileInfo is true)'),
  totalPosts: z.number().describe('Total number of posts scraped'),
  scrapedProfiles: z
    .array(z.string())
    .describe('List of profiles that were scraped'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Type definitions
type InstagramToolParams = z.output<typeof InstagramToolParamsSchema>;
type InstagramToolResult = z.output<typeof InstagramToolResultSchema>;
type InstagramToolParamsInput = z.input<typeof InstagramToolParamsSchema>;
export type InstagramPost = z.output<typeof InstagramPostSchema>;
export type InstagramProfile = z.output<typeof InstagramProfileSchema>;

/**
 * Generic Instagram scraping tool with unified interface
 *
 * This tool abstracts away the underlying scraping service (currently Apify)
 * and provides a simple, opinionated interface for Instagram data extraction.
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
    'Scrape Instagram profiles and posts with a simple, unified interface';
  static readonly longDescription = `
    Universal Instagram scraping tool that provides a simple, opinionated interface for extracting Instagram data.
    
    **WHEN TO USE THIS TOOL:**
    - **Any Instagram scraping task** - profiles, posts, engagement data
    - **Social media research** - influencer analysis, competitor monitoring
    - **Content gathering** - posts, captions, hashtags, engagement metrics
    - **Market research** - brand mentions, user sentiment on Instagram
    
    **DO NOT USE research-agent-tool or web-scrape-tool for Instagram** - This tool is specifically optimized for Instagram and provides:
    - Unified data format across all Instagram sources
    - Automatic service selection and optimization
    - Rate limiting and reliability handling
    - Clean, structured data ready for analysis
    
    **Simple Interface:**
    Just provide Instagram usernames or URLs and get back clean, structured data.
    The tool automatically handles:
    - URL normalization (accepts usernames, profile URLs, post URLs)
    - Service selection (currently Apify, future: multiple sources)
    - Data transformation to unified format
    - Error handling and retries
    
    **What you get:**
    - Posts with captions, likes, comments, timestamps
    - Profile information (optional)
    - Hashtags and engagement metrics
    - Owner information
    
    **Use cases:**
    - Influencer analysis and discovery
    - Brand monitoring and sentiment analysis
    - Competitor research on Instagram
    - Content strategy and trend analysis
    - Market research through Instagram data
    - Campaign performance tracking
    
    The tool uses best-available services behind the scenes while maintaining a consistent, simple interface.
  `;
  static readonly alias = 'ig';
  static readonly type = 'tool';

  constructor(
    params: InstagramToolParamsInput = {
      profiles: ['@instagram'],
      limit: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<InstagramToolResult> {
    if (!this.params?.credentials?.[CredentialType.APIFY_CRED]) {
      return {
        posts: [],
        profiles: [],
        totalPosts: 0,
        scrapedProfiles: [],
        success: false,
        error:
          'Instagram scraping requires authentication. Please configure APIFY_CRED.',
      };
    }

    try {
      // Normalize profile inputs to URLs
      const instagramUrls = this.normalizeProfiles(this.params.profiles);

      // Use Apify service (future: could route to different services)
      const result = await this.scrapeWithApify(
        instagramUrls,
        this.params.limit || 20,
        this.params.includeProfileInfo || false
      );

      return result;
    } catch (error) {
      return {
        posts: [],
        profiles: [],
        totalPosts: 0,
        scrapedProfiles: this.params.profiles,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
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
   * Scrape using Apify service
   * This is the current implementation - future versions could add other services
   */
  private async scrapeWithApify(
    urls: string[],
    limit: number,
    includeProfileInfo: boolean
  ): Promise<InstagramToolResult> {
    // Use Apify bubble for scraping
    const apifyBubble = new ApifyBubble(
      {
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: urls,
          resultsType: includeProfileInfo ? 'details' : 'posts',
          resultsLimit: limit,
        },
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        credentials: this.params.credentials,
      },
      this.context
    );

    const apifyResult = await apifyBubble.action();

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

    // Transform Apify data to unified format
    const posts = (apifyResult.data.items || []).map((item) => ({
      url: item.url || null,
      caption: item.caption || null,
      likesCount: item.likesCount || null,
      commentsCount: item.commentsCount || null,
      ownerUsername: item.ownerUsername || null,
      timestamp: item.timestamp || null,
      type: this.normalizePostType(item.type),
      displayUrl: item.displayUrl || null,
      hashtags: item.hashtags || null,
    }));

    // If profile info was requested, extract it
    const profiles = includeProfileInfo
      ? this.extractProfileInfo(apifyResult.data.items || [])
      : undefined;

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
   * Extract profile information from Apify results
   * Future: This could be enhanced with dedicated profile scraping
   */
  private extractProfileInfo(items: unknown[]): InstagramProfile[] {
    // For now, extract basic info from posts
    // Future: Add dedicated profile scraping
    const profileMap = new Map<string, InstagramProfile>();

    for (const item of items) {
      // Type guard to ensure item is an object with ownerUsername
      if (
        typeof item === 'object' &&
        item !== null &&
        'ownerUsername' in item &&
        typeof (item as { ownerUsername: unknown }).ownerUsername === 'string'
      ) {
        const username = (item as { ownerUsername: string }).ownerUsername;
        if (!profileMap.has(username)) {
          profileMap.set(username, {
            username,
            fullName: null,
            bio: null,
            followersCount: null,
            followingCount: null,
            postsCount: null,
            isVerified: null,
            profilePicUrl: null,
          });
        }
      }
    }

    return Array.from(profileMap.values());
  }
}
