import { Hono } from 'hono';
import { getUserId } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createClerkClient } from '@clerk/backend';

const authRoutes = new Hono();

// An authenticated ping endpoint that returns the Clerk user ID.
authRoutes.get('/ping', (c) => {
  const userId = getUserId(c);
  return c.json({ ok: true, userId });
});

// Delete the authenticated user's account
authRoutes.delete('/delete', async (c) => {
  const clerkUserId = getUserId(c);

  // Delete from application DB
  try {
    await db.delete(users).where(eq(users.clerkId, clerkUserId));
  } catch (err) {
    console.error('Failed to delete user from DB', err);
    return c.json({ ok: false, error: 'Failed to delete user from DB' }, 500);
  }

  // Delete from Clerk (skip in dev if CLERK_SECRET_KEY missing)
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      await clerk.users.deleteUser(clerkUserId);
    } catch (err) {
      console.error('Failed to delete user from Clerk', err);
      // Even if Clerk deletion fails, we already removed from DB. Return error.
      return c.json(
        { ok: false, error: 'Failed to delete user from Clerk' },
        500
      );
    }
  }

  return c.json({ ok: true });
});

export default authRoutes;
