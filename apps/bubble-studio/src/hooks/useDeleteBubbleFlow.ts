import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { BubbleFlowListResponse } from '@bubblelab/shared-schemas';

export interface DeleteBubbleFlowResponse {
  message: string;
}

interface UseDeleteBubbleFlowResult {
  mutate: (flowId: number) => void;
  mutateAsync: (flowId: number) => Promise<DeleteBubbleFlowResponse>;
  isLoading: boolean;
  error: Error | null;
  data: DeleteBubbleFlowResponse | undefined;
  reset: () => void;
}

export function useDeleteBubbleFlow(): UseDeleteBubbleFlowResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['deleteBubbleFlow'],
    mutationFn: async (flowId: number): Promise<DeleteBubbleFlowResponse> => {
      const response = await api.delete<DeleteBubbleFlowResponse>(
        `/bubble-flow/${flowId}`
      );
      return response;
    },
    onMutate: async (flowId) => {
      // Cancel any outgoing refetches for bubble flow list
      await queryClient.cancelQueries({ queryKey: ['bubbleFlowList'] });

      // Snapshot the previous value
      const previousFlowList = queryClient.getQueryData<BubbleFlowListResponse>(
        ['bubbleFlowList']
      );

      // Optimistically remove the flow from the list
      if (previousFlowList) {
        const updatedFlowList: BubbleFlowListResponse = {
          ...previousFlowList,
          bubbleFlows: previousFlowList.bubbleFlows.filter(
            (flow) => flow.id !== flowId
          ),
        };

        queryClient.setQueryData(['bubbleFlowList'], updatedFlowList);
      }
      return { previousFlowList, deletedFlowId: flowId };
    },
    onSuccess: (data, flowId) => {
      // The optimistic update is already correct, no need to update again
      // Just ensure the individual flow cache is cleaned up
      queryClient.removeQueries({ queryKey: ['bubbleFlow', flowId] });
    },
    onError: (error, flowId, context) => {
      // Rollback optimistic updates
      if (context?.previousFlowList) {
        queryClient.setQueryData(['bubbleFlowList'], context.previousFlowList);
      }

      // Re-add the flow details to cache if we had them
      // Note: We don't have the original flow data in context, so we'll let the next query refetch it
    },
    onSettled: () => {
      // Don't refetch - rely on optimistic updates for immediate UI feedback
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
