import { z } from 'zod';

// ============================================================================
// LINKEDIN PROFILE POSTS SCRAPER SCHEMAS
// ============================================================================

export const LinkedInProfilePostsInputSchema = z.object({
  username: z
    .string()
    .min(1, 'LinkedIn username is required')
    .describe('LinkedIn username (without @)'),

  page_number: z
    .number()
    .min(1)
    .default(1)
    .optional()
    .describe('Page number for pagination (default: 1)'),

  limit: z
    .number()
    .min(1)
    .max(100)
    .default(100)
    .optional()
    .describe('Maximum number of posts to fetch (default: 100)'),
});

// LinkedIn Post Author Schema
const LinkedInAuthorSchema = z.object({
  first_name: z.string().optional().describe('Author first name'),
  last_name: z.string().optional().describe('Author last name'),
  headline: z.string().optional().describe('Author headline/title'),
  username: z.string().optional().describe('Author username'),
  profile_url: z.string().optional().describe('Author profile URL'),
  profile_picture: z.string().optional().describe('Author profile picture URL'),
});

// LinkedIn Post Stats Schema
const LinkedInStatsSchema = z.object({
  total_reactions: z.number().optional().describe('Total number of reactions'),
  like: z.number().optional().describe('Number of likes'),
  support: z.number().optional().describe('Number of support reactions'),
  love: z.number().optional().describe('Number of love reactions'),
  insight: z.number().optional().describe('Number of insight reactions'),
  celebrate: z.number().optional().describe('Number of celebrate reactions'),
  comments: z.number().optional().describe('Number of comments'),
  reposts: z.number().optional().describe('Number of reposts'),
});

// LinkedIn Post Media Schema
const LinkedInMediaSchema = z.object({
  type: z.string().optional().describe('Media type (image, video, images)'),
  url: z.string().optional().describe('Media URL'),
  thumbnail: z.string().optional().describe('Media thumbnail URL'),
  images: z
    .array(
      z.object({
        url: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .optional()
    .describe('Array of images for multi-image posts'),
});

// LinkedIn Article Schema
const LinkedInArticleSchema = z.object({
  url: z.string().optional().describe('Article URL'),
  title: z.string().optional().describe('Article title'),
  subtitle: z.string().optional().describe('Article subtitle'),
  thumbnail: z.string().optional().describe('Article thumbnail URL'),
});

// LinkedIn Document Schema
const LinkedInDocumentSchema = z.object({
  title: z.string().optional().describe('Document title'),
  page_count: z.number().optional().describe('Number of pages in document'),
  url: z.string().optional().describe('Document URL'),
  thumbnail: z.string().optional().describe('Document thumbnail URL'),
});

// LinkedIn Posted At Schema
const LinkedInPostedAtSchema = z.object({
  date: z.string().optional().describe('Post date (formatted string)'),
  relative: z
    .string()
    .optional()
    .describe('Relative time (e.g., "2 days ago")'),
  timestamp: z.number().optional().describe('Unix timestamp in milliseconds'),
});

// LinkedIn Reshared Post Schema (recursive)
const LinkedInResharedPostSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    urn: z.string().optional().describe('Post URN'),
    posted_at: LinkedInPostedAtSchema.optional().describe(
      'When post was created'
    ),
    text: z.string().optional().describe('Post text content'),
    url: z.string().optional().describe('Post URL'),
    post_type: z
      .string()
      .optional()
      .describe('Post type (regular, quote, etc)'),
    author: LinkedInAuthorSchema.optional().describe('Post author information'),
    stats: LinkedInStatsSchema.optional().describe(
      'Post engagement statistics'
    ),
    media: LinkedInMediaSchema.optional().describe('Post media content'),
  })
);

// LinkedIn Post Schema
const LinkedInPostSchema = z.object({
  urn: z.string().optional().describe('Post URN'),
  full_urn: z.string().optional().describe('Full URN with prefix'),
  posted_at: LinkedInPostedAtSchema.optional().describe(
    'When post was created'
  ),
  text: z.string().optional().describe('Post text content'),
  url: z.string().optional().describe('Post URL'),
  post_type: z.string().optional().describe('Post type (regular, quote, etc)'),
  author: LinkedInAuthorSchema.optional().describe('Post author information'),
  stats: LinkedInStatsSchema.optional().describe('Post engagement statistics'),
  media: LinkedInMediaSchema.optional().describe('Post media content'),
  article: LinkedInArticleSchema.optional().describe(
    'Shared article information'
  ),
  document: LinkedInDocumentSchema.optional().describe(
    'Shared document information'
  ),
  reshared_post: LinkedInResharedPostSchema.optional().describe(
    'Original post that was reshared'
  ),
});

// Output schema - what the actor returns (each item is a post with pagination token)
export const LinkedInProfilePostsOutputSchema = LinkedInPostSchema;

// Export type for use in the tool
export type LinkedInPost = z.output<typeof LinkedInPostSchema>;
export type LinkedInAuthor = z.output<typeof LinkedInAuthorSchema>;
export type LinkedInStats = z.output<typeof LinkedInStatsSchema>;
export type LinkedInPostedAt = z.output<typeof LinkedInPostedAtSchema>;
