import { z } from 'zod';

// ============================================================================
// LINKEDIN POSTS SEARCH SCRAPER SCHEMAS
// ============================================================================

export const LinkedInPostsSearchInputSchema = z.object({
  keyword: z
    .string()
    .min(1, 'Search keyword is required')
    .describe('Keyword or phrase to search for in LinkedIn posts'),

  sort_type: z
    .enum(['relevance', 'date_posted'])
    .default('relevance')
    .optional()
    .describe('Sort results by relevance or date posted'),

  page_number: z
    .number()
    .min(1)
    .default(1)
    .optional()
    .describe('Page number for pagination'),

  date_filter: z
    .enum(['', 'past-24h', 'past-week', 'past-month'])
    .default('')
    .optional()
    .describe('Filter posts by date range'),

  limit: z
    .number()
    .min(1)
    .max(50)
    .default(50)
    .optional()
    .describe('Number of results per page (1-50)'),
});

// Author schema for search results
const SearchAuthorSchema = z.object({
  name: z.string().optional().describe('Author name or company name'),
  headline: z.string().optional().describe('Author headline or follower count'),
  profile_id: z.string().optional().describe('LinkedIn profile ID'),
  profile_url: z.string().optional().describe('Author profile URL'),
  image_url: z.string().optional().describe('Author profile image URL'),
});

// Stats schema for search results
const SearchStatsSchema = z.object({
  total_reactions: z.number().optional().describe('Total number of reactions'),
  comments: z.number().optional().describe('Number of comments'),
  shares: z.number().optional().describe('Number of shares'),
  reactions: z
    .array(
      z.object({
        type: z
          .string()
          .optional()
          .describe('Reaction type (LIKE, EMPATHY, etc)'),
        count: z
          .number()
          .optional()
          .describe('Number of reactions of this type'),
      })
    )
    .optional()
    .describe('Breakdown of reactions by type'),
});

// Posted at schema
const SearchPostedAtSchema = z.object({
  display_text: z
    .string()
    .optional()
    .describe('Relative time display (e.g., "22m")'),
  date: z.string().optional().describe('Post date (formatted string)'),
  timestamp: z.number().optional().describe('Unix timestamp in milliseconds'),
});

// Article schema
const SearchArticleSchema = z.object({
  url: z.string().nullable().optional().describe('Article URL'),
  title: z.string().nullable().optional().describe('Article title'),
  subtitle: z
    .string()
    .nullable()
    .optional()
    .describe('Article subtitle or source'),
  thumbnail: z.string().nullable().optional().describe('Article thumbnail URL'),
});

// Metadata schema for pagination and search info
const SearchMetadataSchema = z.object({
  total_count: z.number().optional().describe('Total number of results'),
  count: z.number().optional().describe('Count in current page'),
  page: z.number().optional().describe('Current page number'),
  page_size: z.number().optional().describe('Page size'),
  total_pages: z.number().optional().describe('Total number of pages'),
  has_next_page: z
    .boolean()
    .optional()
    .describe('Whether there is a next page'),
  has_prev_page: z
    .boolean()
    .optional()
    .describe('Whether there is a previous page'),
});

// Content schema for different post types
const SearchContentSchema = z.object({
  type: z
    .string()
    .optional()
    .describe('Content type (article, video, image, text)'),
  article: SearchArticleSchema.optional().describe(
    'Article details if content type is article'
  ),
  url: z.string().optional().describe('Media URL for video/image content'),
  thumbnail_url: z
    .string()
    .optional()
    .describe('Thumbnail URL for media content'),
  duration_ms: z
    .number()
    .optional()
    .describe('Duration in milliseconds for video content'),
  text: z.string().optional().describe('Text content for text posts'),
  images: z
    .array(
      z.object({
        url: z.string().optional().describe('Image URL'),
        width: z.number().optional().describe('Image width'),
        height: z.number().optional().describe('Image height'),
      })
    )
    .optional()
    .describe('Array of image variants'),
});

// Output schema - each item is a search result post
export const LinkedInPostsSearchOutputSchema = z.object({
  activity_id: z.string().optional().describe('Post activity ID'),
  post_url: z.string().optional().describe('Post URL'),
  text: z.string().optional().describe('Post text content'),
  full_urn: z.string().optional().describe('Full post URN'),
  author: SearchAuthorSchema.optional().describe('Post author information'),
  stats: SearchStatsSchema.optional().describe('Post engagement statistics'),
  posted_at: SearchPostedAtSchema.optional().describe('When post was created'),
  hashtags: z.array(z.string()).optional().describe('Hashtags in the post'),
  content: SearchContentSchema.optional().describe('Post content details'),
  is_reshare: z.boolean().optional().describe('Whether this is a reshare'),
  metadata: SearchMetadataSchema.optional().describe(
    'Search pagination metadata'
  ),
  search_input: z.string().optional().describe('Original search keyword'),
});

// Export types
export type LinkedInPostsSearchInput = z.output<
  typeof LinkedInPostsSearchInputSchema
>;
export type LinkedInPostsSearchOutput = z.output<
  typeof LinkedInPostsSearchOutputSchema
>;
