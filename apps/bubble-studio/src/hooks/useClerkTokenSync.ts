import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { setGetTokenFunction } from '../lib/token-refresh';
import { API_BASE_URL, DISABLE_AUTH } from '../env';

/**
 * Registers Clerk's getToken function for use in API client.
 * Clerk automatically handles token refresh internally, so we don't need
 * to manually refresh tokens periodically.
 */
export function useClerkTokenSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    // Skip all auth logic when auth is disabled
    if (DISABLE_AUTH) {
      setGetTokenFunction(() => Promise.resolve(null));
      return;
    }

    if (!isLoaded) return;

    // Register the getToken function for token refresh
    setGetTokenFunction(getToken);

    if (isSignedIn) {
      // Initial auth ping to ensure user is created in backend
      void getToken().then(async (jwt) => {
        if (jwt) {
          // Ping backend to ensure upsert happens immediately
          try {
            await fetch(`${API_BASE_URL}/auth/ping`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
          } catch (err) {
            console.error('Auth ping failed', err);
          }
        }
      });
    } else {
      // Clear the token function when user signs out
      setGetTokenFunction(() => Promise.resolve(null));
    }
  }, [isLoaded, isSignedIn, getToken]);
}
