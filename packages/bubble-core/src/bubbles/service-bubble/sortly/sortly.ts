import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  SortlyParamsSchema,
  SortlyResultSchema,
  type SortlyParams,
  type SortlyParamsInput,
  type SortlyResult,
  type SortlyListItemsParams,
  type SortlyGetItemParams,
  type SortlyCreateItemParams,
  type SortlyUpdateItemParams,
  type SortlyDeleteItemParams,
  type SortlySearchItemsParams,
  type SortlyMoveItemParams,
} from './sortly.schema.js';

const SORTLY_API_URL = 'https://api.sortly.co/api/v1';

/**
 * SortlyBubble - Integration with Sortly inventory management
 *
 * Provides operations for interacting with the Sortly API:
 * - List, get, create, update, and delete items
 * - Search items by name
 * - Move items between folders
 * - List custom field definitions
 *
 * @example
 * ```typescript
 * const result = await new SortlyBubble({
 *   operation: 'list_items',
 *   per_page: 10,
 * }).action();
 *
 * const item = await new SortlyBubble({
 *   operation: 'get_item',
 *   item_id: 12345,
 * }).action();
 * ```
 */
export class SortlyBubble<
  T extends SortlyParamsInput = SortlyParamsInput,
> extends ServiceBubble<
  T,
  Extract<SortlyResult, { operation: T['operation'] }>
