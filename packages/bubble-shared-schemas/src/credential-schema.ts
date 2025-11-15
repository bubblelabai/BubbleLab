import { BubbleName, CredentialType } from './types.js';
import { z } from '@hono/zod-openapi';
import { databaseMetadataSchema } from './database-definition-schema.js';

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
  [CredentialType.RESEND_CRED]: 'RESEND_API_KEY',
  [CredentialType.OPENROUTER_CRED]: 'OPENROUTER_API_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'CLOUDFLARE_R2_ACCESS_KEY',
  [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'CLOUDFLARE_R2_SECRET_KEY',
  [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: 'CLOUDFLARE_R2_ACCOUNT_ID',
  [CredentialType.APIFY_CRED]: 'APIFY_API_TOKEN',
  [CredentialType.GOOGLE_DRIVE_CRED]: '',
  [CredentialType.GMAIL_CRED]: '',
  [CredentialType.GOOGLE_SHEETS_CRED]: '',
  [CredentialType.GOOGLE_CALENDAR_CRED]: '',
  [CredentialType.GITHUB_TOKEN]: 'GITHUB_TOKEN',
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
]);

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
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
        description: 'Access Google Drive files and folders',
      },
      [CredentialType.GMAIL_CRED]: {
        displayName: 'Gmail',
        defaultScopes: ['https://www.googleapis.com/auth/gmail.send'],
        description: 'Access Gmail for sending emails',
      },
      [CredentialType.GOOGLE_SHEETS_CRED]: {
        displayName: 'Google Sheets',
        defaultScopes: ['https://www.googleapis.com/auth/spreadsheets'],
        description:
          'Access Google Sheets for reading and writing spreadsheet data',
      },
      [CredentialType.GOOGLE_CALENDAR_CRED]: {
        displayName: 'Google Calendar',
        defaultScopes: ['https://www.googleapis.com/auth/calendar'],
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
    CredentialType.OPENROUTER_CRED,
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
  'sql-query-tool': [CredentialType.DATABASE_CRED],
  'chart-js-tool': [],
  'bubbleflow-validation-tool': [],
  'code-edit-tool': [CredentialType.OPENROUTER_CRED],
  'web-search-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-scrape-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-crawl-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-extract-tool': [CredentialType.FIRECRAWL_API_KEY],
  'web-test-tool': [CredentialType.FIRECRAWL_API_KEY],
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
  apify: [CredentialType.APIFY_CRED],
  'instagram-tool': [CredentialType.APIFY_CRED],
  'linkedin-tool': [CredentialType.APIFY_CRED],
  'youtube-tool': [CredentialType.APIFY_CRED],
  github: [CredentialType.GITHUB_TOKEN],
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
    metadata: databaseMetadataSchema
      .optional()
      .openapi({ description: 'Credential metadata' }),
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

export type CreateCredentialRequest = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialRequest = z.infer<typeof updateCredentialSchema>;
export type CredentialResponse = z.infer<typeof credentialResponseSchema>;
export type CreateCredentialResponse = z.infer<
  typeof createCredentialResponseSchema
>;
export type UpdateCredentialResponse = z.infer<
  typeof updateCredentialResponseSchema
>;
