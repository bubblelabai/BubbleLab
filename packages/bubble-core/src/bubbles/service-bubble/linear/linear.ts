import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  LinearParamsSchema,
  LinearResultSchema,
  type LinearParams,
  type LinearParamsInput,
  type LinearResult,
  type LinearSearchParams,
  type LinearGetParams,
  type LinearCreateParams,
  type LinearUpdateParams,
  type LinearListTeamsParams,
  type LinearListProjectsParams,
  type LinearListWorkflowStatesParams,
  type LinearAddCommentParams,
  type LinearGetCommentsParams,
  type LinearListLabelsParams,
} from './linear.schema.js';
import {
  makeGraphQLRequest,
  buildSearchQuery,
  buildSearchByTextQuery,
  buildGetIssueQuery,
  buildCreateIssueMutation,
  buildUpdateIssueMutation,
  buildListTeamsQuery,
  buildListProjectsQuery,
  buildListWorkflowStatesQuery,
  buildAddCommentMutation,
  buildGetCommentsQuery,
  buildListLabelsQuery,
} from './linear.utils.js';

/**
 * Linear Service Bubble
 *
 * Agent-friendly Linear integration for issue tracking and project management.
 *
 * Core Operations:
 * - search: Find issues with text query and filters
 * - get: Get details for a specific issue
 * - create: Create new issues with markdown support
 * - update: Modify existing issues (including state changes by name)
 *
 * Supporting Operations:
 * - list_teams: List all teams
 * - list_projects: List projects (optionally by team)
 * - list_workflow_states: List workflow states for a team
 * - add_comment: Add a comment to an issue
 * - get_comments: Get comments for an issue
 * - list_labels: List labels (optionally by team)
 *
 * Features:
 * - Markdown descriptions and comments (native support)
 * - State transitions by name (auto-resolved to IDs)
 * - GraphQL API for efficient data fetching
 * - OAuth 2.0 authentication
 */
export class LinearBubble<
  T extends LinearParamsInput = LinearParamsInput,
