import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const userIdField = z
  .string()
  .min(1, 'User ID is required')
  .optional()
  .default('me')
  .describe(
    'Zoom user ID or email. Use "me" for the authenticated user (default).'
  );

const meetingIdField = z
  .string()
  .min(1, 'Meeting ID is required')
  .describe('Numeric Zoom meeting ID (e.g. "123456789")');

const meetingUuidOrIdField = z
  .string()
  .min(1, 'Meeting UUID or ID is required')
  .describe(
    'Zoom meeting UUID (preferred for past meetings) or numeric meeting ID. ' +
      'IMPORTANT: if the UUID contains "/" or "+", you must pre-encode it ' +
      'with encodeURIComponent yourself before passing — Zoom requires ' +
      'double-encoding for these characters and the bubble only single-encodes.'
  );

export const ZoomParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('create_meeting')
      .describe('Create a scheduled or instant meeting for a user'),
    user_id: userIdField,
    topic: z
      .string()
      .min(1, 'Topic is required')
      .describe('Meeting topic / title'),
    type: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(8)])
      .optional()
      .default(2)
      .describe(
        'Meeting type: 1=instant, 2=scheduled (default), 3=recurring no fixed time, 8=recurring with fixed time'
      ),
    start_time: z
      .string()
      .optional()
      .describe(
        'ISO 8601 start time in UTC (e.g. "2026-05-01T15:00:00Z"). Required for type=2 or 8.'
      ),
    duration: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(30)
      .describe('Scheduled meeting duration in minutes (default 30)'),
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone for start_time (e.g. "America/Los_Angeles")'),
    agenda: z.string().optional().describe('Meeting agenda / description'),
    password: z
      .string()
      .optional()
      .describe('Meeting passcode (max 10 chars, alphanumeric)'),
    settings: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Zoom meeting settings object (host_video, participant_video, mute_upon_entry, auto_recording, etc.). ' +
          'NOTE: recurrence does NOT go here — use the top-level `recurrence` field instead.'
      ),
    recurrence: z
      .object({
        type: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .describe('Recurrence type: 1=daily, 2=weekly, 3=monthly'),
        repeat_interval: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            'Interval between recurrences (e.g. 2 = every 2 weeks). Defaults to 1.'
          ),
        weekly_days: z
          .string()
          .optional()
          .describe(
            'Comma-separated days of week (1=Sun..7=Sat). Required when type=2.'
          ),
        monthly_day: z
          .number()
          .int()
          .min(1)
          .max(31)
          .optional()
          .describe(
            'Day of month (1-31). Use with type=3 for "monthly on day N" recurrence.'
          ),
        monthly_week: z
          .union([
            z.literal(-1),
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
          ])
          .optional()
          .describe(
            'Week of month: -1=last, 1=first, 2=second, 3=third, 4=fourth. Use with monthly_week_day for type=3.'
          ),
        monthly_week_day: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .describe(
            'Day of week for monthly_week (1=Sun..7=Sat). Use with monthly_week.'
          ),
        end_times: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe(
            '[ONEOF:end] Number of occurrences before stopping (max 60).'
          ),
        end_date_time: z
          .string()
          .optional()
          .describe(
            '[ONEOF:end] ISO 8601 datetime to stop recurring (e.g. "2026-12-31T00:00:00Z").'
          ),
      })
      .optional()
      .describe(
        'Recurrence settings — required when type=8 (recurring with fixed time). ' +
          'Goes at the top of the request body, not inside `settings`. ' +
          'Shape: { type: 1=daily | 2=weekly | 3=monthly, repeat_interval?: number (default 1), ' +
          'weekly_days?: comma-separated "1=Sun..7=Sat" (required for type=2), ' +
          'monthly_day?: 1-31 (for type=3 nth-day), ' +
          'monthly_week?: -1=last|1|2|3|4 + monthly_week_day?: 1=Sun..7=Sat (for type=3 nth-weekday), ' +
          'end_times?: 1-60 occurrences OR end_date_time?: ISO 8601 — provide one of the two }.'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_meeting')
      .describe('Retrieve details of a single scheduled meeting by ID'),
    meeting_id: meetingIdField,
    occurrence_id: z
      .string()
      .optional()
      .describe('Specific occurrence ID for recurring meetings'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_meetings')
      .describe(
        "List a user's meetings. Returns flat: { meetings: [...], total_records, next_page_token }"
      ),
    user_id: userIdField,
    type: z
      .enum([
        'scheduled',
        'live',
        'upcoming',
        'upcoming_meetings',
        'previous_meetings',
      ])
      .optional()
      .default('scheduled')
      .describe(
        'Filter: scheduled (default — all upcoming + recurring meetings the user is host of), ' +
          'live (currently in progress), upcoming (next instance of every meeting, including recurring), ' +
          'upcoming_meetings (newer alias for upcoming), previous_meetings (already-ended meetings). ' +
          'Most flows want "scheduled" or "previous_meetings".'
      ),
    page_size: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .default(30)
      .describe('Results per page (1-300, default 30)'),
    next_page_token: z
      .string()
      .optional()
      .describe('Pagination token from a previous response'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_past_meeting')
      .describe('Retrieve details of a past meeting by UUID or ID'),
    meeting_id: meetingUuidOrIdField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_past_instances')
      .describe(
        'List ended instances of a recurring meeting. Use the returned UUIDs ' +
          'to fetch recordings or summaries. Returns an empty array for ' +
          'non-recurring meetings (type 1 or 2) — that is not an error.'
      ),
    meeting_id: meetingIdField,
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_user_recordings')
      .describe(
        "List a user's cloud recordings within an optional date range. " +
          'IMPORTANT: Zoom silently clamps the (from, to) window to a maximum ' +
          'of ~30 days — wider ranges are accepted but Zoom will only return ' +
          'recordings from the last 30 days of the requested window. To cover ' +
          'a longer period, paginate by issuing multiple back-to-back 30-day calls.'
      ),
    user_id: userIdField,
    from: z
      .string()
      .optional()
      .describe(
        'Start date (YYYY-MM-DD). Defaults to one month ago. Window is capped at ~30 days by Zoom.'
      ),
    to: z
      .string()
      .optional()
      .describe('End date (YYYY-MM-DD). Defaults to today.'),
    page_size: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .default(30)
      .describe('Results per page (1-300, default 30)'),
    next_page_token: z
      .string()
      .optional()
      .describe('Pagination token from a previous response'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_recording')
      .describe(
        "Get a meeting's cloud recording bundle (all files, including audio, video, chat, transcript)"
      ),
    meeting_id: meetingUuidOrIdField,
    include_fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated extra fields (e.g. "download_access_token") to include in the response'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_meeting_transcript')
      .describe(
        "Fetch a meeting's transcript. Locates the TRANSCRIPT file in the recording and optionally downloads its VTT content."
      ),
    meeting_id: meetingUuidOrIdField,
    download: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'When true (default), download the VTT transcript content using the access token'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_user')
      .describe('Get a Zoom user profile by ID, email, or "me"'),
    user_id: userIdField,
    credentials: credentialsField,
  }),
]);

