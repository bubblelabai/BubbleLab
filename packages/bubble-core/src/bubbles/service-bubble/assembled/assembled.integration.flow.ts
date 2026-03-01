import { BubbleFlow } from '../../../bubble-flow/bubble-flow-class.js';
import type { WebhookEvent } from '@bubblelab/shared-schemas';
import { AssembledBubble } from './assembled.js';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
  summary: string;
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * Integration flow that exercises all Assembled bubble operations end-to-end.
 *
 * Tests:
 * 1. list_queues - List all queues
 * 2. list_teams - List all teams
 * 3. list_people - List people with pagination
 * 4. create_person - Create a test person
 * 5. get_person - Get the created person
 * 6. update_person - Update the created person
 * 7. list_activities - List activities in a time window
 * 8. list_time_off - List time off requests
 */
export class AssembledIntegrationFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List queues
    const queuesResult = await new AssembledBubble({
      operation: 'list_queues',
    }).action();
    results.push({
      operation: 'list_queues',
      success: queuesResult.success,
      details: queuesResult.success
        ? `Found ${queuesResult.data?.queues?.length ?? 0} queues`
        : queuesResult.error,
    });

    // 2. List teams
    const teamsResult = await new AssembledBubble({
      operation: 'list_teams',
    }).action();
    results.push({
      operation: 'list_teams',
      success: teamsResult.success,
      details: teamsResult.success
        ? `Found ${teamsResult.data?.teams?.length ?? 0} teams`
        : teamsResult.error,
    });

    // 3. List people
    const listPeopleResult = await new AssembledBubble({
      operation: 'list_people',
      limit: 5,
      offset: 0,
    }).action();
    results.push({
      operation: 'list_people',
      success: listPeopleResult.success,
      details: listPeopleResult.success
        ? `Found ${listPeopleResult.data?.people?.length ?? 0} people`
        : listPeopleResult.error,
    });

    // 4. Create a test person (with edge-case unicode name)
    const testEmail = `bubble-test-${Date.now()}@example.com`;
    const createResult = await new AssembledBubble({
      operation: 'create_person',
      first_name: 'BubbleLab Tëst',
      last_name: "O'Connor-López",
      email: testEmail,
      channels: ['email', 'chat'],
      staffable: true,
    }).action();
    results.push({
      operation: 'create_person',
      success: createResult.success,
      details: createResult.success
        ? `Created person: ${JSON.stringify(createResult.data?.person)}`
        : createResult.error,
    });

    // 5. Get the created person (if create succeeded)
    const personId = (createResult.data?.person as Record<string, unknown>)
      ?.id as string | undefined;
    if (personId) {
      const getResult = await new AssembledBubble({
        operation: 'get_person',
        person_id: personId,
      }).action();
      results.push({
        operation: 'get_person',
        success: getResult.success,
        details: getResult.success
          ? `Retrieved person ID: ${personId}`
          : getResult.error,
      });

      // 6. Update the person
      const updateResult = await new AssembledBubble({
        operation: 'update_person',
        person_id: personId,
        first_name: 'Updated Tëst',
        channels: ['email', 'chat', 'phone'],
      }).action();
      results.push({
        operation: 'update_person',
        success: updateResult.success,
        details: updateResult.success
          ? `Updated person ID: ${personId}`
          : updateResult.error,
      });
    } else {
      results.push({
        operation: 'get_person',
        success: false,
        details: 'Skipped: no person ID from create',
      });
      results.push({
        operation: 'update_person',
        success: false,
        details: 'Skipped: no person ID from create',
      });
    }

    // 7. List activities (last 24 hours)
    const now = Math.floor(Date.now() / 1000);
    const listActivitiesResult = await new AssembledBubble({
      operation: 'list_activities',
      start_time: now - 86400,
      end_time: now,
      include_agents: true,
    }).action();
    results.push({
      operation: 'list_activities',
      success: listActivitiesResult.success,
      details: listActivitiesResult.success
        ? `Found ${Object.keys(listActivitiesResult.data?.activities || {}).length} activities`
        : listActivitiesResult.error,
    });

    // 8. List time off requests
    const listTimeOffResult = await new AssembledBubble({
      operation: 'list_time_off',
      limit: 5,
    }).action();
    results.push({
      operation: 'list_time_off',
      success: listTimeOffResult.success,
      details: listTimeOffResult.success
        ? `Found ${listTimeOffResult.data?.requests?.length ?? 0} time off requests`
        : listTimeOffResult.error,
    });

    const passed = results.filter((r) => r.success).length;
    const total = results.length;

    return {
      testResults: results,
      summary: `${passed}/${total} operations passed`,
    };
  }
}
