import { z } from 'zod';

// ============================================================================
// INSTAGRAM SCRAPER SCHEMAS
// ============================================================================

export const InstagramScraperInputSchema = z.object({
  directUrls: z
    .array(z.string().url())
    .min(1, 'At least one Instagram URL is required')
    .describe(
      'Instagram profile URLs to scrape. Examples: ["https://www.instagram.com/username/"]'
    ),

  resultsType: z
    .enum(['posts', 'details'])
    .default('posts')
    .describe(
      'Type of results to fetch: "posts" for posts only, "details" for profile + posts'
    ),

  resultsLimit: z
    .number()
    .min(1)
    .max(200)
    .default(20)
    .describe('Maximum number of posts to fetch per profile (1-200)'),

  includeStories: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to include Instagram stories in results'),

  includeHighlights: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to include Instagram highlights in results'),
});

export const InstagramPostSchema = z.object({
  id: z.string().optional().describe('Post ID'),
  type: z
    .string()
    .optional()
    .describe('Post media type (Video, Image, Sidecar, etc)'),
  shortCode: z.string().optional().describe('Instagram short code'),
  caption: z.string().optional().describe('Post caption text'),
  hashtags: z.array(z.string()).optional().describe('Hashtags in the post'),
  mentions: z
    .array(z.string())
    .optional()
    .describe('User mentions in the post'),
  url: z.string().optional().describe('Post URL'),
  commentsCount: z.number().optional().describe('Number of comments'),
  dimensionsHeight: z.number().optional().describe('Media height in pixels'),
  dimensionsWidth: z.number().optional().describe('Media width in pixels'),
  displayUrl: z.string().optional().describe('Main display image URL'),
  images: z.array(z.string()).optional().describe('Array of image URLs'),
  videoUrl: z.string().optional().describe('Video URL if post is a video'),
  alt: z.string().nullable().optional().describe('Alt text for the media'),
  likesCount: z.number().optional().describe('Number of likes'),
  videoViewCount: z.number().optional().describe('Video view count'),
  timestamp: z.string().optional().describe('Post timestamp (ISO format)'),
  childPosts: z
    .array(z.unknown())
    .optional()
    .describe('Child posts for carousel'),
  ownerUsername: z.string().optional().describe('Post owner username'),
  ownerId: z.string().optional().describe('Post owner ID'),
  productType: z
    .string()
    .optional()
    .describe('Product type (clips, feed, igtv, etc)'),
  taggedUsers: z
    .array(
      z.object({
        full_name: z.string().optional(),
        id: z.string().optional(),
        is_verified: z.boolean().optional(),
        profile_pic_url: z.string().optional(),
        username: z.string().optional(),
      })
    )
    .optional()
    .describe('Tagged users in the post'),
  isCommentsDisabled: z
    .boolean()
    .optional()
    .describe('Whether comments are disabled'),
  location: z
    .object({
      name: z.string().optional(),
      id: z.string().optional(),
    })
    .nullable()
    .optional()
    .describe('Location information if available'),
});

// Single profile/item output schema (each item in the array)
export const InstagramScraperItemSchema = z.object({
  // Profile identifiers
  inputUrl: z.string().optional().describe('Original input URL'),
  id: z.string().optional().describe('Instagram user ID'),
  username: z.string().optional().describe('Instagram username'),
  url: z.string().optional().describe('Profile URL'),

  // Profile information
  fullName: z.string().optional().describe('Full name'),
  biography: z.string().optional().describe('Profile bio'),

  // External links
  externalUrls: z
    .array(
      z.object({
        title: z.string().optional(),
        lynx_url: z.string().optional(),
        url: z.string().optional(),
        link_type: z.string().optional(),
      })
    )
    .optional()
    .describe('Array of external URLs'),
  externalUrl: z.string().optional().describe('Primary external website URL'),
  externalUrlShimmed: z.string().optional().describe('Shimmed external URL'),

  // Follower statistics
  followersCount: z.number().optional().describe('Number of followers'),
  followsCount: z.number().optional().describe('Number of following'),
  postsCount: z.number().optional().describe('Total posts'),

  // Account properties
  hasChannel: z
    .boolean()
    .optional()
    .describe('Whether account has IGTV channel'),
  highlightReelCount: z
    .number()
    .optional()
    .describe('Number of highlight reels'),
  isBusinessAccount: z
    .boolean()
    .optional()
    .describe('Whether this is a business account'),
  joinedRecently: z
    .boolean()
    .optional()
    .describe('Whether user joined recently'),
  businessCategoryName: z
    .string()
    .optional()
    .describe('Business category name'),
  private: z.boolean().optional().describe('Whether profile is private'),
  verified: z.boolean().optional().describe('Verification status'),

  // Profile pictures
  profilePicUrl: z.string().optional().describe('Profile picture URL'),
  profilePicUrlHD: z
    .string()
    .optional()
    .describe('High-res profile picture URL'),

  // IGTV
  igtvVideoCount: z.number().optional().describe('Number of IGTV videos'),
  latestIgtvVideos: z
    .array(z.unknown())
    .optional()
    .describe('Latest IGTV videos'),

  // Related content
  relatedProfiles: z.array(z.unknown()).optional().describe('Related profiles'),

  // Posts (nested when resultsType is 'details')
  latestPosts: z
    .array(InstagramPostSchema)
    .optional()
    .describe('Latest posts from the profile'),

  // Stories (when includeStories is true)
  stories: z
    .array(
      z.object({
        url: z.string().optional(),
        timestamp: z.string().optional(),
        type: z.enum(['image', 'video']).optional(),
        viewsCount: z.number().optional(),
      })
    )
    .optional()
    .describe('Instagram stories'),

  // Highlights (when includeHighlights is true)
  highlights: z
    .array(
      z.object({
        title: z.string().optional(),
        coverUrl: z.string().optional(),
        itemsCount: z.number().optional(),
      })
    )
    .optional()
    .describe('Instagram highlights'),
});
