import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { HttpBubble } from './http.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const LumaCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const LumaLocationSchema = z.object({
  type: z.string().nullable().describe('Location provider type, e.g. "google"'),
  full_address: z.string().nullable(),
  short_address: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  country_code: z.string().nullable(),
  sublocality: z.string().nullable(),
  city_state: z.string().nullable(),
  place_id: z.string().nullable(),
  apple_maps_place_id: z.string().nullable(),
  description: z.string().nullable(),
  coordinate: LumaCoordinateSchema.nullable(),
  location_type: z
    .string()
    .nullable()
    .describe('Luma event location_type: offline, meet, zoom, etc.'),
});

const LumaHostSchema = z.object({
  api_id: z.string().nullable(),
  name: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio_short: z.string().nullable(),
  is_verified: z.boolean().nullable(),
  website: z.string().nullable(),
  linkedin_handle: z.string().nullable(),
  twitter_handle: z.string().nullable(),
  instagram_handle: z.string().nullable(),
  tiktok_handle: z.string().nullable(),
  youtube_handle: z.string().nullable(),
  timezone: z.string().nullable(),
});

const LumaTicketInfoSchema = z.object({
  is_free: z.boolean().nullable(),
  price: z.unknown().nullable().describe('Raw Luma price object or null'),
  max_price: z.unknown().nullable(),
  is_sold_out: z.boolean().nullable(),
  spots_remaining: z.number().nullable(),
  is_near_capacity: z.boolean().nullable(),
  require_approval: z.boolean().nullable(),
  waitlist_enabled: z.boolean().nullable(),
  waitlist_status: z.string().nullable(),
  waitlist_active: z.boolean().nullable(),
});

const LumaTagSchema = z.object({
  api_id: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
});

const LumaCoverSchema = z.object({
  url: z.string().nullable(),
  colors: z.array(z.string()).describe('Dominant hex colors extracted by Luma'),
});

const LumaCalendarSchema = z.object({
  api_id: z.string().nullable(),
  name: z.string().nullable(),
  slug: z.string().nullable(),
  description_short: z.string().nullable(),
  avatar_url: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  website: z.string().nullable(),
  linkedin_handle: z.string().nullable(),
  twitter_handle: z.string().nullable(),
  instagram_handle: z.string().nullable(),
  tiktok_handle: z.string().nullable(),
  youtube_handle: z.string().nullable(),
  tint_color: z.string().nullable(),
  verified_at: z.string().nullable(),
  luma_plan: z.string().nullable(),
});

const LumaEngagementSchema = z.object({
  guest_count: z.number().nullable(),
  ticket_count: z.number().nullable(),
  featured_guests_count: z.number().nullable(),
});

const LumaEventSchema = z.object({
  api_id: z.string().nullable(),
  name: z.string().nullable(),
  url: z.string().describe('Full Luma URL, e.g. https://luma.com/<slug>'),
  slug: z.string().nullable().describe('Luma URL slug (the bit after the /)'),
  start_at: z.string().nullable().describe('ISO UTC start time'),
  end_at: z.string().nullable().describe('ISO UTC end time'),
  timezone: z.string().nullable(),
  event_type: z.string().nullable(),
  visibility: z.string().nullable(),
  hide_rsvp: z.boolean().nullable(),
  recurrence_id: z.string().nullable(),
  location: LumaLocationSchema.nullable(),
  hosts: z.array(LumaHostSchema),
  ticket: LumaTicketInfoSchema,
  tags: z.array(LumaTagSchema),
  cover: LumaCoverSchema,
  calendar: LumaCalendarSchema.nullable(),
  engagement: LumaEngagementSchema,
  // Fields that are only populated when scraping a single-event page
  description: z
    .unknown()
    .nullable()
    .describe(
      'Rich description as a ProseMirror doc (single-event pages only); shape: { type: "doc", content: [...] }'
    ),
  description_text: z
    .string()
    .nullable()
    .describe('Plain-text extraction of the description (best effort)'),
  ticket_types: z
    .array(z.unknown())
    .nullable()
    .describe('Ticket type list (single-event pages only)'),
  sessions: z
    .array(z.unknown())
    .nullable()
    .describe('Sessions list (single-event pages only)'),
  categories: z
    .array(z.unknown())
    .nullable()
    .describe('Categories (single-event pages only)'),
  raw: z
    .unknown()
    .describe('Un-normalized source item from Luma for passthrough'),
});

