import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  JiraParamsSchema,
  JiraResultSchema,
  type JiraParams,
  type JiraParamsInput,
  type JiraResult,
  type JiraSearchParams,
  type JiraGetParams,
  type JiraCreateParams,
  type JiraUpdateParams,
  type JiraTransitionParams,
  type JiraListTransitionsParams,
  type JiraListProjectsParams,
  type JiraListIssueTypesParams,
  type JiraAddCommentParams,
  type JiraGetCommentsParams,
} from './jira.schema.js';
import {
  textToADF,
  adfToText,
  enhanceErrorMessage,
  normalizeDate,
  findTransitionByStatus,
} from './jira.utils.js';

/**
 * Jira Service Bubble
 *
 * Agent-friendly Jira integration with minimal required parameters and smart defaults.
 *
 * Core Operations:
 * - search: Find issues using JQL queries
 * - get: Get details for a specific issue
 * - create: Create new issues with automatic ADF conversion
 * - update: Modify existing issues with flexible label operations
 * - transition: Change issue status by name (no ID lookup needed)
 *
 * Supporting Operations:
 * - list_transitions: Get available status transitions
 * - list_projects: Discover available projects
 * - list_issue_types: Get issue types for a project
 * - add_comment: Add a comment to an issue
 * - get_comments: Retrieve comments for an issue
 *
 * Features:
 * - Markdown or plain text descriptions/comments auto-converted to Atlassian Document Format (ADF)
 * - Supports markdown: **bold**, *italic*, `code`, [links](url), # headings, lists, > blockquotes, ``` code blocks ```, ~~strikethrough~~
 * - Status transitions by name (e.g., "Done") instead of IDs
 * - Flexible label operations (add/remove/set)
 * - Smart defaults for 90% of use cases
 *
 * Security Features:
 * - API token authentication via Jira Cloud
 * - Secure credential injection at runtime
 */
export class JiraBubble<
  T extends JiraParamsInput = JiraParamsInput,