> extends ServiceBubble<
  T,
  Extract<LinearResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'linear';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'linear';
  static readonly schema = LinearParamsSchema;
  static readonly resultSchema = LinearResultSchema;
  static readonly shortDescription =
    'Linear integration for issue tracking and project management';
  static readonly longDescription = `
    Agent-friendly Linear integration for issue tracking and project management.

    Core Operations:
    - search: Find issues with text query and filters
    - get: Get details for a specific issue
    - create: Create new issues with markdown support
    - update: Modify existing issues (including state changes by name)

    Supporting Operations:
    - list_teams: List all teams
    - list_projects: List projects (optionally by team)
    - list_workflow_states: List workflow states for a team
    - add_comment: Add a comment to an issue
    - get_comments: Get comments for an issue
    - list_labels: List labels (optionally by team)

    Features:
    - Markdown descriptions and comments (native Linear markdown support)
    - State transitions by name (auto-resolved to IDs)
    - GraphQL API for efficient data fetching
    - OAuth 2.0 authentication
  `;
  static readonly alias = 'linear';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const accessToken = this.chooseCredential();
    if (!accessToken) {
      throw new Error('Linear credentials are required');
    }

    try {
      const data = await makeGraphQLRequest(
        accessToken,
        `query { viewer { id } }`
      );
      const viewer = data.viewer as { id?: string } | undefined;
      return Boolean(viewer && viewer.id);
    } catch {
      return false;
    }
  }

  /**
   * Parse the Linear credential. Unlike Jira (base64 JSON with cloudId),
   * Linear's credential is just the raw access token.
   */
  private parseAccessToken(): string | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const linearCred = credentials[CredentialType.LINEAR_CRED];
    if (!linearCred) {
      return null;
    }

    return linearCred;
  }

  private getAccessToken(): string {
    const token = this.parseAccessToken();
    if (!token) {
      throw new Error(
        'Linear credentials are required. Connect your Linear account via OAuth.'
      );
    }
    return token;
  }

  /**
   * Resolve an issue identifier (e.g., "LIN-123") to its UUID.
   * If the input is already a UUID, returns it as-is.
   */
  private async resolveIssueId(identifierOrId: string): Promise<string> {
    // UUIDs are 36 chars with dashes
    if (
      identifierOrId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      return identifierOrId;
    }

    // It's an identifier like "LIN-123", look it up
    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildGetIssueQuery(),
      { id: identifierOrId }
    );

    const issue = data.issue as { id?: string } | undefined;
    if (!issue || !issue.id) {
      throw new Error(`Issue "${identifierOrId}" not found`);
    }

    return issue.id;
  }

  /**
   * Resolve a workflow state name to its ID for a given team.
   */
  private async resolveStateId(
    stateName: string,
    teamId: string
  ): Promise<string> {
    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildListWorkflowStatesQuery(),
      { filter: { team: { id: { eq: teamId } } } }
    );

    const states = data.workflowStates as {
      nodes: Array<{ id: string; name: string }>;
    };

    const match = states.nodes.find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );

    if (!match) {
      const available = states.nodes.map((s) => `"${s.name}"`).join(', ');
      throw new Error(
        `Workflow state "${stateName}" not found. Available states: ${available}`
      );
    }

    return match.id;
  }

  /**
   * Get the team ID for an issue (needed for state name resolution on update).
   */
  private async getIssueTeamId(issueId: string): Promise<string> {
    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      `query GetIssueTeam($id: String!) { issue(id: $id) { team { id } } }`,
      { id: issueId }
    );

    const issue = data.issue as { team?: { id: string } } | undefined;
    if (!issue?.team?.id) {
      throw new Error(`Could not determine team for issue "${issueId}"`);
    }

    return issue.team.id;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<LinearResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<LinearResult> => {
        const parsedParams = this.params as LinearParams;

        switch (operation) {
          case 'search':
            return await this.search(parsedParams as LinearSearchParams);
          case 'get':
            return await this.get(parsedParams as LinearGetParams);
          case 'create':
            return await this.create(parsedParams as LinearCreateParams);
          case 'update':
            return await this.update(parsedParams as LinearUpdateParams);
          case 'list_teams':
            return await this.listTeams(parsedParams as LinearListTeamsParams);
          case 'list_projects':
            return await this.listProjects(
              parsedParams as LinearListProjectsParams
            );
          case 'list_workflow_states':
            return await this.listWorkflowStates(
              parsedParams as LinearListWorkflowStatesParams
            );
          case 'add_comment':
            return await this.addComment(
              parsedParams as LinearAddCommentParams
            );
          case 'get_comments':
            return await this.getComments(
              parsedParams as LinearGetCommentsParams
            );
          case 'list_labels':
            return await this.listLabels(
              parsedParams as LinearListLabelsParams
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<LinearResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<LinearResult, { operation: T['operation'] }>;
    }
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 1: search
  // -------------------------------------------------------------------------
  private async search(
    params: LinearSearchParams
  ): Promise<Extract<LinearResult, { operation: 'search' }>> {
    const {
      query,
      teamId,
      assigneeId,
      stateId,
      labelId,
      projectId,
      priority,
      limit,
      includeArchived,
    } = params;

    const accessToken = this.getAccessToken();

    // If text query is provided, use searchIssues; otherwise use issues with filters
    if (query) {
      const variables: Record<string, unknown> = {
        term: query,
        first: limit ?? 50,
      };

      const data = await makeGraphQLRequest(
        accessToken,
        buildSearchByTextQuery(),
        variables
      );

      const searchResult = data.searchIssues as {
        nodes: unknown[];
        totalCount?: number;
      };

      return {
        operation: 'search',
        success: true,
        issues: searchResult.nodes as LinearResult extends {
          issues?: infer I;
        }
          ? I
          : never,
        total: searchResult.totalCount ?? searchResult.nodes.length,
        error: '',
      };
    } else {
      // Use issues with filter
      const filter: Record<string, unknown> = {};
      if (teamId) filter.team = { id: { eq: teamId } };
      if (assigneeId) filter.assignee = { id: { eq: assigneeId } };
      if (stateId) filter.state = { id: { eq: stateId } };
      if (labelId) filter.labels = { some: { id: { eq: labelId } } };
      if (projectId) filter.project = { id: { eq: projectId } };
      if (priority !== undefined) filter.priority = { eq: priority };

      const data = await makeGraphQLRequest(accessToken, buildSearchQuery(), {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        first: limit ?? 50,
        includeArchived: includeArchived ?? false,
      });

      const issuesResult = data.issues as { nodes: unknown[] };

      return {
        operation: 'search',
        success: true,
        issues: issuesResult.nodes as LinearResult extends {
          issues?: infer I;
        }
          ? I
          : never,
        total: issuesResult.nodes.length,
        error: '',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 2: get
  // -------------------------------------------------------------------------
  private async get(
    params: LinearGetParams
  ): Promise<Extract<LinearResult, { operation: 'get' }>> {
    const { identifier } = params;

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildGetIssueQuery(),
      { id: identifier }
    );

    return {
      operation: 'get',
      success: true,
      issue: data.issue as LinearResult extends { issue?: infer I } ? I : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 3: create
  // -------------------------------------------------------------------------
  private async create(
    params: LinearCreateParams
  ): Promise<Extract<LinearResult, { operation: 'create' }>> {
    const {
      teamId,
      title,
      description,
      assigneeId,
      priority,
      stateId,
      stateName,
      labelIds,
      projectId,
      dueDate,
      parentId,
      estimate,
    } = params;

    const input: Record<string, unknown> = {
      teamId,
      title,
    };

    if (description) input.description = description;
    if (assigneeId) input.assigneeId = assigneeId;
    if (priority !== undefined) input.priority = priority;
    if (labelIds && labelIds.length > 0) input.labelIds = labelIds;
    if (projectId) input.projectId = projectId;
    if (dueDate) input.dueDate = dueDate;
    if (parentId) input.parentId = parentId;
    if (estimate !== undefined) input.estimate = estimate;

    // Resolve state name to ID if provided
    if (stateName && !stateId) {
      input.stateId = await this.resolveStateId(stateName, teamId);
    } else if (stateId) {
      input.stateId = stateId;
    }

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildCreateIssueMutation(),
      { input }
    );

    const result = data.issueCreate as {
      success: boolean;
      issue?: { id: string; identifier: string; url: string };
    };

    if (!result.success || !result.issue) {
      throw new Error('Failed to create issue');
    }

    return {
      operation: 'create',
      success: true,
      issue: {
        id: result.issue.id,
        identifier: result.issue.identifier,
        url: result.issue.url,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // CORE OPERATION 4: update
  // -------------------------------------------------------------------------
  private async update(
    params: LinearUpdateParams
  ): Promise<Extract<LinearResult, { operation: 'update' }>> {
    const {
      id,
      title,
      description,
      assigneeId,
      priority,
      stateId,
      stateName,
      labels,
      projectId,
      dueDate,
      estimate,
    } = params;

    // Resolve the issue ID (might be an identifier like "LIN-123")
    const issueId = await this.resolveIssueId(id);

    const input: Record<string, unknown> = {};

    if (title !== undefined) input.title = title;
    if (description !== undefined) input.description = description;
    if (assigneeId !== undefined) input.assigneeId = assigneeId;
    if (priority !== undefined) input.priority = priority;
    if (projectId !== undefined) input.projectId = projectId;
    if (dueDate !== undefined) input.dueDate = dueDate;
    if (estimate !== undefined) input.estimate = estimate;

    // Resolve state name to ID if provided
    if (stateName && !stateId) {
      const teamId = await this.getIssueTeamId(issueId);
      input.stateId = await this.resolveStateId(stateName, teamId);
    } else if (stateId) {
      input.stateId = stateId;
    }

    // Handle label modifications
    if (labels) {
      if (labels.add && labels.add.length > 0) {
        input.addLabelIds = labels.add;
      }
      if (labels.remove && labels.remove.length > 0) {
        input.removeLabelIds = labels.remove;
      }
    }

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildUpdateIssueMutation(),
      { id: issueId, input }
    );

    const result = data.issueUpdate as {
      success: boolean;
      issue?: { id: string; identifier: string };
    };

    if (!result.success || !result.issue) {
      throw new Error('Failed to update issue');
    }

    return {
      operation: 'update',
      success: true,
      issue: {
        id: result.issue.id,
        identifier: result.issue.identifier,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_teams
  // -------------------------------------------------------------------------
  private async listTeams(
    _params: LinearListTeamsParams
  ): Promise<Extract<LinearResult, { operation: 'list_teams' }>> {
    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildListTeamsQuery()
    );

    const teams = data.teams as { nodes: unknown[] };

    return {
      operation: 'list_teams',
      success: true,
      teams: teams.nodes as LinearResult extends { teams?: infer T }
        ? T
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_projects
  // -------------------------------------------------------------------------
  private async listProjects(
    params: LinearListProjectsParams
  ): Promise<Extract<LinearResult, { operation: 'list_projects' }>> {
    const { teamId, limit, includeArchived } = params;

    const variables: Record<string, unknown> = {
      first: limit ?? 50,
      includeArchived: includeArchived ?? false,
    };

    if (teamId) {
      variables.filter = {
        accessibleTeams: { some: { id: { eq: teamId } } },
      };
    }

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildListProjectsQuery(),
      variables
    );

    const projects = data.projects as { nodes: unknown[] };

    return {
      operation: 'list_projects',
      success: true,
      projects: projects.nodes as LinearResult extends { projects?: infer P }
        ? P
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_workflow_states
  // -------------------------------------------------------------------------
  private async listWorkflowStates(
    params: LinearListWorkflowStatesParams
  ): Promise<Extract<LinearResult, { operation: 'list_workflow_states' }>> {
    const { teamId } = params;

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildListWorkflowStatesQuery(),
      { filter: { team: { id: { eq: teamId } } } }
    );

    const states = data.workflowStates as { nodes: unknown[] };

    return {
      operation: 'list_workflow_states',
      success: true,
      states: states.nodes as LinearResult extends { states?: infer S }
        ? S
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: add_comment
  // -------------------------------------------------------------------------
  private async addComment(
    params: LinearAddCommentParams
  ): Promise<Extract<LinearResult, { operation: 'add_comment' }>> {
    const { issueId, body } = params;

    // Resolve issue ID (might be an identifier)
    const resolvedId = await this.resolveIssueId(issueId);

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildAddCommentMutation(),
      { input: { issueId: resolvedId, body } }
    );

    const result = data.commentCreate as {
      success: boolean;
      comment?: {
        id: string;
        body: string;
        createdAt: string;
        updatedAt: string;
        user?: { id: string; name: string; email?: string };
      };
    };

    if (!result.success || !result.comment) {
      throw new Error('Failed to add comment');
    }

    return {
      operation: 'add_comment',
      success: true,
      comment: result.comment as LinearResult extends { comment?: infer C }
        ? C
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: get_comments
  // -------------------------------------------------------------------------
  private async getComments(
    params: LinearGetCommentsParams
  ): Promise<Extract<LinearResult, { operation: 'get_comments' }>> {
    const { issueId, limit } = params;

    // Resolve issue ID (might be an identifier)
    const resolvedId = await this.resolveIssueId(issueId);

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildGetCommentsQuery(),
      { issueId: resolvedId, first: limit ?? 50 }
    );

    const issue = data.issue as {
      comments?: { nodes: unknown[] };
    };

    const comments = issue?.comments?.nodes ?? [];

    return {
      operation: 'get_comments',
      success: true,
      comments: comments as LinearResult extends { comments?: infer C }
        ? C
        : never,
      total: comments.length,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // SUPPORTING OPERATION: list_labels
  // -------------------------------------------------------------------------
  private async listLabels(
    params: LinearListLabelsParams
  ): Promise<Extract<LinearResult, { operation: 'list_labels' }>> {
    const { teamId } = params;

    const variables: Record<string, unknown> = {};
    if (teamId) {
      variables.filter = { team: { id: { eq: teamId } } };
    }

    const data = await makeGraphQLRequest(
      this.getAccessToken(),
      buildListLabelsQuery(),
      variables
    );

    const labels = data.issueLabels as { nodes: unknown[] };

    return {
      operation: 'list_labels',
      success: true,
      labels: labels.nodes as LinearResult extends { labels?: infer L }
        ? L
        : never,
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

    return credentials[CredentialType.LINEAR_CRED];
  }
}
