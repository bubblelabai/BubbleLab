// Centralized mapping of companies/services/models to logo assets
import type { BubbleName } from '@bubblelab/shared-schemas';

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
  GitHub: '/integrations/github.svg',
  ElevenLabs: '/integrations/elevenlabs.png', // Placeholder path
  'Follow Up Boss': '/integrations/FUB.png',
  'AGI Inc': '/integrations/agi-inc.svg',
  Telegram: '/integrations/telegram.svg',
  Airtable: '/integrations/airtable.png',
  Notion: '/integrations/notion.svg',
  InsForge: '/integrations/insforge.svg',

  // AI models (also used as fallbacks for vendor names)
  GPT: '/integrations/gpt.svg',
  Claude: '/integrations/claude.svg',
  Gemini: '/integrations/gemini.svg',
  OpenRouter: '/integrations/openrouter.svg',

  // Vendor aliases that map to model logos
  OpenAI: '/integrations/gpt.svg',
  Anthropic: '/integrations/claude.svg',
  Google: '/integrations/gemini.svg', // Prefer Gemini for generic Google AI
  Twitter: '/integrations/twitter.png',
  X: '/integrations/x.png',
  TikTok: '/integrations/tiktok.png',
});

// Canonical tool names → asset path
export const TOOL_LOGOS: Readonly<Record<string, string>> = Object.freeze({
  'Research Agent': '/integrations/research-agent.png',
  'AI Agent': '/integrations/ai-agent.png',
  Storage: '/integrations/storage.png',
  'Web Search': '/integrations/web-search.png',
  'Web Scrape': '/integrations/web-scrape.png',
  'Web Crawl': '/integrations/web-crawl.png',
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
  { name: 'Apify', file: SERVICE_LOGOS['Apify'] },
  { name: 'GitHub', file: SERVICE_LOGOS['GitHub'] },
  { name: 'ElevenLabs', file: SERVICE_LOGOS['ElevenLabs'] },
  { name: 'Follow Up Boss', file: SERVICE_LOGOS['Follow Up Boss'] },
  { name: 'Telegram', file: SERVICE_LOGOS['Telegram'] },
  { name: 'Airtable', file: SERVICE_LOGOS['Airtable'] },
  { name: 'Notion', file: SERVICE_LOGOS['Notion'] },
  { name: 'InsForge', file: SERVICE_LOGOS['InsForge'] },
];

// Scraping services (Apify actors and general web scraping)
export const SCRAPING_SERVICES: IntegrationLogo[] = [
  { name: 'LinkedIn', file: SERVICE_LOGOS['LinkedIn'] },
  { name: 'YouTube', file: SERVICE_LOGOS['YouTube'] },
  { name: 'Instagram', file: SERVICE_LOGOS['Instagram'] },
  { name: 'Reddit', file: SERVICE_LOGOS['Reddit'] },
  { name: 'TikTok', file: SERVICE_LOGOS['TikTok'] },
  { name: 'X', file: SERVICE_LOGOS['X'] },
  { name: 'Websites', file: TOOL_LOGOS['Web Scrape'] },
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
  'google-calendar': 'Google Calendar',
  gdrive: 'Google Drive',
  drive: 'Google Drive',
  'google-drive': 'Google Drive',
  sheets: 'Google Sheets',
  sheet: 'Google Sheets',
  spreadsheet: 'Google Sheets',
  'google-sheets': 'Google Sheets',
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
  'linkedin-tool': 'LinkedIn',
  youtube: 'YouTube',
  'youtube-tool': 'YouTube',
  instagram: 'Instagram',
  'instagram-tool': 'Instagram',
  apify: 'Apify',
  github: 'GitHub',
  elevenlabs: 'ElevenLabs',
  'eleven-labs': 'ElevenLabs',
  followupboss: 'Follow Up Boss',
  fub: 'Follow Up Boss',
  'follow-up-boss': 'Follow Up Boss',
  'agi-inc': 'AGI Inc',
  agiinc: 'AGI Inc',
  agi: 'AGI Inc',
  telegram: 'Telegram',
  airtable: 'Airtable',
  notion: 'Notion',
  insforge: 'InsForge',
  'insforge-db': 'InsForge',
  'research-agent': 'Research Agent',
  'research-agent-tool': 'Research Agent',
  research: 'Research Agent',
  'ai-agent': 'AI Agent',
  'ai-agent-tool': 'AI Agent',
  ai: 'AI Agent',
  storage: 'Storage',
  'storage-tool': 'Storage',
  'web-search': 'Web Search',
  'web-search-tool': 'Web Search',
  websearch: 'Web Search',
  search: 'Web Search',
  'web-scrape': 'Web Scrape',
  'web-scrape-tool': 'Web Scrape',
  webscrape: 'Web Scrape',
  scrape: 'Web Scrape',
  'web-crawl': 'Web Crawl',
  'web-crawl-tool': 'Web Crawl',
  webcrawl: 'Web Crawl',
  crawl: 'Web Crawl',
  'web-extract-tool': 'Web Scrape',
  twitter: 'Twitter',
  'twitter-tool': 'Twitter',
  tiktok: 'TikTok',
  'tiktok-tool': 'TikTok',
  'google-maps': 'Google Maps Tool',
  'google-maps-tool': 'Google Maps Tool',
  'hello-world': 'Hello World',
  http: 'HTTP',
  'slack-formatter-agent': 'Slack',
  'database-analyzer': 'Database Analyzer',
  'slack-notifier': 'Slack',
  'get-bubble-details-tool': 'Bubble Details',
  'list-bubbles-tool': 'List Bubbles',
  'sql-query-tool': 'SQL Query',
  'chart-js-tool': 'Chart.js',
  'reddit-scrape-tool': 'Reddit',
  'slack-data-assistant': 'Slack',
  'bubbleflow-code-generator': 'Bubbleflow Generator',
  'bubbleflow-generator': 'Bubbleflow Generator',
  'pdf-form-operations': 'PDF Form',
  'pdf-ocr-workflow': 'PDF OCR',
  'generate-document-workflow': 'Document Generator',
  'parse-document-workflow': 'Document Parser',
  'bubbleflow-validation-tool': 'Bubbleflow Validation',
  'code-edit-tool': 'Code Edit',
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
    [/\bgithub\b/, 'GitHub'],
    [/\belevenlabs\b|\beleven-labs\b/, 'ElevenLabs'],
    [/\bfollow\s*up\s*boss\b|\bfollowupboss\b|\bfub\b/, 'Follow Up Boss'],
    [/\bagi\s*inc\b|\bagi-inc\b|\bagiinc\b/, 'AGI Inc'],
    [/\btelegram\b/, 'Telegram'],
    [/\bairtable\b/, 'Airtable'],
    [/\bnotion\b/, 'Notion'],
    [/\bopenai\b|\bgpt\b/, 'GPT'],
    [/\banthropic\b|\bclaude\b/, 'Claude'],
    [/\bgemini\b/, 'Gemini'],
    [/\breddit\b/, 'Reddit'],
    [/\bresearch\s*agent\b|\bresearch-agent\b/, 'Research Agent'],
    [/\bai\s*agent\b|\bai-agent\b/, 'AI Agent'],
    [/\bstorage\b/, 'Storage'],
    [/\bweb\s*search\b|\bweb-search\b/, 'Web Search'],
    [/\bweb\s*scrape\b|\bweb-scrape\b/, 'Web Scrape'],
    [/\bweb\s*crawl\b|\bweb-crawl\b/, 'Web Crawl'],
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
      githubbubble: 'github-bubble',
      followupbossbubble: 'followupboss-bubble',
      telegrambubble: 'telegram-bubble',
      airtablebubble: 'airtable-bubble',
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
    github: 'github-bubble',
    followupboss: 'followupboss-bubble',
    fub: 'followupboss-bubble',
    telegram: 'telegram-bubble',
    airtable: 'airtable-bubble',
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
