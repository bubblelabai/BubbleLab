import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCodeContextForPearl } from '../utils/editorContext';
import { useEditorStore } from '../stores/editorStore';
import { PearlRequest, PearlResponse } from '@bubblelab/shared-schemas';

/**
 * React Query mutation hook for Pearl AI chat
 * This is for general workflow assistance without a specific bubble
 *
 * Usage:
 * ```typescript
 * const pearlMutation = usePearl();
 *
 * const handleGenerate = async () => {
 *   pearlMutation.mutate({
 *     userRequest: 'Create a workflow that sends emails',
 *     userName: 'User',
 *     conversationHistory: [],
 *   }, {
 *     onSuccess: (result) => {
 *       if (result.type === 'code') {
 *         // Replace entire editor content with result.snippet
 *       }
 *     },
 *   });
 * };
 * ```
 */
export function usePearl() {
  return useMutation({
    mutationFn: async (request: PearlRequest): Promise<PearlResponse> => {
      // Get full code from editor
      const state = useEditorStore.getState();
      const fullCode = state.editorInstance?.getModel()?.getValue() || '';

      // Get available variables from editor
      const codeContext = await getCodeContextForPearl();

      // Build request payload for pearl
      const fullRequest = {
        userRequest: request.userRequest,
        currentCode: fullCode,
        userName: request.userName,
        conversationHistory: request.conversationHistory,
        availableVariables:
          request.availableVariables || codeContext?.availableVariables,
        model: request.model || 'google/gemini-2.5-pro',
      };

      console.log('fullRequest', JSON.stringify(fullRequest, null, 2));

      // Call pearl API endpoint
      const result = await api.post<PearlResponse>('/ai/pearl', fullRequest);

      return result;
    },
  });
}
