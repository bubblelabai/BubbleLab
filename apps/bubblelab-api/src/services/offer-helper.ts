import {
  PLAN_TYPE,
  FEATURE_TYPE,
  parseClerkPlan,
} from './subscription-validation.js';
import { AppType } from '../config/clerk-apps.js';
import { getCurrentUserInfo } from '../utils/request-context.js';
import { getClerkClient } from '../utils/clerk-client.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { HackathonOffer } from '@bubblelab/shared-schemas';

/**
 * Raw hackathon offer structure from Clerk privateMetadata
 */
export interface HackathonOfferMetadata {
  expiresAt?: string;
  redeemedAt?: string;
  code?: string;
}

/**
 * Result of checking hackathon offer status
 */
export interface HackathonOfferResult {
  isActive: boolean;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  code: string | null;
  /** If active, this is the plan it grants */
  grantedPlan: PLAN_TYPE | null;
  /** If active, these are the features it grants */
  grantedFeatures: FEATURE_TYPE[] | null;
}

/**
 * Private metadata overrides (for exclusive members)
 */
export interface PrivateMetadataOverrides {
  plan: PLAN_TYPE | null;
  features: FEATURE_TYPE[] | null;
}

/**
 * Type-safe wrapper for Clerk private metadata
 */
export interface ClerkPrivateMetadata {
  hackathonOffer?: HackathonOfferMetadata;
  plan?: string;
  features?: FEATURE_TYPE[];
  [key: string]: unknown;
}

/**
 * Parameters for resolving effective subscription
 */
export interface ResolveSubscriptionParams {
  /** Base subscription from JWT payload or public metadata */
  basePlan: PLAN_TYPE;
  baseFeatures: FEATURE_TYPE[];
  /** Private metadata to check for offers/overrides */
  privateMetadata: ClerkPrivateMetadata;
  /** App context */
  appType: AppType;
}

/**
 * Final resolved subscription after applying all offers/overrides
 */
export interface EffectiveSubscription {
  plan: PLAN_TYPE;
  features: FEATURE_TYPE[];
  appType: AppType;
  /** Source of the plan (useful for debugging/logging) */
  source: 'jwt' | 'hackathon_offer' | 'private_metadata_override';
  /** Active hackathon offer details if applicable */
  hackathonOffer: HackathonOfferResult | null;
}

/**
 * Check if user has an active hackathon offer
 * Single source of truth for hackathon offer logic
 */
export function checkHackathonOffer(
  privateMetadata: ClerkPrivateMetadata
): HackathonOfferResult {
  const hackathonOffer = privateMetadata?.hackathonOffer;

  const result: HackathonOfferResult = {
    isActive: false,
    expiresAt: null,
    redeemedAt: null,
    code: null,
    grantedPlan: null,
    grantedFeatures: null,
  };

  if (!hackathonOffer?.expiresAt) {
    return result;
  }

  const expiresAt = new Date(hackathonOffer.expiresAt);
  const isActive = expiresAt > new Date();

  result.expiresAt = expiresAt;
  result.redeemedAt = hackathonOffer.redeemedAt
    ? new Date(hackathonOffer.redeemedAt)
    : null;
  result.code = hackathonOffer.code ?? null;
  result.isActive = isActive;

  if (isActive) {
    // Hackathon offers grant pro_plus plan with pro features
    result.grantedPlan = 'pro_plus';
    result.grantedFeatures = ['base_usage', 'pro_usage'];
  }

  return result;
}

/**
 * Check for explicit plan/feature overrides in private metadata
 * Used for exclusive members with manual plan assignments
 */
export function checkPrivateMetadataOverrides(
  privateMetadata: ClerkPrivateMetadata
): PrivateMetadataOverrides | null {
  const privatePlanValue = privateMetadata?.plan;

  if (!privatePlanValue) {
    return null;
  }

  const validPlans: PLAN_TYPE[] = [
    'free_user',
    'pro_plan',
    'pro_plus',
    'unlimited',
  ];
  const plan: PLAN_TYPE =
    typeof privatePlanValue === 'string' &&
    validPlans.includes(privatePlanValue as PLAN_TYPE)
      ? (privatePlanValue as PLAN_TYPE)
      : 'unlimited'; // Default to unlimited if invalid plan string provided

  const features = privateMetadata?.features ?? null;

  return { plan, features };
}

/**
 * Resolve the effective subscription by applying offers and overrides
 * Priority order:
 * 1. Private metadata override (highest - admin-set)
 * 2. Active hackathon offer
 * 3. Base subscription from JWT/public metadata (lowest)
 */
