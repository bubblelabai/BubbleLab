import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { LookerBubble } from './looker.js';

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
 * Integration flow test for the Looker bubble.
 * Exercises all operations: list_models, list_explores, run_inline_query,
 * list_looks, get_look, list_dashboards, get_dashboard.
 */
export class LookerIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List all LookML models
    const modelsResult = await new LookerBubble({
      operation: 'list_models',
      instance_url: '',
    }).action();

    results.push({
      operation: 'list_models',
      success: modelsResult.success,
      details: modelsResult.success
        ? `Found ${modelsResult.models?.length ?? 0} models`
        : modelsResult.error,
    });

    // 2. List explores in the first model found
    if (
      modelsResult.success &&
      modelsResult.models &&
      modelsResult.models.length > 0
    ) {
      const modelName = modelsResult.models[0].name;

      const exploresResult = await new LookerBubble({
        operation: 'list_explores',
        instance_url: '',
        model: modelName,
      }).action();

      results.push({
        operation: 'list_explores',
        success: exploresResult.success,
        details: exploresResult.success
          ? `Found ${exploresResult.explores?.length ?? 0} explores in model "${modelName}"`
          : exploresResult.error,
      });

      // 3. Run inline query on the first explore if available
      if (
        exploresResult.success &&
        exploresResult.explores &&
        exploresResult.explores.length > 0
      ) {
        const explore = exploresResult.explores[0];
        const firstDimension =
          explore.fields?.dimensions?.[0]?.name ?? `${explore.name}.id`;

        const queryResult = await new LookerBubble({
          operation: 'run_inline_query',
          instance_url: '',
          model: modelName,
          explore: explore.name,
          fields: [firstDimension],
          limit: 5,
        }).action();

        results.push({
          operation: 'run_inline_query',
          success: queryResult.success,
          details: queryResult.success
            ? `Query returned ${queryResult.rowCount} rows`
            : queryResult.error,
        });
      } else {
        results.push({
          operation: 'run_inline_query',
          success: false,
          details: 'Skipped — no explores found to query',
        });
      }
    } else {
      results.push({
        operation: 'list_explores',
        success: false,
        details: 'Skipped — no models found',
      });
      results.push({
        operation: 'run_inline_query',
        success: false,
        details: 'Skipped — no models found',
      });
    }

    // 4. List saved Looks
    const looksResult = await new LookerBubble({
      operation: 'list_looks',
      instance_url: '',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_looks',
      success: looksResult.success,
      details: looksResult.success
        ? `Found ${looksResult.totalCount} looks`
        : looksResult.error,
    });

    // 5. Get a specific Look if available
    if (
      looksResult.success &&
      looksResult.looks &&
      looksResult.looks.length > 0
    ) {
      const lookId = looksResult.looks[0].id;

      const getLookResult = await new LookerBubble({
        operation: 'get_look',
        instance_url: '',
        look_id: lookId,
        limit: 5,
      }).action();

      results.push({
        operation: 'get_look',
        success: getLookResult.success,
        details: getLookResult.success
          ? `Retrieved look "${getLookResult.look?.title}" with ${getLookResult.rowCount} rows`
          : getLookResult.error,
      });
    } else {
      results.push({
        operation: 'get_look',
        success: false,
        details: 'Skipped — no saved Looks found',
      });
    }

    // 6. List dashboards
    const dashboardsResult = await new LookerBubble({
      operation: 'list_dashboards',
      instance_url: '',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_dashboards',
      success: dashboardsResult.success,
      details: dashboardsResult.success
        ? `Found ${dashboardsResult.totalCount} dashboards`
        : dashboardsResult.error,
    });

    // 7. Get a specific dashboard if available
    if (
      dashboardsResult.success &&
      dashboardsResult.dashboards &&
      dashboardsResult.dashboards.length > 0
    ) {
      const dashId = dashboardsResult.dashboards[0].id;

      const getDashResult = await new LookerBubble({
        operation: 'get_dashboard',
        instance_url: '',
        dashboard_id: dashId,
      }).action();

      results.push({
        operation: 'get_dashboard',
        success: getDashResult.success,
        details: getDashResult.success
          ? `Retrieved dashboard "${getDashResult.dashboard?.title}" with ${getDashResult.dashboard?.dashboard_elements?.length ?? 0} tiles`
          : getDashResult.error,
      });
    } else {
      results.push({
        operation: 'get_dashboard',
        success: false,
        details: 'Skipped — no dashboards found',
      });
    }

    return { testResults: results };
  }
}
