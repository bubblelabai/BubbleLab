import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import {
  INTEGRATIONS,
  AI_MODELS,
  resolveLogoByName,
} from '../lib/integrations';
import { SignInModal } from '../components/SignInModal';
import {
  TEMPLATE_CATEGORIES,
  PRESET_PROMPTS,
  getTemplateCategories,
  isTemplateHidden,
  type TemplateCategory,
} from '../components/templates/templateLoader';

// LoadingDots component using bouncing animation for code generation
const LoadingDots: React.FC = () => {
  return (
    <span className="inline-block animate-bounce text-purple-200 font-bold ml-1">
      ●●●
    </span>
  );
};

// INTEGRATIONS and AI_MODELS now imported from shared lib

// Removed initials helper; using image-only rendering

interface DashboardPageProps {
  isStreaming: boolean;
  generationPrompt: string;
  setGenerationPrompt: (prompt: string) => void;
  selectedPreset: number;
  setSelectedPreset: (preset: number) => void;
  onGenerateCode: () => void;
  // Sidebar props
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onPageChange: (
    page: 'prompt' | 'ide' | 'credentials' | 'flow-summary'
  ) => void;
  selectedFlow: number | null;
  onFlowSelect: (flowId: number) => void;
  onFlowDelete: (flowId: number, event: React.MouseEvent) => void;
}

