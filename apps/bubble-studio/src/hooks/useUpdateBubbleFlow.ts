import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  BubbleFlowDetailsResponse,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { toast } from 'react-toastify';
interface UpdateBubbleFlowParams {
  flowId: number;
  credentials: Record<string, Record<string, number>>;
}

/**
 * Hook to update bubble flow parameters with credentials
 *
 * This mutation:
 * 1. Gets current flow data from React Query cache
 * 2. Merges credentials into bubble parameters
 * 3. Updates the flow on the server
 * 4. Invalidates the flow cache to trigger refetch
 */
export function useUpdateBubbleFlow(flowId?: number | null) {
  const queryClient = useQueryClient();
  const { updateBubbleParameters } = useBubbleFlow(flowId ?? null);

  return useMutation({
    mutationFn: async ({ flowId, credentials }: UpdateBubbleFlowParams) => {
      // Get current flow data from cache
      const flowData = queryClient.getQueryData<BubbleFlowDetailsResponse>([
        'bubbleFlow',
        flowId,
      ]);

      if (!flowData) {
        throw new Error('Flow data not found in cache');
      }

      // Merge credentials into bubble parameters
      const updatedParameters = { ...flowData.bubbleParameters };

      for (const [bubbleName, bubble] of Object.entries(updatedParameters)) {
        if (
          credentials[bubbleName] &&
          Object.keys(credentials[bubbleName]).length > 0
        ) {
          const bubbleObj = bubble as Record<string, unknown>;
          const params = (bubbleObj.parameters || []) as Array<
            Record<string, unknown>
          >;

          // Remove existing credentials parameter if any
          const filteredParams = params.filter((p) => p.name !== 'credentials');

          // Add new credentials parameter with selected credential IDs
          filteredParams.push({
            name: 'credentials',
            value: credentials[bubbleName],
            type: 'object',
          });

          bubbleObj.parameters = filteredParams;
        }
      }

      // Update the flow on the server
      const response = await api.put<{
        message: string;
        bubbleParameters: Record<string, ParsedBubbleWithInfo>;
      }>(`/bubble-flow/${flowId}`, {
        bubbleParameters: updatedParameters,
      });

      return response;
    },
    onSuccess: (response) => {
      // Update the bubble parameters in the useBubbleFlow store with the response
      if (response && response.bubbleParameters) {
        // The response contains the updated bubble parameters from the server
        updateBubbleParameters(response.bubbleParameters);
      } else {
        toast.error('Failed to update bubble flow');
      }
    },
    onError: (error) => {
      console.error('Failed to update bubble flow:', error);
    },
  });
}
