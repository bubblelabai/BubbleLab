// Template loader utility for importing preset workflow templates

// ============================================================================
// TEMPLATE CONFIGURATION - CENTRAL PLACE TO MANAGE ALL TEMPLATES
// ============================================================================

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

// Import individual template files
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

export interface TemplateMetadata {
  inputsSchema?: string;
  requiredCredentials?: Record<string, string[]>;
  // Optional: pre-validated bubble parameters to enable instant visualization without server validation
  preValidatedBubbles?: Record<string | number, unknown>;
}

// ============================================================================
// TEMPLATE REGISTRY - Define all templates here
// ============================================================================
// Each template has:
// - id: unique identifier (used for URL params, persistence)
// - name: display name
// - prompt: description shown to users
// - code: the actual workflow code
// - category: primary category for organization
// - isPopular: whether to show in "Popular" category (optional, defaults to false)
// - isHidden: whether to hide from UI (optional, defaults to false)
// ============================================================================

export interface TemplateDefinition {
  id: string;
  name: string;
  prompt: string;
  code: string;
  category: TemplateCategory;
  isPopular?: boolean;
  isHidden?: boolean;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'techweek-calendar',
    name: 'LA Tech Week Personalized Calendar (Firecrawl, Google Spreadsheet, Gmail)',
    prompt: `Get your personalized LA Tech Week Calendar curated to your preferences and interests, alongside the scraped event schedule!`,
    code: techweekTemplate.templateCode,
    category: 'Popular',
    isPopular: true,
  },
  {
    id: 'reddit-lead-gen',
    name: 'Reddit Lead Generation (Firecrawl, Google Sheets)',
    prompt: `Find qualified prospects from relevant Reddit threads/users and log them to a sheet with an auto-drafted outreach message.`,
    code: redditTemplate.templateCode,
    category: 'Lead Generation',
    isPopular: true,
  },
  {
    id: 'project-management',
    name: 'Project Management Assistant (Slack, Email)',
    prompt:
      'Pull the last 24 hours of Slack messages, summarize them into Updates/Blockers/Decisions, and send a daily digest via email.',
    code: projectManagementTemplate.templateCode,
    category: 'Project Management',
    isPopular: true,
  },
  {
    id: 'daily-briefing',
    name: 'Daily Briefing (Google Calendar, Email)',
    prompt:
      'Read in my google calendar and summarize my upcoming events and reminders.',
    code: personalTemplate.templateCode,
    category: 'Personal Assistant',
  },
  {
    id: 'financial-advisor',
    name: 'Financial Portfolio Advisor (Firecrawl, Email)',
    prompt:
      'Read in my portfolio of tickers, and fetch the latest stock price and news for a stock ticker. Summarize sentiment, risks, and opportunities in a short report, then email it to me.',
    code: financialTemplate.templateCode,
    category: 'Personal Assistant',
  },
  {
    id: 'github-contributor',
    name: 'Github Contributor Report (Firecrawl, Email)',
    prompt:
      'Scrape the contributors of a GitHub repository. For each contributor, collect their username, commit activity, and profile link. Rank them by activity and generate a clean summary table. Email me the report.',
    code: githubScraperTemplate.templateCode,
    category: 'Lead Generation',
  },
  {
    id: 'database-metrics',
    name: 'Database Metrics Assistant (Postgres, Gmail)',
    prompt:
      'Analyze PostgreSQL database schema from public tables, use AI to generate SQL query from natural language question, execute read-only query, generate insights with key metrics and trends, then email a beautiful HTML report with data visualization, executive summary, and query explanation.',
    code: databaseTemplate.templateCode,
    category: 'Project Management',
  },
  {
    id: 'daily-news',
    name: 'Daily News Digest (Firecrawl, Email, Reddit)',
    prompt:
      'Scrape top posts from Reddit communities (news, worldnews, technology) and news websites (Hacker News, TechCrunch), use AI to organize headlines into categories with summaries, then email a beautifully formatted HTML digest with executive summary.',
    code: dailyNewsTemplate.templateCode,
    category: 'Personal Assistant',
    isPopular: true,
  },
  {
    id: 'gmail-reply',
    name: 'Gmail Reply Assistant (Gmail)',
    prompt:
      'List unread emails from past 24 hours using Gmail query, fetch full email details with headers and body content, use AI with JSON mode to classify and filter out marketing/automated emails, generate smart contextual replies for each important email matching original tone, then create Gmail drafts in correct threads with proper recipients.',
    code: gmailReplyTemplate.templateCode,
    category: 'Personal Assistant',
  },
  {
    id: 'content-creation',
    name: 'Content Creation Trends (Firecrawl, Google Drive, Email)',
    prompt:
      'Use ResearchAgentTool to search trending content formats from TikTok/Reels/Shorts trend sites (Google Trends, Hootsuite, TikTok Business blog), scrape Reddit communities (r/tiktoktrends, r/socialmedia, r/marketing) for additional insights, use AI with JSON mode to analyze trends and generate 8-12 actionable content ideas adapted for specific product/industry/audience with engagement estimates, save formatted markdown report to Google Drive, then email beautiful HTML summary with top ideas and metrics.',
    code: contentCreationTemplate.templateCode,
    category: 'Marketing',
    isPopular: true,
  },
];

