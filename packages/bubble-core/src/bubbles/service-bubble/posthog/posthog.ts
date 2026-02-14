import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  PosthogParamsSchema,
  PosthogResultSchema,
  type PosthogParams,
  type PosthogParamsInput,
  type PosthogResult,
  type PosthogListProjectsParams,
  type PosthogListEventsParams,
  type PosthogQueryParams,
  type PosthogGetPersonParams,
  type PosthogGetInsightParams,
} from './posthog.schema.js';

/**
 * PosthogBubble - Integration with PostHog product analytics
 *
 * Provides read operations for retrieving analytics data from PostHog:
 * - List events with filtering by event type, person, and date range
 * - Execute HogQL queries for custom analytics
 * - Look up person profiles and properties
 * - Retrieve saved insight results
 *
 * @example
 * ```typescript
 * // List recent pageview events
 * const result = await new PosthogBubble({
 *   operation: 'list_events',
 *   project_id: '12345',
 *   event: '$pageview',
 *   limit: 50,
 * }).action();
 *
 * // Execute a HogQL query
 * const queryResult = await new PosthogBubble({
 *   operation: 'query',
 *   project_id: '12345',
 *   query: 'SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10',
 * }).action();
 *
 * // Look up a person by distinct ID
 * const person = await new PosthogBubble({
 *   operation: 'get_person',
 *   project_id: '12345',
 *   distinct_id: 'user_123',
 * }).action();
 * ```
 */
export class PosthogBubble<
  T extends PosthogParamsInput = PosthogParamsInput,
> extends ServiceBubble<
  T,
  Extract<PosthogResult, { operation: T['operation'] }>
