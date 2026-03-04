import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { RampBubble } from './ramp.js';

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

export class RampIntegrationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. Test get_business - simplest operation to verify connectivity
    try {
      const businessResult = await new RampBubble({
        operation: 'get_business',
      }).action();

      results.push({
        operation: 'get_business',
        success: businessResult.success,
        details: businessResult.success
          ? `Business: ${(businessResult as any).business?.business_name_legal || 'unknown'}`
          : businessResult.error,
      });
    } catch (e) {
      results.push({
        operation: 'get_business',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 2. Test list_departments
    try {
      const deptResult = await new RampBubble({
        operation: 'list_departments',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_departments',
        success: deptResult.success,
        details: deptResult.success
          ? `Found ${(deptResult as any).data?.length || 0} departments`
          : deptResult.error,
      });
    } catch (e) {
      results.push({
        operation: 'list_departments',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 3. Test list_users
    try {
      const usersResult = await new RampBubble({
        operation: 'list_users',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_users',
        success: usersResult.success,
        details: usersResult.success
          ? `Found ${(usersResult as any).data?.length || 0} users`
          : usersResult.error,
      });

      // 4. Test get_user with first user if available
      const users = (usersResult as any).data;
      if (usersResult.success && users?.length > 0) {
        const getUserResult = await new RampBubble({
          operation: 'get_user',
          user_id: users[0].id,
        }).action();

        results.push({
          operation: 'get_user',
          success: getUserResult.success,
          details: getUserResult.success
            ? `User: ${(getUserResult as any).user?.email || users[0].id}`
            : getUserResult.error,
        });
      }
    } catch (e) {
      results.push({
        operation: 'list_users',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 5. Test list_cards
    try {
      const cardsResult = await new RampBubble({
        operation: 'list_cards',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_cards',
        success: cardsResult.success,
        details: cardsResult.success
          ? `Found ${(cardsResult as any).data?.length || 0} cards`
          : cardsResult.error,
      });

      // 6. Test get_card with first card if available
      const cards = (cardsResult as any).data;
      if (cardsResult.success && cards?.length > 0) {
        const getCardResult = await new RampBubble({
          operation: 'get_card',
          card_id: cards[0].id,
        }).action();

        results.push({
          operation: 'get_card',
          success: getCardResult.success,
          details: getCardResult.success
            ? `Card: ${(getCardResult as any).card?.display_name || cards[0].id}`
            : getCardResult.error,
        });
      }
    } catch (e) {
      results.push({
        operation: 'list_cards',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 7. Test list_transactions
    try {
      const txResult = await new RampBubble({
        operation: 'list_transactions',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_transactions',
        success: txResult.success,
        details: txResult.success
          ? `Found ${(txResult as any).data?.length || 0} transactions`
          : txResult.error,
      });

      // 8. Test get_transaction with first transaction if available
      const txns = (txResult as any).data;
      if (txResult.success && txns?.length > 0) {
        const getTxResult = await new RampBubble({
          operation: 'get_transaction',
          transaction_id: txns[0].id,
        }).action();

        results.push({
          operation: 'get_transaction',
          success: getTxResult.success,
          details: getTxResult.success
            ? `Transaction: ${(getTxResult as any).transaction?.merchant_name || txns[0].id}`
            : getTxResult.error,
        });
      }
    } catch (e) {
      results.push({
        operation: 'list_transactions',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 9. Test list_reimbursements
    try {
      const reimbResult = await new RampBubble({
        operation: 'list_reimbursements',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_reimbursements',
        success: reimbResult.success,
        details: reimbResult.success
          ? `Found ${(reimbResult as any).data?.length || 0} reimbursements`
          : reimbResult.error,
      });
    } catch (e) {
      results.push({
        operation: 'list_reimbursements',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 10. Test list_vendors
    try {
      const vendorsResult = await new RampBubble({
        operation: 'list_vendors',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_vendors',
        success: vendorsResult.success,
        details: vendorsResult.success
          ? `Found ${(vendorsResult as any).data?.length || 0} vendors`
          : vendorsResult.error,
      });
    } catch (e) {
      results.push({
        operation: 'list_vendors',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    // 11. Test list_statements
    try {
      const statementsResult = await new RampBubble({
        operation: 'list_statements',
        page_size: 5,
      }).action();

      results.push({
        operation: 'list_statements',
        success: statementsResult.success,
        details: statementsResult.success
          ? `Found ${(statementsResult as any).data?.length || 0} statements`
          : statementsResult.error,
      });
    } catch (e) {
      results.push({
        operation: 'list_statements',
        success: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }

    return { testResults: results };
  }
}
