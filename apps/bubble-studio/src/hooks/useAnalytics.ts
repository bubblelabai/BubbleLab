import { useEffect, useRef } from 'react';
import { useUser } from './useUser';
import { useAuth } from './useAuth';
import { analytics } from '../services/analytics';
import { DISABLE_AUTH } from '../env';

/**
 * Generate or retrieve a persistent random user ID for self-hosted mode
 */
function getSelfHostedUserId(): string {
  const STORAGE_KEY = 'bubblelab_anonymous_user_id';

  try {
    // Try to get existing ID from localStorage
    let userId = localStorage.getItem(STORAGE_KEY);

    if (!userId) {
      // Generate a new random user ID
      userId = `self-hosted-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(STORAGE_KEY, userId);
    }

    return userId;
  } catch {
    // Fallback if localStorage is not available
    console.warn(
      '[Analytics] localStorage not available, using session-only ID'
    );
    return `self-hosted-session-${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Hook to sync user identity with PostHog analytics
 * Handles both cloud mode (Clerk) and self-hosted mode (anonymous with random ID)
 */
export function useAnalyticsIdentity(): void {
  const { isSignedIn } = useAuth();
  const clerkUser = useUser();
  const user = DISABLE_AUTH ? null : clerkUser.user;
  const identifiedRef = useRef(false);

  useEffect(() => {
    if (DISABLE_AUTH && !identifiedRef.current) {
      // Self-hosted mode: identify with persistent random anonymous user ID
      const anonymousUserId = getSelfHostedUserId();
      analytics.identify(anonymousUserId, {
        mode: 'self-hosted',
        deployment_type: 'local',
      });
      identifiedRef.current = true;
    } else if (!DISABLE_AUTH && isSignedIn && user && !identifiedRef.current) {
      // Cloud mode: identify with Clerk user
      const email =
        'primaryEmailAddress' in user
          ? user.primaryEmailAddress?.emailAddress
          : user.emailAddresses?.[0]?.emailAddress;
      const username = 'username' in user ? user.username : user.fullName;

      analytics.identify(user.id, {
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        username,
        mode: 'cloud',
        deployment_type: 'cloud',
      });
      identifiedRef.current = true;
    } else if (!DISABLE_AUTH && !isSignedIn && identifiedRef.current) {
      // Cloud mode: reset analytics on sign out
      analytics.reset();
      identifiedRef.current = false;
    }
  }, [isSignedIn, user]);
}

/**
 * Hook to track execution timing
 */
export function useExecutionTimer() {
  const startTimeRef = useRef<number | null>(null);

  const start = () => {
    startTimeRef.current = Date.now();
  };

  const getElapsedTime = (): number | undefined => {
    if (startTimeRef.current === null) {
      return undefined;
    }
    return Date.now() - startTimeRef.current;
  };

  const reset = () => {
    startTimeRef.current = null;
  };

  return { start, getElapsedTime, reset };
}
