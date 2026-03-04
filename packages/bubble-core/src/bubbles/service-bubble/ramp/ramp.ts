import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  RampParamsSchema,
  RampResultSchema,
  type RampParams,
  type RampParamsInput,
  type RampResult,
} from './ramp.schema.js';

const RAMP_API_BASE = 'https://api.ramp.com/developer/v1';

/**
 * Ramp Service Bubble
 *
 * Integration with Ramp corporate card and expense management platform.
 *
 * Operations:
 * - list_transactions: List transactions with filters
 * - get_transaction: Get transaction details
 * - list_cards: List cards with filters
 * - get_card: Get card details
 * - list_users: List users with filters
 * - get_user: Get user details
 * - list_reimbursements: List reimbursements
 * - get_reimbursement: Get reimbursement details
 * - list_departments: List all departments
 * - list_vendors: List all vendors
 * - get_business: Get company info
 * - list_statements: List billing statements
 */
export class RampBubble<
  T extends RampParamsInput = RampParamsInput,
> extends ServiceBubble<T, Extract<RampResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'ramp';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'ramp';
  static readonly schema = RampParamsSchema;
  static readonly resultSchema = RampResultSchema;
  static readonly shortDescription =
    'Ramp integration for corporate card and expense management';
  static readonly longDescription = `
    Integration with Ramp corporate card and expense management platform.

    Operations:
    - list_transactions: List transactions with optional filters (date, user, card, merchant, state)
    - get_transaction: Get details for a specific transaction
    - list_cards: List cards with optional filters (user, display name)
    - get_card: Get details for a specific card
    - list_users: List users with optional filters (department, role, status)
    - get_user: Get details for a specific user
    - list_reimbursements: List reimbursements
    - get_reimbursement: Get details for a specific reimbursement
    - list_departments: List all departments
    - list_vendors: List all vendors
    - get_business: Get company/business information
    - list_statements: List billing statements

    Features:
    - OAuth 2.0 authentication
    - Cursor-based pagination
    - Rich filtering on transactions, cards, and users
  `;
  static readonly alias = 'ramp';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  /**
   * Test the OAuth credential by fetching business info
   */
  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Ramp credentials are required');
    }

    const response = await this.makeRampApiRequest('/business', 'GET');
    if (!response?.id) {
      throw new Error('Ramp API returned no business data');
    }
    return true;
  }

  /**
   * Get metadata for credential display
   */
  public override async getCredentialMetadata(): Promise<any> {
    try {
      const response = await this.makeRampApiRequest('/business', 'GET');
      if (response) {
        return {
          businessName:
            response.business_name_legal || response.business_name_on_card,
          displayName:
            response.business_name_legal || response.business_name_on_card,
        };
      }
    } catch {
      // Metadata extraction is best-effort
    }
    return undefined;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Ramp credentials provided');
    }

    return credentials[CredentialType.RAMP_CRED];
  }

  private getAccessToken(): string {
    const token = this.chooseCredential();
    if (!token) {
      throw new Error('Ramp credentials are required. Connect via OAuth.');
    }
    return token;
  }

  /**
   * Make an authenticated request to the Ramp API
   */
  private async makeRampApiRequest(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<any> {
    const url = new URL(`${RAMP_API_BASE}${path}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== '') {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.getAccessToken()}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Ramp API error (${response.status}): ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Parse paginated response from Ramp API
   */
  private parsePaginatedResponse(response: any): {
    data: any[];
    has_more: boolean;
    next_cursor?: string;
  } {
    const data = response.data || [];
    const hasMore = !!response.page?.next;
    let nextCursor: string | undefined;

    if (response.page?.next) {
      // Extract the 'start' param from the next page query string
      try {
        const nextUrl = new URL(`https://api.ramp.com${response.page.next}`);
        nextCursor = nextUrl.searchParams.get('start') || undefined;
      } catch {
        // If next is just a query string like "?start=xxx"
        const match = response.page.next.match(/start=([^&]+)/);
        nextCursor = match?.[1];
      }
    }

    return { data, has_more: hasMore, next_cursor: nextCursor };
  }

  protected async performAction(
    _context?: BubbleContext
  ): Promise<Extract<RampResult, { operation: T['operation'] }>> {
    const params = this.params as RampParams;
    type Result = Extract<RampResult, { operation: T['operation'] }>;

    try {
      let result: any;
      switch (params.operation) {
        case 'list_transactions':
          result = await this.listTransactions(params);
          break;
        case 'get_transaction':
          result = await this.getTransaction(params);
          break;
        case 'list_cards':
          result = await this.listCards(params);
          break;
        case 'get_card':
          result = await this.getCard(params);
          break;
        case 'list_users':
          result = await this.listUsers(params);
          break;
        case 'get_user':
          result = await this.getUser(params);
          break;
        case 'list_reimbursements':
          result = await this.listReimbursements(params);
          break;
        case 'get_reimbursement':
          result = await this.getReimbursement(params);
          break;
        case 'list_departments':
          result = await this.listDepartments(params);
          break;
        case 'list_vendors':
          result = await this.listVendors(params);
          break;
        case 'get_business':
          result = await this.getBusiness();
          break;
        case 'list_statements':
          result = await this.listStatements(params);
          break;
        default:
          result = {
            operation: (params as any).operation,
            success: false,
            error: `Unknown operation: ${(params as any).operation}`,
          };
      }
      return result as Result;
    } catch (error) {
      return {
        operation: params.operation,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as Result;
    }
  }

  // =========================================================================
  // Operation implementations
  // =========================================================================

  private async listTransactions(
    params: Extract<RampParams, { operation: 'list_transactions' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
      department_id: params.department_id,
      user_id: params.user_id,
      card_id: params.card_id,
      merchant_id: params.merchant_id,
      state: params.state,
      from_date: params.from_date,
      to_date: params.to_date,
    };

    const response = await this.makeRampApiRequest(
      '/transactions',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_transactions' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async getTransaction(
    params: Extract<RampParams, { operation: 'get_transaction' }>
  ) {
    const response = await this.makeRampApiRequest(
      `/transactions/${params.transaction_id}`,
      'GET'
    );

    return {
      operation: 'get_transaction' as const,
      success: true,
      transaction: response,
      error: '',
    };
  }

  private async listCards(
    params: Extract<RampParams, { operation: 'list_cards' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
      user_id: params.user_id,
      display_name: params.display_name,
    };

    const response = await this.makeRampApiRequest(
      '/cards',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_cards' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async getCard(
    params: Extract<RampParams, { operation: 'get_card' }>
  ) {
    const response = await this.makeRampApiRequest(
      `/cards/${params.card_id}`,
      'GET'
    );

    return {
      operation: 'get_card' as const,
      success: true,
      card: response,
      error: '',
    };
  }

  private async listUsers(
    params: Extract<RampParams, { operation: 'list_users' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
      department_id: params.department_id,
      role: params.role,
      status: params.status,
    };

    const response = await this.makeRampApiRequest(
      '/users',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_users' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async getUser(
    params: Extract<RampParams, { operation: 'get_user' }>
  ) {
    const response = await this.makeRampApiRequest(
      `/users/${params.user_id}`,
      'GET'
    );

    return {
      operation: 'get_user' as const,
      success: true,
      user: response,
      error: '',
    };
  }

  private async listReimbursements(
    params: Extract<RampParams, { operation: 'list_reimbursements' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
    };

    const response = await this.makeRampApiRequest(
      '/reimbursements',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_reimbursements' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async getReimbursement(
    params: Extract<RampParams, { operation: 'get_reimbursement' }>
  ) {
    const response = await this.makeRampApiRequest(
      `/reimbursements/${params.reimbursement_id}`,
      'GET'
    );

    return {
      operation: 'get_reimbursement' as const,
      success: true,
      reimbursement: response,
      error: '',
    };
  }

  private async listDepartments(
    params: Extract<RampParams, { operation: 'list_departments' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
    };

    const response = await this.makeRampApiRequest(
      '/departments',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_departments' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async listVendors(
    params: Extract<RampParams, { operation: 'list_vendors' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
    };

    const response = await this.makeRampApiRequest(
      '/vendors',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_vendors' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }

  private async getBusiness() {
    const response = await this.makeRampApiRequest('/business', 'GET');

    return {
      operation: 'get_business' as const,
      success: true,
      business: response,
      error: '',
    };
  }

  private async listStatements(
    params: Extract<RampParams, { operation: 'list_statements' }>
  ) {
    const queryParams: Record<string, string | number | undefined> = {
      page_size: params.page_size,
      start: params.start,
    };

    const response = await this.makeRampApiRequest(
      '/statements',
      'GET',
      undefined,
      queryParams
    );
    const { data, has_more, next_cursor } =
      this.parsePaginatedResponse(response);

    return {
      operation: 'list_statements' as const,
      success: true,
      data,
      has_more,
      next_cursor,
      error: '',
    };
  }
}
