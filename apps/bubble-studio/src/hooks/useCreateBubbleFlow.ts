import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from './useAuth';
import type {
  CreateBubbleFlowResponse,
  BubbleFlowListResponse,
  BubbleFlowListItem,
  CreateBubbleFlowRequest,
  CreateEmptyBubbleFlowRequest,
  BubbleFlowDetailsResponse,
  BubbleName,
} from '@bubblelab/shared-schemas';

interface CreateBubbleFlowWithOptimisticData extends CreateBubbleFlowRequest {
  // Optional: bubble information for optimistic UI updates (e.g., when duplicating)
  _optimisticBubbles?: Array<{
    bubbleName: BubbleName;
    className: string;
  }>;
}

interface CreateEmptyBubbleFlowWithOptimisticData
  extends CreateEmptyBubbleFlowRequest {
  // Optional: bubble information for optimistic UI updates
  _optimisticBubbles?: Array<{
    bubbleName: BubbleName;
    className: string;
  }>;
}

// Extended type for optimistic flows with loading state
export interface OptimisticBubbleFlowListItem extends BubbleFlowListItem {
  _isLoading?: boolean;
}

// Extended response type that includes optimistic flows
export interface OptimisticBubbleFlowListResponse
  extends Omit<BubbleFlowListResponse, 'bubbleFlows'> {
  bubbleFlows: OptimisticBubbleFlowListItem[];
}

interface UseCreateBubbleFlowResult {
  mutate: (request: CreateBubbleFlowWithOptimisticData) => void;
  mutateAsync: (
    request: CreateBubbleFlowWithOptimisticData
  ) => Promise<CreateBubbleFlowResponse>;
  isLoading: boolean;
  error: Error | null;
  data: CreateBubbleFlowResponse | undefined;
  reset: () => void;
}

interface UseCreateEmptyBubbleFlowResult {
  mutate: (request: CreateEmptyBubbleFlowWithOptimisticData) => void;
  mutateAsync: (
    request: CreateEmptyBubbleFlowWithOptimisticData
  ) => Promise<CreateBubbleFlowResponse>;
  isLoading: boolean;
  error: Error | null;
  data: CreateBubbleFlowResponse | undefined;
  reset: () => void;
}

