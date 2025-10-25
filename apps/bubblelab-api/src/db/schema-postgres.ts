import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas/src/database-definition-schema';

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
  code: text().notNull(), // This will store the processed/transpiled code
  originalCode: text('original_code'), // Store the original TypeScript code
  bubbleParameters: jsonb('bubble_parameters'), // Store parsed bubble parameters as JSONB
  metadata: jsonb('metadata'), // Store workflow metadata (outputDescription, etc.) as JSONB
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

export const userModelUsage = pgTable(
  'user_model_usage',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    modelName: text('model_name').notNull(), // e.g., 'gpt-4', 'claude-3-opus', 'gemini-2.0-flash'
    monthYear: text('month_year').notNull(), // e.g., '2025-01'
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { mode: 'date' })
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
