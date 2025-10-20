/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 *
 */
import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { usePearl } from '../../hooks/usePearl';
import {
  ParsedBubbleWithInfo,
  type AvailableModel,
} from '@bubblelab/shared-schemas';
import { toast } from 'react-toastify';
import { trackAIAssistant } from '../../services/analytics';
import { replaceAllEditorContent } from '../../stores/editorStore';
import { INTEGRATIONS } from '../../lib/integrations';
import { type ChatMessage } from './type';
import { Check, AlertCircle, Loader2, ArrowUp } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useValidateCode } from '../../hooks/useValidateCode';
import { useExecutionStore } from '../../stores/executionStore';
export function PearlChat() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Fixed model - users cannot change this currently
  const selectedModel: AvailableModel = 'openrouter/z-ai/glm-4.6';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const closeSidePanel = useEditorStore((state) => state.closeSidePanel);
  const selectedFlowId = useUIStore((state) => state.selectedFlowId);
  // const {
  //   updateBubbleParameters,
  //   updateCode,
  //   updateInputSchema,
  //   updateRequiredCredentials,
  // } = useBubbleFlow(selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });
  // General chat mutation
  const pearlChat = usePearl();
  const pendingCredentials = useExecutionStore(
    selectedFlowId,
    (state) => state.pendingCredentials
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pearlChat.isPending]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    setPrompt('');

    pearlChat.mutate(
      {
        userRequest: userMessage.content,
        userName: 'User', // TODO: Get from auth context
        conversationHistory: messages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        availableVariables: [],
        currentCode: '',
        model: selectedModel,
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
          trackAIAssistant({ action: 'receive_response' });
          setMessages((prev) => [...prev, assistantMessage]);
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
          setMessages((prev) => [...prev, errorMessage]);
        },
      }
    );
  };

  const handleReplace = (code: string) => {
    replaceAllEditorContent(code);
    console.log('handleReplace', code);
    trackAIAssistant({ action: 'accept_response' });
    toast.success('Workflow updated!');

    // Update all workflow data from Pearl response
    if (pearlChat.data?.bubbleParameters) {
      // updateBubbleParameters(pearlChat.data.bubbleParameters);

      // if (pearlChat.data.snippet) {
      //   updateCode(pearlChat.data.snippet);
      // }

      // if (pearlChat.data.inputSchema) {
      //   updateInputSchema(pearlChat.data.inputSchema);
      // }

      // if (pearlChat.data.requiredCredentials) {
      //   updateRequiredCredentials(pearlChat.data.requiredCredentials);
      // }
      validateCodeMutation.mutateAsync({
        code: pearlChat.data.snippet!,
        flowId: selectedFlowId!,
        credentials: pendingCredentials,
      });
      toast.success('Bubble parameters, input schema, and credentials updated');
    } else {
      toast.error('No bubble parameters found');
    }
    closeSidePanel();
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <p className="text-xs text-blue-300 mb-3">
          💡 If adding new bubbles, please stick to these supported
          integrations.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-1.5 p-1 bg-blue-900/10 rounded"
            >
              <img
                src={integration.file}
                alt={`${integration.name} logo`}
                className="h-3.5 w-3.5 opacity-80"
                loading="lazy"
              />
              <p className="text-[10px] text-blue-200 truncate">
                {integration.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Selector - COMMENTED OUT: Using Grok Code Fast only */}
      {/* <div className="mb-4 px-2">
          <label className="text-xs text-gray-400 mb-1 block">AI Model</label>
          <div className="relative">
            <select
              title="AI Model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as AvailableModel)}
              className="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 appearance-none cursor-pointer hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div> */}

      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 space-y-3">
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

        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 ${
              message.type === 'user' ? 'flex justify-end' : ''
            }`}
          >
            {message.type === 'user' ? (
              <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
                <div className="text-sm text-gray-900">{message.content}</div>
              </div>
            ) : (
              <div>
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
                  <div className="text-sm text-gray-200">{message.content}</div>
                )}
              </div>
            )}
          </div>
        ))}

        {pearlChat.isPending && (
          <div className="p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact chat input at bottom */}
      <div className="p-2">
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
