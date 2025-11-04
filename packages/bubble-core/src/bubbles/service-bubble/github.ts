import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// GitHub API base URL
const GITHUB_API_BASE = 'https://api.github.com';

// GitHub file content schema
const GithubFileContentSchema = z.object({
  name: z.string().describe('File name'),
  path: z.string().describe('Full path to the file in the repository'),
  sha: z.string().describe('Git SHA hash of the file'),
  size: z.number().describe('File size in bytes'),
  url: z.string().describe('API URL for this file'),
  html_url: z.string().describe('Web URL to view the file on GitHub'),
  git_url: z.string().describe('Git URL for the file object'),
  download_url: z
    .string()
    .nullable()
    .describe('Direct download URL for the file'),
  type: z
    .enum(['file', 'dir', 'symlink', 'submodule'])
    .describe('Type of the content'),
  content: z.string().optional().describe('Base64 encoded content (for files)'),
  encoding: z.string().optional().describe('Encoding type (usually base64)'),
});

// GitHub repository schema
const GithubRepositorySchema = z.object({
  id: z.number().describe('Repository ID'),
  node_id: z.string().describe('GraphQL node ID'),
  name: z.string().describe('Repository name'),
  full_name: z.string().describe('Full repository name (owner/repo)'),
  private: z.boolean().describe('Whether the repository is private'),
  owner: z
    .object({
      login: z.string().describe('Owner username'),
      id: z.number().describe('Owner ID'),
      avatar_url: z.string().describe('Owner avatar URL'),
      html_url: z.string().describe('Owner profile URL'),
    })
    .describe('Repository owner information'),
  html_url: z.string().describe('Repository web URL'),
  description: z.string().nullable().describe('Repository description'),
  fork: z.boolean().describe('Whether this is a fork'),
  created_at: z.string().describe('ISO datetime when repository was created'),
  updated_at: z
    .string()
    .describe('ISO datetime when repository was last updated'),
  pushed_at: z.string().describe('ISO datetime of last push'),
  size: z.number().describe('Repository size in KB'),
  stargazers_count: z.number().describe('Number of stars'),
  watchers_count: z.number().describe('Number of watchers'),
  language: z.string().nullable().describe('Primary programming language'),
  forks_count: z.number().describe('Number of forks'),
  open_issues_count: z.number().describe('Number of open issues'),
  default_branch: z.string().describe('Default branch name'),
  visibility: z
    .string()
    .optional()
    .describe('Repository visibility (public, private, internal)'),
});

// GitHub pull request schema
const GithubPullRequestSchema = z.object({
  id: z.number().describe('Pull request ID'),
  node_id: z.string().describe('GraphQL node ID'),
  number: z.number().describe('Pull request number'),
  state: z.enum(['open', 'closed']).describe('Pull request state'),
  title: z.string().describe('Pull request title'),
  body: z.string().nullable().describe('Pull request description'),
  created_at: z.string().describe('ISO datetime when PR was created'),
  updated_at: z.string().describe('ISO datetime when PR was last updated'),
  closed_at: z.string().nullable().describe('ISO datetime when PR was closed'),
  merged_at: z.string().nullable().describe('ISO datetime when PR was merged'),
  user: z
    .object({
      login: z.string().describe('Author username'),
      id: z.number().describe('Author ID'),
      avatar_url: z.string().describe('Author avatar URL'),
    })
    .describe('Pull request author'),
  html_url: z.string().describe('Web URL to view the PR'),
  draft: z.boolean().describe('Whether this is a draft PR'),
  head: z
    .object({
      ref: z.string().describe('Source branch name'),
      sha: z.string().describe('Source commit SHA'),
    })
    .describe('Source branch information'),
  base: z
    .object({
      ref: z.string().describe('Target branch name'),
      sha: z.string().describe('Target commit SHA'),
    })
    .describe('Target branch information'),
  merged: z
    .boolean()
    .optional()
    .describe(
      'Whether the PR has been merged (may not be present in list responses)'
    ),
  mergeable: z
    .boolean()
    .nullable()
    .optional()
    .describe(
      'Whether the PR can be merged (may not be present in list responses)'
    ),
  mergeable_state: z
    .string()
    .optional()
    .describe('Mergeable state (clean, unstable, dirty, etc.)'),
  comments: z.number().optional().describe('Number of comments'),
  review_comments: z.number().optional().describe('Number of review comments'),
  commits: z.number().optional().describe('Number of commits'),
  additions: z.number().optional().describe('Lines added'),
  deletions: z.number().optional().describe('Lines deleted'),
  changed_files: z.number().optional().describe('Number of files changed'),
});