type LumaEvent = z.output<typeof LumaEventSchema>;

const LumaParamsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe(
      'Luma URL. Accepts calendar pages (https://luma.com/ogc) or single event pages (https://luma.com/<slug>).'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (unused — Luma endpoint is public)'
    ),
});

type LumaParamsInput = z.input<typeof LumaParamsSchema>;
type LumaParams = z.output<typeof LumaParamsSchema>;

const LumaResultSchema = z.object({
  source: z
    .enum(['calendar', 'event', 'unknown'])
    .describe(
      'Whether the URL was a calendar page, single event page, or unrecognized'
    ),
  events: z.array(LumaEventSchema),
  success: z.boolean(),
  error: z.string(),
});

type LumaResult = z.output<typeof LumaResultSchema>;

// ─── Parsing helpers ────────────────────────────────────────────────────────

interface NextDataShape {
  props?: {
    pageProps?: {
      initialData?: {
        data?: Record<string, unknown>;
      };
    };
  };
}

function extractNextData(html: string): NextDataShape | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as NextDataShape;
  } catch {
    return null;
  }
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function mapLocation(
  geo: Record<string, unknown> | null,
  coordinate: Record<string, unknown> | null,
  locationType: string | null
): z.output<typeof LumaLocationSchema> | null {
  if (!geo && !coordinate && !locationType) return null;
  const coord =
    coordinate &&
    typeof coordinate['latitude'] === 'number' &&
    typeof coordinate['longitude'] === 'number'
      ? {
          latitude: coordinate['latitude'] as number,
          longitude: coordinate['longitude'] as number,
        }
      : null;
  return {
    type: asString(geo?.['type']),
    full_address: asString(geo?.['full_address']),
    short_address: asString(geo?.['short_address']),
    address: asString(geo?.['address']),
    city: asString(geo?.['city']),
    region: asString(geo?.['region']),
    country: asString(geo?.['country']),
    country_code: asString(geo?.['country_code']),
    sublocality: asString(geo?.['sublocality']),
    city_state: asString(geo?.['city_state']),
    place_id: asString(geo?.['place_id']),
    apple_maps_place_id: asString(geo?.['apple_maps_place_id']),
    description: asString(geo?.['description']),
    coordinate: coord,
    location_type: locationType,
  };
}

function mapHost(h: Record<string, unknown>): z.output<typeof LumaHostSchema> {
  return {
    api_id: asString(h['api_id']),
    name: asString(h['name']),
    first_name: asString(h['first_name']),
    last_name: asString(h['last_name']),
    username: asString(h['username']),
    avatar_url: asString(h['avatar_url']),
    bio_short: asString(h['bio_short']),
    is_verified: asBool(h['is_verified']),
    website: asString(h['website']),
    linkedin_handle: asString(h['linkedin_handle']),
    twitter_handle: asString(h['twitter_handle']),
    instagram_handle: asString(h['instagram_handle']),
    tiktok_handle: asString(h['tiktok_handle']),
    youtube_handle: asString(h['youtube_handle']),
    timezone: asString(h['timezone']),
  };
}

function mapTicket(
  ticketInfo: Record<string, unknown> | null,
  event: Record<string, unknown> | null,
  waitlistActive: unknown
): z.output<typeof LumaTicketInfoSchema> {
  return {
    is_free: asBool(ticketInfo?.['is_free']),
    price: ticketInfo?.['price'] ?? null,
    max_price: ticketInfo?.['max_price'] ?? null,
    is_sold_out: asBool(ticketInfo?.['is_sold_out']),
    spots_remaining: asNumber(ticketInfo?.['spots_remaining']),
    is_near_capacity: asBool(ticketInfo?.['is_near_capacity']),
    require_approval: asBool(ticketInfo?.['require_approval']),
    waitlist_enabled: asBool(event?.['waitlist_enabled']),
    waitlist_status: asString(event?.['waitlist_status']),
    waitlist_active: asBool(waitlistActive),
  };
}

