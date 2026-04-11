import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - Granola API Response Types
// ============================================================================

/**
 * User/owner object from Granola API
 */
export const GranolaUserSchema = z
  .object({
    name: z.string().nullable().describe('User display name'),
    email: z.string().describe('User email address'),
  })
  .describe('Granola user information');

/**
 * Calendar invitee from Granola API
 */
export const GranolaCalendarInviteeSchema = z
  .object({
    email: z.string().describe('Invitee email address'),
  })
  .describe('Calendar event invitee');

/**
 * Calendar event associated with a note
 */
export const GranolaCalendarEventSchema = z
  .object({
    event_title: z.string().nullable().describe('Calendar event title'),
    invitees: z
      .array(GranolaCalendarInviteeSchema)
      .describe('List of event invitees'),
    organiser: z.string().nullable().describe('Event organiser email'),
    calendar_event_id: z
      .string()
      .nullable()
      .describe('External calendar event ID'),
    scheduled_start_time: z
      .string()
      .nullable()
      .describe('Scheduled start time (ISO 8601)'),
    scheduled_end_time: z
      .string()
      .nullable()
      .describe('Scheduled end time (ISO 8601)'),
  })
  .describe('Calendar event details');

/**
 * Folder membership from Granola API
 */
export const GranolaFolderSchema = z
  .object({
    id: z.string().describe('Folder ID'),
    object: z.literal('folder').describe('Object type'),
    name: z.string().describe('Folder name'),
  })
  .describe('Granola folder');

/**
 * Transcript speaker from Granola API
 */
export const GranolaSpeakerSchema = z
  .object({
    source: z
      .enum(['microphone', 'speaker'])
      .describe('Audio source (microphone or speaker)'),
    diarization_label: z
      .string()
      .optional()
      .describe('Speaker label (iOS only when diarization available)'),
  })
  .describe('Transcript speaker information');

/**
 * Transcript entry from Granola API
 */
export const GranolaTranscriptEntrySchema = z
  .object({
    speaker: GranolaSpeakerSchema.describe('Speaker information'),
    text: z.string().describe('Transcript text content'),
    start_time: z.string().describe('Start time (ISO 8601)'),
    end_time: z.string().describe('End time (ISO 8601)'),
  })
  .describe('Single transcript entry');

/**
 * Note summary (returned by list_notes)
 */
export const GranolaNoteSummarySchema = z
  .object({
    id: z.string().describe('Note ID (format: not_XXXXXXXXXXXXXX)'),
    object: z.literal('note').describe('Object type'),
    title: z.string().nullable().describe('Meeting title'),
    owner: GranolaUserSchema.describe('Note owner'),
    created_at: z.string().describe('Creation timestamp (ISO 8601)'),
    updated_at: z.string().describe('Last updated timestamp (ISO 8601)'),
  })
  .describe('Granola note summary');

/**
 * Full note (returned by get_note)
 */
export const GranolaNoteSchema = GranolaNoteSummarySchema.extend({
  calendar_event: GranolaCalendarEventSchema.nullable().describe(
    'Associated calendar event'
  ),
  attendees: z.array(GranolaUserSchema).describe('Meeting attendees'),
  folder_membership: z
    .array(GranolaFolderSchema)
    .describe('Folders this note belongs to'),
  summary_text: z.string().describe('Plain text summary of the meeting'),
  summary_markdown: z
    .string()
    .nullable()
    .describe('Markdown-formatted summary'),
  transcript: z
    .array(GranolaTranscriptEntrySchema)
    .nullable()
    .describe('Transcript entries (null unless include=transcript)'),
}).describe('Full Granola note with details');

// ============================================================================
// PARAMETER SCHEMAS - Operation-specific input types
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Credential map for authentication');

/**
 * List notes operation parameters
 */
const ListNotesSchema = z.object({
  operation: z
    .literal('list_notes')
    .transform(() => 'list_notes' as const)
    .describe('List accessible meeting notes with pagination'),
  created_before: z
    .string()
    .optional()
    .describe(
      'Filter notes created before this date (ISO 8601 date or datetime)'
    ),
  created_after: z
    .string()
    .optional()
    .describe(
      'Filter notes created after this date (ISO 8601 date or datetime)'
    ),
  updated_after: z
    .string()
    .optional()
    .describe(
      'Filter notes updated after this date (ISO 8601 date or datetime)'
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response'),
  page_size: z
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
 */
const GetNoteSchema = z.object({
  operation: z
    .literal('get_note')
    .transform(() => 'get_note' as const)
    .describe('Retrieve a single note with full details'),
  note_id: z
    .string()
    .describe('The note ID to retrieve (format: not_XXXXXXXXXXXXXX)'),
  include_transcript: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include the transcript in the response'),
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
  z.object({
    operation: z.literal('get_note'),
    success: z.boolean(),
    note: GranolaNoteSchema.optional(),
    error: z.string().describe('Error message if operation failed'),
  }),
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

export type GranolaNoteSummary = z.output<typeof GranolaNoteSummarySchema>;
export type GranolaNote = z.output<typeof GranolaNoteSchema>;
export type GranolaUser = z.output<typeof GranolaUserSchema>;
export type GranolaCalendarEvent = z.output<typeof GranolaCalendarEventSchema>;
export type GranolaFolder = z.output<typeof GranolaFolderSchema>;
export type GranolaTranscriptEntry = z.output<
  typeof GranolaTranscriptEntrySchema
>;
