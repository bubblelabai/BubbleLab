import { api } from '../lib/api';
import type {
  UpdateBubbleFlowParametersRequest,
  ListBubbleFlowExecutionsResponse,
  BubbleFlowExecutionDetail,
} from '@bubblelab/shared-schemas';

export const bubbleFlowApi = {
  /**
   * Update bubble flow parameters including credential assignments
   * Uses the shared schema: PUT /bubble-flow/:id
   */
  updateBubbleFlowParameters: async (
    flowId: number,
    data: UpdateBubbleFlowParametersRequest
  ): Promise<{ message: string }> => {
    return api.put<{ message: string }>(`/bubble-flow/${flowId}`, data);
  },

  /**
   * Update bubble flow name
   * Uses the shared schema: PATCH /bubble-flow/:id/name
   */
  updateBubbleFlowName: async (
    flowId: number,
    name: string
  ): Promise<{ message: string }> => {
    return api.patch<{ message: string }>(`/bubble-flow/${flowId}/name`, {
      name,
    });
  },

  /**
   * Get bubble flow details including current parameters and credential assignments
   */
  getBubbleFlowDetails: async (flowId: number) => {
    return api.get(`/bubble-flow/${flowId}`);
  },

  /**
   * Get execution history for a specific bubble flow
   * Uses the shared schema: GET /bubble-flow/:id/executions
   */
  getBubbleFlowExecutions: async (
    flowId: number,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<ListBubbleFlowExecutionsResponse> => {
    const searchParams = new URLSearchParams();
    if (options?.limit) {
      searchParams.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      searchParams.append('offset', options.offset.toString());
    }

    const queryString = searchParams.toString();
    const url = `/bubble-flow/${flowId}/executions${queryString ? `?${queryString}` : ''}`;

    return api.get<ListBubbleFlowExecutionsResponse>(url);
  },

  /**
   * Get a single execution with full logs
   * Uses the shared schema: GET /bubble-flow/:id/executions/:executionId
   */
  getBubbleFlowExecutionDetail: async (
    flowId: number,
    executionId: number
  ): Promise<BubbleFlowExecutionDetail> => {
    return api.get<BubbleFlowExecutionDetail>(
      `/bubble-flow/${flowId}/executions/${executionId}`
    );
  },
};
