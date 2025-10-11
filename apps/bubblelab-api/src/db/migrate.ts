/**
 * Database migration utility that handles both SQLite and PostgreSQL
 */
import { migrate as migrateSqlite } from 'drizzle-orm/libsql/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const isPostgres = databaseUrl.startsWith('postgres');

export async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations...');
  console.log('Database type:', isPostgres ? 'PostgreSQL' : 'SQLite');

  try {
    if (isPostgres) {
      // For PostgreSQL, use the postgres migrator
      await migratePostgres(db as any, {
        migrationsFolder: './drizzle-postgres',
      });
    } else {
      // For SQLite, use the libsql migrator
      await migrateSqlite(db as any, {
        migrationsFolder: './drizzle-sqlite',
      });
    }

    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
  }
}
