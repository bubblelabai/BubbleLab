import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { api } from '../lib/api';
import { isTokenFunctionReady } from '../lib/token-refresh';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';

interface UseSubscriptionResult {
  data: SubscriptionStatusResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSubscription(): UseSubscriptionResult {
  const { isLoaded, isSignedIn } = useAuth();

  const query = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get<SubscriptionStatusResponse>(
        '/subscription/status'
      );
      return response;
    },
    enabled: isLoaded && isSignedIn && isTokenFunctionReady(), // Only run query when user is authenticated AND token function is ready
    staleTime: 5 * 60 * 1000, // 5 minutes - token usage doesn't change too frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