// GitHub issue/PR comment schema
const GithubCommentSchema = z.object({
  id: z.number().describe('Comment ID'),
  node_id: z.string().describe('GraphQL node ID'),
  body: z.string().describe('Comment text content'),
  user: z
    .object({
      login: z.string().describe('Comment author username'),
      id: z.number().describe('Comment author ID'),
    })
    .describe('Comment author information'),
  created_at: z.string().describe('ISO datetime when comment was created'),
  updated_at: z.string().describe('ISO datetime when comment was last updated'),
  html_url: z.string().describe('Web URL to view the comment'),
});

// GitHub issue schema
const GithubIssueSchema = z.object({
  id: z.number().describe('Issue ID'),
  node_id: z.string().describe('GraphQL node ID'),
  number: z.number().describe('Issue number'),
  state: z.enum(['open', 'closed']).describe('Issue state'),
  title: z.string().describe('Issue title'),
  body: z.string().nullable().describe('Issue description'),
  user: z
    .object({
      login: z.string().describe('Issue creator username'),
      id: z.number().describe('Issue creator ID'),
    })
    .describe('Issue creator information'),
  labels: z
    .array(
      z.object({
        id: z.number().describe('Label ID'),
        name: z.string().describe('Label name'),
        color: z.string().describe('Label color (hex)'),
        description: z.string().nullable().describe('Label description'),
      })
    )
    .describe('Issue labels'),
  created_at: z.string().describe('ISO datetime when issue was created'),
  updated_at: z.string().describe('ISO datetime when issue was last updated'),
  closed_at: z
    .string()
    .nullable()
    .describe('ISO datetime when issue was closed'),
  html_url: z.string().describe('Web URL to view the issue'),
  comments: z.number().describe('Number of comments'),
});

