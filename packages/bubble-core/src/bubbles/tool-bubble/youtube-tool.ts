import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput } from '../service-bubble/apify/types.js';

// Unified YouTube data types (service-agnostic)
const YouTubeVideoSchema = z.object({
  title: z.string().nullable().describe('Video title'),
  id: z.string().nullable().describe('YouTube video ID'),
  url: z.string().nullable().describe('Video URL'),
  viewCount: z.number().nullable().describe('Number of views'),
  likes: z.number().nullable().describe('Number of likes'),
  date: z.string().nullable().describe('Upload date (ISO format)'),
  channelName: z.string().nullable().describe('Channel name'),
  channelUrl: z.string().nullable().describe('Channel URL'),
  subscribers: z.number().nullable().describe('Number of channel subscribers'),
  duration: z.string().nullable().describe('Video duration (HH:MM:SS)'),
  description: z.string().nullable().describe('Video description'),
  comments: z.number().nullable().describe('Number of comments'),
  thumbnail: z.string().nullable().describe('Thumbnail URL'),
});

const YouTubeTranscriptSegmentSchema = z.object({
  start: z.string().nullable().describe('Start time in seconds'),
  duration: z.string().nullable().describe('Duration in seconds'),
  text: z.string().nullable().describe('Transcript text'),
});

