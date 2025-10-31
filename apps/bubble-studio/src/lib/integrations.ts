// Centralized mapping of companies/services/models to logo assets
// Assets live under apps/bubble-studio/public/integrations/*.png

export interface IntegrationLogo {
  name: string;
  file: string;
}

// Canonical service names → asset path
export const SERVICE_LOGOS: Readonly<Record<string, string>> = Object.freeze({
  // Integrations
  Slack: '/integrations/slack.svg',
  Postgres: '/integrations/postgres.svg',
  Gmail: '/integrations/gmail.svg',
  'Google Calendar': '/integrations/google-calendar.svg',
  'Google Drive': '/integrations/google-drive.svg',
  'Google Sheets': '/integrations/google-sheets.png',
  Resend: '/integrations/resend.svg',
  Firecrawl: '/integrations/firecrawl.png',
  Cloudflare: '/integrations/cloudflare.svg',
  Reddit: '/integrations/reddit.svg',
  LinkedIn: '/integrations/linkedin.svg',
  YouTube: '/integrations/youtube.svg',
  Instagram: '/integrations/instagram.svg',
  Apify: '/integrations/apify.svg',
  'X (Twitter)': '/integrations/x-twitter.png',
  X: '/integrations/x-twitter.png',
  Twitter: '/integrations/x-twitter.png',

  // AI models (also used as fallbacks for vendor names)
  GPT: '/integrations/gpt.svg',
  Claude: '/integrations/claude.svg',
  Gemini: '/integrations/gemini.svg',
  OpenRouter: '/integrations/openrouter.svg',

  // Vendor aliases that map to model logos
  OpenAI: '/integrations/gpt.svg',
  Anthropic: '/integrations/claude.svg',
  Google: '/integrations/gemini.svg', // Prefer Gemini for generic Google AI
});

// Canonical tool names → asset path
export const TOOL_LOGOS: Readonly<Record<string, string>> = Object.freeze({
  'Research Agent': '/integrations/research-agent.png',
  'AI Agent': '/integrations/ai-agent.png',
  Storage: '/integrations/storage.png',
});

// Expose curated lists for UI sections
export const INTEGRATIONS: IntegrationLogo[] = [
  { name: 'Slack', file: SERVICE_LOGOS['Slack'] },
  { name: 'Postgres', file: SERVICE_LOGOS['Postgres'] },
  { name: 'Gmail', file: SERVICE_LOGOS['Gmail'] },
  { name: 'Google Calendar', file: SERVICE_LOGOS['Google Calendar'] },
  { name: 'Google Drive', file: SERVICE_LOGOS['Google Drive'] },
  { name: 'Google Sheets', file: SERVICE_LOGOS['Google Sheets'] },
  { name: 'Resend', file: SERVICE_LOGOS['Resend'] },
  { name: 'Firecrawl', file: SERVICE_LOGOS['Firecrawl'] },
  { name: 'Cloudflare', file: SERVICE_LOGOS['Cloudflare'] },
  { name: 'LinkedIn', file: SERVICE_LOGOS['LinkedIn'] },
  { name: 'YouTube', file: SERVICE_LOGOS['YouTube'] },
  { name: 'Instagram', file: SERVICE_LOGOS['Instagram'] },
  { name: 'Apify', file: SERVICE_LOGOS['Apify'] },
  { name: 'X (Twitter)', file: SERVICE_LOGOS['X (Twitter)'] },
];

export const AI_MODELS: IntegrationLogo[] = [
  { name: 'GPT', file: SERVICE_LOGOS['GPT'] },
  { name: 'Claude', file: SERVICE_LOGOS['Claude'] },
  { name: 'Gemini', file: SERVICE_LOGOS['Gemini'] },
  { name: 'OpenRouter', file: SERVICE_LOGOS['OpenRouter'] },
];

