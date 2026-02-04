import { BubbleName, CredentialType } from './types.js';
import { z } from '@hono/zod-openapi';
import {
  databaseMetadataSchema,
  jiraOAuthMetadataSchema,
  slackOAuthMetadataSchema,
  airtableOAuthMetadataSchema,
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
    [CredentialType.AIRTABLE_OAUTH]: {
      label: 'Airtable (OAuth)',
      description:
        'OAuth connection to Airtable for full API access including webhooks',
      placeholder: '', // Not used for OAuth
      namePlaceholder: 'My Airtable Connection',
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
    [CredentialType.CREDENTIAL_WILDCARD]: {
      label: 'Any Credential',
      description:
        'Wildcard marker - this is not a real credential type, used internally to indicate any credential is accepted',
      placeholder: '',
      namePlaceholder: '',
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
  [CredentialType.AIRTABLE_OAUTH]: '', // OAuth credential, no env var
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
  [CredentialType.CREDENTIAL_WILDCARD]: '', // Wildcard marker, not a real credential
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
  CredentialType.CREDENTIAL_WILDCARD, // Wildcard means any credential is accepted, so it's always optional
]);

/**
 * OAuth provider names - type-safe provider identifiers
 */
export type OAuthProvider =
  | 'google'
  | 'followupboss'
  | 'notion'
  | 'jira'
  | 'slack'
  | 'airtable';

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
  defaultScopes: string[]; // OAuth scopes for this credential type (non-admin, safe for any user)
  adminScopes?: string[]; // OAuth scopes that require admin approval (optional)
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
          // Channels & Conversations - Read
          'channels:read',
          'groups:read',
          'im:read',
          'mpim:read',
          // Channels & Conversations - Write (non-admin)
          'channels:join',
          // Users & Team (read-only)
          'users:read',
          'users:read.email',
          'users.profile:read',
          'team:read',
          'usergroups:read',
          'dnd:read',
          // Reactions
          'reactions:read',
          'reactions:write',
          // Files
          'files:read',
          'files:write',
          // Pins & Bookmarks (read-only)
          'pins:read',
          'bookmarks:read',
          // Reminders
          'reminders:read',
          'reminders:write',
          // Commands
          'commands',
          // Metadata & Emoji
          'metadata.message:read',
          'emoji:read',
        ],
        adminScopes: [
          // Channel management (requires admin)
          'channels:manage',
          'channels:write.invites',
          'channels:write.topic',
          // Private channel management (requires admin)
          'groups:write',
          'groups:write.invites',
          'groups:write.topic',
          // DM management (requires admin)
          'im:write',
          'im:write.topic',
          'mpim:write',
          'mpim:write.topic',
          // User management (requires admin)
          'users:write',
          'usergroups:write',
          // Pins & Bookmarks write (requires admin)
          'pins:write',
          'bookmarks:write',
          // Links (requires admin)
          'links:read',
          'links:write',
          'links.embed:write',
          // Canvases & Lists (requires admin)
          'canvases:read',
          'canvases:write',
          'lists:read',
          'lists:write',
          // Calls (requires admin)
          'calls:read',
          'calls:write',
          // Slack Connect (requires admin)
          'conversations.connect:read',
          'conversations.connect:write',
          'conversations.connect:manage',
          // Remote files (requires admin)
          'remote_files:read',
          'remote_files:write',
          'remote_files:share',
          // Assistant (requires admin)
          'assistant:write',
          // Search (requires admin)
          'search:read.files',
          'search:read.public',
          'search:read.users',
          // Team Preferences (requires admin)
          'team.preferences:read',
        ],
        description:
          'Connect to your Slack workspace for full messaging, file sharing, and workflow automation capabilities',
        scopeDescriptions: [
          // Messaging - Read
          {
            scope: 'app_mentions:read',
            description: 'Receive @mentions of the bot',
            defaultEnabled: true,
          },
          {
            scope: 'channels:history',
            description: 'Read messages in public channels',
            defaultEnabled: true,
          },
          {
            scope: 'groups:history',
            description: 'Read messages in private channels',
            defaultEnabled: true,
          },
          {
            scope: 'im:history',
            description: 'Read direct messages with the bot',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:history',
            description: 'Read group DMs with the bot',
            defaultEnabled: true,
          },
          // Messaging - Write
          {
            scope: 'chat:write',
            description: 'Send messages to channels',
            defaultEnabled: true,
          },
          {
            scope: 'chat:write.public',
            description: 'Send messages to any public channel',
            defaultEnabled: true,
          },
          {
            scope: 'chat:write.customize',
            description: 'Customize bot username and avatar',
            defaultEnabled: true,
          },
          // Channels - Read
          {
            scope: 'channels:read',
            description: 'View public channels list',
            defaultEnabled: true,
          },
          {
            scope: 'groups:read',
            description: 'View private channels list',
            defaultEnabled: true,
          },
          {
            scope: 'im:read',
            description: 'View direct messages list',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:read',
            description: 'View group DMs list',
            defaultEnabled: true,
          },
          // Channels - Write
          {
            scope: 'channels:join',
            description: 'Join public channels',
            defaultEnabled: true,
          },
          {
            scope: 'channels:manage',
            description: 'Create and archive public channels',
            defaultEnabled: true,
          },
          {
            scope: 'channels:write.invites',
            description: 'Invite users to public channels',
            defaultEnabled: true,
          },
          {
            scope: 'channels:write.topic',
            description: 'Set public channel topics',
            defaultEnabled: true,
          },
          {
            scope: 'groups:write',
            description: 'Create and archive private channels',
            defaultEnabled: true,
          },
          {
            scope: 'groups:write.invites',
            description: 'Invite users to private channels',
            defaultEnabled: true,
          },
          {
            scope: 'groups:write.topic',
            description: 'Set private channel topics',
            defaultEnabled: true,
          },
          {
            scope: 'im:write',
            description: 'Start DM conversations',
            defaultEnabled: true,
          },
          {
            scope: 'im:write.topic',
            description: 'Set DM topics',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:write',
            description: 'Start group DM conversations',
            defaultEnabled: true,
          },
          {
            scope: 'mpim:write.topic',
            description: 'Set group DM topics',
            defaultEnabled: true,
          },
          // Users & Team
          {
            scope: 'users:read',
            description: 'View user information',
            defaultEnabled: true,
          },
          {
            scope: 'users:read.email',
            description: 'View user emails',
            defaultEnabled: true,
          },
          {
            scope: 'users:write',
            description: 'Set bot presence status',
            defaultEnabled: true,
          },
          {
            scope: 'users.profile:read',
            description: 'View detailed user profiles',
            defaultEnabled: true,
          },
          {
            scope: 'team:read',
            description: 'View workspace info',
            defaultEnabled: true,
          },
          {
            scope: 'usergroups:read',
            description: 'View user groups',
            defaultEnabled: true,
          },
          {
            scope: 'usergroups:write',
            description: 'Manage user groups',
            defaultEnabled: true,
          },
          {
            scope: 'dnd:read',
            description: 'View Do Not Disturb status',
            defaultEnabled: true,
          },
          // Reactions
          {
            scope: 'reactions:read',
            description: 'View emoji reactions',
            defaultEnabled: true,
          },
          {
            scope: 'reactions:write',
            description: 'Add emoji reactions',
            defaultEnabled: true,
          },
          // Files
          {
            scope: 'files:read',
            description: 'View shared files',
            defaultEnabled: true,
          },
          {
            scope: 'files:write',
            description: 'Upload files',
            defaultEnabled: true,
          },
          {
            scope: 'remote_files:read',
            description: 'View remote files',
            defaultEnabled: true,
          },
          {
            scope: 'remote_files:write',
            description: 'Manage remote files',
            defaultEnabled: true,
          },
          {
            scope: 'remote_files:share',
            description: 'Share remote files',
            defaultEnabled: true,
          },
          // Pins & Bookmarks
          {
            scope: 'pins:read',
            description: 'View pinned messages',
            defaultEnabled: true,
          },
          {
            scope: 'pins:write',
            description: 'Pin messages',
            defaultEnabled: true,
          },
          {
            scope: 'bookmarks:read',
            description: 'View bookmarks',
            defaultEnabled: true,
          },
          {
            scope: 'bookmarks:write',
            description: 'Add bookmarks',
            defaultEnabled: true,
          },
          // Links
          {
            scope: 'links:read',
            description: 'View link metadata',
            defaultEnabled: true,
          },
          {
            scope: 'links:write',
            description: 'Unfurl links',
            defaultEnabled: true,
          },
          {
            scope: 'links.embed:write',
            description: 'Embed video players',
            defaultEnabled: true,
          },
          // Canvases & Lists
          {
            scope: 'canvases:read',
            description: 'Read Slack canvases',
            defaultEnabled: true,
          },
          {
            scope: 'canvases:write',
            description: 'Create and edit canvases',
            defaultEnabled: true,
          },
          {
            scope: 'lists:read',
            description: 'Read Slack lists',
            defaultEnabled: true,
          },
          {
            scope: 'lists:write',
            description: 'Manage Slack lists',
            defaultEnabled: true,
          },
          // Calls
          {
            scope: 'calls:read',
            description: 'View call information',
            defaultEnabled: true,
          },
          {
            scope: 'calls:write',
            description: 'Start and manage calls',
            defaultEnabled: true,
          },
          // Reminders
          {
            scope: 'reminders:read',
            description: 'View reminders',
            defaultEnabled: true,
          },
          {
            scope: 'reminders:write',
            description: 'Create reminders',
            defaultEnabled: true,
          },
          // Slack Connect
          {
            scope: 'conversations.connect:read',
            description: 'View Slack Connect events',
            defaultEnabled: true,
          },
          {
            scope: 'conversations.connect:write',
            description: 'Create Slack Connect invites',
            defaultEnabled: true,
          },
          {
            scope: 'conversations.connect:manage',
            description: 'Manage Slack Connect channels',
            defaultEnabled: true,
          },
          // Commands
          {
            scope: 'commands',
            description: 'Use slash commands',
            defaultEnabled: true,
          },
          // Metadata & Emoji
          {
            scope: 'metadata.message:read',
            description: 'Read message metadata',
            defaultEnabled: true,
          },
          {
            scope: 'emoji:read',
            description: 'View custom emoji',
            defaultEnabled: true,
          },
          // Assistant
          {
            scope: 'assistant:write',
            description: 'Respond in Slack AI threads',
            defaultEnabled: true,
          },
          // Search
          {
            scope: 'search:read.files',
            description: 'Search files',
            defaultEnabled: true,
          },
          {
            scope: 'search:read.public',
            description: 'Search public channels',
            defaultEnabled: true,
          },
          {
            scope: 'search:read.users',
            description: 'Search for users',
            defaultEnabled: true,
          },
          // Team Preferences
          {
            scope: 'team.preferences:read',
            description: 'Read workspace preferences',
            defaultEnabled: true,
          },
        ],
      },
    },
  },
  airtable: {
    name: 'airtable',
    displayName: 'Airtable',
    credentialTypes: {
      [CredentialType.AIRTABLE_OAUTH]: {
        displayName: 'Airtable (OAuth)',
        defaultScopes: [
          'data.records:read',
          'data.records:write',
          'data.recordComments:read',
          'data.recordComments:write',
          'schema.bases:read',
          'schema.bases:write',
          'user.email:read',
          'webhook:manage',
        ],
        description:
          'Connect to Airtable with OAuth for full API access including webhooks',
        scopeDescriptions: [
          {
            scope: 'data.records:read',
            description: 'See the data in records',
            defaultEnabled: true,
          },
          {
            scope: 'data.records:write',
            description: 'Create, edit, and delete records',
            defaultEnabled: true,
          },
          {
            scope: 'data.recordComments:read',
            description: 'See comments in records',
            defaultEnabled: true,
          },
          {
            scope: 'data.recordComments:write',
            description: 'Create, edit, and delete record comments',
            defaultEnabled: true,
          },
          {
            scope: 'schema.bases:read',
            description:
              'See the structure of a base, like table names or field types',
            defaultEnabled: true,
          },
          {
            scope: 'schema.bases:write',
            description:
              'Edit the structure of a base, like adding new fields or tables',
            defaultEnabled: true,
          },
          {
            scope: 'user.email:read',
            description: "See the user's email address",
            defaultEnabled: true,
          },
          {
            scope: 'webhook:manage',
            description:
              'View, create, delete webhooks for a base, as well as fetch webhook payloads',
            defaultEnabled: true,
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
 * Get default (non-admin) scopes for a specific credential type
 * Returns only the scopes that don't require admin approval
 */
export function getDefaultScopes(credentialType: CredentialType): string[] {
  const provider = getOAuthProvider(credentialType);
  if (!provider) {
    return [];
  }

  const providerConfig = OAUTH_PROVIDERS[provider];
  const credentialConfig = providerConfig?.credentialTypes[credentialType];

  return credentialConfig?.defaultScopes || [];
}

/**
 * Get admin scopes for a specific credential type
 * Returns only the scopes that require admin/workspace admin approval
 */
export function getAdminScopes(credentialType: CredentialType): string[] {
  const provider = getOAuthProvider(credentialType);
  if (!provider) {
    return [];
  }

  const providerConfig = OAUTH_PROVIDERS[provider];
  const credentialConfig = providerConfig?.credentialTypes[credentialType];

  return credentialConfig?.adminScopes || [];
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
 * Credential options for a bubble - array of credential types.
 * Use CredentialType.CREDENTIAL_WILDCARD to indicate the bubble accepts any credential.
 */
export type BubbleCredentialOption = CredentialType[];

/**
 * Collection of credential options for all bubbles
 */
export const BUBBLE_CREDENTIAL_OPTIONS: Record<
  BubbleName,
  BubbleCredentialOption
> = {
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
  http: [CredentialType.CREDENTIAL_WILDCARD], // Accepts any credential type for flexible API integrations
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
  airtable: [CredentialType.AIRTABLE_CRED, CredentialType.AIRTABLE_OAUTH],
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
  'yc-scraper-tool': [CredentialType.APIFY_CRED],
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
      .union([
        databaseMetadataSchema,
        jiraOAuthMetadataSchema,
        slackOAuthMetadataSchema,
        airtableOAuthMetadataSchema,
      ])
      .optional()
      .openapi({
        description:
          'Credential metadata (DatabaseMetadata, JiraOAuthMetadata, SlackOAuthMetadata, or AirtableOAuthMetadata)',
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

    // Master/Child credential relationship (for Slack OAuth)
    masterCredentialId: z.number().optional().openapi({
      description:
        'ID of the master credential this credential uses for tokens (null means this is a master)',
    }),
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
