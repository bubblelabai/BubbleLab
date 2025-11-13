import { OpenAPIHono } from '@hono/zod-openapi';
import {
  authMiddleware,
  getUserId,
  getSubscriptionInfo,
  getAppType,
} from '../middleware/auth.js';
import { PLAN_TYPE } from '../services/subscription-validation.js';
import { db } from '../db/index.js';
import { users, userModelUsage } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { APP_FEATURES_TO_MONTHLY_LIMITS } from '../services/subscription-validation.js';
import { calculateNextResetDate } from '../utils/subscription.js';
import { getCurrentMonthYear } from '../services/token-tracking.js';
import { getSubscriptionStatusRoute } from '../schemas/subscription.js';

const app = new OpenAPIHono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /subscription/status - Get user's subscription status
app.openapi(getSubscriptionStatusRoute, async (c) => {
  const userId = getUserId(c);
  const subscriptionInfo = getSubscriptionInfo(c);
  const appType = getAppType(c);

  // Get user's current monthly usage
  const userResult = await db
    .select({
      monthlyUsageCount: users.monthlyUsageCount,
      monthlyResetDate: users.createdAt,
    })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  const currentUsage = userResult[0]?.monthlyUsageCount || 0;

  // Get current month-year for token usage query
  const currentMonthYear = getCurrentMonthYear();

  // Get token usage for current month
  const tokenUsageData = await db
    .select({
      modelName: userModelUsage.modelName,
      inputTokens: userModelUsage.inputTokens,
      outputTokens: userModelUsage.outputTokens,
      totalTokens: userModelUsage.totalTokens,
    })
    .from(userModelUsage)
    .where(
      and(
        eq(userModelUsage.userId, userId),
        eq(userModelUsage.monthYear, currentMonthYear)
      )
    );

  // Get the monthly limit based on features and app type
  const monthlyLimit = Math.max(
    ...subscriptionInfo.features.map(
      (feature) => APP_FEATURES_TO_MONTHLY_LIMITS[appType][feature] || 0
    ),
    APP_FEATURES_TO_MONTHLY_LIMITS[appType].base_usage // Fallback to base usage
  );

  // Calculate usage percentage
  const percentage =
    monthlyLimit === -1 || monthlyLimit === 100000
      ? 0
      : Math.min(Math.round((currentUsage / monthlyLimit) * 100), 100);

  const nextResetDate = calculateNextResetDate(
    userResult[0]?.monthlyResetDate || null
  );

  // Map plan names to display names
  console.log('🔍 plan', subscriptionInfo.plan, ' monthly limit', monthlyLimit);
  const planDisplayNames: Record<PLAN_TYPE, string> = {
    free_user: 'Free',
    pro_plan: 'Pro',
    pro_plus: 'Pro Plus',
  };

  // Mock service usage data - TODO: Replace with actual usage tracking
  const mockServiceUsage = [
    {
      service: 'FIRECRAWL_API_KEY',
      unit: 'per_token',
      usage: 1500,
      unitCost: 0.00087,
      totalCost: 1.305,
    },
    {
      service: 'RESEND_CRED',
      unit: 'per_email',
      usage: 25,
      unitCost: 0.00042,
      totalCost: 0,
    },
    {
      service: 'APIFY_CRED',
      subService: 'apimaestro/linkedin-profile-posts',
      unit: 'per_result',
      usage: 50,
      unitCost: 0.00525,
      totalCost: 0.2625,
    },
    {
      service: 'APIFY_CRED',
      subService: 'apimaestro/linkedin-posts-search-scraper-no-cookies',
      unit: 'per_result',
      usage: 30,
      unitCost: 0.00525,
      totalCost: 0.1575,
    },
    {
      service: 'APIFY_CRED',
      subService: 'apify/instagram-scraper',
      unit: 'per_result',
      usage: 75,
      unitCost: 0.00284,
      totalCost: 0.213,
    },
    {
      service: 'APIFY_CRED',
      subService: 'apify/instagram-hashtag-scraper',
      unit: 'per_result',
      usage: 100,
      unitCost: 0.00242,
      totalCost: 0.242,
    },
    {
      service: 'APIFY_CRED',
      subService: 'streamers/youtube-scraper',
      unit: 'per_result',
      usage: 40,
      unitCost: 0.00525,
      totalCost: 0.21,
    },
    {
      service: 'APIFY_CRED',
      subService: 'pintostudio/youtube-transcript-scraper',
      unit: 'per_result',
      usage: 20,
      unitCost: 0.00525,
      totalCost: 0.105,
    },
    {
      service: 'GOOGLE_GEMINI_CRED',
      subService: 'google/gemini-2.5-pro',
      unit: 'per_1m_token_input',
      usage: 0.5,
      unitCost: 1.969,
      totalCost: 0.9845,
    },
    {
      service: 'GOOGLE_GEMINI_CRED',
      subService: 'google/gemini-2.5-flash',
      unit: 'per_1m_token_output',
      usage: 0.3,
      unitCost: 1.969,
      totalCost: 0.5907,
    },
    {
      service: 'OPENAI_CRED',
      subService: 'gpt-4',
      unit: 'per_1m_tokens',
      usage: 0.4,
      unitCost: 2.1,
      totalCost: 0.84,
    },
  ];

  return c.json({
    userId,
    plan: subscriptionInfo.plan,
    planDisplayName:
      planDisplayNames[subscriptionInfo.plan] || subscriptionInfo.plan,
    features: subscriptionInfo.features,
    usage: {
      current: currentUsage,
      limit: monthlyLimit >= 100000 ? -1 : monthlyLimit, // Convert very high limit to -1 (unlimited)
      percentage,
      resetDate: nextResetDate,
      tokenUsage: tokenUsageData,
      serviceUsage: mockServiceUsage,
      estimatedMonthlyCost: 0,
    },
    isActive: true, // TODO: Check actual subscription status from Clerk
  });
});

export default app;
