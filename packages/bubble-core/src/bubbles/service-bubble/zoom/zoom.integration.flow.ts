import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { ZoomBubble } from './zoom.js';

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
 * Integration flow test for the Zoom bubble.
 * Exercises every operation against a real Zoom account using the user's
 * connected ZOOM_CRED OAuth token. Each operation tries to chain off the
 * prior operation's results so the flow only needs the user to have at
 * least one past meeting + recording.
 */
export class ZoomIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. get_user — confirm the OAuth token works
    const userResult = await new ZoomBubble({
      operation: 'get_user',
      user_id: 'me',
    }).action();

    results.push({
      operation: 'get_user',
      success: userResult.success,
      details: userResult.success
        ? `Authenticated as ${(userResult.user as { email?: string })?.email ?? 'unknown'}`
        : userResult.error,
    });

    // 2. create_meeting — schedule something an hour in the future
    const startTime = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');

    const createResult = await new ZoomBubble({
      operation: 'create_meeting',
      user_id: 'me',
      topic: 'BubbleLab Integration Test — Spaces & Üñïçødé',
      type: 2,
      start_time: startTime,
      duration: 15,
      timezone: 'America/Los_Angeles',
      agenda: 'Created by ZoomIntegrationTest',
    }).action();

    const createdMeetingId = createResult.success
      ? String((createResult.meeting as { id?: number | string })?.id ?? '')
      : '';

    results.push({
      operation: 'create_meeting',
      success: createResult.success,
      details: createResult.success
        ? `Created meeting ${createdMeetingId}`
        : createResult.error,
    });

    // 3. get_meeting — fetch the meeting we just created
    if (createdMeetingId) {
      const getResult = await new ZoomBubble({
        operation: 'get_meeting',
        meeting_id: createdMeetingId,
      }).action();

      results.push({
        operation: 'get_meeting',
        success: getResult.success,
        details: getResult.success
          ? `Topic: ${(getResult.meeting as { topic?: string })?.topic}`
          : getResult.error,
      });
    } else {
      results.push({
        operation: 'get_meeting',
        success: false,
        details: 'Skipped — create_meeting did not return an ID',
      });
    }

    // 4. list_meetings — should include the new one
    const listResult = await new ZoomBubble({
      operation: 'list_meetings',
      user_id: 'me',
      type: 'scheduled',
      page_size: 30,
    }).action();

    results.push({
      operation: 'list_meetings',
      success: listResult.success,
      details: listResult.success
        ? `Found ${listResult.meetings?.length ?? 0} meetings (total ${listResult.total_records ?? 0})`
        : listResult.error,
    });

    // 5. list_user_recordings — last 30 days
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const recordingsResult = await new ZoomBubble({
      operation: 'list_user_recordings',
      user_id: 'me',
      from: monthAgo,
      to: today,
      page_size: 30,
    }).action();

    const firstRecordingMeetingUuid =
      recordingsResult.success && recordingsResult.meetings?.length
        ? String(
            (recordingsResult.meetings[0] as { uuid?: string }).uuid ??
              (recordingsResult.meetings[0] as { id?: number | string }).id ??
              ''
          )
        : '';
    const firstRecordingMeetingId =
      recordingsResult.success && recordingsResult.meetings?.length
        ? String(
            (recordingsResult.meetings[0] as { id?: number | string }).id ?? ''
          )
        : '';

    results.push({
      operation: 'list_user_recordings',
      success: recordingsResult.success,
      details: recordingsResult.success
        ? `Found ${recordingsResult.meetings?.length ?? 0} recordings`
        : recordingsResult.error,
    });

    // 6. list_past_instances — only meaningful for recurring meetings
    if (firstRecordingMeetingId) {
      const pastInstances = await new ZoomBubble({
        operation: 'list_past_instances',
        meeting_id: firstRecordingMeetingId,
      }).action();

      results.push({
        operation: 'list_past_instances',
        success: pastInstances.success,
        details: pastInstances.success
          ? `Found ${pastInstances.meetings?.length ?? 0} past instances`
          : pastInstances.error,
      });
    } else {
      results.push({
        operation: 'list_past_instances',
        success: false,
        details: 'Skipped — no recordings to derive a meeting ID from',
      });
    }

    // 7. get_past_meeting — chain off the first recording
    if (firstRecordingMeetingUuid) {
      const pastMeeting = await new ZoomBubble({
        operation: 'get_past_meeting',
        meeting_id: encodeURIComponent(firstRecordingMeetingUuid),
      }).action();

      results.push({
        operation: 'get_past_meeting',
        success: pastMeeting.success,
        details: pastMeeting.success
          ? `Past meeting topic: ${(pastMeeting.meeting as { topic?: string })?.topic}`
          : pastMeeting.error,
      });
    } else {
      results.push({
        operation: 'get_past_meeting',
        success: false,
        details: 'Skipped — no recordings to derive a UUID from',
      });
    }

    // 8. get_recording — fetch the recording bundle for the first one
    if (firstRecordingMeetingUuid) {
      const getRecording = await new ZoomBubble({
        operation: 'get_recording',
        meeting_id: encodeURIComponent(firstRecordingMeetingUuid),
      }).action();

      results.push({
        operation: 'get_recording',
        success: getRecording.success,
        details: getRecording.success
          ? `Got ${getRecording.recording_files?.length ?? 0} recording files`
          : getRecording.error,
      });

      // 9. get_meeting_transcript — try to extract transcript VTT
      const transcript = await new ZoomBubble({
        operation: 'get_meeting_transcript',
        meeting_id: encodeURIComponent(firstRecordingMeetingUuid),
        download: true,
      }).action();

      results.push({
        operation: 'get_meeting_transcript',
        success: transcript.success,
        details: transcript.success
          ? `Transcript ${transcript.transcript_vtt ? `(${transcript.transcript_vtt.length} chars)` : '(metadata only)'}`
          : transcript.error,
      });
    } else {
      results.push({
        operation: 'get_recording',
        success: false,
        details: 'Skipped — no recordings to fetch',
      });
      results.push({
        operation: 'get_meeting_transcript',
        success: false,
        details: 'Skipped — no recordings to fetch transcript from',
      });
    }

    return { testResults: results };
  }
}
