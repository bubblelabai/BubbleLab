import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  GranolaParamsSchema,
  GranolaResultSchema,
  type GranolaParams,
  type GranolaParamsInput,
  type GranolaResult,
  type GranolaListNotesParams,
  type GranolaGetNoteParams,
  type GranolaNoteSummary,
  type GranolaNoteFields,
  type GranolaCalendarEvent,
  type GranolaTranscriptEntry,
  type GranolaUser,
} from './granola.schema.js';

const GRANOLA_API_BASE = 'https://public-api.granola.ai';

// ============================================================================
// Raw API types — reflect Granola's snake_case REST responses. Kept local
// because callers never see these; the bubble normalizes before returning.
// ============================================================================

interface RawUser {
  name: string | null;
  email: string;
}

interface RawNoteSummary {
  id: string;
  object: 'note';
  title: string | null;
  owner: RawUser;
  created_at: string;
  updated_at: string;
}

interface RawCalendarEvent {
  event_title: string | null;
  invitees: Array<{ email: string }>;
  organiser: string | null;
  calendar_event_id: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
}

interface RawFolder {
  id: string;
  object: 'folder';
  name: string;
}

interface RawTranscriptEntry {
  speaker: { source: 'microphone' | 'speaker'; diarization_label?: string };
  text: string;
  start_time: string;
  end_time: string;
}

interface RawFullNote extends RawNoteSummary {
  calendar_event: RawCalendarEvent | null;
  attendees: RawUser[];
  folder_membership: RawFolder[];
  summary_text: string;
  summary_markdown: string | null;
  transcript: RawTranscriptEntry[] | null;
}

/**
 * GranolaBubble — Integration with Granola meeting notes API.
 *
 * Returns a normalized (camelCase, flat) response shape. Underneath, the
 * Granola REST API uses snake_case and a nested `{note: {...}}` wrapper on
 * get_note — this bubble translates both so callers can write natural
 * code like `result.data.summaryMarkdown`.
 *
 * @example
 * ```typescript
 * // List recent notes
 * const list = await new GranolaBubble({
 *   operation: 'list_notes',
 *   pageSize: 10,
 * }).action();
 *
 * // Get a specific note (summary only — no transcript by default)
 * const note = await new GranolaBubble({
 *   operation: 'get_note',
 *   noteId: 'not_1d3tmYTlCICgjy',
 * }).action();
 * console.log(note.data.summaryMarkdown);
 *
 * // Get with transcript (explicitly requested — transcripts are large)
 * const full = await new GranolaBubble({
 *   operation: 'get_note',
 *   noteId: 'not_1d3tmYTlCICgjy',
 *   sections: ['summary', 'transcript'],
 * }).action();
 * ```
 */
export class GranolaBubble<
  T extends GranolaParamsInput = GranolaParamsInput,
> extends ServiceBubble<
  T,
  Extract<GranolaResult, { operation: T['operation'] }>
