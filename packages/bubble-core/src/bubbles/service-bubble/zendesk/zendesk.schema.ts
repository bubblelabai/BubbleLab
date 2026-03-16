import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Shared field helpers
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const ticketIdField = z
  .string()
  .min(1, 'Ticket ID is required')
  .describe('Zendesk ticket ID (numeric string)');

const customFieldEntry = z.object({
  id: z.number().describe('Custom ticket field ID'),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
    .describe(
      'Field value. For dropdowns use the tag name, for multiselect use an array of tag names, for dates use "YYYY-MM-DD"'
    ),
});

// Parameter schema using discriminated union
export const ZendeskParamsSchema = z.discriminatedUnion('operation', [
  // List tickets
  z.object({
    operation: z
      .literal('list_tickets')
      .describe('List tickets with optional filters'),
    status: z
      .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
      .optional()
      .describe('Filter by ticket status'),
    sort_by: z
      .enum(['created_at', 'updated_at', 'priority', 'status'])
      .optional()
      .default('updated_at')
      .describe('Sort field (default: updated_at)'),
    sort_order: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order (default: desc)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Get ticket
  z.object({
    operation: z
      .literal('get_ticket')
      .describe('Retrieve a single ticket by ID with full details'),
    ticket_id: ticketIdField,
    credentials: credentialsField,
  }),

  // Create ticket
  z.object({
    operation: z
      .literal('create_ticket')
      .describe('Create a new support ticket'),
    subject: z.string().min(1).describe('Ticket subject line'),
    body: z
      .string()
      .min(1)
      .describe('Ticket description / initial comment body'),
    requester_email: z
      .string()
      .optional()
      .describe('Email of the requester (creates user if not found)'),
    requester_name: z
      .string()
      .optional()
      .describe(
        'Name of the requester (used when creating a new requester alongside email)'
      ),
    assignee_id: z
      .number()
      .optional()
      .describe('Agent ID to assign the ticket to'),
    priority: z
      .enum(['urgent', 'high', 'normal', 'low'])
      .optional()
      .describe('Ticket priority'),
    type: z
      .enum(['problem', 'incident', 'question', 'task'])
      .optional()
      .describe('Ticket type'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags to apply to the ticket'),
    custom_fields: z
      .array(customFieldEntry)
      .optional()
      .describe(
        'Custom field values. Use list_ticket_fields to discover available fields and their IDs.'
      ),
    credentials: credentialsField,
  }),

  // Update ticket (add comment / change fields)
  z.object({
    operation: z
      .literal('update_ticket')
      .describe(
        'Update a ticket: add a reply/comment, change status, priority, or assignee'
      ),
    ticket_id: ticketIdField,
    comment: z
      .string()
      .optional()
      .describe(
        'Comment body to add to the ticket (public reply or internal note)'
      ),
    public: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Whether the comment is public (visible to requester) or internal note (default: true)'
      ),
    status: z
      .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
      .optional()
      .describe('Set new ticket status'),
    priority: z
      .enum(['urgent', 'high', 'normal', 'low'])
      .optional()
      .describe('Set new ticket priority'),
    assignee_id: z
      .number()
      .optional()
      .describe('Reassign ticket to this agent ID'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Replace ticket tags with this list'),
    custom_fields: z
      .array(customFieldEntry)
      .optional()
      .describe(
        'Custom field values to set. Use list_ticket_fields to discover available fields and their IDs.'
      ),
    credentials: credentialsField,
  }),

  // List ticket comments
  z.object({
    operation: z
      .literal('list_ticket_comments')
      .describe('List comments/replies on a ticket'),
    ticket_id: ticketIdField,
    sort_order: z
      .enum(['asc', 'desc'])
      .optional()
      .default('asc')
      .describe('Sort order for comments (default: asc — oldest first)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // List users
  z.object({
    operation: z.literal('list_users').describe('List or search users'),
    query: z.string().optional().describe('Search query (name or email)'),
    role: z
      .enum(['end-user', 'agent', 'admin'])
      .optional()
      .describe('Filter by user role'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Get user
  z.object({
    operation: z.literal('get_user').describe('Retrieve a single user by ID'),
    user_id: z.string().min(1).describe('Zendesk user ID (numeric string)'),
    credentials: credentialsField,
  }),

  // List organizations
  z.object({
    operation: z
      .literal('list_organizations')
      .describe('List or search organizations'),
    query: z
      .string()
      .optional()
      .describe('Search by organization name or external ID'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Get organization
  z.object({
    operation: z
      .literal('get_organization')
      .describe('Retrieve a single organization by ID'),
    organization_id: z
      .string()
      .min(1)
      .describe('Zendesk organization ID (numeric string)'),
    credentials: credentialsField,
  }),

  // Search
  z.object({
    operation: z
      .literal('search')
      .describe(
        'Unified search across tickets, users, and organizations using Zendesk query syntax'
      ),
    query: z
      .string()
      .min(1)
      .describe(
        'Zendesk search query (e.g., "type:ticket status:open", "type:user email:john@example.com")'
      ),
    sort_by: z
      .enum(['updated_at', 'created_at', 'priority', 'status', 'ticket_type'])
      .optional()
      .describe('Sort field'),
    sort_order: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order (default: desc)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // List articles
  z.object({
    operation: z
      .literal('list_articles')
      .describe('List or search Help Center articles'),
    query: z.string().optional().describe('Search query for articles'),
    section_id: z.string().optional().describe('Filter articles by section ID'),
    category_id: z
      .string()
      .optional()
      .describe('Filter articles by category ID'),
    locale: z.string().optional().describe('Filter by locale (e.g., "en-us")'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Results per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Get article
  z.object({
    operation: z
      .literal('get_article')
      .describe(
        'Retrieve a single Help Center article by ID with body content'
      ),
    article_id: z.string().min(1).describe('Zendesk Help Center article ID'),
    locale: z
      .string()
      .optional()
      .describe('Locale for the article (e.g., "en-us")'),
    credentials: credentialsField,
  }),

  // List ticket fields
  z.object({
    operation: z
      .literal('list_ticket_fields')
      .describe(
        'List all ticket fields (system and custom) to discover field IDs, types, and allowed values'
      ),
    credentials: credentialsField,
  }),

  // Create ticket field
  z.object({
    operation: z
      .literal('create_ticket_field')
      .describe('Create a new custom ticket field (admin only)'),
    type: z
      .enum([
        'text',
        'textarea',
        'checkbox',
        'date',
        'integer',
        'decimal',
        'regexp',
        'partialcreditcard',
        'multiselect',
        'tagger',
        'lookup',
      ])
      .describe('Field type'),
    title: z.string().min(1).describe('Field display title'),
    description: z.string().optional().describe('Field description'),
    required: z
      .boolean()
      .optional()
      .describe(
        'Whether agents must fill this field to mark a ticket as solved'
      ),
    active: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether field is active'),
    custom_field_options: z
      .array(
        z.object({
          name: z.string().describe('Display name of the option'),
          value: z.string().describe('Tag value for this option'),
        })
      )
      .optional()
      .describe(
        'Options for tagger/multiselect fields. Each option needs a display name and a tag value.'
      ),
    tag: z
      .string()
      .optional()
      .describe('Tag added when checkbox is selected (checkbox type only)'),
    regexp_for_validation: z
      .string()
      .optional()
      .describe('Validation regex (regexp type only)'),
    credentials: credentialsField,
  }),

  // Delete ticket field
  z.object({
    operation: z
      .literal('delete_ticket_field')
      .describe(
        'Delete a custom ticket field (admin only). System fields cannot be deleted.'
      ),
    ticket_field_id: z
      .string()
      .min(1)
      .describe('ID of the ticket field to delete'),
    credentials: credentialsField,
  }),
]);

// Zendesk record schemas for response data
const ZendeskTicketSchema = z
  .object({
    id: z.number().describe('Ticket ID'),
    subject: z.string().optional().describe('Ticket subject'),
    description: z.string().optional().describe('Ticket description'),
    status: z.string().optional().describe('Ticket status'),
    priority: z.string().optional().nullable().describe('Ticket priority'),
    type: z.string().optional().nullable().describe('Ticket type'),
    requester_id: z.number().optional().describe('Requester user ID'),
    assignee_id: z.number().optional().nullable().describe('Assignee user ID'),
    organization_id: z
      .number()
      .optional()
      .nullable()
      .describe('Organization ID'),
    tags: z.array(z.string()).optional().describe('Ticket tags'),
    custom_fields: z
      .array(
        z.object({
          id: z.number(),
          value: z
            .union([
              z.string(),
              z.number(),
              z.boolean(),
              z.array(z.string()),
              z.null(),
            ])
            .nullable(),
        })
      )
      .optional()
      .describe('Custom field values on the ticket'),
    created_at: z.string().optional().describe('Created timestamp'),
    updated_at: z.string().optional().describe('Updated timestamp'),
  })
  .describe('A Zendesk ticket');

const ZendeskCommentSchema = z
  .object({
    id: z.number().describe('Comment ID'),
    body: z.string().optional().describe('Comment body text'),
    html_body: z.string().optional().describe('Comment body HTML'),
    public: z.boolean().optional().describe('Whether comment is public'),
    author_id: z.number().optional().describe('Author user ID'),
    created_at: z.string().optional().describe('Created timestamp'),
  })
  .describe('A Zendesk ticket comment');

const ZendeskUserSchema = z
  .object({
    id: z.number().describe('User ID'),
    name: z.string().optional().describe('User name'),
    email: z.string().optional().describe('User email'),
    role: z.string().optional().describe('User role (end-user, agent, admin)'),
    organization_id: z
      .number()
      .optional()
      .nullable()
      .describe('Organization ID'),
    active: z.boolean().optional().describe('Whether user is active'),
    created_at: z.string().optional().describe('Created timestamp'),
  })
  .describe('A Zendesk user');

const ZendeskOrganizationSchema = z
  .object({
    id: z.number().describe('Organization ID'),
    name: z.string().optional().describe('Organization name'),
    domain_names: z
      .array(z.string())
      .optional()
      .describe('Associated domain names'),
    external_id: z.string().optional().nullable().describe('External ID'),
    created_at: z.string().optional().describe('Created timestamp'),
  })
  .describe('A Zendesk organization');

const ZendeskArticleSchema = z
  .object({
    id: z.number().describe('Article ID'),
    title: z.string().optional().describe('Article title'),
    body: z.string().optional().describe('Article body HTML'),
    locale: z.string().optional().describe('Article locale'),
    section_id: z.number().optional().describe('Section ID'),
    author_id: z.number().optional().describe('Author user ID'),
    draft: z.boolean().optional().describe('Whether article is a draft'),
    created_at: z.string().optional().describe('Created timestamp'),
    updated_at: z.string().optional().describe('Updated timestamp'),
  })
  .describe('A Zendesk Help Center article');

// Result schema
export const ZendeskResultSchema = z.discriminatedUnion('operation', [
  // List tickets result
  z.object({
    operation: z.literal('list_tickets'),
    success: z.boolean().describe('Whether the operation was successful'),
    tickets: z
      .array(ZendeskTicketSchema)
      .optional()
      .describe('List of tickets'),
    count: z.number().optional().describe('Total ticket count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get ticket result
  z.object({
    operation: z.literal('get_ticket'),
    success: z.boolean().describe('Whether the operation was successful'),
    ticket: ZendeskTicketSchema.optional().describe('Retrieved ticket'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create ticket result
  z.object({
    operation: z.literal('create_ticket'),
    success: z.boolean().describe('Whether the operation was successful'),
    ticket: ZendeskTicketSchema.optional().describe('Created ticket'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Update ticket result
  z.object({
    operation: z.literal('update_ticket'),
    success: z.boolean().describe('Whether the operation was successful'),
    ticket: ZendeskTicketSchema.optional().describe('Updated ticket'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List ticket comments result
  z.object({
    operation: z.literal('list_ticket_comments'),
    success: z.boolean().describe('Whether the operation was successful'),
    comments: z
      .array(ZendeskCommentSchema)
      .optional()
      .describe('List of comments'),
    count: z.number().optional().describe('Total comment count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List users result
  z.object({
    operation: z.literal('list_users'),
    success: z.boolean().describe('Whether the operation was successful'),
    users: z.array(ZendeskUserSchema).optional().describe('List of users'),
    count: z.number().optional().describe('Total user count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get user result
  z.object({
    operation: z.literal('get_user'),
    success: z.boolean().describe('Whether the operation was successful'),
    user: ZendeskUserSchema.optional().describe('Retrieved user'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List organizations result
  z.object({
    operation: z.literal('list_organizations'),
    success: z.boolean().describe('Whether the operation was successful'),
    organizations: z
      .array(ZendeskOrganizationSchema)
      .optional()
      .describe('List of organizations'),
    count: z.number().optional().describe('Total organization count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get organization result
  z.object({
    operation: z.literal('get_organization'),
    success: z.boolean().describe('Whether the operation was successful'),
    organization: ZendeskOrganizationSchema.optional().describe(
      'Retrieved organization'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Search result
  z.object({
    operation: z.literal('search'),
    success: z.boolean().describe('Whether the operation was successful'),
    results: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('Search results (mixed types)'),
    count: z.number().optional().describe('Total result count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List ticket fields result
  z.object({
    operation: z.literal('list_ticket_fields'),
    success: z.boolean().describe('Whether the operation was successful'),
    ticket_fields: z
      .array(
        z.object({
          id: z.number().describe('Field ID'),
          type: z
            .string()
            .describe(
              'Field type (text, textarea, checkbox, date, integer, decimal, tagger, multiselect, etc.)'
            ),
          title: z.string().describe('Field display title'),
          description: z
            .string()
            .optional()
            .nullable()
            .describe('Field description'),
          active: z
            .boolean()
            .optional()
            .describe('Whether the field is active'),
          required: z
            .boolean()
            .optional()
            .describe('Whether the field is required'),
          custom_field_options: z
            .array(
              z.object({
                name: z.string().describe('Display name of the option'),
                value: z
                  .string()
                  .describe('Tag value to use when setting this field'),
              })
            )
            .optional()
            .nullable()
            .describe(
              'Available options for dropdown/tagger/multiselect fields'
            ),
        })
      )
      .optional()
      .describe('List of ticket fields'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create ticket field result
  z.object({
    operation: z.literal('create_ticket_field'),
    success: z.boolean().describe('Whether the operation was successful'),
    ticket_field: z
      .object({
        id: z.number().describe('Created field ID'),
        type: z.string().describe('Field type'),
        title: z.string().describe('Field title'),
        active: z.boolean().optional().describe('Whether field is active'),
        required: z.boolean().optional().describe('Whether field is required'),
        custom_field_options: z
          .array(
            z.object({
              name: z.string(),
              value: z.string(),
            })
          )
          .optional()
          .nullable(),
      })
      .optional()
      .describe('Created ticket field'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Delete ticket field result
  z.object({
    operation: z.literal('delete_ticket_field'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List articles result
  z.object({
    operation: z.literal('list_articles'),
    success: z.boolean().describe('Whether the operation was successful'),
    articles: z
      .array(ZendeskArticleSchema)
      .optional()
      .describe('List of articles'),
    count: z.number().optional().describe('Total article count'),
    next_page: z.string().optional().nullable().describe('Next page URL'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get article result
  z.object({
    operation: z.literal('get_article'),
    success: z.boolean().describe('Whether the operation was successful'),
    article: ZendeskArticleSchema.optional().describe('Retrieved article'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type ZendeskParams = z.output<typeof ZendeskParamsSchema>;
export type ZendeskParamsInput = z.input<typeof ZendeskParamsSchema>;
export type ZendeskResult = z.output<typeof ZendeskResultSchema>;
