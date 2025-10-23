import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';

// Unified LinkedIn data types (service-agnostic)
const LinkedInAuthorSchema = z.object({
  firstName: z.string().nullable().describe('Author first name'),
  lastName: z.string().nullable().describe('Author last name'),
  headline: z.string().nullable().describe('Author headline/title'),
  username: z.string().nullable().describe('Author username'),
  profileUrl: z.string().nullable().describe('Author profile URL'),
  profilePicture: z.string().nullable().describe('Author profile picture URL'),
});

const LinkedInStatsSchema = z.object({
  totalReactions: z.number().nullable().describe('Total number of reactions'),
  like: z.number().nullable().describe('Number of likes'),
  support: z.number().nullable().describe('Number of support reactions'),
  love: z.number().nullable().describe('Number of love reactions'),
  insight: z.number().nullable().describe('Number of insight reactions'),
  celebrate: z.number().nullable().describe('Number of celebrate reactions'),
  comments: z.number().nullable().describe('Number of comments'),
  reposts: z.number().nullable().describe('Number of reposts'),
});

const LinkedInMediaSchema = z.object({
  type: z.string().nullable().describe('Media type (image, video, images)'),
  url: z.string().nullable().describe('Media URL'),
  thumbnail: z.string().nullable().describe('Media thumbnail URL'),
  images: z
    .array(
      z.object({
        url: z.string().nullable(),
        width: z.number().nullable(),
        height: z.number().nullable(),
      })
    )
    .nullable()
    .describe('Array of images for multi-image posts'),
});

const LinkedInPostedAtSchema = z.object({
  date: z.string().nullable().describe('Post date (formatted string)'),
  relative: z
    .string()
    .nullable()
    .describe('Relative time (e.g., "2 days ago")'),
  timestamp: z.number().nullable().describe('Unix timestamp in milliseconds'),
});

const LinkedInPostSchema = z.object({
  urn: z.string().nullable().describe('Post URN'),
  fullUrn: z.string().nullable().describe('Full URN with prefix'),
  postedAt: LinkedInPostedAtSchema.nullable().describe('When post was created'),
  text: z.string().nullable().describe('Post text content'),
  url: z.string().nullable().describe('Post URL'),
  postType: z.string().nullable().describe('Post type (regular, quote, etc)'),
  author: LinkedInAuthorSchema.nullable().describe('Post author information'),
  stats: LinkedInStatsSchema.nullable().describe('Post engagement statistics'),
  media: LinkedInMediaSchema.nullable().describe('Post media content'),
  article: z
    .object({
      url: z.string().nullable(),
      title: z.string().nullable(),
      subtitle: z.string().nullable(),
      thumbnail: z.string().nullable(),
    })
    .nullable()
    .describe('Shared article information'),
  document: z
    .object({
      title: z.string().nullable(),
      pageCount: z.number().nullable(),
      url: z.string().nullable(),
      thumbnail: z.string().nullable(),
    })
    .nullable()
    .describe('Shared document information'),
  resharedPost: z
    .object({
      urn: z.string().nullable(),
      postedAt: LinkedInPostedAtSchema.nullable(),
      text: z.string().nullable(),
      url: z.string().nullable(),
      postType: z.string().nullable(),
      author: LinkedInAuthorSchema.nullable(),
      stats: LinkedInStatsSchema.nullable(),
      media: LinkedInMediaSchema.nullable(),
    })
    .nullable()
    .describe('Original post that was reshared'),
});

