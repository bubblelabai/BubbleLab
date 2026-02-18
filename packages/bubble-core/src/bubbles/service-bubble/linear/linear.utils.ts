/**
 * Linear GraphQL API utilities
 */

const LINEAR_API_URL = 'https://api.linear.app/graphql';

/**
 * Execute a GraphQL query against the Linear API
 */
export async function makeGraphQLRequest(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Linear API request timed out after 30 seconds');
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    const enhancedError = enhanceErrorMessage(
      errorText,
      response.status,
      response.statusText
    );
    throw new Error(enhancedError);
  }

  const result = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  };

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join('; ');
    throw new Error(`Linear GraphQL error: ${errorMessages}`);
  }

  return result.data || {};
}

/**
 * Enhance error messages with helpful hints
 */
export function enhanceErrorMessage(
  errorText: string,
  statusCode: number,
  statusText: string
): string {
  let enhanced = `Linear API error (${statusCode} ${statusText}): ${errorText}`;

  switch (statusCode) {
    case 400:
      enhanced +=
        '\n\nHint: Check your query parameters. The request was malformed.';
      break;
    case 401:
      enhanced +=
        '\n\nHint: Your Linear credentials may be expired or invalid. Try reconnecting your Linear account.';
      break;
    case 403:
      enhanced +=
        '\n\nHint: You may not have permission to perform this action. Check your Linear workspace permissions.';
      break;
    case 404:
      enhanced +=
        '\n\nHint: The requested resource was not found. Verify the issue ID/identifier exists.';
      break;
    case 429:
      enhanced +=
        '\n\nHint: Rate limited by Linear API. Wait a moment before retrying.';
      break;
  }

  return enhanced;
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  priority
  priorityLabel
  url
  createdAt
  updatedAt
  dueDate
  estimate
  state {
    id
    name
    type
    color
  }
  assignee {
    id
    name
    email
  }
  team {
    id
    name
    key
  }
  project {
    id
    name
    state
  }
  labels {
    nodes {
      id
      name
      color
    }
  }
`;

export function buildSearchQuery(): string {
  return `
    query SearchIssues($filter: IssueFilter, $first: Int, $includeArchived: Boolean) {
      issues(filter: $filter, first: $first, includeArchived: $includeArchived) {
        nodes {
          ${ISSUE_FIELDS}
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
}

export function buildSearchByTextQuery(): string {
  return `
    query SearchIssuesByText($term: String!, $first: Int) {
      searchIssues(term: $term, first: $first) {
        nodes {
          ${ISSUE_FIELDS}
        }
        totalCount
      }
    }
  `;
}

export function buildGetIssueQuery(): string {
  return `
    query GetIssue($id: String!) {
      issue(id: $id) {
        ${ISSUE_FIELDS}
      }
    }
  `;
}

export function buildCreateIssueMutation(): string {
  return `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;
}

export function buildUpdateIssueMutation(): string {
  return `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
        }
      }
    }
  `;
}

export function buildListTeamsQuery(): string {
  return `
    query ListTeams {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;
}

export function buildListProjectsQuery(): string {
  return `
    query ListProjects($filter: ProjectFilter, $first: Int, $includeArchived: Boolean) {
      projects(filter: $filter, first: $first, includeArchived: $includeArchived) {
        nodes {
          id
          name
          state
        }
      }
    }
  `;
}

export function buildListWorkflowStatesQuery(): string {
  return `
    query ListWorkflowStates($filter: WorkflowStateFilter) {
      workflowStates(filter: $filter) {
        nodes {
          id
          name
          type
          color
        }
      }
    }
  `;
}

export function buildAddCommentMutation(): string {
  return `
    mutation AddComment($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          body
          createdAt
          updatedAt
          user {
            id
            name
            email
          }
        }
      }
    }
  `;
}

export function buildGetCommentsQuery(): string {
  return `
    query GetComments($issueId: String!, $first: Int) {
      issue(id: $issueId) {
        comments(first: $first) {
          nodes {
            id
            body
            createdAt
            updatedAt
            user {
              id
              name
              email
            }
          }
        }
      }
    }
  `;
}

export function buildListLabelsQuery(): string {
  return `
    query ListLabels($filter: IssueLabelFilter) {
      issueLabels(filter: $filter) {
        nodes {
          id
          name
          color
        }
      }
    }
  `;
}

export function buildGetViewerQuery(): string {
  return `
    query Viewer {
      viewer {
        id
        name
        email
        organization {
          id
          name
        }
      }
    }
  `;
}
