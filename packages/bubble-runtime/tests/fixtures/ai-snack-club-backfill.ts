import { z } from 'zod';
import {
  BubbleFlow,
  SlackBubble,
  NotionBubble,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

interface SlackMessage {
  ts: string;
  thread_ts?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  subtype?: string;
}

interface SlackHistoryData {
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
}

interface SlackUserData {
  user?: {
    profile?: { display_name?: string; real_name?: string };
    real_name?: string;
  };
}

interface ExtractedProfile {
  location: string;
  currentRole: string;
  background: string;
  aiToolsUsed: string[];
  aiGoals: string;
  favoriteSnack: string;
  funFact: string;
  linkedIn: string;
  otherLinks: string;
}

export interface Output {
  totalMessages: number;
  pagesFetched: number;
  processed: number;
  created: number;
  failed: number;
  names: string[];
}

const NOTION_DB_ID = '5f2cdaf5dce44794a863cb37401dd428';
const INTRO_CHANNEL = 'C09R6DCFQ8L';

const profileSchema = z.object({
  location: z.string(),
  currentRole: z.string(),
  background: z.string(),
  aiToolsUsed: z.array(z.string()),
  aiGoals: z.string(),
  favoriteSnack: z.string(),
  funFact: z.string(),
  linkedIn: z.string(),
  otherLinks: z.string(),
});

const emptyProfile: ExtractedProfile = {
  location: '',
  currentRole: '',
  background: '',
  aiToolsUsed: [],
  aiGoals: '',
  favoriteSnack: '',
  funFact: '',
  linkedIn: '',
  otherLinks: '',
};

function isRealUserMessage(msg: SlackMessage): boolean {
  if (!msg.user) return false;
  if (msg.bot_id) return false;
  if (msg.subtype && msg.subtype !== 'thread_broadcast') return false;
  return true;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Generic retry wrapper for any async operation returning a BubbleResult-like value.
// On Slack rate-limit (error === 'ratelimited'), respects retry_after.
// On any thrown error, waits baseDelayMs before retrying.
async function withRetry<
  T extends { success: boolean; error: string; data: unknown },
>(fn: () => Promise<T>, maxRetries: number, baseDelayMs: number): Promise<T> {
  let lastResult: T | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let result: T;
    try {
      result = await fn();
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[withRetry] Attempt ${attempt + 1}/${maxRetries} threw: ${msg}. Retrying in ${baseDelayMs}ms…`
      );
      await sleep(baseDelayMs);
      continue;
    }
    // Slack embeds rate-limit signals inside the response body
    const d = result.data as
      | { error?: string; retry_after?: number }
      | undefined;
    if (d?.error === 'ratelimited') {
      const delay = (d.retry_after ?? 30) * 1000;
      console.warn(
        `[withRetry] Slack rate-limited on attempt ${attempt + 1}/${maxRetries}. Waiting ${delay}ms…`
      );
      await sleep(delay);
      lastResult = result;
      continue;
    }
    if (!result.success && attempt < maxRetries - 1) {
      console.warn(
        `[withRetry] Attempt ${attempt + 1}/${maxRetries} failed: ${result.error}. Retrying in ${baseDelayMs}ms…`
      );
      await sleep(baseDelayMs);
      lastResult = result;
      continue;
    }
    return result;
  }
  // All retries exhausted — return the last result so callers can check .success
  return lastResult as T;
}

function tsToIsoDate(ts: string): string {
  return new Date(parseFloat(ts) * 1000).toISOString().split('T')[0];
}

function safeParseProfile(raw: string): ExtractedProfile {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return emptyProfile;
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  const parsed = profileSchema.safeParse(JSON.parse(jsonStr));
  return parsed.success ? parsed.data : emptyProfile;
}

function buildNotionProperties(
  name: string,
  slackUserId: string,
  profile: ExtractedProfile,
  introDate: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: name } }] },
    'Slack User ID': { rich_text: [{ text: { content: slackUserId } }] },
    'Intro Date': { date: { start: introDate } },
  };
  if (profile.location)
    props['Location'] = {
      rich_text: [{ text: { content: profile.location } }],
    };
  if (profile.currentRole)
    props['Current Role'] = {
      rich_text: [{ text: { content: profile.currentRole } }],
    };
  if (profile.background)
    props['Background'] = {
      rich_text: [{ text: { content: profile.background } }],
    };
  if (profile.aiToolsUsed.length > 0)
    props['AI Tools Used'] = {
      multi_select: profile.aiToolsUsed.map((t) => ({ name: t })),
    };
  if (profile.aiGoals)
    props['AI Goals'] = { rich_text: [{ text: { content: profile.aiGoals } }] };
  if (profile.favoriteSnack)
    props['Favorite Snack'] = {
      rich_text: [{ text: { content: profile.favoriteSnack } }],
    };
  if (profile.funFact)
    props['Fun Fact'] = { rich_text: [{ text: { content: profile.funFact } }] };
  if (profile.linkedIn) props['LinkedIn'] = { url: profile.linkedIn };
  if (profile.otherLinks) props['Other Links'] = { url: profile.otherLinks };
  return props;
}

export class AISnackClubBackfill extends BubbleFlow<'webhook/http'> {
  async handle(_payload: WebhookEvent): Promise<Output> {
    // ── Phase 1: Fetch ALL messages from channel beginning ──────────────────
    const allMessages: SlackMessage[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;
    let pagesFetched = 0;

    // Unbounded pagination — keep fetching until has_more is false.
    // Rate-limit: Slack Tier 3 = 50 req/min → sleep 1200ms between pages.
    while (hasMore) {
      const page = await this.fetchSlackBatch(nextCursor);
      const data = page.data as SlackHistoryData | undefined;
      allMessages.push(...(data?.messages ?? []));
      pagesFetched++;
      // Drive loop ONLY on has_more — Slack may omit cursor on last page
      hasMore = data?.has_more === true;
      // Only carry cursor forward when Slack actually provides one
      nextCursor = data?.response_metadata?.next_cursor || undefined;
      // Respect Slack Tier 3 rate limit (50 req/min) between every page
      await sleep(10000);
    }

    // ── Phase 2: Filter to real user messages (top-level only, no thread replies) ──
    const introPosts = allMessages
      .filter(isRealUserMessage)
      .filter((msg) => msg.thread_ts === undefined || msg.thread_ts === msg.ts);

    // ── Phase 3: Process each message → extract profile → create Notion page ─
    const createdNames: string[] = [];
    let failed = 0;

    for (const msg of introPosts) {
      const userId = msg.user!;

      const uResult = await this.fetchUserInfo(userId);
      if (!uResult.success) {
        // All 10 retries exhausted for this user — log and fall back to userId as display name
        console.warn(
          `[fetchUserInfo] Permanently failed for userId=${userId} after max retries: ${uResult.error}. Using userId as display name.`
        );
      }
      const uData = uResult.data as SlackUserData | undefined;
      const displayName =
        uData?.user?.profile?.display_name ||
        uData?.user?.profile?.real_name ||
        uData?.user?.real_name ||
        userId;

      const llmResult = await this.extractProfile(msg.text ?? '', displayName);
      const rawResponse =
        (llmResult.data as { response?: string } | undefined)?.response ?? '';
      const profile = safeParseProfile(rawResponse);

      const createResult = await this.createNotionPage(
        displayName,
        userId,
        profile,
        tsToIsoDate(msg.ts)
      );

      if (createResult.success) {
        createdNames.push(displayName);
      } else {
        // All 5 Notion retries exhausted — log and continue; flow keeps going
        console.warn(
          `[createNotionPage] Permanently failed for user=${displayName} (${userId}) after max retries: ${createResult.error}`
        );
        failed++;
      }
      // Rate-limit guard: Slack get_user_info is Tier 4 (20 req/min) — 1s between
      // iterations keeps us safely under the limit when processing many members.
      await sleep(10000);
    }

    return {
      totalMessages: allMessages.length,
      pagesFetched,
      processed: introPosts.length,
      created: createdNames.length,
      failed,
      names: createdNames,
    };
  }

  // Fetches a page of conversation history with retry-on-rate-limit.
  // Retries up to 10 times per page; cursor is NOT advanced until the page succeeds.
  private async fetchSlackBatch(cursor: string | undefined) {
    return withRetry(
      () =>
        new SlackBubble({
          operation: 'get_conversation_history',
          channel: INTRO_CHANNEL,
          limit: 200,
          oldest: '0',
          ...(cursor ? { cursor } : {}),
        }).action(),
      10,
      30000 // 30 s base delay on non-rate-limit errors; rate-limit uses retry_after
    );
  }

  // Fetches user info with retry-on-rate-limit.
  // Retries up to 10 times; does NOT advance to the next message until success.
  // If all 10 retries fail, returns the last (failed) result so the caller can log + skip.
  private async fetchUserInfo(userId: string) {
    return withRetry(
      () =>
        new SlackBubble({
          operation: 'get_user_info',
          user: userId,
        }).action(),
      10,
      30000 // 30 s between retries for non-rate-limit errors
    );
  }

  private async extractProfile(messageText: string, displayName: string) {
    return new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash-lite',
        temperature: 0.1,
        maxTokens: 1024,
        jsonMode: true,
      },
      systemPrompt: `You are a data extraction assistant. Parse Slack community intro messages and extract structured profile information. Return ONLY valid JSON with no markdown. If a field is not explicitly mentioned, return "" or []. Do NOT infer.`,
      message: `Extract profile data from this Slack intro message by "${displayName}".

Return JSON with exactly these keys:
{
  "location": "",
  "currentRole": "",
  "background": "",
  "aiToolsUsed": [],
  "aiGoals": "",
  "favoriteSnack": "",
  "funFact": "",
  "linkedIn": "",
  "otherLinks": ""
}

Rules:
- location: city/state/country if mentioned
- currentRole: job title and company
- background: professional background summary
- aiToolsUsed: array of specific AI tool names (e.g. "ChatGPT", "Claude", "Midjourney")
- aiGoals: what they want to learn/achieve with AI
- favoriteSnack: their favorite snack if mentioned
- funFact: any fun or interesting personal fact
- linkedIn: full LinkedIn URL if present
- otherLinks: any other URLs comma-separated

Intro message:
---
${messageText}
---`,
      expectedOutputSchema: profileSchema,
    }).action();
  }

  // Creates a Notion page with retry-on-error.
  // Retries up to 5 times with 5 s between attempts.
  // Returns the last result on exhaustion so the caller can log the failure.
  private async createNotionPage(
    name: string,
    slackUserId: string,
    profile: ExtractedProfile,
    introDate: string
  ) {
    const properties = buildNotionProperties(
      name,
      slackUserId,
      profile,
      introDate
    );
    return withRetry(
      () =>
        new NotionBubble({
          operation: 'create_page',
          parent: { type: 'data_source_id', data_source_id: NOTION_DB_ID },
          properties,
        }).action(),
      5,
      5000 // 5 s between Notion retries
    );
  }
}
