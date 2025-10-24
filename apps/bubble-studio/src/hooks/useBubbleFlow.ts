import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../lib/api';
import type { BubbleFlowDetailsResponse } from '@bubblelab/shared-schemas';

interface UseBubbleFlowResult {
  data: BubbleFlowDetailsResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  setOptimisticData: (data: BubbleFlowDetailsResponse) => void;
  updateInputSchema: (inputSchema: Record<string, unknown>) => void;
  updateCronActive: (cronActive: boolean) => void;
  updateDefaultInputs: (defaultInputs: Record<string, unknown>) => void;
  updateCronSchedule: (cronSchedule: string) => void;
  updateCode: (code: string) => void;
  updateRequiredCredentials: (
    requiredCredentials: BubbleFlowDetailsResponse['requiredCredentials']
  ) => void;
  updateBubbleParameters: (
    bubbleParameters: BubbleFlowDetailsResponse['bubbleParameters']
  ) => void;
  syncWithBackend: () => Promise<void>;
}

export function useBubbleFlow(flowId: number | null): UseBubbleFlowResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bubbleFlow', flowId],
    queryFn: async () => {
      if (!flowId) {
        throw new Error('Flow ID is required');
      }

      const response = await api.get<BubbleFlowDetailsResponse>(
        `/bubble-flow/${flowId}`
      );
      return response;
    },
    enabled: !!flowId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const setOptimisticData = useCallback(
    (data: BubbleFlowDetailsResponse) => {
      if (!flowId) return;

      queryClient.setQueryData(['bubbleFlow', flowId], data);
    },
    [queryClient, flowId]
  );

  const updateCronActive = useCallback(
    (cronActive: boolean) => {
      if (!flowId) return;

      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (currentData: BubbleFlowDetailsResponse | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            cronActive,
          };
        }
      );
    },
    [queryClient, flowId]
  );

  const updateDefaultInputs = useCallback(
    (defaultInputs: Record<string, unknown>) => {
      if (!flowId) return;

      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (currentData: BubbleFlowDetailsResponse | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            defaultInputs,
          };
        }
      );
    },
    [queryClient, flowId]
  );

  const updateCronSchedule = useCallback(
    (cronSchedule: string) => {
      if (!flowId) return;

      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (currentData: BubbleFlowDetailsResponse | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            cron: cronSchedule,
          };
        }
      );
    },
    [queryClient, flowId]
  );
  const updateInputSchema = useCallback(
    (inputSchema: Record<string, unknown>) => {
      if (!flowId) return;

      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (currentData: BubbleFlowDetailsResponse | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            inputSchema,
          };
        }
      );
    },
    [queryClient, flowId]
  );
  const updateCode = useCallback(
    (code: string) => {
      if (!flowId) return;

      queryClient.setQueryData(
        ['bubbleFlow', flowId],
        (currentData: BubbleFlowDetailsResponse | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            code,
          };
        }
      );
    },
    [queryClient, flowId]
  );

  const updateRequiredCredentials = useCallback(
    (requiredCredentials: BubbleFlowDetailsResponse['requiredCredentials']) => {
      if (!flowId) return;

      const currentData = queryClient.getQueryData<BubbleFlowDetailsResponse>([
        'bubbleFlow',
        flowId,
      ]);
      if (!currentData) return;

      queryClient.setQueryData(['bubbleFlow', flowId], {
        ...currentData,
        requiredCredentials,
      });
    },
    [queryClient, flowId]
  );

  const updateBubbleParameters = useCallback(
    (bubbleParameters: BubbleFlowDetailsResponse['bubbleParameters']) => {
      if (!flowId) return;

      const currentData = queryClient.getQueryData<BubbleFlowDetailsResponse>([
        'bubbleFlow',
        flowId,
      ]);
      if (!currentData) return;

      const updatedData: BubbleFlowDetailsResponse = {
        ...currentData,
        bubbleParameters,
      };

      queryClient.setQueryData(['bubbleFlow', flowId], updatedData);
    },
    [queryClient, flowId]
  );

  const syncWithBackend = useCallback(async () => {
    if (!flowId) {
      throw new Error('Flow ID is required for backend synchronization');
    }
  }, [flowId]);

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    setOptimisticData,
    updateCronActive,
    updateDefaultInputs,
    updateCronSchedule,
    updateInputSchema,
    updateBubbleParameters,
    updateCode,
    updateRequiredCredentials,
    syncWithBackend,
  };
}
