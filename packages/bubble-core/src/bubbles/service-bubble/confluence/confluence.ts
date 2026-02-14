import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  ConfluenceParamsSchema,
  ConfluenceResultSchema,
  type ConfluenceParams,
  type ConfluenceParamsInput,
  type ConfluenceResult,
  type ConfluenceListSpacesParams,
  type ConfluenceGetSpaceParams,
  type ConfluenceListPagesParams,
  type ConfluenceGetPageParams,
  type ConfluenceCreatePageParams,
  type ConfluenceUpdatePageParams,
  type ConfluenceDeletePageParams,
  type ConfluenceSearchParams,
  type ConfluenceAddCommentParams,
  type ConfluenceGetCommentsParams,
} from './confluence.schema.js';
import {
  markdownToConfluenceStorage,
  storageToText,
  enhanceErrorMessage,
} from './confluence.utils.js';

/**
 * Confluence Service Bubble
 *
 * Integration with Confluence Cloud for wiki and content management.
 *
 * Operations:
 * - list_spaces: List spaces with optional filtering
 * - get_space: Get space details by ID
 * - list_pages: List pages with filtering (by space, title, status)
 * - get_page: Get page by ID with body content
 * - create_page: Create a new page in a space
 * - update_page: Update page (auto-fetches current version)
 * - delete_page: Delete/trash a page
 * - search: Search via CQL (v1 endpoint)
 * - add_comment: Add footer comment to a page
 * - get_comments: List footer comments for a page
 *
 * Features:
 * - Markdown content auto-converted to Confluence storage format (XHTML)
 * - Auto-version management for page updates
 * - Uses REST API v2 for most operations, v1 for search/labels
 */
export class ConfluenceBubble<
  T extends ConfluenceParamsInput = ConfluenceParamsInput,