export function DashboardPage({
  isStreaming,
  generationPrompt,
  setGenerationPrompt,
  selectedPreset,
  setSelectedPreset,
  onGenerateCode,
  // Sidebar props
  isSidebarOpen,
  onSidebarToggle,
  onPageChange,
  selectedFlow,
  onFlowSelect,
  onFlowDelete,
}: DashboardPageProps) {
  const { isSignedIn } = useAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<TemplateCategory | null>(null);
  const [savedPrompt, setSavedPrompt] = useState<string>(() => {
    // Load saved prompt from localStorage on initialization
    try {
      return localStorage.getItem('savedPrompt') || '';
    } catch (error) {
      console.warn('Failed to load saved prompt from localStorage:', error);
      return '';
    }
  });
  const [pendingGeneration, setPendingGeneration] = useState<boolean>(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const isGenerateDisabled = useMemo(
    () => isStreaming || !generationPrompt?.trim(),
    [isStreaming, generationPrompt]
  );

  // no-op

  // Filter templates based on selected category
  const filteredTemplates = useMemo(() => {
    if (!selectedCategory)
      return PRESET_PROMPTS.filter((_, index) => !isTemplateHidden(index));

    return PRESET_PROMPTS.filter((_, index) => {
      if (isTemplateHidden(index)) return false;
      const categories = getTemplateCategories(index);
      return categories.includes(selectedCategory);
    });
  }, [selectedCategory]);

  // Auto-resize the prompt textarea up to a max height, then show scrollbar
  const autoResize = (el: HTMLTextAreaElement) => {
    const maxHeightPx = 288; // 18rem
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (promptRef.current) {
      autoResize(promptRef.current);
    }
  }, [generationPrompt]);

  // Hide sign in modal when user signs in and restore saved prompt
  useEffect(() => {
    if (isSignedIn && savedPrompt) {
      setShowSignInModal(false);
      setGenerationPrompt(savedPrompt);
      setSavedPrompt(''); // Clear the saved prompt after restoring
      localStorage.removeItem('savedPrompt'); // Also clear from localStorage
    } else if (isSignedIn) {
      setShowSignInModal(false);
    }
  }, [isSignedIn, savedPrompt, setGenerationPrompt]);

  // Clear generation prompt when "Generate your own" category is selected
  useEffect(() => {
    if (selectedCategory === 'Generate your own' && generationPrompt.trim()) {
      setGenerationPrompt('');
      setSelectedPreset(-1);
    }
  }, [selectedCategory, setGenerationPrompt, setSelectedPreset]);

  // Handle pending generation after state is updated
  useEffect(() => {
    if (pendingGeneration && selectedPreset !== -1 && generationPrompt.trim()) {
      setPendingGeneration(false);
      onGenerateCode();
    }
  }, [pendingGeneration, selectedPreset, generationPrompt, onGenerateCode]);

  // Wrapper function to check authentication before navigation
  const handlePageChange = (
    page: 'prompt' | 'ide' | 'credentials' | 'flow-summary'
  ) => {
    // If trying to navigate away from dashboard and not signed in, show modal
    if (page !== 'prompt' && !isSignedIn) {
      // Save the current prompt before showing sign-in modal
      if (generationPrompt.trim()) {
        setSavedPrompt(generationPrompt);
        localStorage.setItem('savedPrompt', generationPrompt);
      }
      setShowSignInModal(true);
      return;
    }
    // If signed in or staying on dashboard, allow navigation
    onPageChange(page);
  };

  // Wrapper function to check authentication before flow selection
  const handleFlowSelect = (flow: number) => {
    if (!isSignedIn) {
      // Save the current prompt before showing sign-in modal
      if (generationPrompt.trim()) {
        setSavedPrompt(generationPrompt);
        localStorage.setItem('savedPrompt', generationPrompt);
      }
      setShowSignInModal(true);
      return;
    }
    onFlowSelect(flow);
  };

  return (
    <>
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={onSidebarToggle}
        selectedFlowId={selectedFlow}
        onPageChange={handlePageChange}
        onFlowSelect={handleFlowSelect}
        onFlowDelete={onFlowDelete}
      />

      <div
        className={`h-screen flex flex-col bg-[#1a1a1a] text-gray-100 ${isSidebarOpen ? 'pl-56' : 'pl-14'}`}
      >
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto space-y-8 py-12 px-4 sm:px-6">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="text-center mb-4">
                <h1 className="text-3xl font-bold text-white">
                  Workflows that you can observe and export
                </h1>
                <p className="text-lg text-gray-400 mt-2">
                  Pick a template to get started, or write your own prompt
                </p>
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  !selectedCategory
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a] hover:text-white'
                }`}
              >
                All Templates
              </button>
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedCategory === category
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a] hover:text-white'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            {selectedCategory === 'Generate your own' ? (
              <div className="bg-[#252525] rounded-xl p-6 shadow-lg">
                {/* Custom Prompt Section */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-100 mb-2">
                      Write a detailed prompt about the automation you'd like to
                      create
                    </h3>
                  </div>
                  <textarea
                    ref={promptRef}
                    placeholder="Describe the workflow..."
                    value={generationPrompt}
                    onChange={(e) => {
                      setGenerationPrompt(e.target.value);
                      if (selectedPreset !== -1) {
                        setSelectedPreset(-1);
                      }
                      if (!e.target.value.trim() && savedPrompt) {
                        setSavedPrompt('');
                        localStorage.removeItem('savedPrompt');
                      }
                    }}
                    onInput={(e) => autoResize(e.currentTarget)}
                    className="bg-transparent text-gray-100 text-sm w-full min-h-[8rem] max-h-[18rem] placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0 overflow-y-auto thin-scrollbar"
                    onKeyDown={(e) => {
                      // Only allow Ctrl+Enter for "Generate your own" category
                      if (
                        e.key === 'Enter' &&
                        e.ctrlKey &&
                        !isStreaming &&
                        selectedCategory === 'Generate your own'
                      ) {
                        if (!isSignedIn) {
                          if (generationPrompt.trim()) {
                            setSavedPrompt(generationPrompt);
                            localStorage.setItem(
                              'savedPrompt',
                              generationPrompt
                            );
                          }
                          setShowSignInModal(true);
                          return;
                        }
                        onGenerateCode();
                      }
                    }}
                  />

                  {/* Generate Button - Inside the prompt container */}
                  <div className="flex justify-end mt-4">
                    <div className="flex flex-col items-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isSignedIn) {
                            if (generationPrompt.trim()) {
                              setSavedPrompt(generationPrompt);
                              localStorage.setItem(
                                'savedPrompt',
                                generationPrompt
                              );
                            }
                            setShowSignInModal(true);
                            return;
                          }
                          onGenerateCode();
                        }}
                        disabled={isGenerateDisabled}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isGenerateDisabled
                            ? 'bg-gray-700/40 border border-gray-700/60 cursor-not-allowed text-gray-500'
                            : 'bg-white text-gray-900 border border-white/80 hover:bg-gray-100 hover:border-gray-300 shadow-lg hover:scale-105'
                        }`}
                      >
                        {isStreaming ? (
                          <LoadingDots />
                        ) : (
                          <ArrowUp className="w-5 h-5" />
                        )}
                      </button>
                      <div
                        className={`mt-2 text-[10px] leading-none transition-colors duration-200 ${
                          isGenerateDisabled
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
            ) : (
              /* Template Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4 items-start">
                {filteredTemplates.map((preset) => {
                  // Find the original index in PRESET_PROMPTS to maintain correct mapping
                  const originalIndex = PRESET_PROMPTS.findIndex(
                    (p) => p === preset
                  );
                  const match = preset.name.match(/\(([^)]+)\)/);
                  const logos = match
                    ? (match[1]
                        .split(',')
                        .map((s) => s.trim())
                        .map((name) => resolveLogoByName(name))
                        .filter(Boolean) as { name: string; file: string }[])
                    : ([] as { name: string; file: string }[]);
                  const isActive = selectedPreset === originalIndex;
                  return (
                    <button
                      key={originalIndex}
                      type="button"
                      onClick={() => {
                        // Check authentication first
                        if (!isSignedIn) {
                          if (preset.prompt.trim()) {
                            setSavedPrompt(preset.prompt);
                            localStorage.setItem('savedPrompt', preset.prompt);
                          }
                          setShowSignInModal(true);
                          return;
                        }

                        // Set the preset and prompt, then trigger generation
                        setSelectedPreset(originalIndex);
                        setGenerationPrompt(preset.prompt);
                        setPendingGeneration(true);
                      }}
                      disabled={isStreaming}
                      className={`w-full h-full text-left p-4 rounded-lg border transition flex flex-col ${
                        isActive
                          ? 'border-purple-600/60 bg-[#2b2b2b]'
                          : 'border-[#3a3a3a] hover:border-[#4a4a4a] hover:bg-[#2a2a2a]'
                      } ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex flex-col gap-2 flex-grow">
                        {logos.length > 0 && (
                          <div className="flex items-center gap-2 mb-1">
                            {logos.slice(0, 5).map((integration) => (
                              <img
                                key={integration.name}
                                src={integration.file}
                                alt={`${integration.name} logo`}
                                className="h-5 w-5 opacity-80"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        )}
                        <div className="text-sm font-semibold text-white mb-2">
                          {preset.name}
                        </div>
                        <div className="text-sm font-medium text-gray-100 flex-grow">
                          {preset.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCategory === 'Generate your own' &&
              selectedPreset === -1 && (
                <div className="mt-16 p-5 bg-[#0d1117] border border-[#30363d] rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold tracking-wide text-gray-400">
                      Current Supported Integrations
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                    {INTEGRATIONS.map((integration) => (
                      <div
                        key={integration.name}
                        className="flex items-center gap-2 md:gap-3 p-1"
                      >
                        <img
                          src={integration.file}
                          alt={`${integration.name} logo`}
                          className="h-5 w-5 md:h-6 md:w-6"
                          loading="lazy"
                        />
                        <p className="text-sm text-gray-200 truncate">
                          {integration.name}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8">
                    <p className="text-xs font-semibold tracking-wide text-gray-400 mb-3">
                      Current Supported AI Models
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                      {AI_MODELS.map((model) => (
                        <div
                          key={model.name}
                          className="flex items-center gap-2 md:gap-3 p-1"
                        >
                          <img
                            src={model.file}
                            alt={`${model.name} logo`}
                            className="h-5 w-5 md:h-6 md:w-6"
                            loading="lazy"
                          />
                          <p className="text-sm text-gray-200 truncate">
                            {model.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Sign In Modal - shows when user is not signed in */}
      <SignInModal
        isVisible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </>
  );
}
