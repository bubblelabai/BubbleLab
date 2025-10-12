// Template loader utility for importing preset workflow templates

// Template categories for filtering
export const TEMPLATE_CATEGORIES = [
  'Popular',
  'Lead Generation',
  'Project Management',
  'Personal Assistant',
  'Marketing',
  'Generate your own',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// Popular templates - easy to manage and extend
// Templates in this array will appear in BOTH their main category AND the Popular category
// To add more templates to Popular category:
// 1. Add the template ID to this array
// 2. The template will automatically appear in both Popular and its main category
export const POPULAR_TEMPLATES = [0, 1, 4, 10] as const;

// Hidden templates - central control for suppressing templates without breaking indices
const HIDDEN_TEMPLATES = new Set<number>([9]);

export function isTemplateHidden(index: number): boolean {
  return HIDDEN_TEMPLATES.has(index);
}

export interface TemplateMetadata {
  inputsSchema?: string;
  requiredCredentials?: Record<string, string[]>;
  // Optional: pre-validated bubble parameters to enable instant visualization without server validation
  preValidatedBubbles?: Record<string | number, unknown>;
}

// Import individual template files
// Note: metadata export is optional - defaults to {} if not provided
import * as techweekTemplate from './template_codes/techweekScheduler';
import * as redditTemplate from './template_codes/redditLeadGeneration';
import * as personalTemplate from './template_codes/personalAssistant';
import * as financialTemplate from './template_codes/financialAdvisor';
import * as githubScraperTemplate from './template_codes/githubScraper';
import * as databaseTemplate from './template_codes/databaseMetricsAssistant';
import * as dailyNewsTemplate from './template_codes/dailyNewsDigest';
import * as gmailReplyTemplate from './template_codes/gmailReplyAssistant';
import * as contentCreationTemplate from './template_codes/contentCreationTrends';
import * as projectManagementTemplate from './template_codes/projectManagementAssistant';

// Template registry - unified structure with name, prompt, code, and category
export const TEMPLATE_REGISTRY: Array<
  | {
      name: string;
      prompt: string;
      code: string;
      category: TemplateCategory;
    }
  | undefined
> = [
  // Index 0
  {
    name: 'LA Tech Week Personalized Calendar (Firecrawl, Google Spreadsheet, Gmail)',
    prompt: `Get your personalized LA Tech Week Calendar curated to your preferences and interests, alongside the scraped event schedule!`,
    code: techweekTemplate.templateCode,
    category: 'Popular',
  },
  // Index 1
  {
    name: 'Reddit Lead Generation (Firecrawl, Google Sheets)',
    prompt: `Find qualified prospects from relevant Reddit threads/users and log them to a sheet with an auto-drafted outreach message.`,
    code: redditTemplate.templateCode,
    category: 'Lead Generation',
  },
  // Index 2 - Website Directory Scraper (removed)
  // undefined,
  // Index 3 - Daily Slack Digest (removed)
  // undefined,
  // Index 4
  {
    name: 'Project Management Assistant (Slack, Email)',
    prompt:
      'Pull the last 24 hours of Slack messages, summarize them into Updates/Blockers/Decisions, and send a daily digest via email.',
    code: projectManagementTemplate.templateCode,
    category: 'Project Management',
  },
  // Index 5
  {
    name: 'Daily Briefing (Google Calendar, Email)',
    prompt:
      'Read in my google calendar and summarize my upcoming events and reminders.',
    code: personalTemplate.templateCode,
    category: 'Personal Assistant',
  },
  // Index 6
  {
    name: 'Financial Portfolio Advisor (Firecrawl, Email)',
    prompt:
      'Read in my portfolio of tickers, and fetch the latest stock price and news for a stock ticker. Summarize sentiment, risks, and opportunities in a short report, then email it to me.',
    code: financialTemplate.templateCode,
    category: 'Personal Assistant',
  },
  // Index 7
  {
    name: 'Github Contributor Report (Firecrawl, Email)',
    prompt:
      'Scrape the contributors of a GitHub repository. For each contributor, collect their username, commit activity, and profile link. Rank them by activity and generate a clean summary table. Email me the report.',
    code: githubScraperTemplate.templateCode,
    category: 'Lead Generation',
  },
  // Index 8
  {
    name: 'Database Metrics Assistant (Postgres, Gmail)',
    prompt:
      'Analyze PostgreSQL database schema from public tables, use AI to generate SQL query from natural language question, execute read-only query, generate insights with key metrics and trends, then email a beautiful HTML report with data visualization, executive summary, and query explanation.',
    code: databaseTemplate.templateCode,
    category: 'Project Management',
  },
  // Index 9
  // {
  //   name: 'Batch Creative Generator (OpenRouter, Google Drive, Google Sheets)',
  //   prompt:
  //     'Read prompts + images from Google Sheets, process with Gemini (via OpenRouter), re-upload to Google Drive, and update the sheet with output links.',
  //   code: nanobananaTemplate.templateCode,
  //   category: 'Marketing',
  // },
  // Index 10
  {
    name: 'Daily News Digest (Firecrawl, Email, Reddit)',
    prompt:
      'Scrape top posts from Reddit communities (news, worldnews, technology) and news websites (Hacker News, TechCrunch), use AI to organize headlines into categories with summaries, then email a beautifully formatted HTML digest with executive summary.',
    code: dailyNewsTemplate.templateCode,
    category: 'Personal Assistant',
  },
  // Index 11
  {
    name: 'Gmail Reply Assistant (Gmail)',
    prompt:
      'List unread emails from past 24 hours using Gmail query, fetch full email details with headers and body content, use AI with JSON mode to classify and filter out marketing/automated emails, generate smart contextual replies for each important email matching original tone, then create Gmail drafts in correct threads with proper recipients.',
    code: gmailReplyTemplate.templateCode,
    category: 'Personal Assistant',
  },
  // Index 12
  {
    name: 'Content Creation Trends (Firecrawl, Google Drive, Email)',
    prompt:
      'Use ResearchAgentTool to search trending content formats from TikTok/Reels/Shorts trend sites (Google Trends, Hootsuite, TikTok Business blog), scrape Reddit communities (r/tiktoktrends, r/socialmedia, r/marketing) for additional insights, use AI with JSON mode to analyze trends and generate 8-12 actionable content ideas adapted for specific product/industry/audience with engagement estimates, save formatted markdown report to Google Drive, then email beautiful HTML summary with top ideas and metrics.',
    code: contentCreationTemplate.templateCode,
    category: 'Marketing',
  },
];

// Preset prompts - derived from registry for backward compatibility
export const PRESET_PROMPTS = TEMPLATE_REGISTRY.map((template) =>
  template
    ? { name: template.name, prompt: template.prompt }
    : { name: '', prompt: '' }
);

// Function to load template code
export function loadTemplateCode(presetIndex: number): {
  code: string;
} | null {
  const template = TEMPLATE_REGISTRY[presetIndex];

  if (!template) {
    return null;
  }

  return {
    code: template.code,
  };
}

// Function to check if a preset has a template
export function hasTemplate(presetIndex: number): boolean {
  return presetIndex in TEMPLATE_REGISTRY;
}

// Function to get all categories for a template (including Popular if applicable)
export function getTemplateCategories(
  templateIndex: number
): TemplateCategory[] {
  const categories: TemplateCategory[] = [];

  // Get template from registry
  const template = TEMPLATE_REGISTRY[templateIndex];

  // Add the main category
  if (template?.category) {
    categories.push(template.category);
  }

  // Add Popular category if this template is in the popular list
  if (
    !isTemplateHidden(templateIndex) &&
    POPULAR_TEMPLATES.includes(
      templateIndex as (typeof POPULAR_TEMPLATES)[number]
    )
  ) {
    categories.push('Popular');
  }

  return categories;
}
