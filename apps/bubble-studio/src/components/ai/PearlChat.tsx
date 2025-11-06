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
  Sparkles,
  Calendar,
  Webhook,
  HelpCircle,
} from 'lucide-react';
import { useValidateCode } from '../../hooks/useValidateCode';
import { useExecutionStore } from '../../stores/executionStore';
import ReactMarkdown from 'react-markdown';
import {
  MAX_BYTES,
  bytesToMB,
  isAllowedType,
  isTextLike,
  readTextFile,
  compressPngToBase64,
} from '../../utils/fileUtils';
import { sharedMarkdownComponents } from '../shared/MarkdownComponents';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import { CodeDiffView } from './CodeDiffView';

export function PearlChat() {
  // UI-only state
  const [prompt, setPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [updatedMessageIds, setUpdatedMessageIds] = useState<Set<string>>(
    new Set()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { closeSidePanel } = useUIStore();
  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });
  const { editor } = useEditor();
  const pendingCredentials = useExecutionStore(
    selectedFlowId,
    (state) => state.pendingCredentials
  );
  const { data: flowData } = useBubbleFlow(selectedFlowId);

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
    if (!prompt.trim() && uploadedFiles.length === 0) {
      return;
    }

    // Call Pearl store to start generation
    pearl.startGeneration(prompt, uploadedFiles);

    // Clear UI state
    setPrompt('');
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

  // Generate contextual suggestions based on trigger type
  const getQuickStartSuggestions = (): Array<{
    label: string;
    prompt: string;
    icon: React.ReactNode;
    description: string;
  }> => {
    const triggerType = flowData?.eventType;

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
    if (triggerType === 'webhook/http') {
      return [
        ...baseSuggestions,
        {
          label: 'Convert to schedule',
          prompt: 'Help me convert this flow to run on a schedule',
          icon: <Calendar className="w-4 h-4" />,
          description: 'Run automatically at specific times',
        },
      ];
    } else if (triggerType === 'schedule/cron') {
      return [
        ...baseSuggestions,
        {
          label: 'Convert to webhook',
          prompt: 'Help me convert this flow to be triggered by a webhook',
          icon: <Webhook className="w-4 h-4" />,
          description: 'Trigger via HTTP requests',
        },
      ];
    } else if (triggerType?.startsWith('slack/')) {
      return [
        ...baseSuggestions,
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
    } else if (triggerType?.startsWith('gmail/')) {
      return [
        ...baseSuggestions,
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

    // Default suggestions for unknown/unset trigger types
    return [
      ...baseSuggestions,
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
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3 min-h-0">
        {pearl.messages.length === 0 && !pearl.isPending && (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-3">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-base font-medium text-gray-200 mb-1">
                Chat with Pearl
              </h3>
              <p className="text-sm text-gray-400">
                Get help modifying, debugging, or understanding your workflow
              </p>
            </div>

            {/* Quick Start Suggestions */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 px-1">
                Quick Actions
              </div>
              {getQuickStartSuggestions().map((suggestion, index) => (
                <button
                  key={index}
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
                    <div className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUp className="w-3.5 h-3.5 text-gray-500 rotate-45" />
                    </div>
                  </div>
                </button>
              ))}
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
                  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-[13px] text-gray-900">
                      {message.content}
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
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                      {message.resultType === 'answer' && (
                        <Info className="w-4 h-4 text-blue-400" />
                      )}
                      {message.resultType === 'reject' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-xs font-medium text-gray-400">
                        Assistant
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
                            <ReactMarkdown
                              components={sharedMarkdownComponents}
                            >
                              {message.content}
                            </ReactMarkdown>
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
                        <ReactMarkdown components={sharedMarkdownComponents}>
                          {message.content}
                        </ReactMarkdown>
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
                    Assistant - Processing...
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
                    disabled={pearl.isPending}
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
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: After the google sheet is updated, also send me an email with the analysis..."
              className={`bg-transparent text-gray-100 text-sm w-full h-20 placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0 pr-10 disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={pearl.isPending}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  e.ctrlKey &&
                  !pearl.isPending &&
                  (prompt.trim() || uploadedFiles.length > 0)
                ) {
                  handleGenerate();
                }
              }}
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
                  (!prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending
                }
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  (!prompt.trim() && uploadedFiles.length === 0) ||
                  pearl.isPending
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
                  (!prompt.trim() && uploadedFiles.length === 0) ||
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
            <ReactMarkdown components={sharedMarkdownComponents}>
              {event.content}
            </ReactMarkdown>
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
