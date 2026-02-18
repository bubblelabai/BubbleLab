import {
  BubbleFlow,
  AttioBubble,
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

export class AttioIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List records (people)
    const listResult = await new AttioBubble({
      operation: 'list_records',
      object: 'people',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_records',
      success: listResult.success,
      details: listResult.success
        ? `Listed ${listResult.data?.length || 0} people records`
        : listResult.error,
    });

    // 2. Create a record
    const createResult = await new AttioBubble({
      operation: 'create_record',
      object: 'people',
      values: {
        name: [{ first_name: 'Test', last_name: `Integration ${Date.now()}` }],
      },
    }).action();

    results.push({
      operation: 'create_record',
      success: createResult.success,
      details: createResult.success
        ? `Created record: ${JSON.stringify(createResult.data?.id || 'unknown')}`
        : createResult.error,
    });

    const recordId =
      createResult.success && createResult.data
        ? (
            (createResult.data as Record<string, unknown>).id as {
              record_id: string;
            }
          )?.record_id
        : undefined;

    if (recordId) {
      // 3. Get the created record
      const getResult = await new AttioBubble({
        operation: 'get_record',
        object: 'people',
        record_id: recordId,
      }).action();

      results.push({
        operation: 'get_record',
        success: getResult.success,
        details: getResult.success
          ? `Retrieved record ${recordId}`
          : getResult.error,
      });

      // 4. Update the record
      const updateResult = await new AttioBubble({
        operation: 'update_record',
        object: 'people',
        record_id: recordId,
        values: {
          name: [
            {
              first_name: 'Updated',
              last_name: `Integration ${Date.now()}`,
            },
          ],
        },
      }).action();

      results.push({
        operation: 'update_record',
        success: updateResult.success,
        details: updateResult.success
          ? `Updated record ${recordId}`
          : updateResult.error,
      });

      // 5. Create a note on the record
      const noteResult = await new AttioBubble({
        operation: 'create_note',
        parent_object: 'people',
        parent_record_id: recordId,
        title: 'Integration Test Note',
        content: `Test note created at ${new Date().toISOString()}`,
      }).action();

      results.push({
        operation: 'create_note',
        success: noteResult.success,
        details: noteResult.success
          ? `Created note on record ${recordId}`
          : noteResult.error,
      });

      // 6. Delete the record (cleanup)
      const deleteResult = await new AttioBubble({
        operation: 'delete_record',
        object: 'people',
        record_id: recordId,
      }).action();

      results.push({
        operation: 'delete_record',
        success: deleteResult.success,
        details: deleteResult.success
          ? `Deleted record ${recordId}`
          : deleteResult.error,
      });
    }

    // 7. List notes
    const listNotesResult = await new AttioBubble({
      operation: 'list_notes',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_notes',
      success: listNotesResult.success,
      details: listNotesResult.success
        ? `Listed ${listNotesResult.data?.length || 0} notes`
        : listNotesResult.error,
    });

    // 8. Create a task
    const taskResult = await new AttioBubble({
      operation: 'create_task',
      content: `Integration test task ${Date.now()}`,
      deadline_at: new Date(Date.now() + 86400000).toISOString(),
    }).action();

    results.push({
      operation: 'create_task',
      success: taskResult.success,
      details: taskResult.success ? `Created task` : taskResult.error,
    });

    // 9. List tasks
    const listTasksResult = await new AttioBubble({
      operation: 'list_tasks',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_tasks',
      success: listTasksResult.success,
      details: listTasksResult.success
        ? `Listed ${listTasksResult.data?.length || 0} tasks`
        : listTasksResult.error,
    });

    // 10. List lists
    const listListsResult = await new AttioBubble({
      operation: 'list_lists',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_lists',
      success: listListsResult.success,
      details: listListsResult.success
        ? `Listed ${listListsResult.data?.length || 0} lists`
        : listListsResult.error,
    });

    // Cleanup: delete the task if created
    if (taskResult.success && taskResult.data) {
      const taskId = (taskResult.data as Record<string, unknown>).id as string;
      if (taskId) {
        const deleteTaskResult = await new AttioBubble({
          operation: 'delete_task',
          task_id: taskId,
        }).action();

        results.push({
          operation: 'delete_task',
          success: deleteTaskResult.success,
          details: deleteTaskResult.success
            ? `Deleted task ${taskId}`
            : deleteTaskResult.error,
        });
      }
    }

    return { testResults: results };
  }
}
