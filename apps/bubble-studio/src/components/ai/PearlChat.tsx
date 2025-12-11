/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 *
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEditor } from '../../hooks/useEditor';
import { useUIStore } from '../../stores/uiStore';
import { usePearlChatStore } from '../../hooks/usePearlChatStore';
import type { DisplayEvent } from '../../stores/pearlChatStore';
import { getPearlChatStore } from '../../stores/pearlChatStore';
import { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { toast } from 'react-toastify';
import {
  trackAIAssistant,
  trackWorkflowGeneration,
} from '../../services/analytics';
import {
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  Paperclip,
  X,
  MessageSquare,
  Calendar,
  Webhook,
  HelpCircle,
  FileInput,
  Settings,
  Code,
} from 'lucide-react';
import { useValidateCode } from '../../hooks/useValidateCode';
import { useExecutionStore } from '../../stores/executionStore';
import {
  MAX_BYTES,
  bytesToMB,
  isAllowedType,
  isTextLike,
  readTextFile,
  compressPngToBase64,
} from '../../utils/fileUtils';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import { useBubbleDetail } from '../../hooks/useBubbleDetail';
import { CodeDiffView } from './CodeDiffView';
import { BubbleText } from './BubbleText';
import { MarkdownWithBubbles } from './MarkdownWithBubbles';
import {
  BubblePromptInput,
  type BubblePromptInputRef,
} from './BubblePromptInput';
import { ClarificationWidget } from './ClarificationWidget';
import { PlanApprovalWidget } from './PlanApprovalWidget';
import { hasBubbleTags } from '../../utils/bubbleTagParser';
import { useEditorStore } from '../../stores/editorStore';
import {
  useGenerateInitialFlow,
  startBuildingPhase,
  submitClarificationAndContinue,
} from '../../hooks/usePearl';
import {
  useGenerationEventsStore,
  selectFlowEvents,
} from '../../stores/generationEventsStore';
import type { ChatMessage } from './type';
import { playGenerationCompleteSound } from '../../utils/soundUtils';

export function PearlChat() {
  // UI-only state (non-shared)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [updatedMessageIds, setUpdatedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [generationSteps, setGenerationSteps] = useState<
    Array<{
      type: 'tool_start' | 'tool_complete' | 'generation_complete' | 'error';
      message: string;
      duration?: number;
      summary?: string;
    }>
  >([]);
  const processedEventCountRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<BubblePromptInputRef>(null);
  const { closeSidePanel } = useUIStore();
  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });
  const { editor } = useEditor();
  const pendingCredentials = useExecutionStore(
    selectedFlowId,
    (state) => state.pendingCredentials
  );
  const { data: flowData } = useBubbleFlow(selectedFlowId);
  const bubbleDetail = useBubbleDetail(selectedFlowId);

  // Pearl store hook - subscribes to state and provides generation API
  const pearl = usePearlChatStore(selectedFlowId);
  const queryClient = useQueryClient();

  // Check if this is an initial generation (flow has prompt but no code)
  const isGenerating =
    (!flowData?.code || flowData.code.trim() === '') &&
    !flowData?.generationError &&
    !!flowData?.prompt;

  // Only enable query if we have all required data and are in generating state
  const shouldEnableGeneration = Boolean(
    selectedFlowId && flowData?.prompt && isGenerating
  );

  // Subscribe directly to generation events store for real-time updates
  // This ensures we get events even if the component was unmounted during streaming
  const storeEvents = useGenerationEventsStore(
    selectFlowEvents(selectedFlowId)
  );
  useGenerateInitialFlow({
    prompt: flowData?.prompt || '',
    flowId: selectedFlowId ?? undefined,
    enabled: shouldEnableGeneration,
  });

  // Use events from store (primary source of truth)
  const generationEvents = storeEvents;

  // Track if we've initialized the generation conversation
  const hasInitializedGenerationRef = useRef(false);

  // Auto-open Pearl panel and add user prompt message when generation starts
  useEffect(() => {
    if (
      isGenerating &&
      flowData?.prompt &&
      selectedFlowId &&
      !hasInitializedGenerationRef.current
    ) {
      useUIStore.getState().openConsolidatedPanelWith('pearl');

      // Add user's prompt as the first message
      const pearlStore = getPearlChatStore(selectedFlowId);
      const storeState = pearlStore.getState();

      // Only add if there are no messages yet
      if (storeState.messages.length === 0) {
        const userMessage: ChatMessage = {
          id: `gen-user-${Date.now()}`,
          type: 'user',
          content: flowData.prompt,
          timestamp: new Date(),
        };

        storeState.addMessage(userMessage);
        hasInitializedGenerationRef.current = true;
      }
    }
  }, [isGenerating, flowData?.prompt, selectedFlowId]);

  // Reset the initialization ref when flow changes
  useEffect(() => {
    hasInitializedGenerationRef.current = false;
    processedEventCountRef.current = 0;
    setGenerationSteps([]);

    // Note: We don't reset the events store here because we want to preserve
    // events if the user navigates away and back during generation
  }, [selectedFlowId]);

  // Process generation events as they stream in
  useEffect(() => {
    if (!isGenerating || generationEvents.length === 0) return;

    const newEvents = generationEvents.slice(processedEventCountRef.current);
    if (newEvents.length === 0) return;

    processedEventCountRef.current = generationEvents.length;

    for (const eventData of newEvents) {
      switch (eventData.type) {
        case 'llm_start':
          // Skip - don't show "analyzing your prompt" message
          break;

        case 'tool_start': {
          const tool = eventData.data.tool;
          let toolDesc = '';
          switch (tool) {
            case 'bubble-discovery':
              toolDesc = 'Pearl is discovering available bubbles';
              break;
            case 'template-generation':
              toolDesc = 'Pearl is creating code template';
              break;
            case 'bubbleflow-validation':
            case 'bubbleflow-validation-tool':
              toolDesc = 'Pearl is validating generated code';
              break;
            default:
              toolDesc = `Pearl is using ${tool}`;
          }
          setGenerationSteps((prev) => [
            ...prev,
            { type: 'tool_start', message: toolDesc },
          ]);
          break;
        }

        case 'tool_complete': {
          const duration = eventData.data.duration;
          setGenerationSteps((prev) => [
            ...prev,
            { type: 'tool_complete', message: 'Complete', duration },
          ]);
          break;
        }

        case 'generation_complete': {
          // Play completion sound
          playGenerationCompleteSound();

          // Get summary from generation result
          const summary =
            eventData.data?.summary || 'Workflow generated successfully';
          setGenerationSteps((prev) => [
            ...prev,
            {
              type: 'generation_complete',
              message: 'Code generation complete!',
              summary,
            },
          ]);

          console.log(
            '🔄 [generation_complete] Updating editor and refetching flow',
            selectedFlowId
          );

          // Update Monaco editor with generated code
          const generatedCode = eventData.data?.generatedCode;
          if (generatedCode) {
            const { editorInstance, setPendingCode } =
              useEditorStore.getState();
            if (editorInstance) {
              const model = editorInstance.getModel();
              if (model) {
                model.setValue(generatedCode);
                console.log('[PearlChat] Editor updated with generated code');
              } else {
                setPendingCode(generatedCode);
              }
            } else {
              setPendingCode(generatedCode);
            }
          }

          // Add Pearl's response to the conversation
          // User message was already added when generation started
          if (selectedFlowId) {
            const pearlStore = getPearlChatStore(selectedFlowId);
            const storeState = pearlStore.getState();

            const assistantMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              type: 'assistant',
              content: `I've generated your workflow:\n\n${summary}`,
              resultType: 'answer',
              timestamp: new Date(),
            };

            // Add assistant message to Pearl store
            storeState.addMessage(assistantMessage);
          }

          // Refetch flow to sync with backend
          queryClient.refetchQueries({
            queryKey: ['bubbleFlow', selectedFlowId],
          });
          queryClient.refetchQueries({
            queryKey: ['bubbleFlowList'],
          });
          queryClient.refetchQueries({
            queryKey: ['subscription'],
          });
          trackWorkflowGeneration({
            prompt: flowData?.prompt || '',
            generatedCode: generatedCode,
            generatedCodeLength: generatedCode?.length || 0,
            generatedBubbleCount: Object.keys(
              eventData.data?.bubbleParameters || {}
            ).length,
            success: true,
            errorMessage: eventData.data?.error || '',
          });
          break;
        }

        case 'error':
          setGenerationSteps((prev) => [
            ...prev,
            { type: 'error', message: eventData.data.error },
          ]);
          trackWorkflowGeneration({
            prompt: flowData?.prompt || '',
            generatedCodeLength: 0,
            generatedBubbleCount: 0,
            success: false,
            errorMessage: eventData.data?.error || '',
          });
          break;
      }
    }
  }, [generationEvents, isGenerating, selectedFlowId, queryClient]);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pearl.messages, pearl.eventsList, pearl.isPending, generationSteps]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const newFiles: Array<{ name: string; content: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!isAllowedType(file)) {
        setUploadError(
          `Unsupported file type: ${file.name}. Allowed: html, csv, txt, png`
        );
        continue;
      }

      try {
        if (isTextLike(file)) {
          if (file.size > MAX_BYTES) {
            setUploadError(
              `File too large: ${file.name}. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
            );
            continue;
          }
          const text = await readTextFile(file);
          newFiles.push({ name: file.name, content: text });
        } else {
          // PNG path: compress client-side, convert to base64 (no data URL prefix)
          const base64 = await compressPngToBase64(file);
          const approxBytes = Math.floor((base64.length * 3) / 4);
          if (approxBytes > MAX_BYTES) {
            setUploadError(
              `Image too large after compression: ${file.name}. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
            );
            continue;
          }
          newFiles.push({ name: file.name, content: base64 });
        }
      } catch {
        setUploadError(`Failed to read or process file: ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDeleteFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (!pearl.prompt.trim() && uploadedFiles.length === 0) {
      return;
    }

    // Use regular generation for Pearl chat (Coffee is handled via useGenerateInitialFlow)
    pearl.startGeneration(pearl.prompt, uploadedFiles);

    // Clear UI state
    setUploadedFiles([]);
  };

  // Handlers for initial generation Coffee flow (different from Pearl chat)
  const handleInitialClarificationSubmit = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!selectedFlowId || !flowData?.prompt) return;
      await submitClarificationAndContinue(
        selectedFlowId,
        flowData.prompt,
        answers
      );
    },
    [selectedFlowId, flowData?.prompt]
  );

  const handleInitialPlanApprove = useCallback(async () => {
    if (!selectedFlowId || !flowData?.prompt || !pearl.coffeePlan) return;

    // Build plan context string for Boba
    const planContext = [
      `Summary: ${pearl.coffeePlan.summary}`,
      'Steps:',
      ...pearl.coffeePlan.steps.map(
        (step, i) =>
          `${i + 1}. ${step.title}: ${step.description}${step.bubblesUsed ? ` (Using: ${step.bubblesUsed.join(', ')})` : ''}`
      ),
      `Bubbles to use: ${pearl.coffeePlan.estimatedBubbles.join(', ')}`,
    ].join('\n');

    await startBuildingPhase(
      selectedFlowId,
      flowData.prompt,
      planContext,
      pearl.coffeeAnswers
    );
  }, [selectedFlowId, flowData?.prompt, pearl.coffeePlan, pearl.coffeeAnswers]);

  const handleInitialPlanSkip = useCallback(async () => {
    if (!selectedFlowId || !flowData?.prompt) return;

    // Skip planning and go straight to building
    await startBuildingPhase(selectedFlowId, flowData.prompt);
  }, [selectedFlowId, flowData?.prompt]);

  const handleInitialPlanRetry = useCallback(async () => {
    if (!selectedFlowId || !flowData?.prompt) return;

    // Clear current plan and restart planning
    const pearlStore = getPearlChatStore(selectedFlowId);
    pearlStore.getState().setCoffeePlan(null);
    pearlStore.getState().setCoffeeQuestions(null);
    pearlStore.getState().setCoffeePhase('clarifying');

    // Restart the planning stream (this is simplified - full implementation would need to reset the generation store)
    await submitClarificationAndContinue(selectedFlowId, flowData.prompt, {});
  }, [selectedFlowId, flowData?.prompt]);

  const handleReplace = (
    code: string,
    messageId: string,
    bubbleParameters?: Record<string, ParsedBubbleWithInfo>
  ) => {
    editor.replaceAllContent(code);
    trackAIAssistant({ action: 'accept_response', message: code || '' });

    // Mark message as updated
    setUpdatedMessageIds((prev) => new Set(prev).add(messageId));

    // Update all workflow data from Pearl response
    if (bubbleParameters) {
      validateCodeMutation.mutateAsync({
        code: code,
        flowId: selectedFlowId!,
        credentials: pendingCredentials,
        syncInputsWithFlow: true,
      });
      toast.success('Workflow updated successfully');
    } else {
      toast.error('No bubble parameters found');
    }
    closeSidePanel();
  };

  // Generate contextual suggestions based on trigger type and selected bubble context
  const getQuickStartSuggestions = (): {
    mainActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }>;
    transformationActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }>;
    stepActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }>;
    bubbleActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }>;
  } => {
    const triggerType = flowData?.eventType;

    // Main actions that are always shown
    const baseSuggestions = [
      {
        label: 'How to run this flow?',
        prompt: 'How do I run this flow?',
        icon: <HelpCircle className="w-4 h-4" />,
        description:
          'Learn how to run and provide the right inputs to the flow',
      },
    ];

    // Add trigger-specific conversion suggestions
    let conversionSuggestions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }> = [];

    if (triggerType === 'webhook/http') {
      conversionSuggestions = [
        {
          label: 'Convert to schedule',
          prompt: 'Help me convert this flow to run on a schedule',
          icon: <Calendar className="w-4 h-4" />,
          description: 'Run automatically at specific times',
        },
      ];
    } else if (triggerType === 'schedule/cron') {
      conversionSuggestions = [
        {
          label: 'Convert to webhook',
          prompt: 'Help me convert this flow to be triggered by a webhook',
          icon: <Webhook className="w-4 h-4" />,
          description: 'Trigger via HTTP requests',
        },
      ];
    } else if (
      triggerType?.startsWith('slack/') ||
      triggerType?.startsWith('gmail/')
    ) {
      conversionSuggestions = [
        {
          label: 'Convert to webhook',
          prompt: 'Help me convert this flow to be triggered by a webhook',
          icon: <Webhook className="w-4 h-4" />,
          description: 'Trigger via HTTP requests',
        },
        {
          label: 'Convert to schedule',
          prompt: 'Help me convert this flow to run on a schedule',
          icon: <Calendar className="w-4 h-4" />,
          description: 'Run automatically at specific times',
        },
      ];
    } else {
      // Default suggestions for unknown/unset trigger types
      conversionSuggestions = [
        {
          label: 'Convert to webhook',
          prompt: 'Help me convert this flow to be triggered by a webhook',
          icon: <Webhook className="w-4 h-4" />,
          description: 'Trigger via HTTP requests',
        },
        {
          label: 'Convert to schedule',
          prompt: 'Help me convert this flow to run on a schedule',
          icon: <Calendar className="w-4 h-4" />,
          description: 'Run automatically at specific times',
        },
      ];
    }

    // Build transformation-specific actions if a transformation is selected
    const transformationActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }> = [];

    if (pearl.selectedTransformationContext) {
      transformationActions.push(
        {
          label: `Describe what ${pearl.selectedTransformationContext} does`,
          prompt: `Describe what this transformation function does`,
          icon: <FileInput className="w-4 h-4" />,
          description: `Explain the purpose and behavior of ${pearl.selectedTransformationContext}`,
        },
        {
          label: `Modify ${pearl.selectedTransformationContext}`,
          prompt: `Modify this transformation function`,
          icon: <Code className="w-4 h-4" />,
          description: `Change the implementation of ${pearl.selectedTransformationContext}`,
        }
      );
    }

    // Build step-specific actions if a step is selected
    const stepActions: Array<{
      label: string;
      prompt: string;
      icon: React.ReactNode;
      description: string;
    }> = [];

    if (pearl.selectedStepContext) {
      stepActions.push(
        {
          label: `Describe what ${pearl.selectedStepContext} does`,
          prompt: `Describe what this step does`,
          icon: <FileInput className="w-4 h-4" />,
          description: `Explain the purpose and behavior of ${pearl.selectedStepContext}`,
        },
        {
          label: `Modify ${pearl.selectedStepContext}`,
          prompt: `Modify this step`,
          icon: <Code className="w-4 h-4" />,
          description: `Change the implementation of ${pearl.selectedStepContext}`,
        }
      );
    }

    // Combine main actions: base suggestions and conversion suggestions
    const mainActions = [...baseSuggestions, ...conversionSuggestions];

    // Use selected bubble context to generate bubble-specific actions
    const bubbleActions = pearl.selectedBubbleContext
      .map((variableId) => {
        const bubbleInfo = bubbleDetail.getBubbleInfo(variableId);

        // If bubble not found, assume it's an input node
        let variableName: string;
        let nodeIcon: React.ReactNode;

        if (!bubbleInfo) {
          // Determine if it's a cron schedule node or input schema node
          if (triggerType === 'schedule/cron') {
            variableName = 'Cron Schedule';
            nodeIcon = <Calendar className="w-4 h-4" />;
          } else {
            variableName = 'Input Schema';
            nodeIcon = <FileInput className="w-4 h-4" />;
          }
        } else {
          variableName = bubbleInfo.variableName;
          nodeIcon = <AlertCircle className="w-4 h-4" />;
        }

        return [
          {
            label: `Delete ${variableName}`,
            prompt: `Delete this bubble from my workflow`,
            icon: <X className="w-4 h-4" />,
            description: `Remove ${variableName} from the workflow`,
          },
          {
            label: `Modify ${variableName}`,
            prompt: `Modify the parameters of this bubble`,
            icon: nodeIcon,
            description: `Change settings for ${variableName}`,
          },
          {
            label: `Tell me more about the configurations of ${variableName}`,
            prompt: `Tell me more about the configurations of this bubble`,
            icon: <Settings className="w-4 h-4" />,
            description: `Learn about the configuration options for ${variableName}`,
          },
        ];
      })
      .flat();

    return {
      mainActions,
      transformationActions,
      stepActions,
      bubbleActions,
    };
  };

  const handleSuggestionClick = (suggestion: string) => {
    pearl.setPrompt(suggestion + ' ');
    // Focus the input and position cursor at the end after state update
    setTimeout(() => {
      promptInputRef.current?.focusEnd();
    }, 0);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3 min-h-0">
        {pearl.messages.length === 0 && !pearl.isPending && !isGenerating && (
          <div className="flex flex-col items-center px-4 py-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <img
                src="/pearl.png"
                alt="Pearl"
                className="w-12 h-12 mb-3 mx-auto"
              />
              <h3 className="text-base font-medium text-gray-200 mb-1">
                Chat with Pearl
              </h3>
            </div>

            {/* Quick Start Suggestions */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 px-1">
                Quick Actions
              </div>
              {(() => {
                const {
                  mainActions,
                  transformationActions,
                  stepActions,
                  bubbleActions,
                } = getQuickStartSuggestions();
                return (
                  <>
                    {/* Main Actions */}
                    {mainActions.map((suggestion, index) => (
                      <button
                        key={`main-${index}`}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion.prompt)}
                        className="group w-full px-4 py-3.5 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-300 transition-colors">
                            {suggestion.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-0.5">
                              {suggestion.label}
                            </div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                              {suggestion.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Transformation Specific Actions */}
                    {transformationActions.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-3 px-1">
                          Transformation specific Quick Actions
                        </div>
                        {transformationActions.map((suggestion, index) => (
                          <button
                            key={`transformation-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-300 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                  {suggestion.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Step Specific Actions */}
                    {stepActions.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-3 px-1">
                          Step specific Quick Actions
                        </div>
                        {stepActions.map((suggestion, index) => (
                          <button
                            key={`step-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-300 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                  {suggestion.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Bubble Specific Actions */}
                    {bubbleActions.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-3 px-1">
                          Bubble specific Quick Actions
                        </div>
                        {bubbleActions.map((suggestion, index) => (
                          <button
                            key={`bubble-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-300 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                  {suggestion.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Coffee Agent - Clarification Questions */}
        {pearl.coffeePhase === 'clarifying' && pearl.coffeeQuestions && (
          <div className="p-3">
            <ClarificationWidget
              questions={pearl.coffeeQuestions}
              onSubmit={
                isGenerating
                  ? handleInitialClarificationSubmit
                  : pearl.submitClarificationAnswers
              }
              isSubmitting={pearl.isCoffeeLoading}
            />
          </div>
        )}

        {/* Coffee Agent - Plan Approval */}
        {pearl.coffeePhase === 'ready' && pearl.coffeePlan && (
          <div className="p-3">
            <PlanApprovalWidget
              plan={pearl.coffeePlan}
              onApprove={
                isGenerating
                  ? handleInitialPlanApprove
                  : pearl.approvePlanAndBuild
              }
              onRetry={
                isGenerating
                  ? handleInitialPlanRetry
                  : pearl.retryCoffeePlanning
              }
              onSkip={
                isGenerating ? handleInitialPlanSkip : pearl.skipCoffeeAndBuild
              }
              isLoading={pearl.isCoffeeLoading}
            />
          </div>
        )}

        {/* Coffee Agent - Planning in progress */}
        {pearl.coffeePhase === 'planning' && (
          <div className="p-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-sm text-gray-300">
                Generating implementation plan...
              </span>
            </div>
          </div>
        )}

        {/* Render messages: user → generation output (if generating) → events → assistant */}
        {pearl.messages.map((message, index) => {
          // Calculate assistant index (how many assistant messages we've seen so far)
          const assistantIndex =
            pearl.messages
              .slice(0, index + 1)
              .filter((m) => m.type === 'assistant').length - 1;

          return (
            <div key={message.id}>
              {message.type === 'user' ? (
                <>
                  {/* User Message */}
                  <div className="p-3 flex justify-end">
                    <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                      <div className="text-[13px] text-gray-900">
                        {hasBubbleTags(message.content) ? (
                          <BubbleText text={message.content} />
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Show generation output immediately after user message if this is the first message and we're generating */}
                  {index === 0 && isGenerating && (
                    <div className="p-3">
                      <div className="text-sm text-gray-300 p-3 bg-gray-800/30 rounded border-l-2 border-purple-500">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                          <span className="text-xs font-medium text-gray-400">
                            Pearl is generating your workflow...
                          </span>
                        </div>
                        {generationSteps.length > 0 && (
                          <div className="space-y-1.5 mt-3">
                            {generationSteps.map((step, idx) => (
                              <div
                                key={idx}
                                className="text-[13px] leading-relaxed"
                              >
                                {step.type === 'tool_start' && (
                                  <div className="text-gray-400">
                                    {step.message}...
                                  </div>
                                )}
                                {step.type === 'tool_complete' && (
                                  <div className="flex items-center gap-1.5 text-white">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>
                                      {step.message}
                                      {step.duration
                                        ? ` (${step.duration}ms)`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                {step.type === 'generation_complete' && (
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-1.5 text-white font-medium">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{step.message}</span>
                                    </div>
                                    {step.summary && (
                                      <div className="text-gray-300 mt-2">
                                        {step.summary}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {step.type === 'error' && (
                                  <div className="flex items-center gap-1.5 text-red-400">
                                    <X className="w-3.5 h-3.5" />
                                    <span>Error: {step.message}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Assistant Response: Events then Message */
                <>
                  {/* Events (if any) - filter out transient events for completed messages */}
                  {pearl.eventsList[assistantIndex] &&
                    pearl.eventsList[assistantIndex].length > 0 && (
                      <div className="p-3">
                        <div className="space-y-2">
                          {pearl.eventsList[assistantIndex]
                            .filter((event) => {
                              // Only show persistent events for completed messages
                              // Filter out transient events like llm_thinking and tool_start
                              return (
                                event.type !== 'llm_thinking' &&
                                event.type !== 'tool_start' &&
                                event.type !== 'token'
                              );
                            })
                            .map((event, eventIndex) => (
                              <EventDisplay
                                key={`${message.id}-event-${eventIndex}`}
                                event={event}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Assistant Message */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {message.resultType === 'code' && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                      {message.resultType === 'answer' && (
                        <MessageSquare className="w-4 h-4 text-white" />
                      )}
                      {message.resultType === 'reject' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-xs font-medium text-gray-400">
                        Pearl
                        {message.resultType === 'code' && ' - Code Generated'}
                        {message.resultType === 'question' && ' - Question'}
                        {message.resultType === 'answer' && ' - Answer'}
                        {message.resultType === 'reject' && ' - Error'}
                      </span>
                    </div>
                    {message.resultType === 'code' ? (
                      <>
                        {message.content && (
                          <div className="prose prose-invert prose-sm max-w-none mb-3 [&_*]:text-[13px]">
                            <MarkdownWithBubbles content={message.content} />
                          </div>
                        )}
                        {message.code && (
                          <CodeDiffView
                            originalCode={editor.getCode() || ''}
                            modifiedCode={message.code}
                            isAccepted={updatedMessageIds.has(message.id)}
                            onAccept={() =>
                              handleReplace(
                                message.code!,
                                message.id,
                                message.bubbleParameters
                              )
                            }
                          />
                        )}
                      </>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none [&_*]:text-[13px]">
                        <MarkdownWithBubbles content={message.content} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Current streaming events (for the active turn) */}
        {pearl.isPending && pearl.eventsList.length > 0 && (
          <div className="p-3">
            {pearl.eventsList[pearl.eventsList.length - 1].length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs font-medium text-gray-400">
                    Pearl - Processing...
                  </span>
                </div>
                <div className="space-y-2">
                  {pearl.eventsList[pearl.eventsList.length - 1].map(
                    (event, index) => (
                      <EventDisplay
                        key={`current-event-${index}`}
                        event={event}
                      />
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-400">Starting...</span>
              </div>
            )}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact chat input at bottom */}
      <div className="flex-shrink-0 p-4 pt-2">
        <div className="bg-[#252525] border border-gray-700 rounded-xl p-3 shadow-lg relative">
          {uploadError && (
            <div className="text-[10px] text-amber-300 mb-2">{uploadError}</div>
          )}

          {/* Uploaded files display */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded border border-gray-700"
                >
                  <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300 truncate max-w-[120px]">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(index)}
                    disabled={pearl.isPending || isGenerating}
                    className="p-0.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={`Delete ${file.name}`}
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-gray-200" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <BubblePromptInput
              ref={promptInputRef}
              value={pearl.prompt}
              onChange={pearl.setPrompt}
              onSubmit={handleGenerate}
              placeholder="Get help modifying, debugging, or understanding your workflow..."
              className="bg-transparent text-gray-100 text-sm w-full placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0 pr-10"
              disabled={pearl.isPending || isGenerating}
              flowId={selectedFlowId}
              selectedBubbleContext={pearl.selectedBubbleContext}
              selectedTransformationContext={
                pearl.selectedTransformationContext
              }
              selectedStepContext={pearl.selectedStepContext}
              onRemoveBubble={pearl.removeBubbleFromContext}
              onRemoveTransformation={pearl.clearTransformationContext}
              onRemoveStep={pearl.clearStepContext}
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".html,.csv,.txt,image/png"
                  multiple
                  disabled={pearl.isPending || isGenerating}
                  aria-label="Upload files"
                  onChange={(e) => {
                    handleFileChange(e.target.files);
                    // reset so selecting the same file again triggers onChange
                    e.currentTarget.value = '';
                  }}
                />
                <Paperclip
                  className={`w-5 h-5 transition-colors ${
                    pearl.isPending || isGenerating
                      ? 'text-gray-600 cursor-not-allowed'
                      : uploadedFiles.length > 0
                        ? 'text-gray-300'
                        : 'text-gray-400 hover:text-gray-200'
                  }`}
                />
              </label>
            </div>
          </div>

          {/* Generate Button - Inside the prompt container */}
          <div className="flex justify-end mt-2">
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending ||
                  isGenerating
                }
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending ||
                  isGenerating
                    ? 'bg-gray-700/40 border border-gray-700/60 cursor-not-allowed text-gray-500'
                    : 'bg-white text-gray-900 border border-white/80 hover:bg-gray-100 hover:border-gray-300 shadow-lg hover:scale-105'
                }`}
              >
                {pearl.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
              <div
                className={`mt-2 text-[10px] leading-none transition-colors duration-200 ${
                  (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending
                    ? 'text-gray-500/60'
                    : 'text-gray-400'
                }`}
              >
                Ctrl+Enter
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component to render individual events
function EventDisplay({ event }: { event: DisplayEvent }) {
  switch (event.type) {
    case 'llm_thinking':
      return (
        <div className="text-sm text-gray-400 p-2 bg-gray-800/30 rounded border-l-2 border-gray-600">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        </div>
      );

    case 'think':
      // Don't render if content is empty or whitespace only
      if (!event.content.trim()) {
        return null;
      }
      return (
        <div className="text-sm text-gray-300 p-2 bg-gray-800/30 rounded border-l-2 border-gray-600">
          <div className="text-xs text-gray-400 mb-1">Thinking Process</div>
          <div className="prose prose-invert prose-sm max-w-none [&_*]:text-[13px]">
            <MarkdownWithBubbles content={event.content} />
          </div>
        </div>
      );

    case 'tool_start':
      return (
        <div className="p-2 bg-blue-900/20 border border-blue-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-xs text-blue-300">
              Calling {event.tool}...
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Duration: {Math.round((Date.now() - event.startTime) / 1000)}s
          </div>
        </div>
      );

    case 'tool_complete':
      return (
        <div className="p-2 bg-green-900/20 border border-green-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-300">
              {event.tool} completed
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Duration: {Math.round(event.duration / 1000)}s
          </div>
          <details className="mt-1">
            <summary className="text-xs text-gray-500 cursor-pointer">
              Show details
            </summary>
            <div className="mt-1 text-xs text-gray-400 max-h-40 overflow-y-auto">
              <div className="mb-1">
                Output: {JSON.stringify(event.output, null, 2)}
              </div>
            </div>
          </details>
        </div>
      );

    case 'token':
      return (
        <div className="text-sm text-gray-200 p-2 bg-blue-900/20 rounded border border-blue-800/30">
          {event.content}
          <span className="animate-pulse">|</span>
        </div>
      );

    default:
      return null;
  }
}
