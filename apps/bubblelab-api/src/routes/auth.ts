import { Hono } from 'hono';
import { getUserId, getAppType } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createClerkClient } from '@clerk/backend';
import { getClerkClient } from '../utils/clerk-client.js';
import { posthog } from '../services/posthog.js';

const authRoutes = new Hono();

// An authenticated ping endpoint that returns the Clerk user ID.
authRoutes.get('/ping', (c) => {
  const userId = getUserId(c);
  return c.json({ ok: true, userId });
});

// Submit onboarding questionnaire
authRoutes.post('/onboarding', async (c) => {
  const clerkUserId = getUserId(c);
  const appType = getAppType(c);

  try {
    const body = await c.req.json();
    const { persona, discoveryChannel, wantsInterview } = body as {
      persona: string;
      discoveryChannel: string;
      wantsInterview: boolean;
    };

    // Validate required fields
    if (!persona || !discoveryChannel || wantsInterview === undefined) {
      return c.json({ ok: false, error: 'Missing required fields' }, 400);
    }

    // Get user email from Clerk for the interview tracking
    const clerkClient = getClerkClient(appType);
    let userEmail: string | null = null;

    if (clerkClient) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;

        // Update Clerk user metadata to mark onboarding as complete
        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...clerkUser.publicMetadata,
            onboardingCompleted: true,
            onboardingCompletedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error('Failed to update Clerk metadata:', err);
        // Continue even if metadata update fails
      }
    }

    // Capture the event in PostHog
    posthog.captureEvent(
      {
        userId: clerkUserId,
        persona,
        discoveryChannel,
        wantsInterview,
        userEmail, // Always include email for analytics
        timestamp: new Date().toISOString(),
      },
      'onboarding_questionnaire_completed'
    );

    // If user wants interview, capture a separate event for easy tracking
    if (wantsInterview) {
      posthog.captureEvent(
        {
          userId: clerkUserId,
          userEmail,
          persona,
          discoveryChannel,
          timestamp: new Date().toISOString(),
        },
        'user_interview_interest'
      );
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('Failed to process onboarding:', err);
    return c.json({ ok: false, error: 'Failed to process onboarding' }, 500);
  }
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
