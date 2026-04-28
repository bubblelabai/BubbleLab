import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  SalesforceParamsSchema,
  SalesforceResultSchema,
  type SalesforceParams,
  type SalesforceParamsInput,
  type SalesforceResult,
} from './salesforce.schema.js';

const SALESFORCE_API_VERSION = 'v59.0';

/**
 * Salesforce CRM Service Bubble
 *
 * Salesforce integration for querying accounts, contacts,
 * and running arbitrary SOQL queries via the Salesforce REST API.
 * Primary use case: account-level field lookup by business ID or Salesforce ID.
 */
export class SalesforceBubble<
  T extends SalesforceParamsInput = SalesforceParamsInput,
> extends ServiceBubble<
  T,
  Extract<SalesforceResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'salesforce';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'salesforce';
  static readonly schema = SalesforceParamsSchema;
  static readonly resultSchema = SalesforceResultSchema;
  static readonly shortDescription =
    'Salesforce CRM integration for accounts, contacts, and SOQL queries';
  static readonly longDescription = `
    Salesforce CRM integration for querying and searching CRM records.

    Operations:
    - get_account / get_contact: retrieve a record by Salesforce ID
    - search_accounts / search_contacts: SOQL WHERE-clause search
    - query: run arbitrary SOQL against any object
    - describe_object: list a sObject's fields with both API name AND user-facing label
    - list_objects: list all sObjects in the org with API name AND label

    IMPORTANT — label vs API name:
    Salesforce fields and objects have a backend API name (used in SOQL, e.g.
    "Treasury_Status__c") that differs from the user-facing label shown in the UI
    (e.g. "Saving Status"). Users almost always describe fields by their UI label,
    not the API name. Custom fields (suffixed __c) are especially prone to this.

    When the user references a field or object whose API name is NOT obviously a
    standard Salesforce field (e.g. Id, Name, Industry, BillingCity, Email,
    AnnualRevenue, AccountNumber, Type, OwnerId), you MUST first call
    describe_object (or list_objects for object discovery) to fetch the
    label→apiName mapping, then construct your SOQL using the apiName. Do not
    guess custom field API names from labels — call describe_object first.

    If multiple fields plausibly match the user's term, ask a clarification
    question rather than guessing.

    Result shapes:
    - describe_object → { object_name, object_label, fields: [{ apiName, label, type, custom, picklistValues?, referenceTo? }] }
    - list_objects → { objects: [{ apiName, label, custom, queryable }] }
    - get_account / get_contact → { record: {...} }
    - search_accounts / search_contacts / query → { records: [...], totalSize, done }

    Security Features:
    - OAuth 2.0 authentication with Salesforce
    - Instance-scoped access (each org has a unique API endpoint)
    - Secure credential handling with base64-encoded payloads
  `;
  static readonly alias = '';

  constructor(
    params: T = {
      operation: 'get_account',
      record_id: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Salesforce credentials are required');
    }

    const response = await fetch(
      `${creds.instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Salesforce API error (${response.status}): ${text}`);
    }
    return true;
  }

  private parseCredentials(): {
    accessToken: string;
    instanceUrl: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const raw = credentials[CredentialType.SALESFORCE_CRED];
    if (!raw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        instanceUrl?: string;
      }>(raw);

      if (parsed.accessToken && parsed.instanceUrl) {
        return {
          accessToken: parsed.accessToken,
          instanceUrl: parsed.instanceUrl.replace(/\/$/, ''),
        };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token (validator path)
    }

    return null;
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }

  private async sfRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Salesforce credentials are required');
    }

    const url = `${creds.instanceUrl}${endpoint}`;

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
      throw new Error(
        `Salesforce API error (${response.status}): ${errorText}`
      );
    }

    if (response.status === 204) {
      return undefined;
    }

    return await response.json();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SalesforceResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<SalesforceResult> => {
        const p = this.params as SalesforceParams;
        switch (operation) {
          case 'get_account':
            return await this.getAccount(
              p as Extract<SalesforceParams, { operation: 'get_account' }>
            );
          case 'search_accounts':
            return await this.searchAccounts(
              p as Extract<SalesforceParams, { operation: 'search_accounts' }>
            );
          case 'get_contact':
            return await this.getContact(
              p as Extract<SalesforceParams, { operation: 'get_contact' }>
            );
          case 'search_contacts':
            return await this.searchContacts(
              p as Extract<SalesforceParams, { operation: 'search_contacts' }>
            );
          case 'query':
            return await this.runQuery(
              p as Extract<SalesforceParams, { operation: 'query' }>
            );
          case 'describe_object':
            return await this.describeObject(
              p as Extract<SalesforceParams, { operation: 'describe_object' }>
            );
          case 'list_objects':
            return await this.listObjects(
              p as Extract<SalesforceParams, { operation: 'list_objects' }>
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<SalesforceResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<SalesforceResult, { operation: T['operation'] }>;
    }
  }

  // ─── Operation Implementations ──────────────────────────────────────

  private async getAccount(
    params: Extract<SalesforceParams, { operation: 'get_account' }>
  ): Promise<Extract<SalesforceResult, { operation: 'get_account' }>> {
    const { record_id, fields } = params;

    let endpoint = `/services/data/${SALESFORCE_API_VERSION}/sobjects/Account/${record_id}`;
    if (fields && fields.length > 0) {
      endpoint += `?fields=${fields.join(',')}`;
    }

    const record = (await this.sfRequest(endpoint)) as Record<string, unknown>;

    return {
      operation: 'get_account',
      success: true,
      record,
      error: '',
    };
  }

  private async searchAccounts(
    params: Extract<SalesforceParams, { operation: 'search_accounts' }>
  ): Promise<Extract<SalesforceResult, { operation: 'search_accounts' }>> {
    const { where_clause, fields, limit } = params;

    const selectFields =
      fields && fields.length > 0
        ? fields.join(', ')
        : 'Id, Name, Industry, BillingCity, Website, Phone, AccountNumber, Type';
    const soql = `SELECT ${selectFields} FROM Account WHERE ${where_clause} LIMIT ${limit}`;
    const encoded = encodeURIComponent(soql);

    const data = (await this.sfRequest(
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encoded}`
    )) as {
      totalSize: number;
      done: boolean;
      records: Record<string, unknown>[];
    };

    return {
      operation: 'search_accounts',
      success: true,
      records: data.records,
      totalSize: data.totalSize,
      done: data.done,
      error: '',
    };
  }

  private async getContact(
    params: Extract<SalesforceParams, { operation: 'get_contact' }>
  ): Promise<Extract<SalesforceResult, { operation: 'get_contact' }>> {
    const { record_id, fields } = params;

    let endpoint = `/services/data/${SALESFORCE_API_VERSION}/sobjects/Contact/${record_id}`;
    if (fields && fields.length > 0) {
      endpoint += `?fields=${fields.join(',')}`;
    }

    const record = (await this.sfRequest(endpoint)) as Record<string, unknown>;

    return {
      operation: 'get_contact',
      success: true,
      record,
      error: '',
    };
  }

  private async searchContacts(
    params: Extract<SalesforceParams, { operation: 'search_contacts' }>
  ): Promise<Extract<SalesforceResult, { operation: 'search_contacts' }>> {
    const { where_clause, fields, limit } = params;

    const selectFields =
      fields && fields.length > 0
        ? fields.join(', ')
        : 'Id, FirstName, LastName, Email, Phone, AccountId, Title';
    const soql = `SELECT ${selectFields} FROM Contact WHERE ${where_clause} LIMIT ${limit}`;
    const encoded = encodeURIComponent(soql);

    const data = (await this.sfRequest(
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encoded}`
    )) as {
      totalSize: number;
      done: boolean;
      records: Record<string, unknown>[];
    };

    return {
      operation: 'search_contacts',
      success: true,
      records: data.records,
      totalSize: data.totalSize,
      done: data.done,
      error: '',
    };
  }

  private async runQuery(
    params: Extract<SalesforceParams, { operation: 'query' }>
  ): Promise<Extract<SalesforceResult, { operation: 'query' }>> {
    const { soql } = params;
    const encoded = encodeURIComponent(soql);

    const data = (await this.sfRequest(
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encoded}`
    )) as {
      totalSize: number;
      done: boolean;
      records: Record<string, unknown>[];
    };

    return {
      operation: 'query',
      success: true,
      records: data.records,
      totalSize: data.totalSize,
      done: data.done,
      error: '',
    };
  }

  private async describeObject(
    params: Extract<SalesforceParams, { operation: 'describe_object' }>
  ): Promise<Extract<SalesforceResult, { operation: 'describe_object' }>> {
    const { object_name } = params;

    const data = (await this.sfRequest(
      `/services/data/${SALESFORCE_API_VERSION}/sobjects/${encodeURIComponent(object_name)}/describe`
    )) as {
      name: string;
      label: string;
      fields: Array<{
        name: string;
        label: string;
        type: string;
        custom: boolean;
        picklistValues?: Array<{ value: string; active: boolean }>;
        referenceTo?: string[];
      }>;
    };

    const fields = data.fields.map((f) => {
      const picklistValues = f.picklistValues
        ?.filter((p) => p.active)
        .map((p) => p.value);
      return {
        apiName: f.name,
        label: f.label,
        type: f.type,
        custom: f.custom,
        ...(picklistValues && picklistValues.length > 0
          ? { picklistValues }
          : {}),
        ...(f.referenceTo && f.referenceTo.length > 0
          ? { referenceTo: f.referenceTo }
          : {}),
      };
    });

    return {
      operation: 'describe_object',
      success: true,
      object_name: data.name,
      object_label: data.label,
      fields,
      error: '',
    };
  }

  private async listObjects(
    params: Extract<SalesforceParams, { operation: 'list_objects' }>
  ): Promise<Extract<SalesforceResult, { operation: 'list_objects' }>> {
    const { include_custom_only } = params;

    const data = (await this.sfRequest(
      `/services/data/${SALESFORCE_API_VERSION}/sobjects`
    )) as {
      sobjects: Array<{
        name: string;
        label: string;
        custom: boolean;
        queryable: boolean;
      }>;
    };

    const objects = data.sobjects
      .filter((o) => o.queryable)
      .filter((o) => (include_custom_only ? o.custom : true))
      .map((o) => ({
        apiName: o.name,
        label: o.label,
        custom: o.custom,
        queryable: o.queryable,
      }));

    return {
      operation: 'list_objects',
      success: true,
      objects,
      error: '',
    };
  }
}
