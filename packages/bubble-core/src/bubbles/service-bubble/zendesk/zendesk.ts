import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  ZendeskParamsSchema,
  ZendeskResultSchema,
  type ZendeskParams,
  type ZendeskParamsInput,
  type ZendeskResult,
} from './zendesk.schema.js';

/**
 * Zendesk Service Bubble
 *
 * Zendesk integration for managing tickets, users, organizations, and help center articles.
 *
 * Features:
 * - Create, retrieve, update, and list tickets
 * - List and read ticket comments / replies
 * - List and retrieve users and organizations
 * - Unified search across all Zendesk resources
 * - Help Center article management
 *
 * Security Features:
 * - OAuth 2.0 authentication with Zendesk
 * - Subdomain-scoped API access
 * - Secure credential handling
 */
export class ZendeskBubble<
  T extends ZendeskParamsInput = ZendeskParamsInput,
> extends ServiceBubble<
  T,
  Extract<ZendeskResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'zendesk';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'zendesk';
  static readonly schema = ZendeskParamsSchema;
  static readonly resultSchema = ZendeskResultSchema;
  static readonly shortDescription =
    'Zendesk integration for tickets, comments, users, and help center';
  static readonly longDescription = `
    Zendesk customer support integration for ticket management and help center.

    Features:
    - Create, retrieve, update, and list support tickets
    - List ticket comments and add replies (public or internal notes)
    - List and retrieve users and organizations
    - Unified search across tickets, users, and organizations
    - Help Center article listing and retrieval

    Use cases:
    - Automated ticket triage and response
    - Customer support workflow automation
    - Help center content management
    - Support analytics and reporting

    Security Features:
    - OAuth 2.0 authentication with Zendesk
    - Subdomain-scoped API access
    - Secure credential handling and validation
  `;
  static readonly alias = 'support';

  constructor(
    params: T = {
      operation: 'list_tickets',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error('Zendesk credentials are required');
    }

    const response = await fetch(
      `https://${creds.subdomain}.zendesk.com/api/v2/users/me.json`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zendesk API error (${response.status}): ${text}`);
    }
    return true;
  }

  /**
   * Zendesk credential format:
   * Base64-encoded JSON: { accessToken, subdomain }
   * The subdomain identifies which Zendesk instance to access.
   */
  private parseCredentials(): {
    accessToken: string;
    subdomain: string;
  } | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const zendeskCredRaw = credentials[CredentialType.ZENDESK_CRED];
    if (!zendeskCredRaw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{
        accessToken?: string;
        subdomain?: string;
      }>(zendeskCredRaw);

      if (parsed.accessToken && parsed.subdomain) {
        return {
          accessToken: parsed.accessToken,
          subdomain: parsed.subdomain,
        };
      }
    } catch {
      // If decoding fails, treat the raw value as an access token (validator path)
      // In this case, we can't make API calls without subdomain
    }

    return null;
  }

  protected chooseCredential(): string | undefined {
    const creds = this.parseCredentials();
    return creds?.accessToken;
  }

  private async makeZendeskApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<any> {
    const creds = this.parseCredentials();
    if (!creds) {
      throw new Error(
        'Invalid Zendesk credentials. Expected base64-encoded JSON with { accessToken, subdomain }.'
      );
    }

    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://${creds.subdomain}.zendesk.com${endpoint}`;

    const requestInit: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zendesk API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<ZendeskResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<ZendeskResult> => {
        const parsedParams = this.params as ZendeskParams;
        switch (operation) {
          case 'list_tickets':
            return await this.listTickets(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'list_tickets' }
              >
            );
          case 'get_ticket':
            return await this.getTicket(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'get_ticket' }
              >
            );
          case 'create_ticket':
            return await this.createTicket(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'create_ticket' }
              >
            );
          case 'update_ticket':
            return await this.updateTicket(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'update_ticket' }
              >
            );
          case 'list_ticket_comments':
            return await this.listTicketComments(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'list_ticket_comments' }
              >
            );
          case 'list_users':
            return await this.listUsers(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'list_users' }
              >
            );
          case 'get_user':
            return await this.getUser(
              parsedParams as Extract<ZendeskParams, { operation: 'get_user' }>
            );
          case 'list_organizations':
            return await this.listOrganizations(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'list_organizations' }
              >
            );
          case 'get_organization':
            return await this.getOrganization(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'get_organization' }
              >
            );
          case 'search':
            return await this.search(
              parsedParams as Extract<ZendeskParams, { operation: 'search' }>
            );
          case 'list_articles':
            return await this.listArticles(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'list_articles' }
              >
            );
          case 'get_article':
            return await this.getArticle(
              parsedParams as Extract<
                ZendeskParams,
                { operation: 'get_article' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<ZendeskResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<ZendeskResult, { operation: T['operation'] }>;
    }
  }

  // ---- Ticket operations ----

  private async listTickets(
    params: Extract<ZendeskParams, { operation: 'list_tickets' }>
  ): Promise<Extract<ZendeskResult, { operation: 'list_tickets' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));
    if (params.sort_by) queryParams.set('sort_by', params.sort_by);
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);

    // If status filter, use the search API for filtering
    if (params.status) {
      const searchQuery = `type:ticket status:${params.status}`;
      queryParams.set('query', searchQuery);
      const queryString = queryParams.toString();
      const response = await this.makeZendeskApiRequest(
        `/api/v2/search.json?${queryString}`
      );
      return {
        operation: 'list_tickets',
        success: true,
        tickets: (response.results || []).map(this.mapTicket),
        count: response.count,
        next_page: response.next_page ?? null,
        error: '',
      };
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/v2/tickets.json${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'list_tickets',
      success: true,
      tickets: (response.tickets || []).map(this.mapTicket),
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  private async getTicket(
    params: Extract<ZendeskParams, { operation: 'get_ticket' }>
  ): Promise<Extract<ZendeskResult, { operation: 'get_ticket' }>> {
    const response = await this.makeZendeskApiRequest(
      `/api/v2/tickets/${params.ticket_id}.json`
    );

    return {
      operation: 'get_ticket',
      success: true,
      ticket: this.mapTicket(response.ticket),
      error: '',
    };
  }

  private async createTicket(
    params: Extract<ZendeskParams, { operation: 'create_ticket' }>
  ): Promise<Extract<ZendeskResult, { operation: 'create_ticket' }>> {
    const ticketBody: Record<string, unknown> = {
      subject: params.subject,
      comment: { body: params.body },
    };

    if (params.requester_email) {
      const requester: Record<string, string> = {
        email: params.requester_email,
      };
      if (params.requester_name) {
        requester.name = params.requester_name;
      } else {
        // Zendesk requires a name when creating a requester; derive from email
        requester.name = params.requester_email.split('@')[0];
      }
      ticketBody.requester = requester;
    }
    if (params.assignee_id) ticketBody.assignee_id = params.assignee_id;
    if (params.priority) ticketBody.priority = params.priority;
    if (params.type) ticketBody.type = params.type;
    if (params.tags) ticketBody.tags = params.tags;

    const response = await this.makeZendeskApiRequest(
      '/api/v2/tickets.json',
      'POST',
      { ticket: ticketBody }
    );

    return {
      operation: 'create_ticket',
      success: true,
      ticket: this.mapTicket(response.ticket),
      error: '',
    };
  }

  private async updateTicket(
    params: Extract<ZendeskParams, { operation: 'update_ticket' }>
  ): Promise<Extract<ZendeskResult, { operation: 'update_ticket' }>> {
    const ticketBody: Record<string, unknown> = {};

    if (params.comment) {
      ticketBody.comment = {
        body: params.comment,
        public: params.public ?? true,
      };
    }
    if (params.status) ticketBody.status = params.status;
    if (params.priority) ticketBody.priority = params.priority;
    if (params.assignee_id) ticketBody.assignee_id = params.assignee_id;
    if (params.tags) ticketBody.tags = params.tags;

    const response = await this.makeZendeskApiRequest(
      `/api/v2/tickets/${params.ticket_id}.json`,
      'PUT',
      { ticket: ticketBody }
    );

    return {
      operation: 'update_ticket',
      success: true,
      ticket: this.mapTicket(response.ticket),
      error: '',
    };
  }

  // ---- Comment operations ----

  private async listTicketComments(
    params: Extract<ZendeskParams, { operation: 'list_ticket_comments' }>
  ): Promise<Extract<ZendeskResult, { operation: 'list_ticket_comments' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);

    const queryString = queryParams.toString();
    const endpoint = `/api/v2/tickets/${params.ticket_id}/comments.json${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'list_ticket_comments',
      success: true,
      comments: (response.comments || []).map(this.mapComment),
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  // ---- User operations ----

  private async listUsers(
    params: Extract<ZendeskParams, { operation: 'list_users' }>
  ): Promise<Extract<ZendeskResult, { operation: 'list_users' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));

    if (params.query) {
      queryParams.set('query', params.query);
      if (params.role) queryParams.set('role', params.role);
      const queryString = queryParams.toString();
      const response = await this.makeZendeskApiRequest(
        `/api/v2/users/search.json?${queryString}`
      );
      return {
        operation: 'list_users',
        success: true,
        users: (response.users || []).map(this.mapUser),
        count: response.count,
        next_page: response.next_page ?? null,
        error: '',
      };
    }

    if (params.role) queryParams.set('role', params.role);
    const queryString = queryParams.toString();
    const endpoint = `/api/v2/users.json${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'list_users',
      success: true,
      users: (response.users || []).map(this.mapUser),
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  private async getUser(
    params: Extract<ZendeskParams, { operation: 'get_user' }>
  ): Promise<Extract<ZendeskResult, { operation: 'get_user' }>> {
    const response = await this.makeZendeskApiRequest(
      `/api/v2/users/${params.user_id}.json`
    );

    return {
      operation: 'get_user',
      success: true,
      user: this.mapUser(response.user),
      error: '',
    };
  }

  // ---- Organization operations ----

  private async listOrganizations(
    params: Extract<ZendeskParams, { operation: 'list_organizations' }>
  ): Promise<Extract<ZendeskResult, { operation: 'list_organizations' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));

    if (params.query) {
      queryParams.set('name', params.query);
      const queryString = queryParams.toString();
      const response = await this.makeZendeskApiRequest(
        `/api/v2/organizations/search.json?${queryString}`
      );
      return {
        operation: 'list_organizations',
        success: true,
        organizations: (response.organizations || []).map(this.mapOrganization),
        count: response.count,
        next_page: response.next_page ?? null,
        error: '',
      };
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/v2/organizations.json${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'list_organizations',
      success: true,
      organizations: (response.organizations || []).map(this.mapOrganization),
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  private async getOrganization(
    params: Extract<ZendeskParams, { operation: 'get_organization' }>
  ): Promise<Extract<ZendeskResult, { operation: 'get_organization' }>> {
    const response = await this.makeZendeskApiRequest(
      `/api/v2/organizations/${params.organization_id}.json`
    );

    return {
      operation: 'get_organization',
      success: true,
      organization: this.mapOrganization(response.organization),
      error: '',
    };
  }

  // ---- Search ----

  private async search(
    params: Extract<ZendeskParams, { operation: 'search' }>
  ): Promise<Extract<ZendeskResult, { operation: 'search' }>> {
    const queryParams = new URLSearchParams();
    queryParams.set('query', params.query);
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));
    if (params.sort_by) queryParams.set('sort_by', params.sort_by);
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);

    const queryString = queryParams.toString();
    const response = await this.makeZendeskApiRequest(
      `/api/v2/search.json?${queryString}`
    );

    return {
      operation: 'search',
      success: true,
      results: response.results || [],
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  // ---- Help Center ----

  private async listArticles(
    params: Extract<ZendeskParams, { operation: 'list_articles' }>
  ): Promise<Extract<ZendeskResult, { operation: 'list_articles' }>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.per_page) queryParams.set('per_page', String(params.per_page));

    // Search endpoint vs list endpoint
    if (params.query) {
      queryParams.set('query', params.query);
      if (params.locale) queryParams.set('locale', params.locale);
      if (params.category_id) queryParams.set('category', params.category_id);
      if (params.section_id) queryParams.set('section', params.section_id);
      const queryString = queryParams.toString();
      const response = await this.makeZendeskApiRequest(
        `/api/v2/help_center/articles/search.json?${queryString}`
      );
      return {
        operation: 'list_articles',
        success: true,
        articles: (response.results || []).map(this.mapArticle),
        count: response.count,
        next_page: response.next_page ?? null,
        error: '',
      };
    }

    let basePath = '/api/v2/help_center';
    if (params.locale) basePath += `/${params.locale}`;
    if (params.section_id) {
      basePath += `/sections/${params.section_id}/articles.json`;
    } else if (params.category_id) {
      basePath += `/categories/${params.category_id}/articles.json`;
    } else {
      basePath += '/articles.json';
    }

    const queryString = queryParams.toString();
    const endpoint = `${basePath}${queryString ? `?${queryString}` : ''}`;
    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'list_articles',
      success: true,
      articles: (response.articles || []).map(this.mapArticle),
      count: response.count,
      next_page: response.next_page ?? null,
      error: '',
    };
  }

  private async getArticle(
    params: Extract<ZendeskParams, { operation: 'get_article' }>
  ): Promise<Extract<ZendeskResult, { operation: 'get_article' }>> {
    let endpoint = '/api/v2/help_center';
    if (params.locale) endpoint += `/${params.locale}`;
    endpoint += `/articles/${params.article_id}.json`;

    const response = await this.makeZendeskApiRequest(endpoint);

    return {
      operation: 'get_article',
      success: true,
      article: this.mapArticle(response.article),
      error: '',
    };
  }

  // ---- Mappers ----

  private mapTicket = (t: any) => ({
    id: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    type: t.type,
    requester_id: t.requester_id,
    assignee_id: t.assignee_id,
    organization_id: t.organization_id,
    tags: t.tags,
    created_at: t.created_at,
    updated_at: t.updated_at,
  });

  private mapComment = (c: any) => ({
    id: c.id,
    body: c.body,
    html_body: c.html_body,
    public: c.public,
    author_id: c.author_id,
    created_at: c.created_at,
  });

  private mapUser = (u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organization_id: u.organization_id,
    active: u.active,
    created_at: u.created_at,
  });

  private mapOrganization = (o: any) => ({
    id: o.id,
    name: o.name,
    domain_names: o.domain_names,
    external_id: o.external_id,
    created_at: o.created_at,
  });

  private mapArticle = (a: any) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    locale: a.locale,
    section_id: a.section_id,
    author_id: a.author_id,
    draft: a.draft,
    created_at: a.created_at,
    updated_at: a.updated_at,
  });
}
