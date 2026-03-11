import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - Slab API Response Types
// ============================================================================

export const SlabUserSchema = z
  .object({
    id: z.string().describe('User identifier'),
    name: z.string().describe("User's name"),
  })
  .describe('Slab user');

export const SlabTopicSchema = z
  .object({
    id: z.string().describe('Topic identifier'),
    name: z.string().describe('Topic name'),
  })
  .describe('Slab topic (category for organizing posts)');

export const SlabPostSchema = z
  .object({
    id: z.string().describe('Post identifier'),
    title: z.string().describe('Post title'),
    content: z
      .unknown()
      .optional()
      .nullable()
      .describe('Post content in Quill Delta JSON format'),
    insertedAt: z
      .string()
      .optional()
      .nullable()
      .describe('ISO 8601 creation timestamp'),
    publishedAt: z
      .string()
      .optional()
      .nullable()
      .describe('ISO 8601 publication timestamp'),
    updatedAt: z
      .string()
      .optional()
      .nullable()
      .describe('ISO 8601 last update timestamp'),
    archivedAt: z
      .string()
      .optional()
      .nullable()
      .describe('ISO 8601 archive timestamp (null if not archived)'),
    owner: SlabUserSchema.optional()
      .nullable()
      .describe('User who owns the post'),
    version: z
      .number()
      .optional()
      .nullable()
      .describe('Content version number'),
    topics: z
      .array(SlabTopicSchema)
      .optional()
      .nullable()
      .describe('Topics this post belongs to'),
  })
  .describe('Slab post/article');

export const SlabSearchResultSchema = z
  .object({
    id: z.string().describe('Post identifier'),
    title: z.string().describe('Post title'),
    highlight: z
      .unknown()
      .optional()
      .nullable()
      .describe('Search result highlight/excerpt (JSON)'),
    content: z
      .unknown()
      .optional()
      .nullable()
      .describe('Matched content (JSON)'),
    insertedAt: z.string().optional().nullable().describe('Creation timestamp'),
    publishedAt: z
      .string()
      .optional()
      .nullable()
      .describe('Publication timestamp'),
    owner: SlabUserSchema.optional().nullable().describe('Post owner'),
    topics: z
      .array(SlabTopicSchema)
      .optional()
      .nullable()
      .describe('Associated topics'),
  })
  .describe('Slab search result entry');

// ============================================================================
// PARAMETER SCHEMAS - Discriminated Union for Multiple Operations
// ============================================================================

export const SlabParamsSchema = z.discriminatedUnion('operation', [
  // Search posts
  z.object({
    operation: z
      .literal('search_posts')
      .describe('Search posts across the Slab workspace'),
    query: z
      .string()
      .min(1, 'Search query is required')
      .describe('Search query string'),
    first: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Number of results to return (1-100, default 20)'),
    after: z
      .string()
      .optional()
      .describe('Cursor for pagination (from previous search result)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get a single post
  z.object({
    operation: z.literal('get_post').describe('Get a specific post by ID'),
    post_id: z
      .string()
      .min(1, 'Post ID is required')
      .describe('The ID of the post to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List organization posts
  z.object({
    operation: z
      .literal('list_posts')
      .describe('List all posts in the organization'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get posts in a topic
  z.object({
    operation: z
      .literal('get_topic_posts')
      .describe('Get all posts within a specific topic'),
    topic_id: z
      .string()
      .min(1, 'Topic ID is required')
      .describe('The ID of the topic'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List all topics
  z.object({
    operation: z
      .literal('list_topics')
      .describe('List all topics in the organization'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// ============================================================================
// RESULT SCHEMAS - Discriminated Union for Operation Results
// ============================================================================

export const SlabResultSchema = z.discriminatedUnion('operation', [
  // Search posts result
  z.object({
    operation: z.literal('search_posts').describe('Search posts operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    posts: z
      .array(SlabSearchResultSchema)
      .optional()
      .describe('Search result posts'),
    has_more: z
      .boolean()
      .optional()
      .describe('Whether more results are available'),
    end_cursor: z
      .string()
      .optional()
      .nullable()
      .describe('Cursor for fetching the next page'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get post result
  z.object({
    operation: z.literal('get_post').describe('Get post operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    post: SlabPostSchema.optional().describe('Post details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List posts result
  z.object({
    operation: z.literal('list_posts').describe('List posts operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    posts: z
      .array(SlabPostSchema)
      .optional()
      .describe('List of organization posts'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get topic posts result
  z.object({
    operation: z
      .literal('get_topic_posts')
      .describe('Get topic posts operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    posts: z.array(SlabPostSchema).optional().describe('Posts in the topic'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List topics result
  z.object({
    operation: z.literal('list_topics').describe('List topics operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    topics: z
      .array(SlabTopicSchema)
      .optional()
      .describe('List of organization topics'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type SlabParamsInput = z.input<typeof SlabParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation/transformation)
export type SlabParams = z.output<typeof SlabParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type SlabResult = z.output<typeof SlabResultSchema>;

// Data types
export type SlabUser = z.output<typeof SlabUserSchema>;
export type SlabTopic = z.output<typeof SlabTopicSchema>;
export type SlabPost = z.output<typeof SlabPostSchema>;
export type SlabSearchResult = z.output<typeof SlabSearchResultSchema>;

// Operation-specific types (for internal method parameters)
export type SlabSearchPostsParams = Extract<
  SlabParams,
  { operation: 'search_posts' }
>;
export type SlabGetPostParams = Extract<SlabParams, { operation: 'get_post' }>;
export type SlabListPostsParams = Extract<
  SlabParams,
  { operation: 'list_posts' }
>;
export type SlabGetTopicPostsParams = Extract<
  SlabParams,
  { operation: 'get_topic_posts' }
>;
export type SlabListTopicsParams = Extract<
  SlabParams,
  { operation: 'list_topics' }
>;
