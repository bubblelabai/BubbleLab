import { describe, it, expect } from 'vitest';
import { GoogleCalendarBubble } from './google-calendar.js';
import { CredentialType } from '@bubblelab/shared-schemas';

function getCred(): string | undefined {
  // Expect an OAuth access token in env for live tests
  // GCAL_OAUTH_TOKEN="" pnpm vitest run src/bubbles/service-bubble/google-calendar.integration.test.ts
  return process.env.GCAL_OAUTH_TOKEN || process.env.GOOGLE_CALENDAR_TOKEN;
}

describe('GoogleCalendarBubble integration', () => {
  it('list_calendars', async () => {
    const token = getCred();
    if (!token) {
      console.log(
        '⚠️  Skipping Google Calendar integration (list_calendars) - no GCAL_OAUTH_TOKEN'
      );
      return;
    }

    const result = await new GoogleCalendarBubble({
      operation: 'list_calendars',
      max_results: 5,
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();

    expect(result.success).toBe(true);
    expect(result.data.operation).toBe('list_calendars');
  });

  it('end-to-end: create_event -> get_event -> update_event -> delete_event', async () => {
    const token = getCred();
    if (!token) {
      console.log(
        '⚠️  Skipping Google Calendar integration (CRUD) - no GCAL_OAUTH_TOKEN'
      );
      return;
    }

    // Create
    const create = await new GoogleCalendarBubble({
      operation: 'create_event',
      summary: 'NodeX Test Meeting',
      description: 'Integration test event',
      start: { dateTime: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
      end: { dateTime: new Date(Date.now() + 40 * 60 * 1000).toISOString() },
      attendees: [],
      conference: false,
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();

    expect(create.success).toBe(true);
    const eventId = (create.data as any).event?.id as string | undefined;
    expect(eventId).toBeTruthy();
    if (!eventId) return; // Safety

    // Get
    const got = await new GoogleCalendarBubble({
      operation: 'get_event',
      event_id: eventId,
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();
    expect(got.success).toBe(true);
    expect((got.data as any).event?.id).toBe(eventId);

    // Update
    const updated = await new GoogleCalendarBubble({
      operation: 'update_event',
      event_id: eventId,
      summary: 'NodeX Test Meeting (updated)',
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();
    expect(updated.success).toBe(true);
    expect((updated.data as any).event?.summary).toContain('(updated)');

    // Delete
    const deleted = await new GoogleCalendarBubble({
      operation: 'delete_event',
      event_id: eventId,
      send_updates: 'none',
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();
    expect(deleted.success).toBe(true);
  });

  it('list_events', async () => {
    const token = getCred();
    if (!token) {
      console.log(
        '⚠️  Skipping Google Calendar integration (list_events) - no GCAL_OAUTH_TOKEN'
      );
      return;
    }
    const result = await new GoogleCalendarBubble({
      operation: 'list_events',
      max_results: 5,
      credentials: { [CredentialType.GOOGLE_CALENDAR_CRED]: token },
    }).action();
    expect(result.success).toBe(true);
    expect(result.data.operation).toBe('list_events');
  });
});
