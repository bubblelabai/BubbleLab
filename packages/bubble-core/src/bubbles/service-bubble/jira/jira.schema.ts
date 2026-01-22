import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

// Labels modification schema for update operation
const LabelsModificationSchema = z
  .object({
    add: z.array(z.string()).optional().describe('Labels to add to the issue'),
    remove: z
      .array(z.string())
      .optional()
      .describe('Labels to remove from the issue'),
    set: z
      .array(z.string())
      .optional()
      .describe('Replace all labels with these (overrides add/remove)'),
  })
  .describe(
    'Label modifications - use add/remove for incremental changes, or set to replace all'
  );

// Priority enum for consistent values
const PrioritySchema = z
  .enum(['Highest', 'High', 'Medium', 'Low', 'Lowest'])
  .describe('Issue priority level');

// Expand options for get operation
const ExpandOptionsSchema = z
  .enum(['changelog', 'comments', 'transitions'])
  .describe('Additional data to include in the response');

// Credentials field (common across all operations)
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credentials (injected at runtime)');

// ============================================================================
// ISSUE DATA SCHEMAS (for results)
// ============================================================================

export const JiraUserSchema = z
  .object({
    accountId: z.string().describe('User account ID'),
    displayName: z.string().optional().describe('User display name'),
    emailAddress: z.string().optional().describe('User email address'),
    active: z.boolean().optional().describe('Whether the user is active'),
  })
  .describe('Jira user information');

export const JiraIssueTypeSchema = z
  .object({
    id: z.string().describe('Issue type ID'),
    name: z.string().describe('Issue type name (e.g., "Task", "Bug", "Story")'),
    description: z.string().optional().describe('Issue type description'),
    subtask: z.boolean().optional().describe('Whether this is a subtask type'),
  })
  .describe('Jira issue type');

export const JiraStatusSchema = z
  .object({
    id: z.string().describe('Status ID'),
    name: z
      .string()
      .describe('Status name (e.g., "To Do", "In Progress", "Done")'),
    statusCategory: z
      .object({
        key: z.string().describe('Category key'),
        name: z.string().describe('Category name'),
      })
      .optional()
      .describe('Status category'),
  })
  .describe('Jira issue status');

export const JiraPrioritySchema = z
  .object({
    id: z.string().describe('Priority ID'),
    name: z.string().describe('Priority name'),
  })
  .describe('Jira priority');

export const JiraProjectSchema = z
  .object({
    id: z.string().describe('Project ID'),
    key: z.string().describe('Project key (e.g., "PROJ")'),
    name: z.string().describe('Project name'),
  })
  .describe('Jira project');

export const JiraCommentSchema = z
  .object({
    id: z.string().describe('Comment ID'),
    author: JiraUserSchema.nullable()
      .optional()
      .describe('Comment author (null if deleted or anonymized)'),
    body: z
      .unknown()
      .optional()
      .describe('Comment body (ADF format or plain text)'),
    renderedBody: z
      .string()
      .optional()
      .describe('Comment body as rendered HTML'),
    created: z.string().optional().describe('Creation timestamp'),
    updated: z.string().optional().describe('Last update timestamp'),
  })
  .describe('Jira comment');

export const JiraTransitionSchema = z
  .object({
    id: z.string().describe('Transition ID'),
    name: z
      .string()
      .describe('Transition name (e.g., "Start Progress", "Done")'),
    to: JiraStatusSchema.optional().describe('Target status'),
  })
  .describe('Jira transition');

export const JiraIssueSchema = z
  .object({
    id: z.string().describe('Issue ID'),
    key: z.string().describe('Issue key (e.g., "PROJ-123")'),
    self: z.string().optional().describe('Issue API URL'),
    fields: z
      .object({
        summary: z.string().optional().describe('Issue title/summary'),
        description: z
          .unknown()
          .optional()
          .describe('Issue description (ADF format)'),
        status: JiraStatusSchema.optional().describe('Current status'),
        priority: JiraPrioritySchema.nullable()
          .optional()
          .describe('Issue priority (null if not assigned)'),
        assignee: JiraUserSchema.nullable()
          .optional()
          .describe('Assigned user'),
        reporter: JiraUserSchema.nullable()
          .optional()
          .describe('Reporter user (null if deleted or anonymized)'),
        issuetype: JiraIssueTypeSchema.optional().describe('Issue type'),
        project: JiraProjectSchema.optional().describe('Project'),
        labels: z.array(z.string()).optional().describe('Issue labels'),
        created: z.string().optional().describe('Creation timestamp'),
        updated: z.string().optional().describe('Last update timestamp'),
        duedate: z
          .string()
          .nullable()
          .optional()
          .describe('Due date (YYYY-MM-DD)'),
        parent: z
          .object({
            id: z.string(),
            key: z.string(),
          })
          .optional()
          .describe('Parent issue (for subtasks)'),
        comment: z
          .object({
            comments: z.array(JiraCommentSchema).optional(),
            total: z.number().optional(),
          })
          .optional()
          .describe('Issue comments'),
      })
      .passthrough()
      .describe('Issue fields'),
    transitions: z
      .array(JiraTransitionSchema)
      .optional()
      .describe('Available transitions'),
    changelog: z.unknown().optional().describe('Issue changelog'),
  })
  .describe('Jira issue');

