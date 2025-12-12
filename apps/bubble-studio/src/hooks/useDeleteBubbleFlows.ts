import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BubbleFlowListResponse } from '@bubblelab/shared-schemas';
import { api } from '../lib/api';

interface DeleteBubbleFlowsResponse {
  message: string;
}
interface UseDeleteBubbleFlowsResult {
  mutate: (flowIds: number[]) => void;
  mutateAsync: (flowIds: number[]) => Promise<DeleteBubbleFlowsResponse>;
  isLoading: boolean;
  error: Error | null;
  data: DeleteBubbleFlowsResponse | undefined;
  reset: () => void;
}

export function useDeleteBubbleFlows(): UseDeleteBubbleFlowsResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['deleteBubbleFlows'],
    mutationFn: async (
      flowIds: number[]
    ): Promise<DeleteBubbleFlowsResponse> => {
      console.log(
        `[useDeleteBubbleFlows] Deleting ${flowIds.length} bubble flows`
      );

      const response = await api.post<DeleteBubbleFlowsResponse>(
        `/bubble-flow/bulk/delete`,
        { ids: flowIds.map(String) }
      );

      console.log(
        '[useDeleteBubbleFlows] Flows deleted successfully:',
        response
      );
      return response;
    },
    onMutate: async (flowIds) => {
      // Cancel any outgoing refetches for bubble flow list
      await queryClient.cancelQueries({ queryKey: ['bubbleFlowList'] });

      // Snapshot the previous value
      const previousFlowList = queryClient.getQueryData<BubbleFlowListResponse>(
        ['bubbleFlowList']
      );

      // Optimistically remove the flows from the list
      if (previousFlowList) {
        const updatedFlowList: BubbleFlowListResponse = {
          ...previousFlowList,
          bubbleFlows: previousFlowList.bubbleFlows.filter(
            (flow) => !flowIds.includes(flow.id)
          ),
        };

        queryClient.setQueryData(['bubbleFlowList'], updatedFlowList);
        console.log(
          `[useDeleteBubbleFlows] Optimistically removed ${flowIds.length} flows from list`
        );
      }

      // Also remove the individual flow details from cache
      console.log(
        '[useDeleteBubbleFlows] Removed flow details from cache:',
        flowIds
      );

      return { previousFlowList, deletedFlowsCount: flowIds.length };
    },
    onSuccess: (data, flowIds) => {
      console.log(
        `[useDeleteBubbleFlows] ${flowIds.length} flows deletion succeeded:`,
        data
      );

      // The optimistic update is already correct, no need to update again
      // Just ensure the individual flow cache is cleaned up
      queryClient.removeQueries({ queryKey: ['bubbleFlow', flowIds] });
      console.log(
        '[useDeleteBubbleFlows] Confirmed removal of flow details:',
        flowIds.length
      );
    },
    onError: (error, flowIds, context) => {
      console.error('[useDeleteBubbleFlows] Flow deletion failed:', error);

      // Rollback optimistic updates
      if (context?.previousFlowList) {
        queryClient.setQueryData(['bubbleFlowList'], context.previousFlowList);
        console.log(
          '[useDeleteBubbleFlows] Rolled back optimistic flow list update'
        );
      }

      // Re-add the flow details to cache if we had them
      // Note: We don't have the original flow data in context, so we'll let the next query refetch it
      console.log(
        '[useDeleteBubbleFlows] Flows deletion failed:',
        flowIds.length
      );
    },
    onSettled: () => {
      // Don't refetch - rely on optimistic updates for immediate UI feedback
      console.log('[useDeleteBubbleFlows] Delete operation settled');
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
