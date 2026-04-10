import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  ClerkParamsSchema,
  ClerkResultSchema,
  type ClerkParams,
  type ClerkParamsInput,
  type ClerkResult,
} from './clerk.schema.js';

const CLERK_API_BASE = 'https://api.clerk.com/v1';

export class ClerkBubble<
  T extends ClerkParamsInput = ClerkParamsInput,
> extends ServiceBubble<
  T,
  Extract<ClerkResult, { operation: T['operation'] }>
> {
  static readonly service = 'clerk';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'clerk' as const;
  static readonly type = 'service' as const;
  static readonly schema = ClerkParamsSchema;
  static readonly resultSchema = ClerkResultSchema;
  static readonly shortDescription =
    'Clerk integration for user management, organizations, and billing';
  static readonly longDescription = `
    Integrate with Clerk to manage users, organizations, invitations, sessions, and billing.
    Supported operations:
    - Users: List, get, create, update, delete, ban, unban
    - Organizations: List, get, create, update, delete, list memberships
    - Invitations: List, create, revoke
    - Sessions: List, revoke
    - Billing: Get user/organization subscription status
    Authentication: OAuth 2.0 or Secret Key (Bearer token)
  `;
  static readonly alias = 'clerk';

  constructor(
    params: T = {
      operation: 'list_users',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const params = this.params as ClerkParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.CLERK_CRED];
  }

  private async makeClerkRequest(
    path: string,
    options: {
      method?: string;
      body?: Record<string, unknown>;
      queryParams?: Record<string, string>;
    } = {}
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const token = this.chooseCredential();
    if (!token) {
      return { ok: false, error: 'Clerk credential not found' };
    }

    const { method = 'GET', body, queryParams } = options;

    let url = `${CLERK_API_BASE}${path}`;
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
        let errorMessage = `Clerk API error (${response.status})`;
        try {
          const errorData = JSON.parse(text);
          errorMessage =
            errorData.errors?.[0]?.long_message ||
            errorData.errors?.[0]?.message ||
            errorData.message ||
            errorMessage;
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
      throw new Error('Clerk credentials are required');
    }

    const response = await fetch(`${CLERK_API_BASE}/users?limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Clerk API error (${response.status}): ${text}`);
    }
    return true;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<ClerkResult, { operation: T['operation'] }>> {
    void context;
    const params = this.params as ClerkParams;
    const { operation } = params;

    try {
      switch (operation) {
        // Users
        case 'list_users':
          return (await this.listUsers(
            params as Extract<ClerkParams, { operation: 'list_users' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'get_user':
          return (await this.getUser(
            params as Extract<ClerkParams, { operation: 'get_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'create_user':
          return (await this.createUser(
            params as Extract<ClerkParams, { operation: 'create_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'update_user':
          return (await this.updateUser(
            params as Extract<ClerkParams, { operation: 'update_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'delete_user':
          return (await this.deleteUser(
            params as Extract<ClerkParams, { operation: 'delete_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'ban_user':
          return (await this.banUser(
            params as Extract<ClerkParams, { operation: 'ban_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'unban_user':
          return (await this.unbanUser(
            params as Extract<ClerkParams, { operation: 'unban_user' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        // Organizations
        case 'list_organizations':
          return (await this.listOrganizations(
            params as Extract<ClerkParams, { operation: 'list_organizations' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'get_organization':
          return (await this.getOrganization(
            params as Extract<ClerkParams, { operation: 'get_organization' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'create_organization':
          return (await this.createOrganization(
            params as Extract<ClerkParams, { operation: 'create_organization' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'update_organization':
          return (await this.updateOrganization(
            params as Extract<ClerkParams, { operation: 'update_organization' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'delete_organization':
          return (await this.deleteOrganization(
            params as Extract<ClerkParams, { operation: 'delete_organization' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'list_organization_memberships':
          return (await this.listOrganizationMemberships(
            params as Extract<
              ClerkParams,
              { operation: 'list_organization_memberships' }
            >
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        // Invitations
        case 'list_invitations':
          return (await this.listInvitations(
            params as Extract<ClerkParams, { operation: 'list_invitations' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'create_invitation':
          return (await this.createInvitation(
            params as Extract<ClerkParams, { operation: 'create_invitation' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'revoke_invitation':
          return (await this.revokeInvitation(
            params as Extract<ClerkParams, { operation: 'revoke_invitation' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        // Sessions
        case 'list_sessions':
          return (await this.listSessions(
            params as Extract<ClerkParams, { operation: 'list_sessions' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'revoke_session':
          return (await this.revokeSession(
            params as Extract<ClerkParams, { operation: 'revoke_session' }>
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        // Billing
        case 'get_user_subscription':
          return (await this.getUserSubscription(
            params as Extract<
              ClerkParams,
              { operation: 'get_user_subscription' }
            >
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        case 'get_organization_subscription':
          return (await this.getOrganizationSubscription(
            params as Extract<
              ClerkParams,
              { operation: 'get_organization_subscription' }
            >
          )) as Extract<ClerkResult, { operation: T['operation'] }>;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<ClerkResult, { operation: T['operation'] }>;
    }
  }

  // ========================== Users ==========================

  private async listUsers(
    params: Extract<ClerkParams, { operation: 'list_users' }>
  ): Promise<Extract<ClerkResult, { operation: 'list_users' }>> {
    const queryParams: Record<string, string> = {
      limit: String(params.limit),
      offset: String(params.offset),
    };
    if (params.order_by) queryParams.order_by = params.order_by;
    if (params.query) queryParams.query = params.query;
    if (params.email_address) {
      for (const email of params.email_address) {
        queryParams[`email_address[]`] = email;
      }
    }

    const result = await this.makeClerkRequest('/users', { queryParams });

    if (!result.ok) {
      return {
        operation: 'list_users',
        success: false,
        error: result.error || 'Failed to list users',
      };
    }

    const data = result.data as unknown[] | undefined;
    return {
      operation: 'list_users',
      users: (data as Record<string, unknown>[]) || [],
      total_count: Array.isArray(data) ? data.length : 0,
      success: true,
      error: '',
    };
  }

  private async getUser(
    params: Extract<ClerkParams, { operation: 'get_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'get_user' }>> {
    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}`
    );

    if (!result.ok) {
      return {
        operation: 'get_user',
        success: false,
        error: result.error || 'Failed to get user',
      };
    }

    return {
      operation: 'get_user',
      user: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async createUser(
    params: Extract<ClerkParams, { operation: 'create_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'create_user' }>> {
    const body: Record<string, unknown> = {
      email_address: params.email_address,
    };
    if (params.first_name) body.first_name = params.first_name;
    if (params.last_name) body.last_name = params.last_name;
    if (params.username) body.username = params.username;
    if (params.password) body.password = params.password;
    if (params.public_metadata) body.public_metadata = params.public_metadata;
    if (params.private_metadata)
      body.private_metadata = params.private_metadata;

    const result = await this.makeClerkRequest('/users', {
      method: 'POST',
      body,
    });

    if (!result.ok) {
      return {
        operation: 'create_user',
        success: false,
        error: result.error || 'Failed to create user',
      };
    }

    return {
      operation: 'create_user',
      user: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async updateUser(
    params: Extract<ClerkParams, { operation: 'update_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'update_user' }>> {
    const body: Record<string, unknown> = {};
    if (params.first_name !== undefined) body.first_name = params.first_name;
    if (params.last_name !== undefined) body.last_name = params.last_name;
    if (params.username !== undefined) body.username = params.username;
    if (params.public_metadata) body.public_metadata = params.public_metadata;
    if (params.private_metadata)
      body.private_metadata = params.private_metadata;

    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}`,
      { method: 'PATCH', body }
    );

    if (!result.ok) {
      return {
        operation: 'update_user',
        success: false,
        error: result.error || 'Failed to update user',
      };
    }

    return {
      operation: 'update_user',
      user: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async deleteUser(
    params: Extract<ClerkParams, { operation: 'delete_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'delete_user' }>> {
    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}`,
      { method: 'DELETE' }
    );

    return {
      operation: 'delete_user',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to delete user',
    };
  }

  private async banUser(
    params: Extract<ClerkParams, { operation: 'ban_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'ban_user' }>> {
    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}/ban`,
      { method: 'POST' }
    );

    if (!result.ok) {
      return {
        operation: 'ban_user',
        success: false,
        error: result.error || 'Failed to ban user',
      };
    }

    return {
      operation: 'ban_user',
      user: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async unbanUser(
    params: Extract<ClerkParams, { operation: 'unban_user' }>
  ): Promise<Extract<ClerkResult, { operation: 'unban_user' }>> {
    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}/unban`,
      { method: 'POST' }
    );

    if (!result.ok) {
      return {
        operation: 'unban_user',
        success: false,
        error: result.error || 'Failed to unban user',
      };
    }

    return {
      operation: 'unban_user',
      user: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  // ========================== Organizations ==========================

  private async listOrganizations(
    params: Extract<ClerkParams, { operation: 'list_organizations' }>
  ): Promise<Extract<ClerkResult, { operation: 'list_organizations' }>> {
    const result = await this.makeClerkRequest('/organizations', {
      queryParams: {
        limit: String(params.limit),
        offset: String(params.offset),
      },
    });

    if (!result.ok) {
      return {
        operation: 'list_organizations',
        success: false,
        error: result.error || 'Failed to list organizations',
      };
    }

    const responseData = result.data as
      | { data?: unknown[]; total_count?: number }
      | undefined;
    return {
      operation: 'list_organizations',
      organizations: (responseData?.data as Record<string, unknown>[]) || [],
      total_count: responseData?.total_count,
      success: true,
      error: '',
    };
  }

  private async getOrganization(
    params: Extract<ClerkParams, { operation: 'get_organization' }>
  ): Promise<Extract<ClerkResult, { operation: 'get_organization' }>> {
    const result = await this.makeClerkRequest(
      `/organizations/${encodeURIComponent(params.organization_id)}`
    );

    if (!result.ok) {
      return {
        operation: 'get_organization',
        success: false,
        error: result.error || 'Failed to get organization',
      };
    }

    return {
      operation: 'get_organization',
      organization: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async createOrganization(
    params: Extract<ClerkParams, { operation: 'create_organization' }>
  ): Promise<Extract<ClerkResult, { operation: 'create_organization' }>> {
    const body: Record<string, unknown> = { name: params.name };
    if (params.slug) body.slug = params.slug;
    if (params.created_by) body.created_by = params.created_by;
    if (params.public_metadata) body.public_metadata = params.public_metadata;
    if (params.private_metadata)
      body.private_metadata = params.private_metadata;
    if (params.max_allowed_memberships !== undefined)
      body.max_allowed_memberships = params.max_allowed_memberships;

    const result = await this.makeClerkRequest('/organizations', {
      method: 'POST',
      body,
    });

    if (!result.ok) {
      return {
        operation: 'create_organization',
        success: false,
        error: result.error || 'Failed to create organization',
      };
    }

    return {
      operation: 'create_organization',
      organization: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async updateOrganization(
    params: Extract<ClerkParams, { operation: 'update_organization' }>
  ): Promise<Extract<ClerkResult, { operation: 'update_organization' }>> {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.public_metadata) body.public_metadata = params.public_metadata;
    if (params.private_metadata)
      body.private_metadata = params.private_metadata;
    if (params.max_allowed_memberships !== undefined)
      body.max_allowed_memberships = params.max_allowed_memberships;

    const result = await this.makeClerkRequest(
      `/organizations/${encodeURIComponent(params.organization_id)}`,
      { method: 'PATCH', body }
    );

    if (!result.ok) {
      return {
        operation: 'update_organization',
        success: false,
        error: result.error || 'Failed to update organization',
      };
    }

    return {
      operation: 'update_organization',
      organization: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async deleteOrganization(
    params: Extract<ClerkParams, { operation: 'delete_organization' }>
  ): Promise<Extract<ClerkResult, { operation: 'delete_organization' }>> {
    const result = await this.makeClerkRequest(
      `/organizations/${encodeURIComponent(params.organization_id)}`,
      { method: 'DELETE' }
    );

    return {
      operation: 'delete_organization',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to delete organization',
    };
  }

  private async listOrganizationMemberships(
    params: Extract<ClerkParams, { operation: 'list_organization_memberships' }>
  ): Promise<
    Extract<ClerkResult, { operation: 'list_organization_memberships' }>
  > {
    const result = await this.makeClerkRequest(
      `/organizations/${encodeURIComponent(params.organization_id)}/memberships`,
      {
        queryParams: {
          limit: String(params.limit),
          offset: String(params.offset),
        },
      }
    );

    if (!result.ok) {
      return {
        operation: 'list_organization_memberships',
        success: false,
        error: result.error || 'Failed to list memberships',
      };
    }

    const responseData = result.data as
      | { data?: unknown[]; total_count?: number }
      | undefined;
    return {
      operation: 'list_organization_memberships',
      memberships: (responseData?.data as Record<string, unknown>[]) || [],
      total_count: responseData?.total_count,
      success: true,
      error: '',
    };
  }

  // ========================== Invitations ==========================

  private async listInvitations(
    params: Extract<ClerkParams, { operation: 'list_invitations' }>
  ): Promise<Extract<ClerkResult, { operation: 'list_invitations' }>> {
    const result = await this.makeClerkRequest('/invitations', {
      queryParams: {
        limit: String(params.limit),
        offset: String(params.offset),
      },
    });

    if (!result.ok) {
      return {
        operation: 'list_invitations',
        success: false,
        error: result.error || 'Failed to list invitations',
      };
    }

    const responseData = result.data as
      | { data?: unknown[]; total_count?: number }
      | undefined;
    return {
      operation: 'list_invitations',
      invitations: (responseData?.data as Record<string, unknown>[]) || [],
      total_count: responseData?.total_count,
      success: true,
      error: '',
    };
  }

  private async createInvitation(
    params: Extract<ClerkParams, { operation: 'create_invitation' }>
  ): Promise<Extract<ClerkResult, { operation: 'create_invitation' }>> {
    const body: Record<string, unknown> = {
      email_address: params.email_address,
    };
    if (params.redirect_url) body.redirect_url = params.redirect_url;
    if (params.public_metadata) body.public_metadata = params.public_metadata;

    const result = await this.makeClerkRequest('/invitations', {
      method: 'POST',
      body,
    });

    if (!result.ok) {
      return {
        operation: 'create_invitation',
        success: false,
        error: result.error || 'Failed to create invitation',
      };
    }

    return {
      operation: 'create_invitation',
      invitation: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async revokeInvitation(
    params: Extract<ClerkParams, { operation: 'revoke_invitation' }>
  ): Promise<Extract<ClerkResult, { operation: 'revoke_invitation' }>> {
    const result = await this.makeClerkRequest(
      `/invitations/${encodeURIComponent(params.invitation_id)}/revoke`,
      { method: 'POST' }
    );

    return {
      operation: 'revoke_invitation',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to revoke invitation',
    };
  }

  // ========================== Sessions ==========================

  private async listSessions(
    params: Extract<ClerkParams, { operation: 'list_sessions' }>
  ): Promise<Extract<ClerkResult, { operation: 'list_sessions' }>> {
    const queryParams: Record<string, string> = {
      limit: String(params.limit),
      offset: String(params.offset),
    };
    if (params.user_id) queryParams.user_id = params.user_id;
    if (params.status) queryParams.status = params.status;

    const result = await this.makeClerkRequest('/sessions', { queryParams });

    if (!result.ok) {
      return {
        operation: 'list_sessions',
        success: false,
        error: result.error || 'Failed to list sessions',
      };
    }

    const responseData = result.data as
      | { data?: unknown[]; total_count?: number }
      | undefined;
    return {
      operation: 'list_sessions',
      sessions: (responseData?.data as Record<string, unknown>[]) || [],
      total_count: responseData?.total_count,
      success: true,
      error: '',
    };
  }

  private async revokeSession(
    params: Extract<ClerkParams, { operation: 'revoke_session' }>
  ): Promise<Extract<ClerkResult, { operation: 'revoke_session' }>> {
    const result = await this.makeClerkRequest(
      `/sessions/${encodeURIComponent(params.session_id)}/revoke`,
      { method: 'POST' }
    );

    return {
      operation: 'revoke_session',
      success: result.ok,
      error: result.ok ? '' : result.error || 'Failed to revoke session',
    };
  }

  // ========================== Billing ==========================

  private async getUserSubscription(
    params: Extract<ClerkParams, { operation: 'get_user_subscription' }>
  ): Promise<Extract<ClerkResult, { operation: 'get_user_subscription' }>> {
    const result = await this.makeClerkRequest(
      `/users/${encodeURIComponent(params.user_id)}/billing/subscription`
    );

    if (!result.ok) {
      return {
        operation: 'get_user_subscription',
        success: false,
        error: result.error || 'Failed to get user subscription',
      };
    }

    return {
      operation: 'get_user_subscription',
      subscription: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }

  private async getOrganizationSubscription(
    params: Extract<ClerkParams, { operation: 'get_organization_subscription' }>
  ): Promise<
    Extract<ClerkResult, { operation: 'get_organization_subscription' }>
  > {
    const result = await this.makeClerkRequest(
      `/organizations/${encodeURIComponent(params.organization_id)}/billing/subscription`
    );

    if (!result.ok) {
      return {
        operation: 'get_organization_subscription',
        success: false,
        error: result.error || 'Failed to get organization subscription',
      };
    }

    return {
      operation: 'get_organization_subscription',
      subscription: result.data as Record<string, unknown>,
      success: true,
      error: '',
    };
  }
}
