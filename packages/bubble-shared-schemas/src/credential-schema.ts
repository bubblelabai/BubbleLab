import { BubbleName, CredentialType } from './types.js';
import { z } from '@hono/zod-openapi';
import {
  databaseMetadataSchema,
  jiraOAuthMetadataSchema,
} from './database-definition-schema.js';

/**
 * Configuration for a credential type displayed in the UI
 */
export interface CredentialConfig {
  label: string;
  description: string;
  placeholder: string;
  namePlaceholder: string;
  credentialConfigurations: Record<string, unknown>;
}

/**
 * Configuration for all credential types - used by Credentials page and AI agents
 */
export const CREDENTIAL_TYPE_CONFIG: Record<CredentialType, CredentialConfig> =
  {
    [CredentialType.OPENAI_CRED]: {
      label: 'OpenAI',
      description: 'API key for OpenAI services (GPT models, embeddings, etc.)',
      placeholder: 'sk-...',
      namePlaceholder: 'My OpenAI API Key',
      credentialConfigurations: {},
    },
    [CredentialType.GOOGLE_GEMINI_CRED]: {
      label: 'Google Gemini',
      description: 'API key for Google Gemini AI models',
      placeholder: 'AIza...',
      namePlaceholder: 'My Google Gemini Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.ANTHROPIC_CRED]: {
      label: 'Anthropic',
      description: 'API key for Anthropic Claude models',
      placeholder: 'sk-ant-...',
      namePlaceholder: 'My Anthropic API Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.DATABASE_CRED]: {
      label: 'Database (PostgreSQL)',
      description: 'Database connection string for PostgreSQL',
      placeholder: 'postgresql://user:pass@host:port/dbname',
      namePlaceholder: 'My PostgreSQL Database',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.FIRECRAWL_API_KEY]: {
      label: 'Firecrawl',
      description: 'API key for Firecrawl web scraping and search services',
      placeholder: 'fc-...',
      namePlaceholder: 'My Firecrawl API Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.SLACK_CRED]: {
      label: 'Slack',
      description:
        'Slack Bot token (xoxb-) or User token (xoxp-) from api.slack.com/apps. Configure scopes in OAuth & Permissions.',
      placeholder: 'xoxb-... or xoxp-...',
      namePlaceholder: 'My Slack Token',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.RESEND_CRED]: {
      label: 'Resend',
      description: 'Your Resend API key for email services',
      placeholder: 're_...',
      namePlaceholder: 'My Resend API Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.OPENROUTER_CRED]: {
      label: 'OpenRouter',
      description: 'API key for OpenRouter services',
      placeholder: 'sk-or-...',
      namePlaceholder: 'My OpenRouter API Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: {
      label: 'Cloudflare R2 Access Key',
      description: 'Access key for Cloudflare R2 storage',
      placeholder: 'Enter your access key',
      namePlaceholder: 'My R2 Access Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: {
      label: 'Cloudflare R2 Secret Key',
      description: 'Secret key for Cloudflare R2 storage',
      placeholder: 'Enter your secret key',
      namePlaceholder: 'My R2 Secret Key',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: {
      label: 'Cloudflare R2 Account ID',
      description: 'Account ID for Cloudflare R2 storage',
      placeholder: 'Enter your account ID',
      namePlaceholder: 'My R2 Account ID',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.APIFY_CRED]: {
      label: 'Apify',
      description: 'API token for Apify platform (web scraping, automation)',
      placeholder: 'apify_api_...',
      namePlaceholder: 'My Apify API Token',
      credentialConfigurations: {},
    },
    [CredentialType.GOOGLE_DRIVE_CRED]: {
      label: 'Google Drive',
      description: 'OAuth connection to Google Drive for file access',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Google Drive Connection',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.GMAIL_CRED]: {
      label: 'Gmail',
      description: 'OAuth connection to Gmail for email management',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Gmail Connection',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.GOOGLE_SHEETS_CRED]: {
      label: 'Google Sheets',
      description:
        'OAuth connection to Google Sheets for spreadsheet management',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Google Sheets Connection',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.GOOGLE_CALENDAR_CRED]: {
      label: 'Google Calendar',
      description:
        'OAuth connection to Google Calendar for events and schedules',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Google Calendar Connection',
      credentialConfigurations: {
        ignoreSSL: false,
      },
    },
    [CredentialType.FUB_CRED]: {
      label: 'Follow Up Boss',
      description:
        'OAuth connection to Follow Up Boss CRM for contacts, tasks, and deals',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Follow Up Boss Connection',
      credentialConfigurations: {},
    },
    [CredentialType.NOTION_OAUTH_TOKEN]: {
      label: 'Notion',
      description:
        'OAuth connection to your Notion workspace (pages, databases, search)',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Notion Connection',
      credentialConfigurations: {},
    },
    [CredentialType.GITHUB_TOKEN]: {
      label: 'GitHub',
      description:
        'Personal Access Token for GitHub API (read repos, PRs, issues)',
      placeholder: 'github_pat...',
      namePlaceholder: 'My GitHub Token',
      credentialConfigurations: {},
    },
    [CredentialType.ELEVENLABS_API_KEY]: {
      label: 'Eleven Labs API Key',
      description: 'Your API key from Eleven Labs',
      placeholder: 'agent_...',
      namePlaceholder: 'My Eleven Labs Key',
      credentialConfigurations: {},
    },
    [CredentialType.AGI_API_KEY]: {
      label: 'AGI Inc API Key',
      description: 'Your API key from AGI Inc',
      placeholder: 'api_...',
      namePlaceholder: 'My AGI Inc Key',
      credentialConfigurations: {},
    },
    [CredentialType.TELEGRAM_BOT_TOKEN]: {
      label: 'Telegram Bot Token',
      description: 'Your Telegram bot token',
      placeholder: 'bot_...',
      namePlaceholder: 'My Telegram Bot Token',
      credentialConfigurations: {},
    },
    [CredentialType.AIRTABLE_CRED]: {
      label: 'Airtable',
      description:
        'Personal Access Token for Airtable API (manage bases, tables, records)',
      placeholder: 'pat...',
      namePlaceholder: 'My Airtable Token',
      credentialConfigurations: {},
    },
    [CredentialType.INSFORGE_BASE_URL]: {
      label: 'InsForge Base URL',
      description:
        'Base URL for your InsForge backend (e.g., https://your-app.region.insforge.app)',
      placeholder: 'https://your-app.region.insforge.app',
      namePlaceholder: 'My InsForge Backend URL',
      credentialConfigurations: {},
    },
    [CredentialType.INSFORGE_API_KEY]: {
      label: 'InsForge API Key',
      description: 'API key for your InsForge backend',
      placeholder: 'ik_...',
      namePlaceholder: 'My InsForge API Key',
      credentialConfigurations: {},
    },
    [CredentialType.CRUSTDATA_API_KEY]: {
      label: 'Crustdata API Key',
      description: 'API key for your Crustdata backend',
      placeholder: 'crust_...',
      namePlaceholder: 'My Crustdata API Key',
      credentialConfigurations: {},
    },
    [CredentialType.CUSTOM_AUTH_KEY]: {
      label: 'Custom Authentication Key',
      description:
        'Custom API key or authentication token for HTTP requests (Bearer, Basic, X-API-Key, etc.)',
      placeholder: 'Enter your API key or token...',
      namePlaceholder: 'My Custom Auth Key',
      credentialConfigurations: {},
    },
    [CredentialType.AMAZON_CRED]: {
      label: 'Amazon',
      description:
        'Browser session authentication for Amazon shopping (cart, orders, purchases). Authenticate by logging into your Amazon account in a secure browser session.',
      placeholder: '', // Not used for browser session auth
      namePlaceholder: 'My Amazon Account',
      credentialConfigurations: {},
    },
    [CredentialType.LINKEDIN_CRED]: {
      label: 'LinkedIn',
      description:
        'Browser session authentication for LinkedIn automation (connections, messaging). Authenticate by logging into your LinkedIn account in a secure browser session.',
      placeholder: '', // Not used for browser session auth
      namePlaceholder: 'My LinkedIn Account',
      credentialConfigurations: {},
    },
    [CredentialType.JIRA_CRED]: {
      label: 'Jira',
      description:
        'OAuth connection to Jira Cloud for issue tracking and project management',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Jira Connection',
      credentialConfigurations: {},
    },
    [CredentialType.ASHBY_CRED]: {
      label: 'Ashby',
      description:
        'API key for Ashby ATS (Applicant Tracking System) for candidate management',
      placeholder: 'Enter your Ashby API key...',
      namePlaceholder: 'My Ashby API Key',
      credentialConfigurations: {},
    },
    [CredentialType.FULLENRICH_API_KEY]: {
      label: 'FullEnrich',
      description:
        'API key for FullEnrich B2B contact enrichment (emails, phones, LinkedIn data)',
      placeholder: 'Enter your FullEnrich API key...',
      namePlaceholder: 'My FullEnrich API Key',
      credentialConfigurations: {},
    },
    [CredentialType.STRIPE_CRED]: {
      label: 'Stripe',
      description:
        'Stripe API secret key for payment processing (sk_live_... or sk_test_...)',
      placeholder: 'sk_...',
      namePlaceholder: 'My Stripe API Key',
      credentialConfigurations: {},
    },
  } as const satisfies Record<CredentialType, CredentialConfig>;

/**
 * Generate a human-readable summary of available credentials for AI agents
 */
export function generateCredentialsSummary(): string {
  const lines: string[] = ['Available credentials that users can configure:'];

  for (const [credType, config] of Object.entries(CREDENTIAL_TYPE_CONFIG)) {
    lines.push(`- ${config.label} (${credType}): ${config.description}`);
  }

  return lines.join('\n');
}

/**
 * Maps credential types to their environment variable names (for backend only!!!!)
 */
export const CREDENTIAL_ENV_MAP: Record<CredentialType, string> = {
  [CredentialType.OPENAI_CRED]: 'OPENAI_API_KEY',
  [CredentialType.GOOGLE_GEMINI_CRED]: 'GOOGLE_API_KEY',
  [CredentialType.ANTHROPIC_CRED]: 'ANTHROPIC_API_KEY',
  [CredentialType.FIRECRAWL_API_KEY]: 'FIRE_CRAWL_API_KEY',
  [CredentialType.DATABASE_CRED]: 'BUBBLE_CONNECTING_STRING_URL',
  [CredentialType.SLACK_CRED]: 'SLACK_TOKEN',
  [CredentialType.TELEGRAM_BOT_TOKEN]: 'TELEGRAM_BOT_TOKEN',
  [CredentialType.RESEND_CRED]: 'RESEND_API_KEY',
  [CredentialType.OPENROUTER_CRED]: 'OPENROUTER_API_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'CLOUDFLARE_R2_ACCESS_KEY',
  [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'CLOUDFLARE_R2_SECRET_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: 'CLOUDFLARE_R2_ACCOUNT_ID',
  [CredentialType.APIFY_CRED]: 'APIFY_API_TOKEN',
  [CredentialType.ELEVENLABS_API_KEY]: 'ELEVENLABS_API_KEY',
  [CredentialType.GOOGLE_DRIVE_CRED]: '',
  [CredentialType.GMAIL_CRED]: '',
  [CredentialType.GOOGLE_SHEETS_CRED]: '',
  [CredentialType.GOOGLE_CALENDAR_CRED]: '',
  [CredentialType.FUB_CRED]: '',
  [CredentialType.GITHUB_TOKEN]: 'GITHUB_TOKEN',
  [CredentialType.AGI_API_KEY]: 'AGI_API_KEY',
  [CredentialType.AIRTABLE_CRED]: 'AIRTABLE_API_KEY',
  [CredentialType.NOTION_OAUTH_TOKEN]: '',
  [CredentialType.INSFORGE_BASE_URL]: 'INSFORGE_BASE_URL',
  [CredentialType.INSFORGE_API_KEY]: 'INSFORGE_API_KEY',
  [CredentialType.CUSTOM_AUTH_KEY]: '', // User-provided, no env var
  [CredentialType.AMAZON_CRED]: '', // Browser session credential, no env var
  [CredentialType.LINKEDIN_CRED]: '', // Browser session credential, no env var
  [CredentialType.CRUSTDATA_API_KEY]: 'CRUSTDATA_API_KEY',
  [CredentialType.JIRA_CRED]: '', // OAuth credential, no env var
  [CredentialType.ASHBY_CRED]: 'ASHBY_API_KEY',
  [CredentialType.FULLENRICH_API_KEY]: 'FULLENRICH_API_KEY',
  [CredentialType.STRIPE_CRED]: 'STRIPE_SECRET_KEY',
};

/** Used by bubblelab studio */
export const SYSTEM_CREDENTIALS = new Set<CredentialType>([
  CredentialType.GOOGLE_GEMINI_CRED,
  CredentialType.FIRECRAWL_API_KEY,
  CredentialType.OPENAI_CRED,
  CredentialType.ANTHROPIC_CRED,
  CredentialType.RESEND_CRED,
  CredentialType.OPENROUTER_CRED,
  // Cloudflare R2 Storage credentials
  CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
  CredentialType.CLOUDFLARE_R2_SECRET_KEY,
  CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  // Scraping credentials
  CredentialType.APIFY_CRED,
  CredentialType.CRUSTDATA_API_KEY,
  // Enrichment credentials
  CredentialType.FULLENRICH_API_KEY,
]);

/**
 * Credentials that are optional (not required) for their associated bubbles.
 * These will not show as "missing" in the UI when not selected.
 */
export const OPTIONAL_CREDENTIALS = new Set<CredentialType>([
  CredentialType.CUSTOM_AUTH_KEY,
  CredentialType.FULLENRICH_API_KEY,
]);

/**
 * OAuth provider names - type-safe provider identifiers
 */
export type OAuthProvider =
  | 'google'
  | 'followupboss'
  | 'notion'
  | 'jira'
  | 'slack';

/**
 * Scope description mapping - maps OAuth scope URLs to human-readable descriptions
 */
export interface ScopeDescription {
  scope: string; // OAuth scope URL
  description: string; // Human-readable description of what this scope allows
  defaultEnabled: boolean; // Whether this scope should be enabled by default
}

/**
 * OAuth credential type configuration for a specific service under a provider
 */
export interface OAuthCredentialConfig {
  displayName: string; // User-facing name
  defaultScopes: string[]; // OAuth scopes for this credential type
  description: string; // Description of what this credential provides access to
  scopeDescriptions?: ScopeDescription[]; // Optional: descriptions for each scope
}

/**
 * OAuth provider configuration shared between frontend and backend
 */
export interface OAuthProviderConfig {
  name: OAuthProvider; // Type-safe provider identifier
  displayName: string; // User-facing provider name: 'Google'
  credentialTypes: Partial<Record<CredentialType, OAuthCredentialConfig>>; // Supported credential types
  authorizationParams?: Record<string, string>; // Provider-wide OAuth parameters
}

/**
 * OAuth provider configurations - single source of truth for OAuth providers
 * Contains all information needed by frontend and backend
 */
export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    name: 'google',
    displayName: 'Google',
    credentialTypes: {
      [CredentialType.GOOGLE_DRIVE_CRED]: {
        displayName: 'Google Drive',
        defaultScopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ],
        description: 'Access Google Drive files and folders',
        scopeDescriptions: [
          {
            scope: 'https://www.googleapis.com/auth/drive.file',
            description:
              'View and manage Google Drive files and folders that you have created with Bubble Lab or selected w/ file picker',
            defaultEnabled: true,
          },
          {
            scope: 'https://www.googleapis.com/auth/documents',
            description: 'View and manage your Google Docs documents',
            defaultEnabled: true,
          },
          {
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            description: 'View and manage your Google Sheets spreadsheets',
            defaultEnabled: true,
          },
          {
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            description:
              'View and manage all of your Google Drive files and folders (will see a warning about an "untrusted app" during authentication. Choose only if you need extra permissions)',
            defaultEnabled: false,
          },
        ],
      },
      [CredentialType.GMAIL_CRED]: {
        displayName: 'Gmail',
        defaultScopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
        description: 'Access Gmail for sending emails',
        scopeDescriptions: [
          {
            scope: 'https://www.googleapis.com/auth/gmail.send',
            description: 'Send email on your behalf',
            defaultEnabled: true,
          },
          {
            scope: 'https://www.googleapis.com/auth/gmail.modify',
            description:
              'View and manage all of your Gmail emails and labels (might see a warning about an "untrusted app" during authentication. Choose only if you need extra permissions)',
            defaultEnabled: false,
          },
        ],
      },
      [CredentialType.GOOGLE_SHEETS_CRED]: {
        displayName: 'Google Sheets',
        defaultScopes: ['https://www.googleapis.com/auth/spreadsheets'],
        description:
          'Access Google Sheets for reading and writing spreadsheet data',
        scopeDescriptions: [
          {
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            description: 'View and manage your Google Sheets spreadsheets',
            defaultEnabled: true,
          },
        ],
      },
      [CredentialType.GOOGLE_CALENDAR_CRED]: {
        displayName: 'Google Calendar',
        defaultScopes: ['https://www.googleapis.com/auth/calendar'],
        description: 'Access Google Calendar for reading and managing events',
        scopeDescriptions: [
          {
            scope: 'https://www.googleapis.com/auth/calendar',
            description: 'View and manage events on all your calendars',
            defaultEnabled: true,
          },
        ],
      },
    },
    authorizationParams: {
      access_type: 'offline', // Required for refresh tokens
      prompt: 'consent', // Force consent screen to ensure refresh token is issued
    },
  },
  followupboss: {
    name: 'followupboss',
    displayName: 'Follow Up Boss',
    credentialTypes: {
      [CredentialType.FUB_CRED]: {
        displayName: 'Follow Up Boss',
        defaultScopes: [], // FUB doesn't use granular scopes
        description:
          'Access Follow Up Boss CRM for managing contacts, tasks, deals, and more',
      },
    },
    authorizationParams: {
      response_type: 'auth_code', // FUB uses 'auth_code' instead of standard 'code'
      prompt: 'login', // FUB supports 'login' to force re-authentication
    },
  },
  notion: {
    name: 'notion',
    displayName: 'Notion',
    credentialTypes: {
      [CredentialType.NOTION_OAUTH_TOKEN]: {
        displayName: 'Notion Workspace',
        defaultScopes: [], // Notion scopes are managed in the integration capabilities
        description:
          'Authorize access to your Notion workspace for searching and reading pages/databases',
      },
    },
  },
  jira: {
    name: 'jira',
    displayName: 'Jira',
    credentialTypes: {
      [CredentialType.JIRA_CRED]: {
        displayName: 'Jira Cloud',
        defaultScopes: [
          'read:jira-user',
          'read:jira-work',
          'write:jira-work',
          'offline_access', // Required for refresh tokens
        ],
        description:
          'Access Jira Cloud for issue tracking and project management',
        scopeDescriptions: [
          {
            scope: 'read:jira-user',
            description: 'View user information and search for users',
            defaultEnabled: true,
          },
          {
            scope: 'read:jira-work',
            description: 'View issues, projects, and workflows',
            defaultEnabled: true,
          },
          {
            scope: 'write:jira-work',
            description: 'Create and update issues, comments, and transitions',
            defaultEnabled: true,
          },
          {
            scope: 'offline_access',
            description:
              'Maintain access when you are not actively using the app',
            defaultEnabled: true,
          },
        ],
      },
    },
    authorizationParams: {
      audience: 'api.atlassian.com',
      prompt: 'consent',
    },
  },
  slack: {
    name: 'slack',
    displayName: 'Slack',
    credentialTypes: {
      [CredentialType.SLACK_CRED]: {
        displayName: 'Slack Workspace',
        defaultScopes: [
          // Messaging - Read
          'app_mentions:read',
          'channels:history',
          'groups:history',
          'im:history',
          'mpim:history',
          // Messaging - Write
          'chat:write',
          'chat:write.public',
          'chat:write.customize',
          // Channels & Conversations
          'channels:read',
          'channels:join',
          'groups:read',
          'im:read',
          'mpim:read',
          // Users & Team
          'users:read',
          'users:read.email',
          'team:read',
          // Reactions
          'reactions:read',
          'reactions:write',
          // Files
          'files:read',
          'files:write',
          // Pins & Bookmarks
          'pins:read',
          'pins:write',
          'bookmarks:read',
          'bookmarks:write',
          // Links
          'links:read',
          'links:write',
          // Emoji
          'emoji:read',
          // Webhooks
          'incoming-webhook',
        ],
        description:
          'Connect to your Slack workspace for messaging, file sharing, and workflow automation',
        scopeDescriptions: [
          // Messaging - Read
          {
            scope: 'app_mentions:read',
            description: 'Receive notifications when someone @mentions the bot',
            defaultEnabled: true,
          },
          {
            scope: 'channels:history',
            description: 'Read messages in public channels',
            defaultEnabled: true,
          },
          {
            scope: 'groups:history',
            description:
              'Read messages in private channels where bot is invited',
            defaultEnabled: true,
          },
          {
            scope: 'im:history',
            description: 'Read direct messages with the bot',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:history',
            description: 'Read group DMs where bot is included',
            defaultEnabled: true,
          },
          // Messaging - Write
          {
            scope: 'chat:write',
            description: 'Send messages to channels where bot is invited',
            defaultEnabled: true,
          },
          {
            scope: 'chat:write.public',
            description: 'Send messages to any public channel',
            defaultEnabled: true,
          },
          {
            scope: 'chat:write.customize',
            description: 'Customize bot message appearance (username & avatar)',
            defaultEnabled: false,
          },
          // Channels & Conversations
          {
            scope: 'channels:read',
            description: 'View list of public channels',
            defaultEnabled: true,
          },
          {
            scope: 'channels:join',
            description: 'Join public channels automatically',
            defaultEnabled: false,
          },
          {
            scope: 'groups:read',
            description: 'View private channels where bot is member',
            defaultEnabled: true,
          },
          {
            scope: 'im:read',
            description: 'View direct message conversations',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:read',
            description: 'View group DM conversations',
            defaultEnabled: true,
          },
          // Users & Team
          {
            scope: 'users:read',
            description: 'View user names and basic info',
            defaultEnabled: true,
          },
          {
            scope: 'users:read.email',
            description: 'View user email addresses',
            defaultEnabled: false,
          },
          {
            scope: 'team:read',
            description: 'View workspace information',
            defaultEnabled: true,
          },
          // Reactions
          {
            scope: 'reactions:read',
            description: 'View emoji reactions on messages',
            defaultEnabled: true,
          },
          {
            scope: 'reactions:write',
            description: 'Add emoji reactions to messages',
            defaultEnabled: true,
          },
          // Files
          {
            scope: 'files:read',
            description: 'Access files shared in conversations',
            defaultEnabled: true,
          },
          {
            scope: 'files:write',
            description: 'Upload files to conversations',
            defaultEnabled: true,
          },
          // Pins & Bookmarks
          {
            scope: 'pins:read',
            description: 'View pinned messages',
            defaultEnabled: false,
          },
          {
            scope: 'pins:write',
            description: 'Pin messages to channels',
            defaultEnabled: false,
          },
          {
            scope: 'bookmarks:read',
            description: 'View channel bookmarks',
            defaultEnabled: false,
          },
          {
            scope: 'bookmarks:write',
            description: 'Add channel bookmarks',
            defaultEnabled: false,
          },
          // Links
          {
            scope: 'links:read',
            description: 'View URL metadata in messages',
            defaultEnabled: false,
          },
          {
            scope: 'links:write',
            description: 'Unfurl links in bot messages',
            defaultEnabled: false,
          },
          // Emoji
          {
            scope: 'emoji:read',
            description: 'View custom workspace emoji',
            defaultEnabled: false,
          },
          // Webhooks
          {
            scope: 'incoming-webhook',
            description: 'Post via incoming webhooks',
            defaultEnabled: false,
          },
        ],
      },
    },
  },
};