// Tool parameters schema - discriminated union for multiple operations
const LinkedInToolParamsSchema = z.discriminatedUnion('operation', [
  // Scrape profile posts operation
  z.object({
    operation: z
      .literal('scrapePosts')
      .describe('Scrape LinkedIn profile posts'),
    username: z
      .string()
      .min(1, 'LinkedIn username is required')
      .describe(
        'LinkedIn username (without @). Examples: "satyanadella", "billgates"'
      ),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(100)
      .optional()
      .describe('Maximum number of posts to fetch (default: 100)'),
    pageNumber: z
      .number()
      .min(1)
      .default(1)
      .optional()
      .describe('Page number for pagination (default: 1)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Required credentials (auto-injected)'),
  }),

  // Search posts by keyword operation
  z.object({
    operation: z
      .literal('searchPosts')
      .describe('Search LinkedIn posts by keyword'),
    keyword: z
      .string()
      .min(1, 'Search keyword is required')
      .describe(
        'Keyword or phrase to search for in LinkedIn posts. Examples: "AI", "hiring", "n8n"'
      ),
    sortBy: z
      .enum(['relevance', 'date_posted'])
      .default('relevance')
      .optional()
      .describe(
        'Sort results by relevance or date posted (default: relevance)'
      ),
    dateFilter: z
      .enum(['', 'past-24h', 'past-week', 'past-month'])
      .default('')
      .optional()
      .describe('Filter posts by date range (default: no filter)'),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(50)
      .optional()
      .describe('Maximum number of posts to fetch (1-50, default: 50)'),
    pageNumber: z
      .number()
      .min(1)
      .default(1)
      .optional()
      .describe('Page number for pagination (default: 1)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Required credentials (auto-injected)'),
  }),
]);

