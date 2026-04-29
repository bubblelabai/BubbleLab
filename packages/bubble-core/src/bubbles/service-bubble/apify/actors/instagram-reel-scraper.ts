import { z } from 'zod';
import { InstagramPostSchema } from './instagram-scraper.js';

// ============================================================================
// INSTAGRAM REEL SCRAPER SCHEMAS
// ============================================================================

export const InstagramReelScraperInputSchema = z.object({
  username: z
    .array(z.string())
    .min(
      1,
      'At least one username, profile URL, profile ID, or reel URL is required'
    )
    .describe(
      'Instagram usernames, profile URLs, profile IDs, or direct reel URLs. Examples: ["ryanbailey.cb"], ["https://www.instagram.com/ryanbailey.cb/"], ["https://www.instagram.com/p/DXIlvPbj2PY/"]'
    ),

  resultsLimit: z
    .number()
    .min(1)
    .default(20)
    .describe('Maximum number of reels to scrape per profile (min 1)'),

  onlyPostsNewerThan: z
    .string()
    .optional()
    .describe(
      'Only return reels posted on or after this date. Accepts YYYY-MM-DD, ISO timestamp, or relative time like "1 day" / "2 weeks"'
    ),

  skipPinnedPosts: z
    .boolean()
    .default(false)
    .optional()
    .describe('Exclude pinned reels from the results'),

  includeSharesCount: z
    .boolean()
    .default(false)
    .optional()
    .describe('Extract the number of shares for each reel (paid add-on)'),

  includeTranscript: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      'Extract an auto-generated text transcript of the reel audio (paid add-on)'
    ),

  includeDownloadedVideo: z
    .boolean()
    .default(false)
    .optional()
    .describe('Include a direct MP4 download URL for each reel (paid add-on)'),
});

// Reel scraper extends the base post schema with reel-specific fields
export const InstagramReelScraperItemSchema = InstagramPostSchema.extend({
  inputUrl: z
    .string()
    .optional()
    .describe('Original input profile or reel URL'),
  ownerFullName: z.string().optional().describe('Reel owner full name'),
  sharesCount: z
    .number()
    .optional()
    .describe('Number of shares (only present when includeSharesCount=true)'),
  videoPlayCount: z.number().optional().describe('Number of video plays'),
  videoDuration: z.number().optional().describe('Reel length in seconds'),
  videoUrl: z.string().optional().describe('CDN video URL'),
  downloadedVideo: z
    .string()
    .optional()
    .describe(
      'Direct MP4 download URL (only present when includeDownloadedVideo=true)'
    ),
  transcript: z
    .string()
    .optional()
    .describe(
      'Auto-generated speech transcript (only present when includeTranscript=true)'
    ),
  firstComment: z.string().optional().describe('First/top comment text'),
  latestComments: z
    .array(z.unknown())
    .optional()
    .describe('Array of latest comments with owner, text, likes, replies'),
  coauthorProducers: z
    .array(z.unknown())
    .optional()
    .describe('Co-creator information'),
  musicInfo: z
    .object({
      artist_name: z.string().optional(),
      song_name: z.string().optional(),
      uses_original_audio: z.boolean().optional(),
      audio_id: z.string().optional(),
    })
    .passthrough()
    .optional()
    .describe('Music/audio information for the reel'),
});
