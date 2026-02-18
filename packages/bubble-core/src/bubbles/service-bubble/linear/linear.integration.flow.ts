import {
  BubbleFlow,
  type WebhookEvent,
  LinearBubble,
} from '@bubblelab/bubble-core';

export interface TestResult {
  operation: string;
  success: boolean;
  details?: string;
  data?: unknown;
}

export interface Output {
  success: boolean;
  testResults: TestResult[];
  createdIssueIdentifier?: string;
  teamId?: string;
  summary: string;
}

/**
 * Integration test flow for the Linear bubble.
 *
 * Tests all operations sequentially:
 * 1. list_teams - Find a team to work with
 * 2. list_workflow_states - Get workflow states for the team
 * 3. list_labels - Get labels for the team
 * 4. list_projects - Get projects
 * 5. create - Create a test issue with markdown description
 * 6. get - Retrieve the created issue
 * 7. update - Update the issue (title, priority, state change by name)
 * 8. add_comment - Add a markdown comment
 * 9. get_comments - Retrieve comments
 * 10. search - Search for the test issue
 */
export class LinearIntegrationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: WebhookEvent): Promise<Output> {
    const testResults: TestResult[] = [];
    let teamId: string | undefined;
    let createdIssueId: string | undefined;
    let createdIssueIdentifier: string | undefined;
    let workflowStates: Array<{ id: string; name: string; type?: string }> = [];