> {
  static readonly service = 'sortly';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'sortly' as const;
  static readonly type = 'service' as const;
  static readonly schema = SortlyParamsSchema;
  static readonly resultSchema = SortlyResultSchema;
  static readonly shortDescription =
    'Sortly inventory management for tracking items, folders, and stock levels';
  static readonly longDescription = `
    Sortly is a visual inventory management platform.
    This bubble provides operations for:
    - Listing and searching inventory items and folders
    - Creating, updating, and deleting items
    - Moving items between folders
    - Listing custom field definitions

    Authentication:
    - Uses API key (available on Ultra/Enterprise plans)
    - Key is passed via Authorization Bearer header

    Use Cases:
    - Automate inventory tracking and stock level monitoring
    - Sync inventory data with external systems
    - Build automated reorder workflows based on min_quantity thresholds
    - Organize items across folders programmatically
  `;
  static readonly alias = 'inventory';

  constructor(
    params: T = {
      operation: 'list_items',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const params = this.params as SortlyParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.SORTLY_API_KEY];
  }

  async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) return false;

    const response = await fetch(`${SORTLY_API_URL}/items?per_page=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Sortly API key validation failed');
    }
    return true;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SortlyResult, { operation: T['operation'] }>> {
    void context;

    const params = this.params as SortlyParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_items':
          return (await this.listItems(
            params as SortlyListItemsParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'get_item':
          return (await this.getItem(params as SortlyGetItemParams)) as Extract<
            SortlyResult,
            { operation: T['operation'] }
          >;

        case 'create_item':
          return (await this.createItem(
            params as SortlyCreateItemParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'update_item':
          return (await this.updateItem(
            params as SortlyUpdateItemParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'delete_item':
          return (await this.deleteItem(
            params as SortlyDeleteItemParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'search_items':
          return (await this.searchItems(
            params as SortlySearchItemsParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'move_item':
          return (await this.moveItem(
            params as SortlyMoveItemParams
          )) as Extract<SortlyResult, { operation: T['operation'] }>;

        case 'list_custom_fields':
          return (await this.listCustomFields()) as Extract<
            SortlyResult,
            { operation: T['operation'] }
          >;

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
      } as Extract<SortlyResult, { operation: T['operation'] }>;
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP helper
  // ---------------------------------------------------------------------------

  private async makeSortlyRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const apiKey = this.chooseCredential();
    if (!apiKey) throw new Error('Sortly API key is required');

    const url = `${SORTLY_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (method === 'DELETE' && response.status === 204) {
      return {};
    }

    if (!response.ok) {
      const text = await response.text();
      const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text;
      throw new Error(
        `Sortly API error (HTTP ${response.status}): ${truncated}`
      );
    }

    return await response.json();
  }

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  private async listItems(
    params: SortlyListItemsParams
  ): Promise<Extract<SortlyResult, { operation: 'list_items' }>> {
    const qs = new URLSearchParams();
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.per_page !== undefined)
      qs.set('per_page', String(params.per_page));
    if (params.folder_id !== undefined)
      qs.set('folder_id', String(params.folder_id));
    qs.set('include', 'custom_attributes,photos');

    const data = (await this.makeSortlyRequest(
      `/items?${qs.toString()}`
    )) as Record<string, unknown>;

    return {
      operation: 'list_items',
      success: true,
      items: (data.data as unknown[]) || [],
      page: data.page as number | undefined,
      per_page: data.per_page as number | undefined,
      total: data.total as number | undefined,
      error: '',
    } as Extract<SortlyResult, { operation: 'list_items' }>;
  }

  private async getItem(
    params: SortlyGetItemParams
  ): Promise<Extract<SortlyResult, { operation: 'get_item' }>> {
    const data = (await this.makeSortlyRequest(
      `/items/${params.item_id}?include=custom_attributes,photos`
    )) as Record<string, unknown>;

    return {
      operation: 'get_item',
      success: true,
      item: (data.data || data) as Record<string, unknown>,
      error: '',
    } as Extract<SortlyResult, { operation: 'get_item' }>;
  }

  private async createItem(
    params: SortlyCreateItemParams
  ): Promise<Extract<SortlyResult, { operation: 'create_item' }>> {
    const body: Record<string, unknown> = { name: params.name };
    if (params.type) body.type = params.type;
    if (params.notes) body.notes = params.notes;
    if (params.price) body.price = params.price;
    if (params.quantity !== undefined) body.quantity = params.quantity;
    if (params.min_quantity !== undefined)
      body.min_quantity = params.min_quantity;
    if (params.parent_id) body.parent_id = params.parent_id;
    if (params.sid) body.sid = params.sid;
    if (params.tags) body.tags = params.tags;

    const data = (await this.makeSortlyRequest(
      '/items',
      'POST',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'create_item',
      success: true,
      item: (data.data || data) as Record<string, unknown>,
      error: '',
    } as Extract<SortlyResult, { operation: 'create_item' }>;
  }

  private async updateItem(
    params: SortlyUpdateItemParams
  ): Promise<Extract<SortlyResult, { operation: 'update_item' }>> {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.price !== undefined) body.price = params.price;
    if (params.quantity !== undefined) body.quantity = params.quantity;
    if (params.min_quantity !== undefined)
      body.min_quantity = params.min_quantity;
    if (params.sid !== undefined) body.sid = params.sid;
    if (params.tags !== undefined) body.tags = params.tags;

    const data = (await this.makeSortlyRequest(
      `/items/${params.item_id}`,
      'PUT',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'update_item',
      success: true,
      item: (data.data || data) as Record<string, unknown>,
      error: '',
    } as Extract<SortlyResult, { operation: 'update_item' }>;
  }

  private async deleteItem(
    params: SortlyDeleteItemParams
  ): Promise<Extract<SortlyResult, { operation: 'delete_item' }>> {
    await this.makeSortlyRequest(`/items/${params.item_id}`, 'DELETE');

    return {
      operation: 'delete_item',
      success: true,
      error: '',
    };
  }

  private async searchItems(
    params: SortlySearchItemsParams
  ): Promise<Extract<SortlyResult, { operation: 'search_items' }>> {
    const body: Record<string, unknown> = { name: params.name };
    if (params.type !== undefined) body.type = params.type;
    if (params.page !== undefined) body.page = params.page;
    if (params.per_page !== undefined) body.per_page = params.per_page;

    const data = (await this.makeSortlyRequest(
      '/items/search',
      'POST',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'search_items',
      success: true,
      items: (data.data as unknown[]) || [],
      page: data.page as number | undefined,
      per_page: data.per_page as number | undefined,
      total: data.total as number | undefined,
      error: '',
    } as Extract<SortlyResult, { operation: 'search_items' }>;
  }

  private async moveItem(
    params: SortlyMoveItemParams
  ): Promise<Extract<SortlyResult, { operation: 'move_item' }>> {
    const body: Record<string, unknown> = { quantity: params.quantity };
    if (params.folder_id !== undefined) body.folder_id = params.folder_id;

    const data = (await this.makeSortlyRequest(
      `/items/${params.item_id}/move`,
      'POST',
      body
    )) as Record<string, unknown>;

    return {
      operation: 'move_item',
      success: true,
      item: (data.data || data) as Record<string, unknown>,
      error: '',
    } as Extract<SortlyResult, { operation: 'move_item' }>;
  }

  private async listCustomFields(): Promise<
    Extract<SortlyResult, { operation: 'list_custom_fields' }>
  > {
    const data = (await this.makeSortlyRequest('/custom_fields')) as Record<
      string,
      unknown
    >;

    return {
      operation: 'list_custom_fields',
      success: true,
      custom_fields: (data.data as unknown[]) || [],
      error: '',
    } as Extract<SortlyResult, { operation: 'list_custom_fields' }>;
  }
}
