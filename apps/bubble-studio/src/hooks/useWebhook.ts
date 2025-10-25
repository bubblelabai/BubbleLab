import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  ActivateBubbleFlowResponse,
  BubbleFlowDetailsResponse,
  BubbleFlowListResponse,
} from '@bubblelab/shared-schemas';

interface ActivateWebhookParams {
  flowId: number;
  activate: boolean;
}

export function useWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flowId, activate }: ActivateWebhookParams) => {
      if (activate) {
        // Call the activate endpoint
        const response = await api.post<ActivateBubbleFlowResponse>(
          `/bubble-flow/${flowId}/activate`
        );
        return response;
      } else {
        // Call the deactivate endpoint
        const response = await api.post<{ success: boolean; message: string }>(
          `/bubble-flow/${flowId}/deactivate`
        );
        return { ...response, webhookUrl: '' };
      }
    },
    onMutate: async ({ flowId, activate }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['bubbleFlow', flowId] });
      await queryClient.cancelQueries({ queryKey: ['bubbleFlowList'] });

      // Snapshot the previous value
      const previousFlow = queryClient.getQueryData<BubbleFlowDetailsResponse>([
        'bubbleFlow',
        flowId,
      ]);

      // Optimistically update bubbleFlow cache
      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (old: BubbleFlowDetailsResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            isActive: activate,
          };
        }
      );

      // Optimistically update bubbleFlowList cache
      queryClient.setQueryData(
        ['bubbleFlowList'],
        (old: BubbleFlowListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            bubbleFlows: old.bubbleFlows.map((flow) => {
              if (flow.id === flowId) {
                return {
                  ...flow,
                  isActive: activate,
                };
              }
              return flow;
            }),
          };
        }
      );

      // Return context object with the snapshot
      return { previousFlow };
    },
    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousFlow) {
        queryClient.setQueryData(
          ['bubbleFlow', variables.flowId],
          context.previousFlow
        );
      }
      // Invalidate to refetch the real state
      queryClient.invalidateQueries({
        queryKey: ['bubbleFlow', variables.flowId],
      });
      queryClient.invalidateQueries({
        queryKey: ['bubbleFlowList'],
      });
    },
    onSuccess: (data, variables) => {},
  });
}
