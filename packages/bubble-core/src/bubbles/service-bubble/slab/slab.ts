import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  SlabParamsSchema,
  SlabResultSchema,
  type SlabParams,
  type SlabParamsInput,
  type SlabResult,
  type SlabSearchPostsParams,
  type SlabGetPostParams,
  type SlabListPostsParams,
  type SlabGetTopicPostsParams,
  type SlabListTopicsParams,
} from './slab.schema.js';

// Slab GraphQL API endpoint
const SLAB_API_URL = 'https://api.slab.com/v1/graphql';

/**
 * SlabBubble - Integration with Slab knowledge management platform
 *
 * Provides operations for interacting with Slab:
 * - Search posts across the workspace
 * - Get specific post details
 * - List all organization posts
 * - Get posts within a topic
 * - List all topics
 *
 * @example
 * ```typescript
 * // Search for posts
 * const result = await new SlabBubble({
 *   operation: 'search_posts',
 *   query: 'onboarding guide',
 *   first: 10,
 * }).action();
 *
 * // Get a specific post
 * const post = await new SlabBubble({
 *   operation: 'get_post',
 *   post_id: 'abc123',
 * }).action();
 * ```
 */
export class SlabBubble<
  T extends SlabParamsInput = SlabParamsInput,
> extends ServiceBubble<T, Extract<SlabResult, { operation: T['operation'] }>> {
  // REQUIRED: Static metadata for BubbleFactory
  static readonly service = 'slab';
  static readonly authType = 'basic' as const;
  static readonly bubbleName = 'slab' as const;
  static readonly type = 'service' as const;
  static readonly schema = SlabParamsSchema;
  static readonly resultSchema = SlabResultSchema;
  static readonly shortDescription =
    'Slab knowledge management for searching and managing posts';
  static readonly longDescription = `
    Slab is a knowledge management platform for modern teams.
    This bubble provides operations for:
    - Searching posts across the workspace
    - Retrieving specific post details and content
    - Listing all organization posts
    - Getting posts within specific topics
    - Listing all topics in the organization

    Authentication:
    - Uses API token (available on Business/Enterprise plans)
    - Token is passed via Authorization header

    Use Cases:
    - Search internal knowledge base from automated workflows
    - Sync documentation with external systems
    - Build AI assistants that leverage internal knowledge
    - Automate content updates across the organization
  `;
  static readonly alias = 'slab-kb';

  constructor(
    params: T = {
      operation: 'search_posts',
      query: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Choose the appropriate credential for Slab API
   */
  protected chooseCredential(): string | undefined {
    const params = this.params as SlabParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.SLAB_CRED];
  }

  /**
   * Test if the credential is valid by making a simple API call
   */
  async testCredential(): Promise<boolean> {
    const apiToken = this.chooseCredential();
    if (!apiToken) {
      return false;
    }

    // Use a simple query to validate the token
    const result = await this.makeSlabRequest(`
      query {
        organization {
          name
        }
      }
    `);
    if (result.errors) {
      throw new Error('Slab API token validation failed');
    }
    return true;
  }

  /**
   * Perform the Slab operation
   */
  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SlabResult, { operation: T['operation'] }>> {
    void context;

    const params = this.params as SlabParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'search_posts':
          return (await this.searchPosts(
            params as SlabSearchPostsParams
          )) as Extract<SlabResult, { operation: T['operation'] }>;

        case 'get_post':
          return (await this.getPost(params as SlabGetPostParams)) as Extract<
            SlabResult,
            { operation: T['operation'] }
          >;

        case 'list_posts':
          return (await this.listPosts(
            params as SlabListPostsParams
          )) as Extract<SlabResult, { operation: T['operation'] }>;

        case 'get_topic_posts':
          return (await this.getTopicPosts(
            params as SlabGetTopicPostsParams
          )) as Extract<SlabResult, { operation: T['operation'] }>;

        case 'list_topics':
          return (await this.listTopics(
            params as SlabListTopicsParams
          )) as Extract<SlabResult, { operation: T['operation'] }>;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        operation,
        success: false,
        error: errorMessage,
      } as Extract<SlabResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Make an authenticated GraphQL request to Slab
   */
  private async makeSlabRequest(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const apiToken = this.chooseCredential();
    if (!apiToken) {
      throw new Error('Slab API token is required');
    }

    const response = await fetch(SLAB_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slab API error (HTTP ${response.status}): ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (data.errors) {
      const errors = data.errors as Array<{ message?: string }>;
      const errorMsg = errors
        .map((e) => e.message || 'Unknown error')
        .join('; ');
      throw new Error(`Slab GraphQL error: ${errorMsg}`);
    }

    return data;
  }

  /**
   * Search posts by query
   */
  private async searchPosts(
    params: SlabSearchPostsParams
  ): Promise<Extract<SlabResult, { operation: 'search_posts' }>> {
    const response = await this.makeSlabRequest(
      `
      query SearchPosts($query: String!, $first: Int, $after: String) {
        search(query: $query, first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ... on PostSearchResult {
                title
                content
                highlight
                post {
                  id
                  title
                  insertedAt
                  publishedAt
                  owner {
                    id
                    name
                  }
                  topics {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `,
      {
        query: params.query,
        first: params.first,
        after: params.after,
      }
    );

    const searchData = (response.data as Record<string, unknown>)?.search as
      | Record<string, unknown>
      | undefined;
    const edges = (searchData?.edges as Array<Record<string, unknown>>) || [];
    const pageInfo = searchData?.pageInfo as
      | Record<string, unknown>
      | undefined;

    const posts = edges
      .map((edge) => {
        const node = edge.node as Record<string, unknown> | undefined;
        if (!node || !node.post) return null;
        const post = node.post as Record<string, unknown>;
        return {
          id: post.id as string,
          title: (node.title as string) || (post.title as string),
          highlight: node.highlight,
          content: node.content,
          insertedAt: post.insertedAt as string | undefined,
          publishedAt: post.publishedAt as string | undefined,
          owner: post.owner as { id: string; name: string } | undefined,
          topics: post.topics as
            | Array<{ id: string; name: string }>
            | undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      operation: 'search_posts',
      success: true,
      posts,
      has_more: (pageInfo?.hasNextPage as boolean) || false,
      end_cursor: pageInfo?.endCursor as string | undefined,
      error: '',
    };
  }

  /**
   * Get a specific post by ID
   */
  private async getPost(
    params: SlabGetPostParams
  ): Promise<Extract<SlabResult, { operation: 'get_post' }>> {
    const response = await this.makeSlabRequest(
      `
      query GetPost($id: ID!) {
        post(id: $id) {
          id
          title
          content
          insertedAt
          publishedAt
          updatedAt
          archivedAt
          version
          owner {
            id
            name
          }
          topics {
            id
            name
          }
        }
      }
    `,
      { id: params.post_id }
    );

    const post = (response.data as Record<string, unknown>)?.post as
      | Record<string, unknown>
      | undefined;

    return {
      operation: 'get_post',
      success: true,
      post: post
        ? {
            id: post.id as string,
            title: post.title as string,
            content: post.content,
            insertedAt: post.insertedAt as string | undefined,
            publishedAt: post.publishedAt as string | undefined,
            updatedAt: post.updatedAt as string | undefined,
            archivedAt: post.archivedAt as string | undefined,
            version: post.version as number | undefined,
            owner: post.owner as { id: string; name: string } | undefined,
            topics: post.topics as
              | Array<{ id: string; name: string }>
              | undefined,
          }
        : undefined,
      error: '',
    };
  }

  /**
   * List all organization posts
   */
  private async listPosts(
    params: SlabListPostsParams
  ): Promise<Extract<SlabResult, { operation: 'list_posts' }>> {
    void params;

    // organization.posts returns SlimPost type (limited fields)
    const response = await this.makeSlabRequest(`
      query {
        organization {
          posts {
            id
            title
            publishedAt
            archivedAt
          }
        }
      }
    `);

    const org = (response.data as Record<string, unknown>)?.organization as
      | Record<string, unknown>
      | undefined;
    const posts = (org?.posts as Array<Record<string, unknown>>) || [];

    return {
      operation: 'list_posts',
      success: true,
      posts: posts.map((p) => ({
        id: p.id as string,
        title: p.title as string,
        publishedAt: p.publishedAt as string | undefined,
        archivedAt: p.archivedAt as string | undefined,
      })),
      error: '',
    };
  }

  /**
   * Get posts within a specific topic
   */
  private async getTopicPosts(
    params: SlabGetTopicPostsParams
  ): Promise<Extract<SlabResult, { operation: 'get_topic_posts' }>> {
    const response = await this.makeSlabRequest(
      `
      query GetTopicPosts($id: ID!) {
        topic(id: $id) {
          posts {
            id
            title
            content
            insertedAt
            publishedAt
            updatedAt
            owner {
              id
              name
            }
          }
        }
      }
    `,
      { id: params.topic_id }
    );

    const topic = (response.data as Record<string, unknown>)?.topic as
      | Record<string, unknown>
      | undefined;
    const posts = (topic?.posts as Array<Record<string, unknown>>) || [];

    return {
      operation: 'get_topic_posts',
      success: true,
      posts: posts.map((p) => ({
        id: p.id as string,
        title: p.title as string,
        content: p.content,
        insertedAt: p.insertedAt as string | undefined,
        publishedAt: p.publishedAt as string | undefined,
        updatedAt: p.updatedAt as string | undefined,
        owner: p.owner as { id: string; name: string } | undefined,
      })),
      error: '',
    };
  }

  /**
   * List all topics in the organization
   */
  private async listTopics(
    params: SlabListTopicsParams
  ): Promise<Extract<SlabResult, { operation: 'list_topics' }>> {
    void params;

    const response = await this.makeSlabRequest(`
      query {
        organization {
          topics {
            id
            name
          }
        }
      }
    `);

    const org = (response.data as Record<string, unknown>)?.organization as
      | Record<string, unknown>
      | undefined;
    const topics = (org?.topics as Array<Record<string, unknown>>) || [];

    return {
      operation: 'list_topics',
      success: true,
      topics: topics.map((t) => ({
        id: t.id as string,
        name: t.name as string,
      })),
      error: '',
    };
  }
}
