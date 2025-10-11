import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Calendar list entry schema
const CalendarListEntrySchema = z
  .object({
    id: z.string().describe('Calendar ID'),
    summary: z.string().optional().describe('Calendar title'),
    description: z.string().optional().describe('Calendar description'),
    timeZone: z.string().optional().describe('Calendar time zone'),
    selected: z
      .boolean()
      .optional()
      .describe('Whether this calendar is selected'),
    accessRole: z
      .enum(['freeBusyReader', 'reader', 'writer', 'owner'])
      .optional()
      .describe('Access role for the user'),
  })
  .passthrough()
  .describe('Google Calendar list entry');

// Event date/time schema
const EventDateTimeSchema = z
  .object({
    dateTime: z
      .string()
      .optional()
      .describe('RFC3339 timestamp, e.g. 2025-09-10T10:00:00-07:00'),
    date: z
      .string()
      .optional()
      .describe(
        'All-day date in YYYY-MM-DD (mutually exclusive with dateTime)'
      ),
    timeZone: z.string().optional().describe('Time zone for the event time'),
  })
  .describe('Event date/time');

// Attendee schema
const AttendeeSchema = z
  .object({
    email: z.string().email().describe('Attendee email'),
    optional: z
      .boolean()
      .optional()
      .describe('Whether this attendee is optional'),
    responseStatus: z
      .enum(['needsAction', 'declined', 'tentative', 'accepted'])
      .optional()
      .describe('Response status of the attendee'),
    displayName: z.string().optional().describe('Display name of the attendee'),
  })
  .describe('Event attendee');

// Event schema
const CalendarEventSchema = z
  .object({
    id: z.string().describe('Event ID'),
    status: z
      .string()
      .optional()
      .describe('Event status (confirmed, tentative, cancelled)'),
    htmlLink: z
      .string()
      .optional()
      .describe('Link to the event in Calendar UI'),
    created: z.string().optional().describe('Event creation timestamp'),
    updated: z.string().optional().describe('Event last updated timestamp'),
    summary: z.string().optional().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
    start: EventDateTimeSchema.optional().describe('Event start date/time'),
    end: EventDateTimeSchema.optional().describe('Event end date/time'),
    attendees: z
      .array(AttendeeSchema)
      .optional()
      .describe('List of event attendees'),
    organizer: z
      .object({
        email: z.string().optional().describe('Organizer email address'),
        displayName: z.string().optional().describe('Organizer display name'),
      })
      .optional()
      .describe('Event organizer information'),
    hangoutLink: z
      .string()
      .optional()
      .describe('Google Hangout/Meet link for the event'),
    conferenceData: z
      .any()
      .optional()
      .describe('Conference data for virtual meetings'),
  })
  .passthrough()
  .describe('Google Calendar event');

