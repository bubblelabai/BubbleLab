import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  MilkTeaRequest,
  MilkTeaResponse,
} from '@bubblelab/shared-schemas';
import { getCodeContextForMilkTea } from '../utils/editorContext';

/**
 * Request type for MilkTea mutation (without code context which we'll add)
 */
export type MilkTeaGenerateRequest = Omit<
  MilkTeaRequest,
  'currentCode' | 'insertLocation'
>;

/**
 * React Query mutation hook for calling MilkTea AI agent to generate bubble code
 *
 * Usage:
 * ```typescript
 * const milkTeaMutation = useMilkTea();
 *
 * const handleGenerate = async () => {
 *   milkTeaMutation.mutate({
 *     bubbleName: 'resend',
 *     bubbleSchema: {...},
 *     userRequest: 'Send email to all users',
 *     ...
 *   }, {
 *     onSuccess: (result) => {
 *       if (result.type === 'code') {
 *         // Insert result.snippet into editor
 *       }
 *     },
 *   });
 * };
 * ```
 */
export function useMilkTea() {
  return useMutation({
    mutationFn: async (
      request: MilkTeaGenerateRequest
    ): Promise<MilkTeaResponse> => {
      // Get code context from editor
      const context = await getCodeContextForMilkTea();

      if (!context) {
        throw new Error('Could not get code context from editor');
      }

      // Build full MilkTea request with code context
      const fullRequest: MilkTeaRequest = {
        ...request,
        currentCode: context.fullCode,
        insertLocation: context.insertLocation,
        model: 'google/gemini-2.5-pro',
      };

      // Call MilkTea API
      const result = await api.post<MilkTeaResponse>(
        '/ai/milktea',
        fullRequest
      );

      return result;
    },
  });
}