// Tool result schema - discriminated union for multiple operations
const LinkedInToolResultSchema = z.discriminatedUnion('operation', [
  // Scrape profile posts result
  z.object({
    operation: z
      .literal('scrapePosts')
      .describe('Scrape LinkedIn profile posts'),
    posts: z
      .array(LinkedInPostSchema)
      .describe('Array of LinkedIn posts from the profile'),
    totalPosts: z.number().describe('Total number of posts scraped'),
    username: z.string().describe('LinkedIn username that was scraped'),
    paginationToken: z
      .string()
      .nullable()
      .describe('Token for fetching next page of results'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Search posts result
  z.object({
    operation: z
      .literal('searchPosts')
      .describe('Search LinkedIn posts by keyword'),
    posts: z
      .array(LinkedInPostSchema)
      .describe('Array of LinkedIn posts matching search'),
    totalPosts: z.number().describe('Total number of posts found'),
    keyword: z.string().describe('Search keyword that was used'),
    totalResults: z.number().nullable().describe('Total results available'),
    hasNextPage: z
      .boolean()
      .nullable()
      .describe('Whether there are more results'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// Type definitions
type LinkedInToolParams = z.output<typeof LinkedInToolParamsSchema>;
type LinkedInToolResult = z.output<typeof LinkedInToolResultSchema>;
type LinkedInToolParamsInput = z.input<typeof LinkedInToolParamsSchema>;
export type LinkedInPost = z.output<typeof LinkedInPostSchema>;
export type LinkedInAuthor = z.output<typeof LinkedInAuthorSchema>;
export type LinkedInStats = z.output<typeof LinkedInStatsSchema>;

/**
 * LinkedIn scraping tool with multiple operations
 *
 * This tool provides a simple interface for scraping LinkedIn data.
 *
 * Operations:
 * 1. scrapePosts - Scrape posts from a specific LinkedIn profile
 * 2. searchPosts - Search for LinkedIn posts by keyword
 *
 * Features:
 * - Get complete post metadata (text, engagement stats, media, etc.)
 * - Support for all post types (regular, quotes, articles, documents)
 * - Pagination support
 * - Date filtering for search
 */
export class LinkedInTool<
  T extends LinkedInToolParams = LinkedInToolParams,
> extends ToolBubble<
  T,
  Extract<LinkedInToolResult, { operation: T['operation'] }>
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'linkedin-tool';
  static readonly schema = LinkedInToolParamsSchema;
  static readonly resultSchema = LinkedInToolResultSchema;
  static readonly shortDescription =
    'Scrape LinkedIn posts by profile or search by keyword. Get engagement metrics, media, and complete metadata.';
  static readonly longDescription = `
    Universal LinkedIn scraping tool for extracting posts and activity data.
    
    **OPERATIONS:**
    1. **scrapePosts**: Scrape posts from a LinkedIn profile
       - Get posts from specific users
       - Extract author information and post metadata
       - Track reactions, comments, and reposts
       - Support for articles, documents, and reshared content
    
    2. **searchPosts**: Search LinkedIn posts by keyword
       - Find posts across all of LinkedIn by keyword
       - Filter by date (past 24h, week, month)
       - Sort by relevance or date
       - Perfect for monitoring topics, trends, and mentions
    
    **WHEN TO USE THIS TOOL:**
    - **LinkedIn profile research** - analyze someone's LinkedIn activity
    - **Content strategy** - research what content performs well
    - **Influencer analysis** - track thought leaders and their engagement
    - **Competitive intelligence** - monitor competitor LinkedIn presence
    - **Lead generation** - identify active LinkedIn users in your space
    - **Social listening** - track discussions and trends on LinkedIn
    
    **DO NOT USE research-agent-tool or web-scrape-tool for LinkedIn** - This tool is specifically optimized for LinkedIn and provides:
    - Clean, structured post data ready for analysis
    - Complete engagement metrics (reactions, comments, reposts)
    - Support for all LinkedIn post types
    - Automatic pagination handling
    - Rate limiting and reliability
    
    **Simple Interface:**
    Just provide a LinkedIn username to get back all their recent posts with complete metadata.
    The tool automatically handles:
    - Authentication with Apify
    - Data transformation to unified format
    - Error handling and retries
    - Pagination token management
    
    **What you get:**
    - Post text and metadata (URN, URL, type, timestamp)
    - Complete engagement statistics (likes, comments, reposts, all reaction types)
    - Author information (name, headline, profile URL, picture)
    - Media content (images, videos, documents, articles)
    - Reshared post data (for quote posts)
    
    **Use cases:**
    - Influencer and thought leader tracking
    - Content performance analysis
    - Competitive research on LinkedIn
    - Lead generation and prospecting
    - Brand monitoring and reputation management
    - Recruitment and talent sourcing
    - Partnership and collaboration discovery
    
    The tool uses Apify's LinkedIn scraper behind the scenes while maintaining a clean, consistent interface.
  `;
  static readonly alias = 'li';
  static readonly type = 'tool';

  constructor(
    params: LinkedInToolParamsInput = {
      operation: 'scrapePosts',
      username: 'satyanadella',
      limit: 100,
    } as LinkedInToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<
    Extract<LinkedInToolResult, { operation: T['operation'] }>
  > {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'LinkedIn scraping requires authentication. Please configure APIFY_CRED.'
      ) as Extract<LinkedInToolResult, { operation: T['operation'] }>;
    }

    try {
      const { operation } = this.params;

      const result = await (async (): Promise<LinkedInToolResult> => {
        switch (operation) {
          case 'scrapePosts':
            return await this.handleScrapePosts(this.params);
          case 'searchPosts':
            return await this.handleSearchPosts(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<
        LinkedInToolResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      ) as Extract<LinkedInToolResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Create an error result based on operation type
   */
  private createErrorResult(errorMessage: string): LinkedInToolResult {
    const { operation } = this.params;

    if (operation === 'scrapePosts') {
      return {
        operation: 'scrapePosts',
        posts: [],
        totalPosts: 0,
        username: (this.params as any).username || '',
        paginationToken: null,
        success: false,
        error: errorMessage,
      };
    } else {
      return {
        operation: 'searchPosts',
        posts: [],
        totalPosts: 0,
        keyword: (this.params as any).keyword || '',
        totalResults: null,
        hasNextPage: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle scrapePosts operation
   */
  private async handleScrapePosts(
    params: Extract<LinkedInToolParams, { operation: 'scrapePosts' }>
  ): Promise<Extract<LinkedInToolResult, { operation: 'scrapePosts' }>> {
    // Use Apify service to scrape LinkedIn posts
    const apifyBubble = new ApifyBubble<'apimaestro/linkedin-profile-posts'>(
      {
        actorId: 'apimaestro/linkedin-profile-posts',
        input: {
          username: params.username,
          limit: params.limit || 100,
          page_number: params.pageNumber || 1,
        },
        waitForFinish: true,
        timeout: 180000, // 3 minutes
        credentials: params.credentials,
      },
      this.context
    );

    const apifyResult = await apifyBubble.action();

    if (!apifyResult.data.success) {
      return {
        operation: 'scrapePosts',
        posts: [],
        totalPosts: 0,
        username: params.username,
        paginationToken: null,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to scrape LinkedIn posts. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];

    // The actor returns posts directly in the items array
    if (items.length === 0) {
      return {
        operation: 'scrapePosts',
        posts: [],
        totalPosts: 0,
        username: params.username,
        paginationToken: null,
        success: false,
        error:
          'No posts found. The profile may be private or have no public posts.',
      };
    }

    // Transform posts to unified format - items ARE the posts
    const posts = this.transformPosts(items as any[]);

    // Get pagination token from the first post (they all have the same token)
    const paginationToken =
      posts.length > 0 && items[0] && (items[0] as any).pagination_token
        ? (items[0] as any).pagination_token
        : null;

    return {
      operation: 'scrapePosts',
      posts,
      totalPosts: posts.length,
      username: params.username,
      paginationToken,
      success: true,
      error: '',
    };
  }

  /**
   * Transform LinkedIn posts from Apify format to unified format
   */
  private transformPosts(posts: any[]): LinkedInPost[] {
    return posts.map((post) => ({
      urn:
        typeof post.urn === 'object'
          ? post.urn?.activity_urn || post.urn?.ugcPost_urn || null
          : post.urn || null,
      fullUrn: post.full_urn || null,
      postedAt: post.posted_at
        ? {
            date: post.posted_at.date || null,
            relative: post.posted_at.relative || null,
            timestamp: post.posted_at.timestamp || null,
          }
        : null,
      text: post.text || null,
      url: post.url || null,
      postType: post.post_type || null,
      author: post.author
        ? {
            firstName: post.author.first_name || null,
            lastName: post.author.last_name || null,
            headline: post.author.headline || null,
            username: post.author.username || null,
            profileUrl: post.author.profile_url || null,
            profilePicture: post.author.profile_picture || null,
          }
        : null,
      stats: post.stats
        ? {
            totalReactions: post.stats.total_reactions || null,
            like: post.stats.like || null,
            support: post.stats.support || null,
            love: post.stats.love || null,
            insight: post.stats.insight || null,
            celebrate: post.stats.celebrate || null,
            comments: post.stats.comments || null,
            reposts: post.stats.reposts || null,
          }
        : null,
      media: post.media
        ? {
            type: post.media.type || null,
            url: post.media.url || null,
            thumbnail: post.media.thumbnail || null,
            images: post.media.images
              ? post.media.images.map((img: any) => ({
                  url: img.url || null,
                  width: img.width || null,
                  height: img.height || null,
                }))
              : null,
          }
        : null,
      article: post.article
        ? {
            url: post.article.url || null,
            title: post.article.title || null,
            subtitle: post.article.subtitle || null,
            thumbnail: post.article.thumbnail || null,
          }
        : null,
      document: post.document
        ? {
            title: post.document.title || null,
            pageCount: post.document.page_count || null,
            url: post.document.url || null,
            thumbnail: post.document.thumbnail || null,
          }
        : null,
      resharedPost: post.reshared_post
        ? {
            urn:
              typeof post.reshared_post.urn === 'object'
                ? post.reshared_post.urn?.activity_urn ||
                  post.reshared_post.urn?.ugcPost_urn ||
                  null
                : post.reshared_post.urn || null,
            postedAt: post.reshared_post.posted_at
              ? {
                  date: post.reshared_post.posted_at.date || null,
                  relative: post.reshared_post.posted_at.relative || null,
                  timestamp: post.reshared_post.posted_at.timestamp || null,
                }
              : null,
            text: post.reshared_post.text || null,
            url: post.reshared_post.url || null,
            postType: post.reshared_post.post_type || null,
            author: post.reshared_post.author
              ? {
                  firstName: post.reshared_post.author.first_name || null,
                  lastName: post.reshared_post.author.last_name || null,
                  headline: post.reshared_post.author.headline || null,
                  username: post.reshared_post.author.username || null,
                  profileUrl: post.reshared_post.author.profile_url || null,
                  profilePicture:
                    post.reshared_post.author.profile_picture || null,
                }
              : null,
            stats: post.reshared_post.stats
              ? {
                  totalReactions:
                    post.reshared_post.stats.total_reactions || null,
                  like: post.reshared_post.stats.like || null,
                  support: post.reshared_post.stats.support || null,
                  love: post.reshared_post.stats.love || null,
                  insight: post.reshared_post.stats.insight || null,
                  celebrate: post.reshared_post.stats.celebrate || null,
                  comments: post.reshared_post.stats.comments || null,
                  reposts: post.reshared_post.stats.reposts || null,
                }
              : null,
            media: post.reshared_post.media
              ? {
                  type: post.reshared_post.media.type || null,
                  url: post.reshared_post.media.url || null,
                  thumbnail: post.reshared_post.media.thumbnail || null,
                  images: null, // Reshared posts don't include multi-image data
                }
              : null,
          }
        : null,
    }));
  }

  /**
   * Handle searchPosts operation
   */
  private async handleSearchPosts(
    params: Extract<LinkedInToolParams, { operation: 'searchPosts' }>
  ): Promise<Extract<LinkedInToolResult, { operation: 'searchPosts' }>> {
    // Use Apify service to search LinkedIn posts
    const apifyBubble =
      new ApifyBubble<'apimaestro/linkedin-posts-search-scraper-no-cookies'>(
        {
          actorId: 'apimaestro/linkedin-posts-search-scraper-no-cookies',
          input: {
            keyword: params.keyword,
            sort_type: params.sortBy || 'relevance',
            date_filter: params.dateFilter || '',
            page_number: params.pageNumber || 1,
            limit: params.limit || 50,
          },
          waitForFinish: true,
          timeout: 180000,
          credentials: params.credentials,
        },
        this.context
      );

    const apifyResult = await apifyBubble.action();

    if (!apifyResult.data.success) {
      return {
        operation: 'searchPosts',
        posts: [],
        totalPosts: 0,
        keyword: params.keyword,
        totalResults: null,
        hasNextPage: null,
        success: false,
        error:
          apifyResult.data.error ||
          'Failed to search LinkedIn posts. Please try again.',
      };
    }

    const items = apifyResult.data.items || [];

    if (items.length === 0) {
      return {
        operation: 'searchPosts',
        posts: [],
        totalPosts: 0,
        keyword: params.keyword,
        totalResults: 0,
        hasNextPage: false,
        success: true,
        error: '',
      };
    }

    // Transform search results to unified format
    const posts = this.transformSearchResults(items as any[]);

    // Get metadata from first item (all items have the same metadata)
    const metadata = (items[0] as any).metadata;

    return {
      operation: 'searchPosts',
      posts,
      totalPosts: posts.length,
      keyword: params.keyword,
      totalResults: metadata?.total_count || null,
      hasNextPage: metadata?.has_next_page || null,
      success: true,
      error: '',
    };
  }

  /**
   * Transform search results to unified post format
   */
  private transformSearchResults(items: any[]): LinkedInPost[] {
    return items.map((item) => ({
      urn: item.activity_id || null,
      fullUrn: item.full_urn || null,
      postedAt: item.posted_at
        ? {
            date: item.posted_at.date || null,
            relative: item.posted_at.display_text || null,
            timestamp: item.posted_at.timestamp || null,
          }
        : null,
      text: item.text || null,
      url: item.post_url || null,
      postType: item.is_reshare ? 'repost' : 'regular',
      author: item.author
        ? {
            firstName: null,
            lastName: null,
            headline: item.author.headline || null,
            username: item.author.profile_id || null,
            profileUrl: item.author.profile_url || null,
            profilePicture: item.author.image_url || null,
          }
        : null,
      stats: item.stats
        ? {
            totalReactions: item.stats.total_reactions || null,
            like: this.getReactionCount(item.stats.reactions, 'LIKE'),
            support: this.getReactionCount(item.stats.reactions, 'EMPATHY'),
            love: this.getReactionCount(item.stats.reactions, 'LOVE'),
            insight: this.getReactionCount(item.stats.reactions, 'INTEREST'),
            celebrate: this.getReactionCount(item.stats.reactions, 'PRAISE'),
            comments: item.stats.comments || null,
            reposts: item.stats.shares || null,
          }
        : null,
      media: null, // Search results don't include detailed media info
      article:
        item.content?.type === 'article' && item.content.article
          ? {
              url: item.content.article.url || null,
              title: item.content.article.title || null,
              subtitle: item.content.article.subtitle || null,
              thumbnail: item.content.article.thumbnail_url || null,
            }
          : null,
      document: null, // Search results don't include document info
      resharedPost: null, // Search results don't include nested reshare details
    }));
  }

  /**
   * Helper to get reaction count by type from reactions array
   */
  private getReactionCount(
    reactions: Array<{ type: string; count: number }> | undefined,
    type: string
  ): number | null {
    if (!reactions) return null;
    const reaction = reactions.find((r) => r.type === type);
    return reaction ? reaction.count : null;
  }
}
