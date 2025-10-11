import { defineConfig } from 'drizzle-kit';
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres =
  process.env.BUBBLE_ENV === 'prod' || databaseUrl.startsWith('postgres');

export default defineConfig({
  dialect: isPostgres ? 'postgresql' : 'sqlite',
  schema: isPostgres
    ? './src/db/schema-postgres.ts'
    : './src/db/schema-sqlite.ts',
  out: isPostgres ? './drizzle-postgres' : './drizzle-sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
});