/**
 * Get the OAuth provider for a specific credential type
 * Safely maps credential types to their OAuth providers
 */
export function getOAuthProvider(
  credentialType: CredentialType
): OAuthProvider | null {
  for (const [providerName, config] of Object.entries(OAUTH_PROVIDERS)) {
    if (config.credentialTypes[credentialType]) {
      return providerName as OAuthProvider;
    }
  }
  return null;
}

/**
 * Check if a credential type is OAuth-based
 */
export function isOAuthCredential(credentialType: CredentialType): boolean {
  return getOAuthProvider(credentialType) !== null;
}

/**
 * Get scope descriptions for a specific credential type
 * Returns an array of scope descriptions that will be requested during OAuth
 */
export function getScopeDescriptions(
  credentialType: CredentialType
): ScopeDescription[] {
  const provider = getOAuthProvider(credentialType);
  if (!provider) {
    return [];
  }

  const providerConfig = OAUTH_PROVIDERS[provider];
  const credentialConfig = providerConfig?.credentialTypes[credentialType];

  if (!credentialConfig?.scopeDescriptions) {
    // Fallback: create descriptions from scope URLs if not explicitly defined
    return (
      credentialConfig?.defaultScopes.map((scope) => ({
        scope,
        description: `Access: ${scope}`,
        defaultEnabled: true, // Default to enabled if in defaultScopes
      })) || []
    );
  }

  return credentialConfig.scopeDescriptions;
}