// Function overloads
export function useCreateBubbleFlow(options: {
  isEmpty: true;
}): UseCreateEmptyBubbleFlowResult;
export function useCreateBubbleFlow(options?: {
  isEmpty?: false;
}): UseCreateBubbleFlowResult;
export function useCreateBubbleFlow(options?: {
  isEmpty?: boolean;
}): UseCreateBubbleFlowResult | UseCreateEmptyBubbleFlowResult {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const isEmpty = options?.isEmpty || false;

  const mutation = useMutation({
    mutationKey: isEmpty ? ['createEmptyBubbleFlow'] : ['createBubbleFlow'],
    mutationFn: async (
      request:
        | CreateBubbleFlowWithOptimisticData
        | CreateEmptyBubbleFlowWithOptimisticData
    ): Promise<CreateBubbleFlowResponse> => {
      console.log(
        `[useCreateBubbleFlow] Creating ${isEmpty ? 'empty' : 'new'} bubble flow:`,
        request
      );
      // Remove optimistic data before sending to server
      const { _optimisticBubbles: _, ...serverRequest } = request;
      void _; // Silence unused variable warning

      const endpoint = isEmpty ? '/bubble-flow/empty' : '/bubble-flow';
      const response = await api.post<CreateBubbleFlowResponse>(
        endpoint,
        serverRequest
      );
      console.log('[useCreateBubbleFlow] Flow created successfully:', response);
      return response;
    },
    onMutate: async (newFlow) => {
      // Cancel any outgoing refetches for bubble flow list
      await queryClient.cancelQueries({ queryKey: ['bubbleFlowList'] });

      // Snapshot the previous value
      const previousFlowList =
        queryClient.getQueryData<OptimisticBubbleFlowListResponse>([
          'bubbleFlowList',
        ]);

      // Generate temporary ID for optimistic update
      const tempId = Date.now();

      // Optimistically update the flow list with new flow
      if (previousFlowList) {
        // Get ownerId from existing flow or from auth context
        const ownerId =
          previousFlowList.bubbleFlows[0]?.ownerId || userId || 'unknown';

        const optimisticFlow: OptimisticBubbleFlowListItem = {
          id: tempId, // Temporary ID that will be replaced by real ID from server
          name: newFlow.name,
          description: newFlow.description,
          eventType: newFlow.eventType,
          isActive: newFlow.webhookActive || false,
          webhookExecutionCount: 0,
          cronActive: false,
          webhookFailureCount: 0,
          executionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId,
          // Include bubbles if provided (for duplication)
          bubbles: newFlow._optimisticBubbles,
          // Mark as loading for UI indication
          _isLoading: true,
        };

        const updatedFlowList: OptimisticBubbleFlowListResponse = {
          ...previousFlowList,
          bubbleFlows: [optimisticFlow, ...previousFlowList.bubbleFlows],
        };

        queryClient.setQueryData(['bubbleFlowList'], updatedFlowList);
        console.log('[useCreateBubbleFlow] Optimistic flow list updated');
      }

      // Also optimistically cache the full flow details using the temporary ID
      const optimisticFlowDetails = {
        id: tempId,
        name: newFlow.name,
        description: newFlow.description,
        code: isEmpty
          ? ''
          : (newFlow as CreateBubbleFlowWithOptimisticData).code, // Empty code for empty flows
        eventType: newFlow.eventType,
        webhookActive: newFlow.webhookActive,
        bubbleParameters: {}, // Will be populated by server response
        workflow: undefined, // Will be populated by server response
        requiredCredentials: {},
        prompt: newFlow.prompt,
        inputSchema: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(['bubbleFlow', tempId], optimisticFlowDetails);
      console.log(
        '[useCreateBubbleFlow] Optimistic flow details cached with temp ID:',
        tempId
      );

      return { previousFlowList, tempId };
    },
    onSuccess: (data, variables, context) => {
      console.log('[useCreateBubbleFlow] Flow creation succeeded:', data);

      // Update the flow list with the real data from server
      queryClient.setQueryData<OptimisticBubbleFlowListResponse>(
        ['bubbleFlowList'],
        (old) => {
          if (!old) return old;

          // Replace the optimistic entry with the real data
          const updatedFlows = old.bubbleFlows.map((flow) => {
            // Find the optimistic entry using the tempId
            if (context?.tempId && flow.id === context.tempId) {
              return {
                id: data.id,
                name: variables.name,
                description: variables.description,
                eventType: data.eventType,
                isActive: variables.webhookActive || false,
                webhookExecutionCount: 0,
                webhookFailureCount: 0,
                executionCount: 0,
                cronActive: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ownerId: flow.ownerId, // Preserve ownerId from optimistic flow
                // Preserve bubbles from optimistic update to prevent flash
                bubbles: flow.bubbles,
                // Remove loading state - flow is now real
                _isLoading: false,
              };
            }
            return flow;
          });

          return {
            ...old,
            bubbleFlows: updatedFlows,
          };
        }
      );

      // Set the flow details cache with real ID immediately (before invalidation)
      if (context?.tempId) {
        const optimisticFlowDetails = queryClient.getQueryData([
          'bubbleFlow',
          context.tempId,
        ]) as BubbleFlowDetailsResponse;

        if (optimisticFlowDetails) {
          // Update the cached flow with real ID and server data
          queryClient.setQueryData(['bubbleFlow', data.id], {
            ...optimisticFlowDetails,
            id: data.id,
            // Override with server response data (for regular flows with code)
            eventType: data.eventType || optimisticFlowDetails.eventType,
            bubbleParameters:
              data.bubbleParameters || optimisticFlowDetails.bubbleParameters,
            workflow: data.workflow || optimisticFlowDetails.workflow,
            requiredCredentials:
              data.requiredCredentials ||
              optimisticFlowDetails.requiredCredentials,
            inputSchema: data.inputSchema || optimisticFlowDetails.inputSchema,
          });
          console.log(
            '[useCreateBubbleFlow] Set flow cache with real ID:',
            data.id
          );
        }

        // Remove the optimistic flow details with temporary ID
        queryClient.removeQueries({ queryKey: ['bubbleFlow', context.tempId] });
        console.log(
          '[useCreateBubbleFlow] Removed optimistic flow data for tempId:',
          context.tempId
        );
      } else {
        // If no tempId, set the cache with data from server response
        queryClient.setQueryData(['bubbleFlow', data.id], {
          id: data.id,
          name: variables.name,
          description: variables.description,
          code: isEmpty
            ? ''
            : (variables as CreateBubbleFlowWithOptimisticData).code,
          eventType: data.eventType || variables.eventType,
          webhookActive: variables.webhookActive,
          // Use server response data for these fields (populated for regular flows)
          bubbleParameters: data.bubbleParameters || {},
          workflow: data.workflow || undefined,
          requiredCredentials: data.requiredCredentials || {},
          inputSchema: data.inputSchema || {},
          prompt: variables.prompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(
          '[useCreateBubbleFlow] Set flow cache for real ID (no tempId):',
          data.id
        );
      }
      queryClient.invalidateQueries({ queryKey: ['bubbleFlow', data.id] });
    },
    onError: (error, _variables, context) => {
      console.error('[useCreateBubbleFlow] Flow creation failed:', error);

      // Rollback optimistic updates
      if (context?.previousFlowList) {
        queryClient.setQueryData(['bubbleFlowList'], context.previousFlowList);
        console.log(
          '[useCreateBubbleFlow] Rolled back optimistic flow list update'
        );
      }

      // Remove the optimistic flow details
      if (context?.tempId) {
        queryClient.removeQueries({ queryKey: ['bubbleFlow', context.tempId] });
        console.log(
          '[useCreateBubbleFlow] Removed optimistic flow details for tempId:',
          context.tempId
        );
      }
    },
    onSettled: () => {
      // Always refetch the flow list to ensure consistency
      void queryClient.invalidateQueries({ queryKey: ['bubbleFlowList'] });
      console.log('[useCreateBubbleFlow] Invalidated flow list queries');
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
