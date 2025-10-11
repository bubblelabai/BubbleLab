import { Context, Next } from 'hono';
import { verifyToken } from '@clerk/backend';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  extractSubscriptionInfoFromPayload,
  PLAN_TYPE,
  FEATURE_TYPE,
} from '../services/subscription-validation.js';
import { getClerkClient } from '../utils/clerk-client.js';
import {
  AppType,
  getSecretKeyForApp,
  detectAppTypeFromIssuer,
} from '../config/clerk-apps.js';
import { env } from '../config/env.js';
import { DEV_USER_ID } from '../db/seed-dev-user.js';

export interface ClerkJWTPayload {
  azp: string;
  exp: number;
  fea: string;
  fva: number[];
  iat: number;
  iss: string;
  nbf: number;
  pla: string;
  sid: string;
  sub: string;
  v: number;
}

const devUserId = DEV_USER_ID;
const devUserPlan: PLAN_TYPE = 'free_user';
const devUserFeatures: FEATURE_TYPE[] = ['base_usage'];

/**
 * Detect app type from JWT token issuer using centralized configuration
 */
function detectAppType(token: string): AppType | null {
  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return AppType.BUBBLE_LAB; // Default fallback
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const issuer = decoded?.iss || '';

    console.log('Detected issuer:', issuer);

    // Use centralized issuer detection
    const appType = detectAppTypeFromIssuer(issuer);
    console.log('Detected app type:', appType);

    if (appType == null) {
      throw new Error('Unauthorized app');
    }

    return appType;
  } catch (err) {
    console.log(
      'Failed to decode token for app detection, defaulting to nodex'
    );
    return null;
  }
}

/**
 * Multi-tenant authentication middleware that supports multiple Clerk applications
 * Automatically detects the app type from JWT issuer and uses the appropriate Clerk configuration
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  // If no auth header, we reject unless in dev mode
  if (!authHeader) {
    if (env.isDev) {
      const testUserId = c.req.header('X-User-ID');
      const userId = testUserId || devUserId;
      c.set('userId', userId);
      c.set('userPlan', devUserPlan);
      c.set('userFeatures', devUserFeatures);
      c.set('appType', AppType.BUBBLE_LAB); // Default to nodex in dev
      return await next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    // Detect app type from token issuer
    const appType = detectAppType(token);
    if (appType == null) {
      console.log('Unauthorized app!!!!');
      throw new Error('Unauthorized app');
    }
    const secretKey = getSecretKeyForApp(appType);

    if (!secretKey) {
      if (env.isDev) {
        // Skip verification in dev if secret key missing, but still check for X-User-ID
        const testUserId = c.req.header('X-User-ID');
        const userId = testUserId || devUserId;
        c.set('userId', userId);
        c.set('userTier', devUserPlan);
        c.set('userPlan', devUserPlan);
        c.set('userFeatures', devUserFeatures);
        c.set('appType', appType);
        return await next();
      }
      throw new Error(`Clerk secret key not configured for app: ${appType}`);
    }

    // Verify token with the appropriate Clerk configuration
    const payload = (await verifyToken(token, {
      secretKey,
    })) as ClerkJWTPayload;

    // Clerk uses `sub` as the user ID in JWTs
    const userId = payload.sub;
    // Extract subscription info from JWT payload
    const subscriptionInfo = extractSubscriptionInfoFromPayload(payload);

    // Set user info and app context
    c.set('userId', userId);
    c.set('userPlan', subscriptionInfo.plan);
    c.set('userFeatures', subscriptionInfo.features);
    c.set('userTier', subscriptionInfo.plan); // Use plan as tier for now
    c.set('appType', appType);

    // --- Optional: persist / update user record in DB (lightweight upsert) ---
    try {
      // Use the appropriate Clerk client for this app
      const clerkClient = getClerkClient(appType);
      if (clerkClient) {
        const clerkUser = await clerkClient.users.getUser(userId);
        if (clerkUser) {
          // Update Clerk user metadata with subscription features
          const currentFeatures =
            (clerkUser.publicMetadata?.features as FEATURE_TYPE[]) || [];
          const needsUpdate =
            JSON.stringify(currentFeatures) !==
            JSON.stringify(subscriptionInfo.features);
          if (needsUpdate) {
            await clerkClient.users.updateUserMetadata(userId, {
              publicMetadata: {
                ...clerkUser.publicMetadata,
                features: subscriptionInfo.features,
                plan: subscriptionInfo.plan,
              },
            });
          }

          const { firstName, lastName, emailAddresses, createdAt } = clerkUser;
          const primaryEmail = emailAddresses?.[0]?.emailAddress ?? null;

          // Simple upsert via ON CONFLICT(id) DO UPDATE
          await db
            .insert(users)
            .values({
              // userId is auto-incremented by the database
              clerkId: userId, // Clerk user ID
              firstName: firstName ?? null,
              lastName: lastName ?? null,
              email: primaryEmail ?? null,
              appType: appType, // Store which app this user belongs to
              createdAt: createdAt ? new Date(createdAt) : new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              // Use the unique clerkId column to perform upsert
              target: users.clerkId,
              set: {
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                email: primaryEmail ?? null,
                appType: appType, // Update app type on each login (in case user switches apps)
                updatedAt: new Date(),
              },
            });
        }
      }
    } catch (err) {
      console.error('Failed to upsert user', err);
    }

    await next();
  } catch (err) {
    console.error('Auth error', err);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Helper function to get the authenticated user ID from context
 */
export function getUserId(c: Context): string {
  const userId = c.get('userId');

  if (!userId && !env.isDev) {
    throw new Error('User not authenticated');
  } else if (!userId && env.isDev) {
    return devUserId;
  }
  return userId;
}

/**
 * Helper function to get the authenticated user's subscription info from context
 */
export function getSubscriptionInfo(c: Context) {
  const userPlan = c.get('userPlan') as PLAN_TYPE;
  const userFeatures = c.get('userFeatures') as FEATURE_TYPE[];
  return {
    plan: userPlan,
    features: userFeatures,
  };
}

/**
 * Helper function to get the app type from context
 */
export function getAppType(c: Context): AppType {
  const appType = c.get('appType');
  return appType || AppType.NODEX; // Default to nodex for backward compatibility
}
