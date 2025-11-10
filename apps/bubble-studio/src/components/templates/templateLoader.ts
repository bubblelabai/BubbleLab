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
  'Prompt',
  'Import JSON',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// Import individual template files
import * as videoScriptTemplate from './template_codes/videoScriptGenerator';
import * as redditTemplate from './template_codes/redditLeadGeneration';
import * as personalTemplate from './template_codes/personalAssistant';
import * as financialTemplate from './template_codes/financialAdvisor';
import * as databaseTemplate from './template_codes/databaseMetricsAssistant';
import * as dailyNewsTemplate from './template_codes/dailyNewsDigest';
import * as contentCreationTemplate from './template_codes/contentCreationTrends';
import * as projectManagementTemplate from './template_codes/projectManagementAssistant';
import * as linkedinLeadGenTemplate from './template_codes/linkedinLeadGen';
import * as githubPRCommenterTemplate from './template_codes/githubPRCommenter';

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
    id: 'linkedin-lead-gen',
    name: 'LinkedIn Lead Generation (LinkedIn, Email)',
    prompt:
      'Search LinkedIn for persona and keyword-matched leads, scrape profiles, and generate a lead report',
    code: linkedinLeadGenTemplate.templateCode,
    category: 'Lead Generation',
    isPopular: true,
  },
  {
    id: 'content-creation',
    name: 'Content Creation Ideas (Research Agent, Youtube, Reddit, Email)',
    prompt:
      'Research news and trending content across YouTube/Reddit/websites, generate 10+ tailored content ideas with metrics, and email a summary',
    code: contentCreationTemplate.templateCode,
    category: 'Marketing',
    isPopular: true,
  },
  {
    id: 'github-pr-commenter',
    name: 'GitHub PR Commenter (GitHub, AI Agent)',
    prompt:
      'Automatically analyze pull requests and post intelligent title/body suggestions based on COMMIT.md file',
    code: githubPRCommenterTemplate.templateCode,
    category: 'Project Management',
    isPopular: true,
  },
  {
    id: 'video-script-generator',
    name: 'Video Script Generator (YouTube, Email)',
    prompt:
      'Analyze top YouTube videos on a topic and generate 4 complete script variations with hooks, timing, and CTAs',
    code: videoScriptTemplate.templateCode,
    category: 'Marketing',
    isPopular: true,
  },
  {
    id: 'reddit-lead-gen',
    name: 'Reddit Lead Generation (Google Sheets, Reddit)',
    prompt: `Find qualified prospects from relevant Reddit threads and log them to a sheet with personalized outreach messages`,
    code: redditTemplate.templateCode,
    category: 'Lead Generation',
    isPopular: true,
  },
  {
    id: 'database-metrics',
    name: 'Database Metrics Assistant (Postgres, Gmail)',
    prompt:
      'Analyze my database daily, surface key metrics and trends, and email a report',
    code: databaseTemplate.templateCode,
    category: 'Project Management',
  },
  {
    id: 'project-management',
    name: 'Project Management Assistant (Slack, Email)',
    prompt:
      'Summarize last 24h of Slack into Updates/Blockers/Decisions and email a daily digest',
    code: projectManagementTemplate.templateCode,
    category: 'Project Management',
    isPopular: true,
  },
  {
    id: 'daily-briefing',
    name: 'Daily Briefing (Google Calendar, Email)',
    prompt:
      'Read in my google calendar and summarize my upcoming events and reminders',
    code: personalTemplate.templateCode,
    category: 'Personal Assistant',
  },
  {
    id: 'financial-advisor',
    name: 'Financial Portfolio Advisor (Research Agent, Email)',
    prompt:
      'Fetch prices and news for stock tickers, assess sentiment/risks/opportunities, and email a report',
    code: financialTemplate.templateCode,
    category: 'Personal Assistant',
  },
  // {
  //   id: 'github-contributor',
  //   name: 'Github Contributor Report (Firecrawl, Email)',
  //   prompt:
  //     'Scrape the contributors of a GitHub repository. For each contributor, collect their username, commit activity, and profile link. Rank them by activity and generate a clean summary table. Email me the report.',
  //   code: githubScraperTemplate.templateCode,
  //   category: 'Lead Generation',
  // },

  {
    id: 'daily-news',
    name: 'Daily News Digest (Research Agent, Email, Reddit)',
    prompt:
      'Curate top tech news headlines from Reddit and major news sites, summarize by category, and email an HTML digest',
    code: dailyNewsTemplate.templateCode,
    category: 'Personal Assistant',
    isPopular: true,
  },
  // {
  //   id: 'gmail-reply',
  //   name: 'Gmail Reply Assistant (Gmail)',
  //   prompt:
  //     'List important unread emails, draft smart context-aware replies, and create Gmail drafts in-thread',
  //   code: gmailReplyTemplate.templateCode,
  //   category: 'Personal Assistant',
  // },
  // {
  //   id: 'gmail-labeling',
  //   name: 'Gmail Labeling Assistant (Gmail)',
  //   prompt:
  //     'Auto-label emails into categories (Newsletters, Social, Updates, Receipts, Support, Personal)',
  //   code: gmailLabelingTemplate.templateCode,
  //   category: 'Personal Assistant',
  //   isPopular: false,
  // },
  // {
  //   id: 'techweek-calendar',
  //   name: 'LA Tech Week Personalized Calendar (Firecrawl, Google Spreadsheet, Gmail)',
  //   prompt: `Get your personalized LA Tech Week Calendar curated to your preferences and interests, alongside the scraped event schedule!`,
  //   code: techweekTemplate.templateCode,
  //   category: 'Popular',
  //   isPopular: false,
  // },
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