// Normalization helpers and aliases
const NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  email: 'Resend',
  gmail: 'Gmail',
  gcalendar: 'Google Calendar',
  calendar: 'Google Calendar',
  gdrive: 'Google Drive',
  drive: 'Google Drive',
  sheets: 'Google Sheets',
  sheet: 'Google Sheets',
  spreadsheet: 'Google Sheets',
  postgres: 'Postgres',
  postgresql: 'Postgres',
  pg: 'Postgres',
  openai: 'OpenAI',
  gpt: 'GPT',
  anthropic: 'Anthropic',
  claude: 'Claude',
  gemini: 'Gemini',
  google: 'Google',
  openrouter: 'OpenRouter',
  cloudflare: 'Cloudflare',
  firecrawl: 'Firecrawl',
  slack: 'Slack',
  resend: 'Resend',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  apify: 'Apify',
  'x-twitter': 'X (Twitter)',
  'x-twitter-bubble': 'X (Twitter)',
  xtwitter: 'X (Twitter)',
  twitter: 'X (Twitter)',
  x: 'X (Twitter)',
  'research-agent': 'Research Agent',
  'research-agent-tool': 'Research Agent',
  research: 'Research Agent',
  'ai-agent': 'AI Agent',
  'ai-agent-tool': 'AI Agent',
  ai: 'AI Agent',
  storage: 'Storage',
  'storage-tool': 'Storage',
});

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveLogoByName(name: string): IntegrationLogo | null {
  if (!name) return null;
  const raw = normalize(name);

  // Try direct canonical match first in both logo types
  const allLogos = { ...SERVICE_LOGOS, ...TOOL_LOGOS };
  for (const canonical of Object.keys(allLogos)) {
    if (normalize(canonical) === raw) {
      return { name: canonical, file: allLogos[canonical] };
    }
  }

  // Then alias mapping
  const alias = NAME_ALIASES[raw];
  if (alias && allLogos[alias]) {
    return { name: alias, file: allLogos[alias] };
  }

  // Try partial contains on canonical names
  const canonicalFallback = Object.keys(allLogos).find((k) =>
    normalize(k).includes(raw)
  );
  if (canonicalFallback) {
    return { name: canonicalFallback, file: allLogos[canonicalFallback] };
  }

  return null;
}

type MinimalBubble = {
  bubbleName?: string;
  className?: string;
  variableName?: string;
};

// Heuristic to find an appropriate logo for a bubble using its identifiers
export function findLogoForBubble(
  bubble: MinimalBubble
): IntegrationLogo | null {
  const haystack = [bubble.className, bubble.bubbleName, bubble.variableName]
    .filter(Boolean)
    .map((s) => s as string)
    .join(' ')
    .toLowerCase();

  if (!haystack) return null;

  // Ordered keyword → canonical name matching (first hit wins)
  const orderedMatchers: Array<[RegExp, string]> = [
    [/\bslack\b/, 'Slack'],
    [/\b(postgres|postgresql|pg)\b/, 'Postgres'],
    [/\bgmail\b/, 'Gmail'],
    [/\bgoogle\s*calendar\b|\bcalendar\b/, 'Google Calendar'],
    [/\bgoogle\s*drive\b|\bdrive\b/, 'Google Drive'],
    [/\bgoogle\s*sheets?\b|\bsheets?\b|\bspreadsheet\b/, 'Google Sheets'],
    [/\bresend\b|\bemail\b/, 'Resend'],
    [/\bfirecrawl\b/, 'Firecrawl'],
    [/\bcloudflare\b/, 'Cloudflare'],
    [/\bopenrouter\b/, 'OpenRouter'],
    [/\blinkedin\b/, 'LinkedIn'],
    [/\byoutube\b/, 'YouTube'],
    [/\binstagram\b/, 'Instagram'],
    [/\bapify\b/, 'Apify'],
    [/\b(x|twitter|x-twitter|xtwitter)\b/, 'X (Twitter)'],
    [/\bopenai\b|\bgpt\b/, 'GPT'],
    [/\banthropic\b|\bclaude\b/, 'Claude'],
    [/\bgemini\b/, 'Gemini'],
    [/\breddit\b/, 'Reddit'],
    [/\bresearch\s*agent\b|\bresearch-agent\b/, 'Research Agent'],
    [/\bai\s*agent\b|\bai-agent\b/, 'AI Agent'],
    [/\bstorage\b/, 'Storage'],
  ];

  const allLogos = { ...SERVICE_LOGOS, ...TOOL_LOGOS };

  for (const [regex, canonical] of orderedMatchers) {
    if (regex.test(haystack)) {
      return { name: canonical, file: allLogos[canonical] };
    }
  }

  // As a final attempt, split by non-letters and try alias/name resolution
  const tokens = haystack.split(/[^a-z0-9]+/g).filter(Boolean);
  for (const t of tokens) {
    const byAlias = NAME_ALIASES[t];
    if (byAlias && allLogos[byAlias]) {
      return { name: byAlias, file: allLogos[byAlias] };
    }
  }

  return null;
}

