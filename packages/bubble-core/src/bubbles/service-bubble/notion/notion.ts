import { z } from 'zod';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { DataSourcePropertySchema } from './property-schemas.js';

// Notion API base URL
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2025-09-03';

// Rich text schema
const RichTextSchema = z.object({
  type: z.enum(['text', 'mention', 'equation']).describe('Type of rich text'),
  text: z
    .object({
      content: z.string().describe('The actual text content'),
      link: z
        .object({
          url: z.string().url().describe('URL for the link'),
        })
        .nullable()
        .optional()
        .describe('Optional link object'),
    })
    .optional()
    .describe('Text object (when type is "text")'),
  annotations: z
    .object({
      bold: z.boolean().default(false).describe('Whether text is bolded'),
      italic: z.boolean().default(false).describe('Whether text is italicized'),
      strikethrough: z
        .boolean()
        .default(false)
        .describe('Whether text is struck through'),
      underline: z
        .boolean()
        .default(false)
        .describe('Whether text is underlined'),
      code: z.boolean().default(false).describe('Whether text is code style'),
      color: z
        .enum([
          'default',
          'gray',
          'brown',
          'orange',
          'yellow',
          'green',
          'blue',
          'purple',
          'pink',
          'red',
        ])
        .default('default')
        .describe('Color of the text'),
    })
    .optional()
    .describe('Styling information for the rich text'),
  plain_text: z.string().optional().describe('Plain text without annotations'),
  href: z.string().nullable().optional().describe('URL of any link'),
});

// File object schema
const FileObjectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file').describe('Notion-hosted file type'),
    file: z
      .object({
        url: z
          .string()
          .url()
          .describe('Authenticated HTTP GET URL to the file'),
        expiry_time: z
          .string()
          .describe('ISO 8601 date time when the link expires'),
      })
      .describe('File object for Notion-hosted files'),
  }),
  z.object({
    type: z.literal('file_upload').describe('File uploaded via API type'),
    file_upload: z
      .object({
        id: z.string().describe('ID of a File Upload object'),
      })
      .describe('File upload object'),
  }),
  z.object({
    type: z.literal('external').describe('External file type'),
    external: z
      .object({
        url: z.string().url().describe('Link to externally hosted content'),
      })
      .describe('External file object'),
  }),
]);

// Icon schema (emoji or file)
const IconSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('emoji').describe('Emoji icon'),
    emoji: z.string().describe('Emoji character'),
  }),
  z.object({
    type: z.literal('external').describe('External icon'),
    external: z.object({
      url: z.string().url().describe('URL of the external icon'),
    }),
  }),
  z.object({
    type: z.literal('file').describe('File icon'),
    file: z.object({
      url: z.string().url().describe('URL of the file icon'),
      expiry_time: z.string().describe('Expiry time of the URL'),
    }),
  }),
]);

// User object schema
const UserSchema = z.object({
  object: z.literal('user').describe('Object type'),
  id: z.string().describe('User ID'),
  type: z.enum(['person', 'bot']).optional().describe('User type'),
  name: z.string().optional().describe('User name'),
  avatar_url: z.string().nullable().optional().describe('Avatar URL'),
  person: z
    .object({
      email: z.string().email().optional().describe('Email address'),
    })
    .optional()
    .describe('Person details'),
  bot: z
    .object({
      owner: z
        .object({
          type: z.enum(['workspace', 'user']).describe('Owner type'),
          workspace: z.boolean().optional(),
        })
        .optional(),
      workspace_name: z.string().optional().describe('Workspace name'),
    })
    .optional()
    .describe('Bot details'),
});

// Parent object schema
const ParentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('page_id').describe('Parent is a page'),
    page_id: z.string().describe('ID of the parent page'),
  }),
  z.object({
    type: z.literal('database_id').describe('Parent is a database'),
    database_id: z.string().describe('ID of the parent database'),
  }),
  z.object({
    type: z.literal('data_source_id').describe('Parent is a data source'),
    data_source_id: z.string().describe('ID of the parent data source'),
    database_id: z.string().optional().describe('ID of the database'),
  }),
  z.object({
    type: z.literal('block_id').describe('Parent is a block'),
    block_id: z.string().describe('ID of the parent block'),
  }),
  z.object({
    type: z.literal('workspace').describe('Parent is the workspace'),
    workspace: z.literal(true).describe('Workspace parent'),
  }),
]);

// Page property value base schema (simplified - full schema would be very complex)
const PagePropertyValueSchema = z
  .record(z.string(), z.unknown())
  .describe('Page properties object containing various property types');

