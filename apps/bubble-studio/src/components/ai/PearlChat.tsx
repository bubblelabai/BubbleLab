/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 *
 */
import { useState, useEffect, useRef } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { useUIStore } from '../../stores/uiStore';
import { usePearlStream } from '../../hooks/usePearl';
import {
  ParsedBubbleWithInfo,
  type AvailableModel,
  type StreamingEvent,
} from '@bubblelab/shared-schemas';
import { toast } from 'react-toastify';
import { trackAIAssistant } from '../../services/analytics';
import { type ChatMessage } from './type';
import { Check, AlertCircle, Loader2, ArrowUp } from 'lucide-react';
import { useValidateCode } from '../../hooks/useValidateCode';
import { useExecutionStore } from '../../stores/executionStore';
import ReactMarkdown from 'react-markdown';

// Display event types for chronological rendering
type DisplayEvent =
  | { type: 'llm_thinking' }
  | {
      type: 'tool_start';
      tool: string;
      input: unknown;
      callId: string;
      startTime: number;
    }
  | {
      type: 'tool_complete';
      tool: string;
      output: unknown;
      duration: number;
      callId: string;
    }
  | { type: 'token'; content: string }
  | { type: 'think'; content: string };

export function PearlChat() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // List of event lists - eventsList[0] corresponds to events for first assistant response, etc.
  // During streaming, we append to the last array in eventsList
  const [eventsList, setEventsList] = useState<DisplayEvent[][]>([]);
  const [activeToolCallIds, setActiveToolCallIds] = useState<Set<string>>(
    new Set()
  );

  // Fixed model - users cannot change this currently
  const selectedModel: AvailableModel = 'openrouter/z-ai/glm-4.6';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { closeSidePanel } = useUIStore();
  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });
  const { editor } = useEditor();

  // General chat mutation with streaming
  const pearlChat = usePearlStream();
  const pendingCredentials = useExecutionStore(
    selectedFlowId,
    (state) => state.pendingCredentials
  );

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, eventsList, pearlChat.isPending]);

  const handleEvent = (event: StreamingEvent) => {
    switch (event.type) {
      case 'llm_start':
        // Show thinking indicator when LLM starts and no active tool calls
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          const hasActiveTools = activeToolCallIds.size > 0;
          if (!hasActiveTools && lastIndex >= 0) {
            const updated = [...prev];
            updated[lastIndex] = [
              ...updated[lastIndex],
              { type: 'llm_thinking' },
            ];
            return updated;
          }
          return prev;
        });
        break;

      case 'llm_complete':
        // Remove thinking indicator when LLM completes
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updated = [...prev];
            updated[lastIndex] = updated[lastIndex].filter(
              (e) => e.type !== 'llm_thinking'
            );
            return updated;
          }
          return prev;
        });
        break;

      case 'tool_start':
        setActiveToolCallIds((prev) => new Set(prev).add(event.data.callId));
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updated = [...prev];
            updated[lastIndex] = [
              ...updated[lastIndex].filter((e) => e.type !== 'llm_thinking'), // Remove thinking when tool starts
              {
                type: 'tool_start',
                tool: event.data.tool,
                input: event.data.input,
                callId: event.data.callId,
                startTime: Date.now(),
              },
            ];
            return updated;
          }
          return prev;
        });
        break;

      case 'tool_complete':
        setActiveToolCallIds((prev) => {
          const next = new Set(prev);
          next.delete(event.data.callId);
          return next;
        });
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updated = [...prev];
            // Find and replace the tool_start event with tool_complete
            updated[lastIndex] = updated[lastIndex].map((e) =>
              e.type === 'tool_start' && e.callId === event.data.callId
                ? {
                    type: 'tool_complete',
                    tool: event.data.tool,
                    output: event.data.output,
                    duration: event.data.duration,
                    callId: event.data.callId,
                  }
                : e
            );
            return updated;
          }
          return prev;
        });
        break;

      case 'think':
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updated = [...prev];
            updated[lastIndex] = [
              ...updated[lastIndex],
              { type: 'think', content: event.data.content },
            ];
            return updated;
          }
          return prev;
        });
        break;

      case 'token':
        setEventsList((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updated = [...prev];
            const currentEvents = updated[lastIndex];
            const lastEvent = currentEvents[currentEvents.length - 1];

            // Accumulate tokens - merge with last token event if exists
            if (lastEvent?.type === 'token') {
              updated[lastIndex] = [
                ...currentEvents.slice(0, -1),
                {
                  type: 'token',
                  content: lastEvent.content + event.data.content,
                },
              ];
            } else {
              updated[lastIndex] = [
                ...currentEvents,
                { type: 'token', content: event.data.content },
              ];
            }
            return updated;
          }
          return prev;
        });
        break;

      case 'complete':
      case 'error':
        // These are handled by mutation callbacks
        break;
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Create new empty events array for this turn
    setEventsList((prev) => [...prev, []]);

    // Clear input
    setPrompt('');
    setActiveToolCallIds(new Set());

    // Build conversation history from messages
    const conversationHistory = messages.map((msg) => ({
      role: msg.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    // Get user's timezone information
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentTime = new Date().toLocaleString('en-US', {
      timeZone: userTimezone,
      dateStyle: 'full',
      timeStyle: 'long',
    });
    const additionalContext = `User's timezone: ${userTimezone}\nCurrent time: ${currentTime}`;

    pearlChat.mutate(
      {
        userRequest: userMessage.content,
        userName: 'User', // TODO: Get from auth context
        conversationHistory,
        availableVariables: [],
        currentCode: '',
        model: selectedModel,
        additionalContext,
        onEvent: handleEvent,
      },
      {
        onSuccess: (result) => {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: result.message || '',
            code:
              result.type === 'code' && result.snippet
                ? result.snippet
                : undefined,
            resultType: result.type,
            timestamp: new Date(),
            bubbleParameters: result.bubbleParameters as Record<
              string,
              ParsedBubbleWithInfo
            >,
          };

          // Events are already in eventsList, just add assistant message
          setMessages((prev) => [...prev, assistantMessage]);
          setActiveToolCallIds(new Set());

          trackAIAssistant({ action: 'receive_response' });
        },
        onError: (error) => {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content:
              error instanceof Error
                ? error.message
                : 'Failed to generate response',
            resultType: 'reject',
            timestamp: new Date(),
          };

          // Events are already in eventsList, just add error message
          setMessages((prev) => [...prev, errorMessage]);
          setActiveToolCallIds(new Set());
        },
      }
    );
  };

  const handleReplace = (code: string) => {
    editor.replaceAllContent(code);
    trackAIAssistant({ action: 'accept_response' });
    toast.success('Workflow updated!');

    // Update all workflow data from Pearl response
    if (pearlChat.data?.bubbleParameters) {
      validateCodeMutation.mutateAsync({
        code: pearlChat.data.snippet!,
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

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3 min-h-0">
        {messages.length === 0 && !pearlChat.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm space-y-2">
            <p className="text-center">
              Start a conversation to modify your current workflow
            </p>
            <p className="text-xs text-gray-600 text-center">
              Example: "After the google sheet is updated, also send me an email
              with the updated data"
            </p>
          </div>
        )}

        {/* Render messages: user → events → assistant → user → events → assistant */}
        {messages.map((message, index) => {
          // Calculate assistant index (how many assistant messages we've seen so far)
          const assistantIndex =
            messages.slice(0, index + 1).filter((m) => m.type === 'assistant')
              .length - 1;

          return (
            <div key={message.id}>
              {message.type === 'user' ? (
                /* User Message */
                <div className="p-3 flex justify-end">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                    <div className="text-sm text-gray-900">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant Response: Events then Message */
                <>
                  {/* Events (if any) */}
                  {eventsList[assistantIndex] &&
                    eventsList[assistantIndex].length > 0 && (
                      <div className="p-3">
                        <div className="space-y-2">
                          {eventsList[assistantIndex].map(
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
                      {message.resultType === 'reject' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-xs font-medium text-gray-400">
                        Assistant
                        {message.resultType === 'code' && ' - Code Generated'}
                        {message.resultType === 'question' && ' - Question'}
                        {message.resultType === 'reject' && ' - Error'}
                      </span>
                    </div>
                    {message.resultType === 'code' ? (
                      <>
                        {message.content && (
                          <div className="text-sm text-gray-200 mb-2">
                            {message.content}
                          </div>
                        )}
                        {message.code && (
                          <>
                            <pre className="text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto thin-scrollbar mb-2 p-2 bg-black/30 rounded">
                              {message.code}
                            </pre>
                            <button
                              onClick={() => handleReplace(message.code!)}
                              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Update Workflow
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-200">
                        {message.content}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Current streaming events (for the active turn) */}
        {pearlChat.isPending && eventsList.length > 0 && (
          <div className="p-3">
            {eventsList[eventsList.length - 1].length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs font-medium text-gray-400">
                    Assistant - Processing...
                  </span>
                </div>
                <div className="space-y-2">
                  {eventsList[eventsList.length - 1].map((event, index) => (
                    <EventDisplay
                      key={`current-event-${index}`}
                      event={event}
                    />
                  ))}
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
        <div className="bg-[#252525] border border-gray-700 rounded-xl p-3 shadow-lg">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create a workflow that fetches data from Airtable and sends it via email..."
            className="bg-transparent text-gray-100 text-sm w-full h-20 placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0"
            disabled={pearlChat.isPending}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                e.ctrlKey &&
                !pearlChat.isPending &&
                prompt.trim()
              ) {
                handleGenerate();
              }
            }}
          />

          {/* Generate Button - Inside the prompt container */}
          <div className="flex justify-end mt-2">
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || pearlChat.isPending}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  !prompt.trim() || pearlChat.isPending
                    ? 'bg-gray-700/40 border border-gray-700/60 cursor-not-allowed text-gray-500'
                    : 'bg-white text-gray-900 border border-white/80 hover:bg-gray-100 hover:border-gray-300 shadow-lg hover:scale-105'
                }`}
              >
                {pearlChat.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
              <div
                className={`mt-2 text-[10px] leading-none transition-colors duration-200 ${
                  !prompt.trim() || pearlChat.isPending
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
            <span>💭 Thinking...</span>
          </div>
        </div>
      );

    case 'think':
      return (
        <div className="text-sm text-gray-300 p-2 bg-gray-800/30 rounded border-l-2 border-gray-600">
          <div className="text-xs text-gray-400 mb-1">💭 Thinking Process</div>
          <div className="text-xs prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{event.content}</ReactMarkdown>
          </div>
        </div>
      );

    case 'tool_start':
      return (
        <div className="p-2 bg-blue-900/20 border border-blue-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-xs text-blue-300">
              🔧 Calling {event.tool}...
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
              ✓ {event.tool} completed
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
