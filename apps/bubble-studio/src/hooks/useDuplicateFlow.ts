import { useCallback } from 'react';
import { useBubbleFlow } from './useBubbleFlow';
import { useBubbleFlowList } from './useBubbleFlowList';
import { useCreateBubbleFlow } from './useCreateBubbleFlow';

interface UseDuplicateFlowOptions {
  flowId: number | null;
  onSuccess?: (newFlowId: number) => void;
  onError?: (error: Error) => void;
}

interface UseDuplicateFlowResult {
  duplicateFlow: () => Promise<number | null>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for duplicating a flow
 * Creates a completely new independent copy with a new timestamp
 */
export function useDuplicateFlow({
  flowId,
  onSuccess,
  onError,
}: UseDuplicateFlowOptions): UseDuplicateFlowResult {
  const { data: currentFlow } = useBubbleFlow(flowId);
  const { data: flowList } = useBubbleFlowList();
  const createFlowMutation = useCreateBubbleFlow();

  const duplicateFlow = useCallback(async (): Promise<number | null> => {
    if (!currentFlow || !flowId) {
      console.error('[useDuplicateFlow] No flow data available');
      return null;
    }

    try {
      // Get the bubbles from the flow list for optimistic update
      const sourceFlowInList = flowList?.bubbleFlows.find(
        (f) => f.id === flowId
      );
      const bubbles = sourceFlowInList?.bubbles;

      // Create the duplicate request with a new name
      const duplicateRequest = {
        name: `${currentFlow.name} (Copy)`,
        description: currentFlow.description,
        code: currentFlow.code,
        eventType: currentFlow.eventType,
        webhookActive: false, // Don't activate webhook by default
        prompt: currentFlow.prompt,
        // Include bubbles for optimistic UI update
        _optimisticBubbles: bubbles,
      };

      // Execute createFlow mutation
      const result = await createFlowMutation.mutateAsync(duplicateRequest);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result.id);
      }

      return result.id;
    } catch (error) {
      console.error('[useDuplicateFlow] Failed to duplicate flow:', error);

      // Call error callback if provided
      if (onError && error instanceof Error) {
        onError(error);
      }

      return null;
    }
  }, [currentFlow, flowId, flowList, createFlowMutation, onSuccess, onError]);

  return {
    duplicateFlow,
    isLoading: createFlowMutation.isLoading,
    error: createFlowMutation.error,
  };
}
