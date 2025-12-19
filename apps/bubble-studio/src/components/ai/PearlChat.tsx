/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 *
 */
import { useState, useEffect, useRef, useCallback, memo } from 'react';
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
  Image,
} from 'lucide-react';
import { useValidateCode } from '../../hooks/useValidateCode';
import { useExecutionStore } from '../../stores/executionStore';
import {
  MAX_BYTES,
  bytesToMB,
  isImageFile,
  isTextLike,
  readTextFile,
  compressImageToBase64,
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
import { ContextRequestWidget } from './ContextRequestWidget';
import { hasBubbleTags } from '../../utils/bubbleTagParser';
import { useEditorStore } from '../../stores/editorStore';
import { API_BASE_URL } from '../../env';
import {
  useGenerateInitialFlow,
  startBuildingPhase,
  submitClarificationAndContinue,
} from '../../hooks/usePearlStream';
import type { ChatMessage, PlanApprovalMessage } from './type';
import { playGenerationCompleteSound } from '../../utils/soundUtils';
import { renderJson } from '../../utils/executionLogsFormatUtils';
import { VoiceRecorder } from './VoiceRecorder';

/**
 * LazyDetails component - only renders children when the details element is open.
 * This prevents expensive JSON rendering from happening when the details are collapsed,
 * improving performance when there are many tool_complete events.
 */
const LazyDetails = memo(function LazyDetails({
  summary,
  summaryClassName,
  children,
}: {
  summary: string;
  summaryClassName?: string;
  children: () => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="mt-1"
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className={
          summaryClassName ||
          'text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors'
        }
      >
        {summary}
      </summary>
      {isOpen && (
        <div className="mt-2 max-h-40 overflow-y-auto">
          <pre className="text-xs bg-[#0d1117] border border-[#21262d] rounded p-2 overflow-x-auto">
            {children()}
          </pre>
        </div>
      )}
    </details>
  );
});

type UploadedFile = {
  name: string;
  content: string;
  fileType: 'image' | 'text';
};

export function PearlChat() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isVoiceBusy, setIsVoiceBusy] = useState(false);
  const [updatedMessageIds, setUpdatedMessageIds] = useState<Set<string>>(
    new Set()
  );

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

  // Generation flow - uses pearlChatStore for events, callback handles editor update and refetch
  useGenerateInitialFlow({
    prompt: flowData?.prompt || '',
    flowId: selectedFlowId ?? undefined,
    enabled: shouldEnableGeneration,
    onGenerationComplete: useCallback(
      (data: {
        generatedCode: string;
        summary: string;
        bubbleParameters?: Record<string, unknown>;
      }) => {
        // Play completion sound
        playGenerationCompleteSound();

        if (data.generatedCode) {
          const { editorInstance, setPendingCode } = useEditorStore.getState();
          if (editorInstance) {
            const model = editorInstance.getModel();
            if (model) {
              model.setValue(data.generatedCode);
              console.log('[PearlChat] Editor updated with generated code');
            } else {
              setPendingCode(data.generatedCode);
            }
          } else {
            setPendingCode(data.generatedCode);
          }
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

        // Track generation
        trackWorkflowGeneration({
          prompt: flowData?.prompt || '',
          generatedCode: data.generatedCode,
          generatedCodeLength: data.generatedCode?.length || 0,
          generatedBubbleCount: Object.keys(data.bubbleParameters || {}).length,
          success: true,
          errorMessage: '',
        });
      },
      [queryClient, selectedFlowId, flowData?.prompt]
    ),
  });

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
  }, [selectedFlowId]);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pearl.timeline, pearl.isPending, pearl.isGenerating]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const newFiles: Array<{
      name: string;
      content: string;
      fileType: 'image' | 'text';
    }> = [];

    const errors: string[] = [];

    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Auto-detect file type
      const isImage = isImageFile(file);
      const isText = isTextLike(file);

      if (!isImage && !isText) {
        errors.push(
          `${file.name} is not supported. Please upload images (PNG, JPG, GIF, WebP) or text files (TXT, CSV, MD, HTML).`
        );
        continue;
      }

      try {
        if (isText) {
          if (file.size > MAX_BYTES) {
            errors.push(
              `${file.name} too large. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
            );
            continue;
          }
          const text = await readTextFile(file);
          newFiles.push({ name: file.name, content: text, fileType: 'text' });
        } else if (isImage) {
          // Image path: compress and convert to base64
          const base64 = await compressImageToBase64(file);
          const approxBytes = Math.floor((base64.length * 3) / 4);
          if (approxBytes > MAX_BYTES) {
            errors.push(
              `${file.name} too large after compression. Max ${bytesToMB(MAX_BYTES).toFixed(1)} MB`
            );
            continue;
          }
          newFiles.push({
            name: file.name,
            content: base64,
            fileType: 'image',
          });
        }
      } catch (error) {
        errors.push(
          `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        continue;
      }
    }

    // Log for debugging
    console.log('Processed files:', {
      totalSelected: files.length,
      successfullyProcessed: newFiles.length,
      errorCount: errors.length,
      files: newFiles.map((f) => ({ name: f.name, type: f.fileType })),
    });

    // Update state only once at the end - replace instead of append
    if (newFiles.length > 0) {
      setUploadedFiles(newFiles);
      console.log('Uploaded file:', newFiles[0]?.name, newFiles[0]?.fileType);
    }

    // Set error message if any errors occurred (show first error)
    if (errors.length > 0) {
      setUploadError(
        errors.length === 1
          ? errors[0]
          : `${errors.length} files failed: ${errors[0]}`
      );
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

  const handleInitialPlanApprove = useCallback(
    async (comment?: string) => {
      if (!selectedFlowId || !flowData?.prompt || !pearl.pendingPlan) return;

      // Add approval message to mark the plan as approved
      const pearlStore = getPearlChatStore(selectedFlowId);
      const storeState = pearlStore.getState();
      const approvalMsg: PlanApprovalMessage = {
        id: `plan-approval-${Date.now()}`,
        type: 'plan_approval',
        approved: true,
        comment,
        timestamp: new Date(),
      };
      storeState.addMessage(approvalMsg);

      const plan = pearl.pendingPlan.plan;
      // Build plan context string for Boba
      const planContext = [
        `Summary: ${plan.summary}`,
        'Steps:',
        ...plan.steps.map(
          (step, i) =>
            `${i + 1}. ${step.title}: ${step.description}${step.bubblesUsed ? ` (Using: ${step.bubblesUsed.join(', ')})` : ''}`
        ),
        `Bubbles to use: ${plan.estimatedBubbles.join(', ')}`,
        ...(comment ? [`\nAdditional user comments: ${comment}`] : []),
      ].join('\n');

      await startBuildingPhase(selectedFlowId, flowData.prompt, planContext);
    },
    [selectedFlowId, flowData?.prompt, pearl.pendingPlan]
  );

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
        {pearl.timeline.length === 0 && !pearl.isPending && !isGenerating && (
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

        {/* Render unified timeline: messages and events in chronological order */}
        {pearl.timeline.map((item, index) => {
          const key =
            item.kind === 'message'
              ? item.data.id
              : `event-${index}-${item.data.type}`;

          // For events, check if we should filter transient ones
          // Only show transient events (llm_thinking, tool_start, token) if they're recent (loading state)
          if (item.kind === 'event') {
            const event = item.data;
            const isTransient =
              event.type === 'llm_thinking' ||
              event.type === 'tool_start' ||
              event.type === 'token';

            // For transient events, only show if we're in loading state
            if (isTransient && !pearl.isPending && !pearl.isCoffeeLoading) {
              return null;
            }

            return (
              <div key={key} className="p-1">
                <EventDisplay event={event} onRetry={pearl.retryAfterError} />
              </div>
            );
          }

          // It's a message
          const message = item.data;

          return (
            <div key={key}>
              {/* User Message */}
              {message.type === 'user' && (
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
              )}

              {/* Clarification Request - render as widget if pending, as history if answered */}
              {message.type === 'clarification_request' && (
                <div className="p-3">
                  {pearl.pendingClarification?.id === message.id ? (
                    <ClarificationWidget
                      questions={message.questions}
                      onSubmit={
                        isGenerating
                          ? handleInitialClarificationSubmit
                          : pearl.submitClarificationAnswers
                      }
                      isSubmitting={pearl.isCoffeeLoading}
                    />
                  ) : (
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="text-xs text-blue-400 mb-2">
                        Questions asked:
                      </div>
                      {message.questions.map((q, i) => (
                        <div key={q.id} className="text-sm text-gray-300 mb-1">
                          {i + 1}. {q.question}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clarification Response - display user's answers */}
              {message.type === 'clarification_response' && (
                <div className="p-3 flex justify-end">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-xs text-gray-500 mb-1">
                      Your answers:
                    </div>
                    {Object.entries(message.answers).map(([qId, choiceIds]) => {
                      const question = message.originalQuestions?.find(
                        (q) => q.id === qId
                      );
                      const choiceLabels = choiceIds.map(
                        (cid) =>
                          question?.choices.find((c) => c.id === cid)?.label ||
                          cid
                      );
                      return (
                        <div key={qId} className="text-sm text-gray-900">
                          {question?.question || qId}: {choiceLabels.join(', ')}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Context Request - render as widget if pending, as history if answered */}
              {message.type === 'context_request' && (
                <div className="p-3">
                  {pearl.pendingContextRequest?.id === message.id ? (
                    <ContextRequestWidget
                      request={message.request}
                      credentials={pearl.coffeeContextCredentials}
                      onCredentialChange={pearl.setCoffeeContextCredential}
                      onSubmit={pearl.submitContext}
                      onReject={pearl.rejectContext}
                      isLoading={pearl.isCoffeeLoading}
                      apiBaseUrl={API_BASE_URL}
                    />
                  ) : (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <div className="text-xs text-amber-400 mb-2">
                        Context request:
                      </div>
                      <div className="text-sm text-gray-300">
                        {message.request.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Context Response - display result status */}
              {message.type === 'context_response' && (
                <div className="p-3 flex justify-end">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-sm text-gray-900">
                      {message.answer.status === 'success' &&
                        'Context gathered successfully'}
                      {message.answer.status === 'rejected' &&
                        'Skipped context gathering'}
                      {message.answer.status === 'error' &&
                        `Error: ${message.answer.error}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Plan Message - always show full widget, hide button when approved */}
              {message.type === 'plan' && (
                <div className="p-3">
                  <PlanApprovalWidget
                    plan={message.plan}
                    onApprove={
                      isGenerating
                        ? handleInitialPlanApprove
                        : pearl.approvePlanAndBuild
                    }
                    isApproved={pearl.pendingPlan?.id !== message.id}
                  />
                </div>
              )}

              {/* Plan Approval - display approval */}
              {message.type === 'plan_approval' && (
                <div className="p-3 flex justify-end">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-sm text-gray-900">
                      {message.approved ? 'Plan approved' : 'Plan rejected'}
                      {message.comment && (
                        <div className="text-xs text-gray-500 mt-1">
                          {message.comment}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Assistant Message */}
              {message.type === 'assistant' && (
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
              )}

              {/* System Message */}
              {message.type === 'system' && (
                <div className="p-3">
                  <div className="text-xs text-gray-500 italic">
                    {message.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator when actively processing but no events yet */}
        {(pearl.isPending || pearl.isCoffeeLoading || pearl.isGenerating) &&
          !pearl.pendingClarification &&
          !pearl.pendingContextRequest &&
          !pearl.pendingPlan &&
          pearl.timeline.filter((item) => item.kind === 'event').length ===
            0 && (
            <div className="p-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-300">Processing...</span>
              </div>
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
                  {file.fileType === 'image' ? (
                    <Image className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  ) : (
                    <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
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

          {/* Text input area */}
          <BubblePromptInput
            ref={promptInputRef}
            value={pearl.prompt}
            onChange={pearl.setPrompt}
            onSubmit={handleGenerate}
            placeholder="Get help modifying, debugging, or understanding your workflow..."
            className="bg-transparent text-gray-100 text-sm w-full placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0"
            disabled={pearl.isPending || isGenerating || isVoiceBusy}
            flowId={selectedFlowId}
            selectedBubbleContext={pearl.selectedBubbleContext}
            selectedTransformationContext={pearl.selectedTransformationContext}
            selectedStepContext={pearl.selectedStepContext}
            onRemoveBubble={pearl.removeBubbleFromContext}
            onRemoveTransformation={pearl.clearTransformationContext}
            onRemoveStep={pearl.clearStepContext}
          />

          {/* Bottom action bar - buttons grouped on the right */}
          <div className="flex items-center justify-end gap-2 mt-2">
            {/* Upload button - handles both images and text files */}
            <label
              className={`${
                pearl.isPending || isGenerating || isVoiceBusy
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer'
              }`}
              title="Upload file (Images: PNG, JPG, GIF, WebP | Text: TXT, CSV, MD, HTML)"
            >
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,.txt,.csv,.md,.html,.htm"
                disabled={pearl.isPending || isGenerating || isVoiceBusy}
                aria-label="Upload file"
                onChange={(e) => {
                  handleFileChange(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  pearl.isPending || isGenerating || isVoiceBusy
                    ? 'bg-gray-700/40 border border-gray-700/60 text-gray-500'
                    : 'bg-gray-700/40 border border-gray-600/60 text-gray-400 hover:bg-gray-700/60 hover:border-gray-500/80 hover:text-gray-200'
                }`}
              >
                <Paperclip className="w-5 h-5" />
              </div>
            </label>

            {/* Voice Recording Button */}
            <VoiceRecorder
              disabled={pearl.isPending || isGenerating}
              onStateChange={setIsVoiceBusy}
              onTranscription={(text) => {
                const currentValue = pearl.prompt;
                const newValue = currentValue
                  ? `${currentValue} ${text}`
                  : text;
                pearl.setPrompt(newValue);
              }}
            />

            {/* Send button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                pearl.isPending ||
                isGenerating ||
                isVoiceBusy
              }
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                pearl.isPending ||
                isGenerating ||
                isVoiceBusy
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
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component to render individual events
function EventDisplay({
  event,
  onRetry,
}: {
  event: DisplayEvent;
  onRetry?: () => void;
}) {
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

    case 'llm_complete_content':
      // Don't render if content is empty or whitespace only
      if (!event.content.trim()) {
        return null;
      }
      return (
        <div className="text-sm text-gray-300 p-2 bg-gray-800/30 rounded border-l-2 border-gray-600">
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

    case 'tool_complete': {
      // Check if tool call failed (output has error property)
      const isError =
        event.output &&
        typeof event.output === 'object' &&
        'error' in event.output &&
        event.output.error != '';
      // Some tools return a valid property to indicate success
      const isValid =
        event.output &&
        typeof event.output === 'object' &&
        'valid' in event.output &&
        event.output.valid == false;
      if (isError || isValid) {
        return (
          <div className="p-2 bg-red-900/20 border border-red-800/30 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-300">
                  {event.tool} failed
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Duration: {Math.round(event.duration / 1000)}s
              </div>
            </div>
            <LazyDetails summary="Show error details">
              {() =>
                event.output != null &&
                typeof event.output === 'object' &&
                'error' in event.output ? (
                  <span className="text-red-300">
                    {String(event.output.error)}
                  </span>
                ) : (
                  renderJson(event.output)
                )
              }
            </LazyDetails>
          </div>
        );
      }

      return (
        <div className="p-2 bg-green-900/20 border border-green-800/30 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-300">
                {event.tool} completed
              </span>
            </div>
            <div className="text-xs text-gray-400">
              Duration: {Math.round(event.duration / 1000)}s
            </div>
          </div>
          <LazyDetails summary="Show details">
            {() => renderJson(event.output)}
          </LazyDetails>
        </div>
      );
    }

    case 'token':
      return (
        <div className="text-sm text-gray-200 p-2 bg-blue-900/20 rounded border border-blue-800/30">
          {event.content}
          <span className="animate-pulse">|</span>
        </div>
      );

    // Generation-specific events
    case 'generation_progress':
      return (
        <div className="text-sm text-gray-400 p-2 bg-gray-800/30 rounded border-l-2 border-purple-500">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
            <span>{event.message}</span>
          </div>
        </div>
      );

    case 'generation_complete':
      return (
        <div className="p-2 bg-green-900/20 border border-green-800/30 rounded-lg mt-2">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm text-green-300 font-medium">
              Code generation complete!
            </span>
          </div>
        </div>
      );

    case 'generation_error':
      return (
        <div className="p-2 bg-red-900/20 border border-red-800/30 rounded-lg">
          <div className="flex items-center gap-2">
            <X className="w-3.5 h-3.5 text-red-400" />
            <span className="text-sm text-red-300">Error: {event.message}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1.5 text-xs bg-red-800/30 hover:bg-red-800/50 text-red-300 rounded border border-red-700/50 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      );

    case 'retry_attempt':
      return (
        <div className="text-sm text-amber-400 p-2 bg-amber-900/10 rounded border-l-2 border-amber-500">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>
              Retrying... (attempt {event.attempt}/{event.maxRetries})
            </span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
