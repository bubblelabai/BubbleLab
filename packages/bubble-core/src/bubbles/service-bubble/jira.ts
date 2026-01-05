import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Jira API base path (domain will be prepended)
const JIRA_API_PATH = '/rest/api/3';

// Jira credential structure (stored as JSON string)
// Jira issue schema
const JiraIssueSchema = z.object({
  id: z.string().describe('Issue ID'),
  key: z.string().describe('Issue key (e.g., PROJ-123)'),
  self: z.string().url().describe('API URL for this issue'),
  fields: z
    .record(z.unknown())
    .describe('Issue fields (summary, description, status, assignee, etc.)'),
});

// Jira project schema
const JiraProjectSchema = z.object({
  id: z.string().describe('Project ID'),
  key: z.string().describe('Project key (e.g., PROJ)'),
  name: z.string().describe('Project name'),
  self: z.string().url().describe('API URL for this project'),
  description: z.string().nullable().optional().describe('Project description'),
  lead: z
    .object({
      accountId: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional()
    .describe('Project lead information'),
});

// Jira issue type schema
const JiraIssueTypeSchema = z.object({
  id: z.string().describe('Issue type ID'),
  name: z.string().describe('Issue type name (e.g., Bug, Story, Task)'),
  description: z.string().optional().describe('Issue type description'),
  iconUrl: z.string().url().optional().describe('Icon URL for this issue type'),
});

// Jira transition schema
const JiraTransitionSchema = z.object({
  id: z.string().describe('Transition ID'),
  name: z.string().describe('Transition name (e.g., "In Progress", "Done")'),
  to: z
    .object({
      id: z.string().describe('Target status ID'),
      name: z.string().describe('Target status name'),
    })
    .describe('Target status information'),
  hasScreen: z.boolean().optional().describe('Whether transition has a screen'),
  isGlobal: z.boolean().optional().describe('Whether transition is global'),
  isInitial: z
    .boolean()
    .optional()
    .describe('Whether this is an initial transition'),
  isAvailable: z
    .boolean()
    .optional()
    .describe('Whether transition is available'),
  isConditional: z
    .boolean()
    .optional()
    .describe('Whether transition has conditions'),
});

// Define the parameters schema for different Jira operations
const JiraParamsSchema = z.discriminatedUnion('operation', [
  // Create Issue
  z.object({
    operation: z.literal('create_issue').describe('Create a new issue in Jira'),
    projectKey: z
      .string()
      .min(1, 'Project key is required')
      .describe('Project key (e.g., PROJ)'),
    summary: z
      .string()
      .min(1, 'Summary is required')
      .describe('Issue summary/title'),
    description: z
      .string()
      .optional()
      .describe('Issue description (supports Jira markup)'),
    issueType: z
      .string()
      .min(1, 'Issue type is required')
      .describe('Issue type name (e.g., Bug, Story, Task, Epic)'),
    assignee: z
      .string()
      .optional()
      .describe(
        'Assignee account ID or email (leave empty to leave unassigned)'
      ),
    priority: z
      .string()
      .optional()
      .describe('Priority name (e.g., Highest, High, Medium, Low, Lowest)'),
    labels: z
      .array(z.string())
      .optional()
      .describe('Array of label names to add to the issue'),
    dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    customFields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Custom fields as key-value pairs (key format: customfield_XXXXX, value: field value)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update Issue
  z.object({
    operation: z
      .literal('update_issue')
      .describe('Update fields of an existing issue'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    summary: z.string().optional().describe('Updated summary/title'),
    description: z
      .string()
      .optional()
      .describe('Updated description (supports Jira markup)'),
    assignee: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Assignee account ID or email (set to null or empty string to unassign)'
      ),
    priority: z
      .string()
      .optional()
      .describe('Priority name (e.g., Highest, High, Medium, Low, Lowest)'),
    labels: z
      .array(z.string())
      .optional()
      .describe(
        'Complete list of labels (replaces existing labels - include all labels you want to keep)'
      ),
    dueDate: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Due date in YYYY-MM-DD format (set to null to remove due date)'
      ),
    customFields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Custom fields to update (key format: customfield_XXXXX)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Transition Issue
  z.object({
    operation: z
      .literal('transition_issue')
      .describe('Move an issue to a different status'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    transitionId: z
      .string()
      .optional()
      .describe(
        'Transition ID (use list_transitions operation first to get available transitions)'
      ),
    transitionName: z
      .string()
      .optional()
      .describe('Transition name (e.g., "In Progress", "Done", "To Do")'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List Transitions
  z.object({
    operation: z
      .literal('list_transitions')
      .describe('Get all available transitions for an issue'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Add Comment
  z.object({
    operation: z.literal('add_comment').describe('Add a comment to an issue'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    comment: z
      .string()
      .min(1, 'Comment text is required')
      .describe('Comment text (supports Jira markup)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Assign/Unassign Issue
  z.object({
    operation: z
      .literal('assign_issue')
      .describe('Assign or unassign an issue'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    assignee: z
      .string()
      .nullable()
      .describe(
        'Assignee account ID or email (set to null or empty string to unassign)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update Labels
  z.object({
    operation: z
      .literal('update_labels')
      .describe('Update labels on an issue (replaces all existing labels)'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    labels: z
      .array(z.string())
      .describe(
        'Complete list of labels (replaces existing labels - include all labels you want to keep)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Link Issues
  z.object({
    operation: z
      .literal('link_issues')
      .describe('Create a link between two issues'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Source issue key (e.g., PROJ-123)'),
    linkedIssueKey: z
      .string()
      .min(1, 'Linked issue key is required')
      .describe('Target issue key (e.g., PROJ-456)'),
    linkType: z
      .enum(['Blocks', 'Relates', 'Duplicates', 'Clones'])
      .describe('Link type: Blocks, Relates, Duplicates, or Clones'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get Issue
  z.object({
    operation: z
      .literal('get_issue')
      .describe('Get details of a specific issue'),
    issueKey: z
      .string()
      .min(1, 'Issue key is required')
      .describe('Issue key (e.g., PROJ-123)'),
    fields: z
      .array(z.string())
      .optional()
      .describe(
        'Specific fields to retrieve (default: all fields). Common fields: summary, description, status, assignee, labels, priority, created, updated'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List Projects
  z.object({
    operation: z
      .literal('list_projects')
      .describe('Get all projects accessible to the user'),
    expand: z
      .array(z.string())
      .optional()
      .describe(
        'Additional fields to expand (e.g., description, lead, url, projectKeys)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List Issue Types
  z.object({
    operation: z
      .literal('list_issue_types')
      .describe('Get all issue types available in Jira'),
    projectKey: z
      .string()
      .optional()
      .describe(
        'Project key (optional, filters issue types available for this project)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define the result schema for different Jira operations
const JiraResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_issue'),
    issueKey: z.string().describe('Created issue key (e.g., PROJ-123)'),
    issueId: z.string().describe('Created issue ID'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_issue'),
    issueKey: z.string().describe('Updated issue key'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('transition_issue'),
    issueKey: z.string().describe('Transitioned issue key'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_transitions'),
    transitions: z
      .array(JiraTransitionSchema)
      .describe('List of available transitions for the issue'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('add_comment'),
    commentId: z.string().describe('Created comment ID'),
    issueKey: z.string().describe('Issue key where comment was added'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('assign_issue'),
    issueKey: z.string().describe('Assigned issue key'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_labels'),
    issueKey: z.string().describe('Updated issue key'),
    labels: z.array(z.string()).describe('Updated labels array'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('link_issues'),
    linkId: z.string().describe('Created issue link ID'),
    issueKey: z.string().describe('Source issue key'),
    linkedIssueKey: z.string().describe('Target issue key'),
    linkType: z.string().describe('Link type'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_issue'),
    issue: JiraIssueSchema.describe('Issue details'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_projects'),
    projects: z
      .array(JiraProjectSchema)
      .describe('Array of accessible projects'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_issue_types'),
    issueTypes: z
      .array(JiraIssueTypeSchema)
      .describe('Array of available issue types'),
    success: z.boolean(),
    error: z.string(),
  }),
]);

// Type definitions
export type JiraParams = z.input<typeof JiraParamsSchema>;
export type JiraParamsParsed = z.output<typeof JiraParamsSchema>;
export type JiraResult = z.output<typeof JiraResultSchema>;
export type JiraParamsInput = JiraParams;

// Export operation-specific types
export type JiraCreateIssueParams = Extract<
  JiraParams,
  { operation: 'create_issue' }
>;
export type JiraUpdateIssueParams = Extract<
  JiraParams,
  { operation: 'update_issue' }
>;
export type JiraTransitionIssueParams = Extract<
  JiraParams,
  { operation: 'transition_issue' }
>;
export type JiraListTransitionsParams = Extract<
  JiraParams,
  { operation: 'list_transitions' }
>;
export type JiraAddCommentParams = Extract<
  JiraParams,
  { operation: 'add_comment' }
>;
export type JiraAssignIssueParams = Extract<
  JiraParams,
  { operation: 'assign_issue' }
>;
export type JiraUpdateLabelsParams = Extract<
  JiraParams,
  { operation: 'update_labels' }
>;
export type JiraLinkIssuesParams = Extract<
  JiraParams,
  { operation: 'link_issues' }
>;
export type JiraGetIssueParams = Extract<
  JiraParams,
  { operation: 'get_issue' }
>;
export type JiraListProjectsParams = Extract<
  JiraParams,
  { operation: 'list_projects' }
>;
export type JiraListIssueTypesParams = Extract<
  JiraParams,
  { operation: 'list_issue_types' }
>;

export class JiraBubble<
  T extends JiraParams = JiraParams,
> extends ServiceBubble<T, Extract<JiraResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'jira';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'jira';
  static readonly schema = JiraParamsSchema;
  static readonly resultSchema = JiraResultSchema;
  static readonly shortDescription =
    'Lists the projects in Jira, creates issues in Jira with the specified fields and properties';
  static readonly longDescription = `
    Jira API integration for managing issues, projects, and workflows.
    
    Features:
    - Create and update issues with all key fields and custom fields support
    - Transition issues across statuses with transition discovery
    - Add comments to issues
    - Assign and unassign issues
    - Manage issue labels (add/remove)
    - Link issues (blocks, relates, duplicates, clones)
    - Get issue details by key
    - List projects and issue types
    - List available transitions for issues
    
    Use cases:
    - Automated issue creation and management
    - Workflow automation and status transitions
    - Issue tracking and reporting
    - Project management and organization
    - Integration with CI/CD pipelines
    - Bug tracking and task management
    
    Security Features:
    - Basic authentication with email and API token
    - Secure credential storage
    - Domain-based access control
    - Support for Jira Cloud and Jira Server
  `;
  static readonly alias = 'jira';

  constructor(
    params: T = {
      operation: 'list_projects',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Create Basic Auth header from email and API key
   */
  private createAuthHeader(email: string, apiKey: string): string {
    const credentials = `${email}:${apiKey}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Make API call to Jira
   */
  private async makeJiraApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const credentialValue = this.chooseCredential();
    if (!credentialValue) {
      throw new Error('Jira credentials not found');
    }

    // value format: "email,domain,apiKey"
    const parts = credentialValue.split(',');
    if (parts.length < 3) {
      throw new Error(
        'Jira credential must be stored as "email,domain,apiKey"'
      );
    }

    const [email, domain, apiKey] = parts.map((p) => p.trim());
    if (!email || !domain || !apiKey) {
      throw new Error(
        'Jira credential is missing email, domain, or apiKey in value'
      );
    }

    const baseUrl = `https://${domain}${JIRA_API_PATH}`;
    const url = `${baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader(email, apiKey);

    const headers: Record<string, string> = {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorMessage = `Jira API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = (await response.json()) as {
          errorMessages?: string[];
          errors?: Record<string, string>;
        };
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = errorData.errorMessages.join('; ');
        } else if (errorData.errors) {
          const fieldErrors = Object.entries(errorData.errors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join('; ');
          if (fieldErrors) {
            errorMessage += ` - ${fieldErrors}`;
          }
        }
      } catch {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content)
    if (
      response.status === 204 ||
      response.headers.get('content-length') === '0'
    ) {
      return {};
    }

    return await response.json();
  }

  /**
   * Format Jira API error
   */
  private formatJiraError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown Jira API error';
  }

  public async testCredential(): Promise<boolean> {
    try {
      const credentialValue = this.chooseCredential();
      if (!credentialValue) {
        return false;
      }

      // Test by calling the /myself endpoint
      await this.makeJiraApiCall('/myself', 'GET');
      return true;
    } catch (error) {
      console.error('Jira credential test failed:', error);
      return false;
    }
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.JIRA_CRED];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<JiraResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    switch (operation) {
      case 'create_issue':
        return this.handleCreateIssue(
          this.params as Extract<JiraParams, { operation: 'create_issue' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'update_issue':
        return this.handleUpdateIssue(
          this.params as Extract<JiraParams, { operation: 'update_issue' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'transition_issue':
        return this.handleTransitionIssue(
          this.params as Extract<JiraParams, { operation: 'transition_issue' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'list_transitions':
        return this.handleListTransitions(
          this.params as Extract<JiraParams, { operation: 'list_transitions' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'add_comment':
        return this.handleAddComment(
          this.params as Extract<JiraParams, { operation: 'add_comment' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'assign_issue':
        return this.handleAssignIssue(
          this.params as Extract<JiraParams, { operation: 'assign_issue' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'update_labels':
        return this.handleUpdateLabels(
          this.params as Extract<JiraParams, { operation: 'update_labels' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'link_issues':
        return this.handleLinkIssues(
          this.params as Extract<JiraParams, { operation: 'link_issues' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'get_issue':
        return this.handleGetIssue(
          this.params as Extract<JiraParams, { operation: 'get_issue' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'list_projects':
        return this.handleListProjects(
          this.params as Extract<JiraParams, { operation: 'list_projects' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      case 'list_issue_types':
        return this.handleListIssueTypes(
          this.params as Extract<JiraParams, { operation: 'list_issue_types' }>
        ) as Promise<Extract<JiraResult, { operation: T['operation'] }>>;

      default:
        return {
          operation: operation as T['operation'],
          success: false,
          error: `Unknown operation: ${operation}`,
        } as Extract<JiraResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Build Jira description field.
   * Jira Cloud (v3) expects Atlassian Document Format (ADF) for description.
   * We construct a minimal ADF document from a plain text description.
   */
  private buildDescriptionField(
    description?: string | null
  ): unknown | null | undefined {
    if (description === undefined) {
      return undefined;
    }
    if (description === null || description.trim() === '') {
      return null;
    }

    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: description,
            },
          ],
        },
      ],
    };
  }

  private async handleCreateIssue(
    params: Extract<JiraParams, { operation: 'create_issue' }>
  ): Promise<Extract<JiraResult, { operation: 'create_issue' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const {
      projectKey,
      summary,
      description,
      issueType,
      assignee,
      priority,
      labels,
      dueDate,
      customFields,
    } = parsed as Extract<JiraParamsParsed, { operation: 'create_issue' }>;

    try {
      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
      };

      const descriptionField = this.buildDescriptionField(description);
      if (descriptionField !== undefined) {
        fields.description = descriptionField;
      }

      if (assignee) {
        // Try to determine if it's an accountId or email
        if (assignee.includes('@')) {
          fields.assignee = { emailAddress: assignee };
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

      if (dueDate) {
        fields.duedate = dueDate;
      }

      // Add custom fields
      if (customFields) {
        Object.assign(fields, customFields);
      }

      const response = (await this.makeJiraApiCall('/issue', 'POST', {
        fields,
      })) as { id: string; key: string };

      return {
        operation: 'create_issue',
        issueKey: response.key,
        issueId: response.id,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'create_issue',
        issueKey: '',
        issueId: '',
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleUpdateIssue(
    params: Extract<JiraParams, { operation: 'update_issue' }>
  ): Promise<Extract<JiraResult, { operation: 'update_issue' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const {
      issueKey,
      summary,
      description,
      assignee,
      priority,
      labels,
      dueDate,
      customFields,
    } = parsed as Extract<JiraParamsParsed, { operation: 'update_issue' }>;

    try {
      const fields: Record<string, unknown> = {};

      if (summary !== undefined) {
        fields.summary = summary;
      }

      const descriptionField = this.buildDescriptionField(description);
      if (descriptionField !== undefined) {
        fields.description = descriptionField;
      }

      if (assignee !== undefined) {
        if (assignee === null || assignee === '') {
          fields.assignee = null;
        } else if (assignee.includes('@')) {
          fields.assignee = { emailAddress: assignee };
        } else {
          fields.assignee = { accountId: assignee };
        }
      }

      if (priority !== undefined) {
        fields.priority = { name: priority };
      }

      if (labels !== undefined) {
        fields.labels = labels;
      }

      if (dueDate !== undefined) {
        fields.duedate = dueDate === null ? null : dueDate;
      }

      // Add custom fields
      if (customFields) {
        Object.assign(fields, customFields);
      }

      await this.makeJiraApiCall(`/issue/${issueKey}`, 'PUT', {
        fields,
      });

      return {
        operation: 'update_issue',
        issueKey,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'update_issue',
        issueKey,
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleTransitionIssue(
    params: Extract<JiraParams, { operation: 'transition_issue' }>
  ): Promise<Extract<JiraResult, { operation: 'transition_issue' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, transitionId, transitionName } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'transition_issue' }
    >;

    try {
      // If transitionName is provided but not transitionId, get transitions first
      let finalTransitionId = transitionId;
      if (!finalTransitionId && transitionName) {
        const transitionsResponse = (await this.makeJiraApiCall(
          `/issue/${issueKey}/transitions`,
          'GET'
        )) as { transitions: Array<{ id: string; name: string }> };

        const matchingTransition = transitionsResponse.transitions.find(
          (t) => t.name.toLowerCase() === transitionName.toLowerCase()
        );
        if (!matchingTransition) {
          throw new Error(
            `Transition "${transitionName}" not found. Available transitions: ${transitionsResponse.transitions.map((t) => t.name).join(', ')}`
          );
        }
        finalTransitionId = matchingTransition.id;
      }

      if (!finalTransitionId) {
        throw new Error(
          'Either transitionId or transitionName must be provided. Use list_transitions operation first to get available transitions.'
        );
      }

      await this.makeJiraApiCall(`/issue/${issueKey}/transitions`, 'POST', {
        transition: { id: finalTransitionId },
      });

      return {
        operation: 'transition_issue',
        issueKey,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'transition_issue',
        issueKey,
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleListTransitions(
    params: Extract<JiraParams, { operation: 'list_transitions' }>
  ): Promise<Extract<JiraResult, { operation: 'list_transitions' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'list_transitions' }
    >;

    try {
      const response = (await this.makeJiraApiCall(
        `/issue/${issueKey}/transitions`,
        'GET'
      )) as { transitions: unknown[] };

      const transitions = z
        .array(JiraTransitionSchema)
        .parse(response.transitions);

      return {
        operation: 'list_transitions',
        transitions,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'list_transitions',
        transitions: [],
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleAddComment(
    params: Extract<JiraParams, { operation: 'add_comment' }>
  ): Promise<Extract<JiraResult, { operation: 'add_comment' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, comment } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'add_comment' }
    >;

    try {
      // Jira Cloud v3 expects comment body in Atlassian Document Format (ADF)
      const commentBody = this.buildDescriptionField(comment);
      const response = (await this.makeJiraApiCall(
        `/issue/${issueKey}/comment`,
        'POST',
        { body: commentBody }
      )) as { id: string };

      return {
        operation: 'add_comment',
        commentId: response.id,
        issueKey,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'add_comment',
        commentId: '',
        issueKey,
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleAssignIssue(
    params: Extract<JiraParams, { operation: 'assign_issue' }>
  ): Promise<Extract<JiraResult, { operation: 'assign_issue' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, assignee } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'assign_issue' }
    >;

    try {
      // Jira unassign semantics:
      // - To unassign, send { accountId: null }
      // - To assign, send either { accountId } or { emailAddress }
      let assigneePayload: {
        accountId?: string | null;
        emailAddress?: string;
      } = {};

      if (assignee === null || assignee === '') {
        assigneePayload = { accountId: null };
      } else if (assignee.includes('@')) {
        assigneePayload = { emailAddress: assignee };
      } else {
        assigneePayload = { accountId: assignee };
      }

      await this.makeJiraApiCall(
        `/issue/${issueKey}/assignee`,
        'PUT',
        assigneePayload
      );

      return {
        operation: 'assign_issue',
        issueKey,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'assign_issue',
        issueKey,
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleUpdateLabels(
    params: Extract<JiraParams, { operation: 'update_labels' }>
  ): Promise<Extract<JiraResult, { operation: 'update_labels' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, labels } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'update_labels' }
    >;

    try {
      await this.makeJiraApiCall(`/issue/${issueKey}`, 'PUT', {
        fields: { labels },
      });

      return {
        operation: 'update_labels',
        issueKey,
        labels,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'update_labels',
        issueKey,
        labels: [],
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleLinkIssues(
    params: Extract<JiraParams, { operation: 'link_issues' }>
  ): Promise<Extract<JiraResult, { operation: 'link_issues' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, linkedIssueKey, linkType } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'link_issues' }
    >;

    try {
      const response = (await this.makeJiraApiCall('/issueLink', 'POST', {
        type: { name: linkType },
        inwardIssue: { key: issueKey },
        outwardIssue: { key: linkedIssueKey },
      })) as { id: string };

      return {
        operation: 'link_issues',
        linkId: response.id,
        issueKey,
        linkedIssueKey,
        linkType,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'link_issues',
        linkId: '',
        issueKey,
        linkedIssueKey,
        linkType,
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleGetIssue(
    params: Extract<JiraParams, { operation: 'get_issue' }>
  ): Promise<Extract<JiraResult, { operation: 'get_issue' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { issueKey, fields } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'get_issue' }
    >;

    try {
      let endpoint = `/issue/${issueKey}`;
      if (fields && fields.length > 0) {
        endpoint += `?fields=${fields.join(',')}`;
      }

      const response = (await this.makeJiraApiCall(endpoint, 'GET')) as unknown;
      const issue = JiraIssueSchema.parse(response);

      return {
        operation: 'get_issue',
        issue,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_issue',
        issue: {
          id: '',
          key: issueKey,
          self: '',
          fields: {},
        },
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleListProjects(
    params: Extract<JiraParams, { operation: 'list_projects' }>
  ): Promise<Extract<JiraResult, { operation: 'list_projects' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { expand } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'list_projects' }
    >;

    try {
      let endpoint = '/project';
      if (expand && expand.length > 0) {
        endpoint += `?expand=${expand.join(',')}`;
      }

      const response = (await this.makeJiraApiCall(
        endpoint,
        'GET'
      )) as unknown[];
      const projects = z.array(JiraProjectSchema).parse(response);

      return {
        operation: 'list_projects',
        projects,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('Error listing projects', error);
      return {
        operation: 'list_projects',
        projects: [],
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }

  private async handleListIssueTypes(
    params: Extract<JiraParams, { operation: 'list_issue_types' }>
  ): Promise<Extract<JiraResult, { operation: 'list_issue_types' }>> {
    const parsed = JiraParamsSchema.parse(params);
    const { projectKey } = parsed as Extract<
      JiraParamsParsed,
      { operation: 'list_issue_types' }
    >;

    try {
      // Jira Cloud:
      // - GET /issuetype           -> all global issue types
      // - GET /project/{key}       -> includes project-scoped issueTypes field
      if (projectKey) {
        const project = (await this.makeJiraApiCall(
          `/project/${projectKey}`,
          'GET'
        )) as { issueTypes?: unknown[] };

        const issueTypes = z
          .array(JiraIssueTypeSchema)
          .parse(project.issueTypes ?? []);

        return {
          operation: 'list_issue_types',
          issueTypes,
          success: true,
          error: '',
        };
      }

      // No projectKey: return all global issue types
      const response = (await this.makeJiraApiCall(
        '/issuetype',
        'GET'
      )) as unknown[];
      const issueTypes = z.array(JiraIssueTypeSchema).parse(response);

      return {
        operation: 'list_issue_types',
        issueTypes,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'list_issue_types',
        issueTypes: [],
        success: false,
        error: this.formatJiraError(error),
      };
    }
  }
}