// Page object response schema
const PageObjectSchema = z.object({
  object: z.literal('page').describe('Object type'),
  id: z.string().describe('Page ID'),
  created_time: z.string().describe('ISO 8601 datetime'),
  last_edited_time: z.string().describe('ISO 8601 datetime'),
  created_by: UserSchema.describe('User who created the page'),
  last_edited_by: UserSchema.describe('User who last edited the page'),
  cover: FileObjectSchema.nullable().optional().describe('Page cover image'),
  icon: IconSchema.nullable().optional().describe('Page icon'),
  parent: ParentSchema.describe('Parent of the page'),
  archived: z.boolean().describe('Whether the page is archived'),
  in_trash: z.boolean().optional().describe('Whether the page is in trash'),
  properties: PagePropertyValueSchema.describe('Page properties'),
  url: z.string().url().describe('Public URL of the page'),
  public_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .describe('Public shareable URL'),
});

// Block object response schema (simplified)
const BlockObjectSchema = z
  .object({
    object: z.literal('block').describe('Object type'),
    id: z.string().describe('Block ID'),
    parent: ParentSchema.optional().describe('Parent of the block'),
    created_time: z.string().describe('ISO 8601 datetime'),
    last_edited_time: z.string().describe('ISO 8601 datetime'),
    created_by: UserSchema.describe('User who created the block'),
    last_edited_by: UserSchema.describe('User who last edited the block'),
    has_children: z.boolean().describe('Whether the block has children'),
    archived: z.boolean().describe('Whether the block is archived'),
    in_trash: z.boolean().optional().describe('Whether block is in trash'),
    type: z
      .string()
      .describe('Type of block (e.g., paragraph, heading_2, etc.)'),
    // Block type-specific properties would be dynamic based on 'type'
  })
  .passthrough()
  .describe('Block object with type-specific properties');

// Data source object response schema
const DataSourceObjectSchema = z.object({
  object: z.literal('data_source').describe('Object type'),
  id: z.string().describe('Data source ID'),
  created_time: z.string().describe('ISO 8601 datetime'),
  last_edited_time: z.string().describe('ISO 8601 datetime'),
  properties: z
    .record(z.string(), DataSourcePropertySchema)
    .describe('Data source properties'),
  parent: z
    .object({
      type: z.literal('database_id'),
      database_id: z.string(),
    })
    .describe('Parent database'),
  archived: z.boolean().describe('Whether the data source is archived'),
  in_trash: z.boolean().optional().describe('Whether data source is in trash'),
  is_inline: z.boolean().optional().describe('Whether displayed inline'),
  icon: IconSchema.nullable().optional().describe('Data source icon'),
  cover: FileObjectSchema.nullable().optional().describe('Data source cover'),
  title: z.array(RichTextSchema).describe('Data source title'),
  description: z
    .array(RichTextSchema)
    .optional()
    .describe('Data source description'),
});

// Database object response schema
const DatabaseObjectSchema = z.object({
  object: z.literal('database').describe('Object type'),
  id: z.string().describe('Database ID'),
  created_time: z.string().describe('ISO 8601 datetime'),
  last_edited_time: z.string().describe('ISO 8601 datetime'),
  title: z.array(RichTextSchema).describe('Database title'),
  description: z
    .array(RichTextSchema)
    .optional()
    .describe('Database description'),
  icon: IconSchema.nullable().optional().describe('Database icon'),
  cover: FileObjectSchema.nullable().optional().describe('Database cover'),
  parent: ParentSchema.describe('Parent of the database'),
  is_inline: z.boolean().optional().describe('Whether displayed inline'),
  in_trash: z.boolean().optional().describe('Whether in trash'),
  is_locked: z.boolean().optional().describe('Whether locked from editing'),
  data_sources: z
    .array(
      z.object({
        id: z.string().describe('Data source ID'),
        name: z.string().describe('Data source name'),
        icon: IconSchema.nullable().optional(),
        cover: FileObjectSchema.nullable().optional(),
      })
    )
    .describe('Array of data sources in this database'),
  url: z.string().url().optional().describe('URL of the database'),
  public_url: z.string().url().nullable().optional(),
});

// Comment object response schema
const CommentObjectSchema = z.object({
  object: z.literal('comment').describe('Object type'),
  id: z.string().describe('Comment ID'),
  parent: z
    .object({
      type: z.enum(['page_id', 'block_id']),
      page_id: z.string().optional(),
      block_id: z.string().optional(),
    })
    .passthrough()
    .describe('Parent page or block'),
  discussion_id: z.string().describe('Discussion thread ID'),
  created_time: z.string().describe('ISO 8601 datetime'),
  last_edited_time: z.string().describe('ISO 8601 datetime'),
  created_by: UserSchema.describe('User who created the comment'),
  rich_text: z.array(RichTextSchema).describe('Comment content'),
});

// List response schema (generic)
const ListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    object: z.literal('list').describe('Object type'),
    results: z.array(itemSchema).describe('Array of results'),
    next_cursor: z.string().nullable().describe('Cursor for pagination'),
    has_more: z.boolean().describe('Whether more results exist'),
    type: z.string().optional().describe('Type of objects in results'),
  });