// Resolve a documentation URL on docs.bubblelab.ai for a given bubble
export function findDocsUrlForBubble(bubble: MinimalBubble): string | null {
  const DOCS_BASE_URL = 'https://docs.bubblelab.ai';

  if (!bubble) return null;

  const normalizeKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const classKey = bubble.className ? normalizeKey(bubble.className) : '';
  const nameKey = bubble.bubbleName ? normalizeKey(bubble.bubbleName) : '';

  // Known service bubble docs keyed by className
  const SERVICE_DOCS_BY_CLASS: Readonly<Record<string, string>> = Object.freeze(
    {
      aiagentbubble: 'ai-agent-bubble',
      gmailbubble: 'gmail-bubble',
      googlecalendarbubble: 'google-calendar-bubble',
      googledrivebubble: 'google-drive-bubble',
      googlesheetsbubble: 'google-sheets-bubble',
      helloworldbubble: 'hello-world-bubble',
      httpbubble: 'http-bubble',
      postgresqlbubble: 'postgresql-bubble',
      resendbubble: 'resend-bubble',
      slackbubble: 'slack-bubble',
      slackformatteragentbubble: 'slack-formatter-agent-bubble',
      storagebubble: 'storage-bubble',
      xtwitterbubble: 'x-twitter-bubble',
    }
  );

  // Known tool bubble docs keyed by className
  const TOOL_DOCS_BY_CLASS: Readonly<Record<string, string>> = Object.freeze({
    bubbleflowvalidationtool: 'bubbleflow-validation-tool',
    getbubbledetailstool: 'get-bubble-details-tool',
    listbubblestool: 'list-bubbles-tool',
    redditscrapetool: 'reddit-scrape-tool',
    researchagenttool: 'research-agent-tool',
    sqlquerytool: 'sql-query-tool',
    webcrawltool: 'web-crawl-tool',
    webextracttool: 'web-extract-tool',
    webscrapetool: 'web-scrape-tool',
    websearchtool: 'web-search-tool',
  });

  // Known service docs keyed by bubbleName variants
  const SERVICE_DOCS_BY_NAME: Readonly<Record<string, string>> = Object.freeze({
    aiagent: 'ai-agent-bubble',
    'ai-agent': 'ai-agent-bubble',
    postgresql: 'postgresql-bubble',
    postgres: 'postgresql-bubble',
    pg: 'postgresql-bubble',
    gmail: 'gmail-bubble',
    googlecalendar: 'google-calendar-bubble',
    'google-calendar': 'google-calendar-bubble',
    googledrive: 'google-drive-bubble',
    'google-drive': 'google-drive-bubble',
    googlesheets: 'google-sheets-bubble',
    'google-sheets': 'google-sheets-bubble',
    resend: 'resend-bubble',
    http: 'http-bubble',
    'hello-world': 'hello-world-bubble',
    helloworld: 'hello-world-bubble',
    slack: 'slack-bubble',
    'slack-formatter-agent': 'slack-formatter-agent-bubble',
    slackformatteragent: 'slack-formatter-agent-bubble',
    storage: 'storage-bubble',
    'x-twitter': 'x-twitter-bubble',
    xtwitter: 'x-twitter-bubble',
    twitter: 'x-twitter-bubble',
    x: 'x-twitter-bubble',
  });

  // Known tool docs keyed by bubbleName variants
  const TOOL_DOCS_BY_NAME: Readonly<Record<string, string>> = Object.freeze({
    'reddit-scrape-tool': 'reddit-scrape-tool',
    redditscrapetool: 'reddit-scrape-tool',
    'research-agent-tool': 'research-agent-tool',
    researchagenttool: 'research-agent-tool',
    'sql-query-tool': 'sql-query-tool',
    sqlquerytool: 'sql-query-tool',
    'web-crawl-tool': 'web-crawl-tool',
    webcrawltool: 'web-crawl-tool',
    'web-extract-tool': 'web-extract-tool',
    webextracttool: 'web-extract-tool',
    'web-scrape-tool': 'web-scrape-tool',
    webscrapetool: 'web-scrape-tool',
    'web-search-tool': 'web-search-tool',
    websearchtool: 'web-search-tool',
    'bubbleflow-validation-tool': 'bubbleflow-validation-tool',
    bubbleflowvalidationtool: 'bubbleflow-validation-tool',
    'get-bubble-details-tool': 'get-bubble-details-tool',
    getbubbledetailstool: 'get-bubble-details-tool',
    'list-bubbles-tool': 'list-bubbles-tool',
    listbubblestool: 'list-bubbles-tool',
  });

  // Class-based lookup first (most reliable)
  if (classKey && SERVICE_DOCS_BY_CLASS[classKey]) {
    return `${DOCS_BASE_URL}/bubbles/service-bubbles/${SERVICE_DOCS_BY_CLASS[classKey]}`;
  }
  if (classKey && TOOL_DOCS_BY_CLASS[classKey]) {
    return `${DOCS_BASE_URL}/bubbles/tool-bubbles/${TOOL_DOCS_BY_CLASS[classKey]}`;
  }

  // Name-based lookup fallback
  if (nameKey && SERVICE_DOCS_BY_NAME[nameKey]) {
    return `${DOCS_BASE_URL}/bubbles/service-bubbles/${SERVICE_DOCS_BY_NAME[nameKey]}`;
  }
  if (nameKey && TOOL_DOCS_BY_NAME[nameKey]) {
    return `${DOCS_BASE_URL}/bubbles/tool-bubbles/${TOOL_DOCS_BY_NAME[nameKey]}`;
  }

  // No known doc for this bubble
  return null;
}