// Params schema (discriminated union)
const GoogleCalendarParamsSchema = z.discriminatedUnion('operation', [
  // List calendars
  z.object({
    operation: z
      .literal('list_calendars')
      .describe('List calendars for the user'),
    max_results: z
      .number()
      .min(1)
      .max(250)
      .optional()
      .default(50)
      .describe('Maximum number of calendars to return'),
    page_token: z.string().optional().describe('Token for fetching next page'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List events
  z.object({
    operation: z.literal('list_events').describe('List events in a calendar'),
    calendar_id: z
      .string()
      .optional()
      .default('primary')
      .describe('Calendar ID'),
    time_min: z.string().optional().describe('Lower bound (RFC3339 timestamp)'),
    time_max: z.string().optional().describe('Upper bound (RFC3339 timestamp)'),
    q: z.string().optional().describe('Free text search query'),
    single_events: z
      .boolean()
      .optional()
      .default(true)
      .describe('Expand recurring events'),
    order_by: z
      .enum(['startTime', 'updated'])
      .optional()
      .default('startTime')
      .describe('Sort order'),
    page_token: z.string().optional().describe('Token for fetching next page'),
    max_results: z
      .number()
      .min(1)
      .max(250)
      .optional()
      .default(50)
      .describe('Maximum number of events to return'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get event
  z.object({
    operation: z.literal('get_event').describe('Get a single event'),
    calendar_id: z
      .string()
      .optional()
      .default('primary')
      .describe('Calendar ID'),
    event_id: z
      .string()
      .min(1, 'Event ID is required')
      .describe('Event ID to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create event
  z.object({
    operation: z.literal('create_event').describe('Create an event'),
    calendar_id: z
      .string()
      .optional()
      .default('primary')
      .describe('Calendar ID'),
    summary: z
      .string()
      .min(1, 'Event title is required')
      .describe('Event title'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
    start: EventDateTimeSchema.describe('Start date/time'),
    end: EventDateTimeSchema.describe('End date/time'),
    attendees: z
      .array(AttendeeSchema)
      .optional()
      .describe('List of event attendees'),
    conference: z
      .boolean()
      .optional()
      .default(false)
      .describe('Create a Google Meet conference link'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update event
  z.object({
    operation: z.literal('update_event').describe('Update an existing event'),
    calendar_id: z
      .string()
      .optional()
      .default('primary')
      .describe('Calendar ID'),
    event_id: z
      .string()
      .min(1, 'Event ID is required')
      .describe('Event ID to update'),
    summary: z.string().optional().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
    start: EventDateTimeSchema.optional().describe('Start date/time'),
    end: EventDateTimeSchema.optional().describe('End date/time'),
    attendees: z
      .array(AttendeeSchema)
      .optional()
      .describe('List of event attendees'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete event
  z.object({
    operation: z.literal('delete_event').describe('Delete an event'),
    calendar_id: z
      .string()
      .optional()
      .default('primary')
      .describe('Calendar ID'),
    event_id: z
      .string()
      .min(1, 'Event ID is required')
      .describe('Event ID to delete'),
    send_updates: z
      .enum(['all', 'externalOnly', 'none'])
      .optional()
      .default('none')
      .describe('Whether to notify attendees'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Results schema
const GoogleCalendarResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('list_calendars')
      .describe('List calendars for the user'),
    success: z
      .boolean()
      .describe('Whether the calendar list was retrieved successfully'),
    calendars: z
      .array(CalendarListEntrySchema)
      .optional()
      .describe('List of calendars'),
    next_page_token: z
      .string()
      .optional()
      .describe('Token for fetching next page'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('list_events').describe('List events in a calendar'),
    success: z
      .boolean()
      .describe('Whether the event list was retrieved successfully'),
    events: z.array(CalendarEventSchema).optional().describe('List of events'),
    next_page_token: z
      .string()
      .optional()
      .describe('Token for fetching next page'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('get_event').describe('Get a single event'),
    success: z
      .boolean()
      .describe('Whether the event was retrieved successfully'),
    event: CalendarEventSchema.optional().describe('Event details'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('create_event').describe('Create an event'),
    success: z.boolean().describe('Whether the event was created successfully'),
    event: CalendarEventSchema.optional().describe('Created event details'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('update_event').describe('Update an existing event'),
    success: z.boolean().describe('Whether the event was updated successfully'),
    event: CalendarEventSchema.optional().describe('Updated event details'),
    error: z.string().describe('Error message if operation failed'),
  }),
  z.object({
    operation: z.literal('delete_event').describe('Delete an event'),
    success: z.boolean().describe('Whether the event was deleted successfully'),
    deleted: z
      .boolean()
      .optional()
      .describe('Whether the event was actually deleted'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

type GoogleCalendarResult = z.output<typeof GoogleCalendarResultSchema>;
type GoogleCalendarParams = z.input<typeof GoogleCalendarParamsSchema>;

export type GoogleCalendarOperationResult<
  T extends GoogleCalendarParams['operation'],
> = Extract<GoogleCalendarResult, { operation: T }>;

// Exported input type
export type GoogleCalendarParamsInput = z.input<
  typeof GoogleCalendarParamsSchema
>;

export class GoogleCalendarBubble<
  T extends GoogleCalendarParams = GoogleCalendarParams,
> extends ServiceBubble<
  T,
  Extract<GoogleCalendarResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'google-calendar';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'google-calendar';
  static readonly schema = GoogleCalendarParamsSchema;
  static readonly resultSchema = GoogleCalendarResultSchema;
  static readonly shortDescription =
    'Google Calendar integration for managing events';
  static readonly longDescription = `
    Google Calendar service integration for listing, creating, updating and deleting events.
    Use cases:
    - List calendars and events with filters and pagination
    - Create meetings with attendees and optional Google Meet link
    - Update or delete existing events and notify attendees
    Security Features:
    - OAuth 2.0 with scoped access to Calendar
  `;
  static readonly alias = 'gcal';

  constructor(
    params: T = {
      operation: 'list_events',
      calendar_id: 'primary',
      max_results: 10,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Google Calendar credentials are required');
    }
    try {
      const resp = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async makeCalendarApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<any> {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://www.googleapis.com/calendar/v3${endpoint}`;

    const requestHeaders = {
      Authorization: `Bearer ${this.chooseCredential()}`,
      'Content-Type': 'application/json',
      ...headers,
    };

    const init: RequestInit = { method, headers: requestHeaders };
    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${txt}`
      );
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json'))
      return await response.json();
    return await response.text();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<GoogleCalendarResult, { operation: T['operation'] }>> {
    void context;
    const { operation } = this.params;
    try {
      const result = await (async (): Promise<GoogleCalendarResult> => {
        switch (operation) {
          case 'list_calendars':
            return await this.listCalendars(this.params);
          case 'list_events':
            return await this.listEvents(this.params);
          case 'get_event':
            return await this.getEvent(this.params);
          case 'create_event':
            return await this.createEvent(this.params);
          case 'update_event':
            return await this.updateEvent(this.params);
          case 'delete_event':
            return await this.deleteEvent(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();
      return result as Extract<
        GoogleCalendarResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<GoogleCalendarResult, { operation: T['operation'] }>;
    }
  }

  private async listCalendars(
    params: Extract<GoogleCalendarParams, { operation: 'list_calendars' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'list_calendars' }>> {
    const { max_results, page_token } = params;
    const qp = new URLSearchParams({ maxResults: String(max_results ?? 50) });
    if (page_token) qp.set('pageToken', page_token);
    const resp = await this.makeCalendarApiRequest(
      `/users/me/calendarList?${qp.toString()}`
    );
    return {
      operation: 'list_calendars',
      success: true,
      calendars: resp.items || [],
      next_page_token: resp.nextPageToken,
      error: '',
    };
  }

  private async listEvents(
    params: Extract<GoogleCalendarParams, { operation: 'list_events' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'list_events' }>> {
    const {
      calendar_id = 'primary',
      time_min,
      time_max,
      q,
      single_events,
      order_by,
      page_token,
      max_results,
    } = params;
    const qp = new URLSearchParams({
      singleEvents: String(single_events ?? true),
      orderBy: order_by ?? 'startTime',
      maxResults: String(max_results ?? 50),
    });
    if (time_min) qp.set('timeMin', time_min);
    if (time_max) qp.set('timeMax', time_max);
    if (q) qp.set('q', q);
    if (page_token) qp.set('pageToken', page_token);

    const resp = await this.makeCalendarApiRequest(
      `/calendars/${encodeURIComponent(calendar_id)}/events?${qp.toString()}`
    );

    return {
      operation: 'list_events',
      success: true,
      events: resp.items || [],
      next_page_token: resp.nextPageToken,
      error: '',
    };
  }

  private async getEvent(
    params: Extract<GoogleCalendarParams, { operation: 'get_event' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'get_event' }>> {
    const { calendar_id = 'primary', event_id } = params;
    const resp = await this.makeCalendarApiRequest(
      `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`
    );
    return {
      operation: 'get_event',
      success: true,
      event: resp,
      error: '',
    };
  }

  private buildEventBody(params: {
    summary?: string;
    description?: string;
    location?: string;
    start?: z.input<typeof EventDateTimeSchema>;
    end?: z.input<typeof EventDateTimeSchema>;
    attendees?: z.input<typeof AttendeeSchema>[];
  }): any {
    const body: any = {};
    if (params.summary !== undefined) body.summary = params.summary;
    if (params.description !== undefined) body.description = params.description;
    if (params.location !== undefined) body.location = params.location;
    if (params.start) body.start = params.start;
    if (params.end) body.end = params.end;
    if (params.attendees) body.attendees = params.attendees;
    return body;
  }

  private async createEvent(
    params: Extract<GoogleCalendarParams, { operation: 'create_event' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'create_event' }>> {
    const {
      calendar_id = 'primary',
      conference,
      summary,
      description,
      location,
      start,
      end,
      attendees,
    } = params;
    const body = this.buildEventBody({
      summary,
      description,
      location,
      start,
      end,
      attendees,
    });

    if (conference) {
      body.conferenceData = {
        createRequest: { requestId: `req-${Date.now()}` },
      };
    }

    const resp = await this.makeCalendarApiRequest(
      `/calendars/${encodeURIComponent(calendar_id)}/events`,
      'POST',
      body,
      conference ? { 'X-Goog-Api-Version': '2' } : {}
    );
    return {
      operation: 'create_event',
      success: true,
      event: resp,
      error: '',
    };
  }

  private async updateEvent(
    params: Extract<GoogleCalendarParams, { operation: 'update_event' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'update_event' }>> {
    const {
      calendar_id = 'primary',
      event_id,
      summary,
      description,
      location,
      start,
      end,
      attendees,
    } = params;
    const body = this.buildEventBody({
      summary,
      description,
      location,
      start,
      end,
      attendees,
    });
    const resp = await this.makeCalendarApiRequest(
      `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
      'PATCH',
      body
    );
    return {
      operation: 'update_event',
      success: true,
      event: resp,
      error: '',
    };
  }

  private async deleteEvent(
    params: Extract<GoogleCalendarParams, { operation: 'delete_event' }>
  ): Promise<Extract<GoogleCalendarResult, { operation: 'delete_event' }>> {
    const { calendar_id = 'primary', event_id, send_updates } = params;
    const qp = new URLSearchParams();
    if (send_updates) qp.set('sendUpdates', send_updates);
    await this.makeCalendarApiRequest(
      `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}${qp.toString() ? `?${qp.toString()}` : ''}`,
      'DELETE'
    );
    return {
      operation: 'delete_event',
      success: true,
      deleted: true,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Google Calendar credentials provided');
    }
    return credentials[CredentialType.GOOGLE_CALENDAR_CRED];
  }
}
