/**
 * Database Definition Schema
 *
 * This schema is designed to store database table definitions and metadata
 */

import { z } from '@hono/zod-openapi';

// Database connection types for frontend display
export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'bigquery' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username?: string;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  lastUsed: string;
  description?: string;
}

export type DatabaseStatus = 'connected' | 'disconnected' | 'error';
export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'bigquery'
  | 'sqlite';

// Database schema types for table structure display
export interface DatabaseColumn {
  name: string;
  type: string;
  isNullable: boolean;
  defaultValue?: string;
  constraints?: string[];
}

export interface DatabaseTable {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
  rowCount?: number;
  size?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  totalTables: number;
  totalSize?: string;
}

// Schema for database metadata that can be stored in credentials
export const databaseMetadataSchema = z.object({
  // Core database definition - mapping of table names to column definitions
  // Format: { [tableName]: { [columnName]: columnType } }
  tables: z.record(
    z.string(), // table name
    z.record(
      z.string(), // column name
      z.string() // notes about it
    )
  ),
  // Table-level notes - mapping of table names to notes about the entire table
  tableNotes: z.record(z.string(), z.string()).optional(),
  // Optional metadata
  databaseName: z.string().optional(),
  databaseType: z
    .enum(['postgresql', 'mysql', 'sqlite', 'mssql', 'oracle'])
    .optional(),
  // Rules and constraints - simplified to match frontend
  rules: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        enabled: z.boolean(),
        createdAt: z.string(), // ISO string
        updatedAt: z.string(), // ISO string
      })
    )
    .optional(),
  // Additional context
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type DatabaseMetadata = z.infer<typeof databaseMetadataSchema>;

/**
 * Jira OAuth metadata - stored after OAuth callback with cloudId for API calls
 */
export const jiraOAuthMetadataSchema = z.object({
  cloudId: z.string(),
  siteUrl: z.string(),
  siteName: z.string().optional(),
  /** Human-readable display name for the credential (e.g., Jira site name) */
  displayName: z.string().optional(),
});

export type JiraOAuthMetadata = z.infer<typeof jiraOAuthMetadataSchema>;

/**
 * Stripe Apps OAuth metadata - stored after OAuth callback
 */
export const stripeOAuthMetadataSchema = z.object({
  stripeUserId: z.string(), // Connected account ID (acct_xxx)
  stripePublishableKey: z.string(), // Publishable key (pk_live_xxx or pk_test_xxx)
  livemode: z.boolean(), // true = production, false = test mode
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type StripeOAuthMetadata = z.infer<typeof stripeOAuthMetadataSchema>;

/**
 * Slack OAuth metadata - stored after OAuth callback with workspace info
 */
export const slackOAuthMetadataSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  botUserId: z.string().optional(),
  /** Human-readable display name for the credential (workspace name) */
  displayName: z.string().optional(),
  /**
   * Installing user's Slack user id — populated when the install also granted a user token
   * (xoxp). The xoxp itself lives in the `oauthUserAccessToken` column on userCredentials,
   * not here. Informational only.
   */
  userId: z.string().optional(),
});

export type SlackOAuthMetadata = z.infer<typeof slackOAuthMetadataSchema>;

/**
 * Airtable OAuth metadata - stored after OAuth callback
 */
export const airtableOAuthMetadataSchema = z.object({
  airtableUserId: z.string(),
  email: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type AirtableOAuthMetadata = z.infer<typeof airtableOAuthMetadataSchema>;

/**
 * Google OAuth metadata - stored after OAuth callback with user info
 */
export const googleOAuthMetadataSchema = z.object({
  email: z.string(),
  /** Human-readable display name for the credential (Google account email) */
  displayName: z.string().optional(),
});

export type GoogleOAuthMetadata = z.infer<typeof googleOAuthMetadataSchema>;

/**
 * Notion OAuth metadata - stored after OAuth callback with workspace info
 */
export const notionOAuthMetadataSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  workspaceIcon: z.string().optional(),
  botId: z.string(),
  /** Human-readable display name for the credential (workspace name) */
  displayName: z.string().optional(),
});

export type NotionOAuthMetadata = z.infer<typeof notionOAuthMetadataSchema>;

/**
 * Linear OAuth metadata - stored after OAuth callback with organization info
 */
