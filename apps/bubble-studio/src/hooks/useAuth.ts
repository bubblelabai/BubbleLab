import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { DISABLE_AUTH } from '../env';

/**
 * Custom useAuth hook that wraps Clerk's useAuth
 * When DISABLE_AUTH is true, returns mock values to bypass authentication
 */
export function useAuth() {
  // When auth is disabled, return mock authenticated state
  if (DISABLE_AUTH) {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: 'mock-user-id',
      sessionId: 'mock-session-id',
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: () => false,
      signOut: async () => {},
      getToken: async () => null,
    };
  }

  // When auth is enabled, use Clerk's useAuth
  // This is safe because DISABLE_AUTH is a compile-time constant from env vars
  // The code path is consistent across all renders
  // ignore linting error
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkAuth();
}
