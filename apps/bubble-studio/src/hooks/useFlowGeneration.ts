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
import { useQueryClient } from '@tanstack/react-query';

// AI Assistant name for user-facing messages
const AI_NAME = 'Pearl';

// Export the generateCode function for use in other components
export const useFlowGeneration = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setOutput } = useOutputStore();
  const { selectedFlowId: currentFlowId, selectFlow } = useUIStore();
  const {
    startGenerationFlow,
    stopGenerationFlow,
    setGenerationPrompt,
    setGenerationResult,
  } = useGenerationStore();

  // Two mutation hooks: one for empty flows (AI generation), one for regular flows (templates/with code)
  const createEmptyFlowMutation = useCreateBubbleFlow({ isEmpty: true });
  const createRegularFlowMutation = useCreateBubbleFlow(); // Regular flow with code
  const executionState = useExecutionStore(currentFlowId);
  const { updateBubbleParameters: updateCurrentBubbleParameters } =
    useBubbleFlow(currentFlowId);
  const { refetch: refetchSubscriptionStatus } = useSubscription();
  // State for managing generation
  const [generationParams, setGenerationParams] = useState<{
    prompt: string;
    selectedPreset?: number;
    flowId?: number; // Track the flow ID for streaming generation
  } | null>(null);
  const generationStartTimeRef = useRef<number>(0);
  const processedEventCountRef = useRef<number>(0);

  // Use streamedQuery for code generation with flowId
  const { data: events = [], error } = useQuery({
    ...createGenerateCodeQuery({
      prompt: generationParams?.prompt || '',
      flowId: generationParams?.flowId,
    }),
    enabled:
      !!generationParams &&
      !!generationParams.flowId && // Only enable if we have a flowId
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

      // Flow is already created with the flowId in generationParams
      // The backend has already updated the flow with the generated code
      // We just need to mark generation as complete
      const flowId = generationParams.flowId;

      if (!flowId) {
        throw new Error(
          `No flow ID found. Generation completed but flow was not created.`
        );
      }

      setGenerationResult({
        flowId: flowId,
        ...generatedResult,
      });
      stopGenerationFlow();
      setGenerationParams(null);
      processedEventCountRef.current = 0;

      // Invalidate flow query to refetch updated flow with generated code
      await queryClient.invalidateQueries({
        queryKey: ['bubbleFlow', flowId],
      });

      // Also invalidate flow list
      await queryClient.invalidateQueries({
        queryKey: ['bubbleFlowList'],
      });

      // Refetch subscription to update token usage after generation
      refetchSubscriptionStatus();
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
    // Determine if we're creating an empty flow or a regular flow with code
    const hasCode = generatedCode && generatedCode.trim() !== '';

    console.log(
      `🚀 [createFlowFromGeneration] Starting ${hasCode ? 'regular' : 'empty'} flow creation...`
    );

    try {
      if (!fromPearl) {
        setOutput('Creating flow and preparing the visuals...');
      }

      let createResult;

      if (hasCode) {
        // Create a regular flow WITH code (for templates)
        createResult = await createRegularFlowMutation.mutateAsync({
          name: getFlowNameFromCode(generatedCode),
          description: 'Created from prompt: ' + (prompt || ''),
          code: generatedCode,
          prompt: prompt || '',
          eventType: 'webhook/http',
          webhookActive: false,
        });
      } else {
        // Create an EMPTY flow (for AI generation)
        createResult = await createEmptyFlowMutation.mutateAsync({
          name: 'New Flow',
          description: 'Created from prompt: ' + (prompt || ''),
          prompt: prompt || '',
          eventType: 'webhook/http',
          webhookActive: false,
        });
      }

      console.log(
        `📥 [createFlowFromGeneration] ${hasCode ? 'Regular' : 'Empty'} flow created successfully with ID:`,
        createResult.id
      );

      const bubbleFlowId = createResult.id;

      // Auto-select the newly created flow
      selectFlow(bubbleFlowId);

      // Navigate to the flow page
      console.log('[createFlowFromGeneration] Navigating to flow IDE route');
      navigate({
        to: '/flow/$flowId',
        params: { flowId: bubbleFlowId.toString() },
      });

      if (hasCode) {
        // For flows with code (templates), just stop generation and show the flow
        const bubbleParameters = createResult.bubbleParameters || {};
        updateCurrentBubbleParameters(
          bubbleParameters as Record<string, ParsedBubbleWithInfo>
        );
        executionState.setAllCredentials({});
        executionState.setInputs({});
        stopGenerationFlow();
        setOutput('');
      } else {
        // For empty flows (AI generation), stop the overlay and trigger generation stream
        stopGenerationFlow();

        if (fromPearl && prompt) {
          console.log(
            '[createFlowFromGeneration] Triggering generation stream for flow',
            bubbleFlowId
          );
          // Update generation params to include flowId, which will trigger the streaming query
          setGenerationParams({
            prompt: prompt,
            flowId: bubbleFlowId,
            selectedPreset: generationParams?.selectedPreset,
          });
        } else {
          setOutput('');
        }
      }

      // Return the flow ID
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

      // Track flow creation failure
      trackWorkflowGeneration({
        prompt: prompt || '',
        generatedBubbleCount: 0,
        generatedCodeLength: 0,
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

    // For AI generation: Create empty flow first, then trigger generation
    console.log('[generateCode] Creating empty flow and triggering generation');
    await createFlowFromGeneration(
      undefined, // No code yet - creating empty flow
      generationPrompt.trim(),
      true // fromPearl = true to trigger generation stream
    );
  };
  return { generateCode };
};
