import { sqliteTable, text, int, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas';

export const users = sqliteTable('users', {
  clerkId: text('clerk_id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').notNull(),
  appType: text('app_type').notNull().default('nodex'), // Track which app the user belongs to
  monthlyUsageCount: int('monthly_usage_count').notNull().default(0),
  createdAt: int('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bubbleFlows = sqliteTable('bubble_flows', {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  prompt: text(), // Store the original prompt used to generate the flow (nullable)
  code: text().notNull(), // This will store the processed/transpiled code
  originalCode: text('original_code'), // Store the original TypeScript code
  bubbleParameters: text('bubble_parameters', { mode: 'json' }), // Store parsed bubble parameters
  metadata: text('metadata', { mode: 'json' }), // Store workflow metadata (outputDescription, etc.)
  eventType: text('event_type').notNull(),
  inputSchema: text('input_schema', { mode: 'json' }), // Store input schema
  webhookExecutionCount: int('webhook_execution_count').notNull().default(0), // Track webhook executions
  webhookFailureCount: int('webhook_failure_count').notNull().default(0), // Track webhook failures
  cron: text('cron'), // Cron expression extracted from code
  cronActive: int('cron_active', { mode: 'boolean' }).notNull().default(false), // Whether cron scheduling is active
  defaultInputs: text('default_inputs', { mode: 'json' }), // User-filled input values for cron execution
  createdAt: int('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhooks = sqliteTable(
  'webhooks',
  {
    id: int().primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    bubbleFlowId: int('bubble_flow_id')
      .notNull()
      .references(() => bubbleFlows.id, { onDelete: 'cascade' }),
    isActive: int('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt: int('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: int('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Unique combination of userId and path
    userPathUnique: unique().on(table.userId, table.path),
  })
);

export const bubbleFlowExecutions = sqliteTable('bubble_flow_executions', {
  id: int().primaryKey({ autoIncrement: true }),
  bubbleFlowId: int('bubble_flow_id')
    .notNull()
    .references(() => bubbleFlows.id, { onDelete: 'cascade' }),
  payload: text('payload', { mode: 'json' }).notNull(),
  result: text('result', { mode: 'json' }),
  status: text('status').notNull(),
  error: text('error'),
  code: text('code'), // Store the original code at execution time
  startedAt: int('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: int('completed_at', { mode: 'timestamp' }),
});

export const userCredentials = sqliteTable('user_credentials', {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId, { onDelete: 'cascade' }),
  credentialType: text('credential_type').notNull(), // e.g., 'OPENAI_CRED', 'SLACK_CRED'
  encryptedValue: text('encrypted_value'), // Encrypted credential value (nullable for OAuth)
  name: text('name'), // Optional user-friendly name for the credential
  metadata: text('metadata', { mode: 'json' }).$type<DatabaseMetadata>(), // Typed JSON field for database metadata

  // OAuth-specific fields
  oauthAccessToken: text('oauth_access_token'), // Encrypted OAuth access token
  oauthRefreshToken: text('oauth_refresh_token'), // Encrypted OAuth refresh token
  oauthExpiresAt: int('oauth_expires_at', { mode: 'timestamp' }), // Token expiration
  oauthScopes: text('oauth_scopes', { mode: 'json' }).$type<string[]>(), // OAuth scopes granted
  oauthTokenType: text('oauth_token_type').default('Bearer'), // Token type (usually Bearer)
  oauthProvider: text('oauth_provider'), // Provider name (google, slack, github, etc.)
  isOauth: int('is_oauth', { mode: 'boolean' }).default(false), // Flag to identify OAuth vs API key credentials

  createdAt: int('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userModelUsage = sqliteTable(
  'user_model_usage',
  {
    id: int().primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    modelName: text('model_name').notNull(), // e.g., 'gpt-4', 'claude-3-opus', 'gemini-2.0-flash'
    monthYear: text('month_year').notNull(), // e.g., '2025-01'
    inputTokens: int('input_tokens').notNull().default(0),
    outputTokens: int('output_tokens').notNull().default(0),
    totalTokens: int('total_tokens').notNull().default(0),
    createdAt: int('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: int('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Unique constraint on userId, modelName, and monthYear
    userModelMonthUnique: unique().on(
      table.userId,
      table.modelName,
      table.monthYear
    ),
  })
);

export const waitlistedUsers = sqliteTable('waitlisted_users', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  database: text('database').notNull(), // e.g., 'postgres', 'mysql', 'mongodb', etc.
  otherDatabase: text('other_database'), // For when database is 'other'
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'converted'
  notes: text('notes'), // Admin notes about the user
  createdAt: int('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int('updated_at', { mode: 'timestamp' })
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
