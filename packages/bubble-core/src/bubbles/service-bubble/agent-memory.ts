import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type AgentMemoryMap = Record<string, string>;

export type AgentMemoryUpdateCallback = (
  filePath: string,
  content: string
) => Promise<void>;

/**
 * A function that calls an LLM and returns the response text.
 * Provided by the caller (AIAgentBubble) so all LLM calls go through the same infrastructure.
 */
export type LLMCallFn = (prompt: string) => Promise<string>;

interface TopicIndexEntry {
  name: string;
  slug: string;
  aliases: string[];
}

interface EventIndexEntry {
  date: string;
  summary: string;
}

// ============================================================================
// Constants
// ============================================================================

const CORE_FILES = ['soul.md', 'identity.md', 'agents.md'] as const;
const TOPIC_INDEX = 'topics/_index.json';
const EVENT_INDEX = 'events/_index.json';

/** Maximum number of recent events to show in the auto-injected index */
const MAX_RECENT_EVENTS = 20;

// ============================================================================
// System Prompt Formatting
// ============================================================================

/**
 * Format the core memory files + indexes for injection into the system prompt.
 * This is always injected — it's the agent's identity and awareness of what it knows.
 */
export function formatCoreMemoryForPrompt(memory: AgentMemoryMap): string {
  const sections: string[] = [];

  // --- Topics and events FIRST — the agent needs awareness before anything else ---

  // Topic index — what topics the bot knows about
  const topicIndex = parseJsonSafe<TopicIndexEntry[]>(memory[TOPIC_INDEX], []);
  const topicHint =
    "_Call recall_memory with a name listed above to get full details. Use create_memory to save new people and topics. If someone isn't listed, create a topic for them now._";
  if (topicIndex.length > 0) {
    const topicList = topicIndex
      .map((t) => {
        const aliasStr =
          t.aliases.length > 0 ? ` (also: ${t.aliases.join(', ')})` : '';
        return `- ${t.name}${aliasStr}`;
      })
      .join('\n');
    sections.push(`## Known Topics\n\n${topicList}\n\n${topicHint}`);
  } else {
    sections.push(
      `## Known Topics\n\n_(empty — you haven't met anyone yet.)_\n\n${topicHint}`
    );
  }

  // Event index — recent events (most recent first)
  const eventIndex = parseJsonSafe<EventIndexEntry[]>(memory[EVENT_INDEX], []);
  if (eventIndex.length > 0) {
    const recentEvents = eventIndex.slice(-MAX_RECENT_EVENTS);
    const eventList = recentEvents
      .reverse()
      .map((e) => `- ${e.date}: ${e.summary}`)
      .join('\n');
    sections.push(
      `## Recent Events\n\n${eventList}\n\n_Call recall_memory with a date listed above to get the full event log._`
    );
  }

  // --- Core identity files after indexes ---
  for (const file of CORE_FILES) {
    const content = memory[file];
    if (content) {
      sections.push(content);
    }
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Self-improvement prompt appended to the system prompt.
 */
export const MEMORY_SELF_IMPROVEMENT_PROMPT = `You have persistent memory across conversations. Your known topics, recent events, and core identity are above.

## Before You Respond

**Always recall first.** Before responding to the user or delegating to a capability, use recall_memory to retrieve full details about any people or topics mentioned in the conversation. The indexes above are summaries — the full context is in the topic files. Don't respond with partial knowledge when you could look it up.

## Remembering

You have two memory tools:

**create_memory** — Create a new memory file for someone or something you haven't seen before:
- People & topics: file="topics/{slug}.md", content="...", topicName="Sarah Chen", topicAliases=["Sarah"]
- Events: file="events/2025-02-15.md", content="...", eventSummary="Met Sarah, discussed Redis caching"

**update_memory** — Add new information to an existing memory file:
- file="topics/sarah-chen.md", content="Prefers bullet points over paragraphs"

When you meet someone new who isn't in your Known Topics, create a topic for them immediately with the specific date (e.g., "Met on 2025-02-15, PST timezone"). Always use the actual date, never say "today".

Your personality (soul.md) and identity (identity.md) evolve automatically after each conversation — you don't need to update those yourself.

## Delegating

When delegating to a capability, include relevant context from memory (timezone, preferences, prior decisions) in your task description. The capability agent doesn't have access to your memory.`;

// ============================================================================
// Auto-Recall Person Topics
// ============================================================================

/**
 * Extracts person names from conversation history and returns matching topic content.
 * Conversation history messages have the format: "[Name (timezone)]: message" or "[Name]: message"
 */
export function autoRecallPersonTopics(
  memory: AgentMemoryMap,
  conversationHistory: Array<{ role: string; content: string }>
): string {
  if (!conversationHistory.length) return '';

  const topicIndex = parseJsonSafe<TopicIndexEntry[]>(memory[TOPIC_INDEX], []);
  if (topicIndex.length === 0) return '';

  // Extract unique person names from conversation history
  const namePattern = /^\[([^\]]+?)(?:\s*\([^)]*\))?\]:/;
  const personNames = new Set<string>();
  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      const match = msg.content.match(namePattern);
      if (match?.[1]) {
        personNames.add(match[1].trim());
      }
    }
  }

  if (personNames.size === 0) return '';

  // Match names against topic index (name + aliases)
  const matchedTopics: string[] = [];
  const matchedSlugs = new Set<string>();

  for (const name of personNames) {
    const nameLower = name.toLowerCase();
    for (const topic of topicIndex) {
      if (matchedSlugs.has(topic.slug)) continue;

      const matchesName = topic.name.toLowerCase() === nameLower;
      const matchesAlias = topic.aliases.some(
        (a) => a.toLowerCase() === nameLower
      );

      if (matchesName || matchesAlias) {
        const filePath = `topics/${topic.slug}.md`;
        const content = memory[filePath];
        if (content) {
          matchedTopics.push(`### ${topic.name}\n\n${content}`);
          matchedSlugs.add(topic.slug);
        }
      }
    }
  }

  if (matchedTopics.length === 0) return '';

  return `## People in This Conversation\n\n${matchedTopics.join('\n\n')}`;
}

