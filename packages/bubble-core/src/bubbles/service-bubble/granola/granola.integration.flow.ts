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
      page_size: 5,
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
      page_size: 3,
      created_after: '2024-01-01',
    }).action();

    results.push({
      operation: 'list_notes (date filter)',
      success: filteredResult.success,
      details: filteredResult.success
        ? `Retrieved ${filteredResult.notes?.length ?? 0} notes after 2024-01-01`
        : filteredResult.error,
    });

    // 3. Get a specific note (use the first note from list if available)
    const firstNoteId = listResult.success
      ? listResult.notes?.[0]?.id
      : undefined;
    const noteId = firstNoteId || '';

    if (firstNoteId) {
      const getResult = await new GranolaBubble({
        operation: 'get_note',
        note_id: firstNoteId,
        include_transcript: false,
      }).action();

      results.push({
        operation: 'get_note',
        success: getResult.success,
        details: getResult.success
          ? `Retrieved note: "${getResult.note?.title}" with ${getResult.note?.attendees?.length ?? 0} attendees`
          : getResult.error,
      });

      // 4. Get same note with transcript
      const transcriptResult = await new GranolaBubble({
        operation: 'get_note',
        note_id: firstNoteId,
        include_transcript: true,
      }).action();

      results.push({
        operation: 'get_note (with transcript)',
        success: transcriptResult.success,
        details: transcriptResult.success
          ? `Transcript entries: ${transcriptResult.note?.transcript?.length ?? 'null (no transcript)'}`
          : transcriptResult.error,
      });
    } else {
      results.push({
        operation: 'get_note',
        success: false,
        details: 'Skipped - no notes available from list_notes',
      });
    }

    // 5. Test pagination with cursor
    if (listResult.success && listResult.hasMore && listResult.cursor) {
      const paginatedResult = await new GranolaBubble({
        operation: 'list_notes',
        page_size: 5,
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

    // 6. Test error handling - invalid note ID
    const invalidResult = await new GranolaBubble({
      operation: 'get_note',
      note_id: 'not_INVALID000000',
    }).action();

    results.push({
      operation: 'get_note (invalid ID)',
      success: !invalidResult.success, // We expect this to fail
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
