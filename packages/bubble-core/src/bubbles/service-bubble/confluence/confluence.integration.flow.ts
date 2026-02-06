import {
  BubbleFlow,
  type WebhookEvent,
  ConfluenceBubble,
} from '@bubblelab/bubble-core';

export interface TestResult {
  operation: string;
  success: boolean;
  details?: string;
  pageId?: string;
  error?: string;
}

export interface Output {
  success: boolean;
  testResults: TestResult[];
  createdPageId?: string;
  spaceId?: string;
  summary: string;
}

export type ConfluenceIntegrationTestPayload = WebhookEvent;

/**
 * Integration flow test for ConfluenceBubble
 *
 * Automatically discovers the first available space and tests key operations:
 * 1. list_spaces - List available Confluence spaces (uses first one found)
 * 2. get_space - Get details for the discovered space
 * 3. create_page - Create a new test page
 * 4. get_page - Retrieve the created page
 * 5. update_page - Update the page content
 * 6. add_comment - Add a comment to the page
 * 7. get_comments - Retrieve comments
 * 8. search - Search for content using CQL
 * 9. list_pages - List pages in the space
 * 10. delete_page - Delete the test page
 */
export class ConfluenceIntegrationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: ConfluenceIntegrationTestPayload): Promise<Output> {
    const results: TestResult[] = [];
    const timestamp = new Date().toISOString();
    let createdPageId: string | undefined;
    let spaceId: string | undefined;

    // 1. Test list_spaces
    try {
      const result = await new ConfluenceBubble({
        operation: 'list_spaces',
        limit: 10,
      }).action();

      const success = result.success && result.data.operation === 'list_spaces';
      const spaces =
        result.data.operation === 'list_spaces' ? result.data.spaces || [] : [];

      if (spaces.length > 0) {
        spaceId = spaces[0].id;
      }

      results.push({
        operation: 'list_spaces',
        success,
        details: spaceId
          ? `Found ${spaces.length} spaces, using ID "${spaceId}"`
          : `Found ${spaces.length} spaces`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_spaces',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (!spaceId) {
      return {
        success: false,
        testResults: results,
        summary: 'No spaces found - cannot continue tests',
      };
    }

    // 2. Test get_space
    try {
      const result = await new ConfluenceBubble({
        operation: 'get_space',
        space_id: spaceId,
      }).action();

      const success = result.success && result.data.operation === 'get_space';

      results.push({
        operation: 'get_space',
        success,
        details: success
          ? `Retrieved space: ${(result.data as { space?: { name?: string } }).space?.name || spaceId}`
          : 'Failed to get space',
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'get_space',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Test create_page
    const markdownContent = `# Integration Test Page

This page was created by the **Confluence Integration Flow** test.

## Features Tested
- **Bold text** and *italic text*
- \`inline code\` formatting
- [Link to Anthropic](https://anthropic.com)

### Checklist
1. Create page
2. Update page
3. Add comments
4. Search content

> This is a blockquote to test markdown conversion

---

Timestamp: ${timestamp}`;

    try {
      const result = await new ConfluenceBubble({
        operation: 'create_page',
        space_id: spaceId,
        title: `Integration Test Page - ${timestamp}`,
        body: markdownContent,
      }).action();

      const success = result.success && result.data.operation === 'create_page';
      createdPageId =
        result.data.operation === 'create_page'
          ? result.data.page?.id
          : undefined;

      results.push({
        operation: 'create_page',
        success,
        details: createdPageId
          ? `Created page ${createdPageId}`
          : 'Failed to create page',
        pageId: createdPageId,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_page',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (createdPageId) {
      // 4. Test get_page
      try {
        const result = await new ConfluenceBubble({
          operation: 'get_page',
          page_id: createdPageId,
          include_body: true,
        }).action();

        const success = result.success && result.data.operation === 'get_page';

        results.push({
          operation: 'get_page',
          success,
          details: success
            ? `Retrieved page: ${(result.data as { page?: { title?: string } }).page?.title}`
            : 'Failed to get page',
          pageId: createdPageId,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_page',
          success: false,
          pageId: createdPageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 5. Test update_page
      try {
        const result = await new ConfluenceBubble({
          operation: 'update_page',
          page_id: createdPageId,
          title: `Integration Test Page (Updated) - ${timestamp}`,
          body: `${markdownContent}\n\n## Update\nThis page was updated by the integration test.`,
          version_message: 'Updated by integration test',
        }).action();

        const success =
          result.success && result.data.operation === 'update_page';

        results.push({
          operation: 'update_page',
          success,
          details: success
            ? 'Updated page title and content'
            : 'Failed to update',
          pageId: createdPageId,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'update_page',
          success: false,
          pageId: createdPageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 6. Test add_comment
      try {
        const result = await new ConfluenceBubble({
          operation: 'add_comment',
          page_id: createdPageId,
          body: `## Test Comment\n\nThis comment tests **markdown** formatting.\n\nTimestamp: ${timestamp}`,
        }).action();

        const success =
          result.success && result.data.operation === 'add_comment';

        results.push({
          operation: 'add_comment',
          success,
          details: success ? 'Added test comment' : 'Failed to add comment',
          pageId: createdPageId,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'add_comment',
          success: false,
          pageId: createdPageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // 7. Test get_comments
      try {
        const result = await new ConfluenceBubble({
          operation: 'get_comments',
          page_id: createdPageId,
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
          pageId: createdPageId,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_comments',
          success: false,
          pageId: createdPageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 8. Test search (uses general CQL query for established content;
    //    newly created pages have a long indexing delay on Confluence Cloud)
    try {
      const result = await new ConfluenceBubble({
        operation: 'search',
        cql: `type=page ORDER BY created DESC`,
        limit: 5,
      }).action();

      const resultCount =
        result.data.operation === 'search'
          ? result.data.results?.length || 0
          : 0;
      const success =
        result.success && result.data.operation === 'search' && resultCount > 0;

      results.push({
        operation: 'search',
        success,
        details: success
          ? `Found ${resultCount} results`
          : `Search returned 0 results (may indicate indexing issue)`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'search',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 9. Test list_pages
    try {
      const result = await new ConfluenceBubble({
        operation: 'list_pages',
        space_id: spaceId,
        limit: 5,
      }).action();

      const success = result.success && result.data.operation === 'list_pages';
      const pageCount =
        result.data.operation === 'list_pages'
          ? result.data.pages?.length || 0
          : 0;

      results.push({
        operation: 'list_pages',
        success,
        details: `Found ${pageCount} pages in space`,
        error: result.data.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_pages',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 10. Test delete_page (clean up)
    if (createdPageId) {
      try {
        const result = await new ConfluenceBubble({
          operation: 'delete_page',
          page_id: createdPageId,
        }).action();

        const success =
          result.success && result.data.operation === 'delete_page';

        results.push({
          operation: 'delete_page',
          success,
          details: success ? 'Deleted test page' : 'Failed to delete page',
          pageId: createdPageId,
          error: result.data.error,
        });
      } catch (error) {
        results.push({
          operation: 'delete_page',
          success: false,
          pageId: createdPageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const allPassed = successCount === totalCount;

    return {
      success: allPassed,
      testResults: results,
      createdPageId,
      spaceId,
      summary: `${successCount}/${totalCount} operations succeeded`,
    };
  }
}
