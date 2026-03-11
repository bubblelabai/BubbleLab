import {
  BubbleFlow,
  type WebhookEvent,
  SlabBubble,
} from '@bubblelab/bubble-core';

/**
 * Output structure for the Slab integration test
 */
export interface Output {
  postId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Test payload for the integration flow
 */
export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * SlabIntegrationTest - Comprehensive integration test for Slab bubble
 *
 * This flow exercises all post operations:
 * 1. List all organization posts
 * 2. Search posts by query
 * 3. Get a specific post by ID (using first result from list)
 * 4. Get posts within a topic (if topics exist)
 *
 * Edge cases tested:
 * - Empty search results
 * - Pagination handling
 */
export class SlabIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let postId = '';

    // 1. List all organization posts
    try {
      const listResult = await new SlabBubble({
        operation: 'list_posts',
      }).action();

      results.push({
        operation: 'list_posts',
        success: listResult.success,
        details: listResult.success
          ? `Listed ${listResult.data?.posts?.length || 0} post(s)`
          : listResult.error,
      });

      // Grab first post ID for subsequent tests
      if (
        listResult.success &&
        listResult.data?.posts &&
        listResult.data.posts.length > 0
      ) {
        postId = listResult.data.posts[0].id;
      }
    } catch (error) {
      results.push({
        operation: 'list_posts',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 2. Search posts
    try {
      const searchResult = await new SlabBubble({
        operation: 'search_posts',
        query: 'guide',
        first: 5,
      }).action();

      results.push({
        operation: 'search_posts',
        success: searchResult.success,
        details: searchResult.success
          ? `Found ${searchResult.data?.posts?.length || 0} post(s), has_more: ${searchResult.data?.has_more}`
          : searchResult.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_posts',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Get a specific post (if we have a post ID)
    if (postId) {
      try {
        const getResult = await new SlabBubble({
          operation: 'get_post',
          post_id: postId,
        }).action();

        results.push({
          operation: 'get_post',
          success: getResult.success,
          details: getResult.success
            ? `Retrieved post: "${getResult.data?.post?.title}"`
            : getResult.error,
        });

        // Verify data integrity
        if (getResult.success && getResult.data?.post) {
          const hasTitle = !!getResult.data.post.title;
          results.push({
            operation: 'verify_post_data',
            success: hasTitle,
            details: hasTitle
              ? `Post has title, version: ${getResult.data.post.version}`
              : 'Post missing title',
          });

          // Check if post has topics for next test
          const topics = getResult.data.post.topics;
          if (topics && topics.length > 0) {
            // 4. Get topic posts
            try {
              const topicResult = await new SlabBubble({
                operation: 'get_topic_posts',
                topic_id: topics[0].id,
              }).action();

              results.push({
                operation: 'get_topic_posts',
                success: topicResult.success,
                details: topicResult.success
                  ? `Topic "${topics[0].name}" has ${topicResult.data?.posts?.length || 0} post(s)`
                  : topicResult.error,
              });
            } catch (error) {
              results.push({
                operation: 'get_topic_posts',
                success: false,
                details:
                  error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      } catch (error) {
        results.push({
          operation: 'get_post',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 5. Test empty search (edge case)
    try {
      const emptySearch = await new SlabBubble({
        operation: 'search_posts',
        query: `zzz_nonexistent_${Date.now()}`,
        first: 1,
      }).action();

      results.push({
        operation: 'search_empty_results',
        success: emptySearch.success,
        details: emptySearch.success
          ? `Empty search returned ${emptySearch.data?.posts?.length || 0} result(s)`
          : emptySearch.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_empty_results',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      postId,
      testResults: results,
    };
  }
}
