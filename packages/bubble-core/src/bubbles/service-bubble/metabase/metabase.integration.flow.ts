import {
  BubbleFlow,
  MetabaseBubble,
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
 * Integration flow test for MetabaseBubble.
 * Exercises all operations end-to-end against a real Metabase instance.
 */
export class MetabaseIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List dashboards
    const listResult = await new MetabaseBubble({
      operation: 'list_dashboards',
    }).action();

    results.push({
      operation: 'list_dashboards',
      success: listResult.success,
      details: listResult.success
        ? `Found ${listResult.data?.total ?? 0} dashboards`
        : listResult.error,
    });

    // 2. Get a specific dashboard (use first from list, or ID 1)
    const dashboardId =
      listResult.success && listResult.data?.dashboards?.[0]?.id
        ? listResult.data.dashboards[0].id
        : 1;

    const getDashResult = await new MetabaseBubble({
      operation: 'get_dashboard',
      dashboard_id: dashboardId,
    }).action();

    results.push({
      operation: 'get_dashboard',
      success: getDashResult.success,
      details: getDashResult.success
        ? `Dashboard: "${getDashResult.data?.name}", ${getDashResult.data?.dashcards?.length ?? 0} dashcards`
        : getDashResult.error,
    });

    // 3. Get a card from the dashboard (use first dashcard's card_id, or ID 1)
    const cardId =
      getDashResult.success && getDashResult.data?.dashcards?.[0]?.card_id
        ? getDashResult.data.dashcards[0].card_id
        : 1;

    const getCardResult = await new MetabaseBubble({
      operation: 'get_card',
      card_id: cardId,
    }).action();

    results.push({
      operation: 'get_card',
      success: getCardResult.success,
      details: getCardResult.success
        ? `Card: "${getCardResult.data?.name}", display: ${getCardResult.data?.display}`
        : getCardResult.error,
    });

    // 4. Query the card
    const queryResult = await new MetabaseBubble({
      operation: 'query_card',
      card_id: cardId,
    }).action();

    results.push({
      operation: 'query_card',
      success: queryResult.success,
      details: queryResult.success
        ? `Returned ${queryResult.data?.data?.rows?.length ?? 0} rows, ${queryResult.data?.data?.cols?.length ?? 0} columns`
        : queryResult.error,
    });

    // 5. Test error handling — get dashboard with invalid ID
    const invalidDashResult = await new MetabaseBubble({
      operation: 'get_dashboard',
      dashboard_id: 999999999,
    }).action();

    results.push({
      operation: 'get_dashboard (invalid ID)',
      success: !invalidDashResult.success, // Expected to fail
      details: !invalidDashResult.success
        ? `Correctly returned error: ${invalidDashResult.error}`
        : 'ERROR: Should have failed but succeeded',
    });

    // 6. Test error handling — query card with invalid ID
    const invalidQueryResult = await new MetabaseBubble({
      operation: 'query_card',
      card_id: 999999999,
    }).action();

    results.push({
      operation: 'query_card (invalid ID)',
      success: !invalidQueryResult.success, // Expected to fail
      details: !invalidQueryResult.success
        ? `Correctly returned error: ${invalidQueryResult.error}`
        : 'ERROR: Should have failed but succeeded',
    });

    return { testResults: results };
  }
}
