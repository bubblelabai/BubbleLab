import { db, users } from './index.js';
import { env } from '../config/env.js';
import { eq } from 'drizzle-orm';

export const DEV_USER_ID = 'mock-user-id';
export const DEV_USER_EMAIL = 'dev@localhost.com';
/**
 * Seeds a development user in the database when running in dev mode.
 * This user matches the mock user data used in the frontend when DISABLE_AUTH=true
 */
export async function seedDevUser() {
  // Only seed in dev mode
  if (!env.isDev) {
    console.log('ℹ️  Skipping dev user seed (not in dev mode)');
    return;
  }

  try {
    // Check if dev user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, DEV_USER_ID))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✅ Dev user already exists');
      return;
    }

    // Insert dev user
    await db.insert(users).values({
      clerkId: DEV_USER_ID,
      firstName: 'Dev',
      lastName: 'User',
      email: DEV_USER_EMAIL,
      appType: 'nodex',
      monthlyUsageCount: 0,
    });

    console.log('✅ Dev user created successfully:', DEV_USER_EMAIL);
  } catch (error) {
    console.error('❌ Failed to seed dev user:', error);
    throw error;
  }
}