// Define the parameters schema for different Notion operations
const NotionParamsSchema = z.discriminatedUnion('operation', [
  // Create page operation
  z.object({
    operation: z.literal('create_page').describe('Create a new page in Notion'),
    parent: ParentSchema.describe('Parent page, database, or workspace'),
    properties: z
      .record(z.unknown())
      .optional()
      .describe('Page properties (required if parent is a data source)'),
    children: z
      .array(z.unknown())
      .optional()
      .describe('Array of block objects for page content'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string().describe('Emoji character'),
      })
    )
      .optional()
      .describe('Page icon (emoji or file)'),
    cover: FileObjectSchema.optional().describe('Page cover image'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Retrieve page operation
  z.object({
    operation: z.literal('retrieve_page').describe('Retrieve a page by its ID'),
    page_id: z.string().describe('UUID of the Notion page'),
    filter_properties: z
      .array(z.string())
      .optional()
      .describe('Limit response to specific property IDs'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Update page operation
  z.object({
    operation: z.literal('update_page').describe('Update an existing page'),
    page_id: z.string().describe('UUID of the Notion page'),
    properties: z
      .record(z.unknown())
      .optional()
      .describe('Page properties to update'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string(),
      })
    )
      .nullable()
      .optional()
      .describe('Page icon (emoji or file, null to remove)'),
    cover: FileObjectSchema.nullable()
      .optional()
      .describe('Page cover image (null to remove)'),
    archived: z
      .boolean()
      .optional()
      .describe('Set to true to archive the page'),
    in_trash: z
      .boolean()
      .optional()
      .describe('Set to true to move page to trash'),
    is_locked: z
      .boolean()
      .optional()
      .describe('Control if page can be edited in Notion UI'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Retrieve database operation
  z.object({
    operation: z
      .literal('retrieve_database')
      .describe('Retrieve a database by its ID'),
    database_id: z.string().describe('UUID of the Notion database'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Query data source operation
  z.object({
    operation: z
      .literal('query_data_source')
      .describe('Query a data source to retrieve pages'),
    data_source_id: z.string().describe('UUID of the Notion data source'),
    filter: z.unknown().optional().describe('Filter object for querying'),
    sorts: z.array(z.unknown()).optional().describe('Array of sort objects'),
    start_cursor: z.string().optional().describe('Cursor for pagination'),
    page_size: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Number of results per page (1-100)'),
    filter_properties: z
      .array(z.string())
      .optional()
      .describe('Limit response to specific property IDs'),
    result_type: z
      .enum(['page', 'data_source'])
      .optional()
      .describe('Filter results to page or data_source'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Create data source operation
  z.object({
    operation: z
      .literal('create_data_source')
      .describe('Create a new data source in an existing database'),
    parent: z
      .object({
        type: z.literal('database_id').describe('Parent type'),
        database_id: z.string().describe('ID of the parent database'),
      })
      .describe('Parent database for the new data source'),
    properties: z
      .record(z.unknown())
      .describe(
        'Property schema for the data source (hash map where keys are property names)'
      ),
    title: z
      .array(RichTextSchema)
      .optional()
      .describe('Title of the data source'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string().describe('Emoji character'),
      })
    )
      .optional()
      .describe('Data source icon'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Update data source operation
  z.object({
    operation: z.literal('update_data_source').describe('Update a data source'),
    data_source_id: z.string().describe('UUID of the Notion data source'),
    properties: z
      .record(z.unknown())
      .optional()
      .describe('Property schema updates'),
    title: z.array(RichTextSchema).optional().describe('Updated title'),
    description: z
      .array(RichTextSchema)
      .optional()
      .describe('Updated description'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string().describe('Emoji character'),
      })
    )
      .nullable()
      .optional()
      .describe('Updated icon (null to remove)'),
    in_trash: z.boolean().optional().describe('Set to true to move to trash'),
    parent: z
      .object({
        type: z.literal('database_id'),
        database_id: z.string().describe('ID of the destination database'),
      })
      .optional()
      .describe('New parent database to move data source'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Create database operation
  z.object({
    operation: z.literal('create_database').describe('Create a new database'),
    parent: z
      .object({
        type: z.enum(['page_id', 'workspace']).describe('Type of parent'),
        page_id: z
          .string()
          .optional()
          .describe('ID of parent page (required if type is page_id)'),
        workspace: z
          .literal(true)
          .optional()
          .describe('Workspace parent (required if type is workspace)'),
      })
      .refine(
        (data) => {
          if (data.type === 'page_id') {
            return !!data.page_id;
          }
          if (data.type === 'workspace') {
            return data.workspace === true;
          }
          return false;
        },
        {
          message:
            'page_id is required when type is page_id, or workspace must be true when type is workspace',
        }
      )
      .transform((data) => {
        if (data.type === 'workspace') {
          return { type: 'workspace' as const, workspace: true };
        }
        return { type: 'page_id' as const, page_id: data.page_id! };
      })
      .describe('Parent page or workspace'),
    initial_data_source: z
      .object({
        properties: z
          .record(z.unknown())
          .describe(
            'Property schema for the data source (hash map where keys are property names)'
          ),
      })
      .describe('Initial data source configuration'),
    title: z.array(RichTextSchema).optional().describe('Title of the database'),
    description: z
      .array(RichTextSchema)
      .optional()
      .describe('Description of the database'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string(),
      })
    )
      .optional()
      .describe('Database icon'),
    cover: FileObjectSchema.optional().describe('Database cover image'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Update database operation
  z.object({
    operation: z.literal('update_database').describe('Update a database'),
    database_id: z.string().describe('UUID of the Notion database'),
    title: z.array(RichTextSchema).optional().describe('Updated title'),
    description: z
      .array(RichTextSchema)
      .optional()
      .describe('Updated description'),
    icon: FileObjectSchema.or(
      z.object({
        type: z.literal('emoji'),
        emoji: z.string(),
      })
    )
      .nullable()
      .optional()
      .describe('Updated icon (null to remove)'),
    cover: FileObjectSchema.nullable()
      .optional()
      .describe('Updated cover (null to remove)'),
    parent: ParentSchema.optional().describe('New parent to move database'),
    is_inline: z
      .boolean()
      .optional()
      .describe('Whether database should be displayed inline'),
    in_trash: z.boolean().optional().describe('Set to true to move to trash'),
    is_locked: z
      .boolean()
      .optional()
      .describe('Set to true to lock from editing'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Append block children operation
  z.object({
    operation: z
      .literal('append_block_children')
      .describe('Append children blocks to a parent block or page'),
    block_id: z.string().describe('UUID of the parent block or page'),
    children: z
      .array(z.unknown())
      .min(1)
      .max(100)
      .describe('Array of block objects to append (max 100)'),
    after: z.string().optional().describe('ID of block to append after'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Retrieve block children operation
  z.object({
    operation: z
      .literal('retrieve_block_children')
      .describe('Retrieve children blocks of a parent block'),
    block_id: z.string().describe('UUID of the parent block'),
    start_cursor: z.string().optional().describe('Cursor for pagination'),
    page_size: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Number of items per response (max 100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Retrieve block operation
  z.object({
    operation: z
      .literal('retrieve_block')
      .describe('Retrieve a block by its ID'),
    block_id: z.string().describe('UUID of the Notion block'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Update block operation
  z.object({
    operation: z.literal('update_block').describe('Update a block'),
    block_id: z.string().describe('UUID of the Notion block'),
    archived: z
      .boolean()
      .optional()
      .describe('Set to true to archive the block'),
    // Block type-specific fields would go here (e.g., heading_2, paragraph, etc.)
    // For simplicity, we'll use passthrough for block-specific updates
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Create comment operation
  z.object({
    operation: z
      .literal('create_comment')
      .describe('Create a comment on a page or block'),
    parent: z
      .object({
        page_id: z.string().optional().describe('ID of parent page'),
        block_id: z.string().optional().describe('ID of parent block'),
      })
      .describe(
        'Parent page or block ID (one of page_id or block_id is required)'
      ),
    rich_text: z
      .array(RichTextSchema)
      .min(1)
      .describe('Array of rich text objects for comment content'),
    attachments: z
      .array(
        z.object({
          file_upload_id: z.string().describe('File Upload ID'),
          type: z.literal('file_upload').optional(),
        })
      )
      .max(3)
      .optional()
      .describe('Array of file attachments (max 3)'),
    display_name: z
      .object({
        type: z
          .enum(['integration', 'user', 'custom'])
          .describe('Type of display name'),
        custom: z
          .object({
            name: z.string().describe('Custom name for the comment'),
          })
          .optional()
          .describe('Custom name object (required if type is custom)'),
      })
      .optional()
      .describe('Custom display name for the comment'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Retrieve comment operation
  z.object({
    operation: z
      .literal('retrieve_comment')
      .describe('Retrieve a comment by its ID'),
    comment_id: z.string().describe('UUID of the Notion comment'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // List users operation
  z.object({
    operation: z
      .literal('list_users')
      .describe('List all users in the workspace'),
    start_cursor: z.string().optional().describe('Cursor for pagination'),
    page_size: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Number of items per page (max 100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),
]);

// Define result schemas with proper response types and specific property names
const NotionResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('create_page')
      .describe('Create page operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    page: PageObjectSchema.optional().describe('Created page object'),
  }),
  z.object({
    operation: z
      .literal('retrieve_page')
      .describe('Retrieve page operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    page: PageObjectSchema.optional().describe('Retrieved page object'),
  }),
  z.object({
    operation: z
      .literal('update_page')
      .describe('Update page operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    page: PageObjectSchema.optional().describe('Updated page object'),
  }),
  z.object({
    operation: z
      .literal('retrieve_database')
      .describe('Retrieve database operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    database: DatabaseObjectSchema.optional().describe(
      'Retrieved database object'
    ),
  }),
  z.object({
    operation: z
      .literal('query_data_source')
      .describe('Query data source operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    results: ListResponseSchema(
      z.union([PageObjectSchema, DataSourceObjectSchema])
    )
      .optional()
      .describe('List of pages or data sources from query'),
  }),
  z.object({
    operation: z
      .literal('create_data_source')
      .describe('Create data source operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    dataSource: DataSourceObjectSchema.optional().describe(
      'Created data source object'
    ),
  }),
  z.object({
    operation: z
      .literal('update_data_source')
      .describe('Update data source operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    dataSource: DataSourceObjectSchema.optional().describe(
      'Updated data source object'
    ),
  }),
  z.object({
    operation: z
      .literal('create_database')
      .describe('Create database operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    database: DatabaseObjectSchema.optional().describe(
      'Created database object'
    ),
  }),
  z.object({
    operation: z
      .literal('update_database')
      .describe('Update database operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    database: DatabaseObjectSchema.optional().describe(
      'Updated database object'
    ),
  }),
  z.object({
    operation: z
      .literal('append_block_children')
      .describe('Append block children operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    blocks: ListResponseSchema(BlockObjectSchema)
      .optional()
      .describe('List of appended block objects'),
  }),
  z.object({
    operation: z
      .literal('retrieve_block_children')
      .describe('Retrieve block children operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    blocks: ListResponseSchema(BlockObjectSchema)
      .optional()
      .describe('List of block children'),
  }),
  z.object({
    operation: z
      .literal('retrieve_block')
      .describe('Retrieve block operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    block: BlockObjectSchema.optional().describe('Retrieved block object'),
  }),
  z.object({
    operation: z
      .literal('update_block')
      .describe('Update block operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    block: BlockObjectSchema.optional().describe('Updated block object'),
  }),
  z.object({
    operation: z
      .literal('create_comment')
      .describe('Create comment operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    comment: CommentObjectSchema.optional().describe('Created comment object'),
  }),
  z.object({
    operation: z
      .literal('retrieve_comment')
      .describe('Retrieve comment operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    comment: CommentObjectSchema.optional().describe(
      'Retrieved comment object'
    ),
  }),
  z.object({
    operation: z.literal('list_users').describe('List users operation result'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    users: ListResponseSchema(UserSchema)
      .optional()
      .describe('List of users in the workspace'),
  }),
]);

type NotionParams = z.input<typeof NotionParamsSchema>;
type NotionParamsParsed = z.output<typeof NotionParamsSchema>;
type NotionResult = z.output<typeof NotionResultSchema>;

export class NotionBubble<
  T extends NotionParams = NotionParams,
> extends ServiceBubble<
  T & { credentials?: Partial<Record<CredentialType, string>> },
  Extract<NotionResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'notion';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'notion';
  static readonly schema = NotionParamsSchema;
  static readonly resultSchema = NotionResultSchema;
  static readonly shortDescription =
    'Notion API integration for pages, databases, and blocks';
  static readonly longDescription = `
    Comprehensive Notion API integration for managing pages, databases, blocks, and comments.
    
    Features:
    - Create, retrieve, and update pages
    - Manage databases and data sources
    - Query data sources with filters and sorting
    - Append and retrieve block children
    - Create and retrieve comments
    - List workspace users
    
    Use cases:
    - Content management and automation
    - Database operations and queries
    - Page creation and updates
    - Block manipulation
    - Comment management
    - Workspace user management
    
    Security Features:
    - OAuth token authentication
    - Parameter validation
    - Comprehensive error handling
    - Respects Notion API versioning (${NOTION_API_VERSION})
  `;
  static readonly alias = 'notion';

  constructor(
    params: T = {
      operation: 'list_users',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  public async testCredential(): Promise<boolean> {
    try {
      const token = this.chooseCredential();
      if (!token) {
        return false;
      }

      // Test by listing users
      await this.makeNotionApiCall('users', {}, 'GET');
      return true;
    } catch (error) {
      console.error('Notion credential test failed:', error);
      return false;
    }
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.NOTION_OAUTH_TOKEN];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<NotionResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<NotionResult> => {
        switch (operation) {
          case 'create_page':
            return await this.createPage(
              this.params as Extract<NotionParams, { operation: 'create_page' }>
            );
          case 'retrieve_page':
            return await this.retrievePage(
              this.params as Extract<
                NotionParams,
                { operation: 'retrieve_page' }
              >
            );
          case 'update_page':
            return await this.updatePage(
              this.params as Extract<NotionParams, { operation: 'update_page' }>
            );
          case 'retrieve_database':
            return await this.retrieveDatabase(
              this.params as Extract<
                NotionParams,
                { operation: 'retrieve_database' }
              >
            );
          case 'query_data_source':
            return await this.queryDataSource(
              this.params as Extract<
                NotionParams,
                { operation: 'query_data_source' }
              >
            );
          case 'create_data_source':
            return await this.createDataSource(
              this.params as Extract<
                NotionParams,
                { operation: 'create_data_source' }
              >
            );
          case 'update_data_source':
            return await this.updateDataSource(
              this.params as Extract<
                NotionParams,
                { operation: 'update_data_source' }
              >
            );
          case 'create_database':
            return await this.createDatabase(
              this.params as Extract<
                NotionParams,
                { operation: 'create_database' }
              >
            );
          case 'update_database':
            return await this.updateDatabase(
              this.params as Extract<
                NotionParams,
                { operation: 'update_database' }
              >
            );
          case 'append_block_children':
            return await this.appendBlockChildren(
              this.params as Extract<
                NotionParams,
                { operation: 'append_block_children' }
              >
            );
          case 'retrieve_block_children':
            return await this.retrieveBlockChildren(
              this.params as Extract<
                NotionParams,
                { operation: 'retrieve_block_children' }
              >
            );
          case 'retrieve_block':
            return await this.retrieveBlock(
              this.params as Extract<
                NotionParams,
                { operation: 'retrieve_block' }
              >
            );
          case 'update_block':
            return await this.updateBlock(
              this.params as Extract<
                NotionParams,
                { operation: 'update_block' }
              >
            );
          case 'create_comment':
            return await this.createComment(
              this.params as Extract<
                NotionParams,
                { operation: 'create_comment' }
              >
            );
          case 'retrieve_comment':
            return await this.retrieveComment(
              this.params as Extract<
                NotionParams,
                { operation: 'retrieve_comment' }
              >
            );
          case 'list_users':
            return await this.listUsers(
              this.params as Extract<NotionParams, { operation: 'list_users' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<NotionResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred in NotionBubble';

      // Return error result with proper structure for each operation type
      return {
        operation: failedOperation,
        success: false,
        error: errorMessage,
      } as Extract<NotionResult, { operation: T['operation'] }>;
    }
  }

  private async createPage(
    params: Extract<NotionParams, { operation: 'create_page' }>
  ): Promise<Extract<NotionResult, { operation: 'create_page' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { parent, properties, children, icon, cover } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'create_page' }
    >;

    const body: Record<string, unknown> = {
      parent,
    };

    if (properties) body.properties = properties;
    if (children) body.children = children;
    if (icon) body.icon = icon;
    if (cover) body.cover = cover;

    const page = await this.makeNotionApiCall<
      z.output<typeof PageObjectSchema>
    >('pages', body, 'POST');

    return {
      operation: 'create_page',
      success: true,
      error: '',
      page,
    };
  }

  private async retrievePage(
    params: Extract<NotionParams, { operation: 'retrieve_page' }>
  ): Promise<Extract<NotionResult, { operation: 'retrieve_page' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { page_id, filter_properties } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'retrieve_page' }
    >;

    let url = `pages/${page_id}`;
    if (filter_properties && filter_properties.length > 0) {
      const params = new URLSearchParams();
      filter_properties.forEach((prop) => {
        params.append('filter_properties', prop);
      });
      url += `?${params.toString()}`;
    }

    const page = await this.makeNotionApiCall<
      z.output<typeof PageObjectSchema>
    >(url, {}, 'GET');

    return {
      operation: 'retrieve_page',
      success: true,
      error: '',
      page,
    };
  }

  private async updatePage(
    params: Extract<NotionParams, { operation: 'update_page' }>
  ): Promise<Extract<NotionResult, { operation: 'update_page' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { page_id, properties, icon, cover, archived, in_trash, is_locked } =
      parsed as Extract<NotionParamsParsed, { operation: 'update_page' }>;

    const body: Record<string, unknown> = {};

    if (properties) body.properties = properties;
    if (icon !== undefined) body.icon = icon;
    if (cover !== undefined) body.cover = cover;
    if (archived !== undefined) body.archived = archived;
    if (in_trash !== undefined) body.in_trash = in_trash;
    if (is_locked !== undefined) body.is_locked = is_locked;

    const page = await this.makeNotionApiCall<
      z.output<typeof PageObjectSchema>
    >(`pages/${page_id}`, body, 'PATCH');

    return {
      operation: 'update_page',
      success: true,
      error: '',
      page,
    };
  }

  private async retrieveDatabase(
    params: Extract<NotionParams, { operation: 'retrieve_database' }>
  ): Promise<Extract<NotionResult, { operation: 'retrieve_database' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { database_id } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'retrieve_database' }
    >;

    const database = await this.makeNotionApiCall<
      z.output<typeof DatabaseObjectSchema>
    >(`databases/${database_id}`, {}, 'GET');

    return {
      operation: 'retrieve_database',
      success: true,
      error: '',
      database,
    };
  }

  private async queryDataSource(
    params: Extract<NotionParams, { operation: 'query_data_source' }>
  ): Promise<Extract<NotionResult, { operation: 'query_data_source' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const {
      data_source_id,
      filter,
      sorts,
      start_cursor,
      page_size,
      filter_properties,
      result_type,
    } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'query_data_source' }
    >;

    const body: Record<string, unknown> = {};

    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (start_cursor) body.start_cursor = start_cursor;
    if (page_size !== undefined) body.page_size = page_size;
    if (result_type) body.result_type = result_type;

    let url = `data_sources/${data_source_id}/query`;
    if (filter_properties && filter_properties.length > 0) {
      const params = new URLSearchParams();
      filter_properties.forEach((prop) => {
        params.append('filter_properties', prop);
      });
      url += `?${params.toString()}`;
    }

    type QueryResult = z.output<
      ReturnType<
        typeof ListResponseSchema<
          typeof PageObjectSchema | typeof DataSourceObjectSchema
        >
      >
    >;
    const results = await this.makeNotionApiCall<QueryResult>(
      url,
      body,
      'POST'
    );

    return {
      operation: 'query_data_source',
      success: true,
      error: '',
      results,
    };
  }

  private async updateDataSource(
    params: Extract<NotionParams, { operation: 'update_data_source' }>
  ): Promise<Extract<NotionResult, { operation: 'update_data_source' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const {
      data_source_id,
      properties,
      title,
      description,
      icon,
      in_trash,
      parent,
    } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'update_data_source' }
    >;

    const body: Record<string, unknown> = {};

    if (properties) body.properties = properties;
    if (title) body.title = title;
    if (description) body.description = description;
    if (icon !== undefined) body.icon = icon;
    if (in_trash !== undefined) body.in_trash = in_trash;
    if (parent) body.parent = parent;

    const dataSource = await this.makeNotionApiCall<
      z.output<typeof DataSourceObjectSchema>
    >(`data_sources/${data_source_id}`, body, 'PATCH');

    return {
      operation: 'update_data_source',
      success: true,
      error: '',
      dataSource,
    };
  }

  private async createDataSource(
    params: Extract<NotionParams, { operation: 'create_data_source' }>
  ): Promise<Extract<NotionResult, { operation: 'create_data_source' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { parent, properties, title, icon } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'create_data_source' }
    >;

    const body: Record<string, unknown> = {
      parent,
      properties,
    };

    if (title) body.title = title;
    if (icon) body.icon = icon;

    const dataSource = await this.makeNotionApiCall<
      z.output<typeof DataSourceObjectSchema>
    >('data_sources', body, 'POST');

    return {
      operation: 'create_data_source',
      success: true,
      error: '',
      dataSource,
    };
  }

  private async createDatabase(
    params: Extract<NotionParams, { operation: 'create_database' }>
  ): Promise<Extract<NotionResult, { operation: 'create_database' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { parent, initial_data_source, title, description, icon, cover } =
      parsed as Extract<NotionParamsParsed, { operation: 'create_database' }>;

    // Ensure workspace parent has workspace: true
    const normalizedParent =
      parent.type === 'workspace'
        ? { type: 'workspace' as const, workspace: true }
        : parent;

    const body: Record<string, unknown> = {
      parent: normalizedParent,
      initial_data_source,
    };

    if (title) body.title = title;
    if (description) body.description = description;
    if (icon) body.icon = icon;
    if (cover) body.cover = cover;

    const database = await this.makeNotionApiCall<
      z.output<typeof DatabaseObjectSchema>
    >('databases', body, 'POST');

    return {
      operation: 'create_database',
      success: true,
      error: '',
      database,
    };
  }

  private async updateDatabase(
    params: Extract<NotionParams, { operation: 'update_database' }>
  ): Promise<Extract<NotionResult, { operation: 'update_database' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const {
      database_id,
      title,
      description,
      icon,
      cover,
      parent,
      is_inline,
      in_trash,
      is_locked,
    } = parsed as Extract<NotionParamsParsed, { operation: 'update_database' }>;

    const body: Record<string, unknown> = {};

    if (title) body.title = title;
    if (description) body.description = description;
    if (icon !== undefined) body.icon = icon;
    if (cover !== undefined) body.cover = cover;
    if (parent) body.parent = parent;
    if (is_inline !== undefined) body.is_inline = is_inline;
    if (in_trash !== undefined) body.in_trash = in_trash;
    if (is_locked !== undefined) body.is_locked = is_locked;

    const database = await this.makeNotionApiCall<
      z.output<typeof DatabaseObjectSchema>
    >(`databases/${database_id}`, body, 'PATCH');

    return {
      operation: 'update_database',
      success: true,
      error: '',
      database,
    };
  }

  private async appendBlockChildren(
    params: Extract<NotionParams, { operation: 'append_block_children' }>
  ): Promise<Extract<NotionResult, { operation: 'append_block_children' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { block_id, children, after } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'append_block_children' }
    >;

    const body: Record<string, unknown> = {
      children,
    };

    if (after) body.after = after;

    type BlockList = z.output<
      ReturnType<typeof ListResponseSchema<typeof BlockObjectSchema>>
    >;
    const blocks = await this.makeNotionApiCall<BlockList>(
      `blocks/${block_id}/children`,
      body,
      'PATCH'
    );

    return {
      operation: 'append_block_children',
      success: true,
      error: '',
      blocks,
    };
  }

  private async retrieveBlockChildren(
    params: Extract<NotionParams, { operation: 'retrieve_block_children' }>
  ): Promise<Extract<NotionResult, { operation: 'retrieve_block_children' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { block_id, start_cursor, page_size } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'retrieve_block_children' }
    >;

    let url = `blocks/${block_id}/children`;
    const params_obj = new URLSearchParams();
    if (start_cursor) params_obj.append('start_cursor', start_cursor);
    if (page_size !== undefined)
      params_obj.append('page_size', page_size.toString());
    if (params_obj.toString()) url += `?${params_obj.toString()}`;

    type BlockList = z.output<
      ReturnType<typeof ListResponseSchema<typeof BlockObjectSchema>>
    >;
    const blocks = await this.makeNotionApiCall<BlockList>(url, {}, 'GET');

    return {
      operation: 'retrieve_block_children',
      success: true,
      error: '',
      blocks,
    };
  }

  private async retrieveBlock(
    params: Extract<NotionParams, { operation: 'retrieve_block' }>
  ): Promise<Extract<NotionResult, { operation: 'retrieve_block' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { block_id } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'retrieve_block' }
    >;

    const block = await this.makeNotionApiCall<
      z.output<typeof BlockObjectSchema>
    >(`blocks/${block_id}`, {}, 'GET');

    return {
      operation: 'retrieve_block',
      success: true,
      error: '',
      block,
    };
  }

  private async updateBlock(
    params: Extract<NotionParams, { operation: 'update_block' }>
  ): Promise<Extract<NotionResult, { operation: 'update_block' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { block_id, archived } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'update_block' }
    >;

    const body: Record<string, unknown> = {};
    if (archived !== undefined) body.archived = archived;

    // Note: Block-specific updates (like heading_2, paragraph, etc.) would need
    // to be passed through params and added to body here
    // For now, we support archiving

    const block = await this.makeNotionApiCall<
      z.output<typeof BlockObjectSchema>
    >(`blocks/${block_id}`, body, 'PATCH');

    return {
      operation: 'update_block',
      success: true,
      error: '',
      block,
    };
  }

  private async createComment(
    params: Extract<NotionParams, { operation: 'create_comment' }>
  ): Promise<Extract<NotionResult, { operation: 'create_comment' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { parent, rich_text, attachments, display_name } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'create_comment' }
    >;

    const body: Record<string, unknown> = {
      parent,
      rich_text,
    };

    if (attachments) body.attachments = attachments;
    if (display_name) body.display_name = display_name;

    const comment = await this.makeNotionApiCall<
      z.output<typeof CommentObjectSchema>
    >('comments', body, 'POST');

    return {
      operation: 'create_comment',
      success: true,
      error: '',
      comment,
    };
  }

  private async retrieveComment(
    params: Extract<NotionParams, { operation: 'retrieve_comment' }>
  ): Promise<Extract<NotionResult, { operation: 'retrieve_comment' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { comment_id } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'retrieve_comment' }
    >;

    const comment = await this.makeNotionApiCall<
      z.output<typeof CommentObjectSchema>
    >(`comments/${comment_id}`, {}, 'GET');

    return {
      operation: 'retrieve_comment',
      success: true,
      error: '',
      comment,
    };
  }

  private async listUsers(
    params: Extract<NotionParams, { operation: 'list_users' }>
  ): Promise<Extract<NotionResult, { operation: 'list_users' }>> {
    const parsed = NotionParamsSchema.parse(params);
    const { start_cursor, page_size } = parsed as Extract<
      NotionParamsParsed,
      { operation: 'list_users' }
    >;

    let url = 'users';
    const params_obj = new URLSearchParams();
    if (start_cursor) params_obj.append('start_cursor', start_cursor);
    if (page_size !== undefined)
      params_obj.append('page_size', page_size.toString());
    if (params_obj.toString()) url += `?${params_obj.toString()}`;

    type UserList = z.output<
      ReturnType<typeof ListResponseSchema<typeof UserSchema>>
    >;
    const users = await this.makeNotionApiCall<UserList>(url, {}, 'GET');

    return {
      operation: 'list_users',
      success: true,
      error: '',
      users,
    };
  }

  private async makeNotionApiCall<T = unknown>(
    endpoint: string,
    body: Record<string, unknown>,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET'
  ): Promise<T> {
    const url = `${NOTION_API_BASE}/${endpoint}`;
    const token = this.chooseCredential();

    if (!token) {
      throw new Error('Notion OAuth token is required but was not provided');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && Object.keys(body).length > 0) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    const data = (await response.json()) as T;

    if (!response.ok) {
      // Throw error with Notion error response
      throw new Error(
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as Record<string, unknown>).message)
          : `Notion API error: ${response.status} ${response.statusText}`
      );
    }

    return data;
  }
}
