import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { PosthogBubble } from './posthog.js';

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
 * Integration test flow for PostHog bubble.
 * Exercises all 4 operations: list_events, query (HogQL), get_person, get_insight.
 */
export class PosthogIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // Use a test project ID - this would be provided via payload or env in real usage
    const projectId =
      (payload.body as Record<string, string>)?.project_id || '1';

    // 1. Test list_events operation
    const listEventsResult = await new PosthogBubble({
      operation: 'list_events',
      project_id: projectId,
      limit: 5,
    }).action();

    results.push({
      operation: 'list_events',
      success: listEventsResult.success,
      details: listEventsResult.success
        ? `Retrieved ${listEventsResult.events?.length ?? 0} events`
        : listEventsResult.error,
    });

    // 2. Test HogQL query operation
    const queryResult = await new PosthogBubble({
      operation: 'query',
      project_id: projectId,
      query:
        'SELECT event, count() as cnt FROM events GROUP BY event ORDER BY cnt DESC LIMIT 5',
    }).action();

    results.push({
      operation: 'query',
      success: queryResult.success,
      details: queryResult.success
        ? `Query returned ${queryResult.results?.length ?? 0} rows with columns: ${queryResult.columns?.join(', ') ?? 'none'}`
        : queryResult.error,
    });

    // 3. Test get_person operation with search
    const getPersonResult = await new PosthogBubble({
      operation: 'get_person',
      project_id: projectId,
      limit: 3,
    }).action();

    results.push({
      operation: 'get_person',
      success: getPersonResult.success,
      details: getPersonResult.success
        ? `Found ${getPersonResult.persons?.length ?? 0} persons`
        : getPersonResult.error,
    });

    // 4. Test get_insight operation (using ID 1 as a test)
    const getInsightResult = await new PosthogBubble({
      operation: 'get_insight',
      project_id: projectId,
      insight_id: 1,
    }).action();

    results.push({
      operation: 'get_insight',
      success: getInsightResult.success,
      details: getInsightResult.success
        ? `Retrieved insight: ${getInsightResult.insight?.name ?? 'unnamed'}`
        : getInsightResult.error,
    });

    return {
      testResults: results,
    };
  }
}
