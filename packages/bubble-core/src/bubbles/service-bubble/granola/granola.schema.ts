import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS — Normalized (camelCase) shapes returned by this bubble.
// NOTE: Granola's underlying REST API returns snake_case. This bubble
// normalizes to camelCase and flattens responses so callers don't have to
// remember the remote casing conventions.
// ============================================================================

/**
 * User/owner (normalized)
 */
export const GranolaUserSchema = z
  .object({
    name: z.string().nullable().describe('User display name'),
    email: z.string().describe('User email address'),
  })
  .describe('Granola user information');

/**
 * Calendar event associated with a note (normalized)
 */
export const GranolaCalendarEventSchema = z
  .object({
    title: z.string().nullable().describe('Calendar event title'),
    invitees: z.array(z.string()).describe('List of invitee email addresses'),
    organiser: z.string().nullable().describe('Event organiser email'),
    calendarEventId: z
      .string()
      .nullable()
      .describe('External calendar event ID'),
    startTime: z
      .string()
      .nullable()
      .describe('Scheduled start time (ISO 8601)'),
    endTime: z.string().nullable().describe('Scheduled end time (ISO 8601)'),
  })
  .describe('Calendar event details');

/**
 * Folder membership (normalized)
 */
export const GranolaFolderSchema = z
  .object({
    id: z.string().describe('Folder ID'),
    name: z.string().describe('Folder name'),
  })
  .describe('Granola folder');

/**
 * Transcript entry (normalized)
 */
export const GranolaTranscriptEntrySchema = z
  .object({
    source: z
      .enum(['microphone', 'speaker'])
      .describe('Audio source (microphone or speaker)'),
    speakerLabel: z
      .string()
      .nullable()
      .describe('Speaker label (iOS only when diarization available)'),
    text: z.string().describe('Transcript text content'),
    startTime: z.string().describe('Start time (ISO 8601)'),
    endTime: z.string().describe('End time (ISO 8601)'),
  })
  .describe('Single transcript entry');

/**
 * Note summary — returned inside list_notes (normalized).
 */
export const GranolaNoteSummarySchema = z
  .object({
    id: z.string().describe('Note ID (format: not_XXXXXXXXXXXXXX)'),
    title: z.string().nullable().describe('Meeting title'),
    owner: GranolaUserSchema.describe('Note owner'),
    createdAt: z.string().describe('Creation timestamp (ISO 8601)'),
    updatedAt: z.string().describe('Last updated timestamp (ISO 8601)'),
  })
  .describe('Granola note summary');

/**
 * Full note fields — returned FLAT on get_note (no wrapper object).
 * All fields are optional so callers using `sections` filtering don't
 * see undefined vs. missing differences at the type level.
 */
export const GranolaNoteFieldsSchema = z.object({
  id: z.string().describe('Note ID'),
  title: z.string().nullable().describe('Meeting title'),
  owner: GranolaUserSchema.optional().describe('Note owner'),
  createdAt: z.string().describe('Creation timestamp (ISO 8601)'),
  updatedAt: z.string().describe('Last updated timestamp (ISO 8601)'),
  notesUrl: z
    .string()
    .nullable()
    .describe(
      'Direct web link to this meeting in Granola (extracted from summary footer).'
    ),
  summaryText: z
    .string()
    .optional()
    .describe('Plain text summary (included when sections has "summary")'),
  summaryMarkdown: z
    .string()
    .nullable()
    .optional()
    .describe('Markdown summary (included when sections has "summary")'),
  attendees: z
    .array(GranolaUserSchema)
    .optional()
    .describe('Attendees (included when sections has "attendees")'),
  calendarEvent: GranolaCalendarEventSchema.nullable()
    .optional()
    .describe('Calendar event (included when sections has "calendar")'),
  folders: z
    .array(GranolaFolderSchema)
    .optional()
    .describe('Folders (included when sections has "folders")'),
  transcript: z
    .array(GranolaTranscriptEntrySchema)
    .nullable()
    .optional()
    .describe('Transcript (included only when sections has "transcript")'),
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credential map for authentication');

const SectionSchema = z.enum([
  'summary',
  'attendees',
  'calendar',
  'folders',
  'transcript',
]);

/**
 * List notes operation parameters
 */
const ListNotesSchema = z.object({
  operation: z
    .literal('list_notes')
    .describe('List accessible meeting notes with pagination'),
  createdBefore: z
    .string()
    .optional()
    .describe(
      'Filter notes created before this date (ISO 8601 date or datetime)'
    ),
  createdAfter: z
    .string()
    .optional()
    .describe(
      'Filter notes created after this date (ISO 8601 date or datetime)'
    ),
  updatedAfter: z
    .string()
    .optional()
    .describe(
      'Filter notes updated after this date (ISO 8601 date or datetime)'
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Number of notes per page (1-30, default 10)'),
  credentials: credentialsField,
});

/**
 * Get note operation parameters
 *
 * `sections` controls payload size. Transcript is NEVER included unless
 * explicitly requested — it can be very large. Default (undefined) returns
 * summary + attendees + calendar + folders (everything except transcript).
 */
const GetNoteSchema = z.object({
  operation: z
    .literal('get_note')
    .describe('Retrieve a single note with full details'),
  noteId: z
    .string()
    .describe('The note ID to retrieve (format: not_XXXXXXXXXXXXXX)'),
  sections: z
    .array(SectionSchema)
    .optional()
    .describe(
      'Which sections to return. Default: ["summary","attendees","calendar","folders"] (transcript excluded — request it only when needed).'
    ),
  credentials: credentialsField,
});

// ============================================================================
// COMBINED SCHEMAS
// ============================================================================

export const GranolaParamsSchema = z.discriminatedUnion('operation', [
  ListNotesSchema,
  GetNoteSchema,
]);

export const GranolaResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list_notes'),
    success: z.boolean(),
    notes: z.array(GranolaNoteSummarySchema).optional(),
    hasMore: z.boolean().optional(),
    cursor: z.string().nullable().optional(),
    error: z.string().describe('Error message if operation failed'),
  }),
  // NOTE: get_note returns FIELDS FLAT on the result — no `.note` wrapper.
  z
    .object({
      operation: z.literal('get_note'),
      success: z.boolean(),
      error: z.string().describe('Error message if operation failed'),
    })
    .merge(GranolaNoteFieldsSchema.partial()),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GranolaParams = z.output<typeof GranolaParamsSchema>;
export type GranolaParamsInput = z.input<typeof GranolaParamsSchema>;
export type GranolaResult = z.output<typeof GranolaResultSchema>;

export type GranolaListNotesParams = Extract<
  GranolaParams,
  { operation: 'list_notes' }
>;
export type GranolaGetNoteParams = Extract<
  GranolaParams,
  { operation: 'get_note' }
>;

export type GranolaSection = z.output<typeof SectionSchema>;
export type GranolaNoteSummary = z.output<typeof GranolaNoteSummarySchema>;
export type GranolaNoteFields = z.output<typeof GranolaNoteFieldsSchema>;
export type GranolaUser = z.output<typeof GranolaUserSchema>;
export type GranolaCalendarEvent = z.output<typeof GranolaCalendarEventSchema>;
export type GranolaFolder = z.output<typeof GranolaFolderSchema>;
export type GranolaTranscriptEntry = z.output<
  typeof GranolaTranscriptEntrySchema
>;
