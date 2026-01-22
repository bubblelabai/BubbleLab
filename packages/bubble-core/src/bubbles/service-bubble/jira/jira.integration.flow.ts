import {
  BubbleFlow,
  type WebhookEvent,
  JiraBubble,
} from '@bubblelab/bubble-core';

export interface TestResult {
  operation: string;
  success: boolean;
  details?: string;
  issueKey?: string;
  error?: string;
}

export interface Output {
  success: boolean;
  testResults: TestResult[];
  createdIssueKey?: string;
  projectKey?: string;
  summary: string;
}

/**
 * Payload for the Jira Integration Test workflow.
 */
export type JiraIntegrationTestPayload = WebhookEvent;

/**
 * Integration flow test for JiraBubble
 *
 * Automatically discovers the first available project and tests all core operations:
 * 1. list_projects - List available Jira projects (uses first one found)
 * 2. list_issue_types - Get issue types for the project
 * 3. create - Create a new test issue
 * 4. get - Retrieve the created issue
 * 5. update - Update the issue (summary, priority, labels)
 * 6. add_comment - Add a comment to the issue
 * 7. get_comments - Retrieve comments
 * 8. list_transitions - Get available transitions
 * 9. transition - Move issue to a different status
 * 10. search - Search for issues using JQL
 */
export class JiraIntegrationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: JiraIntegrationTestPayload): Promise<Output> {
    const results: TestResult[] = [];
    const timestamp = new Date().toISOString();
    let createdIssueKey: string | undefined;
    let projectKey: string | undefined;

