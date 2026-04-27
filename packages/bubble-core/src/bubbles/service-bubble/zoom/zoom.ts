import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  CredentialType,
  decodeCredentialPayload,
} from '@bubblelab/shared-schemas';
import {
  ZoomParamsSchema,
  ZoomResultSchema,
  type ZoomParams,
  type ZoomParamsInput,
  type ZoomResult,
} from './zoom.schema.js';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';

/**
 * Zoom Service Bubble
 *
 * OAuth-based Zoom integration for managing meetings, retrieving cloud
 * recordings (including AI-Companion summaries and VTT transcripts), and
 * reading user profiles via the Zoom REST API v2.
 */
export class ZoomBubble<
  T extends ZoomParamsInput = ZoomParamsInput,
> extends ServiceBubble<T, Extract<ZoomResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'zoom';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'zoom';
  static readonly schema = ZoomParamsSchema;
  static readonly resultSchema = ZoomResultSchema;
  static readonly shortDescription =
    'Zoom integration for meetings, cloud recordings, transcripts, and users';
  static readonly longDescription = `
    Zoom REST API v2 integration covering the most common meeting and
    recording workflows.

    Features:
    - Create, list, and read scheduled and past meetings
    - List past instances of recurring meetings (needed to fetch their recordings)
    - List a user's cloud recordings within a date range
    - Fetch a meeting's recording bundle (audio, video, chat, transcript files)
    - Fetch a meeting's transcript and optionally download the VTT content
    - Read a user profile (including the authenticated user via "me")

    Security Features:
    - OAuth 2.0 with automatic refresh-token rotation
    - User-scoped access (each connection only sees the connected user's data)
  `;
  static readonly alias = '';

  constructor(
    params: T = {
      operation: 'get_user',
      user_id: 'me',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const accessToken = this.parseAccessToken();
    if (!accessToken) {
      throw new Error('Zoom credentials are required');
    }

    const response = await fetch(`${ZOOM_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zoom API error (${response.status}): ${text}`);
    }
    return true;
  }

  private parseAccessToken(): string | null {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return null;
    }

    const raw = credentials[CredentialType.ZOOM_CRED];
    if (!raw) {
      return null;
    }

    try {
      const parsed = decodeCredentialPayload<{ accessToken?: string }>(raw);
      if (parsed.accessToken) {
        return parsed.accessToken;
      }
    } catch {
      // Fall through — treat raw as access token
    }

    return raw;
  }

  protected chooseCredential(): string | undefined {
    return this.parseAccessToken() ?? undefined;
  }

  private async zoomRequest<R = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<R> {
    const accessToken = this.parseAccessToken();
    if (!accessToken) {
      throw new Error('Zoom credentials are required');
    }

    let url = `${ZOOM_API_BASE}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    if (body !== undefined && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zoom API error (${response.status}): ${text}`);
    }
    if (response.status === 204) {
      return undefined as R;
    }
    return (await response.json()) as R;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<ZoomResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<ZoomResult> => {
        const p = this.params as ZoomParams;
        switch (p.operation) {
          case 'create_meeting':
            return await this.createMeeting(p);
          case 'get_meeting':
            return await this.getMeeting(p);
          case 'list_meetings':
            return await this.listMeetings(p);
          case 'get_past_meeting':
            return await this.getPastMeeting(p);
          case 'list_past_instances':
            return await this.listPastInstances(p);
          case 'list_user_recordings':
            return await this.listUserRecordings(p);
          case 'get_recording':
            return await this.getRecording(p);
          case 'get_meeting_transcript':
            return await this.getMeetingTranscript(p);
          case 'get_user':
            return await this.getUser(p);
          default:
            throw new Error(
              `Unsupported operation: ${(p as { operation: string }).operation}`
            );
        }
      })();

      return result as Extract<ZoomResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<ZoomResult, { operation: T['operation'] }>;
    }
  }

  // ─── Operation Implementations ──────────────────────────────────────

  private async createMeeting(
    params: Extract<ZoomParams, { operation: 'create_meeting' }>
  ): Promise<Extract<ZoomResult, { operation: 'create_meeting' }>> {
    const {
      user_id,
      topic,
      type,
      start_time,
      duration,
      timezone,
      agenda,
      password,
      settings,
      recurrence,
    } = params;

    const body: Record<string, unknown> = { topic, type, duration };
    if (start_time) body.start_time = start_time;
    if (timezone) body.timezone = timezone;
    if (agenda) body.agenda = agenda;
    if (password) body.password = password;
    if (settings) body.settings = settings;
    if (recurrence) body.recurrence = recurrence;

    const meeting = await this.zoomRequest<Record<string, unknown>>(
      `/users/${encodeURIComponent(user_id)}/meetings`,
      'POST',
      body
    );

    return {
      operation: 'create_meeting',
      success: true,
      meeting,
      error: '',
    };
  }

  private async getMeeting(
    params: Extract<ZoomParams, { operation: 'get_meeting' }>
  ): Promise<Extract<ZoomResult, { operation: 'get_meeting' }>> {
    const { meeting_id, occurrence_id } = params;
    const meeting = await this.zoomRequest<Record<string, unknown>>(
      `/meetings/${encodeURIComponent(meeting_id)}`,
      'GET',
      undefined,
      occurrence_id ? { occurrence_id } : undefined
    );
    return {
      operation: 'get_meeting',
      success: true,
      meeting,
      error: '',
    };
  }

  private async listMeetings(
    params: Extract<ZoomParams, { operation: 'list_meetings' }>
  ): Promise<Extract<ZoomResult, { operation: 'list_meetings' }>> {
    const { user_id, type, page_size, next_page_token } = params;
    const data = await this.zoomRequest<{
      meetings?: Record<string, unknown>[];
      page_size?: number;
      total_records?: number;
      next_page_token?: string;
    }>(`/users/${encodeURIComponent(user_id)}/meetings`, 'GET', undefined, {
      type,
      page_size,
      next_page_token,
    });

    return {
      operation: 'list_meetings',
      success: true,
      meetings: data.meetings ?? [],
      page_size: data.page_size,
      total_records: data.total_records,
      next_page_token: data.next_page_token,
      error: '',
    };
  }

  private async getPastMeeting(
    params: Extract<ZoomParams, { operation: 'get_past_meeting' }>
  ): Promise<Extract<ZoomResult, { operation: 'get_past_meeting' }>> {
    const { meeting_id } = params;
    const meeting = await this.zoomRequest<Record<string, unknown>>(
      `/past_meetings/${encodeURIComponent(meeting_id)}`
    );
    return {
      operation: 'get_past_meeting',
      success: true,
      meeting,
      error: '',
    };
  }

  private async listPastInstances(
    params: Extract<ZoomParams, { operation: 'list_past_instances' }>
  ): Promise<Extract<ZoomResult, { operation: 'list_past_instances' }>> {
    const { meeting_id } = params;
    const data = await this.zoomRequest<{
      meetings?: Record<string, unknown>[];
    }>(`/past_meetings/${encodeURIComponent(meeting_id)}/instances`);
    return {
      operation: 'list_past_instances',
      success: true,
      meetings: data.meetings ?? [],
      error: '',
    };
  }

  private async listUserRecordings(
    params: Extract<ZoomParams, { operation: 'list_user_recordings' }>
  ): Promise<Extract<ZoomResult, { operation: 'list_user_recordings' }>> {
    const { user_id, from, to, page_size, next_page_token } = params;
    const data = await this.zoomRequest<{
      meetings?: Record<string, unknown>[];
      page_size?: number;
      total_records?: number;
      next_page_token?: string;
      from?: string;
      to?: string;
    }>(`/users/${encodeURIComponent(user_id)}/recordings`, 'GET', undefined, {
      from,
      to,
      page_size,
      next_page_token,
    });
    return {
      operation: 'list_user_recordings',
      success: true,
      meetings: data.meetings ?? [],
      page_size: data.page_size,
      total_records: data.total_records,
      next_page_token: data.next_page_token,
      from: data.from,
      to: data.to,
      error: '',
    };
  }

  private async getRecording(
    params: Extract<ZoomParams, { operation: 'get_recording' }>
  ): Promise<Extract<ZoomResult, { operation: 'get_recording' }>> {
    const { meeting_id, include_fields } = params;
    const recording = await this.zoomRequest<Record<string, unknown>>(
      `/meetings/${encodeURIComponent(meeting_id)}/recordings`,
      'GET',
      undefined,
      include_fields ? { include_fields } : undefined
    );
    const recordingFiles = Array.isArray(
      (recording as { recording_files?: unknown }).recording_files
    )
      ? (recording as { recording_files: Record<string, unknown>[] })
          .recording_files
      : [];
    return {
      operation: 'get_recording',
      success: true,
      recording,
      recording_files: recordingFiles,
      error: '',
    };
  }

  private async getMeetingTranscript(
    params: Extract<ZoomParams, { operation: 'get_meeting_transcript' }>
  ): Promise<Extract<ZoomResult, { operation: 'get_meeting_transcript' }>> {
    const { meeting_id, download } = params;

    const recording = await this.zoomRequest<{
      recording_files?: Record<string, unknown>[];
    }>(`/meetings/${encodeURIComponent(meeting_id)}/recordings`);

    const files = recording.recording_files ?? [];
    const transcriptFile = files.find(
      (f) => (f as { file_type?: string }).file_type === 'TRANSCRIPT'
    );

    if (!transcriptFile) {
      return {
        operation: 'get_meeting_transcript',
        success: false,
        error: 'No TRANSCRIPT file found for this meeting recording',
      };
    }

    let transcriptVtt: string | undefined;
    if (download) {
      const downloadUrl = (transcriptFile as { download_url?: string })
        .download_url;
      if (!downloadUrl) {
        return {
          operation: 'get_meeting_transcript',
          success: false,
          transcript_file: transcriptFile,
          error: 'Transcript file is missing download_url',
        };
      }
      const accessToken = this.parseAccessToken();
      const dlResp = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dlResp.ok) {
        const text = await dlResp.text();
        return {
          operation: 'get_meeting_transcript',
          success: false,
          transcript_file: transcriptFile,
          error: `Transcript download failed (${dlResp.status}): ${text}`,
        };
      }
      transcriptVtt = await dlResp.text();
    }

    return {
      operation: 'get_meeting_transcript',
      success: true,
      transcript_file: transcriptFile,
      transcript_vtt: transcriptVtt,
      error: '',
    };
  }

  private async getUser(
    params: Extract<ZoomParams, { operation: 'get_user' }>
  ): Promise<Extract<ZoomResult, { operation: 'get_user' }>> {
    const { user_id } = params;
    const user = await this.zoomRequest<Record<string, unknown>>(
      `/users/${encodeURIComponent(user_id)}`
    );
    return {
      operation: 'get_user',
      success: true,
      user,
      error: '',
    };
  }
}
