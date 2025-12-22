import { OpenAPIHono } from '@hono/zod-openapi';
import {
  authMiddleware,
  getUserId,
  getSubscriptionInfo,
  getAppType,
} from '../middleware/auth.js';
import { couponRedemptionRateLimit } from '../middleware/rate-limit.js';
import {
  PLAN_TYPE,
  APP_PLAN_TO_MONTHLY_LIMITS,
} from '../services/subscription-validation.js';
import { db } from '../db/index.js';
import { users, userServiceUsage } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  calculateNextResetDate,
  getCurrentMonthYearBillingCycle,
} from '../utils/subscription.js';
import {
  getSubscriptionStatusRoute,
  redeemCouponRoute,
} from '../schemas/subscription.js';
import {
  CredentialType,
  SubscriptionStatusResponse,
  HackathonOffer,
} from '@bubblelab/shared-schemas';
import { getClerkClient } from '../utils/clerk-client.js';
import { env } from '../config/env.js';

const app = new OpenAPIHono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// Helper: Format date for user-friendly display
function formatExpirationDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Helper: Parse valid coupon codes from env
function getValidCouponCodes(): string[] {
  if (!env.HACKATHON_COUPON_CODES) return [];
  return env.HACKATHON_COUPON_CODES.split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
}

// Helper: Calculate expiration (1 day from now)
function calculateOfferExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 1 day from now
  return expiresAt;
}

// Helper: Hackathon offer metadata structure
interface HackathonOfferMetadata {
  expiresAt?: string;
  redeemedAt?: string;
  code?: string;
}

// Helper: Check if hackathon offer is active
function getActiveHackathonOffer(
  privateMetadata: Record<string, unknown>
): HackathonOffer | null {
  const hackathonOffer = privateMetadata?.hackathonOffer as
    | HackathonOfferMetadata
    | undefined;

  if (!hackathonOffer?.expiresAt) {
    return null;
  }

  const expiresAt = new Date(hackathonOffer.expiresAt);
  const isActive = expiresAt > new Date();

  return {
    isActive,
    expiresAt: hackathonOffer.expiresAt,
    redeemedAt: hackathonOffer.redeemedAt || null,
  };
}

// Apply rate limiting to redeem endpoint (5 attempts per hour per user)
app.use('/redeem', couponRedemptionRateLimit);

// POST /subscription/redeem - Redeem a hackathon coupon code
app.openapi(redeemCouponRoute, async (c) => {
  const userId = getUserId(c);
  const appType = getAppType(c);
  const { code } = c.req.valid('json');

  // Normalize the code
  const normalizedCode = code.trim().toUpperCase();

  // Validate the coupon code
  const validCodes = getValidCouponCodes();
  if (validCodes.length === 0) {
    return c.json(
      {
        success: false,
        message: 'Coupon redemption is not available at this time.',
      },
      503
    );
  }

  if (!validCodes.includes(normalizedCode)) {
    return c.json(
      {
        success: false,
        message: 'Invalid coupon code. Please check the code and try again.',
      },
      400
    );
  }

  // Calculate expiration
  const expiresAt = calculateOfferExpiration();
  const redeemedAt = new Date();

  // Update Clerk private metadata
  const clerkClient = getClerkClient(appType);
  if (!clerkClient) {
    return c.json(
      {
        success: false,
        message: 'Unable to process redemption. Please try again later.',
      },
      500
    );
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId);

    // Check if user already has an active hackathon offer
    const existingOffer = getActiveHackathonOffer(
      clerkUser.privateMetadata as Record<string, unknown>
    );
    if (existingOffer?.isActive) {
      const expirationDate = new Date(existingOffer.expiresAt!);
      return c.json(
        {
          success: false,
          message: `You already have an active promotional offer until ${expirationDate.toLocaleString()}.`,
        },
        409
      );
    }

    // Set the hackathon offer in private metadata
    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...clerkUser.privateMetadata,
        hackathonOffer: {
          expiresAt: expiresAt.toISOString(),
          redeemedAt: redeemedAt.toISOString(),
          code: normalizedCode,
        },
      },
    });

    console.log(
      `[subscription/redeem] User ${userId} redeemed coupon ${normalizedCode}, expires at ${expiresAt.toISOString()}`
    );

    return c.json({
      success: true,
      message: `Coupon redeemed successfully! You now have Pro Plus access until ${formatExpirationDate(expiresAt)}.`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('[subscription/redeem] Error redeeming coupon:', err);
    return c.json(
      {
        success: false,
        message: 'Failed to redeem coupon. Please try again later.',
      },
      500
    );
  }
});

// GET /subscription/status - Get user's subscription status
app.openapi(getSubscriptionStatusRoute, async (c) => {
  const userId = getUserId(c);
  const appType = getAppType(c);
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
  const currentBillingCycleMonthYear = getCurrentMonthYearBillingCycle(
    userResult[0]?.monthlyResetDate || null
  );
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
      eq(userServiceUsage.monthYear, currentBillingCycleMonthYear)
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

  // Fetch hackathon offer status from Clerk
  let hackathonOffer: HackathonOffer | undefined;
  const clerkClient = getClerkClient(appType);
  if (clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const offer = getActiveHackathonOffer(
        clerkUser.privateMetadata as Record<string, unknown>
      );
      if (offer) {
        hackathonOffer = offer;
      }
    } catch (err) {
      console.error(
        '[subscription/status] Error fetching hackathon offer:',
        err
      );
    }
  }

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
    hackathonOffer,
  });
});

export default app;
