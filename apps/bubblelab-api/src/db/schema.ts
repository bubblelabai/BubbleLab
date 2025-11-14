/**
 * Unified Drizzle schema that works for both SQLite and PostgreSQL.
 * At runtime we pick the correct dialect-specific schema, while at
 * compile-time we convince TypeScript they share an identical shape.
 */
import * as sqliteSchema from './schema-sqlite';
import * as postgresSchema from './schema-postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const isPostgres = databaseUrl.startsWith('postgres');

// Both schema files export the same set of identifiers with compatible
// column JS types, so we can treat them as one common interface.
type CommonSchema = typeof sqliteSchema;

const schema: CommonSchema = isPostgres
  ? (postgresSchema as unknown as CommonSchema)
  : sqliteSchema;

// Re-export every table / relation so the rest of the codebase can stay
// database-agnostic.
export const {
  bubbleFlows,
  webhooks,
  bubbleFlowExecutions,
  userCredentials,
  userServiceUsage,
  waitlistedUsers,
  bubbleFlowsRelations,
  webhooksRelations,
  bubbleFlowExecutionsRelations,
  users,
} = schema;
