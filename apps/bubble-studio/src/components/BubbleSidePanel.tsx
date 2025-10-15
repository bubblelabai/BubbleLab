import { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  ArrowUp,
} from 'lucide-react';
import {
  useEditorStore,
  selectIsListView,
  selectIsPromptView,
  selectIsGeneralChatView,
  insertCodeAtTargetLine,
  replaceAllEditorContent,
} from '../stores/editorStore';
import { useMilkTea } from '../hooks/useMilkTea';
import { usePearl } from '../hooks/usePearl';
import { toast } from 'react-toastify';
import { findLogoForBubble } from '../lib/integrations';

/**
 * Bubble definition from bubbles.json
 */
interface BubbleDefinition {
  name: string;
  alias: string;
  type: string;
  shortDescription: string;
  useCase: string;
  inputSchema: string;
  outputSchema: string;
  usageExample: string;
  requiredCredentials: string[];
}

interface BubblesData {
  version: string;
  generatedAt: string;
  totalCount: number;
  bubbles: BubbleDefinition[];
}

/**
 * BubbleSidePanel Component
 *
 * A slide-in side panel that helps users add bubbles to their workflow:
 * 1. List View: Shows all available bubbles with search/filter
 * 2. Prompt View: Let user enter natural language prompt for MilkTea to generate code
 */
