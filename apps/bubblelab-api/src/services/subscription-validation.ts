import { ClerkJWTPayload } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, bubbleFlows, webhooks } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { clerk, getClerkClient } from '../utils/clerk-client.js';
import { AppType } from '../config/clerk-apps.js';
import { env } from '../config/env.js';
import { getTotalServiceCostForUser } from './service-usage-tracking.js';
import { getCurrentUserInfo } from '../utils/request-context.js';

// Maps subscription plan id to monthly API limit
export type PLAN_TYPE = 'free_user' | 'pro_plan' | 'pro_plus';
export type FEATURE_TYPE = 'base_usage' | 'pro_usage' | 'unlimited_usage';

export const APP_PLAN_TO_MONTHLY_LIMITS: Record<
  PLAN_TYPE,
  {
    executionLimit: number;
    creditLimit: number;
    webhookLimit: number;
  }
> = {
  free_user: {
    executionLimit: 100,
    creditLimit: 5,
    webhookLimit: 1,
  },
  pro_plan: {
    executionLimit: 3000,
    creditLimit: 20,
    webhookLimit: 10,
  },
  pro_plus: {
    executionLimit: 99999999,
    creditLimit: 100,
    webhookLimit: 99999999,
  },
};

// App-specific limits (currently identical; structured to allow divergence by app)
export const APP_FEATURES_TO_MONTHLY_LIMITS: Record<
  AppType,
  Record<FEATURE_TYPE, number>
> = {
  [AppType.NODEX]: {
    base_usage: 40,
    pro_usage: 400,
    unlimited_usage: 100000,
  },
  [AppType.BUBBLEPARSE]: {
    base_usage: 40,
    pro_usage: 400,
    unlimited_usage: 100000,
  },
  [AppType.BUBBLE_LAB]: {
    base_usage: 1,
    pro_usage: 20,
    unlimited_usage: 10000,
  },
};

export interface UserSubscriptionInfo {
  appType: AppType;
  plan: PLAN_TYPE;
  features: FEATURE_TYPE[];
}

export function parseClerkPlan(planString: string | undefined): PLAN_TYPE {
  if (!planString) {
    return 'pro_plus'; // Default to unlimited for apps without subscription
  }
  // Remove the "u:" prefix if present
  return planString.replace(/^u:/, '') as PLAN_TYPE;
}

export function parseClerkFeatures(
  featureString: string | undefined
): FEATURE_TYPE[] {
  if (!featureString) {
    return ['unlimited_usage']; // Default to unlimited for apps without subscription
  }
  // Split features by comma and remove "u:" prefix
  return featureString
    .split(',')
    .map((f) => f.trim().replace(/^u:/, '')) as FEATURE_TYPE[];
}

export function extractSubscriptionInfoFromPayload(
  payload: ClerkJWTPayload
): UserSubscriptionInfo {
  const plan = parseClerkPlan(payload.pla);
  const features = parseClerkFeatures(payload.fea);

  console.debug(
    `[subscription-validation] Extracted plan: ${plan}, features: ${features.join(', ')}`
  );

  return {
    appType: AppType.BUBBLE_LAB,
    plan,
    features,
  };
}

/**
 * Get monthly limits and current usage for a user's plan
 * Returns limits and usage for webhooks, executions, and credits
 *
 * Uses subscription info from AsyncLocalStorage context if available (from auth middleware),
 * otherwise falls back to fetching from Clerk
 */