function mapTag(t: Record<string, unknown>): z.output<typeof LumaTagSchema> {
  return {
    api_id: asString(t['api_id']),
    name: asString(t['name']) ?? '',
    color: asString(t['color']),
  };
}

function mapCover(
  coverImage: Record<string, unknown> | null,
  event: Record<string, unknown> | null
): z.output<typeof LumaCoverSchema> {
  const colors = asArray(coverImage?.['colors']).filter(
    (c): c is string => typeof c === 'string'
  );
  return {
    url: asString(event?.['cover_url']) ?? asString(coverImage?.['url']),
    colors,
  };
}

function mapCalendar(
  cal: Record<string, unknown> | null
): z.output<typeof LumaCalendarSchema> | null {
  if (!cal) return null;
  return {
    api_id: asString(cal['api_id']),
    name: asString(cal['name']),
    slug: asString(cal['slug']),
    description_short: asString(cal['description_short']),
    avatar_url: asString(cal['avatar_url']),
    cover_image_url: asString(cal['cover_image_url']),
    website: asString(cal['website']),
    linkedin_handle: asString(cal['linkedin_handle']),
    twitter_handle: asString(cal['twitter_handle']),
    instagram_handle: asString(cal['instagram_handle']),
    tiktok_handle: asString(cal['tiktok_handle']),
    youtube_handle: asString(cal['youtube_handle']),
    tint_color: asString(cal['tint_color']),
    verified_at: asString(cal['verified_at']),
    luma_plan: asString(cal['luma_plan']),
  };
}

// Walks a ProseMirror doc and concatenates all text nodes, preserving paragraph breaks.
function extractProseMirrorText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  let out = '';
  if (typeof n['text'] === 'string') out += n['text'];
  const content = asArray(n['content']);
  for (const child of content) {
    out += extractProseMirrorText(child);
  }
  // Insert a newline after block-level nodes so paragraphs read naturally
  const type = n['type'];
  if (type === 'paragraph' || type === 'heading' || type === 'blockquote') {
    out += '\n';
  }
  return out;
}

function buildFullUrl(slug: string | null): string {
  if (!slug) return '';
  if (slug.startsWith('http://') || slug.startsWith('https://')) return slug;
  return `https://luma.com/${slug}`;
}

// Normalize a calendar `featured_items[]` entry (event is nested under `.event`)
function mapFeaturedItem(item: Record<string, unknown>): LumaEvent {
  const event = asObject(item['event']) ?? {};
  const slug = asString(event['url']);
  const featuredGuests = asArray(item['featured_guests']);
  return {
    api_id: asString(event['api_id']) ?? asString(item['api_id']),
    name: asString(event['name']),
    url: buildFullUrl(slug),
    slug,
    start_at: asString(event['start_at']) ?? asString(item['start_at']),
    end_at: asString(event['end_at']),
    timezone: asString(event['timezone']),
    event_type: asString(event['event_type']),
    visibility: asString(event['visibility']),
    hide_rsvp: asBool(event['hide_rsvp']),
    recurrence_id: asString(event['recurrence_id']),
    location: mapLocation(
      asObject(event['geo_address_info']),
      asObject(event['coordinate']),
      asString(event['location_type'])
    ),
    hosts: asArray(item['hosts']).map((h) => mapHost(asObject(h) ?? {})),
    ticket: mapTicket(
      asObject(item['ticket_info']),
      event,
      item['waitlist_active']
    ),
    tags: asArray(item['tags']).map((t) => mapTag(asObject(t) ?? {})),
    cover: mapCover(asObject(item['cover_image']), event),
    calendar: mapCalendar(asObject(item['calendar'])),
    engagement: {
      guest_count: asNumber(item['guest_count']),
      ticket_count: asNumber(item['ticket_count']),
      featured_guests_count: featuredGuests.length,
    },
    description: null,
    description_text: null,
    ticket_types: null,
    sessions: null,
    categories: null,
    raw: item,
  };
}