> extends ServiceBubble<
  T,
  Extract<ConfluenceResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'confluence';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'confluence';
  static readonly schema = ConfluenceParamsSchema;
  static readonly resultSchema = ConfluenceResultSchema;
  static readonly shortDescription =
    'Confluence integration for wiki pages and content management';
  static readonly longDescription = `
    Confluence Cloud integration for managing wiki content, spaces, and pages.

    Operations:
    - list_spaces: List Confluence spaces with filtering
    - get_space: Get space details by ID
    - list_pages: List pages (filter by space, title, status)
    - get_page: Get page by ID with body content
    - create_page: Create a new page in a space
    - update_page: Update page content (auto-increments version)
    - delete_page: Delete/trash a page
    - search: Search via CQL (Confluence Query Language)
    - add_comment: Add footer comment to a page
    - get_comments: List footer comments for a page

    Features:
    - Markdown content auto-converted to Confluence storage format (XHTML)
    - Auto-version management for page updates
    - CQL search support for powerful content discovery

    Authentication:
    - OAuth 2.0 via Atlassian Cloud (same provider as Jira)
  `;
  static readonly alias = 'confluence';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const apiToken = this.chooseCredential();
    if (!apiToken) {
      throw new Error('Confluence credentials are required');
    }

    try {
      const response = await this.makeConfluenceApiRequest(
        '/wiki/api/v2/spaces?limit=1',
        'GET'
      );
      return Boolean(response && 'results' in response);
    } catch {
      return false;
    }
  }

  /**
   * Parse Confluence credentials: base64-encoded JSON { accessToken, cloudId, siteUrl }
   * Same format as Jira since both use Atlassian Cloud OAuth.
   */
  private parseCredentials(): {
    accessToken: string;
    baseUrl: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const confluenceCredRaw = credentials[CredentialType.CONFLUENCE_CRED];
    if (!confluenceCredRaw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        cloudId?: string;
        siteUrl?: string;
      }>(confluenceCredRaw);

      if (parsed.accessToken && parsed.cloudId) {
        return {
          accessToken: parsed.accessToken,
          baseUrl: `https://api.atlassian.com/ex/confluence/${parsed.cloudId}`,
        };
      }
    } catch {
      // Invalid credential format
    }

    return null;
  }

  /**
   * Resolve a space_key to a space_id via the Confluence API.
   */
  private async resolveSpaceKey(spaceKey: string): Promise<string> {
    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`,
      'GET'
    );
    const results = Array.isArray(response.results) ? response.results : [];
    if (results.length === 0) {
      throw new Error(`Space not found for key: ${spaceKey}`);
    }
    return (results[0] as { id: string }).id;
  }

  /**
   * Get the space_id from params, resolving space_key if needed.
   */
  private async getSpaceId(params: {
    space_id?: string;
    space_key?: string;
  }): Promise<string | undefined> {
    if (params.space_id) return params.space_id;
    if (params.space_key) return this.resolveSpaceKey(params.space_key);
    return undefined;
  }

  /**
   * Make a request to the Confluence REST API v2.
   */
  private async makeConfluenceApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<Record<string, unknown>> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid Confluence credentials. Expected base64-encoded JSON with { accessToken, cloudId }.'
      );
    }

    const url = `${creds.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      const enhancedError = enhanceErrorMessage(
        errorText,
        response.status,
        response.statusText
      );
      throw new Error(enhancedError);
    }

    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }

    return {};
  }

  /**
   * Make a request to the Confluence REST API v1 (used for search and labels).
   */
  private async makeConfluenceV1ApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown
  ): Promise<Record<string, unknown>> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid Confluence credentials. Expected base64-encoded JSON with { accessToken, cloudId }.'
      );
    }

    const url = `${creds.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      const enhancedError = enhanceErrorMessage(
        errorText,
        response.status,
        response.statusText
      );
      throw new Error(enhancedError);
    }

    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }

    return {};
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<ConfluenceResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<ConfluenceResult> => {
        const parsedParams = this.params as ConfluenceParams;

        switch (operation) {
          case 'list_spaces':
            return await this.listSpaces(
              parsedParams as ConfluenceListSpacesParams
            );
          case 'get_space':
            return await this.getSpace(
              parsedParams as ConfluenceGetSpaceParams
            );
          case 'list_pages':
            return await this.listPages(
              parsedParams as ConfluenceListPagesParams
            );
          case 'get_page':
            return await this.getPage(parsedParams as ConfluenceGetPageParams);
          case 'create_page':
            return await this.createPage(
              parsedParams as ConfluenceCreatePageParams
            );
          case 'update_page':
            return await this.updatePage(
              parsedParams as ConfluenceUpdatePageParams
            );
          case 'delete_page':
            return await this.deletePage(
              parsedParams as ConfluenceDeletePageParams
            );
          case 'search':
            return await this.search(parsedParams as ConfluenceSearchParams);
          case 'add_comment':
            return await this.addComment(
              parsedParams as ConfluenceAddCommentParams
            );
          case 'get_comments':
            return await this.getComments(
              parsedParams as ConfluenceGetCommentsParams
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<ConfluenceResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<ConfluenceResult, { operation: T['operation'] }>;
    }
  }

  // -------------------------------------------------------------------------
  // OPERATION 1: list_spaces
  // -------------------------------------------------------------------------
  private async listSpaces(
    params: ConfluenceListSpacesParams
  ): Promise<Extract<ConfluenceResult, { operation: 'list_spaces' }>> {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', String(params.limit ?? 25));

    if (params.cursor) {
      queryParams.set('cursor', params.cursor);
    }
    if (params.type) {
      queryParams.set('type', params.type);
    }
    if (params.status) {
      queryParams.set('status', params.status);
    }

    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/spaces?${queryParams.toString()}`,
      'GET'
    );

    const results = Array.isArray(response.results) ? response.results : [];
    const links = response._links as { next?: string } | undefined;
    const nextCursor = links?.next
      ? (new URL(links.next, 'https://placeholder.com').searchParams.get(
          'cursor'
        ) ?? undefined)
      : undefined;

    return {
      operation: 'list_spaces',
      success: true,
      spaces: results as ConfluenceResult extends { spaces?: infer S }
        ? S
        : never,
      cursor: nextCursor,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 2: get_space
  // -------------------------------------------------------------------------
  private async getSpace(
    params: ConfluenceGetSpaceParams
  ): Promise<Extract<ConfluenceResult, { operation: 'get_space' }>> {
    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/spaces/${encodeURIComponent(params.space_id)}?description-format=plain`,
      'GET'
    );

    return {
      operation: 'get_space',
      success: true,
      space: response as ConfluenceResult extends { space?: infer S }
        ? S
        : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 3: list_pages
  // -------------------------------------------------------------------------
  private async listPages(
    params: ConfluenceListPagesParams
  ): Promise<Extract<ConfluenceResult, { operation: 'list_pages' }>> {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', String(params.limit ?? 25));

    const spaceId = await this.getSpaceId(params);
    if (spaceId) {
      queryParams.set('space-id', spaceId);
    }
    if (params.title) {
      queryParams.set('title', params.title);
    }
    if (params.status) {
      queryParams.set('status', params.status);
    }
    if (params.cursor) {
      queryParams.set('cursor', params.cursor);
    }

    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/pages?${queryParams.toString()}`,
      'GET'
    );

    const results = Array.isArray(response.results) ? response.results : [];
    const links = response._links as { next?: string } | undefined;
    const nextCursor = links?.next
      ? (new URL(links.next, 'https://placeholder.com').searchParams.get(
          'cursor'
        ) ?? undefined)
      : undefined;

    return {
      operation: 'list_pages',
      success: true,
      pages: results as ConfluenceResult extends { pages?: infer P }
        ? P
        : never,
      cursor: nextCursor,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 4: get_page
  // -------------------------------------------------------------------------
  private async getPage(
    params: ConfluenceGetPageParams
  ): Promise<Extract<ConfluenceResult, { operation: 'get_page' }>> {
    const queryParams = new URLSearchParams();
    if (params.include_body !== false) {
      queryParams.set('body-format', 'storage');
    }

    const queryString = queryParams.toString();
    const endpoint = `/wiki/api/v2/pages/${encodeURIComponent(params.page_id)}${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeConfluenceApiRequest(endpoint, 'GET');

    // Convert storage body to plain text for easier consumption
    if (
      response.body &&
      typeof response.body === 'object' &&
      'storage' in (response.body as Record<string, unknown>)
    ) {
      const body = response.body as {
        storage?: { value?: string; representation?: string };
      };
      if (body.storage?.value) {
        // Keep original storage format and add a plain text version
        (response as Record<string, unknown>).bodyText = storageToText(
          body.storage.value
        );
      }
    }

    return {
      operation: 'get_page',
      success: true,
      page: response as ConfluenceResult extends { page?: infer P } ? P : never,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 5: create_page
  // -------------------------------------------------------------------------
  private async createPage(
    params: ConfluenceCreatePageParams
  ): Promise<Extract<ConfluenceResult, { operation: 'create_page' }>> {
    const spaceId = await this.getSpaceId(params);
    if (!spaceId) {
      throw new Error('Either space_id or space_key is required');
    }

    const requestBody: Record<string, unknown> = {
      spaceId,
      status: params.status ?? 'current',
      title: params.title,
    };

    if (params.body) {
      requestBody.body = {
        representation: 'storage',
        value: markdownToConfluenceStorage(params.body),
      };
    }

    if (params.parent_id) {
      requestBody.parentId = params.parent_id;
    }

    const response = await this.makeConfluenceApiRequest(
      '/wiki/api/v2/pages',
      'POST',
      requestBody
    );

    return {
      operation: 'create_page',
      success: true,
      page: {
        id: response.id as string,
        title: response.title as string,
        status: response.status as string | undefined,
        _links: response._links as { webui?: string } | undefined,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 6: update_page
  // -------------------------------------------------------------------------
  private async updatePage(
    params: ConfluenceUpdatePageParams
  ): Promise<Extract<ConfluenceResult, { operation: 'update_page' }>> {
    // Fetch current page to get version number, title, and body (for preservation)
    const currentPage = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/pages/${encodeURIComponent(params.page_id)}?body-format=storage`,
      'GET'
    );

    const currentVersion = currentPage.version as
      | { number: number }
      | undefined;
    if (!currentVersion) {
      throw new Error('Could not determine current page version');
    }

    const requestBody: Record<string, unknown> = {
      id: params.page_id,
      status: params.status ?? 'current',
      title: params.title ?? (currentPage.title as string),
      version: {
        number: currentVersion.number + 1,
        message: params.version_message,
      },
    };

    if (params.body !== undefined) {
      // User provided new body — convert markdown to storage format
      requestBody.body = {
        representation: 'storage',
        value: markdownToConfluenceStorage(params.body),
      };
    } else {
      // Preserve existing body when only updating title/status
      const currentBody = currentPage.body as
        | { storage?: { value?: string } }
        | undefined;
      if (currentBody?.storage?.value) {
        requestBody.body = {
          representation: 'storage',
          value: currentBody.storage.value,
        };
      }
    }

    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/pages/${encodeURIComponent(params.page_id)}`,
      'PUT',
      requestBody
    );

    return {
      operation: 'update_page',
      success: true,
      page: {
        id: response.id as string,
        title: response.title as string,
        version: response.version as { number: number } | undefined,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 7: delete_page
  // -------------------------------------------------------------------------
  private async deletePage(
    params: ConfluenceDeletePageParams
  ): Promise<Extract<ConfluenceResult, { operation: 'delete_page' }>> {
    await this.makeConfluenceApiRequest(
      `/wiki/api/v2/pages/${encodeURIComponent(params.page_id)}`,
      'DELETE'
    );

    return {
      operation: 'delete_page',
      success: true,
      page_id: params.page_id,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 8: search (uses v1 CQL endpoint)
  // -------------------------------------------------------------------------
  private async search(
    params: ConfluenceSearchParams
  ): Promise<Extract<ConfluenceResult, { operation: 'search' }>> {
    const queryParams = new URLSearchParams({
      cql: params.cql,
      limit: String(params.limit ?? 25),
      start: String(params.start ?? 0),
    });

    const response = await this.makeConfluenceV1ApiRequest(
      `/wiki/rest/api/search?${queryParams.toString()}`,
      'GET'
    );

    const rawResults = Array.isArray(response.results) ? response.results : [];

    // Normalize search results: promote content fields to top level
    // so results have the same shape as page objects (id, title, status, _links)
    interface RawSearchResult {
      content?: {
        id?: string;
        type?: string;
        title?: string;
        status?: string;
        _links?: { webui?: string };
      };
      title?: string;
      excerpt?: string;
      url?: string;
      lastModified?: string;
    }
    const results = rawResults.map((r: RawSearchResult) => ({
      id: r.content?.id,
      type: r.content?.type,
      title: r.content?.title ?? r.title,
      status: r.content?.status,
      excerpt: r.excerpt,
      url: r.url,
      lastModified: r.lastModified,
      _links: r.content?._links,
      content: r.content,
    }));

    return {
      operation: 'search',
      success: true,
      results: results as ConfluenceResult extends { results?: infer R }
        ? R
        : never,
      total: (response.totalSize ?? response.size) as number | undefined,
      start: response.start as number | undefined,
      limit: response.limit as number | undefined,
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 9: add_comment
  // -------------------------------------------------------------------------
  private async addComment(
    params: ConfluenceAddCommentParams
  ): Promise<Extract<ConfluenceResult, { operation: 'add_comment' }>> {
    const requestBody = {
      pageId: params.page_id,
      body: {
        representation: 'storage',
        value: markdownToConfluenceStorage(params.body),
      },
    };

    const response = await this.makeConfluenceApiRequest(
      '/wiki/api/v2/footer-comments',
      'POST',
      requestBody
    );

    return {
      operation: 'add_comment',
      success: true,
      comment: {
        id: response.id as string,
        body: {
          storage: {
            value: params.body, // Return original text for readability
            representation: 'storage',
          },
        },
        createdAt: (response.version as { createdAt?: string })?.createdAt,
      },
      error: '',
    };
  }

  // -------------------------------------------------------------------------
  // OPERATION 10: get_comments
  // -------------------------------------------------------------------------
  private async getComments(
    params: ConfluenceGetCommentsParams
  ): Promise<Extract<ConfluenceResult, { operation: 'get_comments' }>> {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', String(params.limit ?? 25));
    queryParams.set('body-format', 'storage');

    if (params.cursor) {
      queryParams.set('cursor', params.cursor);
    }

    const response = await this.makeConfluenceApiRequest(
      `/wiki/api/v2/pages/${encodeURIComponent(params.page_id)}/footer-comments?${queryParams.toString()}`,
      'GET'
    );

    const results = Array.isArray(response.results) ? response.results : [];
    const links = response._links as { next?: string } | undefined;
    const nextCursor = links?.next
      ? (new URL(links.next, 'https://placeholder.com').searchParams.get(
          'cursor'
        ) ?? undefined)
      : undefined;

    // Convert storage format to plain text for each comment
    const comments = results.map((comment: Record<string, unknown>) => {
      const body = comment.body as { storage?: { value?: string } } | undefined;
      if (body?.storage?.value) {
        (comment as Record<string, unknown>).bodyText = storageToText(
          body.storage.value
        );
      }
      return comment;
    });

    return {
      operation: 'get_comments',
      success: true,
      comments: comments as ConfluenceResult extends { comments?: infer C }
        ? C
        : never,
      cursor: nextCursor,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.CONFLUENCE_CRED];
  }
}
