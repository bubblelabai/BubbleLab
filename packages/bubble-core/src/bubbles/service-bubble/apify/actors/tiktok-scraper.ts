import { z } from 'zod';

export const TikTokScraperInputSchema = z.object({
  profileUrls: z
    .array(z.string())
    .optional()
    .describe(
      'TikTok profile URLs to scrape. Examples: ["https://www.tiktok.com/@username"]'
    ),

  hashtags: z
    .array(z.string())
    .optional()
    .describe('Hashtags to scrape posts from. Examples: ["tech", "ai"]'),

  videoUrls: z
    .array(z.string())
    .optional()
    .describe('Direct TikTok video URLs to scrape'),

  searchQueries: z
    .array(z.string())
    .optional()
    .describe('Search queries to find TikTok videos'),

  resultsPerPage: z
    .number()
    .min(1)
    .max(1000)
    .default(20)
    .optional()
    .describe('Number of results to fetch per profile/hashtag (default: 20)'),

  shouldDownloadVideos: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to download video files'),

  shouldDownloadCovers: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to download cover images'),

  shouldDownloadSubtitles: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to download subtitles if available'),
});

const TikTokAuthorSchema = z.object({
  id: z.string().optional().describe('Author user ID'),

  uniqueId: z.string().optional().describe('Author username'),

  nickname: z.string().optional().describe('Author display name'),

  avatarThumb: z.string().optional().describe('Author avatar URL'),

  signature: z.string().optional().describe('Author bio/signature'),

  verified: z.boolean().optional().describe('Whether author is verified'),

  followerCount: z.number().optional().describe('Number of followers'),

  followingCount: z.number().optional().describe('Number of following'),

  videoCount: z.number().optional().describe('Total number of videos'),

  heartCount: z.number().optional().describe('Total likes received'),
});

const TikTokVideoStatsSchema = z.object({
  diggCount: z.number().optional().describe('Number of likes'),

  shareCount: z.number().optional().describe('Number of shares'),

  commentCount: z.number().optional().describe('Number of comments'),

  playCount: z.number().optional().describe('Number of plays/views'),

  collectCount: z
    .number()
    .optional()
    .describe('Number of times collected/saved'),
});

const TikTokMusicSchema = z.object({
  id: z.string().optional().describe('Music ID'),

  title: z.string().optional().describe('Music title'),

  playUrl: z.string().optional().describe('Music play URL'),

  authorName: z.string().optional().describe('Music author name'),

  duration: z.number().optional().describe('Music duration in seconds'),
});

export const TikTokVideoSchema = z.object({
  id: z.string().optional().describe('Video ID'),

  text: z.string().optional().describe('Video caption/description'),

  createTime: z.number().optional().describe('Creation timestamp'),

  createTimeISO: z.string().optional().describe('Creation time (ISO format)'),

  author: TikTokAuthorSchema.optional().describe('Video author information'),

  stats: TikTokVideoStatsSchema.optional().describe(
    'Video engagement statistics'
  ),

  music: TikTokMusicSchema.optional().describe('Background music information'),

  videoUrl: z.string().optional().describe('Video URL'),

  webVideoUrl: z.string().optional().describe('Web video URL'),

  videoMeta: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.number().optional(),
    })
    .optional()
    .describe('Video metadata (dimensions, duration)'),

  covers: z.array(z.string()).optional().describe('Array of cover image URLs'),

  hashtags: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        title: z.string().optional(),
      })
    )
    .optional()
    .describe('Hashtags used in the video'),

  mentions: z
    .array(z.string())
    .optional()
    .describe('User mentions in the video'),

  downloadedVideoUrl: z
    .string()
    .optional()
    .describe('Downloaded video URL (if shouldDownloadVideos is true)'),

  downloadedCoverUrl: z
    .string()
    .optional()
    .describe('Downloaded cover URL (if shouldDownloadCovers is true)'),

  isAd: z.boolean().optional().describe('Whether this is a promoted video'),
});

export type TikTokScraperInput = z.output<typeof TikTokScraperInputSchema>;
export type TikTokVideo = z.output<typeof TikTokVideoSchema>;
