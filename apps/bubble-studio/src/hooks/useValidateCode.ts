import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api } from '../lib/api';
import type {
  ValidateBubbleFlowResponse,
  CredentialType,
} from '@bubblelab/shared-schemas';
import { useExecutionStore } from '../stores/executionStore';
import { useBubbleFlow } from './useBubbleFlow';

interface ValidateCodeRequest {
  code: string;
  flowId: number;
  credentials: Record<string, Record<string, number>>;
}

interface ValidateCodeOptions {
  flowId: number | null;
}

export function useValidateCode({ flowId }: ValidateCodeOptions) {
  const executionState = useExecutionStore(flowId);
  const {
    // data: currentFlow,
    updateBubbleParameters,
    updateInputSchema,
    updateRequiredCredentials,
    updateCode,
  } = useBubbleFlow(flowId);

  return useMutation({
    mutationFn: async (request: ValidateCodeRequest) => {
      return api.post<ValidateBubbleFlowResponse>('/bubble-flow/validate', {
        code: request.code,
        flowId: request.flowId,
        credentials: request.credentials,
        options: {
          includeDetails: true,
          strictMode: true,
        },
      });
    },
    onMutate: (variables) => {
      // Set validating state to disable Run button
      executionState.startValidation();

      // Optimistically update code in React Query cache
      // This prevents App.tsx useEffect from overriding editor with stale code
      updateCode(variables.code);

      // Show loading toast
      const loadingToastId = toast.loading('Validating code...');
      return { loadingToastId };
    },
    onSuccess: (result, _variables, context) => {
      // Dismiss loading toast
      if (context?.loadingToastId) {
        toast.dismiss(context.loadingToastId);
      }

      // Update visualizer with bubbles from validation
      if (
        result.valid &&
        result.bubbles &&
        Object.keys(result.bubbles).length > 0
      ) {
        // Code was already optimistically updated in onMutate
        // Now update the validation results (bubbles, schema, credentials)
        updateBubbleParameters(result.bubbles);
        updateInputSchema(result.inputSchema);
        updateRequiredCredentials(
          result.requiredCredentials as Record<string, CredentialType[]>
        );
      }

      // Capture and store inputSchema from validation response
      if (result.inputSchema) {
        // Schema captured and stored
      }

      if (result.valid) {
        // Show success toast with bubble count
        const bubbleCount = result.bubbleCount || 0;
        toast.success(
          `✅ Code validation successful! Found ${bubbleCount} bubble${bubbleCount !== 1 ? 's' : ''}.`,
          {
            autoClose: 3000,
          }
        );

        // Show detailed info in a separate toast
        if (result.bubbles && Object.keys(result.bubbles).length > 0) {
          const bubbleDetails = Object.values(result.bubbles)
            .map(
              (bubble, index) =>
                `${index + 1}. ${bubble.variableName} (${bubble.bubbleName})`
            )
            .join('\n');

          toast.info(`Bubbles found:\n${bubbleDetails}`, {
            autoClose: 8000,
            style: {
              whiteSpace: 'pre-line',
              fontSize: '12px',
            },
          });
        }

        // Show metadata toast
        toast.info(
          `Validation completed at ${new Date(result.metadata.validatedAt).toLocaleTimeString()}\n` +
            `Code: ${result.metadata.codeLength} characters\n` +
            `Strict mode: ${result.metadata.strictMode ? 'Yes' : 'No'}`,
          {
            autoClose: 5000,
            style: {
              whiteSpace: 'pre-line',
              fontSize: '12px',
            },
          }
        );
        executionState.stopValidation();
      } else {
        // Show error toast with validation errors
        const errorCount = result.errors?.length || 0;
        toast.error(
          `❌ Code validation failed with ${errorCount} error${errorCount !== 1 ? 's' : ''}`,
          {
            autoClose: 5000,
          }
        );

        // Show detailed errors in a separate toast
        if (result.errors && result.errors.length > 0) {
          const errorDetails = result.errors
            .map((error, index) => `${index + 1}. ${error}`)
            .join('\n');

          toast.error(`Validation errors:\n${errorDetails}`, {
            autoClose: 10000,
            style: {
              whiteSpace: 'pre-line',
              fontSize: '12px',
              maxWidth: '400px',
            },
          });
        }
        executionState.stopValidation();
      }
    },
    onError: (error, _variables, context) => {
      // Dismiss loading toast
      if (context?.loadingToastId) {
        toast.dismiss(context.loadingToastId);
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      toast.error(`Validation Error: ${errorMessage}`, {
        autoClose: 8000,
      });
      executionState.stopValidation();
    },
  });
}
