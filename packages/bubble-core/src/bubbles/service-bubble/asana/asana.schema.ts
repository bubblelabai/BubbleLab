import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ─── Shared Fields ────────────────────────────────────────────────────

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const taskGidField = z
  .string()
  .min(1, 'Task GID is required')
  .describe('Asana task GID (globally unique identifier)');

const projectGidField = z
  .string()
  .min(1, 'Project GID is required')
  .describe('Asana project GID');

const optFieldsField = z
  .array(z.string())
  .optional()
  .describe(
    'Optional fields to include in the response (e.g. ["name","assignee","due_on","notes","completed","custom_fields","tags","memberships"])'
  );

const limitField = z
  .number()
  .min(1)
  .max(100)
  .optional()
  .default(50)
  .describe('Maximum number of results to return (1-100, default 50)');

// ─── Parameter Schema ─────────────────────────────────────────────────

export const AsanaParamsSchema = z.discriminatedUnion('operation', [
  // ── Tasks ───────────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_tasks')
      .describe(
        'List tasks in a project, section, or assigned to a user. Provide at least one of project, section, or assignee.'
      ),
    project: z
      .string()
      .optional()
      .describe('[ONEOF:scope] Project GID to list tasks from'),
    section: z
      .string()
      .optional()
      .describe('[ONEOF:scope] Section GID to list tasks from'),
    assignee: z
      .string()
      .optional()
      .describe(
        '[ONEOF:scope] User GID or "me" to list tasks assigned to this user (requires workspace)'
      ),
    workspace: z
      .string()
      .optional()
      .describe(
        'Workspace GID (required when filtering by assignee, auto-filled from credential if not provided)'
      ),
    completed_since: z
      .string()
      .optional()
      .describe(
        'Only return tasks completed since this date (ISO 8601 format, e.g. "2024-01-01T00:00:00Z"). Use "now" to only show incomplete tasks.'
      ),
    modified_since: z
      .string()
      .optional()
      .describe('Only return tasks modified since this date (ISO 8601 format)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_task')
      .describe('Get detailed information about a specific task'),
    task_gid: taskGidField,
    opt_fields: optFieldsField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_task')
      .describe('Create a new task in a project or workspace'),
    name: z.string().min(1).describe('Name/title of the task'),
    notes: z.string().optional().describe('Description/notes for the task'),
    html_notes: z
      .string()
      .optional()
      .describe('HTML-formatted description (overrides notes if provided)'),
    assignee: z
      .string()
      .optional()
      .describe('User GID to assign the task to, or "me"'),
    due_on: z
      .string()
      .optional()
      .describe('Due date in YYYY-MM-DD format (e.g. "2024-12-31")'),
    due_at: z
      .string()
      .optional()
      .describe(
        'Due date and time in ISO 8601 format (e.g. "2024-12-31T17:00:00Z")'
      ),
    start_on: z.string().optional().describe('Start date in YYYY-MM-DD format'),
    projects: z
      .array(z.string())
      .optional()
      .describe('Array of project GIDs to add this task to'),
    memberships: z
      .array(
        z.object({
          project: z.string().describe('Project GID'),
          section: z.string().describe('Section GID within the project'),
        })
      )
      .optional()
      .describe('Array of project/section memberships for the task'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Array of tag GIDs to add to this task'),
    parent: z
      .string()
      .optional()
      .describe('Parent task GID to create this as a subtask'),
    workspace: z
      .string()
      .optional()
      .describe(
        'Workspace GID (required if no project specified, auto-filled from credential)'
      ),
    custom_fields: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe(
        'Custom field values as { custom_field_gid: value }. For enum fields, use the enum option GID as the value.'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('update_task')
      .describe(
        'Update an existing task (name, assignee, due date, status, etc.)'
      ),
    task_gid: taskGidField,
    name: z.string().optional().describe('New name/title for the task'),
    notes: z.string().optional().describe('New description/notes for the task'),
    html_notes: z
      .string()
      .optional()
      .describe('New HTML-formatted description'),
    assignee: z
      .string()
      .nullable()
      .optional()
      .describe('User GID to assign the task to, "me", or null to unassign'),
    due_on: z
      .string()
      .nullable()
      .optional()
      .describe('Due date in YYYY-MM-DD format, or null to clear'),
    due_at: z
      .string()
      .nullable()
      .optional()
      .describe('Due date and time in ISO 8601 format, or null to clear'),
    start_on: z
      .string()
      .nullable()
      .optional()
      .describe('Start date in YYYY-MM-DD format, or null to clear'),
    completed: z
      .boolean()
      .optional()
      .describe('Set to true to mark complete, false to mark incomplete'),
    custom_fields: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Custom field values to update as { custom_field_gid: value }'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('delete_task').describe('Delete a task permanently'),
    task_gid: taskGidField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('search_tasks')
      .describe('Search for tasks in a workspace using text and/or filters'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID to search in (auto-filled from credential)'),
    text: z
      .string()
      .optional()
      .describe('Text to search for in task names and descriptions'),
    assignee: z
      .string()
      .optional()
      .describe('Filter by assignee user GID or "me"'),
    projects: z
      .array(z.string())
      .optional()
      .describe('Filter by project GID(s)'),
    completed: z
      .boolean()
      .optional()
      .describe(
        'Filter by completion status (true=completed, false=incomplete)'
      ),
    is_subtask: z.boolean().optional().describe('Filter by subtask status'),
    sort_by: z
      .enum(['due_date', 'created_at', 'completed_at', 'likes', 'modified_at'])
      .optional()
      .default('modified_at')
      .describe('Sort results by this field'),
    sort_ascending: z
      .boolean()
      .optional()
      .default(false)
      .describe('Sort in ascending order (default false = descending)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('add_task_to_section')
      .describe('Add a task to a specific section within a project'),
    task_gid: taskGidField,
    section_gid: z.string().min(1).describe('Section GID to add the task to'),
    insert_before: z
      .string()
      .optional()
      .describe('Task GID to insert before in the section'),
    insert_after: z
      .string()
      .optional()
      .describe('Task GID to insert after in the section'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('set_dependencies')
      .describe(
        'Set dependencies for a task (tasks that must be completed before this one)'
      ),
    task_gid: taskGidField,
    dependencies: z
      .array(z.string())
      .describe('Array of task GIDs that this task depends on'),
    credentials: credentialsField,
  }),

  // ── Projects ────────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_projects')
      .describe('List projects in a workspace or team'),
    workspace: z
      .string()
      .optional()
      .describe(
        '[ONEOF:scope] Workspace GID (auto-filled from credential if not provided)'
      ),
    team: z
      .string()
      .optional()
      .describe('[ONEOF:scope] Team GID to list projects for'),
    archived: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include archived projects (default false)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_project')
      .describe('Get detailed information about a specific project'),
    project_gid: projectGidField,
    opt_fields: optFieldsField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_project')
      .describe('Create a new project in a workspace or team'),
    name: z.string().min(1).describe('Name of the project'),
    notes: z.string().optional().describe('Description/notes for the project'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID (auto-filled from credential)'),
    team: z
      .string()
      .optional()
      .describe(
        'Team GID (required for organization workspaces, optional for personal workspaces)'
      ),
    color: z
      .string()
      .optional()
      .describe(
        'Project color (e.g. "dark-pink", "dark-green", "dark-blue", "dark-red", "dark-orange", "dark-purple", "dark-warm-gray", "light-pink", "light-green", "light-blue", "light-red", "light-orange", "light-purple", "light-warm-gray")'
      ),
    layout: z
      .enum(['board', 'list', 'timeline', 'calendar'])
      .optional()
      .default('list')
      .describe('Project layout/view type (default "list")'),
    is_template: z
      .boolean()
      .optional()
      .describe('Whether to create as a project template'),
    public: z
      .boolean()
      .optional()
      .describe(
        'Whether the project is public to the organization (default true)'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('update_project')
      .describe('Update an existing project'),
    project_gid: projectGidField,
    name: z.string().optional().describe('New name for the project'),
    notes: z.string().optional().describe('New description/notes'),
    color: z.string().optional().describe('New project color'),
    archived: z
      .boolean()
      .optional()
      .describe('Set to true to archive, false to unarchive'),
    public: z.boolean().optional().describe('Set project visibility'),
    due_on: z
      .string()
      .nullable()
      .optional()
      .describe('Project due date in YYYY-MM-DD format, or null to clear'),
    start_on: z
      .string()
      .nullable()
      .optional()
      .describe('Project start date in YYYY-MM-DD format, or null to clear'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_sections')
      .describe('List sections in a project'),
    project_gid: projectGidField,
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_section')
      .describe('Create a new section in a project'),
    project_gid: projectGidField,
    name: z.string().min(1).describe('Name of the section'),
    insert_before: z
      .string()
      .optional()
      .describe('Section GID to insert before'),
    insert_after: z.string().optional().describe('Section GID to insert after'),
    credentials: credentialsField,
  }),

  // ── Comments / Stories ──────────────────────────────────────────────

  z.object({
    operation: z.literal('add_comment').describe('Add a comment to a task'),
    task_gid: taskGidField,
    text: z
      .string()
      .optional()
      .describe('[ONEOF:body] Plain text comment body'),
    html_text: z
      .string()
      .optional()
      .describe(
        '[ONEOF:body] HTML-formatted comment body (e.g. "<body>Great work!</body>")'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_task_stories')
      .describe('Get comments and activity stories for a task'),
    task_gid: taskGidField,
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Users & Teams ───────────────────────────────────────────────────

  z.object({
    operation: z.literal('list_users').describe('List users in a workspace'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID (auto-filled from credential)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_user')
      .describe('Get details about a specific user'),
    user_gid: z
      .string()
      .min(1)
      .describe('User GID or "me" for the authenticated user'),
    opt_fields: optFieldsField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_teams')
      .describe('List teams in a workspace/organization'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID (auto-filled from credential)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_team_members')
      .describe('List members of a team'),
    team_gid: z.string().min(1).describe('Team GID'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Tags ────────────────────────────────────────────────────────────

  z.object({
    operation: z.literal('list_tags').describe('List tags in a workspace'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID (auto-filled from credential)'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('create_tag').describe('Create a new tag'),
    name: z.string().min(1).describe('Name of the tag'),
    workspace: z
      .string()
      .optional()
      .describe('Workspace GID (auto-filled from credential)'),
    color: z
      .string()
      .optional()
      .describe('Tag color (e.g. "dark-pink", "dark-green", "light-blue")'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('add_tag_to_task').describe('Add a tag to a task'),
    task_gid: taskGidField,
    tag_gid: z.string().min(1).describe('Tag GID to add'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('remove_tag_from_task')
      .describe('Remove a tag from a task'),
    task_gid: taskGidField,
    tag_gid: z.string().min(1).describe('Tag GID to remove'),
    credentials: credentialsField,
  }),

  // ── Workspaces ──────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_workspaces')
      .describe('List all workspaces the authenticated user has access to'),
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Custom Fields ───────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_custom_fields')
      .describe('List custom field settings for a project'),
    project_gid: projectGidField,
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Attachments ─────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_attachments')
      .describe('List attachments on a task'),
    task_gid: taskGidField,
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Subtasks ────────────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('list_subtasks')
      .describe('List subtasks (children) of a task'),
    task_gid: taskGidField,
    opt_fields: optFieldsField,
    limit: limitField,
    credentials: credentialsField,
  }),

  // ── Task-Project Membership ─────────────────────────────────────────

  z.object({
    operation: z
      .literal('add_task_to_project')
      .describe(
        'Add a task to a project (task can belong to multiple projects)'
      ),
    task_gid: taskGidField,
    project_gid: projectGidField,
    section_gid: z
      .string()
      .optional()
      .describe('Optional section GID to place the task in within the project'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('remove_task_from_project')
      .describe(
        'Remove a task from a project (task still exists, just no longer in this project)'
      ),
    task_gid: taskGidField,
    project_gid: projectGidField,
    credentials: credentialsField,
  }),

  // ── Section Management ──────────────────────────────────────────────

  z.object({
    operation: z
      .literal('update_section')
      .describe('Rename or reorder a section'),
    section_gid: z.string().min(1).describe('Section GID to update'),
    name: z.string().optional().describe('New name for the section'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('delete_section')
      .describe(
        'Delete a section from a project (tasks in it are NOT deleted, they become unsectioned)'
      ),
    section_gid: z.string().min(1).describe('Section GID to delete'),
    credentials: credentialsField,
  }),

  // ── Project Deletion ────────────────────────────────────────────────

  z.object({
    operation: z
      .literal('delete_project')
      .describe('Permanently delete a project and all its tasks'),
    project_gid: projectGidField,
    credentials: credentialsField,
  }),
]);

// ─── Asana Record Schema ──────────────────────────────────────────────

const AsanaResourceSchema = z
  .record(z.string(), z.unknown())
  .describe('An Asana resource object with its fields');

// ─── Result Schema ────────────────────────────────────────────────────

export const AsanaResultSchema = z.discriminatedUnion('operation', [
  // Tasks
  z.object({
    operation: z.literal('list_tasks'),
    success: z.boolean(),
    tasks: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_task'),
    success: z.boolean(),
    task: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_task'),
    success: z.boolean(),
    task: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_task'),
    success: z.boolean(),
    task: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_task'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('search_tasks'),
    success: z.boolean(),
    tasks: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('add_task_to_section'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('set_dependencies'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Projects
  z.object({
    operation: z.literal('list_projects'),
    success: z.boolean(),
    projects: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_project'),
    success: z.boolean(),
    project: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_project'),
    success: z.boolean(),
    project: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_project'),
    success: z.boolean(),
    project: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_sections'),
    success: z.boolean(),
    sections: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_section'),
    success: z.boolean(),
    section: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  // Comments / Stories
  z.object({
    operation: z.literal('add_comment'),
    success: z.boolean(),
    story: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_task_stories'),
    success: z.boolean(),
    stories: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Users & Teams
  z.object({
    operation: z.literal('list_users'),
    success: z.boolean(),
    users: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_user'),
    success: z.boolean(),
    user: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_teams'),
    success: z.boolean(),
    teams: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_team_members'),
    success: z.boolean(),
    users: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Tags
  z.object({
    operation: z.literal('list_tags'),
    success: z.boolean(),
    tags: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_tag'),
    success: z.boolean(),
    tag: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('add_tag_to_task'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('remove_tag_from_task'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Workspaces
  z.object({
    operation: z.literal('list_workspaces'),
    success: z.boolean(),
    workspaces: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Custom Fields
  z.object({
    operation: z.literal('list_custom_fields'),
    success: z.boolean(),
    custom_fields: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Attachments
  z.object({
    operation: z.literal('list_attachments'),
    success: z.boolean(),
    attachments: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Subtasks
  z.object({
    operation: z.literal('list_subtasks'),
    success: z.boolean(),
    tasks: z.array(AsanaResourceSchema).optional(),
    error: z.string(),
  }),
  // Task-Project Membership
  z.object({
    operation: z.literal('add_task_to_project'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('remove_task_from_project'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Section Management
  z.object({
    operation: z.literal('update_section'),
    success: z.boolean(),
    section: AsanaResourceSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_section'),
    success: z.boolean(),
    error: z.string(),
  }),
  // Project Deletion
  z.object({
    operation: z.literal('delete_project'),
    success: z.boolean(),
    error: z.string(),
  }),
]);

// ─── Type Exports ─────────────────────────────────────────────────────

export type AsanaParams = z.output<typeof AsanaParamsSchema>;
export type AsanaParamsInput = z.input<typeof AsanaParamsSchema>;
export type AsanaResult = z.output<typeof AsanaResultSchema>;