> {
  static readonly service = 'granola';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'granola' as const;
  static readonly type = 'service' as const;
  static readonly schema = GranolaParamsSchema;
  static readonly resultSchema = GranolaResultSchema;
  static readonly shortDescription =
    'Granola meeting notes and transcription integration';
  static readonly longDescription = `
    Granola is an AI meeting notes tool that captures and summarizes meetings.
    This bubble provides read-only access to:
    - List meeting notes with filtering by creation/update dates
    - Paginate through notes using cursor-based pagination
    - Get full note details (summary, attendees, calendar, folders, transcript)
    - Request only the sections you need via the \`sections\` parameter

    Response shape:
    - All fields are camelCase.
    - \`get_note\` returns the note's fields FLAT on the result (no \`.note\` wrapper).
      e.g. \`result.data.summaryMarkdown\`, \`result.data.attendees\`, etc.
    - \`notesUrl\` is computed for you — a direct web link to view the
      meeting in Granola (extracted from the summary footer).
    - Transcripts are excluded by default; pass \`sections: ['transcript']\`
      to include them (they can be very large).

    Authentication:
    - Uses Bearer token (API key) from Granola Settings > API
    - Requires Business or Enterprise plan for personal keys
    - Enterprise keys access all Team space notes

    Rate Limits:
    - 25 request burst capacity
    - 5 requests/second sustained rate
  `;
  static readonly alias = 'granola-notes';

  constructor(
    params: T = {
      operation: 'list_notes',
      pageSize: 10,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const params = this.params as GranolaParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.GRANOLA_API_KEY];
  }

  async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      return false;
    }

    const response = await fetch(`${GRANOLA_API_BASE}/v1/notes?page_size=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Granola API key validation failed: ${response.status}`);
    }
    return true;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<GranolaResult, { operation: T['operation'] }>> {
    void context;

    const params = this.params as GranolaParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_notes':
          return (await this.listNotes(
            params as GranolaListNotesParams
          )) as Extract<GranolaResult, { operation: T['operation'] }>;

        case 'get_note':
          return (await this.getNote(
            params as GranolaGetNoteParams
          )) as Extract<GranolaResult, { operation: T['operation'] }>;

        default:
          return {
            operation: operation as T['operation'],
            success: false,
            error: `Unknown operation: ${operation}`,
          } as unknown as Extract<GranolaResult, { operation: T['operation'] }>;
      }
    } catch (error) {
      return {
        operation: operation as T['operation'],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as unknown as Extract<GranolaResult, { operation: T['operation'] }>;
    }
  }

  // ============================================================================
  // API Methods
  // ============================================================================

  private async listNotes(
    params: GranolaListNotesParams
  ): Promise<Extract<GranolaResult, { operation: 'list_notes' }>> {
    const queryParams = new URLSearchParams();

    if (params.createdBefore)
      queryParams.set('created_before', params.createdBefore);
    if (params.createdAfter)
      queryParams.set('created_after', params.createdAfter);
    if (params.updatedAfter)
      queryParams.set('updated_after', params.updatedAfter);
    if (params.cursor) queryParams.set('cursor', params.cursor);
    if (params.pageSize) queryParams.set('page_size', String(params.pageSize));

    const url = `${GRANOLA_API_BASE}/v1/notes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeGranolaRequest(url);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        operation: 'list_notes',
        success: false,
        error: `Granola API error (${response.status}): ${errorText}`,
      };
    }

    const data = (await response.json()) as {
      notes: RawNoteSummary[];
      hasMore: boolean;
      cursor: string | null;
    };

    return {
      operation: 'list_notes',
      success: true,
      error: '',
      notes: (data.notes ?? []).map(normalizeNoteSummary),
      hasMore: data.hasMore,
      cursor: data.cursor,
    };
  }

  private async getNote(
    params: GranolaGetNoteParams
  ): Promise<Extract<GranolaResult, { operation: 'get_note' }>> {
    const sections = params.sections ?? [
      'summary',
      'attendees',
      'calendar',
      'folders',
    ];
    const wantTranscript = sections.includes('transcript');

    const queryParams = new URLSearchParams();
    if (wantTranscript) {
      queryParams.set('include', 'transcript');
    }

    const url = `${GRANOLA_API_BASE}/v1/notes/${params.noteId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeGranolaRequest(url);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        operation: 'get_note',
        success: false,
        error: `Granola API error (${response.status}): ${errorText}`,
      };
    }

    const raw = (await response.json()) as RawFullNote;
    const normalized = normalizeFullNote(raw, sections);

    return {
      operation: 'get_note',
      success: true,
      error: '',
      ...normalized,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async makeGranolaRequest(url: string): Promise<Response> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error('No Granola API key provided');
    }

    return fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

// ============================================================================
// Normalization helpers — snake_case raw → camelCase flat
// ============================================================================

function normalizeUser(u: RawUser | undefined | null): GranolaUser | undefined {
  if (!u) return undefined;
  return { name: u.name, email: u.email };
}

function normalizeNoteSummary(raw: RawNoteSummary): GranolaNoteSummary {
  return {
    id: raw.id,
    title: raw.title,
    owner: normalizeUser(raw.owner) ?? { name: null, email: '' },
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function normalizeCalendarEvent(
  raw: RawCalendarEvent | null
): GranolaCalendarEvent | null {
  if (!raw) return null;
  return {
    title: raw.event_title,
    invitees: (raw.invitees ?? []).map((i) => i.email),
    organiser: raw.organiser,
    calendarEventId: raw.calendar_event_id,
    startTime: raw.scheduled_start_time,
    endTime: raw.scheduled_end_time,
  };
}

function normalizeTranscript(
  raw: RawTranscriptEntry[] | null
): GranolaTranscriptEntry[] | null {
  if (!raw) return null;
  return raw.map((t) => ({
    source: t.speaker?.source ?? 'microphone',
    speakerLabel: t.speaker?.diarization_label ?? null,
    text: t.text,
    startTime: t.start_time,
    endTime: t.end_time,
  }));
}

/**
 * Granola stitches a "Chat with meeting transcript: <url>" footer onto
 * summary_markdown — this is the only place the public notes URL appears.
 * Extract it so callers don't have to regex the markdown themselves.
 */
function extractNotesUrl(summaryMarkdown: string | null): string | null {
  if (!summaryMarkdown) return null;
  const match = summaryMarkdown.match(
    /https:\/\/notes\.granola\.ai\/[^\s)\]]+/
  );
  return match ? match[0] : null;
}

function normalizeFullNote(
  raw: RawFullNote,
  sections: readonly string[]
): GranolaNoteFields {
  const out: GranolaNoteFields = {
    id: raw.id,
    title: raw.title,
    owner: normalizeUser(raw.owner),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    notesUrl: extractNotesUrl(raw.summary_markdown),
  };

  if (sections.includes('summary')) {
    out.summaryText = raw.summary_text;
    out.summaryMarkdown = raw.summary_markdown;
  }
  if (sections.includes('attendees')) {
    out.attendees = (raw.attendees ?? [])
      .map(normalizeUser)
      .filter((u): u is GranolaUser => u !== undefined);
  }
  if (sections.includes('calendar')) {
    out.calendarEvent = normalizeCalendarEvent(raw.calendar_event);
  }
  if (sections.includes('folders')) {
    out.folders = (raw.folder_membership ?? []).map((f) => ({
      id: f.id,
      name: f.name,
    }));
  }
  if (sections.includes('transcript')) {
    out.transcript = normalizeTranscript(raw.transcript);
  }

  return out;
}
