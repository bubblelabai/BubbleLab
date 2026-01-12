import { useMutation } from '@tanstack/react-query';
import { bubbleFlowApi } from '../services/bubbleFlowApi';
import type { BubbleFlowExecutionDetail } from '@bubblelab/shared-schemas';

interface FetchExecutionDetailParams {
  flowId: number;
  executionId: number;
}

/**
 * Mutation hook for fetching a single execution with full logs.
 * Used when restoring execution history to the executionStore.
 *
 * This is a mutation because it's triggered by user action
 * (clicking on an execution history entry).
 */
export function useFetchExecutionDetail() {
  return useMutation({
    mutationFn: async ({
      flowId,
      executionId,
    }: FetchExecutionDetailParams): Promise<BubbleFlowExecutionDetail> => {
      return bubbleFlowApi.getBubbleFlowExecutionDetail(flowId, executionId);
    },
  });
}