// Tool params schema
const YouTubeToolParamsSchema = z.object({
  operation: z
    .enum(['searchVideos', 'getTranscript', 'scrapeChannel'])
    .describe(
      'Operation: searchVideos for search/URLs, getTranscript for transcripts, scrapeChannel for channel videos. Not all videos will have transcript available.'
    ),

  // Search operation fields
  searchQueries: z
    .array(z.string())
    .optional()
    .describe(
      'Search queries for YouTube (for searchVideos). Examples: ["AI tutorials", "react hooks"]'
    ),

  videoUrls: z
    .array(z.string().url())
    .optional()
    .describe(
      'Direct YouTube URLs - videos, channels, playlists (for searchVideos or getTranscript)'
    ),

  // Channel scraping
  channelUrl: z
    .string()
    .optional()
    .describe('YouTube channel URL (for scrapeChannel operation)'),

  // Transcript operation field
  videoUrl: z
    .string()
    .url()
    .optional()
    .describe('Single video URL for transcript extraction (for getTranscript)'),

  // Common fields
  maxResults: z
    .number()
    .min(0)
    .max(200)
    .default(20)
    .optional()
    .describe('Max videos to fetch (default: 20)'),

  includeShorts: z
    .boolean()
    .default(false)
    .optional()
    .describe('Include YouTube Shorts in results'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

// Tool result schema
const YouTubeToolResultSchema = z.object({
  operation: z
    .enum(['searchVideos', 'getTranscript', 'scrapeChannel'])
    .describe('Operation performed'),

  // Video data (for searchVideos and scrapeChannel)
  videos: z
    .array(YouTubeVideoSchema)
    .optional()
    .describe('Array of YouTube videos'),

  // Transcript data (for getTranscript)
  transcript: z
    .array(YouTubeTranscriptSegmentSchema)
    .optional()
    .describe('Video transcript with timestamps'),

  fullTranscriptText: z
    .string()
    .optional()
    .describe('Complete transcript as plain text'),

  // Common fields
  totalResults: z.number().describe('Total number of results'),
  success: z.boolean().describe('Whether operation succeeded'),
  error: z.string().describe('Error message if failed'),
});

// Type definitions
type YouTubeToolParams = z.output<typeof YouTubeToolParamsSchema>;
type YouTubeToolResult = z.output<typeof YouTubeToolResultSchema>;
type YouTubeToolParamsInput = z.input<typeof YouTubeToolParamsSchema>;
export type YouTubeVideo = z.output<typeof YouTubeVideoSchema>;
export type YouTubeTranscriptSegment = z.output<
  typeof YouTubeTranscriptSegmentSchema
>;

/**
 * Simple, dev-friendly YouTube tool
 *
 * Provides easy access to YouTube data through three operations:
 * - searchVideos: Search YouTube or scrape video/channel/playlist URLs
 * - getTranscript: Extract video transcripts with timestamps
 * - scrapeChannel: Get all videos from a channel
 */
export class YouTubeTool extends ToolBubble<
  YouTubeToolParams,
  YouTubeToolResult
> {
  static readonly bubbleName: BubbleName = 'youtube-tool';
  static readonly schema = YouTubeToolParamsSchema;
  static readonly resultSchema = YouTubeToolResultSchema;
  static readonly shortDescription =
    'Search YouTube videos, extract transcripts, and scrape channel content with a simple interface';
  static readonly longDescription = `
    Universal YouTube tool for video search, transcript extraction, and channel scraping.

    **OPERATIONS:**
    1. **searchVideos**: Search YouTube or scrape specific URLs
       - Search by keywords
       - Scrape videos, channels, playlists, or hashtags
       - Get video metadata, views, likes, channel info

    2. **getTranscript**: Extract video transcripts
       - Get timestamped transcript segments
       - Full transcript text available
       - Perfect for content analysis or subtitles

    3. **scrapeChannel**: Get all videos from a channel
       - Fetch recent videos from any channel
       - Sort by newest, popular, or oldest
       - Get comprehensive video data

    **WHEN TO USE THIS TOOL:**
    - YouTube video search and discovery
    - Content analysis and research
    - Transcript extraction for AI/ML
    - Channel monitoring and tracking
    - Video metadata collection

    **Simple Interface:**
    Just specify the operation and provide search terms or URLs.
    The tool handles service selection, data transformation, and error handling.

    **What you get:**
    - Clean, structured video data
    - Timestamped transcripts
    - Channel and engagement metrics
    - Ready for analysis or processing
  `;
  static readonly alias = 'yt';
  static readonly type = 'tool';

  constructor(
    params: YouTubeToolParamsInput = {
      operation: 'searchVideos',
      searchQueries: ['AI tutorials'],
      maxResults: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<YouTubeToolResult> {
    const credentials = this.params?.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'YouTube scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const { operation } = this.params;

      // Validate required fields
      if (operation === 'searchVideos') {
        if (
          (!this.params.searchQueries ||
            this.params.searchQueries.length === 0) &&
          (!this.params.videoUrls || this.params.videoUrls.length === 0)
        ) {
          return this.createErrorResult(
            'searchVideos requires either searchQueries or videoUrls'
          );
        }
      }

      if (operation === 'getTranscript' && !this.params.videoUrl) {
        return this.createErrorResult(
          'getTranscript requires a videoUrl parameter'
        );
      }

      if (operation === 'scrapeChannel' && !this.params.channelUrl) {
        return this.createErrorResult(
          'scrapeChannel requires a channelUrl parameter'
        );
      }

      // Execute operation
      switch (operation) {
        case 'searchVideos':
          return await this.handleSearchVideos();
        case 'getTranscript':
          return await this.handleGetTranscript();
        case 'scrapeChannel':
          return await this.handleScrapeChannel();
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(errorMessage: string): YouTubeToolResult {
    const { operation } = this.params;

    return {
      operation: operation || 'searchVideos',
      videos:
        operation === 'searchVideos' || operation === 'scrapeChannel'
          ? []
          : undefined,
      transcript: operation === 'getTranscript' ? [] : undefined,
      fullTranscriptText: operation === 'getTranscript' ? '' : undefined,
      totalResults: 0,
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Handle searchVideos operation
   */
  private async handleSearchVideos(): Promise<YouTubeToolResult> {
    const searchVideo = new ApifyBubble<'streamers/youtube-scraper'>(
      {
        actorId: 'streamers/youtube-scraper',
        input: {
          searchQueries: this.params.searchQueries,
          startUrls: this.params.videoUrls?.map((url) => ({ url })),
          maxResults: this.params.maxResults || 20,
          maxResultsShorts: this.params.includeShorts
            ? this.params.maxResults || 20
            : 0,
        },
        waitForFinish: true,
        timeout: 180000,
        credentials: this.params.credentials,
      },
      this.context
    );

    const result = await searchVideo.action();

    if (!result.data.success) {
      return this.createErrorResult(
        result.data.error || 'Failed to search YouTube videos'
      );
    }

    const items = result.data.items || [];
    const videos = this.transformVideos(items);

    return {
      operation: 'searchVideos',
      videos,
      totalResults: videos.length,
      success: true,
      error: '',
    };
  }

  /**
   * Handle getTranscript operation
   */
  private async handleGetTranscript(): Promise<YouTubeToolResult> {
    const transcriptScraper =
      new ApifyBubble<'pintostudio/youtube-transcript-scraper'>(
        {
          actorId: 'pintostudio/youtube-transcript-scraper',
          input: {
            videoUrl: this.params.videoUrl!,
          },
          waitForFinish: true,
          timeout: 120000,
          credentials: this.params.credentials,
        },
        this.context
      );

    const result = await transcriptScraper.action();

    if (!result.data.success) {
      return this.createErrorResult(
        result.data.error || 'Failed to extract transcript'
      );
    }

    const items = result.data.items || [];
    const firstItem = items[0];

    if (!firstItem || typeof firstItem !== 'object') {
      return this.createErrorResult('No transcript data returned');
    }

    const anyItem = firstItem as {
      data?: Array<{ start?: string; dur?: string; text?: string }>;
    };

    const transcriptData = anyItem.data || [];
    const transcript = transcriptData.map((segment) => ({
      start: segment.start || null,
      duration: segment.dur || null,
      text: segment.text || null,
    }));

    const fullText = transcript.map((seg) => seg.text || '').join(' ');

    return {
      operation: 'getTranscript',
      transcript,
      fullTranscriptText: fullText,
      totalResults: transcript.length,
      success: true,
      error: '',
    };
  }

  /**
   * Handle scrapeChannel operation
   */
  private async handleScrapeChannel(): Promise<YouTubeToolResult> {
    const channelScraper = new ApifyBubble<'streamers/youtube-scraper'>(
      {
        actorId: 'streamers/youtube-scraper',
        input: {
          startUrls: [{ url: this.params.channelUrl! }],
          maxResults: this.params.maxResults || 20,
          sortVideosBy: 'NEWEST',
        },
        waitForFinish: true,
        timeout: 180000,
        credentials: this.params.credentials,
      },
      this.context
    );

    const result = await channelScraper.action();

    if (!result.data.success) {
      return this.createErrorResult(
        result.data.error || 'Failed to scrape channel'
      );
    }

    const items = result.data.items || [];
    const videos = this.transformVideos(items);

    return {
      operation: 'scrapeChannel',
      videos,
      totalResults: videos.length,
      success: true,
      error: '',
    };
  }

  /**
   * Transform Apify video data to unified format
   */
  private transformVideos(
    items: ActorOutput<'streamers/youtube-scraper'>[]
  ): YouTubeVideo[] {
    return items.map((item) => {
      if (typeof item !== 'object' || item === null) {
        return this.createEmptyVideo();
      }

      const anyItem = item;

      return {
        title: anyItem.title || null,
        id: anyItem.id || null,
        url: anyItem.url || null,
        viewCount: anyItem.viewCount || null,
        likes: anyItem.likes || null,
        date: anyItem.date || null,
        channelName: anyItem.channelName || null,
        channelUrl: anyItem.channelUrl || null,
        subscribers: anyItem.numberOfSubscribers || null,
        duration: anyItem.duration || null,
        description: anyItem.text || null,
        comments: anyItem.commentsCount || null,
        thumbnail: anyItem.thumbnailUrl || null,
      };
    });
  }

  /**
   * Create empty video object
   */
  private createEmptyVideo(): YouTubeVideo {
    return {
      title: null,
      id: null,
      url: null,
      viewCount: null,
      likes: null,
      date: null,
      channelName: null,
      channelUrl: null,
      subscribers: null,
      duration: null,
      description: null,
      comments: null,
      thumbnail: null,
    };
  }
}