const ZoomMeetingSchema = z
  .record(z.string(), z.unknown())
  .describe('A Zoom meeting record (fields vary by API endpoint)');

const ZoomRecordingFileSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'A single recording file (audio, video, chat, transcript). Includes id, file_type, download_url, recording_start, recording_end, status.'
  );

const ZoomUserSchema = z
  .record(z.string(), z.unknown())
  .describe('A Zoom user profile record');

export const ZoomResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_meeting'),
    success: z.boolean(),
    meeting: ZoomMeetingSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_meeting'),
    success: z.boolean(),
    meeting: ZoomMeetingSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_meetings'),
    success: z.boolean(),
    meetings: z.array(ZoomMeetingSchema).optional(),
    page_size: z.number().optional(),
    total_records: z.number().optional(),
    next_page_token: z.string().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_past_meeting'),
    success: z.boolean(),
    meeting: ZoomMeetingSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_past_instances'),
    success: z.boolean(),
    meetings: z.array(ZoomMeetingSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_user_recordings'),
    success: z.boolean(),
    meetings: z.array(z.record(z.string(), z.unknown())).optional(),
    page_size: z.number().optional(),
    total_records: z.number().optional(),
    next_page_token: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_recording'),
    success: z.boolean(),
    recording: z.record(z.string(), z.unknown()).optional(),
    recording_files: z.array(ZoomRecordingFileSchema).optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_meeting_transcript'),
    success: z.boolean(),
    transcript_file: ZoomRecordingFileSchema.optional(),
    transcript_vtt: z
      .string()
      .optional()
      .describe('Raw WebVTT transcript content (when download=true)'),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_user'),
    success: z.boolean(),
    user: ZoomUserSchema.optional(),
    error: z.string(),
  }),
]);

export type ZoomParams = z.output<typeof ZoomParamsSchema>;
export type ZoomParamsInput = z.input<typeof ZoomParamsSchema>;
export type ZoomResult = z.output<typeof ZoomResultSchema>;