> extends ServiceBubble<T, Extract<JiraResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'jira';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'jira';
  static readonly schema = JiraParamsSchema;
  static readonly resultSchema = JiraResultSchema;
  static readonly shortDescription =
    'Jira integration for issue tracking and project management';
  static readonly longDescription = `
    Agent-friendly Jira integration with minimal required parameters and smart defaults.

    Core Operations:
    - search: Find issues using JQL queries
    - get: Get details for a specific issue
    - create: Create new issues with automatic ADF conversion
    - update: Modify existing issues with flexible label operations
    - transition: Change issue status by name (no ID lookup needed)

    Supporting Operations:
    - list_transitions: Get available status transitions
    - list_projects: Discover available projects
    - list_issue_types: Get issue types for a project
    - add_comment: Add a comment to an issue
    - get_comments: Retrieve comments for an issue

    Features:
    - Markdown or plain text descriptions/comments auto-converted to Atlassian Document Format (ADF)
    - Status transitions by name (e.g., "Done") instead of IDs
    - Flexible label operations (add/remove/set)
    - Smart defaults for 90% of use cases

    Authentication:
    - OAuth 2.0 (recommended): Connect via Atlassian OAuth for secure access
    - API token (legacy): Use email + API token for Basic auth
    - Secure credential injection at runtime
  `;
  static readonly alias = 'jira';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const apiToken = this.chooseCredential();
    if (!apiToken) {
      throw new Error('Jira credentials are required');
    }

    try {
      // Test credentials by fetching user info
      const response = await this.makeJiraApiRequest(
        '/rest/api/3/myself',
        'GET'
      );
      return Boolean(response && response.accountId);
    } catch {
      return false;
    }
  }

  /**
   * Jira credential types:
   * 1. OAuth (recommended): { accessToken, cloudId, siteUrl } - Uses Bearer auth with Atlassian Cloud API
   * 2. API Token (legacy): { accessToken, baseUrl, email } - Uses Basic auth with Jira instance
   */
  private parseCredentials(): {
    accessToken: string;
    baseUrl: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const jiraCredRaw = credentials[CredentialType.JIRA_CRED];
    if (!jiraCredRaw) {
      return null;
    }

    // Decode base64-encoded JSON: { accessToken, cloudId, siteUrl }
    try {
      const decoded = Buffer.from(jiraCredRaw, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      if (parsed.accessToken && parsed.cloudId) {
        return {
          accessToken: parsed.accessToken,
          baseUrl: `https://api.atlassian.com/ex/jira/${parsed.cloudId}`,
        };
      }
    } catch {
      // Invalid credential format
    }

    return null;
  }

  private async makeJiraApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<Record<string, unknown>> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid Jira credentials. Expected base64-encoded JSON with { accessToken, cloudId }.'
      );
    }

    const url = `${creds.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      const enhancedError = enhanceErrorMessage(
        errorText,
        response.status,
        response.statusText
      );
      throw new Error(enhancedError);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }

    return {};
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<JiraResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<JiraResult> => {
        const parsedParams = this.params as JiraParams;

        switch (operation) {
          case 'search':
            return await this.search(parsedParams as JiraSearchParams);
          case 'get':
            return await this.get(parsedParams as JiraGetParams);
          case 'create':
            return await this.create(parsedParams as JiraCreateParams);
          case 'update':
            return await this.update(parsedParams as JiraUpdateParams);
          case 'transition':
            return await this.transition(parsedParams as JiraTransitionParams);
          case 'list_transitions':
            return await this.listTransitions(
              parsedParams as JiraListTransitionsParams
            );
          case 'list_projects':
            return await this.listProjects(
              parsedParams as JiraListProjectsParams
            );
          case 'list_issue_types':
            return await this.listIssueTypes(
              parsedParams as JiraListIssueTypesParams
            );
          case 'add_comment':
            return await this.addComment(parsedParams as JiraAddCommentParams);
          case 'get_comments':
            return await this.getComments(
              parsedParams as JiraGetCommentsParams
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<JiraResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<JiraResult, { operation: T['operation'] }>;
    }
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 1: search
  // -------------------------------------------------------------------------
  private async search(
    params: JiraSearchParams
  ): Promise<Extract<JiraResult, { operation: 'search' }>> {
    const { jql, limit, offset, fields } = params;

    const queryParams = new URLSearchParams({
      jql,
      startAt: String(offset ?? 0),
      maxResults: String(limit ?? 50),
    });

    if (fields && fields.length > 0) {
      queryParams.set('fields', fields.join(','));
    }

    // Use the new /search/jql endpoint (old /search was deprecated and returns 410)
    const response = await this.makeJiraApiRequest(
      `/rest/api/3/search/jql?${queryParams.toString()}`,
      'GET'
    );

    return {
      operation: 'search',
      success: true,
      issues: response.issues as JiraResult extends { issues?: infer I }
        ? I
        : never,
      total: response.total as number,
      offset: response.startAt as number,
      limit: response.maxResults as number,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 2: get
  // -------------------------------------------------------------------------
  private async get(
    params: JiraGetParams
  ): Promise<Extract<JiraResult, { operation: 'get' }>> {
    const { key, fields, expand } = params;

    const queryParams = new URLSearchParams();

    if (fields && fields.length > 0) {
      queryParams.set('fields', fields.join(','));
    }

    if (expand && expand.length > 0) {
      // Map expand options to Jira API expand values
      const expandValues = expand.map((e) => {
        switch (e) {
          case 'comments':
            return 'renderedFields';
          case 'changelog':
            return 'changelog';
          case 'transitions':
            return 'transitions';
          default:
            return e;
        }
      });
      queryParams.set('expand', expandValues.join(','));
    }

    const queryString = queryParams.toString();
    const endpoint = `/rest/api/3/issue/${encodeURIComponent(key)}${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeJiraApiRequest(endpoint, 'GET');

    return {
      operation: 'get',
      success: true,
      issue: response as JiraResult extends { issue?: infer I } ? I : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 3: create
  // -------------------------------------------------------------------------
  private async create(
    params: JiraCreateParams
  ): Promise<Extract<JiraResult, { operation: 'create' }>> {
    const {
      project,
      summary,
      type,
      description,
      assignee,
      priority,
      labels,
      parent,
      due_date,
    } = params;

    const fields: Record<string, unknown> = {
      project: { key: project },
      summary,
      issuetype: { name: type ?? 'Task' },
    };

    if (description) {
      fields.description = textToADF(description);
    }

    if (assignee) {
      // Try to determine if it's an account ID or email
      // Account IDs typically don't contain @ symbol
      if (assignee.includes('@')) {
        // Will need to look up account ID by email - for now use accountId field
        fields.assignee = { accountId: assignee };
      } else {
        fields.assignee = { accountId: assignee };
      }
    }

    if (priority) {
      fields.priority = { name: priority };
    }

    if (labels && labels.length > 0) {
      fields.labels = labels;
    }

    if (parent) {
      fields.parent = { key: parent };
    }

    if (due_date) {
      const normalizedDate = normalizeDate(due_date);
      if (normalizedDate) {
        fields.duedate = normalizedDate;
      }
    }

    const response = await this.makeJiraApiRequest(
      '/rest/api/3/issue',
      'POST',
      { fields }
    );

    return {
      operation: 'create',
      success: true,
      issue: {
        id: response.id as string,
        key: response.key as string,
        self: response.self as string,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 4: update
  // -------------------------------------------------------------------------
  private async update(
    params: JiraUpdateParams
  ): Promise<Extract<JiraResult, { operation: 'update' }>> {
    const {
      key,
      summary,
      description,
      assignee,
      priority,
      labels,
      due_date,
      comment,
    } = params;

    const fields: Record<string, unknown> = {};
    const update: Record<string, unknown[]> = {};

    if (summary !== undefined) {
      fields.summary = summary;
    }

    if (description !== undefined) {
      fields.description = textToADF(description);
    }

    if (assignee !== undefined) {
      if (assignee === null) {
        fields.assignee = null;
      } else {
        fields.assignee = { accountId: assignee };
      }
    }

    if (priority !== undefined) {
      fields.priority = { name: priority };
    }

    if (due_date !== undefined) {
      if (due_date === null) {
        fields.duedate = null;
      } else {
        const normalizedDate = normalizeDate(due_date);
        if (normalizedDate) {
          fields.duedate = normalizedDate;
        }
      }
    }

    // Handle labels modification
    if (labels !== undefined) {
      if (labels.set) {
        // Replace all labels
        fields.labels = labels.set;
      } else {
        // Use update operations for add/remove
        const labelOps: Array<{ add: string } | { remove: string }> = [];

        if (labels.add) {
          labels.add.forEach((label) => labelOps.push({ add: label }));
        }

        if (labels.remove) {
          labels.remove.forEach((label) => labelOps.push({ remove: label }));
        }

        if (labelOps.length > 0) {
          update.labels = labelOps;
        }
      }
    }

    const body: Record<string, unknown> = {};

    if (Object.keys(fields).length > 0) {
      body.fields = fields;
    }

    if (Object.keys(update).length > 0) {
      body.update = update;
    }

    // Update the issue
    await this.makeJiraApiRequest(
      `/rest/api/3/issue/${encodeURIComponent(key)}`,
      'PUT',
      body
    );

    // Add comment if provided
    if (comment) {
      await this.makeJiraApiRequest(
        `/rest/api/3/issue/${encodeURIComponent(key)}/comment`,
        'POST',
        { body: textToADF(comment) }
      );
    }

    return {
      operation: 'update',
      success: true,
      key,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 5: transition
  // -------------------------------------------------------------------------
  private async transition(
    params: JiraTransitionParams
  ): Promise<Extract<JiraResult, { operation: 'transition' }>> {
    const { key, status, transition_id, comment, resolution } = params;

    let targetTransitionId = transition_id;
    let targetStatusName: string | undefined;

    // If status name is provided, find the matching transition
    if (status && !transition_id) {
      const transitionsResponse = await this.makeJiraApiRequest(
        `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`,
        'GET'
      );

      const transitions = transitionsResponse.transitions as Array<{
        id: string;
        name: string;
        to?: { name: string };
      }>;

      const matchingTransition = findTransitionByStatus(transitions, status);

      if (!matchingTransition) {
        const availableTransitions = transitions
          .map((t) => `"${t.name}" → ${t.to?.name || 'unknown'}`)
          .join(', ');
        throw new Error(
          `No transition found to status "${status}". Available transitions: ${availableTransitions}`
        );
      }

      targetTransitionId = matchingTransition.id;
      targetStatusName = matchingTransition.to?.name || matchingTransition.name;
    }

    if (!targetTransitionId) {
      throw new Error('Either status or transition_id is required');
    }

    const body: Record<string, unknown> = {
      transition: { id: targetTransitionId },
    };

    // Add fields if resolution is specified
    if (resolution) {
      body.fields = {
        resolution: { name: resolution },
      };
    }

    // Add update with comment if provided
    if (comment) {
      body.update = {
        comment: [{ add: { body: textToADF(comment) } }],
      };
    }

    await this.makeJiraApiRequest(
      `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`,
      'POST',
      body
    );

    return {
      operation: 'transition',
      success: true,
      key,
      new_status: targetStatusName,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_transitions
  // -------------------------------------------------------------------------
  private async listTransitions(
    params: JiraListTransitionsParams
  ): Promise<Extract<JiraResult, { operation: 'list_transitions' }>> {
    const { key } = params;

    const response = await this.makeJiraApiRequest(
      `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`,
      'GET'
    );

    return {
      operation: 'list_transitions',
      success: true,
      transitions: response.transitions as JiraResult extends {
        transitions?: infer T;
      }
        ? T
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_projects
  // -------------------------------------------------------------------------
  private async listProjects(
    params: JiraListProjectsParams
  ): Promise<Extract<JiraResult, { operation: 'list_projects' }>> {
    const { limit, offset } = params;

    const queryParams = new URLSearchParams({
      startAt: String(offset ?? 0),
      maxResults: String(limit ?? 50),
    });

    const response = await this.makeJiraApiRequest(
      `/rest/api/3/project/search?${queryParams.toString()}`,
      'GET'
    );

    return {
      operation: 'list_projects',
      success: true,
      projects: response.values as JiraResult extends { projects?: infer P }
        ? P
        : never,
      total: response.total as number,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_issue_types
  // -------------------------------------------------------------------------
  private async listIssueTypes(
    params: JiraListIssueTypesParams
  ): Promise<Extract<JiraResult, { operation: 'list_issue_types' }>> {
    const { project } = params;

    const response = await this.makeJiraApiRequest(
      `/rest/api/3/project/${encodeURIComponent(project)}`,
      'GET'
    );

    // Issue types are nested in the project response
    const issueTypes = response.issueTypes as Array<{
      id: string;
      name: string;
      description?: string;
      subtask?: boolean;
    }>;

    return {
      operation: 'list_issue_types',
      success: true,
      issue_types: issueTypes?.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        subtask: it.subtask,
      })),
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: add_comment
  // -------------------------------------------------------------------------
  private async addComment(
    params: JiraAddCommentParams
  ): Promise<Extract<JiraResult, { operation: 'add_comment' }>> {
    const { key, body } = params;

    const response = await this.makeJiraApiRequest(
      `/rest/api/3/issue/${encodeURIComponent(key)}/comment`,
      'POST',
      { body: textToADF(body) }
    );

    return {
      operation: 'add_comment',
      success: true,
      comment: {
        id: response.id as string,
        body: body, // Return the original text for readability
        created: response.created as string,
        updated: response.updated as string,
        author: response.author as { accountId: string; displayName?: string },
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: get_comments
  // -------------------------------------------------------------------------
  private async getComments(
    params: JiraGetCommentsParams
  ): Promise<Extract<JiraResult, { operation: 'get_comments' }>> {
    const { key, limit, offset } = params;

    const queryParams = new URLSearchParams({
      startAt: String(offset ?? 0),
      maxResults: String(limit ?? 50),
    });

    const response = await this.makeJiraApiRequest(
      `/rest/api/3/issue/${encodeURIComponent(key)}/comment?${queryParams.toString()}`,
      'GET'
    );

    // Convert ADF body to plain text for readability
    const rawComments = response.comments as Array<{
      id: string;
      author?: unknown;
      body?: unknown;
      created?: string;
      updated?: string;
    }>;

    const comments = rawComments?.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.body, // Keep original ADF
      renderedBody: adfToText(c.body), // Add plain text version
      created: c.created,
      updated: c.updated,
    }));

    return {
      operation: 'get_comments',
      success: true,
      comments: comments as JiraResult extends { comments?: infer C }
        ? C
        : never,
      total: response.total as number,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // Return the raw credential value - will be parsed in parseCredentials()
    return credentials[CredentialType.JIRA_CRED];
  }
}
