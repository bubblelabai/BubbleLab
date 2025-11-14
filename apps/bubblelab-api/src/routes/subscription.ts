import { OpenAPIHono } from '@hono/zod-openapi';
import {
  authMiddleware,
  getUserId,
  getSubscriptionInfo,
  getAppType,
} from '../middleware/auth.js';
import { PLAN_TYPE } from '../services/subscription-validation.js';
import { db } from '../db/index.js';
import { users, userServiceUsage } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { APP_FEATURES_TO_MONTHLY_LIMITS } from '../services/subscription-validation.js';
import { calculateNextResetDate } from '../utils/subscription.js';
import { getCurrentMonthYear } from '../services/service-usage-tracking.js';
import { getSubscriptionStatusRoute } from '../schemas/subscription.js';
import {
  CredentialType,
  SubscriptionStatusResponse,
} from '@bubblelab/shared-schemas';

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

  // Fetch actual service usage data from database for current month
  const serviceUsageRecords = await db.query.userServiceUsage.findMany({
    where: and(
      eq(userServiceUsage.userId, userId),
      eq(userServiceUsage.monthYear, currentMonthYear)
    ),
  });

  // Convert to ServiceUsage format
  // Convert microdollars back to dollars (divide by 1,000,000)
  const actualServiceUsage: SubscriptionStatusResponse['usage']['serviceUsage'] =
    serviceUsageRecords.map((record) => ({
      service: record.service as CredentialType,
      subService: record.subService || undefined,
      unit: record.unit,
      usage: record.usage,
      unitCost: record.unitCost / 1000000, // Convert microdollars to dollars
      totalCost: record.totalCost / 1000000, // Convert microdollars to dollars
    }));

  // Calculate total estimated monthly cost
  const estimatedMonthlyCost = actualServiceUsage.reduce(
    (sum, usage) => sum + usage.totalCost,
    0
  );

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
      serviceUsage: actualServiceUsage,
      estimatedMonthlyCost,
    },
    isActive: true, // TODO: Check actual subscription status from Clerk
  });
});

export default app;
