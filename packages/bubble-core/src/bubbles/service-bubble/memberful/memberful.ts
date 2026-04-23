import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  MemberfulParamsSchema,
  MemberfulResultSchema,
  type MemberfulParams,
  type MemberfulParamsInput,
  type MemberfulResult,
} from './memberful.schema.js';
import {
  parseMemberfulCredential,
  memberfulEndpoint,
  enhanceMemberfulErrorMessage,
  type MemberfulCredentials,
} from './memberful.utils.js';

// Common GraphQL fragments reused across queries.
// Field list matches Memberful's real schema (verified via introspection):
//   - Member has no firstName/lastName, only fullName
//   - Plan has "label" not "name"; no currency field; uses priceCents
//   - Order has "uuid" not "id"; no "number" field
//   - Connections do NOT expose totalCount
const MEMBER_FIELDS = `
  id
  email
  fullName
  username
  phoneNumber
  totalSpendCents
  totalOrders
  unrestrictedAccess
  subscriptions {
    id
    active
    autorenew
    pastDue
    expiresAt
    createdAt
    activatedAt
    plan {
      id
      label
      slug
      priceCents
      intervalCount
      intervalUnit
      type
    }
  }
`;

const SUBSCRIPTION_FIELDS = `
  id
  active
  autorenew
  pastDue
  expiresAt
  createdAt
  activatedAt
  member {
    id
    email
    fullName
  }
  plan {
    id
    label
    slug
    priceCents
    intervalCount
    intervalUnit
    type
  }
`;

const PLAN_FIELDS = `
  id
  label
  slug
  priceCents
  intervalCount
  intervalUnit
  type
  forSale
`;

const ORDER_FIELDS = `
  uuid
  totalCents
  currency
  status
  type
  taxAmountCents
  couponDiscountAmountCents
  createdAt
`;

/**
 * Memberful Service Bubble
 *
 * Read-first integration with Memberful's admin GraphQL API for members,
 * subscriptions, plans, and orders. Uses site-wide API key auth.
 */
export class MemberfulBubble<
  T extends MemberfulParamsInput = MemberfulParamsInput,