/**
 * Browser session provider name - for BrowserBase-powered authentication
 */
export type BrowserSessionProvider = 'browserbase';

/**
 * Browser session credential type configuration
 */
export interface BrowserSessionCredentialConfig {
  displayName: string;
  description: string;
  targetUrl: string; // URL to navigate to for authentication
  cookieDomain: string; // Domain filter for captured cookies
}

/**
 * Browser session provider configuration
 */
export interface BrowserSessionProviderConfig {
  name: BrowserSessionProvider;
  displayName: string;
  credentialTypes: Partial<
    Record<CredentialType, BrowserSessionCredentialConfig>
  >;
}

/**
 * Browser session provider configurations - for credentials that use BrowserBase
 * browser sessions instead of OAuth or API keys
 */
export const BROWSER_SESSION_PROVIDERS: Record<
  BrowserSessionProvider,
  BrowserSessionProviderConfig
> = {
  browserbase: {
    name: 'browserbase',
    displayName: 'BrowserBase',
    credentialTypes: {
      [CredentialType.AMAZON_CRED]: {
        displayName: 'Amazon Account',
        description:
          'Log into Amazon to enable cart, order, and purchase automation',
        targetUrl: 'https://www.amazon.com',
        cookieDomain: 'amazon',
      },
      [CredentialType.LINKEDIN_CRED]: {
        displayName: 'LinkedIn Account',
        description:
          'Log into LinkedIn to enable connection requests and messaging automation',
        targetUrl: 'https://www.linkedin.com',
        cookieDomain: 'linkedin',
      },
    },
  },
};

