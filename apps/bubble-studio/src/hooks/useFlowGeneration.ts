import { api } from '@/lib/api';
import {
  getTemplateByIndex,
  hasTemplate,
} from '@/components/templates/templateLoader';
import {
  TokenUsage,
  StreamingEvent,
  GenerationResult,
} from '@bubblelab/shared-schemas';
import { trackWorkflowGeneration } from '@/services/analytics';

// Extended type for generation streaming events (includes standard StreamingEvent + generation-specific events)
type GenerationStreamingEvent =
  | StreamingEvent
  | {
      type: 'generation_complete';
      data: {
        generatedCode?: string;
        bubbleParameters?: Record<string, unknown>;
        tokenUsage?: TokenUsage;
        inputsSchema?: string;
        isValid?: boolean;
        success?: boolean;
        error?: string;
      };
    }
  | { type: 'stream_complete'; data: Record<string, unknown> };
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

    // Save the prompt before any async operations
    const savedPrompt = generationPrompt.trim();

    // Set generation info immediately
    setGenerationPrompt(savedPrompt);

    // Clear previous output before starting new generation
    setOutput('');

    // Track generation start time
    const generationStartTime = Date.now();

    // Variables to capture summary and inputsSchema - using generatedResult instead of local variables

    try {
      // Use streaming API client for Server-Sent Events
      const response = await api.postStream('/bubble-flow/generate', {
        prompt: generationPrompt.trim(),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let generatedResult: GenerationResult | undefined = undefined;

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(
                line.slice(6)
              ) as GenerationStreamingEvent;

              // Debug: Log all events to see what's happening
              console.log('SSE Event:', eventData.type, eventData);

              switch (eventData.type) {
                case 'start':
                  // Already started via startGenerationFlow() above
                  break;

                case 'llm_start':
                  setOutput(
                    (prev) => prev + `Pearl is analyzing your prompt...\n`
                  );
                  break;

                case 'token':
                  // Don't show any tokens during code generation - too much noise
                  break;

                case 'llm_complete':
                  // Replace Pearl analyzing line with completion
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
                  // Extract and display tool descriptions with arguments
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
                      )?.data.bubbleName;
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

                  // Show loading message with tool details
                  setOutput((prev) => prev + `${toolDesc}...\n`);
                  break;
                }

                case 'tool_complete': {
                  // Replace the loading line with completion
                  const duration = eventData.data.duration
                    ? ` (${eventData.data.duration}ms)`
                    : '';
                  let completionMsg = '';
                  let searchPattern = ''; // Pattern to find the loading line to replace

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
                      // Extract bubble name from input
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
                            bubbleName = parsed.bubbleName as
                              | string
                              | undefined;
                          } catch {
                            // Ignore parse errors
                          }
                        } else if (
                          typeof toolCompleteInput.bubbleName === 'string'
                        ) {
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
                      if (
                        eventData.data.duration &&
                        eventData.data.duration > 1000
                      ) {
                        completionMsg = `✅ ${AI_NAME} completed tool${duration}`;
                        searchPattern = eventData.data.tool;
                      }
                  }

                  if (completionMsg && searchPattern) {
                    setOutput((prev) => {
                      const lines = prev.split('\n');
                      // Find and replace the specific tool's loading line
                      for (let i = lines.length - 1; i >= 0; i--) {
                        if (
                          lines[i] &&
                          lines[i].includes('...') &&
                          lines[i]
                            .toLowerCase()
                            .includes(searchPattern.toLowerCase())
                        ) {
                          lines[i] = completionMsg;
                          return lines.join('\n');
                        }
                      }
                      // If no matching line found, append instead
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
                  console.log(
                    '🔍 iteration_complete event received:',
                    eventData.data
                  );
                  // Replace refinement loading line with completion
                  if (eventData.data.iteration > 1) {
                    setOutput((prev) => {
                      const lines = prev.split('\n');
                      for (let i = lines.length - 1; i >= 0; i--) {
                        if (
                          lines[i] &&
                          lines[i].includes('...') &&
                          lines[i].toLowerCase().includes('refining') &&
                          lines[i].includes(
                            `iteration ${eventData.data.iteration}`
                          )
                        ) {
                          lines[i] =
                            `✅ ${AI_NAME} completed refinement iteration ${eventData.data.iteration}`;
                          return lines.join('\n');
                        }
                      }
                      // If no matching line found, append instead
                      return (
                        prev +
                        `✅ ${AI_NAME} completed refinement iteration ${eventData.data.iteration}\n`
                      );
                    });
                  }
                  break;

                case 'generation_complete': {
                  // Final result with generated code
                  generatedResult = eventData.data as GenerationResult;
                  break;
                }

                case 'error':
                  setOutput(
                    (prev) => prev + `\nError: ${eventData.data.error}\n`
                  );
                  break;

                case 'complete':
                  break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line, parseError);
            }
          }
        }
      }

      // Process the final result
      if (!generatedResult) {
        throw new Error(
          'Pearl could not process your request at the moment. Please try again later.'
        );
      }
      console.log('[DEBUG] Full generatedResult:', generatedResult);
      if (generatedResult.success && generatedResult.generatedCode) {
        // Set the generated code in the editor
        // Clear the generation prompt
        setGenerationPrompt('');

        // Track successful workflow generation
        const template =
          selectedPreset !== undefined
            ? getTemplateByIndex(selectedPreset)
            : undefined;

        trackWorkflowGeneration({
          prompt: savedPrompt,
          templateId: template?.id,
          templateName: template?.name,
          generatedBubbleCount: generatedResult.bubblesUsed.length,
          generatedCodeLength: generatedResult.generatedCode.length,
          generatedCode: generatedResult.generatedCode,
          generationDuration: Date.now() - generationStartTime,
          success: true,
        });

        // Auto-create the flow after successful code generation
        const flowId = await createFlowFromGeneration(
          generatedResult.generatedCode,
          savedPrompt,
          true
        );

        // Store generation result for display in overlay (don't navigate yet)
        if (!flowId) {
          throw new Error(
            `Pearl failed to create the flow because ${generatedResult.error}. Please try again later.`
          );
        }

        // Now set the COMPLETE result with all required fields
        setGenerationResult({
          flowId: flowId,
          ...generatedResult,
        });
        stopGenerationFlow();
      } else {
        throw new Error(
          generatedResult?.error ||
            'Pearl failed to generate the workflow. Please try again later.'
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setOutput((prev) => prev + `\nGeneration Error: ${errorMessage}`);
      stopGenerationFlow();

      // Track failed workflow generation
      const template =
        selectedPreset !== undefined
          ? getTemplateByIndex(selectedPreset)
          : undefined;
      trackWorkflowGeneration({
        prompt: savedPrompt,
        templateId: template?.id,
        templateName: template?.name,
        generatedBubbleCount: 0,
        generatedCodeLength: 0,
        generationDuration: Date.now() - generationStartTime,
        success: false,
        errorMessage: errorMessage,
      });
    } finally {
      // Always clear streaming state and generation info
      setGenerationPrompt('');
    }
  };
  return { generateCode };
};
