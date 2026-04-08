import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  MetabaseParamsSchema,
  MetabaseResultSchema,
  type MetabaseParams,
  type MetabaseParamsInput,
  type MetabaseResult,
} from './metabase.schema.js';
import {
  parseMetabaseCredential,
  enhanceMetabaseErrorMessage,
  type MetabaseCredentials,
} from './metabase.utils.js';

/**
 * Metabase Service Bubble
 *
 * Integration with Metabase analytics and reporting platform.
 *
 * Features:
 * - Dashboard retrieval and listing
 * - Card (saved question) metadata
 * - Card query execution with parsed JSON results
 *
 * Supports self-hosted Metabase instances via configurable URL + API key.
 */
export class MetabaseBubble<
  T extends MetabaseParamsInput = MetabaseParamsInput,
> extends ServiceBubble<
  T,
  Extract<MetabaseResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'metabase';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'metabase';
  static readonly schema = MetabaseParamsSchema;
  static readonly resultSchema = MetabaseResultSchema;
  static readonly shortDescription =
    'Metabase integration for dashboards, cards, and analytics queries';
  static readonly longDescription = `
    Metabase service integration for business intelligence and analytics.

    Features:
    - Get dashboard metadata and dashcard list
    - List all available dashboards
    - Get card (saved question) metadata
    - Execute card queries and retrieve parsed JSON results

    Supports self-hosted Metabase instances with API key authentication.
  `;
  static readonly alias = 'analytics';

  constructor(
    params: T = {
      operation: 'list_dashboards',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    // Test by listing dashboards (minimal API call)
    const creds = this.getCredentials();
    if (!creds) return false;

    const response = await this.makeMetabaseRequest(
      creds,
      '/api/dashboard/',
      'GET'
    );
    if (!Array.isArray(response)) {
      throw new Error('Metabase API returned an invalid response');
    }
    return true;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    if (!credentials || typeof credentials !== 'object') return undefined;
    return credentials[CredentialType.METABASE_CRED];
  }

  private getCredentials(): MetabaseCredentials | undefined {
    const rawCredential = this.chooseCredential();
    if (!rawCredential) return undefined;
    return parseMetabaseCredential(rawCredential);
  }

  protected async performAction(
    _context?: BubbleContext
  ): Promise<Extract<MetabaseResult, { operation: T['operation'] }>> {
    const { operation } = this.params;

    try {
      const result = await (async (): Promise<MetabaseResult> => {
        const p = this.params as MetabaseParams;

        switch (p.operation) {
          case 'get_dashboard':
            return await this.getDashboard(p.dashboard_id);
          case 'list_dashboards':
            return await this.listDashboards();
          case 'get_card':
            return await this.getCard(p.card_id);
          case 'query_card':
            return await this.queryCard(p.card_id, p.parameters, p.pivot);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<MetabaseResult, { operation: T['operation'] }>;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        operation,
        success: false,
        error: errorMessage,
      } as Extract<MetabaseResult, { operation: T['operation'] }>;
    }
  }

  private async getDashboard(
    dashboardId: number
  ): Promise<Extract<MetabaseResult, { operation: 'get_dashboard' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'get_dashboard',
        success: false,
        error: 'Metabase credentials are required',
      };
    }

    const data = await this.makeMetabaseRequest(
      creds,
      `/api/dashboard/${dashboardId}`,
      'GET'
    );

    return {
      operation: 'get_dashboard',
      success: true,
      error: '',
      data: data as any,
    };
  }

  private async listDashboards(): Promise<
    Extract<MetabaseResult, { operation: 'list_dashboards' }>
  > {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'list_dashboards',
        success: false,
        error: 'Metabase credentials are required',
      };
    }

    const data = await this.makeMetabaseRequest(
      creds,
      '/api/dashboard/',
      'GET'
    );

    const dashboards = Array.isArray(data) ? data : [];

    return {
      operation: 'list_dashboards',
      success: true,
      error: '',
      data: {
        dashboards: dashboards as any[],
        total: dashboards.length,
      },
    };
  }

  private async getCard(
    cardId: number
  ): Promise<Extract<MetabaseResult, { operation: 'get_card' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'get_card',
        success: false,
        error: 'Metabase credentials are required',
      };
    }

    const data = await this.makeMetabaseRequest(
      creds,
      `/api/card/${cardId}`,
      'GET'
    );

    return {
      operation: 'get_card',
      success: true,
      error: '',
      data: data as any,
    };
  }

  private async queryCard(
    cardId: number,
    parameters?: Record<string, unknown>,
    pivot?: boolean
  ): Promise<Extract<MetabaseResult, { operation: 'query_card' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'query_card',
        success: false,
        error: 'Metabase credentials are required',
      };
    }

    const body = parameters ? { parameters } : undefined;
    const endpoint = pivot
      ? `/api/card/pivot/${cardId}/query`
      : `/api/card/${cardId}/query`;
    const raw = (await this.makeMetabaseRequest(
      creds,
      endpoint,
      'POST',
      body
    )) as Record<string, any>;

    // Flatten: extract rows/cols from Metabase's nested data.data structure
    const inner = raw.data ?? {};
    return {
      operation: 'query_card',
      success: true,
      error: '',
      data: {
        rows: inner.rows ?? [],
        cols: inner.cols ?? [],
        row_count: raw.row_count,
        status: raw.status,
      },
    };
  }

  private async makeMetabaseRequest(
    creds: MetabaseCredentials,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${creds.url}${endpoint}`;
    const headers: Record<string, string> = {
      'x-api-key': creds.apiKey,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorBody = '';
      try {
        const raw = await response.text();
        // Try JSON first — Metabase often returns { message: "..." }
        try {
          const json = JSON.parse(raw);
          errorBody = json.message || json.error || JSON.stringify(json);
        } catch {
          // Strip HTML: remove script/style blocks entirely, then remaining tags
          errorBody = raw.includes('<')
            ? raw
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            : raw;
        }
      } catch {
        // ignore parse error
      }
      const message = `Metabase API error (${response.status}): ${errorBody || response.statusText}`;
      throw new Error(enhanceMetabaseErrorMessage(message, response.status));
    }

    return await response.json();
  }
}
