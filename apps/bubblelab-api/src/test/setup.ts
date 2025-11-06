process.env.CRON_SCHEDULER_ENABLED = 'false';

// @ts-expect-error bun:test is not in TypeScript definitions
import { beforeEach, beforeAll, afterAll } from 'bun:test';
import { migrate } from 'drizzle-orm/libsql/migrator';

// Import database and schema - DATABASE_URL should be set by package.json
import { db } from '../db/index.js';
import {
  bubbleFlows,
  bubbleFlowExecutions,
  webhooks,
  userCredentials,
  users,
} from '../db/schema.js';

export const TEST_USER_ID = '1';

beforeAll(async () => {
  // Run migrations for test database
  console.log('Setting up test database with BUBBLE_ENV=test...');

  try {
    await migrate(db, { migrationsFolder: './drizzle-sqlite' });
    console.log('✅ Test database migrations completed');
  } catch (error) {
    console.error('❌ Test database migration failed:', error);
  }
});

beforeEach(async () => {
  // Clear test data before each test
  await db.delete(webhooks);
  await db.delete(bubbleFlowExecutions);
  await db.delete(bubbleFlows);
  await db.delete(userCredentials);

  // Create test user for tests that need it
  await db
    .insert(users)
    .values({
      clerkId: TEST_USER_ID,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      appType: 'nodex',
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  // Clean up test database
  console.log('Cleaning up test database...');
});