/**
 * Get the browser session provider for a specific credential type
 */
export function getBrowserSessionProvider(
  credentialType: CredentialType
): BrowserSessionProvider | null {
  for (const [providerName, config] of Object.entries(
    BROWSER_SESSION_PROVIDERS
  )) {
    if (config.credentialTypes[credentialType]) {
      return providerName as BrowserSessionProvider;
    }
  }
  return null;
}

/**
 * Check if a credential type uses browser session authentication (BrowserBase)
 */
export function isBrowserSessionCredential(
  credentialType: CredentialType
): boolean {
  return getBrowserSessionProvider(credentialType) !== null;
}

/**
 * Maps bubble names to their accepted credential types
 */
export type CredentialOptions = Partial<Record<CredentialType, string>>;

/**
 * Collection of credential options for all bubbles
 */
export const BUBBLE_CREDENTIAL_OPTIONS: Record<BubbleName, CredentialType[]> = {
  'ai-agent': [
    CredentialType.OPENAI_CRED,
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.FIRECRAWL_API_KEY,
    CredentialType.OPENROUTER_CRED,
  ],
  postgresql: [CredentialType.DATABASE_CRED],
  slack: [CredentialType.SLACK_CRED],
  telegram: [CredentialType.TELEGRAM_BOT_TOKEN],
  resend: [CredentialType.RESEND_CRED],
  'database-analyzer': [CredentialType.DATABASE_CRED],
  'slack-notifier': [
    CredentialType.SLACK_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.ANTHROPIC_CRED,
  ],
  'slack-formatter-agent': [
    CredentialType.OPENAI_CRED,
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.ANTHROPIC_CRED,
  ],
  'slack-data-assistant': [
    CredentialType.DATABASE_CRED,
    CredentialType.SLACK_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.ANTHROPIC_CRED,
  ],
  'hello-world': [],
  http: [CredentialType.CUSTOM_AUTH_KEY],
  'get-bubble-details-tool': [],
  'get-trigger-detail-tool': [],
  'list-bubbles-tool': [],
  'sql-query-tool': [CredentialType.DATABASE_CRED],
  'chart-js-tool': [],
  'bubbleflow-validation-tool': [],
  'code-edit-tool': [CredentialType.OPENROUTER_CRED],
  'web-search-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-scrape-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-crawl-tool': [
    CredentialType.FIRECRAWL_API_KEY,
    CredentialType.GOOGLE_GEMINI_CRED,
  ],
  'web-extract-tool': [CredentialType.FIRECRAWL_API_KEY],
  'research-agent-tool': [
    CredentialType.FIRECRAWL_API_KEY,
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.OPENROUTER_CRED,
    CredentialType.APIFY_CRED,
  ],
  'reddit-scrape-tool': [],
  'bubbleflow-code-generator': [],
  'bubbleflow-generator': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENROUTER_CRED,
  ],
  'pdf-form-operations': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.OPENROUTER_CRED,
  ],
  'pdf-ocr-workflow': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.OPENROUTER_CRED,
  ],
  'generate-document-workflow': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.OPENROUTER_CRED,
  ],
  'parse-document-workflow': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENAI_CRED,
    CredentialType.ANTHROPIC_CRED,
    CredentialType.OPENROUTER_CRED,
    CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
    CredentialType.CLOUDFLARE_R2_SECRET_KEY,
    CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  ],
  storage: [
    CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
    CredentialType.CLOUDFLARE_R2_SECRET_KEY,
    CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  ],
  'google-drive': [CredentialType.GOOGLE_DRIVE_CRED],
  gmail: [CredentialType.GMAIL_CRED],
  'google-sheets': [CredentialType.GOOGLE_SHEETS_CRED],
  'google-calendar': [CredentialType.GOOGLE_CALENDAR_CRED],
  apify: [CredentialType.APIFY_CRED],
  'instagram-tool': [CredentialType.APIFY_CRED],
  'linkedin-tool': [CredentialType.APIFY_CRED],
  'tiktok-tool': [CredentialType.APIFY_CRED],
  'twitter-tool': [CredentialType.APIFY_CRED],
  'google-maps-tool': [CredentialType.APIFY_CRED],
  'youtube-tool': [CredentialType.APIFY_CRED],
  github: [CredentialType.GITHUB_TOKEN],
  'eleven-labs': [CredentialType.ELEVENLABS_API_KEY],
  followupboss: [CredentialType.FUB_CRED],
  'agi-inc': [CredentialType.AGI_API_KEY],
  airtable: [CredentialType.AIRTABLE_CRED],
  notion: [CredentialType.NOTION_OAUTH_TOKEN],
  firecrawl: [CredentialType.FIRECRAWL_API_KEY],
  'insforge-db': [
    CredentialType.INSFORGE_BASE_URL,
    CredentialType.INSFORGE_API_KEY,
  ],
  browserbase: [
    CredentialType.AMAZON_CRED,
    CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
    CredentialType.CLOUDFLARE_R2_SECRET_KEY,
    CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  ],
  'amazon-shopping-tool': [
    CredentialType.AMAZON_CRED,
    CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
    CredentialType.CLOUDFLARE_R2_SECRET_KEY,
    CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  ],
  crustdata: [CredentialType.CRUSTDATA_API_KEY],
  'company-enrichment-tool': [CredentialType.CRUSTDATA_API_KEY],
  'people-search-tool': [
    CredentialType.CRUSTDATA_API_KEY,
    CredentialType.FULLENRICH_API_KEY,
  ],
  jira: [CredentialType.JIRA_CRED],
  ashby: [CredentialType.ASHBY_CRED],
  fullenrich: [CredentialType.FULLENRICH_API_KEY],
  'linkedin-connection-tool': [
    CredentialType.LINKEDIN_CRED,
    CredentialType.CLOUDFLARE_R2_ACCESS_KEY,
    CredentialType.CLOUDFLARE_R2_SECRET_KEY,
    CredentialType.CLOUDFLARE_R2_ACCOUNT_ID,
  ],
  stripe: [CredentialType.STRIPE_CRED],
};

