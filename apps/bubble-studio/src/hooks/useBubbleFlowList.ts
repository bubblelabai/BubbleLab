import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { api } from '../lib/api';
import { isTokenFunctionReady } from '../lib/token-refresh';
import type { BubbleFlowListResponse } from '@bubblelab/shared-schemas';

interface UseBubbleFlowListResult {
  data: BubbleFlowListResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useBubbleFlowList(): UseBubbleFlowListResult {
  const { isLoaded, isSignedIn } = useAuth();

  const query = useQuery({
    queryKey: ['bubbleFlowList'],
    queryFn: async () => {
      console.log('[useBubbleFlowList] Fetching flow list from backend');
      const response = await api.get<BubbleFlowListResponse>('/bubble-flow');
      console.log('[useBubbleFlowList] Flow list received:', response);
      return response;
    },
    enabled: isLoaded && isSignedIn && isTokenFunctionReady(), // Only run query when user is authenticated AND token function is ready
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
