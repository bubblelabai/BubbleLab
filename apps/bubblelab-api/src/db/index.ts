/**
 * Creates a Drizzle database connection that supports either
 * SQLite (libsql/turso) or PostgreSQL, exposing a single `db` instance
 * and re-exporting the unified schema symbols.
 */
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

import * as sqliteSchema from './schema-sqlite';
import * as postgresSchema from './schema-postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const isPostgres = databaseUrl.startsWith('postgres');

console.log('Database type:', isPostgres ? 'PostgreSQL' : 'SQLite');
console.log('Database URL:', databaseUrl);

type DB = LibSQLDatabase<typeof sqliteSchema>;

function createDatabaseConnection(): DB {
  if (isPostgres) {
    const pool = new Pool({ connectionString: databaseUrl });
    console.log('PostgreSQL pool created successfully');

    return drizzlePostgres(pool, { schema: postgresSchema }) as unknown as DB;
  }

  console.log('Creating SQLite client on ', databaseUrl);

  const client = createClient({ url: databaseUrl });
  return drizzleSqlite(client, { schema: sqliteSchema });
}

export const db = createDatabaseConnection();

// Re-export the unified schema so callers can `import { bubbleFlows } from '../db'`
export * from './schema';
