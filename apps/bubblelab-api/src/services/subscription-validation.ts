import { ClerkJWTPayload } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { clerk, getClerkClient } from '../utils/clerk-client.js';
import { AppType } from '../config/clerk-apps.js';
import { env } from '../config/env.js';
import { getTotalServiceCostForUser } from './service-usage-tracking.js';

// Maps subscription plan id to monthly API limit
export type PLAN_TYPE = 'free_user' | 'pro_plan' | 'pro_plus';
export type FEATURE_TYPE = 'base_usage' | 'pro_usage' | 'unlimited_usage';

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
    plan,
    features,
  };
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
    console.debug(
      '[subscription-validation] getMonthlyLimitForFeatures: monthlyLimit',
      monthlyLimit
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

export async function verifyMonthlyCreditsExceeded(
  userId: string,
  appType: AppType
): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
  const startTime = performance.now();
  try {
    // Skip API limit checks in test environment to avoid Clerk API calls
    if (env.BUBBLE_ENV?.toLowerCase() === 'test') {
      console.debug(
        '[subscription-validation] Test mode: skipping credits check'
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
      '[subscription-validation] verifyMonthlyCreditsExceeded: features',
      features
    );

    // Get user's created date for billing period calculation
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { createdAt: true },
    });

    // Get the plan limit
    const currentUsage = await getTotalServiceCostForUser(
      userId,
      undefined,
      undefined,
      dbUser?.createdAt
    );
    const limit = getMonthlyLimitForFeaturesInternal(features, appType);
    return {
      allowed: currentUsage < limit,
      currentUsage,
      limit,
    };
  } catch (err) {
    console.error('Failed to verify monthly credits exceeded', err);
    throw err;
  } finally {
    const endTime = performance.now();
    console.log(
      `[subscription-validation] verifyMonthlyCreditsExceeded took ${endTime - startTime}ms`
    );
  }
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
