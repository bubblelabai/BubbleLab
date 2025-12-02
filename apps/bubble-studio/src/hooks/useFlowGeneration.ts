import {
  getTemplateByIndex,
  hasTemplate,
} from '@/components/templates/templateLoader';
import { GenerationResult } from '@bubblelab/shared-schemas';
import { trackWorkflowGeneration } from '@/services/analytics';
import { useQuery } from '@tanstack/react-query';
import { createGenerateCodeQuery } from '@/queries/generateCodeQuery';
import { useEffect, useState, useRef } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { getFlowNameFromCode } from '@/utils/codeParser';
import { useCreateBubbleFlow } from '@/hooks/useCreateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useUIStore } from '@/stores/uiStore';
import { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { useExecutionStore } from '@/stores/executionStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from '@tanstack/react-router';

// AI Assistant name for user-facing messages
const AI_NAME = 'Pearl';

// Export the generateCode function for use in other components
export const useFlowGeneration = () => {
  const navigate = useNavigate();
  const { setOutput } = useOutputStore();
  const { selectedFlowId: currentFlowId, selectFlow } = useUIStore();
  const {
    startGenerationFlow,
    stopGenerationFlow,
    setGenerationPrompt,
    setGenerationResult,
  } = useGenerationStore();

  const createBubbleFlowMutation = useCreateBubbleFlow();
  const executionState = useExecutionStore(currentFlowId);
  const { updateBubbleParameters: updateCurrentBubbleParameters } =
    useBubbleFlow(currentFlowId);
  const { refetch: refetchSubscriptionStatus } = useSubscription();
  // State for managing generation
  const [generationParams, setGenerationParams] = useState<{
    prompt: string;
    selectedPreset?: number;
  } | null>(null);
  const generationStartTimeRef = useRef<number>(0);
  const processedEventCountRef = useRef<number>(0);

  // Use streamedQuery for code generation
  const { data: events = [], error } = useQuery({
    ...createGenerateCodeQuery({
      prompt: generationParams?.prompt || '',
    }),
    enabled:
      !!generationParams &&
      (generationParams.selectedPreset === undefined ||
        !hasTemplate(generationParams.selectedPreset)),
  });

  // Process events as they stream in
  useEffect(() => {
    if (!generationParams || events.length === 0) return;

    // Process only new events (skip already processed ones)
    const newEvents = events.slice(processedEventCountRef.current);
    if (newEvents.length === 0) return;

    processedEventCountRef.current = events.length;

    for (const eventData of newEvents) {
      switch (eventData.type) {
        case 'start':
          // Already started via startGenerationFlow()
          break;

        case 'llm_start':
          setOutput((prev) => prev + `Pearl is analyzing your prompt...\n`);
          break;

        case 'token':
          // Don't show tokens during generation
          break;

        case 'llm_complete':
          setOutput((prev) => {
            const lines = prev.split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
              if (
                lines[i] &&
                lines[i].includes('...') &&
                lines[i].toLowerCase().includes('analyzing')
              ) {
                lines[i] = '✅ Pearl analysis complete';
                return lines.join('\n');
              }
            }
            return lines.join('\n');
          });
          break;

        case 'tool_start': {
          let toolDesc = '';
          switch (eventData.data.tool) {
            case 'bubble-discovery':
              toolDesc = `${AI_NAME} is discovering available bubbles`;
              break;
            case 'template-generation':
              toolDesc = `${AI_NAME} is creating code template`;
              break;
            case 'get-bubble-details-tool': {
              const bubbleName = (
                eventData.data.input as
                  | { data: { bubbleName: string } }
                  | undefined
              )?.data?.bubbleName;
              toolDesc = `${AI_NAME} is understanding ${bubbleName || 'bubble'} capabilities`;
              break;
            }
            case 'bubbleflow-validation':
            case 'bubbleflow-validation-tool':
              toolDesc = `${AI_NAME} is validating generated code`;
              break;
            case 'validation-agent':
              toolDesc = `${AI_NAME} is refining code`;
              break;
            case 'summary-agent':
              toolDesc = `${AI_NAME} is generating summary`;
              break;
            default:
              toolDesc = `${AI_NAME} is using ${eventData.data.tool}`;
          }
          setOutput((prev) => prev + `${toolDesc}...\n`);
          break;
        }

        case 'tool_complete': {
          const duration = eventData.data.duration
            ? ` (${eventData.data.duration}ms)`
            : '';
          let completionMsg = '';
          let searchPattern = '';

          switch (eventData.data.tool) {
            case 'bubble-discovery':
              completionMsg = `✅ ${AI_NAME} discovered available bubbles${duration}`;
              searchPattern = 'discovering available bubbles';
              break;
            case 'template-generation':
              completionMsg = `✅ ${AI_NAME} created code template${duration}`;
              searchPattern = 'creating code template';
              break;
            case 'get-bubble-details-tool': {
              let bubbleName: string | undefined;
              const toolCompleteInput = eventData.data.input as
                | Record<string, unknown>
                | undefined;

              if (toolCompleteInput) {
                if (typeof toolCompleteInput.input === 'string') {
                  try {
                    const parsed = JSON.parse(
                      toolCompleteInput.input
                    ) as Record<string, unknown>;
                    bubbleName = parsed.bubbleName as string | undefined;
                  } catch {
                    // Ignore parse errors
                  }
                } else if (typeof toolCompleteInput.bubbleName === 'string') {
                  bubbleName = toolCompleteInput.bubbleName;
                }
              }

              completionMsg = `✅ ${AI_NAME} loaded ${bubbleName || 'bubble'} details${duration}`;
              searchPattern = 'understanding';
              break;
            }
            case 'bubbleflow-validation':
            case 'bubbleflow-validation-tool':
              completionMsg = `✅ ${AI_NAME} completed code validation${duration}`;
              searchPattern = 'validating generated code';
              break;
            case 'validation-agent':
              completionMsg = `✅ ${AI_NAME} refined code successfully${duration}`;
              searchPattern = 'refining code';
              break;
            case 'summary-agent':
              completionMsg = `✅ ${AI_NAME} generated summary${duration}`;
              searchPattern = 'generating summary';
              break;
            default:
              if (eventData.data.duration && eventData.data.duration > 1000) {
                completionMsg = `✅ ${AI_NAME} completed tool${duration}`;
                searchPattern = eventData.data.tool;
              }
          }

          if (completionMsg && searchPattern) {
            setOutput((prev) => {
              const lines = prev.split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                if (
                  lines[i] &&
                  lines[i].includes('...') &&
                  lines[i].toLowerCase().includes(searchPattern.toLowerCase())
                ) {
                  lines[i] = completionMsg;
                  return lines.join('\n');
                }
              }
              return prev + `${completionMsg}\n`;
            });
          }
          break;
        }

        case 'iteration_start':
          if (eventData.data.iteration > 1) {
            setOutput(
              (prev) =>
                prev +
                `${AI_NAME} is refining code (iteration ${eventData.data.iteration})...\n`
            );
          }
          break;

        case 'iteration_complete':
          if (eventData.data.iteration > 1) {
            setOutput((prev) => {
              const lines = prev.split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                if (
                  lines[i] &&
                  lines[i].includes('...') &&
                  lines[i].toLowerCase().includes('refining') &&
                  lines[i].includes(`iteration ${eventData.data.iteration}`)
                ) {
                  lines[i] =
                    `✅ ${AI_NAME} completed refinement iteration ${eventData.data.iteration}`;
                  return lines.join('\n');
                }
              }
              return (
                prev +
                `✅ ${AI_NAME} completed refinement iteration ${eventData.data.iteration}\n`
              );
            });
          }
          break;

        case 'generation_complete': {
          const generatedResult = eventData.data as GenerationResult;
          handleGenerationComplete(generatedResult);
          break;
        }

        case 'error':
          setOutput((prev) => prev + `\nError: ${eventData.data.error}\n`);
          break;

        case 'retry_attempt':
          setOutput(
            (prev) =>
              prev +
              `\n⚠️ Connection lost. Retrying (${eventData.data.attempt}/${eventData.data.maxRetries})...\n`
          );
          break;
      }
    }
  }, [events, generationParams]);

  // Handle errors from the query
  useEffect(() => {
    if (error && generationParams) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setOutput((prev) => prev + `\nGeneration Error: ${errorMessage}`);
      stopGenerationFlow();

      const template =
        generationParams.selectedPreset !== undefined
          ? getTemplateByIndex(generationParams.selectedPreset)
          : undefined;
      trackWorkflowGeneration({
        prompt: generationParams.prompt,
        templateId: template?.id,
        templateName: template?.name,
        generatedBubbleCount: 0,
        generatedCodeLength: 0,
        generationDuration: Date.now() - generationStartTimeRef.current,
        success: false,
        errorMessage: errorMessage,
      });

      setGenerationParams(null);
      setGenerationPrompt('');
    }
  }, [error, generationParams]);

  const handleGenerationComplete = async (
    generatedResult: GenerationResult
  ) => {
    if (!generationParams) return;

    try {
      if (!generatedResult.success || !generatedResult.generatedCode) {
        throw new Error(
          generatedResult.error ||
            'Pearl failed to generate the workflow. Please try again later.'
        );
      }

      setGenerationPrompt('');

      const template =
        generationParams.selectedPreset !== undefined
          ? getTemplateByIndex(generationParams.selectedPreset)
          : undefined;

      trackWorkflowGeneration({
        prompt: generationParams.prompt,
        templateId: template?.id,
        templateName: template?.name,
        generatedBubbleCount: generatedResult.bubbleCount ?? 0,
        generatedCodeLength: generatedResult.generatedCode.length,
        generatedCode: generatedResult.generatedCode,
        generationDuration: Date.now() - generationStartTimeRef.current,
        success: true,
      });

      const flowId = await createFlowFromGeneration(
        generatedResult.generatedCode,
        generationParams.prompt,
        true
      );

      if (!flowId) {
        throw new Error(
          `Pearl failed to create the flow because ${generatedResult.error}. Please try again later.`
        );
      }

      setGenerationResult({
        flowId: flowId,
        ...generatedResult,
      });
      stopGenerationFlow();
      setGenerationParams(null);
      processedEventCountRef.current = 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setOutput((prev) => prev + `\nGeneration Error: ${errorMessage}`);
      stopGenerationFlow();

      const template =
        generationParams.selectedPreset !== undefined
          ? getTemplateByIndex(generationParams.selectedPreset)
          : undefined;
      trackWorkflowGeneration({
        prompt: generationParams.prompt,
        templateId: template?.id,
        templateName: template?.name,
        generatedBubbleCount: 0,
        generatedCodeLength: 0,
        generationDuration: Date.now() - generationStartTimeRef.current,
        success: false,
        errorMessage: errorMessage,
      });

      setGenerationParams(null);
      setGenerationPrompt('');
    }
  };

  const createFlowFromGeneration = async (
    generatedCode?: string,
    prompt?: string,
    fromPearl: boolean = false
  ): Promise<number | null> => {
    const codeToUse = generatedCode;
    console.log('🚀 [createFlowFromGeneration] Starting flow creation...');

    if (!codeToUse || codeToUse.trim() === '') {
      console.error('❌ [createFlowFromGeneration] No code to create flow');
      setOutput((prev) => prev + '\n❌ No code to create flow');
      return null;
    }

    try {
      if (!fromPearl) {
        setOutput('Creating flow and preparing the visuals...');
      }

      // Create the BubbleFlow using the mutation hook
      // The mutation will optimistically update both the flow list and individual flow cache
      const createResult = await createBubbleFlowMutation.mutateAsync({
        name: getFlowNameFromCode(codeToUse),
        description: 'Created from prompt: ' + prompt,
        code: codeToUse,
        prompt: prompt || '',
        eventType: 'webhook/http',
        webhookActive: false,
      });

      console.log(
        '📥 [createFlowFromGeneration] Flow created successfully with ID:',
        createResult.id
      );

      const bubbleFlowId = createResult.id;
      const bubbleParameters = createResult.bubbleParameters || {};

      // Update current bubble parameters for visualization
      updateCurrentBubbleParameters(
        bubbleParameters as Record<string, ParsedBubbleWithInfo>
      );

      // Auto-select the newly created flow - this will now use the cached optimistic data
      selectFlow(bubbleFlowId);

      executionState.setAllCredentials({});
      executionState.setInputs({});

      // If we are not generating from prompt, no confirmation is needed
      if (!fromPearl) {
        console.log(
          '[createFlowFromGeneration] No generation result, navigating to flow IDE route'
        );
        navigate({
          to: '/flow/$flowId',
          params: { flowId: bubbleFlowId.toString() },
        });
        stopGenerationFlow();
        setOutput('');
      } else {
        // Refetch subscription to update token usage after generation
        refetchSubscriptionStatus();
      }

      // Return the flow ID for navigation
      return bubbleFlowId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '❌ [createFlowFromGeneration] Error creating flow:',
        error
      );
      console.error('❌ [createFlowFromGeneration] Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        error: error,
      });

      // Track flow creation failure with generated code
      trackWorkflowGeneration({
        prompt: prompt || '',
        generatedBubbleCount: 0,
        generatedCodeLength: codeToUse?.length || 0,
        generatedCode: codeToUse,
        success: false,
        errorMessage: `Flow creation failed: ${errorMessage}`,
      });

      setOutput((prev) => prev + `\n❌ Failed to create flow: ${errorMessage}`);
      return null;
    }
  };
  const generateCode = async (
    generationPrompt: string,
    selectedPreset?: number
  ) => {
    if (!generationPrompt || generationPrompt.trim() === '') {
      setOutput('Please enter a prompt for code generation');
      return;
    }
    startGenerationFlow();
    // Check if this is a preset template that should skip flow generation
    if (selectedPreset !== undefined && hasTemplate(selectedPreset)) {
      try {
        // Get template by index for backward compatibility
        const template = getTemplateByIndex(selectedPreset);
        const templateResult = template ? { code: template.code } : null;

        if (templateResult) {
          // Set generation info immediately
          setGenerationPrompt(generationPrompt.trim());
          // Create flow from template immediately
          await createFlowFromGeneration(
            templateResult.code,
            generationPrompt.trim()
          );

          // // Navigate to the flow IDE route after successful creation
          // if (flowId) {
          //   stopGenerationFlow();
          //   navigate({
          //     to: '/flow/$flowId',
          //     params: { flowId: flowId.toString() },
          //   });
          // }
          return;
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        setOutput(
          `Error loading template: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        stopGenerationFlow();
        return;
      }
    }

    // Set generation info immediately
    setGenerationPrompt(generationPrompt.trim());

    // Clear previous output before starting new generation
    setOutput('');

    // Track generation start time
    generationStartTimeRef.current = Date.now();

    // Reset processed event count for new generation
    processedEventCountRef.current = 0;

    // Trigger the streamedQuery by setting generation parameters
    // This will cause the useQuery to enable and start fetching
    setGenerationParams({
      prompt: generationPrompt.trim(),
      selectedPreset,
    });
  };
  return { generateCode };
};
