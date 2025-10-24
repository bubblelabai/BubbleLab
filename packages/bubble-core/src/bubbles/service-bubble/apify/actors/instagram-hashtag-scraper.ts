import { z } from 'zod';
import { InstagramPostSchema } from './instagram-scraper.js';

// ============================================================================
// INSTAGRAM HASHTAG SCRAPER SCHEMAS
// ============================================================================

export const InstagramHashtagScraperInputSchema = z.object({
  hashtags: z
    .array(z.string())
    .min(1, 'At least one hashtag is required')
    .describe(
      'Hashtags to scrape. Examples: ["ai", "tech"] or ["https://www.instagram.com/explore/tags/ai"]'
    ),

  resultsLimit: z
    .number()
    .min(1)
    .max(1000)
    .default(50)
    .describe('Maximum number of posts to fetch per hashtag (1-1000)'),

  addParentData: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to include parent post data for child posts'),
});

// Hashtag scraper returns posts directly (simpler than profile scraper)
// Based on the actual Apify output data from your example
export const InstagramHashtagScraperItemSchema = InstagramPostSchema.extend({
  // Additional fields specific to hashtag scraping
  inputUrl: z.string().optional().describe('Original hashtag URL'),
  locationName: z.string().optional().describe('Location name if tagged'),
  locationId: z.string().optional().describe('Location ID if tagged'),
  ownerFullName: z.string().optional().describe('Post owner full name'),
  isSponsored: z.boolean().optional().describe('Whether post is sponsored'),
  firstComment: z.string().optional().describe('First comment on the post'),
  latestComments: z
    .array(z.unknown())
    .optional()
    .describe('Array of latest comments'),
  musicInfo: z
    .object({
      audio_canonical_id: z.string().optional(),
      audio_type: z.string().nullable().optional(),
      music_info: z
        .object({
          music_asset_info: z
            .object({
              allows_saving: z.boolean().optional(),
              artist_id: z.string().nullable().optional(),
              audio_id: z.string().optional(),
              cover_artwork_thumbnail_uri: z.string().optional(),
              cover_artwork_uri: z.string().optional(),
              dark_message: z.string().nullable().optional(),
              display_artist: z.string().optional(),
              duration_in_ms: z.number().optional(),
              fast_start_progressive_download_url: z.string().optional(),
              has_lyrics: z.boolean().optional(),
              highlight_start_times_in_ms: z.array(z.number()).optional(),
              id: z.string().optional(),
              ig_username: z.string().nullable().optional(),
              is_eligible_for_audio_effects: z.boolean().optional(),
              is_eligible_for_vinyl_sticker: z.boolean().optional(),
              is_explicit: z.boolean().optional(),
              licensed_music_subtype: z.string().optional(),
              lyrics: z.string().nullable().optional(),
              progressive_download_url: z.string().optional(),
              reactive_audio_download_url: z.string().nullable().optional(),
              sanitized_title: z.string().nullable().optional(),
              song_monetization_info: z.unknown().nullable().optional(),
              spotify_track_metadata: z.unknown().nullable().optional(),
              subtitle: z.string().optional(),
              title: z.string().optional(),
              web_30s_preview_download_url: z.string().nullable().optional(),
            })
            .optional(),
          music_consumption_info: z
            .object({
              allow_media_creation_with_music: z.boolean().optional(),
              audio_asset_start_time_in_ms: z.number().optional(),
              audio_filter_infos: z.array(z.unknown()).optional(),
              audio_muting_info: z
                .object({
                  allow_audio_editing: z.boolean().optional(),
                  mute_audio: z.boolean().optional(),
                  mute_reason_str: z.string().optional(),
                  show_muted_audio_toast: z.boolean().optional(),
                })
                .optional(),
              contains_lyrics: z.boolean().nullable().optional(),
              derived_content_id: z.string().nullable().optional(),
              derived_content_start_time_in_composition_in_ms: z
                .number()
                .optional(),
              display_labels: z.unknown().nullable().optional(),
              formatted_clips_media_count: z.string().nullable().optional(),
              ig_artist: z
                .object({
                  full_name: z.string().optional(),
                  id: z.string().optional(),
                  is_private: z.boolean().optional(),
                  is_verified: z.boolean().optional(),
                  profile_pic_id: z.string().optional(),
                  profile_pic_url: z.string().optional(),
                  username: z.string().optional(),
                })
                .nullable()
                .optional(),
              is_bookmarked: z.boolean().optional(),
              is_trending_in_clips: z.boolean().optional(),
              music_creation_restriction_reason: z
                .string()
                .nullable()
                .optional(),
              overlap_duration_in_ms: z.number().optional(),
              placeholder_profile_pic_url: z.string().optional(),
              previous_trend_rank: z.number().nullable().optional(),
              should_allow_music_editing: z.boolean().optional(),
              should_mute_audio: z.boolean().optional(),
              should_mute_audio_reason: z.string().optional(),
              should_mute_audio_reason_type: z.string().nullable().optional(),
              trend_rank: z.number().nullable().optional(),
              user_notes: z.unknown().nullable().optional(),
            })
            .optional(),
        })
        .nullable()
        .optional(),
      original_sound_info: z.unknown().nullable().optional(),
      pinned_media_ids: z.array(z.unknown()).nullable().optional(),
    })
    .optional()
    .describe('Music/audio information for the post'),
});
