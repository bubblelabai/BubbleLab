import { useAuth } from '../hooks/useAuth';
import { type ReactNode } from 'react';
import { useClerkTokenSync } from '../hooks/useClerkTokenSync';

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoaded } = useAuth();

  // Initialize token sync as early as possible
  useClerkTokenSync();

  // Don't render children until Clerk is loaded and token sync is initialized
  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-panel text-foreground">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-info border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
