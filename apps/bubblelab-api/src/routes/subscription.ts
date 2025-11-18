import { OpenAPIHono } from '@hono/zod-openapi';
import {
  authMiddleware,
  getUserId,
  getSubscriptionInfo,
} from '../middleware/auth.js';
import {
  PLAN_TYPE,
  APP_PLAN_TO_MONTHLY_LIMITS,
} from '../services/subscription-validation.js';
import { db } from '../db/index.js';
import { users, userServiceUsage } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { calculateNextResetDate } from '../utils/subscription.js';
import { getCurrentMonthYear } from '../utils/subscription.js';
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
  const nextResetDate = calculateNextResetDate(
    userResult[0]?.monthlyResetDate || null
  );

  const planDisplayNames: Record<PLAN_TYPE, string> = {
    free_user: 'Free',
    pro_plan: 'Pro',
    pro_plus: 'Pro Plus',
    unlimited: 'Unlimited',
  };

  // Fetch actual service usage data from database for current month
  const serviceUsageRecords = await db.query.userServiceUsage.findMany({
    where: and(
      eq(userServiceUsage.userId, userId),
      eq(userServiceUsage.monthYear, currentMonthYear)
    ),
  });

  // Convert to ServiceUsage format using current pricing table
  const actualServiceUsage: SubscriptionStatusResponse['usage']['serviceUsage'] =
    serviceUsageRecords.map((record) => {
      const service = record.service as CredentialType;
      const subService = record.subService || undefined;
      const unit = record.unit;
      const usage = record.usage;

      // Use current pricing if available, otherwise fallback to 0
      const unitCost = record.unitCost;
      const totalCost = usage * unitCost;

      return {
        service,
        subService,
        unit,
        usage,
        unitCost,
        totalCost,
      };
    });

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
      tokenUsage: [
        {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      ],
      executionCount: currentUsage,
      activeFlowLimit:
        APP_PLAN_TO_MONTHLY_LIMITS[subscriptionInfo.plan].webhookLimit,
      executionLimit:
        APP_PLAN_TO_MONTHLY_LIMITS[subscriptionInfo.plan].executionLimit,
      creditLimit:
        APP_PLAN_TO_MONTHLY_LIMITS[subscriptionInfo.plan].creditLimit,
      resetDate: nextResetDate,
      serviceUsage: actualServiceUsage,
      estimatedMonthlyCost,
    },
    isActive: true, // TODO: Check actual subscription status from Clerk
  });
});

export default app;
