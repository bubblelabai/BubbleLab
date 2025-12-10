import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  unique,
  jsonb,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas';

export const users = pgTable('users', {
  clerkId: text('clerk_id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').notNull(),
  appType: text('app_type').notNull().default('nodex'), // Track which app the user belongs to
  monthlyUsageCount: integer('monthly_usage_count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bubbleFlows = pgTable('bubble_flows', {
  id: serial().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  prompt: text(), // Store the original prompt used to generate the flow (nullable)
  code: text(), // This will store the processed/transpiled code (nullable for empty flows during generation)
  originalCode: text('original_code'), // Store the original TypeScript code
  generationError: text('generation_error'), // Store any code generation errors
  bubbleParameters: jsonb('bubble_parameters'), // Store parsed bubble parameters as JSONB
  metadata: jsonb('metadata'), // Store workflow metadata (outputDescription, etc.) as JSONB
  workflow: jsonb('workflow'), // Store parsed workflow structure as JSONB
  eventType: text('event_type').notNull(),
  inputSchema: jsonb('input_schema'), // Store input schema
  webhookExecutionCount: integer('webhook_execution_count')
    .notNull()
    .default(0), // Track webhook executions
  webhookFailureCount: integer('webhook_failure_count').notNull().default(0), // Track webhook failures
  cron: text('cron'), // Cron expression extracted from code
  cronActive: boolean('cron_active').notNull().default(false), // Whether cron scheduling is active
  defaultInputs: jsonb('default_inputs'), // User-filled input values for cron execution
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhooks = pgTable(
  'webhooks',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    bubbleFlowId: integer('bubble_flow_id')
      .notNull()
      .references(() => bubbleFlows.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique combination of userId and path
    userPathUnique: unique().on(table.userId, table.path),
  })
);

export const bubbleFlowExecutions = pgTable('bubble_flow_executions', {
  id: serial().primaryKey(),
  bubbleFlowId: integer('bubble_flow_id')
    .notNull()
    .references(() => bubbleFlows.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(), // JSON stored as JSONB
  result: jsonb('result'), // JSON stored as JSONB
  status: text('status').notNull(),
  error: text('error'),
  code: text('code'), // Store the original code at execution time
  startedAt: timestamp('started_at', { mode: 'date' }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { mode: 'date' }),
});

export const userCredentials = pgTable('user_credentials', {
  id: serial().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId, { onDelete: 'cascade' }),
  credentialType: text('credential_type').notNull(), // e.g., 'OPENAI_CRED', 'SLACK_CRED'
  encryptedValue: text('encrypted_value'), // Encrypted credential value (nullable for OAuth)
  name: text('name'), // Optional user-friendly name for the credential
  metadata: jsonb('metadata').$type<DatabaseMetadata>(), // Typed JSONB field for database metadata

  // OAuth-specific fields
  oauthAccessToken: text('oauth_access_token'), // Encrypted OAuth access token
  oauthRefreshToken: text('oauth_refresh_token'), // Encrypted OAuth refresh token
  oauthExpiresAt: timestamp('oauth_expires_at', { mode: 'date' }), // Token expiration
  oauthScopes: jsonb('oauth_scopes').$type<string[]>(), // OAuth scopes granted
  oauthTokenType: text('oauth_token_type').default('Bearer'), // Token type (usually Bearer)
  oauthProvider: text('oauth_provider'), // Provider name (google, slack, github, etc.)
  isOauth: boolean('is_oauth').default(false), // Flag to identify OAuth vs API key credentials

  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userServiceUsage = pgTable(
  'user_service_usage',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    service: text('service').notNull(), // CredentialType enum value (e.g., 'OPENAI_CRED', 'FIRECRAWL_API_KEY')
    subService: text('sub_service'), // Optional: e.g., 'gpt-4', 'gemini-2.0-flash', 'apify/instagram-scraper'
    monthYear: text('month_year').notNull(), // e.g., '2025-01'
    unit: text('unit').notNull(), // e.g., 'per_1m_tokens', 'per_email', 'per_result'
    usage: doublePrecision('usage').notNull().default(0), // Usage count in the specified unit (high precision float)
    unitCost: doublePrecision('unit_cost').notNull(), // Cost per unit in dollars (high precision float)
    totalCost: doublePrecision('total_cost').notNull().default(0), // Calculated: usage * unitCost (high precision float)
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Unique constraint: one record per user, service, subService, and unit
    userServiceUnitUnique: unique().on(
      table.userId,
      table.service,
      table.subService,
      table.unit,
      table.unitCost,
      table.monthYear
    ),
  })
);

export const waitlistedUsers = pgTable('waitlisted_users', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  database: text('database').notNull(), // e.g., 'postgres', 'mysql', 'mongodb', etc.
  otherDatabase: text('other_database'), // For when database is 'other'
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'converted'
  notes: text('notes'), // Admin notes about the user
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bubbleFlowsRelations = relations(bubbleFlows, ({ many }) => ({
  executions: many(bubbleFlowExecutions),
  webhooks: many(webhooks),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  bubbleFlow: one(bubbleFlows, {
    fields: [webhooks.bubbleFlowId],
    references: [bubbleFlows.id],
  }),
}));

export const bubbleFlowExecutionsRelations = relations(
  bubbleFlowExecutions,
  ({ one }) => ({
    bubbleFlow: one(bubbleFlows, {
      fields: [bubbleFlowExecutions.bubbleFlowId],
      references: [bubbleFlows.id],
    }),
  })
);

// No relations needed for userCredentials as it's a standalone table