// POST /credentials - Create credential schema
export const createCredentialSchema = z
  .object({
    credentialType: z.nativeEnum(CredentialType).openapi({
      description: 'Type of credential to store',
      example: CredentialType.OPENAI_CRED,
    }),
    value: z.string().min(1).openapi({
      description: 'The credential value (will be encrypted)',
      example: 'sk-1234567890abcdef',
    }),
    name: z.string().optional().openapi({
      description: 'Optional user-friendly name for the credential',
      example: 'My OpenAI Key',
    }),
    skipValidation: z.boolean().optional().openapi({
      description:
        'Skip credential validation before storing (for testing/admin use)',
      example: false,
    }),
    credentialConfigurations: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          'Optional configurations for credential validation (e.g., ignoreSSL for PostgreSQL)',
        example: { ignoreSSL: true },
      }),
    metadata: databaseMetadataSchema.optional().openapi({
      description:
        'Optional metadata for the credential (e.g., database schema for DATABASE_CRED)',
      example: {
        tables: {
          users: {
            id: 'integer',
            email: 'character varying',
            created_at: 'timestamp with time zone',
          },
        },
        rules: [
          {
            id: 'rule-1',
            text: 'No direct DELETE on users table',
            enabled: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    }),
  })
  .openapi('CreateCredentialRequest');

// PUT /credentials/:id - Update credential schema
export const updateCredentialSchema = z
  .object({
    value: z.string().optional().openapi({
      description:
        'The credential value (will be encrypted). Leave empty to keep current value.',
      example: 'sk-1234567890abcdef',
    }),
    name: z.string().optional().openapi({
      description: 'Optional user-friendly name for the credential',
      example: 'My OpenAI Key',
    }),
    skipValidation: z.boolean().optional().openapi({
      description:
        'Skip credential validation before storing (for testing/admin use)',
      example: false,
    }),
    credentialConfigurations: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          'Optional configurations for credential validation (e.g., ignoreSSL for PostgreSQL)',
        example: { ignoreSSL: true },
      }),
    metadata: databaseMetadataSchema.optional().openapi({
      description:
        'Optional metadata for the credential (e.g., database schema for DATABASE_CRED)',
      example: {
        tables: {
          users: {
            id: 'integer',
            email: 'character varying',
            created_at: 'timestamp with time zone',
          },
        },
      },
    }),
  })
  .openapi('UpdateCredentialRequest');
