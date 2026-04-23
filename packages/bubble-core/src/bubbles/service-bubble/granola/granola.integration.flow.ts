import {
  BubbleFlow,
  GranolaBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  noteId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class GranolaIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List notes
    const listResult = await new GranolaBubble({
      operation: 'list_notes',
      pageSize: 5,
    }).action();

    results.push({
      operation: 'list_notes',
      success: listResult.success,
      details: listResult.success
        ? `Retrieved ${listResult.notes?.length ?? 0} notes, hasMore: ${listResult.hasMore}`
        : listResult.error,
    });

    // 2. List notes with date filter
    const filteredResult = await new GranolaBubble({
      operation: 'list_notes',
      pageSize: 3,
      createdAfter: '2024-01-01T00:00:00.000Z',
    }).action();

    results.push({
      operation: 'list_notes (date filter)',
      success: filteredResult.success,
      details: filteredResult.success
        ? `Retrieved ${filteredResult.notes?.length ?? 0} notes after 2024-01-01`
        : filteredResult.error,
    });

    // 3. Get a specific note (summary only — no transcript by default)
    const firstNoteId = listResult.success
      ? listResult.notes?.[0]?.id
      : undefined;
    const noteId = firstNoteId || '';

    if (firstNoteId) {
      const getResult = await new GranolaBubble({
        operation: 'get_note',
        noteId: firstNoteId,
      }).action();

      results.push({
        operation: 'get_note',
        success: getResult.success,
        details: getResult.success
          ? `Retrieved note: "${getResult.title}" with ${getResult.attendees?.length ?? 0} attendees, notesUrl=${getResult.notesUrl ?? 'null'}`
          : getResult.error,
      });

      // 4. Get same note with transcript section requested
      const transcriptResult = await new GranolaBubble({
        operation: 'get_note',
        noteId: firstNoteId,
        sections: ['summary', 'transcript'],
      }).action();

      results.push({
        operation: 'get_note (with transcript)',
        success: transcriptResult.success,
        details: transcriptResult.success
          ? `Transcript entries: ${transcriptResult.transcript?.length ?? 'null (no transcript available)'}`
          : transcriptResult.error,
      });

      // 5. Sections filter — only attendees
      const attendeesOnly = await new GranolaBubble({
        operation: 'get_note',
        noteId: firstNoteId,
        sections: ['attendees'],
      }).action();

      results.push({
        operation: 'get_note (sections=attendees)',
        success: attendeesOnly.success,
        details: attendeesOnly.success
          ? `attendees=${attendeesOnly.attendees?.length ?? 0}, summaryMarkdown=${attendeesOnly.summaryMarkdown === undefined ? 'excluded ✓' : 'INCLUDED (bug!)'}, transcript=${attendeesOnly.transcript === undefined ? 'excluded ✓' : 'INCLUDED (bug!)'}`
          : attendeesOnly.error,
      });
    } else {
      results.push({
        operation: 'get_note',
        success: false,
        details: 'Skipped - no notes available from list_notes',
      });
    }

    // 6. Test pagination with cursor
    if (listResult.success && listResult.hasMore && listResult.cursor) {
      const paginatedResult = await new GranolaBubble({
        operation: 'list_notes',
        pageSize: 5,
        cursor: listResult.cursor,
      }).action();

      results.push({
        operation: 'list_notes (pagination)',
        success: paginatedResult.success,
        details: paginatedResult.success
          ? `Page 2: ${paginatedResult.notes?.length ?? 0} notes`
          : paginatedResult.error,
      });
    }

    // 7. Test error handling - invalid note ID
    const invalidResult = await new GranolaBubble({
      operation: 'get_note',
      noteId: 'not_INVALID000000',
    }).action();

    results.push({
      operation: 'get_note (invalid ID)',
      success: !invalidResult.success,
      details: !invalidResult.success
        ? `Correctly returned error: ${invalidResult.error}`
        : 'Unexpectedly succeeded with invalid ID',
    });

    return {
      noteId,
      testResults: results,
    };
  }
}
