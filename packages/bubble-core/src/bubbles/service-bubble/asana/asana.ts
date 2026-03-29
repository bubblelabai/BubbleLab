import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  AsanaParamsSchema,
  AsanaResultSchema,
  type AsanaParams,
  type AsanaParamsInput,
  type AsanaResult,
} from './asana.schema.js';

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

/**
 * Asana Service Bubble
 *
 * Comprehensive Asana integration for managing tasks, projects, sections,
 * comments, users, teams, tags, and more via the Asana REST API.
 */
export class AsanaBubble<
  T extends AsanaParamsInput = AsanaParamsInput,
> extends ServiceBubble<
  T,
  Extract<AsanaResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'asana';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'asana';
  static readonly schema = AsanaParamsSchema;
  static readonly resultSchema = AsanaResultSchema;
  static readonly shortDescription =
    'Asana integration for tasks, projects, and team collaboration';
  static readonly longDescription = `
    Comprehensive Asana project management integration.

    Features:
    - Create, read, update, delete, and search tasks
    - Manage projects, sections, and project memberships
    - Add comments and view task activity stories
    - List users, teams, and team members
    - Manage tags and custom fields
    - View attachments and workspaces
    - Filter tasks by project, section, assignee, dates, and completion status

    Security Features:
    - OAuth 2.0 authentication with Asana
    - Workspace-scoped access
    - Secure credential handling with base64-encoded payloads
  `;
  static readonly alias = '';

  constructor(
    params: T = {
      operation: 'list_tasks',
      project: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Asana credentials are required');
    }

    const response = await fetch(`${ASANA_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Asana API error (${response.status}): ${text}`);
    }
    return true;
  }

  private parseCredentials(): {
    accessToken: string;
    workspaceId: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const raw = credentials[CredentialType.ASANA_CRED];
    if (!raw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        workspaceId?: string;
      }>(raw);

      if (parsed.accessToken) {
        return {
          accessToken: parsed.accessToken,
          workspaceId: parsed.workspaceId || '',
        };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token (validator path)
    }

    return { accessToken: raw, workspaceId: '' };
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }

  /** Resolve workspace GID from params or credential metadata. */
  private getWorkspaceId(paramsWorkspace?: string): string {
    if (paramsWorkspace) return paramsWorkspace;
    const creds = this.parseCredentials();
    if (creds?.workspaceId) return creds.workspaceId;
    throw new Error(
      'Workspace GID is required. Provide it in the workspace parameter or ensure your Asana credential has workspace metadata.'
    );
  }

  // ─── API Request Helper ─────────────────────────────────────────────

  private async asanaRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Asana credentials are required');
    }

    const url = `${ASANA_API_BASE}${endpoint}`;

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await response.text();
      let message = `Asana API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors?.[0]?.message) {
          message += `: ${errorJson.errors[0].message}`;
        } else {
          message += `: ${errorText}`;
        }
      } catch {
        message += `: ${errorText}`;
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined;
    }

    return await response.json();
  }

  /** Build opt_fields query param string. */
  private buildOptFields(opt_fields?: string[]): string {
    if (!opt_fields || opt_fields.length === 0) return '';
    return `opt_fields=${opt_fields.join(',')}`;
  }

  /** Build query string from params object, omitting undefined/empty values. */
  private buildQuery(
    params: Record<string, string | number | boolean | undefined>
  ): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        parts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  // ─── Action Dispatcher ──────────────────────────────────────────────

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<AsanaResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<AsanaResult> => {
        const p = this.params as AsanaParams;
        switch (operation) {
          // Tasks
          case 'list_tasks':
            return await this.listTasks(
              p as Extract<AsanaParams, { operation: 'list_tasks' }>
            );
          case 'get_task':
            return await this.getTask(
              p as Extract<AsanaParams, { operation: 'get_task' }>
            );
          case 'create_task':
            return await this.createTask(
              p as Extract<AsanaParams, { operation: 'create_task' }>
            );
          case 'update_task':
            return await this.updateTask(
              p as Extract<AsanaParams, { operation: 'update_task' }>
            );
          case 'delete_task':
            return await this.deleteTask(
              p as Extract<AsanaParams, { operation: 'delete_task' }>
            );
          case 'search_tasks':
            return await this.searchTasks(
              p as Extract<AsanaParams, { operation: 'search_tasks' }>
            );
          case 'add_task_to_section':
            return await this.addTaskToSection(
              p as Extract<AsanaParams, { operation: 'add_task_to_section' }>
            );
          case 'set_dependencies':
            return await this.setDependencies(
              p as Extract<AsanaParams, { operation: 'set_dependencies' }>
            );
          // Projects
          case 'list_projects':
            return await this.listProjects(
              p as Extract<AsanaParams, { operation: 'list_projects' }>
            );
          case 'get_project':
            return await this.getProject(
              p as Extract<AsanaParams, { operation: 'get_project' }>
            );
          case 'create_project':
            return await this.createProject(
              p as Extract<AsanaParams, { operation: 'create_project' }>
            );
          case 'update_project':
            return await this.updateProject(
              p as Extract<AsanaParams, { operation: 'update_project' }>
            );
          case 'list_sections':
            return await this.listSections(
              p as Extract<AsanaParams, { operation: 'list_sections' }>
            );
          case 'create_section':
            return await this.createSection(
              p as Extract<AsanaParams, { operation: 'create_section' }>
            );
          // Comments / Stories
          case 'add_comment':
            return await this.addComment(
              p as Extract<AsanaParams, { operation: 'add_comment' }>
            );
          case 'get_task_stories':
            return await this.getTaskStories(
              p as Extract<AsanaParams, { operation: 'get_task_stories' }>
            );
          // Users & Teams
          case 'list_users':
            return await this.listUsers(
              p as Extract<AsanaParams, { operation: 'list_users' }>
            );
          case 'get_user':
            return await this.getUser(
              p as Extract<AsanaParams, { operation: 'get_user' }>
            );
          case 'list_teams':
            return await this.listTeams(
              p as Extract<AsanaParams, { operation: 'list_teams' }>
            );
          case 'list_team_members':
            return await this.listTeamMembers(
              p as Extract<AsanaParams, { operation: 'list_team_members' }>
            );
          // Tags
          case 'list_tags':
            return await this.listTags(
              p as Extract<AsanaParams, { operation: 'list_tags' }>
            );
          case 'create_tag':
            return await this.createTag(
              p as Extract<AsanaParams, { operation: 'create_tag' }>
            );
          case 'add_tag_to_task':
            return await this.addTagToTask(
              p as Extract<AsanaParams, { operation: 'add_tag_to_task' }>
            );
          case 'remove_tag_from_task':
            return await this.removeTagFromTask(
              p as Extract<AsanaParams, { operation: 'remove_tag_from_task' }>
            );
          // Workspaces
          case 'list_workspaces':
            return await this.listWorkspaces(
              p as Extract<AsanaParams, { operation: 'list_workspaces' }>
            );
          // Custom Fields
          case 'list_custom_fields':
            return await this.listCustomFields(
              p as Extract<AsanaParams, { operation: 'list_custom_fields' }>
            );
          // Attachments
          case 'list_attachments':
            return await this.listAttachments(
              p as Extract<AsanaParams, { operation: 'list_attachments' }>
            );
          // Subtasks
          case 'list_subtasks':
            return await this.listSubtasks(
              p as Extract<AsanaParams, { operation: 'list_subtasks' }>
            );
          // Task-Project Membership
          case 'add_task_to_project':
            return await this.addTaskToProject(
              p as Extract<AsanaParams, { operation: 'add_task_to_project' }>
            );
          case 'remove_task_from_project':
            return await this.removeTaskFromProject(
              p as Extract<
                AsanaParams,
                { operation: 'remove_task_from_project' }
              >
            );
          // Section Management
          case 'update_section':
            return await this.updateSection(
              p as Extract<AsanaParams, { operation: 'update_section' }>
            );
          case 'delete_section':
            return await this.deleteSection(
              p as Extract<AsanaParams, { operation: 'delete_section' }>
            );
          // Project Deletion
          case 'delete_project':
            return await this.deleteProject(
              p as Extract<AsanaParams, { operation: 'delete_project' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<AsanaResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<AsanaResult, { operation: T['operation'] }>;
    }
  }

  // ─── Task Operations ────────────────────────────────────────────────

  private async listTasks(
    params: Extract<AsanaParams, { operation: 'list_tasks' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_tasks' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      completed_since: params.completed_since,
      modified_since: params.modified_since,
    };

    if (params.opt_fields?.length) {
      queryParams.opt_fields = params.opt_fields.join(',');
    }

    if (params.section) {
      queryParams.section = params.section;
    } else if (params.project) {
      queryParams.project = params.project;
    } else if (params.assignee) {
      queryParams.assignee = params.assignee;
      queryParams.workspace = this.getWorkspaceId(params.workspace);
    } else {
      throw new Error(
        'At least one of project, section, or assignee must be provided'
      );
    }

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/tasks${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_tasks',
      success: true,
      tasks: data.data,
      error: '',
    };
  }

  private async getTask(
    params: Extract<AsanaParams, { operation: 'get_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'get_task' }>> {
    const optFields = this.buildOptFields(params.opt_fields);
    const qs = optFields ? `?${optFields}` : '';
    const data = (await this.asanaRequest(
      `/tasks/${params.task_gid}${qs}`
    )) as { data: Record<string, unknown> };

    return {
      operation: 'get_task',
      success: true,
      task: data.data,
      error: '',
    };
  }

  private async createTask(
    params: Extract<AsanaParams, { operation: 'create_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'create_task' }>> {
    const body: Record<string, unknown> = { name: params.name };

    if (params.notes) body.notes = params.notes;
    if (params.html_notes) body.html_notes = params.html_notes;
    if (params.assignee) body.assignee = params.assignee;
    if (params.due_on) body.due_on = params.due_on;
    if (params.due_at) body.due_at = params.due_at;
    if (params.start_on) body.start_on = params.start_on;
    if (params.projects) body.projects = params.projects;
    if (params.memberships) body.memberships = params.memberships;
    if (params.tags) body.tags = params.tags;
    if (params.parent) body.parent = params.parent;
    if (params.custom_fields) body.custom_fields = params.custom_fields;

    // If no project or parent specified, workspace is required
    if (
      !params.projects?.length &&
      !params.parent &&
      !params.memberships?.length
    ) {
      body.workspace = this.getWorkspaceId(params.workspace);
    }

    const data = (await this.asanaRequest('/tasks', 'POST', {
      data: body,
    })) as { data: Record<string, unknown> };

    return {
      operation: 'create_task',
      success: true,
      task: data.data,
      error: '',
    };
  }

  private async updateTask(
    params: Extract<AsanaParams, { operation: 'update_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'update_task' }>> {
    const body: Record<string, unknown> = {};

    if (params.name !== undefined) body.name = params.name;
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.html_notes !== undefined) body.html_notes = params.html_notes;
    if (params.assignee !== undefined) body.assignee = params.assignee;
    if (params.due_on !== undefined) body.due_on = params.due_on;
    if (params.due_at !== undefined) body.due_at = params.due_at;
    if (params.start_on !== undefined) body.start_on = params.start_on;
    if (params.completed !== undefined) body.completed = params.completed;
    if (params.custom_fields !== undefined)
      body.custom_fields = params.custom_fields;

    const data = (await this.asanaRequest(`/tasks/${params.task_gid}`, 'PUT', {
      data: body,
    })) as { data: Record<string, unknown> };

    return {
      operation: 'update_task',
      success: true,
      task: data.data,
      error: '',
    };
  }

  private async deleteTask(
    params: Extract<AsanaParams, { operation: 'delete_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'delete_task' }>> {
    await this.asanaRequest(`/tasks/${params.task_gid}`, 'DELETE');

    return {
      operation: 'delete_task',
      success: true,
      error: '',
    };
  }

  private async searchTasks(
    params: Extract<AsanaParams, { operation: 'search_tasks' }>
  ): Promise<Extract<AsanaResult, { operation: 'search_tasks' }>> {
    const workspaceId = this.getWorkspaceId(params.workspace);
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      sort_by: params.sort_by,
      sort_ascending: params.sort_ascending,
    };

    if (params.text) queryParams['text'] = params.text;
    if (params.assignee) queryParams['assignee.any'] = params.assignee;
    if (params.projects?.length)
      queryParams['projects.any'] = params.projects.join(',');
    if (params.completed !== undefined)
      queryParams['completed'] = params.completed;
    if (params.is_subtask !== undefined)
      queryParams['is_subtask'] = params.is_subtask;
    if (params.opt_fields?.length)
      queryParams['opt_fields'] = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/workspaces/${workspaceId}/tasks/search${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'search_tasks',
      success: true,
      tasks: data.data,
      error: '',
    };
  }

  private async addTaskToSection(
    params: Extract<AsanaParams, { operation: 'add_task_to_section' }>
  ): Promise<Extract<AsanaResult, { operation: 'add_task_to_section' }>> {
    const body: Record<string, unknown> = { task: params.task_gid };
    if (params.insert_before) body.insert_before = params.insert_before;
    if (params.insert_after) body.insert_after = params.insert_after;

    await this.asanaRequest(`/sections/${params.section_gid}/addTask`, 'POST', {
      data: body,
    });

    return {
      operation: 'add_task_to_section',
      success: true,
      error: '',
    };
  }

  private async setDependencies(
    params: Extract<AsanaParams, { operation: 'set_dependencies' }>
  ): Promise<Extract<AsanaResult, { operation: 'set_dependencies' }>> {
    await this.asanaRequest(
      `/tasks/${params.task_gid}/addDependencies`,
      'POST',
      { data: { dependencies: params.dependencies } }
    );

    return {
      operation: 'set_dependencies',
      success: true,
      error: '',
    };
  }

  // ─── Project Operations ─────────────────────────────────────────────

  private async listProjects(
    params: Extract<AsanaParams, { operation: 'list_projects' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_projects' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      archived: params.archived,
    };

    if (params.team) {
      queryParams.team = params.team;
    } else {
      queryParams.workspace = this.getWorkspaceId(params.workspace);
    }

    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/projects${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_projects',
      success: true,
      projects: data.data,
      error: '',
    };
  }

  private async getProject(
    params: Extract<AsanaParams, { operation: 'get_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'get_project' }>> {
    const optFields = this.buildOptFields(params.opt_fields);
    const qs = optFields ? `?${optFields}` : '';
    const data = (await this.asanaRequest(
      `/projects/${params.project_gid}${qs}`
    )) as { data: Record<string, unknown> };

    return {
      operation: 'get_project',
      success: true,
      project: data.data,
      error: '',
    };
  }

  private async createProject(
    params: Extract<AsanaParams, { operation: 'create_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'create_project' }>> {
    const body: Record<string, unknown> = {
      name: params.name,
      workspace: this.getWorkspaceId(params.workspace),
    };

    if (params.notes) body.notes = params.notes;
    if (params.team) body.team = params.team;
    if (params.color) body.color = params.color;
    if (params.layout) body.default_view = params.layout;
    if (params.is_template !== undefined) body.is_template = params.is_template;
    if (params.public !== undefined) body.public = params.public;

    const data = (await this.asanaRequest('/projects', 'POST', {
      data: body,
    })) as { data: Record<string, unknown> };

    return {
      operation: 'create_project',
      success: true,
      project: data.data,
      error: '',
    };
  }

  private async updateProject(
    params: Extract<AsanaParams, { operation: 'update_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'update_project' }>> {
    const body: Record<string, unknown> = {};

    if (params.name !== undefined) body.name = params.name;
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.color !== undefined) body.color = params.color;
    if (params.archived !== undefined) body.archived = params.archived;
    if (params.public !== undefined) body.public = params.public;
    if (params.due_on !== undefined) body.due_on = params.due_on;
    if (params.start_on !== undefined) body.start_on = params.start_on;

    const data = (await this.asanaRequest(
      `/projects/${params.project_gid}`,
      'PUT',
      { data: body }
    )) as { data: Record<string, unknown> };

    return {
      operation: 'update_project',
      success: true,
      project: data.data,
      error: '',
    };
  }

  private async listSections(
    params: Extract<AsanaParams, { operation: 'list_sections' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_sections' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/projects/${params.project_gid}/sections${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'list_sections',
      success: true,
      sections: data.data,
      error: '',
    };
  }

  private async createSection(
    params: Extract<AsanaParams, { operation: 'create_section' }>
  ): Promise<Extract<AsanaResult, { operation: 'create_section' }>> {
    const body: Record<string, unknown> = { name: params.name };
    if (params.insert_before) body.insert_before = params.insert_before;
    if (params.insert_after) body.insert_after = params.insert_after;

    const data = (await this.asanaRequest(
      `/projects/${params.project_gid}/sections`,
      'POST',
      { data: body }
    )) as { data: Record<string, unknown> };

    return {
      operation: 'create_section',
      success: true,
      section: data.data,
      error: '',
    };
  }

  // ─── Comment / Story Operations ─────────────────────────────────────

  private async addComment(
    params: Extract<AsanaParams, { operation: 'add_comment' }>
  ): Promise<Extract<AsanaResult, { operation: 'add_comment' }>> {
    const body: Record<string, unknown> = {};
    if (params.html_text) {
      body.html_text = params.html_text;
    } else if (params.text) {
      body.text = params.text;
    } else {
      throw new Error('Either text or html_text must be provided');
    }

    const data = (await this.asanaRequest(
      `/tasks/${params.task_gid}/stories`,
      'POST',
      { data: body }
    )) as { data: Record<string, unknown> };

    return {
      operation: 'add_comment',
      success: true,
      story: data.data,
      error: '',
    };
  }

  private async getTaskStories(
    params: Extract<AsanaParams, { operation: 'get_task_stories' }>
  ): Promise<Extract<AsanaResult, { operation: 'get_task_stories' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/tasks/${params.task_gid}/stories${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'get_task_stories',
      success: true,
      stories: data.data,
      error: '',
    };
  }

  // ─── User & Team Operations ─────────────────────────────────────────

  private async listUsers(
    params: Extract<AsanaParams, { operation: 'list_users' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_users' }>> {
    const workspaceId = this.getWorkspaceId(params.workspace);
    const queryParams: Record<string, string | number | boolean | undefined> = {
      workspace: workspaceId,
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/users${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_users',
      success: true,
      users: data.data,
      error: '',
    };
  }

  private async getUser(
    params: Extract<AsanaParams, { operation: 'get_user' }>
  ): Promise<Extract<AsanaResult, { operation: 'get_user' }>> {
    const optFields = this.buildOptFields(params.opt_fields);
    const qs = optFields ? `?${optFields}` : '';
    const data = (await this.asanaRequest(
      `/users/${params.user_gid}${qs}`
    )) as { data: Record<string, unknown> };

    return {
      operation: 'get_user',
      success: true,
      user: data.data,
      error: '',
    };
  }

  private async listTeams(
    params: Extract<AsanaParams, { operation: 'list_teams' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_teams' }>> {
    const workspaceId = this.getWorkspaceId(params.workspace);
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/organizations/${workspaceId}/teams${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'list_teams',
      success: true,
      teams: data.data,
      error: '',
    };
  }

  private async listTeamMembers(
    params: Extract<AsanaParams, { operation: 'list_team_members' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_team_members' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/teams/${params.team_gid}/users${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'list_team_members',
      success: true,
      users: data.data,
      error: '',
    };
  }

  // ─── Tag Operations ─────────────────────────────────────────────────

  private async listTags(
    params: Extract<AsanaParams, { operation: 'list_tags' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_tags' }>> {
    const workspaceId = this.getWorkspaceId(params.workspace);
    const queryParams: Record<string, string | number | boolean | undefined> = {
      workspace: workspaceId,
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/tags${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_tags',
      success: true,
      tags: data.data,
      error: '',
    };
  }

  private async createTag(
    params: Extract<AsanaParams, { operation: 'create_tag' }>
  ): Promise<Extract<AsanaResult, { operation: 'create_tag' }>> {
    const body: Record<string, unknown> = {
      name: params.name,
      workspace: this.getWorkspaceId(params.workspace),
    };
    if (params.color) body.color = params.color;

    const data = (await this.asanaRequest('/tags', 'POST', {
      data: body,
    })) as { data: Record<string, unknown> };

    return {
      operation: 'create_tag',
      success: true,
      tag: data.data,
      error: '',
    };
  }

  private async addTagToTask(
    params: Extract<AsanaParams, { operation: 'add_tag_to_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'add_tag_to_task' }>> {
    await this.asanaRequest(`/tasks/${params.task_gid}/addTag`, 'POST', {
      data: { tag: params.tag_gid },
    });

    return {
      operation: 'add_tag_to_task',
      success: true,
      error: '',
    };
  }

  private async removeTagFromTask(
    params: Extract<AsanaParams, { operation: 'remove_tag_from_task' }>
  ): Promise<Extract<AsanaResult, { operation: 'remove_tag_from_task' }>> {
    await this.asanaRequest(`/tasks/${params.task_gid}/removeTag`, 'POST', {
      data: { tag: params.tag_gid },
    });

    return {
      operation: 'remove_tag_from_task',
      success: true,
      error: '',
    };
  }

  // ─── Workspace Operations ──────────────────────────────────────────

  private async listWorkspaces(
    params: Extract<AsanaParams, { operation: 'list_workspaces' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_workspaces' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/workspaces${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_workspaces',
      success: true,
      workspaces: data.data,
      error: '',
    };
  }

  // ─── Custom Fields Operations ───────────────────────────────────────

  private async listCustomFields(
    params: Extract<AsanaParams, { operation: 'list_custom_fields' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_custom_fields' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/projects/${params.project_gid}/custom_field_settings${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'list_custom_fields',
      success: true,
      custom_fields: data.data,
      error: '',
    };
  }

  // ─── Attachment Operations ──────────────────────────────────────────

  private async listAttachments(
    params: Extract<AsanaParams, { operation: 'list_attachments' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_attachments' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      parent: params.task_gid,
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(`/attachments${qs}`)) as {
      data: Record<string, unknown>[];
    };

    return {
      operation: 'list_attachments',
      success: true,
      attachments: data.data,
      error: '',
    };
  }

  // ─── Subtask Operations ─────────────────────────────────────────────

  private async listSubtasks(
    params: Extract<AsanaParams, { operation: 'list_subtasks' }>
  ): Promise<Extract<AsanaResult, { operation: 'list_subtasks' }>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.opt_fields?.length)
      queryParams.opt_fields = params.opt_fields.join(',');

    const qs = this.buildQuery(queryParams);
    const data = (await this.asanaRequest(
      `/tasks/${params.task_gid}/subtasks${qs}`
    )) as { data: Record<string, unknown>[] };

    return {
      operation: 'list_subtasks',
      success: true,
      tasks: data.data,
      error: '',
    };
  }

  // ─── Task-Project Membership Operations ─────────────────────────────

  private async addTaskToProject(
    params: Extract<AsanaParams, { operation: 'add_task_to_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'add_task_to_project' }>> {
    const body: Record<string, unknown> = { project: params.project_gid };
    if (params.section_gid) body.section = params.section_gid;

    await this.asanaRequest(`/tasks/${params.task_gid}/addProject`, 'POST', {
      data: body,
    });

    return {
      operation: 'add_task_to_project',
      success: true,
      error: '',
    };
  }

  private async removeTaskFromProject(
    params: Extract<AsanaParams, { operation: 'remove_task_from_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'remove_task_from_project' }>> {
    await this.asanaRequest(`/tasks/${params.task_gid}/removeProject`, 'POST', {
      data: { project: params.project_gid },
    });

    return {
      operation: 'remove_task_from_project',
      success: true,
      error: '',
    };
  }

  // ─── Section Management Operations ──────────────────────────────────

  private async updateSection(
    params: Extract<AsanaParams, { operation: 'update_section' }>
  ): Promise<Extract<AsanaResult, { operation: 'update_section' }>> {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;

    const data = (await this.asanaRequest(
      `/sections/${params.section_gid}`,
      'PUT',
      { data: body }
    )) as { data: Record<string, unknown> };

    return {
      operation: 'update_section',
      success: true,
      section: data.data,
      error: '',
    };
  }

  private async deleteSection(
    params: Extract<AsanaParams, { operation: 'delete_section' }>
  ): Promise<Extract<AsanaResult, { operation: 'delete_section' }>> {
    await this.asanaRequest(`/sections/${params.section_gid}`, 'DELETE');

    return {
      operation: 'delete_section',
      success: true,
      error: '',
    };
  }

  // ─── Project Deletion ───────────────────────────────────────────────

  private async deleteProject(
    params: Extract<AsanaParams, { operation: 'delete_project' }>
  ): Promise<Extract<AsanaResult, { operation: 'delete_project' }>> {
    await this.asanaRequest(`/projects/${params.project_gid}`, 'DELETE');

    return {
      operation: 'delete_project',
      success: true,
      error: '',
    };
  }
}
