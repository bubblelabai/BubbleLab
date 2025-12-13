import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getUserId } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { posthog } from '../services/posthog.js';

const onboardingRoutes = new Hono();

// Schema for onboarding questionnaire submission
const onboardingSchema = z.object({
  persona: z.enum([
    'founder',
    'automation_agency',
    'engineer',
    'product_manager',
    'marketer',
    'data_analyst',
    'operations',
    'student',
    'hobbyist',
    'other',
  ]),
  personaOther: z.string().optional(), // If persona is 'other'
  referralSource: z.enum([
    'twitter',
    'linkedin',
    'youtube',
    'tiktok',
    'reddit',
    'hacker_news',
    'product_hunt',
    'google_search',
    'friend_referral',
    'newsletter',
    'podcast',
    'other',
  ]),
  referralSourceOther: z.string().optional(), // If referralSource is 'other'
  interestedInInterview: z.boolean(),
});

// Get current user's onboarding status
onboardingRoutes.get('/status', async (c) => {
  const userId = getUserId(c);

  try {
    const user = await db
      .select({
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user.length) {
      // User doesn't exist yet - they need to complete onboarding
      return c.json({ onboardingCompleted: false });
    }

    return c.json({ onboardingCompleted: user[0].onboardingCompleted });
  } catch (error) {
    console.error('Failed to get onboarding status:', error);
    return c.json({ error: 'Failed to get onboarding status' }, 500);
  }
});

// Submit onboarding questionnaire
onboardingRoutes.post(
  '/complete',
  zValidator('json', onboardingSchema),
  async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid('json');

    try {
      // Get user email for PostHog
      const user = await db
        .select({
          email: users.email,
        })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);

      const email = user[0]?.email || '';

      // Determine the actual persona and referral source values
      const personaValue =
        data.persona === 'other' && data.personaOther
          ? data.personaOther
          : data.persona;
      const referralSourceValue =
        data.referralSource === 'other' && data.referralSourceOther
          ? data.referralSourceOther
          : data.referralSource;

      // Capture to PostHog
      posthog.captureOnboardingCompleted({
        userId,
        email,
        persona: personaValue,
        referralSource: referralSourceValue,
        interestedInInterview: data.interestedInInterview,
      });

      // Update user record to mark onboarding as completed
      await db
        .update(users)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, userId));

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      return c.json({ error: 'Failed to complete onboarding' }, 500);
    }
  }
);

export default onboardingRoutes;
