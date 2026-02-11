import {
  BubbleFlow,
  NotionBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  databaseId: string;
  dataSourceId: string;
  createdPageId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Notion Integration Test workflow.
 */
export interface NotionIntegrationTestPayload extends WebhookEvent {
  /**
   * The Notion Database ID to test against (the 32-character hex ID from the Notion URL).
   * This test deliberately passes database_id where data_source_id is expected,
   * verifying that the NotionBubble auto-resolves it correctly.
   * @canBeFile false
   */
  notionDatabaseId: string;
}

/**
 * Notion Integration Test Flow
 *
 * Tests NotionBubble operations end-to-end, specifically verifying that the
 * database_id → data_source_id auto-resolution works correctly. This simulates
 * the exact pattern users follow: they only know the database_id from the URL
 * and pass it everywhere, even where data_source_id is required.
 *
 * Test sequence:
 * 1. retrieve_database — get schema and discover data_source_id
 * 2. create_page with parent type "database_id" — tests auto-resolution in create_page
 * 3. query_data_source with database_id param — tests the convenience alias
 * 4. query_data_source with data_source_id set to database_id value — tests the fallback
 * 5. Verify the created page appears in query results
 * 6. Clean up by archiving the test page
 */
export class NotionIntegrationTest extends BubbleFlow<'webhook/http'> {
  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  /** Retrieves database metadata and extracts the data_source_id from the response. */
  private async retrieveDatabase(databaseId: string) {
    const result = await new NotionBubble({
      operation: 'retrieve_database',
      database_id: databaseId,
    }).action();

    if (!result.success || !result.data?.database) {
      throw new Error(`Failed to retrieve database: ${result.error}`);
    }

    return result.data.database as Record<string, unknown>;
  }

  // ============================================================================
  // PAGE OPERATIONS
  // ============================================================================

  /**
   * Creates a page using parent type "database_id" — the NotionBubble should
   * auto-resolve this to the correct data_source_id via retrieve_database.
   */
  private async createPageWithDatabaseId(
    databaseId: string,
    titleProperty: string,
    taskName: string
  ) {
    const result = await new NotionBubble({
      operation: 'create_page',
      parent: { type: 'database_id', database_id: databaseId },
      properties: {
        [titleProperty]: {
          title: [{ text: { content: taskName } }],
        },
      },
    }).action();

    if (!result.success || !result.data?.page) {
      throw new Error(`Failed to create page: ${result.error}`);
    }

    return result.data.page as Record<string, unknown>;
  }

  /** Archives a page to clean up test data. */
  private async archivePage(pageId: string) {
    const result = await new NotionBubble({
      operation: 'update_page',
      page_id: pageId,
      in_trash: true,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to archive page: ${result.error}`);
    }

    return result.data?.page as Record<string, unknown>;
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Queries using the new database_id convenience parameter.
   * The NotionBubble should auto-resolve to the correct data_source_id.
   */
  private async queryWithDatabaseIdParam(databaseId: string) {
    const result = await new NotionBubble({
      operation: 'query_data_source',
      database_id: databaseId,
      page_size: 10,
    }).action();

    if (!result.success || !result.data?.results) {
      throw new Error(
        `Failed to query with database_id param: ${result.error}`
      );
    }

    return result.data.results as Array<Record<string, unknown>>;
  }

  /**
   * Queries by passing database_id AS data_source_id — the old broken pattern.
   * The NotionBubble's fallback should catch the error, resolve the real
   * data_source_id, and retry transparently.
   */
  private async queryWithDatabaseIdAsFallback(databaseId: string) {
    const result = await new NotionBubble({
      operation: 'query_data_source',
      data_source_id: databaseId,
      page_size: 10,
    }).action();

    if (!result.success || !result.data?.results) {
      throw new Error(
        `Failed to query with database_id-as-data_source_id fallback: ${result.error}`
      );
    }

    return result.data.results as Array<Record<string, unknown>>;
  }

  /**
   * Queries using the correct data_source_id directly — the happy path.
   */
  private async queryWithCorrectDataSourceId(dataSourceId: string) {
    const result = await new NotionBubble({
      operation: 'query_data_source',
      data_source_id: dataSourceId,
      page_size: 10,
    }).action();

    if (!result.success || !result.data?.results) {
      throw new Error(
        `Failed to query with correct data_source_id: ${result.error}`
      );
    }

    return result.data.results as Array<Record<string, unknown>>;
  }

  // ============================================================================
  // MAIN FLOW
  // ============================================================================

  async handle(payload: NotionIntegrationTestPayload): Promise<Output> {
    const { notionDatabaseId } = payload;
    const results: Output['testResults'] = [];
    const timestamp = Date.now();

    let dataSourceId = '';
    let createdPageId = '';
    let titleProperty = 'Name';

    // ========================================================================
    // 1. RETRIEVE DATABASE — discover schema and data_source_id
    // ========================================================================
    try {
      const database = await this.retrieveDatabase(notionDatabaseId);

      const dataSources = database.data_sources as
        | Array<{ id: string }>
        | undefined;
      if (dataSources && dataSources.length > 0) {
        dataSourceId = dataSources[0].id;
      }

      // Find the title property name from the schema
      const props = database.properties as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (props) {
        for (const [name, config] of Object.entries(props)) {
          if (config.type === 'title') {
            titleProperty = name;
            break;
          }
        }
      }

      results.push({
        operation: 'retrieve_database',
        success: true,
        details:
          `Database: ${database.id} | ` +
          `data_source_id: ${dataSourceId} | ` +
          `title property: "${titleProperty}" | ` +
          `IDs are different: ${dataSourceId !== notionDatabaseId}`,
      });
    } catch (error) {
      results.push({
        operation: 'retrieve_database',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      // Can't continue without the database
      return {
        databaseId: notionDatabaseId,
        dataSourceId,
        createdPageId,
        testResults: results,
      };
    }

    // ========================================================================
    // 2. CREATE PAGE with parent type "database_id" — tests auto-resolution
    //    This is what the user's flow does: passes database_id as parent.
    //    The NotionBubble should resolve it to the correct data_source_id.
    // ========================================================================
    try {
      const page = await this.createPageWithDatabaseId(
        notionDatabaseId,
        titleProperty,
        `Integration Test - ${timestamp}`
      );
      createdPageId = page.id as string;

      // Verify the page parent was resolved to data_source_id
      const parent = page.parent as Record<string, unknown> | undefined;
      const resolvedParentType = parent?.type as string | undefined;
      const resolvedParentDsId = parent?.data_source_id as string | undefined;

      results.push({
        operation: 'create_page (database_id parent)',
        success: true,
        details:
          `Created page: ${createdPageId} | ` +
          `Parent resolved to type: "${resolvedParentType}" | ` +
          `data_source_id: ${resolvedParentDsId} | ` +
          `Correctly resolved: ${resolvedParentDsId === dataSourceId}`,
      });
    } catch (error) {
      results.push({
        operation: 'create_page (database_id parent)',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 3. QUERY with database_id param — tests the convenience alias
    //    Uses the new `database_id` parameter on query_data_source.
    // ========================================================================
    try {
      const queryResults =
        await this.queryWithDatabaseIdParam(notionDatabaseId);

      const foundPage = createdPageId
        ? queryResults.some((r) => r.id === createdPageId)
        : false;

      results.push({
        operation: 'query_data_source (database_id param)',
        success: true,
        details:
          `Returned ${queryResults.length} results | ` +
          `Created page found: ${foundPage}`,
      });
    } catch (error) {
      results.push({
        operation: 'query_data_source (database_id param)',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 4. QUERY with database_id AS data_source_id — tests the fallback
    //    This is the exact broken pattern from the user's flow:
    //    `data_source_id: databaseId` where databaseId is actually a database ID.
    //    The NotionBubble's fallback should resolve it transparently.
    // ========================================================================
    try {
      const queryResults =
        await this.queryWithDatabaseIdAsFallback(notionDatabaseId);

      const foundPage = createdPageId
        ? queryResults.some((r) => r.id === createdPageId)
        : false;

      results.push({
        operation:
          'query_data_source (fallback: database_id as data_source_id)',
        success: true,
        details:
          `Returned ${queryResults.length} results | ` +
          `Created page found: ${foundPage} | ` +
          `Fallback resolved correctly`,
      });
    } catch (error) {
      results.push({
        operation:
          'query_data_source (fallback: database_id as data_source_id)',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ========================================================================
    // 5. QUERY with correct data_source_id — baseline / happy path
    // ========================================================================
    if (dataSourceId) {
      try {
        const queryResults =
          await this.queryWithCorrectDataSourceId(dataSourceId);

        const foundPage = createdPageId
          ? queryResults.some((r) => r.id === createdPageId)
          : false;

        results.push({
          operation: 'query_data_source (correct data_source_id)',
          success: true,
          details:
            `Returned ${queryResults.length} results | ` +
            `Created page found: ${foundPage}`,
        });
      } catch (error) {
        results.push({
          operation: 'query_data_source (correct data_source_id)',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 6. CLEANUP — archive the test page
    // ========================================================================
    if (createdPageId) {
      try {
        await this.archivePage(createdPageId);
        results.push({
          operation: 'cleanup (archive page)',
          success: true,
          details: `Archived page: ${createdPageId}`,
        });
      } catch (error) {
        results.push({
          operation: 'cleanup (archive page)',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      databaseId: notionDatabaseId,
      dataSourceId,
      createdPageId,
      testResults: results,
    };
  }
}