    // 1. Test list_projects and get the first available
    try {
      const result = await new JiraBubble({
        operation: 'list_projects',
        limit: 10,
      }).action();

      const success =
        result.success && result.data.operation === 'list_projects';
      const projects =
        result.data.operation === 'list_projects'
          ? result.data.projects || []
          : [];

      // Use the first available project
      if (projects.length > 0) {
        projectKey = projects[0].key;
      }

      results.push({
        operation: 'list_projects',
        success,
        details: projectKey
          ? `Found ${projects.length} projects, using "${projectKey}"`
          : `Found ${projects.length} projects`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_projects',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Stop if no project found
    if (!projectKey) {
      return {
        success: false,
        testResults: results,
        summary: 'No projects found - cannot continue tests',
      };
    }

    // 2. Test list_issue_types
    try {
      const result = await new JiraBubble({
        operation: 'list_issue_types',
        project: projectKey,
      }).action();

      const success =
        result.success && result.data.operation === 'list_issue_types';
      const typeCount =
        result.data.operation === 'list_issue_types'
          ? result.data.issue_types?.length || 0
          : 0;

      results.push({
        operation: 'list_issue_types',
        success,
        details: `Found ${typeCount} issue types for ${projectKey}`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_issue_types',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Test create (with markdown description)
    const markdownDescription = `# Integration Test Issue

This issue was created by the **Jira Integration Flow** test.

## Features Tested
- **Bold text** and *italic text*
- \`inline code\` formatting
- [Link to Anthropic](https://anthropic.com)

### Checklist
1. Create issue
2. Update issue
3. Add comments
4. Transition status

> This is a blockquote to test markdown conversion

---

Timestamp: ${timestamp}`;

    try {
      const result = await new JiraBubble({
        operation: 'create',
        project: projectKey,
        summary: `Integration Test Issue - ${timestamp}`,
        description: markdownDescription,
        type: 'Task',
        labels: ['integration-test', 'automated'],
      }).action();

      const success = result.success && result.data.operation === 'create';
      createdIssueKey =
        result.data.operation === 'create' ? result.data.issue?.key : undefined;

      results.push({
        operation: 'create',
        success,
        details: createdIssueKey
          ? `Created issue ${createdIssueKey}`
          : 'Failed to create issue',
        issueKey: createdIssueKey,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'create',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Continue only if we created an issue
    if (createdIssueKey) {
      // 4. Test get
      try {
        const result = await new JiraBubble({
          operation: 'get',
          key: createdIssueKey,
          expand: ['transitions'],
        }).action();

        const success = result.success && result.data.operation === 'get';
        const issue =
          result.data.operation === 'get' ? result.data.issue : undefined;

        results.push({
          operation: 'get',
          success,
          details: issue
            ? `Retrieved: ${issue.fields?.summary}`
            : 'Failed to get issue',
          issueKey: createdIssueKey,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'get',
          success: false,
          issueKey: createdIssueKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 5. Test update
      try {
        const result = await new JiraBubble({
          operation: 'update',
          key: createdIssueKey,
          summary: `Integration Test Issue (Updated) - ${timestamp}`,
          priority: 'High',
          labels: { add: ['updated'] },
        }).action();

        const success = result.success && result.data.operation === 'update';

        results.push({
          operation: 'update',
          success,
          details: success
            ? 'Updated summary, priority, and labels'
            : 'Failed to update',
          issueKey: createdIssueKey,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'update',
          success: false,
          issueKey: createdIssueKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 6. Test add_comment (with markdown)
      const markdownComment = `## Test Comment

This comment tests **markdown** formatting:
- Bold: **works**
- Italic: *works*
- Code: \`console.log('hello')\`
- Link: [Documentation](https://docs.example.com)

\`\`\`javascript
// Code block test
function test() {
  return 'Integration Flow';
}
\`\`\`

Timestamp: ${timestamp}`;

      try {
        const result = await new JiraBubble({
          operation: 'add_comment',
          key: createdIssueKey,
          body: markdownComment,
        }).action();

        const success =
          result.success && result.data.operation === 'add_comment';

        results.push({
          operation: 'add_comment',
          success,
          details: success ? 'Added test comment' : 'Failed to add comment',
          issueKey: createdIssueKey,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'add_comment',
          success: false,
          issueKey: createdIssueKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 7. Test get_comments
      try {
        const result = await new JiraBubble({
          operation: 'get_comments',
          key: createdIssueKey,
        }).action();

        const success =
          result.success && result.data.operation === 'get_comments';
        const commentCount =
          result.data.operation === 'get_comments'
            ? result.data.comments?.length || 0
            : 0;

        results.push({
          operation: 'get_comments',
          success,
          details: `Found ${commentCount} comments`,
          issueKey: createdIssueKey,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_comments',
          success: false,
          issueKey: createdIssueKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 8. Test list_transitions
      let availableTransitions: Array<{
        id: string;
        name: string;
        to?: { name: string };
      }> = [];
      try {
        const result = await new JiraBubble({
          operation: 'list_transitions',
          key: createdIssueKey,
        }).action();

        const success =
          result.success && result.data.operation === 'list_transitions';
        availableTransitions =
          result.data.operation === 'list_transitions'
            ? result.data.transitions || []
            : [];

        results.push({
          operation: 'list_transitions',
          success,
          details: `Found ${availableTransitions.length} transitions`,
          issueKey: createdIssueKey,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'list_transitions',
          success: false,
          issueKey: createdIssueKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 9. Test transition (if transitions available)
      if (availableTransitions.length > 0) {
        try {
          // Find "In Progress" transition or use the first available
          const targetTransition =
            availableTransitions.find(
              (t) =>
                t.name.toLowerCase().includes('progress') ||
                t.to?.name?.toLowerCase().includes('progress')
            ) || availableTransitions[0];

          const result = await new JiraBubble({
            operation: 'transition',
            key: createdIssueKey,
            transition_id: targetTransition.id,
            comment: 'Transitioning via Integration Flow test',
          }).action();

          const success =
            result.success && result.data.operation === 'transition';

          results.push({
            operation: 'transition',
            success,
            details: success
              ? `Transitioned to ${targetTransition.to?.name || targetTransition.name}`
              : 'Failed to transition',
            issueKey: createdIssueKey,
            error: result.data.error,
          });
        } catch (error) {
          results.push({
            operation: 'transition',
            success: false,
            issueKey: createdIssueKey,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 10. Test search
    try {
      const result = await new JiraBubble({
        operation: 'search',
        jql: `project = "${projectKey}" AND labels = "integration-test" ORDER BY created DESC`,
        limit: 5,
        fields: ['summary', 'status', 'priority'],
      }).action();

      const success = result.success && result.data.operation === 'search';
      const issueCount =
        result.data.operation === 'search'
          ? result.data.issues?.length || 0
          : 0;

      results.push({
        operation: 'search',
        success,
        details: `Found ${issueCount} issues with integration-test label`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'search',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const allPassed = successCount === totalCount;

    return {
      success: allPassed,
      testResults: results,
      createdIssueKey,
      projectKey,
      summary: `${successCount}/${totalCount} operations succeeded`,
    };
  }
}
