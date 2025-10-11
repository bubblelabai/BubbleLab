import { useQuery } from '@tanstack/react-query';
import { bubbleFlowApi } from '../services/bubbleFlowApi';
import type { ListBubbleFlowExecutionsResponse } from '@bubblelab/shared-schemas';

interface UseExecutionHistoryOptions {
  limit?: number;
  offset?: number;
}

interface UseExecutionHistoryResult {
  data: ListBubbleFlowExecutionsResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Detects if a flow ID is an optimistic (temporary) ID.
 * Optimistic IDs are generated using Date.now() which returns timestamps > 1600000000000
 * Real database IDs are small sequential integers (typically < 100000)
 */
function isOptimisticFlowId(flowId: number): boolean {
  // Timestamps from 2020 onwards are > 1600000000000
  // This is a safe threshold to distinguish between real DB IDs and timestamps
  const OPTIMISTIC_ID_THRESHOLD = 1600000000000;
  return flowId >= OPTIMISTIC_ID_THRESHOLD;
}

export function useExecutionHistory(
  flowId: number | null,
  options?: UseExecutionHistoryOptions
): UseExecutionHistoryResult {
  // Check if the flowId is optimistic (temporary) - don't fetch in this case
  const isOptimistic = flowId !== null && isOptimisticFlowId(flowId);

  const query = useQuery({
    queryKey: ['executionHistory', flowId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!flowId) {
        throw new Error('Flow ID is required');
      }

      console.log(
        `[useExecutionHistory] Fetching execution history for ID: ${flowId}`
      );
      const response = await bubbleFlowApi.getBubbleFlowExecutions(
        flowId,
        options
      );
      console.log(
        '[useExecutionHistory] Execution history received:',
        response
      );
      return response;
    },
    // Don't fetch if flowId is null OR if it's an optimistic ID
    enabled: !!flowId && !isOptimistic,
    staleTime: 30 * 1000, // 30 seconds (execution history changes more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isOptimistic) {
    console.log(
      `[useExecutionHistory] Skipping execution history fetch for optimistic flow ID: ${flowId}`
    );
  }

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  };
}