// Normalize a single-event page `initialData.data` (event is at .event, top-level has more)
function mapSingleEvent(data: Record<string, unknown>): LumaEvent {
  const event = asObject(data['event']) ?? {};
  const slug = asString(event['url']);
  const featuredGuests = asArray(data['featured_guests']);
  return {
    api_id: asString(event['api_id']) ?? asString(data['api_id']),
    name: asString(event['name']),
    url: buildFullUrl(slug),
    slug,
    start_at: asString(event['start_at']) ?? asString(data['start_at']),
    end_at: asString(event['end_at']),
    timezone: asString(event['timezone']),
    event_type: asString(event['event_type']),
    visibility: asString(event['visibility']),
    hide_rsvp: asBool(event['hide_rsvp']),
    recurrence_id: asString(event['recurrence_id']),
    location: mapLocation(
      asObject(event['geo_address_info']),
      asObject(event['coordinate']),
      asString(event['location_type'])
    ),
    hosts: asArray(data['hosts']).map((h) => mapHost(asObject(h) ?? {})),
    ticket: mapTicket(
      asObject(data['ticket_info']),
      event,
      data['waitlist_active']
    ),
    tags: asArray(data['tags']).map((t) => mapTag(asObject(t) ?? {})),
    cover: mapCover(asObject(data['cover_image']), event),
    calendar: mapCalendar(asObject(data['calendar'])),
    engagement: {
      guest_count: asNumber(data['guest_count']),
      ticket_count: asNumber(data['ticket_count']),
      featured_guests_count: featuredGuests.length,
    },
    description: data['description_mirror'] ?? null,
    description_text: data['description_mirror']
      ? extractProseMirrorText(data['description_mirror']).trim() || null
      : null,
    ticket_types: asArray(data['ticket_types']),
    sessions: asArray(data['sessions']),
    categories: asArray(data['categories']),
    raw: data,
  };
}

// ─── Bubble ─────────────────────────────────────────────────────────────────

