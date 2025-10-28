import { z } from 'zod';

// ============================================================================
// YOUTUBE TRANSCRIPT SCRAPER SCHEMAS
// ============================================================================

export const YouTubeTranscriptScraperInputSchema = z.object({
  videoUrl: z
    .string()
    .url()
    .describe(
      'The full URL of the YouTube video to scrape the transcript from. Example: https://www.youtube.com/watch?v=IELMSD2kdmk'
    ),
});

export const YouTubeTranscriptItemSchema = z.object({
  start: z
    .string()
    .optional()
    .describe('Timestamp when the text appears (in seconds)'),

  dur: z
    .string()
    .optional()
    .describe('Duration of the text segment (in seconds)'),

  text: z.string().optional().describe('Transcript text for this segment'),
});

export const YouTubeTranscriptResultSchema = z.object({
  videoUrl: z.string().optional().describe('Input video URL'),

  data: z
    .array(YouTubeTranscriptItemSchema)
    .optional()
    .describe('Array of transcript segments with timestamps'),
});
