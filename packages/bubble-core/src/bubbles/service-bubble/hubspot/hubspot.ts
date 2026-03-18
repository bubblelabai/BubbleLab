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
 * Comprehensive HubSpot CRM integration for managing contacts, companies,
 * deals, tickets, properties, associations, pipelines, notes, owners,
 * lists, and account information.
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
    - Full CRUD + batch operations for contacts, companies, deals, and tickets
    - Advanced search with filter groups supporting AND/OR logic
    - Property definition management (create, update, delete custom properties)
    - Record associations (link contacts to companies, deals, etc.)
    - Pipeline and stage management for deals and tickets
    - Note creation with record associations
    - Account information retrieval

    Security Features:
    - OAuth 2.0 authentication with HubSpot
    - Scoped access permissions for CRM operations
    - Secure credential handling and validation
  `;
  static readonly alias = 'crm';

  // Note association type IDs (HubSpot-defined)
  private static readonly NOTE_ASSOC_TYPES: Record<string, number> = {
    contacts: 202,
    companies: 190,
    deals: 214,
    tickets: 18,
  };

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

    const response = await fetch(
      'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
      {
        headers: {
          Authorization: `Bearer ${credential}`,
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot API error (${response.status}): ${text}`);
    }
    return true;
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
    body?: unknown
  ): Promise<unknown> {
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

    // DELETE often returns 204 No Content
    if (response.status === 204) {
      return undefined;
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
        const p = this.params as HubSpotParams;
        switch (operation) {
          // Record CRUD
          case 'create_record':
            return this.createRecord(
              p as Extract<HubSpotParams, { operation: 'create_record' }>
            );
          case 'get_record':
            return this.getRecord(
              p as Extract<HubSpotParams, { operation: 'get_record' }>
            );
          case 'update_record':
            return this.updateRecord(
              p as Extract<HubSpotParams, { operation: 'update_record' }>
            );
          case 'delete_record':
            return this.deleteRecord(
              p as Extract<HubSpotParams, { operation: 'delete_record' }>
            );
          case 'search_records':
            return this.searchRecords(
              p as Extract<HubSpotParams, { operation: 'search_records' }>
            );
          case 'batch_create_records':
            return this.batchCreateRecords(
              p as Extract<HubSpotParams, { operation: 'batch_create_records' }>
            );
          case 'batch_update_records':
            return this.batchUpdateRecords(
              p as Extract<HubSpotParams, { operation: 'batch_update_records' }>
            );
          case 'batch_delete_records':
            return this.batchDeleteRecords(
              p as Extract<HubSpotParams, { operation: 'batch_delete_records' }>
            );
          // Properties
          case 'list_properties':
            return this.listProperties(
              p as Extract<HubSpotParams, { operation: 'list_properties' }>
            );
          case 'get_property':
            return this.getProperty(
              p as Extract<HubSpotParams, { operation: 'get_property' }>
            );
          case 'create_property':
            return this.createProperty(
              p as Extract<HubSpotParams, { operation: 'create_property' }>
            );
          case 'update_property':
            return this.updateProperty(
              p as Extract<HubSpotParams, { operation: 'update_property' }>
            );
          case 'delete_property':
            return this.deleteProperty(
              p as Extract<HubSpotParams, { operation: 'delete_property' }>
            );
          // Associations
          case 'list_associations':
            return this.listAssociations(
              p as Extract<HubSpotParams, { operation: 'list_associations' }>
            );
          case 'create_association':
            return this.createAssociation(
              p as Extract<HubSpotParams, { operation: 'create_association' }>
            );
          case 'remove_association':
            return this.removeAssociation(
              p as Extract<HubSpotParams, { operation: 'remove_association' }>
            );
          // Pipelines
          case 'list_pipelines':
            return this.listPipelines(
              p as Extract<HubSpotParams, { operation: 'list_pipelines' }>
            );
          // Notes
          case 'create_note':
            return this.createNote(
              p as Extract<HubSpotParams, { operation: 'create_note' }>
            );
          // Owners
          case 'list_owners':
            return this.listOwners(
              p as Extract<HubSpotParams, { operation: 'list_owners' }>
            );
          case 'get_owner':
            return this.getOwner(
              p as Extract<HubSpotParams, { operation: 'get_owner' }>
            );
          // Account
          case 'get_account_info':
            return this.getAccountInfo();
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

  // =====================================================================
  // Record CRUD
  // =====================================================================

  private async createRecord(
    params: Extract<HubSpotParams, { operation: 'create_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'create_record' }>> {
    const { object_type, properties } = params;
    const r = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}`,
      'POST',
      { properties }
    )) as Record<string, unknown>;

    return {
      operation: 'create_record',
      success: true,
      record: {
        id: r.id as string,
        properties: (r.properties ?? {}) as Record<string, unknown>,
        createdAt: r.createdAt as string | undefined,
        updatedAt: r.updatedAt as string | undefined,
        archived: r.archived as boolean | undefined,
      },
      error: '',
    };
  }

  private async getRecord(
    params: Extract<HubSpotParams, { operation: 'get_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'get_record' }>> {
    const { object_type, record_id, properties } = params;
    const qp = new URLSearchParams();
    if (properties && properties.length > 0) {
      qp.set('properties', properties.join(','));
    }
    const qs = qp.toString();
    const r = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/${record_id}${qs ? `?${qs}` : ''}`,
      'GET'
    )) as Record<string, unknown>;

    return {
      operation: 'get_record',
      success: true,
      record: {
        id: r.id as string,
        properties: (r.properties ?? {}) as Record<string, unknown>,
        createdAt: r.createdAt as string | undefined,
        updatedAt: r.updatedAt as string | undefined,
        archived: r.archived as boolean | undefined,
      },
      error: '',
    };
  }

  private async updateRecord(
    params: Extract<HubSpotParams, { operation: 'update_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'update_record' }>> {
    const { object_type, record_id, properties } = params;
    const r = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/${record_id}`,
      'PATCH',
      { properties }
    )) as Record<string, unknown>;

    return {
      operation: 'update_record',
      success: true,
      record: {
        id: r.id as string,
        properties: (r.properties ?? {}) as Record<string, unknown>,
        createdAt: r.createdAt as string | undefined,
        updatedAt: r.updatedAt as string | undefined,
        archived: r.archived as boolean | undefined,
      },
      error: '',
    };
  }

  private async deleteRecord(
    params: Extract<HubSpotParams, { operation: 'delete_record' }>
  ): Promise<Extract<HubSpotResult, { operation: 'delete_record' }>> {
    const { object_type, record_id } = params;
    await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/${record_id}`,
      'DELETE'
    );
    return { operation: 'delete_record', success: true, error: '' };
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
      limit: limit || 100,
    };
    if (properties && properties.length > 0) body.properties = properties;
    if (after) body.after = after;

    const response = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/search`,
      'POST',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'search_records',
      success: true,
      results: ((response.results ?? []) as Array<Record<string, unknown>>).map(
        (r) => ({
          id: r.id as string,
          properties: (r.properties ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt as string | undefined,
          updatedAt: r.updatedAt as string | undefined,
          archived: r.archived as boolean | undefined,
        })
      ),
      total: response.total as number | undefined,
      paging: response.paging as { next?: { after: string } } | undefined,
      error: '',
    };
  }

  private async batchCreateRecords(
    params: Extract<HubSpotParams, { operation: 'batch_create_records' }>
  ): Promise<Extract<HubSpotResult, { operation: 'batch_create_records' }>> {
    const { object_type, records } = params;
    const response = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/batch/create`,
      'POST',
      { inputs: records }
    )) as Record<string, unknown>;

    return {
      operation: 'batch_create_records',
      success: true,
      results: ((response.results ?? []) as Array<Record<string, unknown>>).map(
        (r) => ({
          id: r.id as string,
          properties: (r.properties ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt as string | undefined,
          updatedAt: r.updatedAt as string | undefined,
          archived: r.archived as boolean | undefined,
        })
      ),
      error: '',
    };
  }

  private async batchUpdateRecords(
    params: Extract<HubSpotParams, { operation: 'batch_update_records' }>
  ): Promise<Extract<HubSpotResult, { operation: 'batch_update_records' }>> {
    const { object_type, records } = params;
    const response = (await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/batch/update`,
      'POST',
      { inputs: records }
    )) as Record<string, unknown>;

    return {
      operation: 'batch_update_records',
      success: true,
      results: ((response.results ?? []) as Array<Record<string, unknown>>).map(
        (r) => ({
          id: r.id as string,
          properties: (r.properties ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt as string | undefined,
          updatedAt: r.updatedAt as string | undefined,
          archived: r.archived as boolean | undefined,
        })
      ),
      error: '',
    };
  }

  private async batchDeleteRecords(
    params: Extract<HubSpotParams, { operation: 'batch_delete_records' }>
  ): Promise<Extract<HubSpotResult, { operation: 'batch_delete_records' }>> {
    const { object_type, record_ids } = params;
    await this.makeHubSpotApiRequest(
      `/crm/v3/objects/${object_type}/batch/archive`,
      'POST',
      { inputs: record_ids.map((id) => ({ id })) }
    );
    return { operation: 'batch_delete_records', success: true, error: '' };
  }

  // =====================================================================
  // Properties
  // =====================================================================

  private async listProperties(
    params: Extract<HubSpotParams, { operation: 'list_properties' }>
  ): Promise<Extract<HubSpotResult, { operation: 'list_properties' }>> {
    const { object_type } = params;
    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/properties/${object_type}`,
      'GET'
    );
    const results = response as { results?: unknown[] } | unknown[];
    return {
      operation: 'list_properties',
      success: true,
      properties: ((results as Record<string, unknown>).results ??
        results) as Array<Record<string, unknown>>,
      error: '',
    };
  }

  private async getProperty(
    params: Extract<HubSpotParams, { operation: 'get_property' }>
  ): Promise<Extract<HubSpotResult, { operation: 'get_property' }>> {
    const { object_type, property_name } = params;
    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/properties/${object_type}/${property_name}`,
      'GET'
    );
    return {
      operation: 'get_property',
      success: true,
      property: response as Record<string, unknown>,
      error: '',
    };
  }

  private async createProperty(
    params: Extract<HubSpotParams, { operation: 'create_property' }>
  ): Promise<Extract<HubSpotResult, { operation: 'create_property' }>> {
    const {
      object_type,
      name,
      label,
      type,
      fieldType,
      groupName,
      description,
      hasUniqueValue,
      options,
      calculationFormula,
    } = params;

    const body: Record<string, unknown> = {
      name,
      label,
      type,
      fieldType,
      groupName,
    };
    if (description !== undefined) body.description = description;
    if (hasUniqueValue !== undefined) body.hasUniqueValue = hasUniqueValue;
    if (options !== undefined) body.options = options;
    if (calculationFormula !== undefined)
      body.calculationFormula = calculationFormula;

    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/properties/${object_type}`,
      'POST',
      body
    );
    return {
      operation: 'create_property',
      success: true,
      property: response as Record<string, unknown>,
      error: '',
    };
  }

  private async updateProperty(
    params: Extract<HubSpotParams, { operation: 'update_property' }>
  ): Promise<Extract<HubSpotResult, { operation: 'update_property' }>> {
    const {
      object_type,
      property_name,
      label,
      description,
      groupName,
      type,
      fieldType,
      options,
    } = params;

    const body: Record<string, unknown> = {};
    if (label !== undefined) body.label = label;
    if (description !== undefined) body.description = description;
    if (groupName !== undefined) body.groupName = groupName;
    if (type !== undefined) body.type = type;
    if (fieldType !== undefined) body.fieldType = fieldType;
    if (options !== undefined) body.options = options;

    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/properties/${object_type}/${property_name}`,
      'PATCH',
      body
    );
    return {
      operation: 'update_property',
      success: true,
      property: response as Record<string, unknown>,
      error: '',
    };
  }

  private async deleteProperty(
    params: Extract<HubSpotParams, { operation: 'delete_property' }>
  ): Promise<Extract<HubSpotResult, { operation: 'delete_property' }>> {
    const { object_type, property_name } = params;
    await this.makeHubSpotApiRequest(
      `/crm/v3/properties/${object_type}/${property_name}`,
      'DELETE'
    );
    return { operation: 'delete_property', success: true, error: '' };
  }

  // =====================================================================
  // Associations
  // =====================================================================

  private async listAssociations(
    params: Extract<HubSpotParams, { operation: 'list_associations' }>
  ): Promise<Extract<HubSpotResult, { operation: 'list_associations' }>> {
    const { from_object_type, from_record_id, to_object_type } = params;
    const response = (await this.makeHubSpotApiRequest(
      `/crm/v4/objects/${from_object_type}/${from_record_id}/associations/${to_object_type}`,
      'GET'
    )) as Record<string, unknown>;

    return {
      operation: 'list_associations',
      success: true,
      associations: (response.results ?? []) as Array<Record<string, unknown>>,
      error: '',
    };
  }

  private async createAssociation(
    params: Extract<HubSpotParams, { operation: 'create_association' }>
  ): Promise<Extract<HubSpotResult, { operation: 'create_association' }>> {
    const { from_object_type, from_record_id, to_object_type, to_record_id } =
      params;
    await this.makeHubSpotApiRequest(
      `/crm/v4/objects/${from_object_type}/${from_record_id}/associations/default/${to_object_type}/${to_record_id}`,
      'PUT'
    );
    return { operation: 'create_association', success: true, error: '' };
  }

  private async removeAssociation(
    params: Extract<HubSpotParams, { operation: 'remove_association' }>
  ): Promise<Extract<HubSpotResult, { operation: 'remove_association' }>> {
    const { from_object_type, from_record_id, to_object_type, to_record_id } =
      params;
    await this.makeHubSpotApiRequest(
      `/crm/v4/objects/${from_object_type}/${from_record_id}/associations/${to_object_type}/${to_record_id}`,
      'DELETE'
    );
    return { operation: 'remove_association', success: true, error: '' };
  }

  // =====================================================================
  // Pipelines
  // =====================================================================

  private async listPipelines(
    params: Extract<HubSpotParams, { operation: 'list_pipelines' }>
  ): Promise<Extract<HubSpotResult, { operation: 'list_pipelines' }>> {
    const { object_type } = params;
    const response = (await this.makeHubSpotApiRequest(
      `/crm/v3/pipelines/${object_type}`,
      'GET'
    )) as Record<string, unknown>;

    return {
      operation: 'list_pipelines',
      success: true,
      pipelines: (response.results ?? []) as Array<Record<string, unknown>>,
      error: '',
    };
  }

  // =====================================================================
  // Notes
  // =====================================================================

  private async createNote(
    params: Extract<HubSpotParams, { operation: 'create_note' }>
  ): Promise<Extract<HubSpotResult, { operation: 'create_note' }>> {
    const { note_body, associations, timestamp } = params;

    const body: Record<string, unknown> = {
      properties: {
        hs_note_body: note_body,
        hs_timestamp: timestamp || new Date().toISOString(),
      },
      associations: associations.map((assoc) => ({
        to: { id: assoc.record_id },
        types: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId:
              HubSpotBubble.NOTE_ASSOC_TYPES[assoc.object_type] ?? 202,
          },
        ],
      })),
    };

    const response = (await this.makeHubSpotApiRequest(
      '/crm/v3/objects/notes',
      'POST',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'create_note',
      success: true,
      note: {
        id: response.id as string,
        properties: (response.properties ?? {}) as Record<string, unknown>,
      },
      error: '',
    };
  }

  // =====================================================================
  // Owners
  // =====================================================================

  private async listOwners(
    params: Extract<HubSpotParams, { operation: 'list_owners' }>
  ): Promise<Extract<HubSpotResult, { operation: 'list_owners' }>> {
    const { email, limit, after } = params;
    const qp = new URLSearchParams();
    if (email) qp.set('email', email);
    if (limit) qp.set('limit', String(limit));
    if (after) qp.set('after', after);
    const qs = qp.toString();

    const response = (await this.makeHubSpotApiRequest(
      `/crm/v3/owners${qs ? `?${qs}` : ''}`,
      'GET'
    )) as Record<string, unknown>;

    return {
      operation: 'list_owners',
      success: true,
      owners: (response.results ?? []) as Array<Record<string, unknown>>,
      paging: response.paging as { next?: { after: string } } | undefined,
      error: '',
    };
  }

  private async getOwner(
    params: Extract<HubSpotParams, { operation: 'get_owner' }>
  ): Promise<Extract<HubSpotResult, { operation: 'get_owner' }>> {
    const { owner_id } = params;
    const response = await this.makeHubSpotApiRequest(
      `/crm/v3/owners/${owner_id}`,
      'GET'
    );
    return {
      operation: 'get_owner',
      success: true,
      owner: response as Record<string, unknown>,
      error: '',
    };
  }

  // =====================================================================
  // Account
  // =====================================================================

  private async getAccountInfo(): Promise<
    Extract<HubSpotResult, { operation: 'get_account_info' }>
  > {
    const response = await this.makeHubSpotApiRequest(
      '/account-info/v3/details',
      'GET'
    );
    return {
      operation: 'get_account_info',
      success: true,
      account: response as Record<string, unknown>,
      error: '',
    };
  }
}