// Define the parameters schema for different GitHub operations
const GithubParamsSchema = z.discriminatedUnion('operation', [
  // Get file content operation
  z.object({
    operation: z
      .literal('get_file')
      .describe('Get the contents of a file from a GitHub repository'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    path: z
      .string()
      .min(1, 'File path is required')
      .describe('Path to the file in the repository (e.g., src/index.ts)'),
    ref: z
      .string()
      .optional()
      .describe(
        'Git reference (branch, tag, or commit SHA). Defaults to the default branch'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get directory contents operation
  z.object({
    operation: z
      .literal('get_directory')
      .describe('Get the contents of a directory from a GitHub repository'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    path: z
      .string()
      .optional()
      .default('')
      .describe(
        'Path to the directory in the repository (empty string for root)'
      ),
    ref: z
      .string()
      .optional()
      .describe(
        'Git reference (branch, tag, or commit SHA). Defaults to the default branch'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List pull requests operation
  z.object({
    operation: z
      .literal('list_pull_requests')
      .describe('List pull requests in a GitHub repository'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    state: z
      .enum(['open', 'closed', 'all'])
      .optional()
      .default('open')
      .describe('Filter by PR state'),
    sort: z
      .enum(['created', 'updated', 'popularity', 'long-running'])
      .optional()
      .default('created')
      .describe('Sort order for results'),
    direction: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort direction'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe('Number of results per page (1-100)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get pull request details operation
  z.object({
    operation: z
      .literal('get_pull_request')
      .describe('Get detailed information about a specific pull request'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    pull_number: z
      .number()
      .min(1, 'Pull request number is required')
      .describe('Pull request number'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create PR comment operation
  z.object({
    operation: z
      .literal('create_pr_comment')
      .describe('Add a comment to a pull request'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    pull_number: z
      .number()
      .min(1, 'Pull request number is required')
      .describe('Pull request number'),
    body: z
      .string()
      .min(1, 'Comment text is required')
      .describe('Comment text content (supports GitHub Markdown)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List repositories operation
  z.object({
    operation: z
      .literal('list_repositories')
      .describe('List repositories for the authenticated user'),
    visibility: z
      .enum(['all', 'public', 'private'])
      .optional()
      .default('all')
      .describe('Filter by repository visibility'),
    affiliation: z
      .enum(['owner', 'collaborator', 'organization_member'])
      .optional()
      .default('owner')
      .describe('Filter by user affiliation'),
    sort: z
      .enum(['created', 'updated', 'pushed', 'full_name'])
      .optional()
      .default('updated')
      .describe('Sort order for results'),
    direction: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort direction'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe('Number of results per page (1-100)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get repository details operation
  z.object({
    operation: z
      .literal('get_repository')
      .describe('Get detailed information about a specific repository'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create issue comment operation
  z.object({
    operation: z
      .literal('create_issue_comment')
      .describe('Add a comment to an issue'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    issue_number: z
      .number()
      .min(1, 'Issue number is required')
      .describe('Issue number'),
    body: z
      .string()
      .min(1, 'Comment text is required')
      .describe('Comment text content (supports GitHub Markdown)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List issues operation
  z.object({
    operation: z
      .literal('list_issues')
      .describe('List issues in a GitHub repository'),
    owner: z
      .string()
      .min(1, 'Repository owner is required')
      .describe('Repository owner (username or organization name)'),
    repo: z
      .string()
      .min(1, 'Repository name is required')
      .describe('Repository name'),
    state: z
      .enum(['open', 'closed', 'all'])
      .optional()
      .default('open')
      .describe('Filter by issue state'),
    labels: z
      .string()
      .optional()
      .describe('Filter by labels (comma-separated list)'),
    sort: z
      .enum(['created', 'updated', 'comments'])
      .optional()
      .default('created')
      .describe('Sort order for results'),
    direction: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort direction'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe('Number of results per page (1-100)'),
    page: z
      .number()
      .min(1)
      .optional()
      .default(1)
      .describe('Page number for pagination'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define the result schemas for different GitHub operations
const GithubResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('get_file'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: GithubFileContentSchema.optional().describe(
      'File content information'
    ),
  }),

  z.object({
    operation: z.literal('get_directory'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: z
      .array(GithubFileContentSchema)
      .optional()
      .describe('Array of directory contents'),
  }),

  z.object({
    operation: z.literal('list_pull_requests'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: z
      .array(GithubPullRequestSchema)
      .optional()
      .describe('Array of pull requests'),
  }),

  z.object({
    operation: z.literal('get_pull_request'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: GithubPullRequestSchema.optional().describe('Pull request details'),
  }),

  z.object({
    operation: z.literal('create_pr_comment'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: GithubCommentSchema.optional().describe(
      'Created comment information'
    ),
  }),

  z.object({
    operation: z.literal('list_repositories'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: z
      .array(GithubRepositorySchema)
      .optional()
      .describe('Array of repositories'),
  }),

  z.object({
    operation: z.literal('get_repository'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: GithubRepositorySchema.optional().describe('Repository details'),
  }),

  z.object({
    operation: z.literal('create_issue_comment'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: GithubCommentSchema.optional().describe(
      'Created comment information'
    ),
  }),

  z.object({
    operation: z.literal('list_issues'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if operation failed'),
    data: z.array(GithubIssueSchema).optional().describe('Array of issues'),
  }),
]);

// Export types
export type GithubParamsInput = z.input<typeof GithubParamsSchema>;
type GithubParams = z.input<typeof GithubParamsSchema>;
type GithubParamsParsed = z.output<typeof GithubParamsSchema>;
type GithubResult = z.output<typeof GithubResultSchema>;

// Export specific operation types for better DX
export type GithubGetFileParams = Extract<
  GithubParams,
  { operation: 'get_file' }
>;
export type GithubGetDirectoryParams = Extract<
  GithubParams,
  { operation: 'get_directory' }
>;
export type GithubListPullRequestsParams = Extract<
  GithubParams,
  { operation: 'list_pull_requests' }
>;
export type GithubGetPullRequestParams = Extract<
  GithubParams,
  { operation: 'get_pull_request' }
>;
export type GithubCreatePrCommentParams = Extract<
  GithubParams,
  { operation: 'create_pr_comment' }
>;
export type GithubListRepositoriesParams = Extract<
  GithubParams,
  { operation: 'list_repositories' }
>;
export type GithubGetRepositoryParams = Extract<
  GithubParams,
  { operation: 'get_repository' }
>;
export type GithubCreateIssueCommentParams = Extract<
  GithubParams,
  { operation: 'create_issue_comment' }
>;
export type GithubListIssuesParams = Extract<
  GithubParams,
  { operation: 'list_issues' }
>;

// Helper type to get the result type for a specific operation
export type GithubOperationResult<T extends GithubParams['operation']> =
  Extract<GithubResult, { operation: T }>;

export class GithubBubble<
  T extends GithubParams = GithubParams,
> extends ServiceBubble<
  T,
  Extract<GithubResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'github';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'github';
  static readonly schema = GithubParamsSchema;
  static readonly resultSchema = GithubResultSchema;
  static readonly shortDescription =
    'GitHub API integration for repository operations';
  static readonly longDescription = `
    GitHub API integration for accessing repositories, pull requests, issues, and files.
    
    Features:
    - Get file contents from repositories
    - List and browse directory contents
    - Manage pull requests (list, get details, comment)
    - Manage issues (list, comment)
    - List and get repository information
    - Non-sensitive read and comment operations only
    
    Use cases:
    - Code review automation and PR management
    - Repository file access and content retrieval
    - Issue and PR comment automation
    - Repository exploration and documentation
    - CI/CD integration and status checks
    
    Security Features:
    - Personal access token authentication (GitHub PAT)
    - Read-only operations with safe comment capabilities
    - No file deletion or destructive operations
    - Respects repository permissions
  `;
  static readonly alias = 'gh';

  constructor(
    params: T = {
      operation: 'get_repository',
      owner: 'octocat',
      repo: 'Hello-World',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    try {
      // Test the credential by fetching the authenticated user
      const token = this.chooseCredential();
      if (!token) {
        return false;
      }

      const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('GitHub credential test failed:', error);
      return false;
    }
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.GITHUB_TOKEN];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<GithubResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    switch (operation) {
      case 'get_file':
        return this.handleGetFile(
          this.params as Extract<GithubParams, { operation: 'get_file' }>
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'get_directory':
        return this.handleGetDirectory(
          this.params as Extract<GithubParams, { operation: 'get_directory' }>
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'list_pull_requests':
        return this.handleListPullRequests(
          this.params as Extract<
            GithubParams,
            { operation: 'list_pull_requests' }
          >
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'get_pull_request':
        return this.handleGetPullRequest(
          this.params as Extract<
            GithubParams,
            { operation: 'get_pull_request' }
          >
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'create_pr_comment':
        return this.handleCreatePrComment(
          this.params as Extract<
            GithubParams,
            { operation: 'create_pr_comment' }
          >
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'list_repositories':
        return this.handleListRepositories(
          this.params as Extract<
            GithubParams,
            { operation: 'list_repositories' }
          >
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'get_repository':
        return this.handleGetRepository(
          this.params as Extract<GithubParams, { operation: 'get_repository' }>
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'create_issue_comment':
        return this.handleCreateIssueComment(
          this.params as Extract<
            GithubParams,
            { operation: 'create_issue_comment' }
          >
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      case 'list_issues':
        return this.handleListIssues(
          this.params as Extract<GithubParams, { operation: 'list_issues' }>
        ) as Promise<Extract<GithubResult, { operation: T['operation'] }>>;

      default:
        return {
          operation: operation as T['operation'],
          success: false,
          error: `Unknown operation: ${operation}`,
        } as Extract<GithubResult, { operation: T['operation'] }>;
    }
  }

  private async handleGetFile(
    params: Extract<GithubParams, { operation: 'get_file' }>
  ): Promise<Extract<GithubResult, { operation: 'get_file' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, path, ref } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'get_file' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'get_file',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
      if (ref) {
        url += `?ref=${encodeURIComponent(ref)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'get_file',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = GithubFileContentSchema.parse(data);

      return {
        operation: 'get_file',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'get_file',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetDirectory(
    params: Extract<GithubParams, { operation: 'get_directory' }>
  ): Promise<Extract<GithubResult, { operation: 'get_directory' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, path, ref } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'get_directory' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'get_directory',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
      if (ref) {
        url += `?ref=${encodeURIComponent(ref)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'get_directory',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = z.array(GithubFileContentSchema).parse(data);

      return {
        operation: 'get_directory',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'get_directory',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleListPullRequests(
    params: Extract<GithubParams, { operation: 'list_pull_requests' }>
  ): Promise<Extract<GithubResult, { operation: 'list_pull_requests' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, state, sort, direction, per_page, page } =
      parsed as Extract<
        GithubParamsParsed,
        { operation: 'list_pull_requests' }
      >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'list_pull_requests',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`);
      url.searchParams.set('state', state);
      url.searchParams.set('sort', sort);
      url.searchParams.set('direction', direction);
      url.searchParams.set('per_page', per_page.toString());
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'list_pull_requests',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = z.array(GithubPullRequestSchema).parse(data);

      return {
        operation: 'list_pull_requests',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'list_pull_requests',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetPullRequest(
    params: Extract<GithubParams, { operation: 'get_pull_request' }>
  ): Promise<Extract<GithubResult, { operation: 'get_pull_request' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, pull_number } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'get_pull_request' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'get_pull_request',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pull_number}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'get_pull_request',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = GithubPullRequestSchema.parse(data);

      return {
        operation: 'get_pull_request',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'get_pull_request',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleCreatePrComment(
    params: Extract<GithubParams, { operation: 'create_pr_comment' }>
  ): Promise<Extract<GithubResult, { operation: 'create_pr_comment' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, pull_number, body } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'create_pr_comment' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'create_pr_comment',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pull_number}/comments`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'create_pr_comment',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = GithubCommentSchema.parse(data);

      return {
        operation: 'create_pr_comment',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'create_pr_comment',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleListRepositories(
    params: Extract<GithubParams, { operation: 'list_repositories' }>
  ): Promise<Extract<GithubResult, { operation: 'list_repositories' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { visibility, affiliation, sort, direction, per_page, page } =
      parsed as Extract<GithubParamsParsed, { operation: 'list_repositories' }>;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'list_repositories',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = new URL(`${GITHUB_API_BASE}/user/repos`);
      url.searchParams.set('visibility', visibility);
      url.searchParams.set('affiliation', affiliation);
      url.searchParams.set('sort', sort);
      url.searchParams.set('direction', direction);
      url.searchParams.set('per_page', per_page.toString());
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'list_repositories',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = z.array(GithubRepositorySchema).parse(data);

      return {
        operation: 'list_repositories',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'list_repositories',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleGetRepository(
    params: Extract<GithubParams, { operation: 'get_repository' }>
  ): Promise<Extract<GithubResult, { operation: 'get_repository' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'get_repository' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'get_repository',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'get_repository',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = GithubRepositorySchema.parse(data);

      return {
        operation: 'get_repository',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'get_repository',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleCreateIssueComment(
    params: Extract<GithubParams, { operation: 'create_issue_comment' }>
  ): Promise<Extract<GithubResult, { operation: 'create_issue_comment' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, issue_number, body } = parsed as Extract<
      GithubParamsParsed,
      { operation: 'create_issue_comment' }
    >;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'create_issue_comment',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issue_number}/comments`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'create_issue_comment',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = GithubCommentSchema.parse(data);

      return {
        operation: 'create_issue_comment',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'create_issue_comment',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleListIssues(
    params: Extract<GithubParams, { operation: 'list_issues' }>
  ): Promise<Extract<GithubResult, { operation: 'list_issues' }>> {
    const parsed = GithubParamsSchema.parse(params);
    const { owner, repo, state, labels, sort, direction, per_page, page } =
      parsed as Extract<GithubParamsParsed, { operation: 'list_issues' }>;

    try {
      const token = this.chooseCredential();
      if (!token) {
        return {
          operation: 'list_issues',
          success: false,
          error: 'GitHub token credential not found',
        };
      }

      const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`);
      url.searchParams.set('state', state);
      if (labels) {
        url.searchParams.set('labels', labels);
      }
      url.searchParams.set('sort', sort);
      url.searchParams.set('direction', direction);
      url.searchParams.set('per_page', per_page.toString());
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          operation: 'list_issues',
          success: false,
          error: `GitHub API error: ${response.status} ${error}`,
        };
      }

      const data = await response.json();
      const validatedData = z.array(GithubIssueSchema).parse(data);

      return {
        operation: 'list_issues',
        success: true,
        error: '',
        data: validatedData,
      };
    } catch (error) {
      return {
        operation: 'list_issues',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