// ============================================================================
// DERIVED DATA & HELPER FUNCTIONS
// ============================================================================

// Get all visible templates (not hidden)
export function getVisibleTemplates(): TemplateDefinition[] {
  return TEMPLATES.filter((t) => !t.isHidden);
}

// Get templates by category
export function getTemplatesByCategory(
  category: TemplateCategory
): TemplateDefinition[] {
  if (category === 'Popular') {
    return TEMPLATES.filter((t) => t.isPopular && !t.isHidden);
  }
  return TEMPLATES.filter((t) => t.category === category && !t.isHidden);
}

// Get template by ID
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

// Get template by index (for backward compatibility)
export function getTemplateByIndex(
  index: number
): TemplateDefinition | undefined {
  const visible = getVisibleTemplates();
  return visible[index];
}

// Get index of template (for backward compatibility)
export function getTemplateIndex(id: string): number {
  const visible = getVisibleTemplates();
  return visible.findIndex((t) => t.id === id);
}

// Load template code by ID
export function loadTemplateCode(templateId: string): { code: string } | null {
  const template = getTemplateById(templateId);
  if (!template) {
    return null;
  }
  return { code: template.code };
}

// ============================================================================
// BACKWARD COMPATIBILITY LAYER
// ============================================================================
// These exports maintain compatibility with existing code that uses indices
// ============================================================================

// Legacy: PRESET_PROMPTS for backward compatibility with index-based access
export const PRESET_PROMPTS = getVisibleTemplates().map((template) => ({
  name: template.name,
  prompt: template.prompt,
}));

// Legacy: TEMPLATE_REGISTRY for backward compatibility
export const TEMPLATE_REGISTRY = getVisibleTemplates().map((template) => ({
  name: template.name,
  prompt: template.prompt,
  code: template.code,
  category: template.category,
}));

// Legacy: Check if template is hidden by index
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isTemplateHidden(index: number): boolean {
  // All templates in getVisibleTemplates() are not hidden by definition
  return false;
}

// Legacy: Get categories for template by index
export function getTemplateCategories(
  templateIndex: number
): TemplateCategory[] {
  const template = getTemplateByIndex(templateIndex);
  if (!template) {
    return [];
  }

  const categories: TemplateCategory[] = [template.category];

  // Add Popular category if template is marked as popular
  if (template.isPopular) {
    categories.push('Popular');
  }

  return categories;
}

// Legacy: Check if a preset has a template
export function hasTemplate(presetIndex: number): boolean {
  return presetIndex >= 0 && presetIndex < getVisibleTemplates().length;
}
