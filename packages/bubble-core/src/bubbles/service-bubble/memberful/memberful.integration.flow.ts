import {
  BubbleFlow,
  MemberfulBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * Integration flow test for MemberfulBubble.
 * Exercises all six operations end-to-end against a real Memberful site.
 */
export class MemberfulIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. list_plans — cheapest call, good first check
    const plansResult = await new MemberfulBubble({
      operation: 'list_plans',
    }).action();
    results.push({
      operation: 'list_plans',
      success: plansResult.success,
      details: plansResult.success
        ? `Found ${plansResult.data?.plans?.length ?? 0} plans`
        : plansResult.error,
    });

    // 2. list_members (small page)
    const membersResult = await new MemberfulBubble({
      operation: 'list_members',
      first: 5,
    }).action();
    results.push({
      operation: 'list_members',
      success: membersResult.success,
      details: membersResult.success
        ? `Found ${membersResult.data?.totalCount ?? 0} members (first page: ${membersResult.data?.members?.length ?? 0})`
        : membersResult.error,
    });

    // 3. get_member by ID — use first member from list if any
    const firstMemberId = membersResult.success
      ? membersResult.data?.members?.[0]?.id
      : undefined;
    if (firstMemberId) {
      const getMemberResult = await new MemberfulBubble({
        operation: 'get_member',
        id: firstMemberId,
      }).action();
      results.push({
        operation: 'get_member (by id)',
        success: getMemberResult.success,
        details: getMemberResult.success
          ? `Member: ${getMemberResult.data?.email ?? '(no email)'} — ${getMemberResult.data?.fullName ?? ''}`
          : getMemberResult.error,
      });

      // 4. get_member by email (round-trip)
      const firstEmail = membersResult.data?.members?.[0]?.email;
      if (firstEmail) {
        const byEmailResult = await new MemberfulBubble({
          operation: 'get_member',
          email: firstEmail,
        }).action();
        results.push({
          operation: 'get_member (by email)',
          success: byEmailResult.success,
          details: byEmailResult.success
            ? `Email lookup returned member id ${byEmailResult.data?.id}`
            : byEmailResult.error,
        });
      }
    } else {
      results.push({
        operation: 'get_member (by id)',
        success: false,
        details: 'Skipped — no members on site to look up',
      });
    }

    // 5. list_subscriptions
    const subsResult = await new MemberfulBubble({
      operation: 'list_subscriptions',
      first: 5,
    }).action();
    results.push({
      operation: 'list_subscriptions',
      success: subsResult.success,
      details: subsResult.success
        ? `Found ${subsResult.data?.totalCount ?? 0} subscriptions`
        : subsResult.error,
    });

    // 6. list_orders
    const ordersResult = await new MemberfulBubble({
      operation: 'list_orders',
      first: 5,
    }).action();
    results.push({
      operation: 'list_orders',
      success: ordersResult.success,
      details: ordersResult.success
        ? `Found ${ordersResult.data?.totalCount ?? 0} orders`
        : ordersResult.error,
    });

    // 7. raw_query — use a known-good tiny query
    const rawResult = await new MemberfulBubble({
      operation: 'raw_query',
      query: 'query { plans { id name } }',
    }).action();
    results.push({
      operation: 'raw_query',
      success: rawResult.success,
      details: rawResult.success
        ? `Raw query returned: ${JSON.stringify(rawResult.data).slice(0, 100)}`
        : rawResult.error,
    });

    // 8. Error handling — get_member with a nonexistent ID
    const missingResult = await new MemberfulBubble({
      operation: 'get_member',
      id: '999999999999',
    }).action();
    results.push({
      operation: 'get_member (missing id)',
      success: !missingResult.success,
      details: !missingResult.success
        ? `Correctly returned error: ${missingResult.error}`
        : 'ERROR: Should have failed but succeeded',
    });

    return { testResults: results };
  }
}