export const linearOAuthMetadataSchema = z.object({
  organizationName: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type LinearOAuthMetadata = z.infer<typeof linearOAuthMetadataSchema>;

/**
 * Xero OAuth metadata - stored after OAuth callback with tenantId for API calls
 */
export const xeroOAuthMetadataSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string().optional(),
  tenantType: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type XeroOAuthMetadata = z.infer<typeof xeroOAuthMetadataSchema>;

/**
 * Ramp OAuth metadata - stored after OAuth callback with business info
 */
export const rampOAuthMetadataSchema = z.object({
  businessName: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type RampOAuthMetadata = z.infer<typeof rampOAuthMetadataSchema>;

/**
 * Zendesk OAuth metadata - stored after OAuth callback with subdomain for API calls
 */
export const zendeskOAuthMetadataSchema = z.object({
  subdomain: z.string(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type ZendeskOAuthMetadata = z.infer<typeof zendeskOAuthMetadataSchema>;

/**
 * Salesforce OAuth metadata - stored after OAuth callback with instance URL for API calls
 */
export const salesforceOAuthMetadataSchema = z.object({
  instanceUrl: z.string(),
  organizationId: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type SalesforceOAuthMetadata = z.infer<
  typeof salesforceOAuthMetadataSchema
>;

/**
 * Asana OAuth metadata - stored after OAuth callback with workspace info
 */
export const asanaOAuthMetadataSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type AsanaOAuthMetadata = z.infer<typeof asanaOAuthMetadataSchema>;

/**
 * Discord OAuth metadata - stored after OAuth callback with guild info
 */
export const discordOAuthMetadataSchema = z.object({
  guildId: z.string(),
  guildName: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type DiscordOAuthMetadata = z.infer<typeof discordOAuthMetadataSchema>;

/**
 * DocuSign OAuth metadata - stored after OAuth callback with account info for API calls
 */
export const docuSignOAuthMetadataSchema = z.object({
  accountId: z.string(),
  baseUri: z.string(),
  accountName: z.string().optional(),
  /** Human-readable display name for the credential */
  displayName: z.string().optional(),
});

export type DocuSignOAuthMetadata = z.infer<typeof docuSignOAuthMetadataSchema>;

/**
 * Base preference fields that can be added to any credential metadata.
 * These are used for default credential selection and usage tracking.
 */
export const credentialPreferencesSchema = z.object({
  /** Whether this credential is the user's default for its credential type */
  isDefault: z.boolean().optional(),
  /** ISO timestamp of when this credential was last used in a flow execution */
  lastUsedAt: z.string().optional(),
});

export type CredentialPreferences = z.infer<typeof credentialPreferencesSchema>;

/**
 * Confluence OAuth metadata - stored after OAuth callback with cloudId for API calls
 * Uses the same Atlassian Cloud infrastructure as Jira
 */
export const confluenceOAuthMetadataSchema = z.object({
  cloudId: z.string(),
  siteUrl: z.string(),
  siteName: z.string().optional(),
  /** Human-readable display name for the credential (e.g., Confluence site name) */
  displayName: z.string().optional(),
});

export type ConfluenceOAuthMetadata = z.infer<
  typeof confluenceOAuthMetadataSchema
>;

/**
 * Proxy configuration for browser session credentials (embedded in session payload)
 */
export const browserSessionProxyConfigSchema = z.object({
  server: z.string().describe('Proxy server URL'),
  username: z.string().optional().describe('Proxy authentication username'),
  password: z.string().optional().describe('Proxy authentication password'),
});

export type BrowserSessionProxyConfig = z.infer<
  typeof browserSessionProxyConfigSchema
>;

/**
 * Metadata for browser session credentials (AMAZON_CRED, LINKEDIN_CRED)
 * Stored when completing BrowserBase session; proxy is embedded in the session payload
 */
export const browserSessionMetadataSchema = z.object({
  proxy: browserSessionProxyConfigSchema.optional(),
});

export type BrowserSessionMetadata = z.infer<
  typeof browserSessionMetadataSchema
>;

/**
 * Union type for all credential metadata types
 * - DatabaseMetadata: For DATABASE_CRED (PostgreSQL, etc.)
 * - JiraOAuthMetadata: For JIRA_CRED OAuth credentials
 * - SlackOAuthMetadata: For SLACK_CRED OAuth credentials
 * - ConfluenceOAuthMetadata: For CONFLUENCE_CRED OAuth credentials
 * - NotionOAuthMetadata: For NOTION_OAUTH_TOKEN OAuth credentials
 *
 * All metadata types include optional preference fields (isDefault, lastUsedAt)
 * for default credential selection and usage tracking.
 */
export type CredentialMetadata =
  | DatabaseMetadata
  | JiraOAuthMetadata
  | SlackOAuthMetadata
  | AirtableOAuthMetadata
  | GoogleOAuthMetadata
  | NotionOAuthMetadata
  | ConfluenceOAuthMetadata
  | StripeOAuthMetadata
  | LinearOAuthMetadata
  | BrowserSessionMetadata
  | SalesforceOAuthMetadata
  | AsanaOAuthMetadata
  | DiscordOAuthMetadata
  | DocuSignOAuthMetadata
  | CredentialPreferences;
