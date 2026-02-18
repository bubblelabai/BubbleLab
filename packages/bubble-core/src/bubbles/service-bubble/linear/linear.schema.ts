import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

// Labels modification schema for update operation
const LabelsModificationSchema = z
  .object({
    add: z
      .array(z.string())
      .optional()
      .describe('Label IDs or names to add to the issue'),
    remove: z
      .array(z.string())
      .optional()
      .describe('Label IDs or names to remove from the issue'),
  })
  .describe('Label modifications - use add/remove for incremental changes');

// Credentials field (common across all operations)
const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credentials (injected at runtime)');

// ============================================================================
// ISSUE DATA SCHEMAS (for results)
// ============================================================================

export const LinearUserSchema = z
  .object({
    id: z.string().describe('User ID'),
    name: z.string().optional().describe('User display name'),
    email: z.string().optional().describe('User email address'),
  })
  .passthrough()
  .describe('Linear user information');

export const LinearTeamSchema = z
  .object({
    id: z.string().describe('Team ID'),
    name: z.string().describe('Team name'),
    key: z.string().describe('Team key (e.g., "LIN")'),
  })
  .passthrough()
  .describe('Linear team');

export const LinearProjectSchema = z
  .object({
    id: z.string().describe('Project ID'),
    name: z.string().describe('Project name'),
    state: z.string().optional().describe('Project state'),
  })
  .passthrough()
  .describe('Linear project');

export const LinearWorkflowStateSchema = z
  .object({
    id: z.string().describe('Workflow state ID'),
    name: z
      .string()
      .describe('State name (e.g., "Todo", "In Progress", "Done")'),
    type: z
      .string()
      .optional()
      .describe(
        'State type (backlog, unstarted, started, completed, cancelled)'
      ),
    color: z.string().optional().describe('State color'),
  })
  .passthrough()
  .describe('Linear workflow state');

export const LinearLabelSchema = z
  .object({
    id: z.string().describe('Label ID'),
    name: z.string().describe('Label name'),
    color: z.string().optional().describe('Label color'),
  })
  .passthrough()
  .describe('Linear label');

export const LinearCommentSchema = z
  .object({
    id: z.string().describe('Comment ID'),
    body: z.string().optional().describe('Comment body (markdown)'),
    user: LinearUserSchema.nullable().optional().describe('Comment author'),
    createdAt: z.string().optional().describe('Creation timestamp'),
    updatedAt: z.string().optional().describe('Last update timestamp'),
  })
  .passthrough()
  .describe('Linear comment');