export async function getMonthlyLimitForPlan(userId: string): Promise<{
  webhooks: { limit: number; currentUsage: number };
  executions: { limit: number; currentUsage: number };
  credits: { limit: number; currentUsage: number };
}> {
  try {
    // Try to get subscription info from AsyncLocalStorage context first (set by auth middleware)
    let userSubscriptionInfo: UserSubscriptionInfo;
    const contextSubscriptionInfo = getCurrentUserInfo();

    if (contextSubscriptionInfo && contextSubscriptionInfo.appType) {
      // Use subscription info from context (no need to fetch from Clerk)
      userSubscriptionInfo = {
        appType: contextSubscriptionInfo.appType,
        plan: contextSubscriptionInfo.plan,
        features: contextSubscriptionInfo.features,
      };
      console.log(
        '[getMonthlyLimitForPlan] Using subscription info from context:',
        userSubscriptionInfo
      );
    } else {
      // Fallback to fetching from Clerk if context not available
      console.log(
        '[getMonthlyLimitForPlan] Context not available, fetching from Clerk'
      );
      userSubscriptionInfo = await getUserSubscriptionInfo(userId);
    }

    // Get current usage and limit for webhooks (active webhooks + active crons)
    const webhookUsage = await getCurrentWebhookUsage(userId);

    // Get current usage and limit for executions (monthlyUsageCount)
    const executionUsage = await getCurrentExecutionUsage(userId);

    // Get current usage for credits (reuse existing logic)
    const currentCreditUsage = await getTotalServiceCostForUser(userId);

    return {
      webhooks: {
        limit: webhookUsage.limit,
        currentUsage: webhookUsage.currentUsage,
      },
      executions: {
        limit: executionUsage.limit,
        currentUsage: executionUsage.currentUsage,
      },
      credits: {
        limit:
          APP_PLAN_TO_MONTHLY_LIMITS[userSubscriptionInfo.plan].creditLimit,
        currentUsage: currentCreditUsage,
      },
    };
  } catch (err) {
    console.error(
      '[subscription-validation] Error getting monthly limits for user:',
      err
    );
    // Return unlimited access as fallback
    const unlimitedLimit =
      APP_FEATURES_TO_MONTHLY_LIMITS[AppType.NODEX].unlimited_usage;
    return {
      webhooks: { limit: unlimitedLimit, currentUsage: 0 },
      executions: { limit: unlimitedLimit, currentUsage: 0 },
      credits: { limit: unlimitedLimit, currentUsage: 0 },
    };
  }
}

/**
 * Helper function to get user subscription info from Clerk
 */
async function getUserSubscriptionInfo(
  userId: string
): Promise<UserSubscriptionInfo> {
  try {
    // Get user from Clerk to extract subscription info
    // Try to determine appType from user's database record first
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { appType: true },
    });
    const appType = (dbUser?.appType as AppType) || AppType.BUBBLE_LAB;

    // Get the appropriate Clerk client for this app
    const appClerk = getClerkClient(appType) || clerk;
    const clerkUser = await appClerk?.users.getUser(userId);

    if (!clerkUser) {
      throw new Error('User not found in Clerk');
    }

    // Extract subscription info from Clerk metadata
    const plan = parseClerkPlan(clerkUser.publicMetadata?.plan as string);
    const features = (clerkUser.publicMetadata?.features as FEATURE_TYPE[]) || [
      'base_usage',
    ];

    return {
      appType: appType,
      plan,
      features,
    };
  } catch (err) {
    console.error(
      '[subscription-validation] Error getting user subscription info:',
      err
    );
    // Return default subscription info as fallback
    return {
      appType: AppType.BUBBLE_LAB,
      plan: 'pro_plus',
      features: ['unlimited_usage'],
    };
  }
}

/**
 * Helper function to get current webhook usage and limit for a user
 * Counts active webhooks and active crons
 * Returns both limit and current usage
 */
export async function getCurrentWebhookUsage(
  userId: string
): Promise<{ limit: number; currentUsage: number }> {
  try {
    // Get subscription info (from context or Clerk)
    let userSubscriptionInfo: UserSubscriptionInfo;
    const contextSubscriptionInfo = getCurrentUserInfo();

    if (contextSubscriptionInfo && contextSubscriptionInfo.appType) {
      // Use subscription info from context (no need to fetch from Clerk)
      userSubscriptionInfo = {
        appType: contextSubscriptionInfo.appType,
        plan: contextSubscriptionInfo.plan,
        features: contextSubscriptionInfo.features,
      };
    } else {
      // Fallback to fetching from Clerk if context not available
      userSubscriptionInfo = await getUserSubscriptionInfo(userId);
    }

    // Count active webhooks
    const activeWebhooksResult = await db
      .select({ count: count() })
      .from(webhooks)
      .where(and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)));

    const activeWebhooksCount = activeWebhooksResult[0]?.count || 0;

    // Count active crons
    const activeCronsResult = await db
      .select({ count: count() })
      .from(bubbleFlows)
      .where(
        and(eq(bubbleFlows.userId, userId), eq(bubbleFlows.cronActive, true))
      );

    const activeCronsCount = activeCronsResult[0]?.count || 0;

    // Total active webhooks/crons
    const currentUsage = activeWebhooksCount + activeCronsCount;

    // Get limit from plan
    const limit =
      APP_PLAN_TO_MONTHLY_LIMITS[userSubscriptionInfo.plan].webhookLimit;

    return { limit, currentUsage };
  } catch (err) {
    console.error(
      '[subscription-validation] Error getting current webhook usage:',
      err
    );
    // Return unlimited access as fallback
    const unlimitedLimit =
      APP_FEATURES_TO_MONTHLY_LIMITS[AppType.NODEX].unlimited_usage;
    return { limit: unlimitedLimit, currentUsage: 0 };
  }
}

