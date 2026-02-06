import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

// Credentials field (common across all operations)
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credentials (injected at runtime)');

// ============================================================================
// DATA SCHEMAS (for results)
// ============================================================================

export const ConfluenceSpaceSchema = z
  .object({
    id: z.string().describe('Space ID'),
    key: z.string().describe('Space key'),
    name: z.string().describe('Space name'),
    type: z
      .string()
      .optional()
      .describe('Space type (e.g., "global", "personal")'),
    status: z.string().optional().describe('Space status'),
    description: z
      .unknown()
      .optional()
      .describe('Space description (string or structured object)'),
    homepageId: z.string().nullable().optional().describe('Homepage ID'),
  })
  .passthrough()
  .describe('Confluence space');

export const ConfluencePageSchema = z
  .object({
    id: z.string().describe('Page ID'),
    title: z.string().describe('Page title'),
    status: z
      .string()
      .optional()
      .describe('Page status (current, draft, trashed)'),
    spaceId: z.string().optional().describe('Space ID the page belongs to'),
    parentId: z.string().nullable().optional().describe('Parent page ID'),
    parentType: z.string().nullable().optional().describe('Parent type'),
    authorId: z.string().optional().describe('Author account ID'),
    createdAt: z.string().optional().describe('Creation timestamp'),
    version: z
      .object({
        number: z.number().describe('Version number'),
        message: z.string().optional().describe('Version message'),
        createdAt: z.string().optional().describe('Version creation timestamp'),
      })
      .passthrough()
      .optional()
      .describe('Version information'),
    body: z
      .object({
        storage: z
          .object({
            value: z.string().describe('Page body in storage format (XHTML)'),
            representation: z.string().optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional()
      .describe('Page body content'),
    _links: z
      .object({
        webui: z.string().optional().describe('Web UI link to the page'),
      })
      .passthrough()
      .optional()
      .describe('Links'),
  })
  .passthrough()
  .describe('Confluence page');

export const ConfluenceCommentSchema = z
  .object({
    id: z.string().describe('Comment ID'),
    title: z.string().optional().describe('Comment title'),
    body: z
      .object({
        storage: z
          .object({
            value: z.string().describe('Comment body in storage format'),
            representation: z.string().optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional()
      .describe('Comment body'),
    version: z
      .object({
        number: z.number().describe('Version number'),
        createdAt: z.string().optional().describe('Version creation timestamp'),
      })
      .passthrough()
      .optional()
      .describe('Version information'),
    createdAt: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('Confluence comment');

export const ConfluenceSearchResultSchema = z
  .object({
    id: z.string().optional().describe('Page ID'),
    type: z.string().optional().describe('Content type (page, blogpost, etc.)'),
    title: z.string().optional().describe('Page title'),
    status: z.string().optional().describe('Page status'),
    excerpt: z.string().optional().describe('Search result excerpt'),
    url: z.string().optional().describe('Result URL'),
    lastModified: z.string().optional().describe('Last modified timestamp'),
    _links: z
      .object({
        webui: z.string().optional(),
      })
      .passthrough()
      .optional()
      .describe('Links'),
    content: z
      .object({
        id: z.string().optional(),
        type: z.string().optional(),
        title: z.string().optional(),
        status: z.string().optional(),
        _links: z
          .object({
            webui: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional()
      .describe('Raw content object (same data also available at top level)'),
  })
  .passthrough()
  .describe(
    'Confluence search result (normalized: id, title, status available at top level)'
  );

// ============================================================================
// PARAMETERS SCHEMA (discriminated union)
// ============================================================================

export const ConfluenceParamsSchema = z.discriminatedUnion('operation', [
  // -------------------------------------------------------------------------
  // OPERATION 1: list_spaces
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_spaces').describe('List Confluence spaces'),

    limit: z
      .number()
      .min(1)
      .max(250)
      .optional()
      .default(25)
      .describe('Maximum number of spaces to return (1-250)'),

    cursor: z
      .string()
      .optional()
      .describe('Cursor for pagination (from previous response)'),

    type: z
      .enum(['global', 'personal'])
      .optional()
      .describe(
        'Filter by space type. Omit to list all spaces (recommended). Most Confluence sites use personal spaces, so filtering by "global" may return no results.'
      ),

    status: z
      .enum(['current', 'archived'])
      .optional()
      .describe('Filter by space status'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 2: get_space
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_space').describe('Get a specific space by ID'),

    space_id: z
      .string()
      .min(1, 'Space ID is required')
      .describe('Space ID to retrieve'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 3: list_pages
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_pages')
      .describe('List pages with optional filtering'),

    space_id: z
      .string()
      .optional()
      .describe('Filter by space ID (numeric ID from list_spaces)'),

    space_key: z
      .string()
      .optional()
      .describe(
        'Filter by space key (e.g., "DEV", "HR"). Alternative to space_id — provide either one.'
      ),

    title: z.string().optional().describe('Filter by exact page title'),

    status: z
      .enum(['current', 'trashed', 'draft'])
      .optional()
      .describe('Filter by page status. Default: current'),

    limit: z
      .number()
      .min(1)
      .max(250)
      .optional()
      .default(25)
      .describe('Maximum number of pages to return (1-250)'),

    cursor: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 4: get_page
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_page')
      .describe('Get a specific page by ID with body content'),

    page_id: z
      .string()
      .min(1, 'Page ID is required')
      .describe('Page ID to retrieve'),

    include_body: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to include the page body content. Default: true'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 5: create_page
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('create_page')
      .describe('Create a new page in a space'),

    space_id: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Space ID to create the page in (numeric ID from list_spaces). Provide either space_id or space_key.'
      ),

    space_key: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Space key to create the page in (e.g., "DEV", "HR"). Alternative to space_id.'
      ),

    title: z.string().min(1, 'Title is required').describe('Page title'),

    body: z
      .string()
      .optional()
      .describe(
        'Page body content (markdown - auto-converted to Confluence storage format)'
      ),

    parent_id: z
      .string()
      .optional()
      .describe('Parent page ID (creates as child page)'),

    status: z
      .enum(['current', 'draft'])
      .optional()
      .default('current')
      .describe('Page status. Default: current (published)'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 6: update_page
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('update_page')
      .describe('Update an existing page (auto-increments version)'),

    page_id: z
      .string()
      .min(1, 'Page ID is required')
      .describe('Page ID to update'),

    title: z
      .string()
      .optional()
      .describe('New page title (uses current title if not specified)'),

    body: z
      .string()
      .optional()
      .describe(
        'New page body (markdown - auto-converted to Confluence storage format). If omitted, the existing body is preserved.'
      ),

    status: z.enum(['current', 'draft']).optional().describe('New page status'),

    version_message: z
      .string()
      .optional()
      .describe('Version comment describing the changes'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 7: delete_page
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('delete_page').describe('Delete (trash) a page'),

    page_id: z
      .string()
      .min(1, 'Page ID is required')
      .describe('Page ID to delete'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 8: search
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('search')
      .describe('Search Confluence content using CQL'),

    cql: z
      .string()
      .min(1, 'CQL query is required')
      .describe(
        'CQL (Confluence Query Language) query string. Examples: \'type=page AND space=DEV\', \'type=page AND title="My Page"\', \'text~"search term"\', \'type=page ORDER BY created DESC\'. Note: reserved words like "null", "and", "or" must be quoted if used as values. IMPORTANT: Confluence search has an indexing delay — newly created or updated pages may not appear in CQL search results for several minutes. Use list_pages to find recently created pages instead.'
      ),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Maximum number of results to return (1-100)'),

    start: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Starting index for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 9: add_comment
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('add_comment')
      .describe('Add a footer comment to a page'),

    page_id: z
      .string()
      .min(1, 'Page ID is required')
      .describe('Page ID to add the comment to'),

    body: z
      .string()
      .min(1, 'Comment body is required')
      .describe(
        'Comment text (markdown - auto-converted to Confluence storage format)'
      ),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // OPERATION 10: get_comments
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('get_comments')
      .describe('List footer comments for a page'),

    page_id: z
      .string()
      .min(1, 'Page ID is required')
      .describe('Page ID to get comments for'),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Maximum number of comments to return'),

    cursor: z.string().optional().describe('Cursor for pagination'),

    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

export const ConfluenceResultSchema = z.discriminatedUnion('operation', [
  // list_spaces result
  z.object({
    operation: z.literal('list_spaces'),
    success: z.boolean(),
    spaces: z.array(ConfluenceSpaceSchema).optional(),
    cursor: z.string().optional().describe('Next page cursor'),
    error: z.string(),
  }),

  // get_space result
  z.object({
    operation: z.literal('get_space'),
    success: z.boolean(),
    space: ConfluenceSpaceSchema.optional(),
    error: z.string(),
  }),

  // list_pages result
  z.object({
    operation: z.literal('list_pages'),
    success: z.boolean(),
    pages: z.array(ConfluencePageSchema).optional(),
    cursor: z.string().optional().describe('Next page cursor'),
    error: z.string(),
  }),

  // get_page result
  z.object({
    operation: z.literal('get_page'),
    success: z.boolean(),
    page: ConfluencePageSchema.optional(),
    error: z.string(),
  }),

  // create_page result
  z.object({
    operation: z.literal('create_page'),
    success: z.boolean(),
    page: z
      .object({
        id: z.string(),
        title: z.string(),
        status: z.string().optional(),
        _links: z
          .object({
            webui: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .optional(),
    error: z.string(),
  }),

  // update_page result
  z.object({
    operation: z.literal('update_page'),
    success: z.boolean(),
    page: z
      .object({
        id: z.string(),
        title: z.string(),
        version: z
          .object({
            number: z.number(),
          })
          .passthrough()
          .optional(),
      })
      .optional(),
    error: z.string(),
  }),

  // delete_page result
  z.object({
    operation: z.literal('delete_page'),
    success: z.boolean(),
    page_id: z.string().optional(),
    error: z.string(),
  }),

  // search result
  z.object({
    operation: z.literal('search'),
    success: z.boolean(),
    results: z.array(ConfluenceSearchResultSchema).optional(),
    total: z.number().optional(),
    start: z.number().optional(),
    limit: z.number().optional(),
    error: z.string(),
  }),

  // add_comment result
  z.object({
    operation: z.literal('add_comment'),
    success: z.boolean(),
    comment: ConfluenceCommentSchema.optional(),
    error: z.string(),
  }),

  // get_comments result
  z.object({
    operation: z.literal('get_comments'),
    success: z.boolean(),
    comments: z.array(ConfluenceCommentSchema).optional(),
    cursor: z.string().optional(),
    error: z.string(),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ConfluenceParams = z.output<typeof ConfluenceParamsSchema>;
export type ConfluenceParamsInput = z.input<typeof ConfluenceParamsSchema>;
export type ConfluenceResult = z.output<typeof ConfluenceResultSchema>;

// Operation-specific parameter types
export type ConfluenceListSpacesParams = Extract<
  ConfluenceParams,
  { operation: 'list_spaces' }
>;
export type ConfluenceGetSpaceParams = Extract<
  ConfluenceParams,
  { operation: 'get_space' }
>;
export type ConfluenceListPagesParams = Extract<
  ConfluenceParams,
  { operation: 'list_pages' }
>;
export type ConfluenceGetPageParams = Extract<
  ConfluenceParams,
  { operation: 'get_page' }
>;
export type ConfluenceCreatePageParams = Extract<
  ConfluenceParams,
  { operation: 'create_page' }
>;
export type ConfluenceUpdatePageParams = Extract<
  ConfluenceParams,
  { operation: 'update_page' }
>;
export type ConfluenceDeletePageParams = Extract<
  ConfluenceParams,
  { operation: 'delete_page' }
>;
export type ConfluenceSearchParams = Extract<
  ConfluenceParams,
  { operation: 'search' }
>;
export type ConfluenceAddCommentParams = Extract<
  ConfluenceParams,
  { operation: 'add_comment' }
>;
export type ConfluenceGetCommentsParams = Extract<
  ConfluenceParams,
  { operation: 'get_comments' }
>;