// GET /credentials - List credentials response
export const credentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    credentialType: z.string().openapi({ description: 'Type of credential' }),
    name: z.string().optional().openapi({ description: 'Credential name' }),
    metadata: z
      .union([databaseMetadataSchema, jiraOAuthMetadataSchema])
      .optional()
      .openapi({
        description:
          'Credential metadata (DatabaseMetadata or JiraOAuthMetadata)',
      }),
    createdAt: z.string().openapi({ description: 'Creation timestamp' }),

    // OAuth-specific fields
    isOauth: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is an OAuth credential' }),
    oauthProvider: z
      .string()
      .optional()
      .openapi({ description: 'OAuth provider name' }),
    oauthExpiresAt: z
      .string()
      .optional()
      .openapi({ description: 'OAuth token expiration timestamp' }),
    oauthScopes: z
      .array(z.string())
      .optional()
      .openapi({ description: 'OAuth scopes granted' }),
    oauthStatus: z
      .enum(['active', 'expired', 'needs_refresh'])
      .optional()
      .openapi({ description: 'OAuth token status' }),

    // Browser session-specific fields
    isBrowserSession: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is a browser session credential' }),
    browserbaseSessionData: z
      .object({
        capturedAt: z.string(),
        cookieCount: z.number(),
        domain: z.string(),
      })
      .optional()
      .openapi({ description: 'Browser session metadata' }),
  })
  .openapi('CredentialResponse');