/**
 * Helper function to get current execution usage and limit for a user
 * Uses monthlyUsageCount from users table
 * Returns both limit and current usage
 */
async function getCurrentExecutionUsage(
  userId: string
): Promise<{ limit: number; currentUsage: number }> {
  try {
    // Get subscription info (from context or Clerk)
    let userSubscriptionInfo: UserSubscriptionInfo;
    const contextSubscriptionInfo = getCurrentUserInfo();

    if (contextSubscriptionInfo && contextSubscriptionInfo.appType) {
      // Use subscription info from context (no need to fetch from Clerk)
      userSubscriptionInfo = {
        appType: contextSubscriptionInfo.appType,
        plan: contextSubscriptionInfo.plan,
        features: contextSubscriptionInfo.features,
      };
    } else {
      // Fallback to fetching from Clerk if context not available
      userSubscriptionInfo = await getUserSubscriptionInfo(userId);
    }

    const userResult = await db
      .select({ monthlyUsageCount: users.monthlyUsageCount })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    const currentUsage = userResult[0]?.monthlyUsageCount || 0;

    // Get limit from plan
    const limit =
      APP_PLAN_TO_MONTHLY_LIMITS[userSubscriptionInfo.plan].executionLimit;

    return { limit, currentUsage };
  } catch (err) {
    console.error(
      '[subscription-validation] Error getting current execution usage:',
      err
    );
    // Return unlimited access as fallback
    const unlimitedLimit =
      APP_FEATURES_TO_MONTHLY_LIMITS[AppType.BUBBLE_LAB].unlimited_usage;
    return { limit: unlimitedLimit, currentUsage: 0 };
  }
}

/**
 * Helper function to get plan limits
 */
function getMonthlyLimitForFeaturesInternal(
  features: FEATURE_TYPE[],
  appType: AppType
) {
  // If the features aren't in the map print a warning
  try {
    features.forEach((feature: FEATURE_TYPE) => {
      if (!APP_FEATURES_TO_MONTHLY_LIMITS[appType][feature]) {
        console.warn(
          `[subscription-validation] getPlanLimit: feature ${feature} not found in APP_FEATURES_TO_MONTHLY_LIMITS for app ${appType}`
        );
      }
    });

    // Find feature with the highest limit
    // This shouldn't be needed since we only have one feature per plan, but just in case
    const monthlyLimit = Math.max(
      ...features.map(
        (feature) => APP_FEATURES_TO_MONTHLY_LIMITS[appType][feature] || 0
      )
    );
    return monthlyLimit;
  } catch (err) {
    console.error(
      '[subscription-validation] Error getting monthly limit for user, giving user unlimited access!! This should not be happening.',
      err
    );
    return APP_FEATURES_TO_MONTHLY_LIMITS[AppType.NODEX].unlimited_usage;
  }
}

export function getMonthlyLimitForFeatures(
  features: FEATURE_TYPE[],
  appType: AppType
): number {
  return getMonthlyLimitForFeaturesInternal(features, appType);
}

export async function verifyMonthlyLimit(
  userId: string,
  appType: AppType
): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
  try {
    // Skip API limit checks in test environment to avoid Clerk API calls
    if (
      env.BUBBLE_ENV?.toLowerCase() === 'test' ||
      env.BUBBLE_ENV?.toLowerCase() === 'dev'
    ) {
      console.debug(
        '[subscription-validation] Test mode: skipping API limit check'
      );
      return {
        allowed: true,
        currentUsage: 0,
        limit: APP_FEATURES_TO_MONTHLY_LIMITS[AppType.NODEX].unlimited_usage,
      };
    }

    // Get user from Clerk to extract subscription info using the app-specific client
    const appClerk = getClerkClient(appType) || clerk;
    const clerkUser = await appClerk?.users.getUser(userId);
    if (!clerkUser) {
      throw new Error('User not found');
    }

    // Get user's subscription features from Clerk metadata (now populated by middleware)
    const features = (clerkUser.publicMetadata?.features as FEATURE_TYPE[]) || [
      'base_usage',
    ];

    console.info(
      '[subscription-validation] verifyMonthlyLimit: features',
      features
    );

    // Get the plan limit
    const apiLimit = getMonthlyLimitForFeaturesInternal(features, appType);

    // Query the user's current monthly usage by clerk_id
    const userResult = await db
      .select({ monthlyUsageCount: users.monthlyUsageCount })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    const currentUsage = userResult[0]?.monthlyUsageCount || 0;

    return {
      allowed: currentUsage < apiLimit,
      currentUsage,
      limit: apiLimit,
    };
  } catch (err) {
    console.error('Failed to verify API limit', err);
    throw err;
  }
}
