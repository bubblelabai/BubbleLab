/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 *
 */
import { useState, useEffect, useRef } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { useUIStore } from '../../stores/uiStore';
import { usePearlChatStore } from '../../hooks/usePearlChatStore';
import type { DisplayEvent } from '../../stores/pearlChatStore';
import { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { toast } from 'react-toastify';
import { trackAIAssistant } from '../../services/analytics';
import {
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  Paperclip,
  X,
  Info,
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
import { hasBubbleTags } from '../../utils/bubbleTagParser';

export function PearlChat() {
  // UI-only state (non-shared)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pearl.messages, pearl.eventsList, pearl.isPending]);

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

    // Call Pearl store to start generation
    pearl.startGeneration(pearl.prompt, uploadedFiles);

    // Clear UI state
    setUploadedFiles([]);
  };

  const handleReplace = (
    code: string,
    messageId: string,
    bubbleParameters?: Record<string, ParsedBubbleWithInfo>
  ) => {
    editor.replaceAllContent(code);
    trackAIAssistant({ action: 'accept_response', message: code || '' });
    toast.success('Workflow updated!');

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
      toast.success('Bubble parameters, input schema, and credentials updated');
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
        {pearl.messages.length === 0 && !pearl.isPending && (
          <div className="flex flex-col items-center px-4 py-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <img
                src="/pearl.png"
                alt="Pearl"
                className="w-12 h-12 mb-3 mx-auto"
              />
              <h3 className="text-base font-medium text-foreground mb-1">
                Chat with Pearl
              </h3>
            </div>

            {/* Quick Start Suggestions */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
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
                        className="group w-full px-4 py-3.5 bg-muted/40 hover:bg-muted/60 border border-border dark:border-white/10 hover:border-border/80 dark:hover:border-white/20 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground/80 transition-colors">
                            {suggestion.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-0.5">
                              {suggestion.label}
                            </div>
                            <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
                              {suggestion.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Transformation Specific Actions */}
                    {transformationActions.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4 mb-3 px-1">
                          Transformation specific Quick Actions
                        </div>
                        {transformationActions.map((suggestion, index) => (
                          <button
                            key={`transformation-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-muted/40 hover:bg-muted/60 border border-border dark:border-white/10 hover:border-border/80 dark:hover:border-white/20 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
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
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4 mb-3 px-1">
                          Step specific Quick Actions
                        </div>
                        {stepActions.map((suggestion, index) => (
                          <button
                            key={`step-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-muted/40 hover:bg-muted/60 border border-border dark:border-white/10 hover:border-border/80 dark:hover:border-white/20 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
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
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4 mb-3 px-1">
                          Bubble specific Quick Actions
                        </div>
                        {bubbleActions.map((suggestion, index) => (
                          <button
                            key={`bubble-${index}`}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.prompt)
                            }
                            className="group w-full px-4 py-3.5 bg-muted/40 hover:bg-muted/60 border border-border dark:border-white/10 hover:border-border/80 dark:hover:border-white/20 rounded-lg text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                {suggestion.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-0.5">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
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

        {/* Render messages: user → events → assistant → user → events → assistant */}
        {pearl.messages.map((message, index) => {
          // Calculate assistant index (how many assistant messages we've seen so far)
          const assistantIndex =
            pearl.messages
              .slice(0, index + 1)
              .filter((m) => m.type === 'assistant').length - 1;

          return (
            <div key={message.id}>
              {message.type === 'user' ? (
                /* User Message */
                <div className="p-3 flex justify-end">
                  <div className="bg-muted rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-[13px] text-foreground">
                      {hasBubbleTags(message.content) ? (
                        <BubbleText text={message.content} />
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant Response: Events then Message */
                <>
                  {/* Events (if any) */}
                  {pearl.eventsList[assistantIndex] &&
                    pearl.eventsList[assistantIndex].length > 0 && (
                      <div className="p-3">
                        <div className="space-y-2">
                          {pearl.eventsList[assistantIndex].map(
                            (event, eventIndex) => (
                              <EventDisplay
                                key={`${message.id}-event-${eventIndex}`}
                                event={event}
                              />
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Assistant Message */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {message.resultType === 'code' && (
                        <Check className="w-4 h-4 text-success" />
                      )}
                      {message.resultType === 'answer' && (
                        <Info className="w-4 h-4 text-info" />
                      )}
                      {message.resultType === 'reject' && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-xs font-medium text-muted-foreground">
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
                  <Loader2 className="w-4 h-4 text-info animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">
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
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Starting...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact chat input at bottom */}
      <div className="flex-shrink-0 p-4 pt-2">
        <div className="bg-card border border-border dark:border-white/10 rounded-xl p-3 shadow-lg relative">
          {uploadError && (
            <div className="text-[10px] text-warning mb-2">{uploadError}</div>
          )}

          {/* Uploaded files display */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded border border-border dark:border-white/10"
                >
                  <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-foreground/80 truncate max-w-[120px]">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(index)}
                    disabled={pearl.isPending}
                    className="p-0.5 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={`Delete ${file.name}`}
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
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
              className="bg-transparent text-foreground text-sm w-full placeholder-muted-foreground resize-none focus:outline-none focus:ring-0 p-0 pr-10"
              disabled={pearl.isPending}
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
                  disabled={pearl.isPending}
                  aria-label="Upload files"
                  onChange={(e) => {
                    handleFileChange(e.target.files);
                    // reset so selecting the same file again triggers onChange
                    e.currentTarget.value = '';
                  }}
                />
                <Paperclip
                  className={`w-5 h-5 transition-colors ${
                    pearl.isPending
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : uploadedFiles.length > 0
                        ? 'text-foreground/80'
                        : 'text-muted-foreground hover:text-foreground'
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
                  pearl.isPending
                }
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  (!pearl.prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending
                    ? 'bg-muted/40 border border-border cursor-not-allowed text-muted-foreground'
                    : 'bg-foreground text-background border border-foreground/80 hover:bg-foreground/90 hover:border-foreground/60 shadow-lg hover:scale-105'
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
                    ? 'text-muted-foreground/60'
                    : 'text-muted-foreground'
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
        <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded border-l-2 border-border">
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
        <div className="text-sm text-foreground/80 p-2 bg-muted/30 rounded border-l-2 border-border">
          <div className="text-xs text-muted-foreground mb-1">
            Thinking Process
          </div>
          <div className="prose prose-invert prose-sm max-w-none [&_*]:text-[13px]">
            <MarkdownWithBubbles content={event.content} />
          </div>
        </div>
      );

    case 'tool_start':
      return (
        <div className="p-2 bg-info/10 border border-info/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="w-3 h-3 text-info animate-spin" />
            <span className="text-xs text-info">Calling {event.tool}...</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Duration: {Math.round((Date.now() - event.startTime) / 1000)}s
          </div>
        </div>
      );

    case 'tool_complete':
      return (
        <div className="p-2 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-3 h-3 text-success" />
            <span className="text-xs text-success">{event.tool} completed</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Duration: {Math.round(event.duration / 1000)}s
          </div>
          <details className="mt-1">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Show details
            </summary>
            <div className="mt-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
              <div className="mb-1">
                Output: {JSON.stringify(event.output, null, 2)}
              </div>
            </div>
          </details>
        </div>
      );

    case 'token':
      return (
        <div className="text-sm text-foreground/90 p-2 bg-info/10 rounded border border-info/20">
          {event.content}
          <span className="animate-pulse">|</span>
        </div>
      );

    default:
      return null;
  }
}