// ============================================================================
// recall_memory Tool
// ============================================================================

/**
 * Build the recall_memory custom tool.
 * Uses simple keyword/alias matching to find relevant files,
 * then returns their combined content.
 */
export function buildMemoryRecallTool(memory: AgentMemoryMap) {
  return {
    name: 'recall_memory',
    description:
      'Look up details from your persistent memory — a person, topic, project, date, or concept. Returns the full content of matching memory files.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'What you want to remember — a person, topic, date, or concept'
        ),
    }),
    func: async (input: Record<string, unknown>): Promise<string> => {
      const query = input.query as string;
      const results: string[] = [];
      const queryLower = query.toLowerCase();

      // 1. Check topic index for matching topics
      const topicIndex = parseJsonSafe<TopicIndexEntry[]>(
        memory[TOPIC_INDEX],
        []
      );
      for (const topic of topicIndex) {
        const matchesName = topic.name.toLowerCase().includes(queryLower);
        const matchesSlug = topic.slug.includes(queryLower);
        const matchesAlias = topic.aliases.some((a) =>
          a.toLowerCase().includes(queryLower)
        );
        if (matchesName || matchesSlug || matchesAlias) {
          const filePath = `topics/${topic.slug}.md`;
          const content = memory[filePath];
          if (content) {
            results.push(`## ${topic.name}\n\n${content}`);
          }
        }
      }

      // 2. Check event index for matching dates or summaries
      const eventIndex = parseJsonSafe<EventIndexEntry[]>(
        memory[EVENT_INDEX],
        []
      );

      // Try date-based matching (YYYY-MM-DD, "yesterday", "today", "last week", etc.)
      const dateMatches = findMatchingDates(queryLower, eventIndex);
      for (const date of dateMatches) {
        const filePath = `events/${date}.md`;
        const content = memory[filePath];
        if (content) {
          results.push(`## Events — ${date}\n\n${content}`);
        }
      }

      // Also check event summaries for keyword matches
      for (const event of eventIndex) {
        if (
          !dateMatches.includes(event.date) &&
          event.summary.toLowerCase().includes(queryLower)
        ) {
          const filePath = `events/${event.date}.md`;
          const content = memory[filePath];
          if (content) {
            results.push(`## Events — ${event.date}\n\n${content}`);
          }
        }
      }

      // 3. Search all topic files directly for keyword matches (fallback)
      if (results.length === 0) {
        for (const [path, content] of Object.entries(memory)) {
          if (
            path.startsWith('topics/') &&
            path !== TOPIC_INDEX &&
            content.toLowerCase().includes(queryLower)
          ) {
            const slug = path.replace('topics/', '').replace('.md', '');
            const topicEntry = topicIndex.find((t) => t.slug === slug);
            const label = topicEntry?.name ?? slug;
            results.push(`## ${label}\n\n${content}`);
          }
        }
      }

      if (results.length === 0) {
        return `No memory found matching "${query}". You may not have saved anything about this yet.`;
      }

      return results.join('\n\n---\n\n');
    },
  };
}