export const LinearIssueSchema = z
  .object({
    id: z.string().optional().describe('Issue ID'),
    identifier: z
      .string()
      .optional()
      .describe('Issue identifier (e.g., "LIN-123")'),
    title: z.string().optional().describe('Issue title'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Issue description (markdown)'),
    priority: z
      .number()
      .optional()
      .describe('Priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)'),
    priorityLabel: z
      .string()
      .optional()
      .describe('Priority label (e.g., "High")'),
    state: LinearWorkflowStateSchema.optional().describe('Current state'),
    assignee: LinearUserSchema.nullable().optional().describe('Assigned user'),
    team: LinearTeamSchema.optional().describe('Team'),
    project: LinearProjectSchema.nullable().optional().describe('Project'),
    labels: z
      .object({
        nodes: z.array(LinearLabelSchema).optional(),
      })
      .optional()
      .describe('Issue labels'),
    createdAt: z.string().optional().describe('Creation timestamp'),
    updatedAt: z.string().optional().describe('Last update timestamp'),
    dueDate: z.string().nullable().optional().describe('Due date (YYYY-MM-DD)'),
    url: z.string().optional().describe('Issue URL'),
  })
  .passthrough()
  .describe('Linear issue');

// ============================================================================
// PARAMETERS SCHEMA (discriminated union)
// ============================================================================

export const LinearParamsSchema = z.discriminatedUnion('operation', [
  // -------------------------------------------------------------------------
  // CORE OPERATION 1: search - Search/filter issues
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('search')
      .describe('Search for issues with text query and filters'),

    query: z
      .string()
      .optional()
      .describe('Text to search for in issue titles and descriptions'),

    teamId: z.string().optional().describe('Filter by team ID'),

    assigneeId: z.string().optional().describe('Filter by assignee user ID'),

    stateId: z.string().optional().describe('Filter by workflow state ID'),

    labelId: z.string().optional().describe('Filter by label ID'),

    projectId: z.string().optional().describe('Filter by project ID'),

    priority: z
      .number()
      .min(0)
      .max(4)
      .optional()
      .describe(
        'Filter by priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)'
      ),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of issues to return (1-100)'),

    includeArchived: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include archived issues in results'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 2: get - Get issue details
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get').describe('Get details for a specific issue'),

    identifier: z
      .string()
      .min(1, 'Issue identifier is required')
      .describe('Issue identifier (e.g., "LIN-123") or issue ID'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 3: create - Create new issue
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('create').describe('Create a new issue in Linear'),

    teamId: z
      .string()
      .min(1, 'Team ID is required')
      .describe('Team ID to create the issue in'),

    title: z.string().min(1, 'Title is required').describe('Issue title'),

    description: z
      .string()
      .optional()
      .describe('Issue description (supports markdown)'),

    assigneeId: z
      .string()
      .optional()
      .describe('Assignee user ID. Leave empty for unassigned'),

    priority: z
      .number()
      .min(0)
      .max(4)
      .optional()
      .describe(
        'Issue priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)'
      ),

    stateId: z
      .string()
      .optional()
      .describe('Workflow state ID. If not set, uses the team default'),

    stateName: z
      .string()
      .optional()
      .describe(
        'Workflow state name (e.g., "In Progress"). Resolved to ID automatically. Use this instead of stateId for convenience'
      ),

    labelIds: z.array(z.string()).optional().describe('Label IDs to apply'),

    projectId: z.string().optional().describe('Project ID to associate with'),

    dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),

    parentId: z.string().optional().describe('Parent issue ID for sub-issues'),

    estimate: z.number().optional().describe('Issue estimate (points)'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // CORE OPERATION 4: update - Update existing issue
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('update').describe('Update an existing issue'),

    id: z
      .string()
      .min(1, 'Issue ID is required')
      .describe('Issue ID (UUID) or identifier (e.g., "LIN-123")'),

    title: z.string().min(1).optional().describe('New issue title'),

    description: z
      .string()
      .optional()
      .describe('New description (supports markdown)'),

    assigneeId: z
      .string()
      .nullable()
      .optional()
      .describe('New assignee user ID or null to unassign'),

    priority: z
      .number()
      .min(0)
      .max(4)
      .optional()
      .describe(
        'New priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)'
      ),

    stateId: z.string().optional().describe('New workflow state ID'),

    stateName: z
      .string()
      .optional()
      .describe(
        'New workflow state name (e.g., "Done"). Resolved to ID automatically'
      ),

    labels: LabelsModificationSchema.optional().describe('Label modifications'),

    projectId: z
      .string()
      .nullable()
      .optional()
      .describe('New project ID or null to remove from project'),

    dueDate: z
      .string()
      .nullable()
      .optional()
      .describe('New due date (YYYY-MM-DD) or null to clear'),

    estimate: z
      .number()
      .nullable()
      .optional()
      .describe('New estimate (points) or null to clear'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_teams
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('list_teams').describe('List all teams'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_projects
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_projects')
      .describe('List projects, optionally filtered by team'),

    teamId: z.string().optional().describe('Filter projects by team ID'),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of projects to return'),

    includeArchived: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include archived projects'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_workflow_states
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_workflow_states')
      .describe('List workflow states for a team'),

    teamId: z
      .string()
      .min(1, 'Team ID is required')
      .describe('Team ID to get workflow states for'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: add_comment
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('add_comment').describe('Add a comment to an issue'),

    issueId: z
      .string()
      .min(1, 'Issue ID is required')
      .describe('Issue ID (UUID) or identifier (e.g., "LIN-123")'),

    body: z
      .string()
      .min(1, 'Comment body is required')
      .describe('Comment text (supports markdown)'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: get_comments
  // -------------------------------------------------------------------------
  z.object({
    operation: z.literal('get_comments').describe('Get comments for an issue'),

    issueId: z
      .string()
      .min(1, 'Issue ID is required')
      .describe('Issue ID (UUID) or identifier (e.g., "LIN-123")'),

    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe('Maximum number of comments to return'),

    credentials: credentialsField,
  }),

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_labels
  // -------------------------------------------------------------------------
  z.object({
    operation: z
      .literal('list_labels')
      .describe('List labels, optionally filtered by team'),

    teamId: z.string().optional().describe('Filter labels by team ID'),

    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

export const LinearResultSchema = z.discriminatedUnion('operation', [
  // search result
  z.object({
    operation: z.literal('search'),
    success: z.boolean().describe('Whether the operation was successful'),
    issues: z.array(LinearIssueSchema).optional().describe('Found issues'),
    total: z.number().optional().describe('Total matching issues'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get result
  z.object({
    operation: z.literal('get'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue: LinearIssueSchema.optional().describe('Issue details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // create result
  z.object({
    operation: z.literal('create'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue: z
      .object({
        id: z.string().describe('Created issue ID'),
        identifier: z.string().describe('Created issue identifier'),
        url: z.string().optional().describe('Issue URL'),
      })
      .optional()
      .describe('Created issue info'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // update result
  z.object({
    operation: z.literal('update'),
    success: z.boolean().describe('Whether the operation was successful'),
    issue: z
      .object({
        id: z.string().describe('Updated issue ID'),
        identifier: z.string().describe('Updated issue identifier'),
      })
      .optional()
      .describe('Updated issue info'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_teams result
  z.object({
    operation: z.literal('list_teams'),
    success: z.boolean().describe('Whether the operation was successful'),
    teams: z.array(LinearTeamSchema).optional().describe('Available teams'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_projects result
  z.object({
    operation: z.literal('list_projects'),
    success: z.boolean().describe('Whether the operation was successful'),
    projects: z
      .array(LinearProjectSchema)
      .optional()
      .describe('Available projects'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_workflow_states result
  z.object({
    operation: z.literal('list_workflow_states'),
    success: z.boolean().describe('Whether the operation was successful'),
    states: z
      .array(LinearWorkflowStateSchema)
      .optional()
      .describe('Workflow states'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // add_comment result
  z.object({
    operation: z.literal('add_comment'),
    success: z.boolean().describe('Whether the operation was successful'),
    comment: LinearCommentSchema.optional().describe('Created comment'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // get_comments result
  z.object({
    operation: z.literal('get_comments'),
    success: z.boolean().describe('Whether the operation was successful'),
    comments: z
      .array(LinearCommentSchema)
      .optional()
      .describe('Issue comments'),
    total: z.number().optional().describe('Total comments'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // list_labels result
  z.object({
    operation: z.literal('list_labels'),
    success: z.boolean().describe('Whether the operation was successful'),
    labels: z.array(LinearLabelSchema).optional().describe('Available labels'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// OUTPUT type: What's stored internally (after validation/transformation)
export type LinearParams = z.output<typeof LinearParamsSchema>;

// INPUT type: What users pass (before validation)
export type LinearParamsInput = z.input<typeof LinearParamsSchema>;

// RESULT type: Always output (after validation)
export type LinearResult = z.output<typeof LinearResultSchema>;

// Operation-specific parameter types (for internal method signatures)
export type LinearSearchParams = Extract<LinearParams, { operation: 'search' }>;
export type LinearGetParams = Extract<LinearParams, { operation: 'get' }>;
export type LinearCreateParams = Extract<LinearParams, { operation: 'create' }>;
export type LinearUpdateParams = Extract<LinearParams, { operation: 'update' }>;
export type LinearListTeamsParams = Extract<
  LinearParams,
  { operation: 'list_teams' }
>;
export type LinearListProjectsParams = Extract<
  LinearParams,
  { operation: 'list_projects' }
>;
export type LinearListWorkflowStatesParams = Extract<
  LinearParams,
  { operation: 'list_workflow_states' }
>;
export type LinearAddCommentParams = Extract<
  LinearParams,
  { operation: 'add_comment' }
>;
export type LinearGetCommentsParams = Extract<
  LinearParams,
  { operation: 'get_comments' }
>;
export type LinearListLabelsParams = Extract<
  LinearParams,
  { operation: 'list_labels' }
>;

// Issue type for proper typing
export type LinearIssue = z.infer<typeof LinearIssueSchema>;