export function resolveEffectiveSubscription(
  params: ResolveSubscriptionParams
): EffectiveSubscription {
  const { basePlan, baseFeatures, privateMetadata, appType } = params;

  let finalPlan: PLAN_TYPE = basePlan;
  let finalFeatures: FEATURE_TYPE[] = baseFeatures;
  let source: EffectiveSubscription['source'] = 'jwt';

  // Check hackathon offer (applied first, can be overridden)
  const hackathonResult = checkHackathonOffer(privateMetadata);
  if (hackathonResult.isActive && hackathonResult.grantedPlan) {
    finalPlan = hackathonResult.grantedPlan;
    finalFeatures = hackathonResult.grantedFeatures ?? baseFeatures;
    source = 'hackathon_offer';
    console.debug(
      `[OfferHelper] Applied hackathon offer: plan=${finalPlan}, expires=${hackathonResult.expiresAt?.toISOString()}`
    );
  }

  // Check private metadata override (takes precedence over hackathon)
  const overrides = checkPrivateMetadataOverrides(privateMetadata);
  if (overrides?.plan) {
    finalPlan = overrides.plan;
    source = 'private_metadata_override';
    console.debug(
      `[OfferHelper] Applied private metadata override: plan=${finalPlan}`
    );
  }
  if (overrides?.features && overrides.features.length > 0) {
    finalFeatures = overrides.features;
    console.debug(
      `[OfferHelper] Applied private metadata features: ${finalFeatures.join(', ')}`
    );
  }

  return {
    plan: finalPlan,
    features: finalFeatures,
    appType,
    source,
    hackathonOffer: hackathonResult,
  };
}

/**
 * Fetch user from Clerk and resolve effective subscription
 * Used when context is not available (fallback scenario)
 */
async function fetchAndResolveSubscription(
  userId: string,
  appTypeHint?: AppType
): Promise<EffectiveSubscription> {
  // Determine app type from DB if not provided
  let appType = appTypeHint;
  if (!appType) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { appType: true },
    });
    appType = (dbUser?.appType as AppType) || AppType.BUBBLE_LAB;
  }

  // Get Clerk client and fetch user
  const clerkClient = getClerkClient(appType);
  if (!clerkClient) {
    // Return default subscription if no clerk client
    return {
      plan: 'unlimited',
      features: ['unlimited_usage'],
      appType,
      source: 'jwt',
      hackathonOffer: null,
    };
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const privateMetadata = (clerkUser.privateMetadata ||
      {}) as ClerkPrivateMetadata;

    // Base subscription from public metadata
    const basePlan = parseClerkPlan(clerkUser.publicMetadata?.plan as string);
    const baseFeatures = (clerkUser.publicMetadata?.features as
      | FEATURE_TYPE[]
      | undefined) || ['base_usage'];

    return resolveEffectiveSubscription({
      basePlan,
      baseFeatures,
      privateMetadata,
      appType,
    });
  } catch (err) {
    console.error('[OfferHelper] Error fetching user from Clerk:', err);
    // Return permissive fallback on error
    return {
      plan: 'unlimited',
      features: ['unlimited_usage'],
      appType,
      source: 'jwt',
      hackathonOffer: null,
    };
  }
}

/**
 * Get effective subscription for a user
 * Tries context first (set by auth middleware), falls back to Clerk fetch
 * This consolidates the "context-or-Clerk" pattern
 */
export async function getEffectiveUserSubscription(
  userId: string,
  appType?: AppType
): Promise<EffectiveSubscription> {
  // Try context first
  const contextInfo = getCurrentUserInfo();
  if (contextInfo && contextInfo.appType) {
    // Context already has resolved subscription from auth middleware
    return {
      plan: contextInfo.plan,
      features: contextInfo.features,
      appType: contextInfo.appType,
      source: 'jwt', // We don't track source in context currently
      hackathonOffer: null, // Context doesn't include hackathon details
    };
  }

  // Fallback: fetch from Clerk and resolve
  return await fetchAndResolveSubscription(userId, appType);
}

/**
 * Get hackathon offer in API response format
 * Used by subscription routes
 */
export function getActiveHackathonOfferForResponse(
  privateMetadata: ClerkPrivateMetadata
): HackathonOffer | null {
  const result = checkHackathonOffer(privateMetadata);

  if (!result.expiresAt) {
    return null;
  }

  return {
    isActive: result.isActive,
    expiresAt: result.expiresAt.toISOString(),
    redeemedAt: result.redeemedAt?.toISOString() ?? null,
  };
}
