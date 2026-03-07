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
import { makeRampRequest } from './ramp.utils.js';

/**
 * Ramp Service Bubble
 *
 * Agent-friendly Ramp integration for corporate expense management.
 *
 * Operations:
 * - list_transactions / get_transaction: View spending activity
 * - list_users / get_user: View employees
 * - list_cards / get_card: View corporate cards
 * - list_departments: View departments
 * - list_locations: View locations
 * - list_spend_programs: View spend programs
 * - list_limits: View spend limits/funds
 * - list_reimbursements: View reimbursements
 * - list_bills: View bills
 * - list_vendors: View vendors
 * - get_business: Get business info
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Cursor-based pagination
 * - REST API integration
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
    'Ramp integration for corporate expense management';
  static readonly longDescription = `
    Agent-friendly Ramp integration for corporate expense and spend management.

    Operations:
    - list_transactions / get_transaction: View spending activity across cards
    - list_users / get_user: View and manage employees
    - list_cards / get_card: View corporate cards
    - list_departments: View departments
    - list_locations: View locations
    - list_spend_programs: View spend programs
    - list_limits: View spend limits/funds
    - list_reimbursements: View reimbursements
    - list_bills: View bills
    - list_vendors: View vendors
    - get_business: Get business information

    Features:
    - OAuth 2.0 authentication
    - Cursor-based pagination
    - Comprehensive spend visibility
  `;
  static readonly alias = 'ramp';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const accessToken = this.chooseCredential();
    if (!accessToken) {
      throw new Error('Ramp credentials are required');
    }

    // Test by fetching business info
    const data = await makeRampRequest(accessToken, '/business');
    if (!data || typeof data !== 'object') {
      throw new Error('Ramp API returned no data');
    }
    return true;
  }

  private getAccessToken(): string {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error(
        'Ramp credentials are required. Connect your Ramp account via OAuth.'
      );
    }

    const token = credentials[CredentialType.RAMP_CRED];
    if (!token) {
      throw new Error(
        'Ramp credentials are required. Connect your Ramp account via OAuth.'
      );
    }

    return token;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<RampResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<RampResult> => {
        const params = this.params as RampParams;
        const token = this.getAccessToken();

        switch (operation) {
          case 'list_transactions':
            return await this.listPaginated(
              token,
              '/transactions',
              'list_transactions',
              'transactions',
              params
            );
          case 'get_transaction':
            return await this.getSingle(
              token,
              `/transactions/${(params as { transaction_id: string }).transaction_id}`,
              'get_transaction',
              'transaction'
            );
          case 'list_users':
            return await this.listPaginated(
              token,
              '/users',
              'list_users',
              'users',
              params
            );
          case 'get_user':
            return await this.getSingle(
              token,
              `/users/${(params as { user_id: string }).user_id}`,
              'get_user',
              'user'
            );
          case 'list_cards':
            return await this.listPaginated(
              token,
              '/cards',
              'list_cards',
              'cards',
              params
            );
          case 'get_card':
            return await this.getSingle(
              token,
              `/cards/${(params as { card_id: string }).card_id}`,
              'get_card',
              'card'
            );
          case 'list_departments':
            return await this.listPaginated(
              token,
              '/departments',
              'list_departments',
              'departments',
              params
            );
          case 'list_locations':
            return await this.listPaginated(
              token,
              '/locations',
              'list_locations',
              'locations',
              params
            );
          case 'list_spend_programs':
            return await this.listPaginated(
              token,
              '/spend-programs',
              'list_spend_programs',
              'spend_programs',
              params
            );
          case 'list_limits':
            return await this.listPaginated(
              token,
              '/limits',
              'list_limits',
              'limits',
              params
            );
          case 'list_reimbursements':
            return await this.listPaginated(
              token,
              '/reimbursements',
              'list_reimbursements',
              'reimbursements',
              params
            );
          case 'list_bills':
            return await this.listPaginated(
              token,
              '/bills',
              'list_bills',
              'bills',
              params
            );
          case 'list_vendors':
            return await this.listPaginated(
              token,
              '/vendors',
              'list_vendors',
              'vendors',
              params
            );
          case 'get_business': {
            const data = await makeRampRequest(token, '/business');
            return {
              operation: 'get_business',
              success: true,
              business: data as RampResult extends { business?: infer B }
                ? B
                : never,
              error: '',
            };
          }
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<RampResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<RampResult, { operation: T['operation'] }>;
    }
  }

  private async listPaginated(
    token: string,
    endpoint: string,
    operation: string,
    dataKey: string,
    params: RampParams
  ): Promise<RampResult> {
    const queryParams: Record<string, string | number | undefined> = {};
    if ('page_size' in params && params.page_size) {
      queryParams.page_size = params.page_size;
    }
    if ('start' in params && params.start) {
      queryParams.start = params.start;
    }
    if ('from_date' in params && params.from_date) {
      queryParams.from_date = params.from_date as string;
    }
    if ('to_date' in params && params.to_date) {
      queryParams.to_date = params.to_date as string;
    }

    const data = await makeRampRequest(token, endpoint, {
      params: queryParams,
    });

    return {
      operation,
      success: true,
      [dataKey]: (data.data ?? []) as unknown[],
      has_more: !!data.page?.next,
      error: '',
    } as unknown as RampResult;
  }

  private async getSingle(
    token: string,
    endpoint: string,
    operation: string,
    dataKey: string
  ): Promise<RampResult> {
    const data = await makeRampRequest(token, endpoint);

    return {
      operation,
      success: true,
      [dataKey]: data,
      error: '',
    } as unknown as RampResult;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.RAMP_CRED];
  }
}