> extends ServiceBubble<
  T,
  Extract<MemberfulResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'memberful';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'memberful';
  static readonly schema = MemberfulParamsSchema;
  static readonly resultSchema = MemberfulResultSchema;
  static readonly shortDescription =
    'Memberful integration for members, subscriptions, plans, and orders';
  static readonly longDescription = `
    Memberful service integration for membership site management.

    Operations:
    - list_members: paginated list of all members, optional search query
    - get_member: fetch one member by ID or email
    - list_subscriptions: paginated list of subscriptions across the site
    - list_plans: all membership plans
    - list_orders: paginated order history
    - raw_query: escape hatch to run any GraphQL query/mutation

    Uses site-wide API key auth (Custom Application in Memberful dashboard).
  `;
  static readonly alias = 'memberful';

  constructor(
    params: T = {
      operation: 'list_plans',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const creds = this.getCredentials();
    if (!creds) return false;
    // list_plans is the cheapest query — no pagination, small response
    await this.graphql(creds, `query { plans { ${PLAN_FIELDS} } }`);
    return true;
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    if (!credentials || typeof credentials !== 'object') return undefined;
    return credentials[CredentialType.MEMBERFUL_CRED];
  }

  private getCredentials(): MemberfulCredentials | undefined {
    const rawCredential = this.chooseCredential();
    if (!rawCredential) return undefined;
    return parseMemberfulCredential(rawCredential);
  }

  protected async performAction(
    _context?: BubbleContext
  ): Promise<Extract<MemberfulResult, { operation: T['operation'] }>> {
    const { operation } = this.params;

    try {
      const result = await (async (): Promise<MemberfulResult> => {
        const p = this.params as MemberfulParams;

        switch (p.operation) {
          case 'list_members':
            return await this.listMembers(p.first, p.after, p.state);
          case 'get_member':
            return await this.getMember(p.id, p.email);
          case 'list_subscriptions':
            return await this.listSubscriptions(p.first, p.after);
          case 'list_plans':
            return await this.listPlans();
          case 'list_orders':
            return await this.listOrders(p.first, p.after);
          case 'raw_query':
            return await this.rawQuery(p.query, p.variables);
          default: {
            const _exhaustive: never = p;
            void _exhaustive;
            throw new Error(`Unsupported operation: ${operation}`);
          }
        }
      })();

      return result as Extract<MemberfulResult, { operation: T['operation'] }>;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        operation,
        success: false,
        error: errorMessage,
      } as Extract<MemberfulResult, { operation: T['operation'] }>;
    }
  }

  // ---------------------------------------------------------------------------
  // Operation implementations
  // ---------------------------------------------------------------------------

  private async listMembers(
    first: number,
    after?: string,
    state?: 'active' | 'inactive'
  ): Promise<Extract<MemberfulResult, { operation: 'list_members' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'list_members',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    // Build query + variables conditionally so $state is only declared when
    // provided. Memberful's MemberState enum is UPPERCASE (ACTIVE/INACTIVE).
    const hasState = state === 'active' || state === 'inactive';
    const gql = hasState
      ? `
      query ListMembers($first: Int, $after: String, $state: MemberState) {
        members(first: $first, after: $after, state: $state) {
          pageInfo { endCursor hasNextPage }
          edges { node { ${MEMBER_FIELDS} } }
        }
      }`
      : `
      query ListMembers($first: Int, $after: String) {
        members(first: $first, after: $after) {
          pageInfo { endCursor hasNextPage }
          edges { node { ${MEMBER_FIELDS} } }
        }
      }`;
    const variables: Record<string, unknown> = { first };
    if (after !== undefined) variables.after = after;
    if (hasState) variables.state = state!.toUpperCase();
    const result = (await this.graphql(creds, gql, variables)) as {
      members?: {
        pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
        edges?: { node: Record<string, unknown> }[];
      };
    };

    const edges = result.members?.edges ?? [];
    return {
      operation: 'list_members',
      success: true,
      error: '',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        members: edges.map((e) => e.node) as any[],
        pageInfo: result.members?.pageInfo,
      },
    };
  }

  private async getMember(
    id?: string,
    email?: string
  ): Promise<Extract<MemberfulResult, { operation: 'get_member' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'get_member',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    if (!id && !email) {
      return {
        operation: 'get_member',
        success: false,
        error: 'get_member requires either id or email',
      };
    }

    if (id) {
      const gql = `
        query GetMember($id: ID!) {
          member(id: $id) { ${MEMBER_FIELDS} }
        }
      `;
      const result = (await this.graphql(creds, gql, { id })) as {
        member?: Record<string, unknown> | null;
      };
      if (!result.member) {
        return {
          operation: 'get_member',
          success: false,
          error: `No member found with id ${id}`,
        };
      }
      return {
        operation: 'get_member',
        success: true,
        error: '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: result.member as any,
      };
    }

    // Email lookup uses Memberful's dedicated memberByEmail(email:) query.
    const gql = `
      query FindMemberByEmail($email: String!) {
        memberByEmail(email: $email) { ${MEMBER_FIELDS} }
      }
    `;
    const result = (await this.graphql(creds, gql, { email })) as {
      memberByEmail?: Record<string, unknown> | null;
    };
    if (!result.memberByEmail) {
      return {
        operation: 'get_member',
        success: false,
        error: `No member found with email ${email}`,
      };
    }
    return {
      operation: 'get_member',
      success: true,
      error: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: result.memberByEmail as any,
    };
  }

  private async listSubscriptions(
    first: number,
    after?: string
  ): Promise<Extract<MemberfulResult, { operation: 'list_subscriptions' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'list_subscriptions',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    const gql = `
      query ListSubscriptions($first: Int, $after: String) {
        subscriptions(first: $first, after: $after) {
          pageInfo { endCursor hasNextPage }
          edges { node { ${SUBSCRIPTION_FIELDS} } }
        }
      }
    `;
    const result = (await this.graphql(creds, gql, { first, after })) as {
      subscriptions?: {
        pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
        edges?: { node: Record<string, unknown> }[];
      };
    };
    const edges = result.subscriptions?.edges ?? [];
    return {
      operation: 'list_subscriptions',
      success: true,
      error: '',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subscriptions: edges.map((e) => e.node) as any[],
        pageInfo: result.subscriptions?.pageInfo,
      },
    };
  }

  private async listPlans(): Promise<
    Extract<MemberfulResult, { operation: 'list_plans' }>
  > {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'list_plans',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    const gql = `query { plans { ${PLAN_FIELDS} } }`;
    const result = (await this.graphql(creds, gql)) as {
      plans?: Record<string, unknown>[];
    };
    return {
      operation: 'list_plans',
      success: true,
      error: '',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plans: (result.plans ?? []) as any[],
      },
    };
  }

  private async listOrders(
    first: number,
    after?: string
  ): Promise<Extract<MemberfulResult, { operation: 'list_orders' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'list_orders',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    const gql = `
      query ListOrders($first: Int, $after: String) {
        orders(first: $first, after: $after) {
          pageInfo { endCursor hasNextPage }
          edges { node { ${ORDER_FIELDS} } }
        }
      }
    `;
    const result = (await this.graphql(creds, gql, { first, after })) as {
      orders?: {
        pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
        edges?: { node: Record<string, unknown> }[];
      };
    };
    const edges = result.orders?.edges ?? [];
    return {
      operation: 'list_orders',
      success: true,
      error: '',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders: edges.map((e) => e.node) as any[],
        pageInfo: result.orders?.pageInfo,
      },
    };
  }

  private async rawQuery(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<Extract<MemberfulResult, { operation: 'raw_query' }>> {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        operation: 'raw_query',
        success: false,
        error: 'Memberful credentials are required',
      };
    }

    const data = await this.graphql(creds, query, variables);
    return {
      operation: 'raw_query',
      success: true,
      error: '',
      data,
    };
  }

  // ---------------------------------------------------------------------------
  // GraphQL transport
  // ---------------------------------------------------------------------------

  private async graphql(
    creds: MemberfulCredentials,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(memberfulEndpoint(creds), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const message = `Memberful API error (${response.status}): ${body || response.statusText}`;
      throw new Error(enhanceMemberfulErrorMessage(message, response.status));
    }

    const json = (await response.json()) as {
      data?: unknown;
      errors?: { message?: string }[];
    };
    if (json.errors && json.errors.length > 0) {
      const message = json.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join('; ');
      throw new Error(`Memberful GraphQL error: ${message}`);
    }
    return json.data;
  }
}
