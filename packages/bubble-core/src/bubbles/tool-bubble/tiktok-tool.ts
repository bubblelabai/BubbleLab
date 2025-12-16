import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput } from '../service-bubble/apify/types.js';

// Unified TikTok data types
const TikTokAuthorSchema = z.object({
  id: z.string().nullable().describe('Author user ID'),
  uniqueId: z.string().nullable().describe('Author username'),
  nickname: z.string().nullable().describe('Author display name'),
  avatarThumb: z.string().nullable().describe('Author avatar URL'),
  signature: z.string().nullable().describe('Author bio/signature'),
  verified: z.boolean().nullable().describe('Whether author is verified'),
  followerCount: z.number().nullable().describe('Number of followers'),
  followingCount: z.number().nullable().describe('Number of following'),
  videoCount: z.number().nullable().describe('Total number of videos'),
  heartCount: z.number().nullable().describe('Total likes received'),
});

const TikTokVideoSchema = z.object({
  id: z.string().nullable().describe('Video ID'),
  text: z.string().nullable().describe('Video caption/description'),
  createTime: z.number().nullable().describe('Creation timestamp'),
  createTimeISO: z.string().nullable().describe('Creation time (ISO format)'),
  author: TikTokAuthorSchema.nullable().describe('Video author information'),
  stats: z
    .object({
      diggCount: z.number().nullable().describe('Number of likes'),
      shareCount: z.number().nullable().describe('Number of shares'),
      commentCount: z.number().nullable().describe('Number of comments'),
      playCount: z.number().nullable().describe('Number of plays/views'),
      collectCount: z.number().nullable().describe('Number of times collected'),
    })
    .nullable()
    .describe('Video engagement statistics'),
  videoUrl: z.string().nullable().describe('Video URL'),
  webVideoUrl: z.string().nullable().describe('Web video URL'),
  covers: z.array(z.string()).nullable().describe('Array of cover image URLs'),
  hashtags: z
    .array(
      z.object({
        name: z.string().nullable(),
      })
    )
    .nullable()
    .describe('Hashtags used in the video'),
});

const TikTokToolParamsSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'scrapeHashtag', 'scrapeVideo'])
    .describe('Operation to perform'),

  profiles: z
    .array(z.string())
    .optional()
    .describe('TikTok profile URLs to scrape (for scrapeProfile)'),

  hashtags: z
    .array(z.string())
    .optional()
    .describe('Hashtags to scrape (for scrapeHashtag)'),

  videoUrls: z
    .array(z.string())
    .optional()
    .describe('Video URLs to scrape (for scrapeVideo)'),

  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20)
    .optional()
    .describe('Number of results to fetch'),

  shouldDownloadVideos: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to download video files'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

const TikTokToolResultSchema = z.object({
  operation: z
    .enum(['scrapeProfile', 'scrapeHashtag', 'scrapeVideo'])
    .describe('Operation that was performed'),

  videos: z.array(TikTokVideoSchema).describe('Array of scraped videos'),

  totalVideos: z.number().describe('Total number of videos scraped'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type TikTokToolParams = z.output<typeof TikTokToolParamsSchema>;
type TikTokToolResult = z.output<typeof TikTokToolResultSchema>;
type TikTokToolParamsInput = z.input<typeof TikTokToolParamsSchema>;

export class TikTokTool extends ToolBubble<TikTokToolParams, TikTokToolResult> {
  static readonly bubbleName: BubbleName = 'tiktok-tool';
  static readonly schema = TikTokToolParamsSchema;
  static readonly resultSchema = TikTokToolResultSchema;
  static readonly shortDescription =
    'Scrape TikTok profiles, videos, and hashtags.';
  static readonly longDescription = `
    Universal TikTok scraping tool.
    
    Operations:
    - scrapeProfile: Get videos from user profiles
    - scrapeHashtag: Get videos by hashtag
    - scrapeVideo: Get details for specific videos
    
    Uses Apify's clockworks/tiktok-scraper.
  `;
  static readonly alias = 'tiktok';
  static readonly type = 'tool';

  constructor(
    params: TikTokToolParamsInput = {
      operation: 'scrapeProfile',
      profiles: ['@tiktok'],
      limit: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<TikTokToolResult> {
    const credentials = this.params.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'TikTok scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;

      const result = await this.runScraper();

      return {
        operation,
        videos: result.videos,
        totalVideos: result.videos.length,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private createErrorResult(errorMessage: string): TikTokToolResult {
    return {
      operation: this.params.operation,
      videos: [],
      totalVideos: 0,
      success: false,
      error: errorMessage,
    };
  }

  private async runScraper(): Promise<{
    videos: z.infer<typeof TikTokVideoSchema>[];
    success: boolean;
    error: string;
  }> {
    const { operation, limit, shouldDownloadVideos } = this.params;

    let input: any = {
      resultsPerPage: limit,
      shouldDownloadVideos: shouldDownloadVideos || false,
      shouldDownloadCovers: true,
    };

    if (operation === 'scrapeProfile') {
      if (!this.params.profiles?.length) {
        return { videos: [], success: false, error: 'Profiles required' };
      }
      input.profileUrls = this.params.profiles;
    } else if (operation === 'scrapeHashtag') {
      if (!this.params.hashtags?.length) {
        return { videos: [], success: false, error: 'Hashtags required' };
      }
      input.hashtags = this.params.hashtags;
    } else if (operation === 'scrapeVideo') {
      if (!this.params.videoUrls?.length) {
        return { videos: [], success: false, error: 'Video URLs required' };
      }
      input.videoUrls = this.params.videoUrls;
    }

    const scraper = new ApifyBubble<'clockworks/tiktok-scraper'>(
      {
        actorId: 'clockworks/tiktok-scraper',
        input,
        waitForFinish: true,
        timeout: 180000,
        credentials: this.params.credentials,
      },
      this.context,
      'tiktokScraper'
    );

    const apifyResult = await scraper.action();

    if (!apifyResult.data.success) {
      return {
        videos: [],
        success: false,
        error: apifyResult.data.error || 'Failed to scrape TikTok',
      };
    }

    const items = apifyResult.data.items || [];
    const videos = this.transformVideos(items);

    return {
      videos,
      success: true,
      error: '',
    };
  }

  private transformVideos(
    items: ActorOutput<'clockworks/tiktok-scraper'>[]
  ): z.infer<typeof TikTokVideoSchema>[] {
    return items.map((item) => ({
      id: item.id || null,
      text: item.text || null,
      createTime: item.createTime || null,
      createTimeISO: item.createTimeISO || null,
      author: item.author
        ? {
            id: item.author.id || null,
            uniqueId: item.author.uniqueId || null,
            nickname: item.author.nickname || null,
            avatarThumb: item.author.avatarThumb || null,
            signature: item.author.signature || null,
            verified: item.author.verified || null,
            followerCount: item.author.followerCount || null,
            followingCount: item.author.followingCount || null,
            videoCount: item.author.videoCount || null,
            heartCount: item.author.heartCount || null,
          }
        : null,
      stats: item.stats
        ? {
            diggCount: item.stats.diggCount || null,
            shareCount: item.stats.shareCount || null,
            commentCount: item.stats.commentCount || null,
            playCount: item.stats.playCount || null,
            collectCount: item.stats.collectCount || null,
          }
        : null,
      videoUrl: item.videoUrl || null,
      webVideoUrl: item.webVideoUrl || null,
      covers: item.covers || null,
      hashtags: item.hashtags
        ? item.hashtags.map((tag) => ({ name: tag.title || tag.name || null }))
        : null,
    }));
  }
}
