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
} from './granola.schema.js';

const GRANOLA_API_BASE = 'https://public-api.granola.ai';

/**
 * GranolaBubble - Integration with Granola meeting notes API
 *
 * Provides read-only operations for accessing Granola meeting notes:
 * - List notes with pagination and date filtering
 * - Get note details with optional transcript
 *
 * @example
 * ```typescript
 * // List recent notes
 * const result = await new GranolaBubble({
 *   operation: 'list_notes',
 *   page_size: 10,
 * }).action();
 *
 * // Get a specific note with transcript
 * const note = await new GranolaBubble({
 *   operation: 'get_note',
 *   note_id: 'not_1d3tmYTlCICgjy',
 *   include_transcript: true,
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
    - Get full note details including summaries, attendees, and calendar events
    - Optionally retrieve meeting transcripts

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
      page_size: 10,
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

    // Validate by listing notes with page_size=1
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

    if (params.created_before)
      queryParams.set('created_before', params.created_before);
    if (params.created_after)
      queryParams.set('created_after', params.created_after);
    if (params.updated_after)
      queryParams.set('updated_after', params.updated_after);
    if (params.cursor) queryParams.set('cursor', params.cursor);
    if (params.page_size)
      queryParams.set('page_size', String(params.page_size));

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
      notes: Extract<GranolaResult, { operation: 'list_notes' }>['notes'];
      hasMore: boolean;
      cursor: string | null;
    };
    return {
      operation: 'list_notes',
      success: true,
      error: '',
      notes: data.notes,
      hasMore: data.hasMore,
      cursor: data.cursor,
    };
  }

  private async getNote(
    params: GranolaGetNoteParams
  ): Promise<Extract<GranolaResult, { operation: 'get_note' }>> {
    const queryParams = new URLSearchParams();
    if (params.include_transcript) {
      queryParams.set('include', 'transcript');
    }

    const url = `${GRANOLA_API_BASE}/v1/notes/${params.note_id}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeGranolaRequest(url);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        operation: 'get_note',
        success: false,
        error: `Granola API error (${response.status}): ${errorText}`,
      };
    }

    const note = (await response.json()) as Extract<
      GranolaResult,
      { operation: 'get_note' }
    >['note'];
    return {
      operation: 'get_note',
      success: true,
      error: '',
      note,
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
