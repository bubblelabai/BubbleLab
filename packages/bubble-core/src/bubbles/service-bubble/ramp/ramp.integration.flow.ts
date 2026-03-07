import {
  BubbleFlow,
  RampBubble,
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

export class RampIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. Test get_business
    const businessResult = await new RampBubble({
      operation: 'get_business',
    }).action();

    results.push({
      operation: 'get_business',
      success: businessResult.success,
      details: businessResult.success
        ? `Business: ${JSON.stringify(businessResult.data?.business)}`
        : businessResult.error,
    });

    // 2. Test list_transactions
    const txResult = await new RampBubble({
      operation: 'list_transactions',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_transactions',
      success: txResult.success,
      details: txResult.success
        ? `Found ${txResult.data?.transactions?.length ?? 0} transactions`
        : txResult.error,
    });

    // 3. Test get_transaction (if we have one)
    if (txResult.success && txResult.data?.transactions?.[0]?.id) {
      const txId = txResult.data.transactions[0].id;
      const singleTxResult = await new RampBubble({
        operation: 'get_transaction',
        transaction_id: txId,
      }).action();

      results.push({
        operation: 'get_transaction',
        success: singleTxResult.success,
        details: singleTxResult.success
          ? `Transaction: ${singleTxResult.data?.transaction?.merchant_name ?? 'N/A'}`
          : singleTxResult.error,
      });
    }

    // 4. Test list_users
    const usersResult = await new RampBubble({
      operation: 'list_users',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_users',
      success: usersResult.success,
      details: usersResult.success
        ? `Found ${usersResult.data?.users?.length ?? 0} users`
        : usersResult.error,
    });

    // 5. Test get_user (if we have one)
    if (usersResult.success && usersResult.data?.users?.[0]?.id) {
      const userId = usersResult.data.users[0].id;
      const singleUserResult = await new RampBubble({
        operation: 'get_user',
        user_id: userId,
      }).action();

      results.push({
        operation: 'get_user',
        success: singleUserResult.success,
        details: singleUserResult.success
          ? `User: ${singleUserResult.data?.user?.first_name} ${singleUserResult.data?.user?.last_name}`
          : singleUserResult.error,
      });
    }

    // 6. Test list_cards
    const cardsResult = await new RampBubble({
      operation: 'list_cards',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_cards',
      success: cardsResult.success,
      details: cardsResult.success
        ? `Found ${cardsResult.data?.cards?.length ?? 0} cards`
        : cardsResult.error,
    });

    // 7. Test list_departments
    const deptsResult = await new RampBubble({
      operation: 'list_departments',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_departments',
      success: deptsResult.success,
      details: deptsResult.success
        ? `Found ${deptsResult.data?.departments?.length ?? 0} departments`
        : deptsResult.error,
    });

    // 8. Test list_locations
    const locsResult = await new RampBubble({
      operation: 'list_locations',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_locations',
      success: locsResult.success,
      details: locsResult.success
        ? `Found ${locsResult.data?.locations?.length ?? 0} locations`
        : locsResult.error,
    });

    // 9. Test list_spend_programs
    const spResult = await new RampBubble({
      operation: 'list_spend_programs',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_spend_programs',
      success: spResult.success,
      details: spResult.success
        ? `Found ${spResult.data?.spend_programs?.length ?? 0} spend programs`
        : spResult.error,
    });

    // 10. Test list_limits
    const limitsResult = await new RampBubble({
      operation: 'list_limits',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_limits',
      success: limitsResult.success,
      details: limitsResult.success
        ? `Found ${limitsResult.data?.limits?.length ?? 0} limits`
        : limitsResult.error,
    });

    // 11. Test list_reimbursements
    const reimbResult = await new RampBubble({
      operation: 'list_reimbursements',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_reimbursements',
      success: reimbResult.success,
      details: reimbResult.success
        ? `Found ${reimbResult.data?.reimbursements?.length ?? 0} reimbursements`
        : reimbResult.error,
    });

    // 12. Test list_bills
    const billsResult = await new RampBubble({
      operation: 'list_bills',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_bills',
      success: billsResult.success,
      details: billsResult.success
        ? `Found ${billsResult.data?.bills?.length ?? 0} bills`
        : billsResult.error,
    });

    // 13. Test list_vendors
    const vendorsResult = await new RampBubble({
      operation: 'list_vendors',
      page_size: 5,
    }).action();

    results.push({
      operation: 'list_vendors',
      success: vendorsResult.success,
      details: vendorsResult.success
        ? `Found ${vendorsResult.data?.vendors?.length ?? 0} vendors`
        : vendorsResult.error,
    });

    return { testResults: results };
  }
}
