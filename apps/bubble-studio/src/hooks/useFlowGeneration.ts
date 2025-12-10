import {
  getTemplateByIndex,
  hasTemplate,
} from '@/components/templates/templateLoader';
import { trackWorkflowGeneration } from '@/services/analytics';
import { useState, useRef } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { getFlowNameFromCode } from '@/utils/codeParser';
import { useCreateBubbleFlow } from '@/hooks/useCreateBubbleFlow';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useUIStore } from '@/stores/uiStore';
import { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { useExecutionStore } from '@/stores/executionStore';
import { useNavigate } from '@tanstack/react-router';

// Export the generateCode function for use in other components
export const useFlowGeneration = () => {
  const navigate = useNavigate();
  const { setOutput } = useOutputStore();
  const { selectedFlowId: currentFlowId, selectFlow } = useUIStore();
  const { startGenerationFlow, stopGenerationFlow, setGenerationPrompt } =
    useGenerationStore();

  // Two mutation hooks: one for empty flows (AI generation), one for regular flows (templates/with code)
  const createEmptyFlowMutation = useCreateBubbleFlow({ isEmpty: true });
  const createRegularFlowMutation = useCreateBubbleFlow(); // Regular flow with code
  const executionState = useExecutionStore(currentFlowId);
  const { updateBubbleParameters: updateCurrentBubbleParameters } =
    useBubbleFlow(currentFlowId);
  // State for managing generation
  const [generationParams, setGenerationParams] = useState<{
    prompt: string;
    selectedPreset?: number;
    flowId?: number; // Track the flow ID for streaming generation
  } | null>(null);
  const generationStartTimeRef = useRef<number>(0);
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
        setGenerationPrompt('');
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
