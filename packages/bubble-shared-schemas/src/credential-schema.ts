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
  [CredentialType.FUB_CRED]: '',
  [CredentialType.FUB_API_KEY_CRED]: 'FUB_API_KEY',
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
export type OAuthProvider = 'google' | 'followupboss';

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
              'View and manage Google Drive files and folders that you have created with Bubble Lab',
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
            scope: 'https://www.googleapis.com/auth/drive',
            description:
              'View and manage all ofyour Google Drive files and folders (will see a warning about an "untrusted app" during authentication. Choose only if you need extra permissions)',
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
 * Maps bubble names to their accepted credential types
 */
export type CredentialOptions = Partial<Record<CredentialType, string>>;

/**
 * Credential group configuration for services with multiple auth methods
 */
export interface CredentialGroupConfig {
  label: string; // Display label for the group (e.g., "Follow Up Boss")
  types: CredentialType[]; // Credential types that belong to this group
  typeLabels: Partial<Record<CredentialType, string>>; // Labels for each type within the group
}

/**
 * Groups of credential types that are alternatives (user picks one)
 * Used to display related auth methods together in UI
 */
export const CREDENTIAL_GROUPS: Record<string, CredentialGroupConfig> = {
  followupboss: {
    label: 'Follow Up Boss',
    types: [CredentialType.FUB_CRED, CredentialType.FUB_API_KEY_CRED],
    typeLabels: {
      [CredentialType.FUB_CRED]: 'OAuth',
      [CredentialType.FUB_API_KEY_CRED]: 'API Key',
    },
  },
};

/**
 * Get the group name for a credential type, if it belongs to a group
 */
export function getCredentialGroupName(
  credentialType: CredentialType
): string | null {
  for (const [groupName, config] of Object.entries(CREDENTIAL_GROUPS)) {
    if (config.types.includes(credentialType)) {
      return groupName;
    }
  }
  return null;
}

/**
 * Get the group configuration for a credential type
 */
export function getCredentialGroup(
  credentialType: CredentialType
): CredentialGroupConfig | null {
  const groupName = getCredentialGroupName(credentialType);
  return groupName ? CREDENTIAL_GROUPS[groupName] : null;
}

/**
 * Check if credential types are alternatives (belong to same group)
 * Returns the group config if they are alternatives, null otherwise
 */
export function getAlternativeCredentialsGroup(
  types: CredentialType[]
): CredentialGroupConfig | null {
  if (types.length < 2) return null;

  // Check if all types belong to the same group
  const firstGroup = getCredentialGroupName(types[0]);
  if (!firstGroup) return null;

  const allSameGroup = types.every(
    (type) => getCredentialGroupName(type) === firstGroup
  );

  return allSameGroup ? CREDENTIAL_GROUPS[firstGroup] : null;
}

/**
 * Get the label for a credential type within its group
 */
export function getCredentialTypeLabel(credentialType: CredentialType): string {
  const group = getCredentialGroup(credentialType);
  if (group && group.typeLabels[credentialType]) {
    return group.typeLabels[credentialType];
  }
  return credentialType;
}

/**
 * Check if credentials are satisfied for a set of required credential types.
 * For grouped credentials (alternatives), only one needs to be selected.
 * For non-grouped credentials, each one must be selected individually.
 *
 * @param requiredTypes - Array of required credential types
 * @param selectedCredentials - Record of credentialType -> credentialId (or null/undefined if not selected)
 * @param systemCredentials - Set of credential types that are system-managed (optional)
 * @returns Object with isValid boolean and array of missing credential labels
 */
export function validateCredentialSelection(
  requiredTypes: CredentialType[],
  selectedCredentials: Record<string, number | null | undefined>,
  systemCredentials?: Set<CredentialType>
): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Filter out system credentials
  const nonSystemTypes = systemCredentials
    ? requiredTypes.filter((t) => !systemCredentials.has(t))
    : requiredTypes;

  if (nonSystemTypes.length === 0) {
    return { isValid: true, missing: [] };
  }

  // Check if these credential types form a group (alternatives)
  const alternativeGroup = getAlternativeCredentialsGroup(nonSystemTypes);

  if (alternativeGroup) {
    // For grouped credentials, only ONE needs to be selected
    const hasAnySelected = nonSystemTypes.some((credType) => {
      const selectedId = selectedCredentials[credType];
      return selectedId !== undefined && selectedId !== null;
    });

    if (!hasAnySelected) {
      missing.push(alternativeGroup.label);
    }
  } else {
    // For non-grouped credentials, check each one individually
    for (const credType of nonSystemTypes) {
      const selectedId = selectedCredentials[credType];
      if (selectedId === undefined || selectedId === null) {
        missing.push(credType);
      }
    }
  }

  return { isValid: missing.length === 0, missing };
}

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
  followupboss: [CredentialType.FUB_CRED, CredentialType.FUB_API_KEY_CRED],
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