    // -----------------------------------------------------------------------
    // TEST 1: list_teams
    // -----------------------------------------------------------------------
    try {
      const result = await new LinearBubble({
        operation: 'list_teams' as const,
      }).action();

      if (
        result.success &&
        result.data.operation === 'list_teams' &&
        result.data.teams &&
        result.data.teams.length > 0
      ) {
        const team = result.data.teams[0];
        teamId = team.id;
        testResults.push({
          operation: 'list_teams',
          success: true,
          details: `Found ${result.data.teams.length} team(s). Using: ${team.name} (${team.key})`,
          data: { teamId, totalTeams: result.data.teams.length },
        });
      } else {
        testResults.push({
          operation: 'list_teams',
          success: false,
          details: `No teams found or error: ${result.data.error}`,
        });
        return {
          success: false,
          testResults,
          summary: 'Cannot proceed without a team',
        };
      }
    } catch (error) {
      testResults.push({
        operation: 'list_teams',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      return {
        success: false,
        testResults,
        summary: 'Cannot proceed without a team',
      };
    }

    // -----------------------------------------------------------------------
    // TEST 2: list_workflow_states
    // -----------------------------------------------------------------------
    try {
      const result = await new LinearBubble({
        operation: 'list_workflow_states' as const,
        teamId: teamId!,
      }).action();

      if (
        result.success &&
        result.data.operation === 'list_workflow_states' &&
        result.data.states
      ) {
        workflowStates = result.data.states;
        testResults.push({
          operation: 'list_workflow_states',
          success: true,
          details: `Found ${workflowStates.length} state(s): ${workflowStates.map((s) => s.name).join(', ')}`,
          data: workflowStates,
        });
      } else {
        testResults.push({
          operation: 'list_workflow_states',
          success: false,
          details: `Error: ${result.data.error}`,
        });
      }
    } catch (error) {
      testResults.push({
        operation: 'list_workflow_states',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // -----------------------------------------------------------------------
    // TEST 3: list_labels
    // -----------------------------------------------------------------------
    try {
      const result = await new LinearBubble({
        operation: 'list_labels' as const,
        teamId: teamId!,
      }).action();

      if (
        result.success &&
        result.data.operation === 'list_labels' &&
        result.data.labels
      ) {
        testResults.push({
          operation: 'list_labels',
          success: true,
          details: `Found ${result.data.labels.length} label(s)`,
          data: result.data.labels,
        });
      } else {
        testResults.push({
          operation: 'list_labels',
          success: false,
          details: `Error: ${result.data.error}`,
        });
      }
    } catch (error) {
      testResults.push({
        operation: 'list_labels',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // -----------------------------------------------------------------------
    // TEST 4: list_projects
    // -----------------------------------------------------------------------
    try {
      const result = await new LinearBubble({
        operation: 'list_projects' as const,
        teamId: teamId!,
      }).action();

      if (
        result.success &&
        result.data.operation === 'list_projects' &&
        result.data.projects
      ) {
        testResults.push({
          operation: 'list_projects',
          success: true,
          details: `Found ${result.data.projects.length} project(s)`,
          data: result.data.projects,
        });
      } else {
        testResults.push({
          operation: 'list_projects',
          success: false,
          details: `Error: ${result.data.error}`,
        });
      }
    } catch (error) {
      testResults.push({
        operation: 'list_projects',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // -----------------------------------------------------------------------
    // TEST 5: create
    // -----------------------------------------------------------------------
    try {
      const description = `# Integration Test Issue

This issue was created by the **Linear Integration Test Flow**.

## Test Details
- **Created at**: ${new Date().toISOString()}
- **Purpose**: Verify all Linear bubble operations

### Markdown Features Tested
1. **Bold text**
2. *Italic text*
3. \`Inline code\`
4. [Link to BubbleLab](https://bubblelab.ai)

> This is a blockquote for testing

\`\`\`typescript
const test = "Hello from integration test!";
console.log(test);
\`\`\`

---

- Bullet point 1
- Bullet point 2
- Bullet point 3`;

      const result = await new LinearBubble({
        operation: 'create' as const,
        teamId: teamId!,
        title: `[Integration Test] Linear Bubble Test - ${new Date().toISOString()}`,
        description,
        priority: 4, // Low priority
      }).action();

      if (
        result.success &&
        result.data.operation === 'create' &&
        result.data.issue
      ) {
        createdIssueId = result.data.issue.id;
        createdIssueIdentifier = result.data.issue.identifier;
        testResults.push({
          operation: 'create',
          success: true,
          details: `Created issue ${result.data.issue.identifier}${result.data.issue.url ? ` (${result.data.issue.url})` : ''}`,
          data: result.data.issue,
        });
      } else {
        testResults.push({
          operation: 'create',
          success: false,
          details: `Error: ${result.data.error}`,
        });
      }
    } catch (error) {
      testResults.push({
        operation: 'create',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // -----------------------------------------------------------------------
    // TEST 6: get
    // -----------------------------------------------------------------------
    if (createdIssueIdentifier) {
      try {
        const result = await new LinearBubble({
          operation: 'get' as const,
          identifier: createdIssueIdentifier,
        }).action();

        if (
          result.success &&
          result.data.operation === 'get' &&
          result.data.issue
        ) {
          testResults.push({
            operation: 'get',
            success: true,
            details: `Retrieved issue ${createdIssueIdentifier}`,
            data: result.data.issue,
          });
        } else {
          testResults.push({
            operation: 'get',
            success: false,
            details: `Error: ${result.data.error}`,
          });
        }
      } catch (error) {
        testResults.push({
          operation: 'get',
          success: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // TEST 7: update (including state change by name)
    // -----------------------------------------------------------------------
    if (createdIssueId) {
      try {
        const targetState = workflowStates.find(
          (s) => s.type === 'started' || s.name.toLowerCase() === 'in progress'
        );

        const result = await new LinearBubble({
          operation: 'update' as const,
          id: createdIssueId,
          title: `[Integration Test] Updated - ${new Date().toISOString()}`,
          priority: 3, // Medium
          ...(targetState ? { stateName: targetState.name } : {}),
        }).action();

        if (result.success) {
          testResults.push({
            operation: 'update',
            success: true,
            details: `Updated issue${targetState ? ` and transitioned to "${targetState.name}"` : ''}`,
            data: result.data,
          });
        } else {
          testResults.push({
            operation: 'update',
            success: false,
            details: `Error: ${result.data.error}`,
          });
        }
      } catch (error) {
        testResults.push({
          operation: 'update',
          success: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // TEST 8: add_comment
    // -----------------------------------------------------------------------
    if (createdIssueId) {
      try {
        const commentBody = `## Integration Test Comment

This comment was added by the integration test.

\`\`\`json
{
  "test": true,
  "timestamp": "${new Date().toISOString()}"
}
\`\`\`

**Status**: All operations tested successfully so far!`;

        const result = await new LinearBubble({
          operation: 'add_comment' as const,
          issueId: createdIssueId,
          body: commentBody,
        }).action();

        if (result.success) {
          testResults.push({
            operation: 'add_comment',
            success: true,
            details: 'Added markdown comment',
            data: result.data,
          });
        } else {
          testResults.push({
            operation: 'add_comment',
            success: false,
            details: `Error: ${result.data.error}`,
          });
        }
      } catch (error) {
        testResults.push({
          operation: 'add_comment',
          success: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // TEST 9: get_comments
    // -----------------------------------------------------------------------
    if (createdIssueId) {
      try {
        const result = await new LinearBubble({
          operation: 'get_comments' as const,
          issueId: createdIssueId,
        }).action();

        if (
          result.success &&
          result.data.operation === 'get_comments' &&
          result.data.comments
        ) {
          testResults.push({
            operation: 'get_comments',
            success: true,
            details: `Retrieved ${result.data.comments.length} comment(s)`,
            data: result.data.comments,
          });
        } else {
          testResults.push({
            operation: 'get_comments',
            success: false,
            details: `Error: ${result.data.error}`,
          });
        }
      } catch (error) {
        testResults.push({
          operation: 'get_comments',
          success: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // TEST 10: search
    // -----------------------------------------------------------------------
    try {
      const result = await new LinearBubble({
        operation: 'search' as const,
        query: 'Integration Test',
        teamId: teamId!,
        limit: 5,
      }).action();

      if (
        result.success &&
        result.data.operation === 'search' &&
        result.data.issues
      ) {
        testResults.push({
          operation: 'search',
          success: true,
          details: `Found ${result.data.issues.length} issue(s) matching "Integration Test"`,
          data: { total: result.data.total },
        });
      } else {
        testResults.push({
          operation: 'search',
          success: false,
          details: `Error: ${result.data.error}`,
        });
      }
    } catch (error) {
      testResults.push({
        operation: 'search',
        success: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const successCount = testResults.filter((t) => t.success).length;
    const totalCount = testResults.length;

    return {
      success: successCount === totalCount,
      testResults,
      createdIssueIdentifier,
      teamId,
      summary: `${successCount}/${totalCount} tests passed${createdIssueIdentifier ? `. Created: ${createdIssueIdentifier}` : ''}`,
    };
  }
}
