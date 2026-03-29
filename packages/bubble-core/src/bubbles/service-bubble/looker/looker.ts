import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  LookerParamsSchema,
  LookerResultSchema,
  type LookerParams,
  type LookerParamsInput,
  type LookerResult,
} from './looker.schema.js';

const LOOKER_API_VERSION = '4.0';

/**
 * Looker Analytics Service Bubble
 *
 * Looker integration for querying LookML models, pulling saved Looks and
 * dashboard data via the Looker REST API v4.0. Uses Google OAuth for
 * authentication since Looker is a Google Cloud product.
 */
export class LookerBubble<
  T extends LookerParamsInput = LookerParamsInput,
> extends ServiceBubble<
  T,
  Extract<LookerResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'looker';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'looker';
  static readonly schema = LookerParamsSchema;
  static readonly resultSchema = LookerResultSchema;
  static readonly shortDescription =
    'Looker analytics integration for LookML queries, Looks, and dashboards';
  static readonly longDescription = `
    Looker analytics integration for querying data models and pulling dashboard content.

    Features:
    - Run inline queries against LookML models/explores with fields, filters, and sorts
    - Retrieve results from saved Looks by ID
    - Fetch dashboard metadata, filters, and tile definitions
    - Discover available LookML models and their explores
    - List saved Looks and dashboards

    Security Features:
    - Google OAuth 2.0 authentication (Looker is a Google Cloud product)
    - Instance-scoped access via per-client Looker URLs
    - Secure credential handling with base64-encoded payloads
  `;
  static readonly alias = '';

  constructor(
    params: T = {
      operation: 'list_models',
      instance_url: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Looker credentials are required');
    }

    const baseUrl = this.getBaseUrl();
    const response = await fetch(`${baseUrl}/api/${LOOKER_API_VERSION}/user`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Looker API error (${response.status}): ${text}`);
    }
    return true;
  }

  private parseCredentials(): {
    accessToken: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const raw = credentials[CredentialType.LOOKER_CRED];
    if (!raw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
      }>(raw);

      if (parsed.accessToken) {
        return { accessToken: parsed.accessToken };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token (validator path)
    }

    return { accessToken: raw };
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }

  private getBaseUrl(): string {
    const p = this.params as { instance_url?: string };
    let url = p.instance_url || '';

    // Strip trailing slashes and /api paths
    url = url.replace(/\/+$/, '').replace(/\/api\/.*$/, '');

    // Ensure https:// prefix
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    return url;
  }

  private async lookerRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Looker credentials are required');
    }

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/${LOOKER_API_VERSION}${endpoint}`;

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Looker API error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) {
      return undefined;
    }

    return await response.json();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<LookerResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<LookerResult> => {
        const p = this.params as LookerParams;
        switch (operation) {
          case 'run_inline_query':
            return await this.runInlineQuery(
              p as Extract<LookerParams, { operation: 'run_inline_query' }>
            );
          case 'get_look':
            return await this.getLook(
              p as Extract<LookerParams, { operation: 'get_look' }>
            );
          case 'get_dashboard':
            return await this.getDashboard(
              p as Extract<LookerParams, { operation: 'get_dashboard' }>
            );
          case 'list_models':
            return await this.listModels();
          case 'list_explores':
            return await this.listExplores(
              p as Extract<LookerParams, { operation: 'list_explores' }>
            );
          case 'list_looks':
            return await this.listLooks(
              p as Extract<LookerParams, { operation: 'list_looks' }>
            );
          case 'list_dashboards':
            return await this.listDashboards(
              p as Extract<LookerParams, { operation: 'list_dashboards' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<LookerResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<LookerResult, { operation: T['operation'] }>;
    }
  }

  // --- Operation Implementations ---

  private async runInlineQuery(
    params: Extract<LookerParams, { operation: 'run_inline_query' }>
  ): Promise<Extract<LookerResult, { operation: 'run_inline_query' }>> {
    const { model, explore, fields, filters, sorts, limit } = params;

    const queryBody: Record<string, unknown> = {
      model,
      view: explore,
      fields,
      limit: String(limit),
    };

    if (filters && Object.keys(filters).length > 0) {
      queryBody.filters = filters;
    }

    if (sorts && sorts.length > 0) {
      queryBody.sorts = sorts;
    }

    const data = (await this.lookerRequest(
      '/queries/run/json',
      'POST',
      queryBody
    )) as Record<string, unknown>[];

    return {
      operation: 'run_inline_query',
      success: true,
      data,
      rowCount: data.length,
      error: '',
    };
  }

  private async getLook(
    params: Extract<LookerParams, { operation: 'get_look' }>
  ): Promise<Extract<LookerResult, { operation: 'get_look' }>> {
    const { look_id, limit, result_format } = params;

    // Get the Look metadata
    const lookMeta = (await this.lookerRequest(`/looks/${look_id}`)) as Record<
      string,
      unknown
    >;

    // Run the Look to get results
    const data = (await this.lookerRequest(
      `/looks/${look_id}/run/${result_format}?limit=${limit}`
    )) as Record<string, unknown>[];

    return {
      operation: 'get_look',
      success: true,
      data,
      look: {
        id: look_id,
        title: lookMeta.title as string | undefined,
        description: lookMeta.description as string | undefined,
        model: lookMeta.model as { id?: string; label?: string } | undefined,
        space: lookMeta.space as { id?: string; name?: string } | undefined,
      },
      rowCount: data.length,
      error: '',
    };
  }

  private async getDashboard(
    params: Extract<LookerParams, { operation: 'get_dashboard' }>
  ): Promise<Extract<LookerResult, { operation: 'get_dashboard' }>> {
    const { dashboard_id } = params;

    const dashboard = (await this.lookerRequest(
      `/dashboards/${dashboard_id}`
    )) as Record<string, unknown>;

    return {
      operation: 'get_dashboard',
      success: true,
      dashboard: {
        id: String(dashboard.id),
        title: dashboard.title as string | undefined,
        description: dashboard.description as string | undefined,
        dashboard_filters: dashboard.dashboard_filters as
          | Array<{
              name?: string;
              title?: string;
              type?: string;
              default_value?: string;
            }>
          | undefined,
        dashboard_elements: dashboard.dashboard_elements as
          | Array<{
              id?: string;
              title?: string;
              type?: string;
              look_id?: number;
              query?: Record<string, unknown>;
            }>
          | undefined,
      },
      error: '',
    };
  }

  private async listModels(): Promise<
    Extract<LookerResult, { operation: 'list_models' }>
  > {
    const models = (await this.lookerRequest('/lookml_models')) as Array<
      Record<string, unknown>
    >;

    return {
      operation: 'list_models',
      success: true,
      models: models.map((m) => ({
        name: m.name as string,
        label: m.label as string | undefined,
        explores: (
          m.explores as
            | Array<{
                name: string;
                label?: string;
                description?: string;
              }>
            | undefined
        )?.map((e) => ({
          name: e.name,
          label: e.label,
          description: e.description,
        })),
      })),
      error: '',
    };
  }

  private async listExplores(
    params: Extract<LookerParams, { operation: 'list_explores' }>
  ): Promise<Extract<LookerResult, { operation: 'list_explores' }>> {
    const { model } = params;

    const modelData = (await this.lookerRequest(
      `/lookml_models/${model}`
    )) as Record<string, unknown>;

    const explores =
      (modelData.explores as Array<Record<string, unknown>>) || [];

    // Fetch detailed field info for each explore
    const detailedExplores = await Promise.all(
      explores.map(async (e) => {
        const exploreName = e.name as string;
        try {
          const detail = (await this.lookerRequest(
            `/lookml_models/${model}/explores/${exploreName}`
          )) as Record<string, unknown>;

          const fields = detail.fields as
            | Record<string, Array<Record<string, unknown>>>
            | undefined;

          return {
            name: exploreName,
            label: (detail.label || e.label) as string | undefined,
            description: (detail.description || e.description) as
              | string
              | undefined,
            fields: fields
              ? {
                  dimensions: fields.dimensions?.map((d) => ({
                    name: d.name as string,
                    label: d.label as string | undefined,
                    type: d.type as string | undefined,
                    description: d.description as string | undefined,
                  })),
                  measures: fields.measures?.map((m) => ({
                    name: m.name as string,
                    label: m.label as string | undefined,
                    type: m.type as string | undefined,
                    description: m.description as string | undefined,
                  })),
                }
              : undefined,
          };
        } catch {
          // If detail fetch fails, return basic info
          return {
            name: exploreName,
            label: e.label as string | undefined,
            description: e.description as string | undefined,
          };
        }
      })
    );

    return {
      operation: 'list_explores',
      success: true,
      explores: detailedExplores,
      model,
      error: '',
    };
  }

  private async listLooks(
    params: Extract<LookerParams, { operation: 'list_looks' }>
  ): Promise<Extract<LookerResult, { operation: 'list_looks' }>> {
    const { limit } = params;

    const looks = (await this.lookerRequest(`/looks?limit=${limit}`)) as Array<
      Record<string, unknown>
    >;

    return {
      operation: 'list_looks',
      success: true,
      looks: looks.map((l) => ({
        id: l.id as number,
        title: l.title as string | undefined,
        description: l.description as string | undefined,
        model: l.model as { id?: string; label?: string } | undefined,
        space: l.space as { id?: string; name?: string } | undefined,
      })),
      totalCount: looks.length,
      error: '',
    };
  }

  private async listDashboards(
    params: Extract<LookerParams, { operation: 'list_dashboards' }>
  ): Promise<Extract<LookerResult, { operation: 'list_dashboards' }>> {
    const { limit } = params;

    const dashboards = (await this.lookerRequest(
      `/dashboards?limit=${limit}`
    )) as Array<Record<string, unknown>>;

    return {
      operation: 'list_dashboards',
      success: true,
      dashboards: dashboards.map((d) => ({
        id: String(d.id),
        title: d.title as string | undefined,
        description: d.description as string | undefined,
        folder: d.folder as { id?: string; name?: string } | undefined,
      })),
      totalCount: dashboards.length,
      error: '',
    };
  }
}