// ============================================================================
// PARAMETERS SCHEMA (discriminated union)
// ============================================================================

export const JiraParamsSchema = z.discriminatedUnion('operation', [
  // -------------------------------------------------------------------------
  // CORE OPERATION 1: search - Find issues with JQL
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('search')
      .describe('Search for issues using JQL query'),

    jql: z
      .string()
      .min(1, 'JQL query is required')
      .describe(
        'JQL query string. Examples: "project = PROJ", "assignee = currentUser()", "status = Open AND created >= -7d"'
      ),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of issues to return (1-100)'),

    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Starting index for pagination'),

    fields: z
      .array(z.string())
      .optional()
      .describe(
        'Specific fields to return (e.g., ["summary", "status", "assignee"]). Default: all standard fields'
      ),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 2: get - Get issue details
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get').describe('Get details for a specific issue'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123") or issue ID'),

    fields: z
      .array(z.string())
      .optional()
      .describe('Specific fields to return. Default: all fields'),

    expand: z
      .array(ExpandOptionsSchema)
      .optional()
      .describe('Additional data to include'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 3: create - Create new issue
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('create').describe('Create a new issue in Jira'),

    project: z
      .string()
      .min(1, 'Project key is required')
      .describe('Project key (e.g., "PROJ")'),

    summary: z
      .string()
      .min(1, 'Summary is required')
      .max(255)
      .describe('Issue title/summary (max 255 chars)'),

    type: z
      .string()
      .optional()
      .default('Task')
      .describe(
        'Issue type: "Task", "Bug", "Story", "Epic", etc. Default: "Task"'
      ),

    description: z
      .string()
      .optional()
      .describe('Issue description (plain text - auto-converted to ADF)'),

    assignee: z
      .string()
      .optional()
      .describe('Assignee account ID or email. Leave empty for unassigned'),

    priority: PrioritySchema.optional().describe(
      'Issue priority. Default: uses project default'
    ),

    labels: z
      .array(z.string())
      .optional()
      .describe('Labels to apply (e.g., ["bug", "urgent"])'),

    parent: z
      .string()
      .optional()
      .describe('Parent issue key for subtasks (e.g., "PROJ-100")'),

    due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 4: update - Update existing issue
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('update').describe('Update an existing issue'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123") or issue ID'),

    summary: z.string().min(1).max(255).optional().describe('New issue title'),

    description: z
      .string()
      .optional()
      .describe(
        'New description (markdown or plain text - auto-converted to ADF). Supports: **bold**, *italic*, `code`, [links](url), # headings, lists, > blockquotes, ``` code blocks ```, ~~strikethrough~~'
      ),

    assignee: z
      .string()
      .nullable()
      .optional()
      .describe('New assignee (account ID/email) or null to unassign'),

    priority: PrioritySchema.optional().describe('New priority'),

    labels: LabelsModificationSchema.optional().describe('Label modifications'),

    due_date: z
      .string()
      .nullable()
      .optional()
      .describe('New due date (YYYY-MM-DD) or null to clear'),

    comment: z
      .string()
      .optional()
      .describe(
        'Add a comment with this update (markdown or plain text - auto-converted to ADF). Supports: **bold**, *italic*, `code`, [links](url), # headings, lists, > blockquotes, ``` code blocks ```, ~~strikethrough~~'
      ),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 5: transition - Change issue status
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('transition')
      .describe('Transition issue to a new status'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123")'),

    status: z
      .string()
      .optional()
      .describe(
        'Target status NAME (e.g., "In Progress", "Done"). Finds matching transition automatically'
      ),

    transition_id: z
      .string()
      .optional()
      .describe(
        'Specific transition ID (from list_transitions). Use when status name is ambiguous'
      ),

    comment: z
      .string()
      .optional()
      .describe(
        'Comment to add with the transition (markdown or plain text - auto-converted to ADF). Supports: **bold**, *italic*, `code`, [links](url), # headings, lists, > blockquotes, ``` code blocks ```, ~~strikethrough~~'
      ),

    resolution: z
      .string()
      .optional()
      .describe(
        'Resolution when closing (e.g., "Fixed", "Won\'t Fix", "Duplicate")'
      ),

    credentials: credentialsField,
  }),
  // Note: Validation that either status or transition_id is required is done at runtime

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_transitions
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_transitions')
      .describe('Get available transitions for an issue'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123")'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_projects
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_projects')
      .describe('List available Jira projects'),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of projects to return'),

    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Starting index for pagination'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_issue_types
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_issue_types')
      .describe('List issue types for a project'),

    project: z
      .string()
      .min(1, 'Project key is required')
      .describe('Project key (e.g., "PROJ")'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: add_comment
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('add_comment').describe('Add a comment to an issue'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123")'),

    body: z
      .string()
      .min(1, 'Comment body is required')
      .describe(
        'Comment text (markdown or plain text - auto-converted to ADF). Supports: **bold**, *italic*, `code`, [links](url), # headings, lists, > blockquotes, ``` code blocks ```, ~~strikethrough~~'
      ),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: get_comments
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_comments').describe('Get comments for an issue'),

    key: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., "PROJ-123")'),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of comments to return'),

    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Starting index for pagination'),

    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

export const JiraResultSchema = z.discriminatedUnion('operation', [
  // search result
  z.object({
    operation: z.literal('search'),
    success: z.boolean().describe('Whether the operation was successful'),
    issues: z.array(JiraIssueSchema).optional().describe('Found issues'),
    total: z.number().optional().describe('Total matching issues'),
    offset: z.number().optional().describe('Current offset'),
    limit: z.number().optional().describe('Requested limit'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get result
  z.object({
    operation: z.literal('get'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue: JiraIssueSchema.optional().describe('Issue details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // create result
  z.object({
    operation: z.literal('create'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue: z
      .object({
        id: z.string().describe('Created issue ID'),
        key: z.string().describe('Created issue key'),
        self: z.string().optional().describe('Issue API URL'),
      })
      .optional()
      .describe('Created issue info'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // update result
  z.object({
    operation: z.literal('update'),
    success: z.boolean().describe('Whether the operation was successful'),
    key: z.string().optional().describe('Updated issue key'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // transition result
  z.object({
    operation: z.literal('transition'),
    success: z.boolean().describe('Whether the operation was successful'),
    key: z.string().optional().describe('Transitioned issue key'),
    new_status: z.string().optional().describe('New status name'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_transitions result
  z.object({
    operation: z.literal('list_transitions'),
    success: z.boolean().describe('Whether the operation was successful'),
    transitions: z
      .array(JiraTransitionSchema)
      .optional()
      .describe('Available transitions'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_projects result
  z.object({
    operation: z.literal('list_projects'),
    success: z.boolean().describe('Whether the operation was successful'),
    projects: z
      .array(JiraProjectSchema)
      .optional()
      .describe('Available projects'),
    total: z.number().optional().describe('Total projects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_issue_types result
  z.object({
    operation: z.literal('list_issue_types'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue_types: z
      .array(JiraIssueTypeSchema)
      .optional()
      .describe('Available issue types'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // add_comment result
  z.object({
    operation: z.literal('add_comment'),
    success: z.boolean().describe('Whether the operation was successful'),
    comment: JiraCommentSchema.optional().describe('Created comment'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_comments result
  z.object({
    operation: z.literal('get_comments'),
    success: z.boolean().describe('Whether the operation was successful'),
    comments: z.array(JiraCommentSchema).optional().describe('Issue comments'),
    total: z.number().optional().describe('Total comments'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// OUTPUT type: What's stored internally (after validation/transformation)
export type JiraParams = z.output<typeof JiraParamsSchema>;

// INPUT type: What users pass (before validation)
export type JiraParamsInput = z.input<typeof JiraParamsSchema>;

// RESULT type: Always output (after validation)
export type JiraResult = z.output<typeof JiraResultSchema>;

// Operation-specific parameter types (for internal method signatures)
export type JiraSearchParams = Extract<JiraParams, { operation: 'search' }>;
export type JiraGetParams = Extract<JiraParams, { operation: 'get' }>;
export type JiraCreateParams = Extract<JiraParams, { operation: 'create' }>;
export type JiraUpdateParams = Extract<JiraParams, { operation: 'update' }>;
export type JiraTransitionParams = Extract<
  JiraParams,
  { operation: 'transition' }
>;
export type JiraListTransitionsParams = Extract<
  JiraParams,
  { operation: 'list_transitions' }
>;
export type JiraListProjectsParams = Extract<
  JiraParams,
  { operation: 'list_projects' }
>;
export type JiraListIssueTypesParams = Extract<
  JiraParams,
  { operation: 'list_issue_types' }
>;
export type JiraAddCommentParams = Extract<
  JiraParams,
  { operation: 'add_comment' }
>;
export type JiraGetCommentsParams = Extract<
  JiraParams,
  { operation: 'get_comments' }
>;