export function BubbleSidePanel() {
  const [bubblesData, setBubblesData] = useState<BubblesData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('bubbleSidePanelWidth');
    return saved ? parseInt(saved, 10) : 384; // Default 384px (w-96)
  });
  const [isResizing, setIsResizing] = useState(false);

  // Store state
  const isSidePanelOpen = useEditorStore(
    (state) => state.sidePanelMode !== 'closed'
  );
  const selectedBubbleName = useEditorStore(
    (state) => state.selectedBubbleName
  );
  const targetInsertLine = useEditorStore((state) => state.targetInsertLine);
  const closeSidePanel = useEditorStore((state) => state.closeSidePanel);
  const selectBubble = useEditorStore((state) => state.selectBubble);

  const isListView = useEditorStore(selectIsListView);
  const isPromptView = useEditorStore(selectIsPromptView);
  const isGeneralChatView = useEditorStore(selectIsGeneralChatView);
  const openGeneralChat = useEditorStore((state) => state.openPearlChat);

  // Load bubbles data from public/bubbles.json
  useEffect(() => {
    const loadBubbles = async () => {
      try {
        const response = await fetch('/bubbles.json');
        if (!response.ok) {
          throw new Error('Failed to load bubbles');
        }
        const data: BubblesData = await response.json();
        setBubblesData(data);
      } catch (error) {
        console.error('Error loading bubbles:', error);
      }
    };

    loadBubbles();
  }, []);

  // Handle panel resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(800, e.clientX)); // Min 280px, max 800px
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('bubbleSidePanelWidth', panelWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Filter bubbles based on search and type
  const filteredBubbles = bubblesData?.bubbles.filter((bubble) => {
    const matchesSearch =
      searchQuery === '' ||
      bubble.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bubble.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bubble.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'all' || bubble.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Get unique types for filter
  const bubbleTypes = [
    'all',
    ...new Set(bubblesData?.bubbles.map((b) => b.type) || []),
  ];

  if (!isSidePanelOpen) {
    return null;
  }

  return (
    <>
      {/* Global cursor override when resizing */}
      {isResizing && (
        <style>{`* { cursor: col-resize !important; user-select: none !important; }`}</style>
      )}

      <div
        className="fixed inset-y-0 left-0 bg-[#1e1e1e] border-r border-gray-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: `${panelWidth}px`,
          transform: isSidePanelOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Resize Handle */}
        <div
          className={`absolute inset-y-0 right-0 w-1 hover:w-1.5 bg-transparent hover:bg-purple-500/50 cursor-col-resize transition-all z-10 ${
            isResizing ? 'w-1.5 bg-purple-500' : ''
          }`}
          onMouseDown={handleResizeStart}
          style={{ touchAction: 'none' }}
        />
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {(isPromptView || isGeneralChatView) && (
              <button
                onClick={() => selectBubble(null)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Back to bubble list"
              >
                <ArrowLeft className="w-5 h-5 text-gray-300" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-100">
              {isPromptView
                ? `Configure ${selectedBubbleName}`
                : isGeneralChatView
                  ? 'General AI Chat'
                  : 'Add Bubble'}
            </h2>
          </div>
          <button
            onClick={closeSidePanel}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Close panel"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        {/* Target line info */}
        {targetInsertLine && (
          <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-800/30 text-sm text-purple-300">
            Inserting at line {targetInsertLine}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isListView && (
            <BubbleListView
              filteredBubbles={filteredBubbles}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              bubbleTypes={bubbleTypes}
              onSelectBubble={selectBubble}
              onOpenGeneralChat={openGeneralChat}
              isLoading={!bubblesData}
            />
          )}

          {isPromptView && selectedBubbleName && (
            <BubblePromptView
              bubbleName={selectedBubbleName}
              bubbleDefinition={bubblesData?.bubbles.find(
                (b) => b.name === selectedBubbleName
              )}
            />
          )}

          {isGeneralChatView && <GeneralChatView />}
        </div>
      </div>
    </>
  );
}

/**
 * Bubble List View - Shows all available bubbles
 */
interface BubbleListViewProps {
  filteredBubbles: BubbleDefinition[] | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  bubbleTypes: string[];
  onSelectBubble: (bubbleName: string) => void;
  onOpenGeneralChat: () => void;
  isLoading: boolean;
}

function BubbleListView({
  filteredBubbles,
  searchQuery,
  setSearchQuery,
  selectedType,
  setSelectedType,
  bubbleTypes,
  onSelectBubble,
  onOpenGeneralChat,
  isLoading,
}: BubbleListViewProps) {
  return (
    <>
      {/* General Chat Button */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onOpenGeneralChat}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <span>General AI Chat</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="p-4 space-y-3 border-b border-gray-700">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bubbles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#2d2d2d] border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {bubbleTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bubble List */}
      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : filteredBubbles && filteredBubbles.length > 0 ? (
          <div className="p-2 space-y-2">
            {filteredBubbles.map((bubble) => {
              const logo = findLogoForBubble({ bubbleName: bubble.name });

              return (
                <button
                  key={bubble.name}
                  onClick={() => onSelectBubble(bubble.name)}
                  className="w-full text-left p-3 bg-[#252526] hover:bg-[#2d2d2d] border border-gray-700 hover:border-purple-600 rounded-lg transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {logo && (
                          <img
                            src={logo.file}
                            alt={`${logo.name} logo`}
                            className="h-4 w-4 opacity-80 shrink-0"
                            loading="lazy"
                          />
                        )}
                        <h3 className="font-medium text-gray-100 group-hover:text-purple-400 transition-colors">
                          {bubble.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {bubble.shortDescription}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded shrink-0">
                      {bubble.type.charAt(0).toUpperCase() +
                        bubble.type.slice(1)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No bubbles found</p>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Bubble Prompt View - Let user configure bubble with natural language
 */
interface BubblePromptViewProps {
  bubbleName: string;
  bubbleDefinition: BubbleDefinition | undefined;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string; // For user messages, this is the message. For assistant, this is the message text
  code?: string; // Optional code snippet for assistant responses
  resultType?: 'code' | 'question' | 'reject';
  timestamp: Date;
}

function BubblePromptView({ bubbleDefinition }: BubblePromptViewProps) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get logo for the bubble
  const logo = bubbleDefinition
    ? findLogoForBubble({ bubbleName: bubbleDefinition.name })
    : null;

  // MilkTea mutation
  const milkTeaMutation = useMilkTea();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, milkTeaMutation.isPending]);

  const handleGenerate = () => {
    if (!bubbleDefinition) {
      toast.error('Bubble definition not found');
      return;
    }

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

    milkTeaMutation.mutate(
      {
        userRequest: userMessage.content,
        bubbleName: bubbleDefinition.name,
        bubbleSchema: {
          name: bubbleDefinition.name,
          alias: bubbleDefinition.alias,
          type: bubbleDefinition.type,
          shortDescription: bubbleDefinition.shortDescription,
          inputSchema: bubbleDefinition.inputSchema,
          outputSchema: bubbleDefinition.outputSchema,
        },
        availableCredentials: bubbleDefinition.requiredCredentials,
        userName: 'User', // TODO: Get from auth context
        conversationHistory: [],
        model: 'openrouter/z-ai/glm-4.5-air',
      },
      {
        onSuccess: (result) => {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content:
              result.type === 'code' && result.snippet
                ? result.snippet
                : result.message || '',
            resultType: result.type,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        },
        onError: (error) => {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content:
              error instanceof Error
                ? error.message
                : 'Failed to generate code',
            resultType: 'reject',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        },
      }
    );
  };

  const handleInsert = (code: string) => {
    insertCodeAtTargetLine(code, false);
    toast.success('Code inserted!');
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Bubble Info */}
      {bubbleDefinition && (
        <div className="mb-4 p-3 bg-[#252526] border border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            {logo && (
              <img
                src={logo.file}
                alt={`${logo.name} logo`}
                className="h-5 w-5 opacity-80"
                loading="lazy"
              />
            )}
            <h3 className="font-medium text-gray-100">
              {bubbleDefinition.name}
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            {bubbleDefinition.shortDescription}
          </p>
          {bubbleDefinition.requiredCredentials.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {bubbleDefinition.requiredCredentials.map((cred) => (
                <span
                  key={cred}
                  className="text-xs px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded"
                >
                  {cred}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 space-y-3">
        {messages.length === 0 && !milkTeaMutation.isPending && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Start a conversation to configure this bubble
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
                    <pre className="text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto thin-scrollbar mb-2 p-2 bg-black/30 rounded">
                      {message.content}
                    </pre>
                    <button
                      onClick={() => handleInsert(message.content)}
                      className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Insert Code
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-gray-200">{message.content}</div>
                )}
              </div>
            )}
          </div>
        ))}

        {milkTeaMutation.isPending && (
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
            placeholder="Example: Send an email to all users in the waitlist..."
            className="bg-transparent text-gray-100 text-sm w-full h-20 placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0"
            disabled={milkTeaMutation.isPending}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                e.ctrlKey &&
                !milkTeaMutation.isPending &&
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
                disabled={!prompt.trim() || milkTeaMutation.isPending}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  !prompt.trim() || milkTeaMutation.isPending
                    ? 'bg-gray-700/40 border border-gray-700/60 cursor-not-allowed text-gray-500'
                    : 'bg-white text-gray-900 border border-white/80 hover:bg-gray-100 hover:border-gray-300 shadow-lg hover:scale-105'
                }`}
              >
                {milkTeaMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
              <div
                className={`mt-2 text-[10px] leading-none transition-colors duration-200 ${
                  !prompt.trim() || milkTeaMutation.isPending
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

/**
 * General Chat View - AI chat for general workflow assistance
 * Can read entire code and replace entire editor content
 */
function GeneralChatView() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const closeSidePanel = useEditorStore((state) => state.closeSidePanel);

  // General chat mutation
  const generalChatMutation = usePearl();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generalChatMutation.isPending]);

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

    generalChatMutation.mutate(
      {
        userRequest: userMessage.content,
        userName: 'User', // TODO: Get from auth context
        conversationHistory: messages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        availableVariables: [],
        currentCode: '',
        model: 'openrouter/z-ai/glm-4.5-air',
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
          };
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
    toast.success('Entire workflow replaced!');
    closeSidePanel();
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <p className="text-xs text-blue-300">
          💡 <strong>General AI Chat</strong> - Create complete workflows with
          multiple integrations. Generated code will replace your entire editor
          content.
        </p>
      </div>

      {/* Scrollable content area for messages/results */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 space-y-3">
        {messages.length === 0 && !generalChatMutation.isPending && (
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
                          Replace Entire Workflow
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

        {generalChatMutation.isPending && (
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
            disabled={generalChatMutation.isPending}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                e.ctrlKey &&
                !generalChatMutation.isPending &&
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
                disabled={!prompt.trim() || generalChatMutation.isPending}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  !prompt.trim() || generalChatMutation.isPending
                    ? 'bg-gray-700/40 border border-gray-700/60 cursor-not-allowed text-gray-500'
                    : 'bg-white text-gray-900 border border-white/80 hover:bg-gray-100 hover:border-gray-300 shadow-lg hover:scale-105'
                }`}
              >
                {generalChatMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
              <div
                className={`mt-2 text-[10px] leading-none transition-colors duration-200 ${
                  !prompt.trim() || generalChatMutation.isPending
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
