import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  AssembledParamsSchema,
  AssembledResultSchema,
  type AssembledParams,
  type AssembledParamsInput,
  type AssembledResult,
} from './assembled.schema.js';
import { makeAssembledRequest } from './assembled.utils.js';

export class AssembledBubble<
  T extends AssembledParamsInput = AssembledParamsInput,
> extends ServiceBubble<
  T,
  Extract<AssembledResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'assembled';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'assembled' as const;
  static readonly schema = AssembledParamsSchema;
  static readonly resultSchema = AssembledResultSchema;
  static readonly shortDescription =
    'Workforce management platform for scheduling, time off, and agent management';
  static readonly longDescription =
    'Assembled is a workforce management platform. This integration supports managing people/agents, activities/schedules, time off requests, queues, and teams via the Assembled REST API.';
  static readonly alias = 'assembled';

  constructor(params?: T, context?: BubbleContext) {
    super(
      {
        ...params,
      } as T,
      context
    );
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    return credentials?.[CredentialType.ASSEMBLED_CRED];
  }

  private getApiKey(): string {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error(
        'Assembled API key not found. Please provide an ASSEMBLED_CRED credential.'
      );
    }
    return apiKey;
  }

  public async testCredential(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey();
      // Use list_queues as a lightweight credential test
      await makeAssembledRequest({
        method: 'GET',
        path: '/queues',
        apiKey,
      });
      return true;
    } catch {
      return false;
    }
  }

  protected async performAction(
    _context?: BubbleContext
  ): Promise<Extract<AssembledResult, { operation: T['operation'] }>> {
    const params = this.params as AssembledParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_people':
          return (await this.listPeople(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'get_person':
          return (await this.getPerson(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'create_person':
          return (await this.createPerson(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'update_person':
          return (await this.updatePerson(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'list_activities':
          return (await this.listActivities(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'create_activity':
          return (await this.createActivity(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'delete_activities':
          return (await this.deleteActivities(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'create_time_off':
          return (await this.createTimeOff(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'list_time_off':
          return (await this.listTimeOff(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'cancel_time_off':
          return (await this.cancelTimeOff(params)) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'list_queues':
          return (await this.listQueues()) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        case 'list_teams':
          return (await this.listTeams()) as Extract<
            AssembledResult,
            { operation: T['operation'] }
          >;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      } as Extract<AssembledResult, { operation: T['operation'] }>;
    }
  }

  // ─── People operations ──────────────────────────────────────────────────

  private async listPeople(
    params: Extract<AssembledParams, { operation: 'list_people' }>
  ): Promise<Extract<AssembledResult, { operation: 'list_people' }>> {
    const apiKey = this.getApiKey();
    const data = await makeAssembledRequest<{
      people: Record<string, unknown>[];
      total?: number;
    }>({
      method: 'GET',
      path: '/people',
      apiKey,
      queryParams: {
        limit: params.limit,
        offset: params.offset,
        channel: params.channel,
        team: params.team,
        site: params.site,
        queue: params.queue,
        search: params.search,
      },
    });

    return {
      operation: 'list_people',
      success: true,
      error: '',
      people: data.people || [],
      total: data.total,
    };
  }

  private async getPerson(
    params: Extract<AssembledParams, { operation: 'get_person' }>
  ): Promise<Extract<AssembledResult, { operation: 'get_person' }>> {
    const apiKey = this.getApiKey();
    const data = await makeAssembledRequest<Record<string, unknown>>({
      method: 'GET',
      path: `/people/${params.person_id}`,
      apiKey,
    });

    return {
      operation: 'get_person',
      success: true,
      error: '',
      person: data,
    };
  }

  private async createPerson(
    params: Extract<AssembledParams, { operation: 'create_person' }>
  ): Promise<Extract<AssembledResult, { operation: 'create_person' }>> {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {
      first_name: params.first_name,
      last_name: params.last_name,
    };
    if (params.email) body.email = params.email;
    if (params.imported_id) body.imported_id = params.imported_id;
    if (params.channels) body.channels = params.channels;
    if (params.teams) body.teams = params.teams;
    if (params.queues) body.queues = params.queues;
    if (params.site) body.site = params.site;
    if (params.timezone) body.timezone = params.timezone;
    if (params.roles) body.roles = params.roles;
    if (params.staffable !== undefined) body.staffable = params.staffable;

    const data = await makeAssembledRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/people',
      apiKey,
      body,
    });

    return {
      operation: 'create_person',
      success: true,
      error: '',
      person: data,
    };
  }

  private async updatePerson(
    params: Extract<AssembledParams, { operation: 'update_person' }>
  ): Promise<Extract<AssembledResult, { operation: 'update_person' }>> {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {};
    if (params.first_name) body.first_name = params.first_name;
    if (params.last_name) body.last_name = params.last_name;
    if (params.email) body.email = params.email;
    if (params.channels) body.channels = params.channels;
    if (params.teams) body.teams = params.teams;
    if (params.queues) body.queues = params.queues;
    if (params.site) body.site = params.site;
    if (params.timezone) body.timezone = params.timezone;
    if (params.staffable !== undefined) body.staffable = params.staffable;

    const data = await makeAssembledRequest<Record<string, unknown>>({
      method: 'PATCH',
      path: `/people/${params.person_id}`,
      apiKey,
      body,
    });

    return {
      operation: 'update_person',
      success: true,
      error: '',
      person: data,
    };
  }

  // ─── Activities operations ──────────────────────────────────────────────

  private async listActivities(
    params: Extract<AssembledParams, { operation: 'list_activities' }>
  ): Promise<Extract<AssembledResult, { operation: 'list_activities' }>> {
    const apiKey = this.getApiKey();

    const queryParams: Record<string, string | number | boolean | undefined> = {
      start_time: params.start_time,
      end_time: params.end_time,
      include_agents: params.include_agents,
    };
    if (params.queue) queryParams.queue = params.queue;
    if (params.agent_ids?.length) {
      queryParams.agent_ids = params.agent_ids.join(',');
    }

    const data = await makeAssembledRequest<{
      activities?: Record<string, Record<string, unknown>>;
      agents?: Record<string, Record<string, unknown>>;
    }>({
      method: 'GET',
      path: '/activities',
      apiKey,
      queryParams,
    });

    return {
      operation: 'list_activities',
      success: true,
      error: '',
      activities: data.activities || {},
      agents: data.agents || {},
    };
  }

  private async createActivity(
    params: Extract<AssembledParams, { operation: 'create_activity' }>
  ): Promise<Extract<AssembledResult, { operation: 'create_activity' }>> {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {
      agent_id: params.agent_id,
      type_id: params.type_id,
      start_time: params.start_time,
      end_time: params.end_time,
    };
    if (params.channels) body.channels = params.channels;
    if (params.description) body.description = params.description;
    if (params.allow_conflicts) body.allow_conflicts = params.allow_conflicts;

    const data = await makeAssembledRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/activities',
      apiKey,
      body,
    });

    return {
      operation: 'create_activity',
      success: true,
      error: '',
      activity: data,
    };
  }

  private async deleteActivities(
    params: Extract<AssembledParams, { operation: 'delete_activities' }>
  ): Promise<Extract<AssembledResult, { operation: 'delete_activities' }>> {
    const apiKey = this.getApiKey();

    await makeAssembledRequest({
      method: 'DELETE',
      path: '/activities',
      apiKey,
      body: {
        agent_ids: params.agent_ids,
        start_time: params.start_time,
        end_time: params.end_time,
      },
    });

    return {
      operation: 'delete_activities',
      success: true,
      error: '',
    };
  }

  // ─── Time Off operations ────────────────────────────────────────────────

  private async createTimeOff(
    params: Extract<AssembledParams, { operation: 'create_time_off' }>
  ): Promise<Extract<AssembledResult, { operation: 'create_time_off' }>> {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {
      agent_id: params.agent_id,
      start_time: params.start_time,
      end_time: params.end_time,
    };
    if (params.type_id) body.type_id = params.type_id;
    if (params.status) body.status = params.status;
    if (params.notes) body.notes = params.notes;

    const data = await makeAssembledRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/time_off',
      apiKey,
      body,
    });

    return {
      operation: 'create_time_off',
      success: true,
      error: '',
      time_off: data,
    };
  }

  private async listTimeOff(
    params: Extract<AssembledParams, { operation: 'list_time_off' }>
  ): Promise<Extract<AssembledResult, { operation: 'list_time_off' }>> {
    const apiKey = this.getApiKey();

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      offset: params.offset,
    };
    if (params.status) queryParams.status = params.status;
    if (params.agent_ids?.length) {
      queryParams.agent_ids = params.agent_ids.join(',');
    }

    const data = await makeAssembledRequest<{
      requests?: Record<string, unknown>[];
    }>({
      method: 'GET',
      path: '/time_off/requests',
      apiKey,
      queryParams,
    });

    return {
      operation: 'list_time_off',
      success: true,
      error: '',
      requests: data.requests || [],
    };
  }

  private async cancelTimeOff(
    params: Extract<AssembledParams, { operation: 'cancel_time_off' }>
  ): Promise<Extract<AssembledResult, { operation: 'cancel_time_off' }>> {
    const apiKey = this.getApiKey();

    await makeAssembledRequest({
      method: 'POST',
      path: `/time_off/${params.time_off_id}/cancel`,
      apiKey,
    });

    return {
      operation: 'cancel_time_off',
      success: true,
      error: '',
    };
  }

  // ─── Filter operations (queues, teams) ──────────────────────────────────

  private async listQueues(): Promise<
    Extract<AssembledResult, { operation: 'list_queues' }>
  > {
    const apiKey = this.getApiKey();
    const data = await makeAssembledRequest<{
      queues?: Record<string, unknown>[];
    }>({
      method: 'GET',
      path: '/queues',
      apiKey,
    });

    return {
      operation: 'list_queues',
      success: true,
      error: '',
      queues: data.queues || [],
    };
  }

  private async listTeams(): Promise<
    Extract<AssembledResult, { operation: 'list_teams' }>
  > {
    const apiKey = this.getApiKey();
    const data = await makeAssembledRequest<{
      teams?: Record<string, unknown>[];
    }>({
      method: 'GET',
      path: '/teams',
      apiKey,
    });

    return {
      operation: 'list_teams',
      success: true,
      error: '',
      teams: data.teams || [],
    };
  }
}