// POST /credentials - Create credential response
export const createCredentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('CreateCredentialResponse');

// PUT /credentials/:id - Update credential response
export const updateCredentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('UpdateCredentialResponse');

// General success message response (used by DELETE /credentials/:id, DELETE /bubble-flow/:id, PUT /bubble-flow/:id)
export const successMessageResponseSchema = z
  .object({
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('SuccessMessageResponse');

// BrowserBase session schemas
export const browserbaseSessionCreateRequestSchema = z
  .object({
    credentialType: z.nativeEnum(CredentialType).openapi({
      description: 'Type of credential requiring browser authentication',
      example: CredentialType.AMAZON_CRED,
    }),
    name: z.string().optional().openapi({
      description: 'User-friendly name for the credential',
      example: 'My Amazon Account',
    }),
  })
  .openapi('BrowserbaseSessionCreateRequest');

export const browserbaseSessionCreateResponseSchema = z
  .object({
    sessionId: z.string().openapi({
      description: 'BrowserBase session ID',
    }),
    debugUrl: z.string().openapi({
      description: 'URL to open for manual browser interaction',
    }),
    contextId: z.string().openapi({
      description: 'BrowserBase context ID for session persistence',
    }),
    state: z.string().openapi({
      description: 'State token for CSRF protection',
    }),
  })
  .openapi('BrowserbaseSessionCreateResponse');

export const browserbaseSessionCompleteRequestSchema = z
  .object({
    sessionId: z.string().openapi({
      description: 'BrowserBase session ID to complete',
    }),
    state: z.string().openapi({
      description: 'State token for verification',
    }),
    name: z.string().optional().openapi({
      description: 'User-friendly name for the credential',
    }),
  })
  .openapi('BrowserbaseSessionCompleteRequest');

export const browserbaseSessionCompleteResponseSchema = z
  .object({
    id: z.number().openapi({
      description: 'Created credential ID',
    }),
    message: z.string().openapi({
      description: 'Success message',
    }),
  })
  .openapi('BrowserbaseSessionCompleteResponse');

export const browserbaseSessionReopenRequestSchema = z
  .object({
    credentialId: z.number().openapi({
      description: 'ID of the credential to reopen session for',
    }),
  })
  .openapi('BrowserbaseSessionReopenRequest');

export const browserbaseSessionReopenResponseSchema = z
  .object({
    sessionId: z.string().openapi({
      description: 'BrowserBase session ID',
    }),
    debugUrl: z.string().openapi({
      description: 'URL to open for manual browser interaction',
    }),
  })
  .openapi('BrowserbaseSessionReopenResponse');

export type CreateCredentialRequest = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialRequest = z.infer<typeof updateCredentialSchema>;
export type CredentialResponse = z.infer<typeof credentialResponseSchema>;
export type CreateCredentialResponse = z.infer<
  typeof createCredentialResponseSchema
>;
export type UpdateCredentialResponse = z.infer<
  typeof updateCredentialResponseSchema
>;
export type BrowserbaseSessionCreateRequest = z.infer<
  typeof browserbaseSessionCreateRequestSchema
>;
export type BrowserbaseSessionCreateResponse = z.infer<
  typeof browserbaseSessionCreateResponseSchema
>;
export type BrowserbaseSessionCompleteRequest = z.infer<
  typeof browserbaseSessionCompleteRequestSchema
>;
export type BrowserbaseSessionCompleteResponse = z.infer<
  typeof browserbaseSessionCompleteResponseSchema
>;
export type BrowserbaseSessionReopenRequest = z.infer<
  typeof browserbaseSessionReopenRequestSchema
>;
export type BrowserbaseSessionReopenResponse = z.infer<
  typeof browserbaseSessionReopenResponseSchema
>;
