import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  HubSpotParamsSchema,
  HubSpotResultSchema,
  type HubSpotParams,
  type HubSpotParamsInput,
  type HubSpotResult,
} from './hubspot.schema.js';

/**
 * HubSpot CRM Service Bubble
 *
 * Comprehensive HubSpot CRM integration for managing contacts, companies, deals, and tickets.
 *
 * Features:
 * - Full CRUD operations for all CRM object types
 * - Advanced search with filter groups (AND/OR logic)
 * - Property-based data management
 * - Pagination support for large datasets
 *
 * Use cases:
 * - Lead management and contact synchronization
 * - Company and deal pipeline tracking
 * - Support ticket management
 * - CRM data enrichment and automation
 *
 * Security Features:
 * - OAuth 2.0 authentication with HubSpot
 * - Scoped access permissions
 * - Secure credential handling
 */
export class HubSpotBubble<
  T extends HubSpotParamsInput = HubSpotParamsInput,
> extends ServiceBubble<
  T,
  Extract<HubSpotResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'hubspot';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'hubspot';
  static readonly schema = HubSpotParamsSchema;
  static readonly resultSchema = HubSpotResultSchema;
  static readonly shortDescription =
    'HubSpot CRM integration for contacts, companies, deals, and tickets';
  static readonly longDescription = `
    HubSpot CRM service integration for comprehensive customer relationship management.

    Features:
    - Create, read, update, and search contacts, companies, deals, and tickets
    - Advanced search with filter groups supporting AND/OR logic
    - Flexible property-based data management
    - Pagination for handling large datasets

    Use cases:
    - Lead management and contact synchronization
    - Company tracking and deal pipeline management
    - Support ticket creation and tracking
    - CRM data enrichment and workflow automation

    Security Features:
    - OAuth 2.0 authentication with HubSpot
    - Scoped access permissions for CRM operations
    - Secure credential handling and validation
  `;
  static readonly alias = 'crm';

  constructor(
    params: T = {
      operation: 'get_record',
      object_type: 'contacts',
      record_id: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('HubSpot credentials are required');
    }

    try {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No HubSpot credentials provided');
    }

    return credentials[CredentialType.HUBSPOT_CRED];
  }

  private async makeHubSpotApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<any> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('HubSpot credentials are required');
    }

    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://api.hubapi.com${endpoint}`;

    const requestInit: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${credential}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<HubSpotResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<HubSpotResult> => {
        const parsedParams = this.params as HubSpotParams;
        switch (operation) {
          case 'create_record':
            return await this.createRecord(
              parsedParams as Extract<
                HubSpotParams,
                { operation: 'create_record' }
              >
            );
          case 'get_record':
            return await this.getRecord(
              parsedParams as Extract<
                HubSpotParams,
                { operation: 'get_record' }
              >
            );
          case 'update_record':
            return await this.updateRecord(
              parsedParams as Extract<
                HubSpotParams,
                { operation: 'update_record' }
              >
            );
          case 'search_records':
            return await this.searchRecords(
              parsedParams as Extract<
                HubSpotParams,
                { operation: 'search_records' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<HubSpotResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<HubSpotResult, { operation: T['operation'] }>;
    }
  }

  private async createRecord(
    params: Extract<HubSpotParams, { operation: 'create_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'create_record' }>> {
    const { object_type, properties } = params;

    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}`,
      'POST',
      { properties }
    );

    return {
      operation: 'create_record',
      success: true,
      record: {
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        archived: response.archived,
      },
      error: '',
    };
  }

  private async getRecord(
    params: Extract<HubSpotParams, { operation: 'get_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'get_record' }>> {
    const { object_type, record_id, properties } = params;

    const queryParams = new URLSearchParams();
    if (properties && properties.length > 0) {
      queryParams.set('properties', properties.join(','));
    }

    const queryString = queryParams.toString();
    const endpoint = `/crm/v3/objects/${object_type}/${record_id}${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeHubSpotApiRequest(endpoint, 'GET');

    return {
      operation: 'get_record',
      success: true,
      record: {
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        archived: response.archived,
      },
      error: '',
    };
  }

  private async updateRecord(
    params: Extract<HubSpotParams, { operation: 'update_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'update_record' }>> {
    const { object_type, record_id, properties } = params;

    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/${record_id}`,
      'PATCH',
      { properties }
    );

    return {
      operation: 'update_record',
      success: true,
      record: {
        id: response.id,
        properties: response.properties,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        archived: response.archived,
      },
      error: '',
    };
  }

  private async searchRecords(
    params: Extract<HubSpotParams, { operation: 'search_records' }>
  ): Promise<Extract<HubSpotResult, { operation: 'search_records' }>> {
    const { object_type, filter_groups, properties, limit, after } = params;

    const body: Record<string, unknown> = {
      filterGroups: filter_groups.map((group) => ({
        filters: group.filters.map((filter) => {
          const f: Record<string, unknown> = {
            propertyName: filter.propertyName,
            operator: filter.operator,
          };
          if (filter.value !== undefined) f.value = filter.value;
          if (filter.highValue !== undefined) f.highValue = filter.highValue;
          if (filter.values !== undefined) f.values = filter.values;
          return f;
        }),
      })),
      limit: limit || 10,
    };

    if (properties && properties.length > 0) {
      body.properties = properties;
    }
    if (after) {
      body.after = after;
    }

    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/search`,
      'POST',
      body
    );

    return {
      operation: 'search_records',
      success: true,
      results: (response.results || []).map((r: any) => ({
        id: r.id,
        properties: r.properties,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        archived: r.archived,
      })),
      total: response.total,
      paging: response.paging,
      error: '',
    };
  }
}
