import { useAuth } from '../hooks/useAuth';
import { type ReactNode } from 'react';
import { useClerkTokenSync } from '../hooks/useClerkTokenSync';
import { useAnalyticsIdentity } from '../hooks/useAnalytics';

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoaded } = useAuth();

  // Initialize token sync as early as possible
  useClerkTokenSync();

  // Sync user identity with PostHog analytics
  useAnalyticsIdentity();

  // Don't render children until Clerk is loaded and token sync is initialized
  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117] text-gray-100">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