> {
  // REQUIRED: Static metadata for BubbleFactory
  static readonly service = 'posthog';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'posthog' as const;
  static readonly type = 'service' as const;
  static readonly schema = PosthogParamsSchema;
  static readonly resultSchema = PosthogResultSchema;
  static readonly shortDescription =
    'PostHog product analytics for events, persons, and insights';
  static readonly longDescription = `
    PostHog is an open-source product analytics platform.
    This bubble provides read operations for retrieving analytics data:
    - List and filter captured events (pageviews, custom events, etc.)
    - Execute HogQL queries for advanced custom analytics
    - Look up person profiles and their properties
    - Retrieve saved insight results

    Authentication:
    - Uses a Personal API Key via Bearer token
    - Supports US Cloud, EU Cloud, and self-hosted instances via configurable host URL

    Use Cases:
    - Pull analytics data into automated workflows
    - Query event data with HogQL for custom reports
    - Look up user profiles and their properties
    - Retrieve computed insight results for dashboards
  `;
  static readonly alias = 'posthog-analytics';

  constructor(
    params: T = {
      operation: 'list_events',
      project_id: '',
      limit: 100,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Choose the appropriate credential for PostHog API
   */
  protected chooseCredential(): string | undefined {
    const params = this.params as PosthogParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.POSTHOG_API_KEY];
  }

  /**
   * Test if the credential is valid by listing projects
   */
  async testCredential(): Promise<boolean> {
    try {
      const apiKey = this.chooseCredential();
      if (!apiKey) {
        return false;
      }

      const params = this.params as PosthogParams;
      const host =
        (params as PosthogListEventsParams).host || 'https://us.posthog.com';

      // Use the /api/users/@me endpoint to validate the key
      const response = await fetch(`${host}/api/users/@me/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Perform the PostHog operation
   */
  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<PosthogResult, { operation: T['operation'] }>> {
    void context;

    const params = this.params as PosthogParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_projects':
          return (await this.listProjects(
            params as PosthogListProjectsParams
          )) as Extract<PosthogResult, { operation: T['operation'] }>;

        case 'list_events':
          return (await this.listEvents(
            params as PosthogListEventsParams
          )) as Extract<PosthogResult, { operation: T['operation'] }>;

        case 'query':
          return (await this.executeQuery(
            params as PosthogQueryParams
          )) as Extract<PosthogResult, { operation: T['operation'] }>;

        case 'get_person':
          return (await this.getPerson(
            params as PosthogGetPersonParams
          )) as Extract<PosthogResult, { operation: T['operation'] }>;

        case 'get_insight':
          return (await this.getInsight(
            params as PosthogGetInsightParams
          )) as Extract<PosthogResult, { operation: T['operation'] }>;

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
      } as Extract<PosthogResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Make an authenticated GET request to the PostHog API
   */
  private async makePosthogGetRequest(
    host: string,
    path: string,
    queryParams?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error('PostHog Personal API Key is required');
    }

    const url = new URL(`${host}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.detail || errorData.error || errorData.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(
        `PostHog API error (HTTP ${response.status}): ${errorMessage}`
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * Make an authenticated POST request to the PostHog API
   */
  private async makePosthogPostRequest(
    host: string,
    path: string,
    body: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error('PostHog Personal API Key is required');
    }

    const response = await fetch(`${host}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.detail || errorData.error || errorData.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(
        `PostHog API error (HTTP ${response.status}): ${errorMessage}`
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * List all projects accessible with the API key
   */
  private async listProjects(
    params: PosthogListProjectsParams
  ): Promise<Extract<PosthogResult, { operation: 'list_projects' }>> {
    const queryParams: Record<string, string> = {};

    if (params.limit !== undefined) queryParams.limit = String(params.limit);

    const response = await this.makePosthogGetRequest(
      params.host,
      '/api/projects/',
      queryParams
    );

    return {
      operation: 'list_projects',
      success: true,
      projects: response.results as Extract<
        PosthogResult,
        { operation: 'list_projects' }
      >['projects'],
      next: response.next as string | null | undefined,
      error: '',
    };
  }

  /**
   * List events with optional filtering
   */
  private async listEvents(
    params: PosthogListEventsParams
  ): Promise<Extract<PosthogResult, { operation: 'list_events' }>> {
    const queryParams: Record<string, string> = {};

    if (params.event) queryParams.event = params.event;
    if (params.person_id) queryParams.person_id = params.person_id;
    if (params.distinct_id) queryParams.distinct_id = params.distinct_id;
    if (params.after) queryParams.after = params.after;
    if (params.before) queryParams.before = params.before;
    if (params.properties) queryParams.properties = params.properties;
    if (params.limit !== undefined) queryParams.limit = String(params.limit);

    const response = await this.makePosthogGetRequest(
      params.host,
      `/api/projects/${params.project_id}/events/`,
      queryParams
    );

    return {
      operation: 'list_events',
      success: true,
      events: response.results as Extract<
        PosthogResult,
        { operation: 'list_events' }
      >['events'],
      next: response.next as string | null | undefined,
      error: '',
    };
  }

  /**
   * Execute a HogQL query
   */
  private async executeQuery(
    params: PosthogQueryParams
  ): Promise<Extract<PosthogResult, { operation: 'query' }>> {
    const response = await this.makePosthogPostRequest(
      params.host,
      `/api/projects/${params.project_id}/query/`,
      {
        query: {
          kind: 'HogQLQuery',
          query: params.query,
        },
      }
    );

    // The response may have nested results structure
    const results = response.results as Record<string, unknown> | undefined;

    return {
      operation: 'query',
      success: true,
      columns: (results?.columns || response.columns) as string[] | undefined,
      results: (results?.results || response.results) as
        | unknown[][]
        | undefined,
      types: (results?.types || response.types) as string[] | undefined,
      hasMore: (results?.hasMore || response.hasMore) as boolean | undefined,
      error: '',
    };
  }

  /**
   * Get person profiles
   */
  private async getPerson(
    params: PosthogGetPersonParams
  ): Promise<Extract<PosthogResult, { operation: 'get_person' }>> {
    const queryParams: Record<string, string> = {};

    if (params.distinct_id) queryParams.distinct_id = params.distinct_id;
    if (params.search) queryParams.search = params.search;
    if (params.limit !== undefined) queryParams.limit = String(params.limit);

    const response = await this.makePosthogGetRequest(
      params.host,
      `/api/projects/${params.project_id}/persons/`,
      queryParams
    );

    return {
      operation: 'get_person',
      success: true,
      persons: response.results as Extract<
        PosthogResult,
        { operation: 'get_person' }
      >['persons'],
      next: response.next as string | null | undefined,
      error: '',
    };
  }

  /**
   * Get a saved insight's results
   */
  private async getInsight(
    params: PosthogGetInsightParams
  ): Promise<Extract<PosthogResult, { operation: 'get_insight' }>> {
    const response = await this.makePosthogGetRequest(
      params.host,
      `/api/projects/${params.project_id}/insights/${params.insight_id}/`
    );

    return {
      operation: 'get_insight',
      success: true,
      insight: response as Extract<
        PosthogResult,
        { operation: 'get_insight' }
      >['insight'],
      error: '',
    };
  }
}