// ============================================================================
// create_memory Tool
// ============================================================================

/**
 * Build the create_memory custom tool.
 * Creates new topic/event files and updates indexes.
 * Zero LLM calls — direct file write + index update.
 */
export function buildMemoryCreateTool(
  memory: AgentMemoryMap,
  updateCallback: AgentMemoryUpdateCallback
) {
  return {
    name: 'create_memory',
    description:
      "Create a new memory file for a person, topic, project, or event. Use this when someone or something isn't in your Known Topics or Recent Events yet.",
    schema: z.object({
      file: z
        .string()
        .describe(
          'Path for the new file. ' +
            'Topics: "topics/{slug}.md" (e.g., "topics/sarah-chen.md"). ' +
            'Events: "events/{YYYY-MM-DD}.md" (e.g., "events/2025-02-15.md").'
        ),
      content: z.string().describe('Initial content for this memory file'),
      topicName: z
        .string()
        .optional()
        .describe(
          'Required for new topics. Human-readable name (e.g., "Sarah Chen")'
        ),
      topicAliases: z
        .array(z.string())
        .optional()
        .describe(
          'Optional nicknames/short names for new topics (e.g., ["Sarah"])'
        ),
      eventSummary: z
        .string()
        .optional()
        .describe(
          'Required for new events. One-line summary for the event index (e.g., "Met Sarah, discussed Redis caching")'
        ),
    }),
    func: async (input: Record<string, unknown>): Promise<string> => {
      try {
        const file = input.file as string;
        const content = input.content as string;
        const topicName = input.topicName as string | undefined;
        const topicAliases = (input.topicAliases as string[] | undefined) ?? [];
        const eventSummary = input.eventSummary as string | undefined;

        // Reject core files
        if (CORE_FILES.some((f) => file === f || file.endsWith(`/${f}`))) {
          return 'Cannot create core files. soul.md, identity.md, and agents.md are updated automatically.';
        }

        // Validate path prefix
        if (!file.startsWith('topics/') && !file.startsWith('events/')) {
          return 'File path must start with "topics/" or "events/".';
        }

        // Check file doesn't already exist
        if (file in memory) {
          return 'File already exists. Use update_memory to add to it.';
        }

        if (file.startsWith('topics/')) {
          // --- Create topic ---
          if (!topicName) {
            return 'topicName is required when creating a new topic.';
          }

          const slug = file.replace('topics/', '').replace('.md', '');

          // Save content
          memory[file] = content;
          await updateCallback(file, content);

          // Update topic index
          const topicIndex = parseJsonSafe<TopicIndexEntry[]>(
            memory[TOPIC_INDEX],
            []
          );
          topicIndex.push({
            name: topicName,
            slug,
            aliases: topicAliases,
          });
          const indexStr = JSON.stringify(topicIndex);
          memory[TOPIC_INDEX] = indexStr;
          await updateCallback(TOPIC_INDEX, indexStr);

          console.log(`[agent-memory] Created topic: ${topicName} (${slug})`);
          return `Created ${file}`;
        } else {
          // --- Create event ---
          const date = file.replace('events/', '').replace('.md', '');
          const summary = eventSummary ?? content.slice(0, 80);

          // Save content
          const formatted = `# ${date}\n\n- ${content}`;
          memory[file] = formatted;
          await updateCallback(file, formatted);

          // Update event index
          const eventIndex = parseJsonSafe<EventIndexEntry[]>(
            memory[EVENT_INDEX],
            []
          );
          eventIndex.push({ date, summary });
          const indexStr = JSON.stringify(eventIndex);
          memory[EVENT_INDEX] = indexStr;
          await updateCallback(EVENT_INDEX, indexStr);

          console.log(`[agent-memory] Created event: ${date} — ${summary}`);
          return `Created ${file}`;
        }
      } catch (err) {
        console.error('[agent-memory] create_memory error:', err);
        return `Failed to create memory: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}

// ============================================================================
// update_memory Tool
// ============================================================================

/**
 * Build the update_memory custom tool.
 * Updates existing topic/event files. Uses callLLM only for merging topic content.
 * No routing LLM — the master agent decides which file to target.
 */
export function buildMemoryUpdateTool(
  memory: AgentMemoryMap,
  updateCallback: AgentMemoryUpdateCallback,
  callLLM: LLMCallFn
) {
  return {
    name: 'update_memory',
    description:
      'Update an existing memory file with new information. The new content will be intelligently merged with existing content. Also updates the index summary if the change is significant.',
    schema: z.object({
      file: z
        .string()
        .describe(
          'Path to the existing file to update. ' +
            'Topics: "topics/{slug}.md". Events: "events/{YYYY-MM-DD}.md".'
        ),
      content: z.string().describe('New information to merge into the file'),
    }),
    func: async (input: Record<string, unknown>): Promise<string> => {
      try {
        const file = input.file as string;
        const content = input.content as string;

        // Reject core files
        if (CORE_FILES.some((f) => file === f || file.endsWith(`/${f}`))) {
          return 'Core identity files (soul.md, identity.md, agents.md) are updated automatically after each conversation.';
        }

        // Check file exists
        if (!(file in memory)) {
          // Build helpful error with available files
          const topicIndex = parseJsonSafe<TopicIndexEntry[]>(
            memory[TOPIC_INDEX],
            []
          );
          const eventIndex = parseJsonSafe<EventIndexEntry[]>(
            memory[EVENT_INDEX],
            []
          );
          const topicSlugs = topicIndex.map((t) => t.slug).join(', ');
          const eventDates = eventIndex.map((e) => e.date).join(', ');
          return (
            `File "${file}" not found. Available memory files:\n` +
            `Topics: ${topicSlugs || '(none)'}\n` +
            `Events: ${eventDates || '(none)'}\n` +
            'Use create_memory to create a new file, or check the slug.'
          );
        }

        if (file.startsWith('topics/')) {
          // --- Update topic: merge content via LLM ---
          const existing = memory[file];
          const updated = await mergeMemoryContent(existing, content, callLLM);
          memory[file] = updated;
          await updateCallback(file, updated);

          console.log(`[agent-memory] Updated topic: ${file}`);
          return `Updated ${file}`;
        } else if (file.startsWith('events/')) {
          // --- Update event: append content ---
          const existing = memory[file];
          const updated = `${existing}\n\n- ${content}`;
          memory[file] = updated;
          await updateCallback(file, updated);

          // Update event index summary
          const date = file.replace('events/', '').replace('.md', '');
          const eventIndex = parseJsonSafe<EventIndexEntry[]>(
            memory[EVENT_INDEX],
            []
          );
          const existingIdx = eventIndex.findIndex((e) => e.date === date);
          if (existingIdx >= 0) {
            eventIndex[existingIdx].summary += `; ${content.slice(0, 60)}`;
            const indexStr = JSON.stringify(eventIndex);
            memory[EVENT_INDEX] = indexStr;
            await updateCallback(EVENT_INDEX, indexStr);
          }

          console.log(`[agent-memory] Updated event: ${file}`);
          return `Updated ${file}`;
        } else {
          return 'File path must start with "topics/" or "events/".';
        }
      } catch (err) {
        console.error('[agent-memory] update_memory error:', err);
        return `Failed to update memory: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}

// ============================================================================
// Post-Execution Memory Reflection
// ============================================================================

interface ConversationMessage {
  role: string;
  content: string;
}

/**
 * Run a post-execution reflection over the conversation.
 * Only updates soul.md and identity.md — implicit personality shaping.
 * Topics and events are left for the agent to update explicitly via update_memory.
 * Called after the agent finishes responding.
 */
export async function runMemoryReflection(
  conversationMessages: ConversationMessage[],
  memory: AgentMemoryMap,
  updateCallback: AgentMemoryUpdateCallback,
  callLLM: LLMCallFn
): Promise<void> {
  if (conversationMessages.length === 0) return;

  // Build conversation transcript
  const transcript = conversationMessages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n');

  const currentSoul = memory['soul.md'] ?? '';
  const currentIdentity = memory['identity.md'] ?? '';

  const reflectionPrompt = `You are a personality reflection system. Review this conversation and determine if anything should be added to the bot's core personality or identity files.

These files shape who the bot IS — not what it knows. They're updated implicitly based on how conversations go.

Current soul.md (personality, values, communication style):
---
${currentSoul || '(empty)'}
---

Current identity.md (name, role, workspace context):
---
${currentIdentity || '(empty)'}
---

Conversation:
${transcript}

What belongs in soul.md:
- Personality traits that develop from interactions — if users are playful, the bot can become more witty; if conversations are technical, the bot can lean into precision
- Communication style preferences revealed by user feedback ("be more concise", "use emoji", "be more casual")
- Corrections to the bot's tone or behavior ("don't be so formal", "stop apologizing")
- Values or principles that emerge from interactions
- The bot's evolving character — humor style, quirks, interests that make it feel like a real teammate

What belongs in identity.md:
- The bot's name if mentioned ("your name is X", "call yourself X")
- Its role in this workspace ("you help the engineering team", "you're our project manager")
- Workspace-specific context ("we're a startup", "we use Jira")

What does NOT belong here:
- Facts about people (those go in topics via create_memory / update_memory)
- Events or decisions (those go in events via create_memory / update_memory)
- Casual remarks, jokes, compliments, greetings
- Anything the bot already knows from current files

Respond in JSON:
{
  "soul_update": "description of what to add/change in soul.md, or null if nothing",
  "identity_update": "description of what to add/change in identity.md, or null if nothing"
}

Most conversations should return: { "soul_update": null, "identity_update": null }`;

  try {
    const result = await callLLM(reflectionPrompt);
    const parsed = parseJsonFromLLM<{
      soul_update: string | null;
      identity_update: string | null;
    }>(result);

    if (!parsed) {
      console.log('[agent-memory] Reflection: could not parse result');
      return;
    }

    if (!parsed.soul_update && !parsed.identity_update) {
      console.log('[agent-memory] Reflection: no personality updates needed');
      return;
    }

    // Apply soul.md update
    if (parsed.soul_update) {
      try {
        const updated = await mergeMemoryContent(
          currentSoul,
          parsed.soul_update,
          callLLM
        );
        memory['soul.md'] = updated;
        await updateCallback('soul.md', updated);
        console.log(
          `[agent-memory] Reflection updated soul.md: "${parsed.soul_update}"`
        );
      } catch (err) {
        console.error('[agent-memory] Failed to update soul.md:', err);
      }
    }

    // Apply identity.md update
    if (parsed.identity_update) {
      try {
        const updated = await mergeMemoryContent(
          currentIdentity,
          parsed.identity_update,
          callLLM
        );
        memory['identity.md'] = updated;
        await updateCallback('identity.md', updated);
        console.log(
          `[agent-memory] Reflection updated identity.md: "${parsed.identity_update}"`
        );
      } catch (err) {
        console.error('[agent-memory] Failed to update identity.md:', err);
      }
    }
  } catch (err) {
    console.error('[agent-memory] Reflection failed:', err);
  }
}

// ============================================================================
// LLM Content Merge
// ============================================================================

/**
 * Merge a change into existing file content using an LLM call.
 * If the existing content is empty, just returns the change formatted nicely.
 */
async function mergeMemoryContent(
  existing: string,
  change: string,
  callLLM: LLMCallFn
): Promise<string> {
  if (!existing.trim()) {
    return change;
  }

  const mergePrompt = `You are a memory file editor. Merge the new information into the existing markdown content.

Existing content:
---
${existing}
---

New information to integrate: "${change}"

Rules:
- Preserve the existing markdown structure and formatting exactly
- Add new information in the appropriate place
- If the new info updates or contradicts existing content, replace the old info
- If the new info is already present, don't duplicate it
- Keep the content concise and well-organized
- Return ONLY the raw updated markdown content — no JSON, no wrapping, no explanations
- Do NOT wrap the output in a JSON object or any other structure

Updated markdown content:`;

  const result = await callLLM(mergePrompt);

  // Clean any code block wrappers
  let cleaned = result
    .replace(/^```(?:markdown|md)?\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .trim();

  // Safety: if the LLM returned JSON instead of markdown, try to extract the text content
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      // Try common keys the LLM might use
      const textValue =
        parsed.content ?? parsed.description ?? parsed.text ?? parsed.result;
      if (typeof textValue === 'string') {
        // Reconstruct: if there's a title field, prepend it
        const title = parsed.title;
        cleaned =
          typeof title === 'string' ? `${title}\n\n${textValue}` : textValue;
      }
    } catch {
      // Not valid JSON, keep as-is
    }
  }

  return cleaned || existing;
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseJsonFromLLM<T>(raw: string): T | null {
  if (!raw) return null;

  // Try direct parse first
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch?.[1]) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // fall through
      }
    }

    // Try finding JSON object in the text
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        // fall through
      }
    }
  }

  return null;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Find matching dates from the event index based on a query.
 * Handles YYYY-MM-DD format directly.
 */
function findMatchingDates(
  query: string,
  eventIndex: EventIndexEntry[]
): string[] {
  const matches: string[] = [];

  // Direct date match (YYYY-MM-DD)
  const datePattern = /\d{4}-\d{2}-\d{2}/;
  const dateMatch = query.match(datePattern);
  if (dateMatch) {
    const date = dateMatch[0];
    if (eventIndex.some((e) => e.date === date)) {
      matches.push(date);
    }
    return matches;
  }

  // Relative date matching
  const today = new Date();
  const todayStr = getTodayDate();

  if (query.includes('today')) {
    if (eventIndex.some((e) => e.date === todayStr)) {
      matches.push(todayStr);
    }
  }

  if (query.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (eventIndex.some((e) => e.date === yesterdayStr)) {
      matches.push(yesterdayStr);
    }
  }

  if (query.includes('last week') || query.includes('this week')) {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    for (const event of eventIndex) {
      if (event.date >= weekAgo.toISOString().split('T')[0]) {
        matches.push(event.date);
      }
    }
  }

  return [...new Set(matches)];
}
