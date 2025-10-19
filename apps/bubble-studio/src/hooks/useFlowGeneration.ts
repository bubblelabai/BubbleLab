import { api } from '../lib/api';
import {
  getTemplateByIndex,
  hasTemplate,
} from '../components/templates/templateLoader';
import { toast } from 'react-toastify';
import { TokenUsage } from '@bubblelab/shared-schemas';
import { trackWorkflowGeneration } from '../services/analytics';

// Export the generateCode function for use in other components
export const useFlowGeneration = () => {
  const generateCode = async (
    generationPrompt: string,
    setIsStreaming: (streaming: boolean) => void,
    setOutput: (output: string | ((prev: string) => string)) => void,
    setGenerationInfo: (prompt: string) => void,
    setCurrentPage: (
      page: 'prompt' | 'ide' | 'credentials' | 'flow-summary'
    ) => void,
    setCode: (code: string) => void,
    setCurrentBubbleParameters: (params: Record<string, unknown>) => void,
    setSelectedFlow: (flowId: number) => void,
    setGenerationPrompt: (prompt: string) => void,
    onCreateFlowFromGeneration?: (
      generatedCode?: string,
      metadata?: { inputsSchema?: string; prompt?: string }
    ) => Promise<void>,
    selectedPreset?: number
  ) => {
    if (!generationPrompt || generationPrompt.trim() === '') {
      setOutput('Please enter a prompt for code generation');
      return;
    }

    // Check if this is a preset template that should skip flow generation
    if (selectedPreset !== undefined && hasTemplate(selectedPreset)) {
      try {
        // Get template by index for backward compatibility
        const template = getTemplateByIndex(selectedPreset);
        const templateResult = template ? { code: template.code } : null;

        if (templateResult) {
          // Set generation info immediately
          setGenerationInfo(generationPrompt.trim());

          // Navigate to IDE page immediately (no loading UI)
          setCurrentPage('ide');

          // Set the template code directly (no streaming, no loading messages)
          setCode(templateResult.code);

          // Create flow from template immediately
          if (onCreateFlowFromGeneration) {
            await onCreateFlowFromGeneration(templateResult.code, {
              prompt: generationPrompt.trim(),
            });
          }

          // No output messages, no streaming state - just go straight to the code
          return;
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        setOutput(
          `Error loading template: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        setIsStreaming(false);
        return;
      }
    }

    // Save the prompt before any async operations
    const savedPrompt = generationPrompt.trim();

    // Set generation info immediately
    setGenerationInfo(savedPrompt);

    // Clear previous output before starting new generation
    setOutput('');

    setIsStreaming(true);

    // Track generation start time
    const generationStartTime = Date.now();

    // Navigate to IDE page for generation process
    setCurrentPage('ide');

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

      let generatedResult: {
        generatedCode?: string;
        isValid?: boolean;
        success?: boolean;
        error?: string;
        bubbleParameters?: Record<string, unknown>;
        requiredCredentials?: Record<string, string[]>;
        inputsSchema?: string;
      } = {};

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const eventData = JSON.parse(line.slice(6));

              // Debug: Log all events to see what's happening
              console.log('SSE Event:', eventData.type, eventData);

              switch (eventData.type) {
                case 'start':
                  setIsStreaming(true);
                  break;

                case 'llm_start':
                  if (
                    eventData.data.message &&
                    !eventData.data.message.includes('undefined')
                  ) {
                    setOutput((prev) => prev + `AI analyzing...\n`);
                  }
                  break;

                case 'token':
                  // Don't show any tokens during code generation - too much noise
                  break;

                case 'llm_complete':
                  // Replace AI analyzing line with completion
                  setOutput((prev) => {
                    const lines = prev.split('\n');
                    for (let i = lines.length - 1; i >= 0; i--) {
                      if (lines[i] && lines[i].includes('🧠 AI analyzing')) {
                        lines[i] = 'AI analysis complete';
                        break;
                      }
                    }
                    return lines.join('\n');
                  });
                  break;

                case 'tool_start': {
                  // Simplify tool descriptions
                  let toolDesc = '';
                  switch (eventData.data.tool) {
                    case 'bubble-discovery':
                      toolDesc = 'Discovering available bubbles';
                      break;
                    case 'template-generation':
                      toolDesc = 'Creating code template';
                      break;
                    case 'get-bubble-details-tool': {
                      const bubbleName = eventData.data.input?.input
                        ? JSON.parse(eventData.data.input.input)?.bubbleName
                        : eventData.data.input?.bubbleName;
                      toolDesc = `Understanding ${bubbleName || 'bubble'} capabilities`;
                      break;
                    }
                    case 'bubbleflow-validation':
                      toolDesc = 'Validating generated code';
                      break;
                    default:
                      toolDesc = `Using ${eventData.data.tool}`;
                  }

                  // Show loading message
                  setOutput((prev) => prev + `${toolDesc}...\n`);
                  break;
                }

                case 'tool_complete': {
                  // Replace the loading line with completion
                  const duration = eventData.data.duration
                    ? ` (${eventData.data.duration}ms)`
                    : '';
                  let completionMsg = '';

                  switch (eventData.data.tool) {
                    case 'bubble-discovery':
                      completionMsg = `Discovered bubbles${duration}`;
                      break;
                    case 'template-generation':
                      completionMsg = `Template created${duration}`;
                      break;
                    case 'get-bubble-details-tool':
                      completionMsg = `Bubble details loaded${duration}`;
                      break;
                    case 'bubbleflow-validation':
                      completionMsg = `Code validation completed${duration}`;
                      break;
                    default:
                      if (
                        eventData.data.duration &&
                        eventData.data.duration > 1000
                      ) {
                        completionMsg = `Tool completed${duration}`;
                      }
                  }

                  if (completionMsg) {
                    setOutput((prev) => {
                      const lines = prev.split('\n');
                      // Find and replace the specific tool's loading line
                      for (let i = lines.length - 1; i >= 0; i--) {
                        if (
                          lines[i] &&
                          lines[i].includes('...') &&
                          (lines[i].includes('Discovering') ||
                            lines[i].includes('Creating') ||
                            lines[i].includes('Understanding') ||
                            lines[i].includes('Validating'))
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
                        `Refining code (step ${eventData.data.iteration})...\n`
                    );
                  }
                  break;

                case 'iteration_complete':
                  // Only show for later iterations
                  if (eventData.data.iteration > 1) {
                    setOutput(
                      (prev) =>
                        prev +
                        `Refinement step ${eventData.data.iteration} completed\n`
                    );
                  }
                  break;

                case 'generation_complete': {
                  // Final result with generated code
                  generatedResult = eventData.data;
                  const codeLength = eventData.data?.generatedCode?.length || 0;
                  const bubbleCount = eventData.data?.bubbleParameters
                    ? Object.keys(eventData.data.bubbleParameters).length
                    : 0;

                  // Store inputsSchema for later use
                  const inputsSchema = eventData.data?.inputsSchema || '';
                  generatedResult.inputsSchema = inputsSchema;

                  setOutput(
                    (prev) =>
                      prev +
                      `\nCode generated successfully! (${codeLength} chars, ${bubbleCount} bubbles)\n` +
                      (inputsSchema ? `Input Schema: Available\n` : '')
                  );
                  // Display token usage toast
                  const tokenUsage = eventData.data?.tokenUsage as TokenUsage;
                  if (tokenUsage) {
                    const totalTokens = tokenUsage.totalTokens || 0;
                    toast.info(
                      `🪙 Flow generation used ${totalTokens.toLocaleString()} tokens\n` +
                        `📥 Input: ${(tokenUsage.inputTokens || 0).toLocaleString()} tokens\n` +
                        `📤 Output: ${(tokenUsage.outputTokens || 0).toLocaleString()} tokens`,
                      {
                        autoClose: 10000,
                        style: {
                          whiteSpace: 'pre-line',
                          fontSize: '13px',
                        },
                      }
                    );
                  }
                  break;
                }

                case 'stream_complete':
                  setOutput((prev) => prev + `Finalizing results...\n`);
                  setIsStreaming(false);
                  break;

                case 'error':
                  setOutput((prev) => prev + `\nError: ${eventData.error}\n`);
                  setIsStreaming(false);
                  break;

                case 'complete':
                  setIsStreaming(false);
                  break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line, parseError);
            }
          }
        }
      }

      // Process the final result
      console.log('[DEBUG] Full generatedResult:', generatedResult);
      if (generatedResult.success && generatedResult.generatedCode) {
        // Set the generated code in the editor

        // Update bubble parameters for visualization
        if (generatedResult.bubbleParameters) {
          setCurrentBubbleParameters(generatedResult.bubbleParameters);
        }

        // Show summary without the actual code
        const bubbleCount = generatedResult.bubbleParameters
          ? Object.keys(generatedResult.bubbleParameters).length
          : 0;
        const validationStatus = generatedResult.isValid ? 'Valid' : 'Failed';

        let finalOutput = `\nGeneration Complete!\n`;
        finalOutput += `   Code: ${generatedResult.generatedCode.length} chars\n`;
        finalOutput += `   Bubbles: ${bubbleCount}\n`;
        finalOutput += `   Validation: ${validationStatus}\n`;

        if (!generatedResult.isValid && generatedResult.error) {
          finalOutput += `   Error: ${generatedResult.error}\n`;
        }

        finalOutput +=
          '\n✨ Code placed in editor! Flow diagram is now visible alongside the editor.';
        setOutput((prev) => prev + finalOutput);

        // Store inputsSchema and prompt for later use when creating flows
        // Use a temporary flowSummaryData entry to hold this information
        console.log('[DEBUG] Setting flowSummaryData:', {
          inputsSchema: generatedResult.inputsSchema,
          prompt: savedPrompt,
        });

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
          generatedBubbleCount: bubbleCount,
          generatedCodeLength: generatedResult.generatedCode.length,
          generationDuration: Date.now() - generationStartTime,
          success: true,
        });

        // Auto-create the flow after successful code generation
        if (onCreateFlowFromGeneration) {
          await onCreateFlowFromGeneration(generatedResult.generatedCode, {
            inputsSchema: generatedResult.inputsSchema || '',
            prompt: savedPrompt,
          });
        }
      } else if (generatedResult.error) {
        throw new Error(generatedResult.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setOutput((prev) => prev + `\nGeneration Error: ${errorMessage}`);

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
      setIsStreaming(false);
      setGenerationInfo('');
    }
  };

  return { generateCode };
};
