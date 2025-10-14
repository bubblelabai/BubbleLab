import { useState, useEffect } from 'react';
import {
  X,
  Search,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  useEditorStore,
  selectIsListView,
  selectIsPromptView,
  insertCodeAtTargetLine,
} from '../stores/editorStore';
import { useMilkTea } from '../hooks/useMilkTea';
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

  // Store state
  const isSidePanelOpen = useEditorStore((state) => state.isSidePanelOpen);
  const selectedBubbleName = useEditorStore(
    (state) => state.selectedBubbleName
  );
  const targetInsertLine = useEditorStore((state) => state.targetInsertLine);
  const closeSidePanel = useEditorStore((state) => state.closeSidePanel);
  const selectBubble = useEditorStore((state) => state.selectBubble);

  const isListView = useEditorStore(selectIsListView);
  const isPromptView = useEditorStore(selectIsPromptView);

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
    <div
      className="fixed inset-y-0 left-0 w-96 bg-[#1e1e1e] border-r border-gray-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
      style={{
        transform: isSidePanelOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {isPromptView && (
            <button
              onClick={() => selectBubble(null)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Back to bubble list"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
          )}
          <h2 className="text-lg font-semibold text-gray-100">
            {isPromptView ? `Configure ${selectedBubbleName}` : 'Add Bubble'}
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
      </div>
    </div>
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
  isLoading,
}: BubbleListViewProps) {
  return (
    <>
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

function BubblePromptView({
  bubbleName,
  bubbleDefinition,
}: BubblePromptViewProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedSnippet, setGeneratedSnippet] = useState<string | null>(null);

  const closeSidePanel = useEditorStore((state) => state.closeSidePanel);

  // Get logo for the bubble
  const logo = bubbleDefinition
    ? findLogoForBubble({ bubbleName: bubbleDefinition.name })
    : null;

  // MilkTea mutation
  const milkTeaMutation = useMilkTea();

  const handleGenerate = () => {
    if (!bubbleDefinition) {
      toast.error('Bubble definition not found');
      return;
    }

    milkTeaMutation.mutate(
      {
        userRequest: prompt,
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
        model: 'google/gemini-2.5-flash',
      },
      {
        onSuccess: (result) => {
          if (result.type === 'code' && result.snippet) {
            setGeneratedSnippet(result.snippet);
            toast.success('Code generated successfully!');
          } else if (result.type === 'question') {
            toast.info(result.message);
          } else if (result.type === 'reject') {
            toast.error(result.message);
          }
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : 'Failed to generate code'
          );
        },
      }
    );
  };

  const handleInsert = () => {
    if (generatedSnippet) {
      insertCodeAtTargetLine(generatedSnippet, false);
      toast.success('Code inserted!');
      closeSidePanel();
    }
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

      {/* Prompt Input */}
      <div className="flex-1 flex flex-col gap-3">
        <label className="text-sm font-medium text-gray-300">
          Describe what you want this bubble to do:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: Send an email to all users in the waitlist array with subject 'Welcome!' and a greeting message..."
          className="flex-1 min-h-[200px] p-3 bg-[#2d2d2d] border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          disabled={milkTeaMutation.isPending}
        />

        {/* Show generated snippet */}
        {generatedSnippet && (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">
                Code Generated
              </span>
            </div>
            <pre className="text-xs text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
              {generatedSnippet}
            </pre>
          </div>
        )}

        {/* Show error */}
        {milkTeaMutation.isError && (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">
                {milkTeaMutation.error instanceof Error
                  ? milkTeaMutation.error.message
                  : 'Failed to generate code'}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {generatedSnippet ? (
            <>
              <button
                onClick={() => {
                  setGeneratedSnippet(null);
                  setPrompt('');
                  milkTeaMutation.reset();
                }}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleInsert}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Insert Code
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || milkTeaMutation.isPending}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {milkTeaMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Code'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