export class LumaBubble extends ServiceBubble<LumaParams, LumaResult> {
  static readonly service = 'nodex-core';
  static readonly authType = 'none' as const;
  static readonly bubbleName: BubbleName = 'luma';
  static readonly type = 'service' as const;
  static readonly schema = LumaParamsSchema;
  static readonly resultSchema = LumaResultSchema;
  static readonly shortDescription =
    'Scrape a Luma (lu.ma) calendar or event page — returns upcoming events with hosts, location, tickets, tags, cover art, and descriptions. Use for event digests, meetup reminders, RSVP monitoring, and community newsletter automation.';
  static readonly longDescription = `
    Scrapes any public Luma URL (luma.com or lu.ma) and returns structured event data by extracting
    the embedded __NEXT_DATA__ JSON. No credentials required — Luma event pages are public HTML.

    **WHEN TO USE:**
    - User mentions Luma, lu.ma, a Luma calendar/event URL, or pastes an https://lu.ma/* or
      https://luma.com/* link
    - User wants a digest/summary/reminder of upcoming community events, meetups, workshops,
      or conferences hosted on Luma
    - User wants to monitor a specific event for RSVP count, spots remaining, sold-out status,
      waitlist state, or tag changes
    - User is building a scheduled Slack/email/Discord notification of events from a Luma calendar
    - User wants to import Luma events into another system (Notion, Airtable, Google Calendar, CRM)

    **TWO URL FLAVORS — BOTH SUPPORTED:**
    1. **Calendar page** (e.g. https://luma.com/ogc, https://lu.ma/<slug>): returns all
       upcoming featured events (typically 10–30), \`source: 'calendar'\`
    2. **Single event page** (e.g. https://luma.com/<event-slug>): returns one event with
       richer data including full description (ProseMirror + plain text), ticket types, and
       sessions, \`source: 'event'\`

    **EACH EVENT RETURNS:**
    - Core: api_id, name, url, slug, start_at (ISO UTC), end_at, timezone, event_type, visibility
    - Hosts: name, first/last name, avatar_url, bio_short, linkedin_handle, twitter_handle,
      instagram_handle, tiktok_handle, youtube_handle, website
    - Location: full_address, short_address, city, region, country, sublocality, place_id,
      coordinate (lat/lng), location_type ('offline'|'meet'|'zoom'|...)
    - Ticket info: is_free, price, max_price, is_sold_out, spots_remaining, is_near_capacity,
      require_approval, waitlist_enabled, waitlist_status, waitlist_active
    - Tags: array of { name, color } (e.g. 'Learning'/purple, 'IRL'/blue, 'Social'/yellow)
    - Cover: url + dominant hex colors extracted by Luma
    - Calendar (host org): name, slug, description_short, avatar_url, website, social handles
    - Engagement: guest_count, ticket_count, featured_guests_count
    - Single-event only: description (ProseMirror doc), description_text (plain text),
      ticket_types, sessions, categories
    - raw: un-normalized passthrough in case you need a field not explicitly mapped

    **EXAMPLE USE CASES:**
    - "Every morning at 8 AM send me a Slack digest of the next 7 days of events from
      https://luma.com/ogc" → cron + LumaBubble + filter start_at within 7 days + SlackBubble
    - "Notify me when my event https://lu.ma/xyz123 is close to selling out" → cron +
      LumaBubble + check ticket.is_near_capacity / spots_remaining + notification
    - "Every week post a newsletter with AI meetups from these three Luma calendars" → loop
      over URLs, dedupe by api_id, format as email with ResendBubble
    - "When a new event is added to https://luma.com/ai-events, tell me in Slack" → store last
      seen api_ids in Postgres, diff against new result, post new events
    - "Import all upcoming events from https://lu.ma/mycal into a Notion database" → LumaBubble
      + NotionBubble create_page per event with title, date, location, hosts
    - "Scrape event details from https://luma.com/<slug>" (single event) → returns full
      description text, ticket types, hosts with bios

    **FILTERING TIP:**
    Events come back unsorted and unfiltered. Filter in your flow with:
      events.filter(e => e.start_at && new Date(e.start_at).getTime() <= Date.now() + N*86400000)
    and sort by start_at if you need chronological order.
  `;
  static readonly alias = 'luma-events';

  constructor(
    params: LumaParamsInput = { url: 'https://luma.com/ogc' },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    return undefined;
  }

  public async testCredential(): Promise<boolean> {
    return true;
  }

  protected async performAction(context?: BubbleContext): Promise<LumaResult> {
    void context;
    const { url } = this.params;

    const response = await new HttpBubble(
      {
        url,
        method: 'GET',
        responseType: 'text',
        timeout: 30000,
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      this.context
    ).action();

    if (!response.success || !response.data?.body) {
      return {
        source: 'unknown',
        events: [],
        success: false,
        error:
          response.error ||
          `Failed to fetch Luma page (status ${response.data?.status ?? 'unknown'})`,
      };
    }

    const nextData = extractNextData(response.data.body);
    const data = nextData?.props?.pageProps?.initialData?.data;
    if (!data) {
      return {
        source: 'unknown',
        events: [],
        success: false,
        error: 'Could not extract __NEXT_DATA__ JSON from the Luma page',
      };
    }

    // Calendar pages have featured_items[], single events don't
    const featuredItems = asArray(data['featured_items']);
    if (featuredItems.length > 0) {
      const events = featuredItems
        .map((i) => asObject(i))
        .filter((i): i is Record<string, unknown> => i !== null)
        .map(mapFeaturedItem);
      return { source: 'calendar', events, success: true, error: '' };
    }

    // Single event page — data itself is the event
    if (data['event']) {
      return {
        source: 'event',
        events: [mapSingleEvent(data)],
        success: true,
        error: '',
      };
    }

    return {
      source: 'unknown',
      events: [],
      success: false,
      error:
        'Luma page did not contain featured_items[] or a single event — unsupported URL shape',
    };
  }
}

export {
  LumaParamsSchema,
  LumaResultSchema,
  LumaEventSchema,
  type LumaParams,
  type LumaParamsInput,
  type LumaResult,
  type LumaEvent,
};
