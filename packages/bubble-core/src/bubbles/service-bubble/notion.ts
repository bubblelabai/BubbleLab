import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const NotionObjectSchema = z
  .record(z.string(), z.unknown())
  .describe('Raw Notion API object (page or database)');

const NotionSearchParamsSchema = z.object({
  operation: z
    .literal('search')
    .describe('Search for pages or databases in the workspace'),
  query: z
    .string()
    .optional()
    .default('')
    .describe('Search query string. Leave empty to list recently edited items'),
  filter: z
    .object({
      value: z
        .enum(['page', 'database'])
        .describe('Restrict results to pages or databases'),
      property: z
        .literal('object')
        .describe('Filter target property (fixed to object)'),
    })
    .optional()
    .describe('Optional filter to restrict search results by object type'),
  sort: z
    .object({
      timestamp: z
        .enum(['last_edited_time'])
        .default('last_edited_time')
        .describe('Timestamp to sort by'),
      direction: z
        .enum(['ascending', 'descending'])
        .default('descending')
        .describe('Sort direction'),
    })
    .optional()
    .describe('Optional sorting for search results'),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results to return (1-100)'),
  start_cursor: z
    .string()
    .optional()
    .describe('Cursor to continue a previous search'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

const NotionRetrievePageParamsSchema = z.object({
  operation: z
    .literal('retrieve_page')
    .describe('Retrieve a single Notion page by ID'),
  pageId: z
    .string()
    .min(1, 'Page ID is required')
    .describe('Notion page ID (UUID) or the ID portion of the page URL'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

export const NotionParamsSchema = z.discriminatedUnion('operation', [
  NotionSearchParamsSchema,
  NotionRetrievePageParamsSchema,
]);

export const NotionResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('search'),
    results: z
      .array(NotionObjectSchema)
      .describe('Search results as raw Notion objects'),
    has_more: z
      .boolean()
      .optional()
      .describe('Whether additional results are available'),
    next_cursor: z
      .string()
      .nullable()
      .optional()
      .describe('Cursor to fetch the next page of results'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('retrieve_page'),
    page: NotionObjectSchema.optional().describe('Retrieved page object'),
    success: z.boolean().describe('Whether the operation succeeded'),
    error: z.string().describe('Error message if the operation failed'),
  }),
]);

export type NotionParamsInput = z.input<typeof NotionParamsSchema>;
type NotionParams = z.input<typeof NotionParamsSchema>;
type NotionParamsParsed = z.output<typeof NotionParamsSchema>;
type NotionResult = z.output<typeof NotionResultSchema>;

export class NotionBubble extends ServiceBubble<NotionParams, NotionResult> {
  static readonly service = 'notion';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'notion' as const;
  static readonly type = 'service' as const;
  static readonly schema = NotionParamsSchema;
  static readonly resultSchema = NotionResultSchema;
  static readonly shortDescription =
    'Connect to Notion to search and read pages';
  static readonly longDescription = `Perform basic Notion operations using OAuth:
- Search across pages and databases
- Retrieve individual pages
- Uses OAuth access tokens with automatic refresh handled by the platform`;
  static readonly alias = 'notion';
  static readonly credentialOptions = [CredentialType.NOTION_OAUTH_TOKEN];

  constructor(params: NotionParams, context?: BubbleContext) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    return this.params.credentials?.[CredentialType.NOTION_OAUTH_TOKEN];
  }

  async testCredential(): Promise<boolean> {
    try {
      const token = this.chooseCredential();
      if (!token) {
        throw new Error('Notion OAuth token is required');
      }
      const meResponse = await this.fetchNotion(
        '/users/me',
        'GET',
        undefined,
        token
      );
      return meResponse.ok === true;
    } catch (error) {
      void error;
      return false;
    }
  }

  protected async performAction(): Promise<NotionResult> {
    const parsed = NotionParamsSchema.parse(this.params);
    const token = this.chooseCredential();

    if (!token) {
      const commonError =
        'Missing Notion OAuth credential. Please connect a Notion credential first.';
      if (parsed.operation === 'search') {
        return {
          operation: 'search',
          results: [],
          has_more: false,
          next_cursor: null,
          success: false,
          error: commonError,
        };
      }
      return {
        operation: 'retrieve_page',
        page: undefined,
        success: false,
        error: commonError,
      };
    }

    if (parsed.operation === 'search') {
      return this.search(parsed, token);
    }

    return this.retrievePage(parsed, token);
  }

  private async search(
    params: Extract<NotionParamsParsed, { operation: 'search' }>,
    token: string
  ): Promise<NotionResult> {
    try {
      const body = {
        ...(params.query ? { query: params.query } : { query: '' }),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        ...(params.page_size ? { page_size: params.page_size } : {}),
        ...(params.start_cursor ? { start_cursor: params.start_cursor } : {}),
      };

      const response = await this.fetchNotion('/search', 'POST', body, token);
      if (!response.ok) {
        return {
          operation: 'search',
          results: [],
          has_more: false,
          next_cursor: null,
          success: false,
          error: response.error ?? 'Notion search failed',
        };
      }

      const payload = response.data as {
        results: unknown[];
        has_more?: boolean;
        next_cursor?: string | null;
      };

      return {
        operation: 'search',
        results: z.array(NotionObjectSchema).parse(payload.results ?? []),
        has_more: payload.has_more,
        next_cursor: payload.next_cursor,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'search',
        results: [],
        has_more: false,
        next_cursor: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async retrievePage(
    params: Extract<NotionParamsParsed, { operation: 'retrieve_page' }>,
    token: string
  ): Promise<NotionResult> {
    try {
      const response = await this.fetchNotion(
        `/pages/${params.pageId}`,
        'GET',
        undefined,
        token
      );

      if (!response.ok) {
        return {
          operation: 'retrieve_page',
          page: undefined,
          success: false,
          error: response.error ?? 'Failed to retrieve Notion page',
        };
      }

      return {
        operation: 'retrieve_page',
        page: NotionObjectSchema.parse(response.data),
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'retrieve_page',
        page: undefined,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchNotion(
    path: string,
    method: 'GET' | 'POST',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: Record<string, any> | undefined,
    token: string
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const url = `${NOTION_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' && body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // If parsing fails, keep raw text
      data = text;
    }

    if (!response.ok) {
      const detail =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message?: string }).message)
          : text || 'Request failed';
      return { ok: false, data, error: detail };
    }

    return { ok: true, data };
  }
}
