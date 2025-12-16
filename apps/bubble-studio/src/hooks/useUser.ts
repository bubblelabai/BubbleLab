import { useUser as useClerkUser } from '@clerk/clerk-react';
import { DISABLE_AUTH } from '../env';

/**
 * Custom useUser hook that wraps Clerk's useUser
 * When DISABLE_AUTH is true, returns mock user data to bypass authentication
 */
export function useUser() {
  // When auth is disabled, return mock user data
  if (DISABLE_AUTH) {
    // Check localStorage for onboarding completion (for self-hosted users)
    const onboardingCompleted =
      typeof window !== 'undefined' &&
      localStorage.getItem('onboardingCompleted') === 'true';

    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'mock-user-id',
        emailAddresses: [
          {
            emailAddress: 'dev@localhost.com',
            id: 'mock-email-id',
          },
        ],
        firstName: 'Dev',
        lastName: 'User',
        fullName: 'Dev User',
        primaryEmailAddressId: 'mock-email-id',
        publicMetadata: {
          onboardingCompleted, // Check localStorage for self-hosted users
        },
      },
    };
  }

  // When auth is enabled, use Clerk's useUser
  // This is safe because DISABLE_AUTH is a compile-time constant from env vars
  // The code path is consistent across all renders
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkUser();
}
