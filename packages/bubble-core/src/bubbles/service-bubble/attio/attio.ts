import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  AttioParamsSchema,
  AttioResultSchema,
  type AttioParams,
  type AttioParamsInput,
  type AttioResult,
} from './attio.schema.js';

const ATTIO_API_BASE = 'https://api.attio.com/v2';

export class AttioBubble<
  T extends AttioParamsInput = AttioParamsInput,
> extends ServiceBubble<
  T,
  Extract<AttioResult, { operation: T['operation'] }>
> {
  static readonly service = 'attio';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'attio' as const;
  static readonly type = 'service' as const;
  static readonly schema = AttioParamsSchema;
  static readonly resultSchema = AttioResultSchema;
  static readonly shortDescription =
    'Attio CRM integration for managing records, notes, tasks, and lists';
  static readonly longDescription = `
    Integrate with Attio CRM to manage your customer relationships.
    Supported operations:
    - Records: List, get, create, update, and delete records for any object type (people, companies, deals, custom objects)
    - Notes: Create and list notes linked to records
    - Tasks: Create, list, update, and delete CRM tasks with deadlines and assignees
    - Lists & Entries: Manage pipeline lists and add/query entries
    Authentication: OAuth2 with Bearer token
  `;
  static readonly alias = 'attio';

  constructor(
    params: T = {
      operation: 'list_records',
      object: 'people',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const params = this.params as AttioParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.ATTIO_CRED];
  }

  private async makeAttioRequest(
    path: string,
    options: {
      method?: string;
      body?: Record<string, unknown>;
      queryParams?: Record<string, string>;
    } = {}
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const token = this.chooseCredential();
    if (!token) {
      return { ok: false, error: 'Attio credential not found' };
    }

    const { method = 'GET', body, queryParams } = options;

    let url = `${ATTIO_API_BASE}${path}`;
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const fetchOptions: RequestInit = { method, headers };
      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const text = await response.text();

      if (!response.ok) {
        let errorMessage = `Attio API error (${response.status})`;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          if (text) errorMessage += `: ${text.slice(0, 200)}`;
        }
        return { ok: false, error: errorMessage };
      }

      if (!text || text.trim() === '') {
        return { ok: true };
      }

      const data = JSON.parse(text);
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  public async testCredential(): Promise<boolean> {
    const token = this.chooseCredential();
    if (!token) {
      throw new Error('Attio credentials are required');
    }

    try {
      const response = await fetch(`${ATTIO_API_BASE}/self`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<AttioResult, { operation: T['operation'] }>> {
    void context;
    const params = this.params as AttioParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_records':
          return (await this.listRecords(
            params as Extract<AttioParams, { operation: 'list_records' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'get_record':
          return (await this.getRecord(
            params as Extract<AttioParams, { operation: 'get_record' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'create_record':
          return (await this.createRecord(
            params as Extract<AttioParams, { operation: 'create_record' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'update_record':
          return (await this.updateRecord(
            params as Extract<AttioParams, { operation: 'update_record' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'delete_record':
          return (await this.deleteRecord(
            params as Extract<AttioParams, { operation: 'delete_record' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'create_note':
          return (await this.createNote(
            params as Extract<AttioParams, { operation: 'create_note' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'list_notes':
          return (await this.listNotes(
            params as Extract<AttioParams, { operation: 'list_notes' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'create_task':
          return (await this.createTask(
            params as Extract<AttioParams, { operation: 'create_task' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'list_tasks':
          return (await this.listTasks(
            params as Extract<AttioParams, { operation: 'list_tasks' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'update_task':
          return (await this.updateTask(
            params as Extract<AttioParams, { operation: 'update_task' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'delete_task':
          return (await this.deleteTask(
            params as Extract<AttioParams, { operation: 'delete_task' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'list_lists':
          return (await this.listLists(
            params as Extract<AttioParams, { operation: 'list_lists' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'create_entry':
          return (await this.createEntry(
            params as Extract<AttioParams, { operation: 'create_entry' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        case 'list_entries':
          return (await this.listEntries(
            params as Extract<AttioParams, { operation: 'list_entries' }>
          )) as Extract<AttioResult, { operation: T['operation'] }>;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<AttioResult, { operation: T['operation'] }>;
    }
  }

  // ========================== Records ==========================

  private async listRecords(
    params: Extract<AttioParams, { operation: 'list_records' }>
  ): Promise<Extract<AttioResult, { operation: 'list_records' }>> {
    const body: Record<string, unknown> = {
      limit: params.limit,
      offset: params.offset,
    };
    if (params.sorts) body.sorts = params.sorts;
    if (params.filter) body.filter = params.filter;

    const result = await this.makeAttioRequest(
      `/objects/${encodeURIComponent(params.object)}/records/query`,
      { method: 'POST', body }
    );

    if (!result.ok) {
      return {
        operation: 'list_records',
        success: false,
        error: result.error || 'Failed to list records',
      };
    }

    const responseData = result.data as
      | { data?: unknown[]; next_cursor?: unknown }
      | undefined;
    return {
      operation: 'list_records',
      records: (responseData?.data as Record<string, unknown>[]) || [],
      next_page_offset: (params.offset ?? 0) + (params.limit ?? 25),
      success: true,
      error: '',
    };
  }

  private async getRecord(
    params: Extract<AttioParams, { operation: 'get_record' }>
  ): Promise<Extract<AttioResult, { operation: 'get_record' }>> {
    const result = await this.makeAttioRequest(
      `/objects/${encodeURIComponent(params.object)}/records/${encodeURIComponent(params.record_id)}`
    );

    if (!result.ok) {
      return {
        operation: 'get_record',
        success: false,
        error: result.error || 'Failed to get record',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'get_record',
      record: responseData?.data,
      success: true,
      error: '',
    };
  }

  /**
   * Auto-fill `full_name` on personal-name values when only first/last are provided.
   * Attio rejects name values without `full_name`.
   */
  private normalizeValues(
    values: Record<string, unknown>
  ): Record<string, unknown> {
    if (!values.name || !Array.isArray(values.name)) return values;
    const normalized = { ...values };
    normalized.name = (values.name as Record<string, unknown>[]).map((v) => {
      if (v.full_name || (!v.first_name && !v.last_name)) return v;
      return {
        ...v,
        full_name: [v.first_name, v.last_name].filter(Boolean).join(' '),
      };
    });
    return normalized;
  }

  private async createRecord(
    params: Extract<AttioParams, { operation: 'create_record' }>
  ): Promise<Extract<AttioResult, { operation: 'create_record' }>> {
    const body: Record<string, unknown> = {
      data: { values: this.normalizeValues(params.values) },
    };

    const path = `/objects/${encodeURIComponent(params.object)}/records`;
    let method = 'POST';
    let queryParams: Record<string, string> | undefined;

    if (params.matching_attribute) {
      method = 'PUT';
      queryParams = { matching_attribute: params.matching_attribute };
    }

    const result = await this.makeAttioRequest(path, {
      method,
      body,
      queryParams,
    });

    if (!result.ok) {
      return {
        operation: 'create_record',
        success: false,
        error: result.error || 'Failed to create record',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'create_record',
      record: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async updateRecord(
    params: Extract<AttioParams, { operation: 'update_record' }>
  ): Promise<Extract<AttioResult, { operation: 'update_record' }>> {
    const result = await this.makeAttioRequest(
      `/objects/${encodeURIComponent(params.object)}/records/${encodeURIComponent(params.record_id)}`,
      {
        method: 'PATCH',
        body: { data: { values: this.normalizeValues(params.values) } },
      }
    );

    if (!result.ok) {
      return {
        operation: 'update_record',
        success: false,
        error: result.error || 'Failed to update record',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'update_record',
      record: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async deleteRecord(
    params: Extract<AttioParams, { operation: 'delete_record' }>
  ): Promise<Extract<AttioResult, { operation: 'delete_record' }>> {
    const result = await this.makeAttioRequest(
      `/objects/${encodeURIComponent(params.object)}/records/${encodeURIComponent(params.record_id)}`,
      { method: 'DELETE' }
    );

    return {
      operation: 'delete_record',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to delete record',
    };
  }

  // ========================== Notes ==========================

  private async createNote(
    params: Extract<AttioParams, { operation: 'create_note' }>
  ): Promise<Extract<AttioResult, { operation: 'create_note' }>> {
    const result = await this.makeAttioRequest('/notes', {
      method: 'POST',
      body: {
        data: {
          title: params.title,
          content: params.content,
          format: params.format,
          parent_object: params.parent_object,
          parent_record_id: params.parent_record_id,
        },
      },
    });

    if (!result.ok) {
      return {
        operation: 'create_note',
        success: false,
        error: result.error || 'Failed to create note',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'create_note',
      note: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async listNotes(
    params: Extract<AttioParams, { operation: 'list_notes' }>
  ): Promise<Extract<AttioResult, { operation: 'list_notes' }>> {
    const queryParams: Record<string, string> = {
      limit: String(params.limit),
      offset: String(params.offset),
    };
    if (params.parent_object) queryParams.parent_object = params.parent_object;
    if (params.parent_record_id)
      queryParams.parent_record_id = params.parent_record_id;

    const result = await this.makeAttioRequest('/notes', { queryParams });

    if (!result.ok) {
      return {
        operation: 'list_notes',
        success: false,
        error: result.error || 'Failed to list notes',
      };
    }

    const responseData = result.data as { data?: unknown[] } | undefined;
    return {
      operation: 'list_notes',
      notes: (responseData?.data as Record<string, unknown>[]) || [],
      success: true,
      error: '',
    };
  }

  // ========================== Tasks ==========================

  private async createTask(
    params: Extract<AttioParams, { operation: 'create_task' }>
  ): Promise<Extract<AttioResult, { operation: 'create_task' }>> {
    const taskData: Record<string, unknown> = {
      content: params.content,
      format: 'plaintext',
      is_completed: params.is_completed ?? false,
      deadline_at: params.deadline_at ?? null,
      linked_records: params.linked_records ?? [],
      assignees: params.assignees ?? [],
    };

    const result = await this.makeAttioRequest('/tasks', {
      method: 'POST',
      body: { data: taskData },
    });

    if (!result.ok) {
      return {
        operation: 'create_task',
        success: false,
        error: result.error || 'Failed to create task',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'create_task',
      task: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async listTasks(
    params: Extract<AttioParams, { operation: 'list_tasks' }>
  ): Promise<Extract<AttioResult, { operation: 'list_tasks' }>> {
    const result = await this.makeAttioRequest('/tasks', {
      queryParams: {
        limit: String(params.limit),
        offset: String(params.offset),
      },
    });

    if (!result.ok) {
      return {
        operation: 'list_tasks',
        success: false,
        error: result.error || 'Failed to list tasks',
      };
    }

    const responseData = result.data as { data?: unknown[] } | undefined;
    return {
      operation: 'list_tasks',
      tasks: (responseData?.data as Record<string, unknown>[]) || [],
      success: true,
      error: '',
    };
  }

  private async updateTask(
    params: Extract<AttioParams, { operation: 'update_task' }>
  ): Promise<Extract<AttioResult, { operation: 'update_task' }>> {
    const taskData: Record<string, unknown> = {};
    if (params.content !== undefined) taskData.content = params.content;
    if (params.deadline_at !== undefined)
      taskData.deadline_at = params.deadline_at;
    if (params.is_completed !== undefined)
      taskData.is_completed = params.is_completed;

    const result = await this.makeAttioRequest(
      `/tasks/${encodeURIComponent(params.task_id)}`,
      {
        method: 'PATCH',
        body: { data: taskData },
      }
    );

    if (!result.ok) {
      return {
        operation: 'update_task',
        success: false,
        error: result.error || 'Failed to update task',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'update_task',
      task: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async deleteTask(
    params: Extract<AttioParams, { operation: 'delete_task' }>
  ): Promise<Extract<AttioResult, { operation: 'delete_task' }>> {
    const result = await this.makeAttioRequest(
      `/tasks/${encodeURIComponent(params.task_id)}`,
      { method: 'DELETE' }
    );

    return {
      operation: 'delete_task',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to delete task',
    };
  }

  // ========================== Lists & Entries ==========================

  private async listLists(
    params: Extract<AttioParams, { operation: 'list_lists' }>
  ): Promise<Extract<AttioResult, { operation: 'list_lists' }>> {
    const result = await this.makeAttioRequest('/lists', {
      queryParams: {
        limit: String(params.limit),
        offset: String(params.offset),
      },
    });

    if (!result.ok) {
      return {
        operation: 'list_lists',
        success: false,
        error: result.error || 'Failed to list lists',
      };
    }

    const responseData = result.data as { data?: unknown[] } | undefined;
    return {
      operation: 'list_lists',
      lists: (responseData?.data as Record<string, unknown>[]) || [],
      success: true,
      error: '',
    };
  }

  private async createEntry(
    params: Extract<AttioParams, { operation: 'create_entry' }>
  ): Promise<Extract<AttioResult, { operation: 'create_entry' }>> {
    const result = await this.makeAttioRequest(
      `/lists/${encodeURIComponent(params.list)}/entries`,
      {
        method: 'POST',
        body: {
          data: {
            parent_object: params.parent_object,
            parent_record_id: params.parent_record_id,
            entry_values: params.entry_values,
          },
        },
      }
    );

    if (!result.ok) {
      return {
        operation: 'create_entry',
        success: false,
        error: result.error || 'Failed to create entry',
      };
    }

    const responseData = result.data as
      | { data?: Record<string, unknown> }
      | undefined;
    return {
      operation: 'create_entry',
      entry: responseData?.data,
      success: true,
      error: '',
    };
  }

  private async listEntries(
    params: Extract<AttioParams, { operation: 'list_entries' }>
  ): Promise<Extract<AttioResult, { operation: 'list_entries' }>> {
    const body: Record<string, unknown> = {
      limit: params.limit,
      offset: params.offset,
    };
    if (params.filter) body.filter = params.filter;

    const result = await this.makeAttioRequest(
      `/lists/${encodeURIComponent(params.list)}/entries/query`,
      { method: 'POST', body }
    );

    if (!result.ok) {
      return {
        operation: 'list_entries',
        success: false,
        error: result.error || 'Failed to list entries',
      };
    }

    const responseData = result.data as { data?: unknown[] } | undefined;
    return {
      operation: 'list_entries',
      entries: (responseData?.data as Record<string, unknown>[]) || [],
      next_page_offset: (params.offset ?? 0) + (params.limit ?? 25),
      success: true,
      error: '',
    };
  }
}
