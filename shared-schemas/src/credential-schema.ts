import { BubbleName, CredentialType } from './types.js';

/**
 * Maps credential types to their environment variable names (for backend only!!!!)
 */
export const CREDENTIAL_ENV_MAP: Record<CredentialType, string> = {
  [CredentialType.OPENAI_CRED]: 'OPENAI_API_KEY',
  [CredentialType.GOOGLE_GEMINI_CRED]: 'GOOGLE_API_KEY',
  [CredentialType.ANTHROPIC_CRED]: 'ANTHROPIC_API_KEY',
  [CredentialType.FIRECRAWL_API_KEY]: 'FIRECRAWL_API_KEY',
  [CredentialType.DATABASE_CRED]: 'BUBBLE_CONNECTING_STRING_URL',
  [CredentialType.SLACK_CRED]: 'SLACK_TOKEN',
  [CredentialType.RESEND_CRED]: 'RESEND_API_KEY',
  [CredentialType.OPENROUTER_CRED]: 'OPENROUTER_API_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'CLOUDFLARE_R2_ACCESS_KEY',
  [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'CLOUDFLARE_R2_SECRET_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: 'CLOUDFLARE_R2_ACCOUNT_ID',
  [CredentialType.GOOGLE_DRIVE_CRED]: '',
  [CredentialType.GMAIL_CRED]: '',
  [CredentialType.GOOGLE_SHEETS_CRED]: '',
  [CredentialType.GOOGLE_CALENDAR_CRED]: '',
};

/**
 * OAuth provider names - type-safe provider identifiers
 */
export type OAuthProvider = 'google';

/**
 * OAuth credential type configuration for a specific service under a provider
 */
export interface OAuthCredentialConfig {
  displayName: string; // User-facing name
  defaultScopes: string[]; // OAuth scopes for this credential type
  description: string; // Description of what this credential provides access to
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
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
        ],
        description: 'Access Google Drive files and folders',
      },
      [CredentialType.GMAIL_CRED]: {
        displayName: 'Gmail',
        defaultScopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
        description: 'Access Gmail for reading, sending, and managing emails',
      },
      [CredentialType.GOOGLE_SHEETS_CRED]: {
        displayName: 'Google Sheets',
        defaultScopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
        description:
          'Access Google Sheets for reading and writing spreadsheet data',
      },
      [CredentialType.GOOGLE_CALENDAR_CRED]: {
        displayName: 'Google Calendar',
        defaultScopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        description: 'Access Google Calendar for reading and managing events',
      },
    },
    authorizationParams: {
      access_type: 'offline', // Required for refresh tokens
      prompt: 'consent', // Force consent screen to ensure refresh token is issued
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
  ],
  postgresql: [CredentialType.DATABASE_CRED],
  slack: [CredentialType.SLACK_CRED],
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
  http: [],
  'get-bubble-details-tool': [],
  'list-bubbles-tool': [],
  'sql-query-tool': [],
  'chart-js-tool': [],
  'bubbleflow-validation-tool': [],
  'web-search-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-scrape-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-crawl-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-extract-tool': [CredentialType.FIRECRAWL_API_KEY],
  'research-agent-tool': [
    CredentialType.FIRECRAWL_API_KEY,
    CredentialType.GOOGLE_GEMINI_CRED,
  ],
  'reddit-scrape-tool': [],
  'bubbleflow-code-generator': [],
  'bubbleflow-generator': [
    CredentialType.GOOGLE_GEMINI_CRED,
    CredentialType.OPENROUTER_CRED,
  ],
  'pdf-form-operations': [],
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
};
