import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, Pencil, FileDown, Plus } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { useCreateBubbleFlow } from '../hooks/useCreateBubbleFlow';
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
  getTemplateByIndex,
  type TemplateCategory,
} from '../components/templates/templateLoader';
import { trackTemplate } from '../services/analytics';
import { GenerationOutputOverlay } from '../components/GenerationOutputOverlay';

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

export interface DashboardPageProps {
  isStreaming: boolean;
  generationPrompt: string;
  setGenerationPrompt: (prompt: string) => void;
  selectedPreset: number;
  setSelectedPreset: (preset: number) => void;
  onGenerateCode: () => void;
  autoShowSignIn?: boolean;
}

export function DashboardPage({
  isStreaming,
  generationPrompt,
  setGenerationPrompt,
  selectedPreset,
  setSelectedPreset,
  onGenerateCode,
  autoShowSignIn = false,
}: DashboardPageProps) {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const createBubbleFlowMutation = useCreateBubbleFlow();
  const [showSignInModal, setShowSignInModal] = useState(autoShowSignIn);
  const [selectedCategory, setSelectedCategory] =
    useState<TemplateCategory | null>('Prompt');
  const [savedPrompt, setSavedPrompt] = useState<string>(() => {
    // Load saved prompt from localStorage on initialization
    try {
      return localStorage.getItem('savedPrompt') || '';
    } catch (error) {
      console.warn('Failed to load saved prompt from localStorage:', error);
      return '';
    }
  });
  const [savedPresetIndex, setSavedPresetIndex] = useState<number>(() => {
    // Load saved preset index from localStorage on initialization
    try {
      const saved = localStorage.getItem('savedPresetIndex');
      return saved ? parseInt(saved, 10) : -1;
    } catch (error) {
      console.warn(
        'Failed to load saved preset index from localStorage:',
        error
      );
      return -1;
    }
  });
  const [pendingGeneration, setPendingGeneration] = useState<boolean>(false);
  const [pendingJsonImport, setPendingJsonImport] = useState<boolean>(false);
  const [isCreatingFromScratch, setIsCreatingFromScratch] =
    useState<boolean>(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const isGenerateDisabled = useMemo(
    () => isStreaming || !generationPrompt?.trim(),
    [isStreaming, generationPrompt]
  );

  // Handler for "Build from Scratch" button
  const handleBuildFromScratch = async () => {
    if (!isSignedIn) {
      setShowSignInModal(true);
      return;
    }

    setIsCreatingFromScratch(true);
    try {
      // Create a minimal empty flow template
      const emptyFlowCode = `import { BubbleFlow, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  input: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { input = 'example value' } = payload;
    
    return {
      message: \`Received input: \${input}\`,
    };
  }
}
`;

      const createResult = await createBubbleFlowMutation.mutateAsync({
        name: 'Untitled',
        description: 'Empty flow created from scratch',
        code: emptyFlowCode,
        prompt: '',
        eventType: 'webhook/http',
        webhookActive: false,
      });

      // Navigate to the newly created flow
      navigate({
        to: '/flow/$flowId',
        params: { flowId: String(createResult.id) },
      });
    } catch (error) {
      console.error('Failed to create empty flow:', error);
      setIsCreatingFromScratch(false);
    }
  };

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

      // If this was a template click, restore the preset and trigger generation
      if (savedPresetIndex !== -1) {
        setSelectedPreset(savedPresetIndex);
        setPendingGeneration(true);

        // Track template click
        const template = getTemplateByIndex(savedPresetIndex);
        if (template) {
          trackTemplate({
            action: 'click',
            templateId: template.id,
            templateName: template.name,
            templateCategory: template.category,
          });
        }
      }

      // Clear saved state
      setSavedPrompt('');
      setSavedPresetIndex(-1);
      localStorage.removeItem('savedPrompt');
      localStorage.removeItem('savedPresetIndex');
    } else if (isSignedIn) {
      setShowSignInModal(false);
    }
  }, [
    isSignedIn,
    savedPrompt,
    savedPresetIndex,
    setGenerationPrompt,
    setSelectedPreset,
  ]);

  // Clear generation prompt when "Prompt" or "Import JSON" category is selected
  useEffect(() => {
    if (
      (selectedCategory === 'Prompt' || selectedCategory === 'Import JSON') &&
      generationPrompt.trim()
    ) {
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

  // Handle pending JSON import after prompt is updated with system message
  useEffect(() => {
    if (pendingJsonImport && generationPrompt.trim()) {
      setPendingJsonImport(false);
      onGenerateCode();
    }
  }, [pendingJsonImport, generationPrompt, onGenerateCode]);

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto space-y-8 py-12 px-4 sm:px-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="text-center mb-14">
              {/* Discord Community Link */}
              <div className="mb-4 text-center">
                <a
                  href="https://discord.com/invite/PkJvcU2myV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Join Discord Community
                </a>
              </div>
              <h1 className="text-4xl font-bold text-white">
                Workflows that you can observe and export
              </h1>
            </div>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {/* Prompt - First button */}
            {TEMPLATE_CATEGORIES.includes('Prompt') && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Prompt')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                  selectedCategory === 'Prompt'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a] hover:text-white'
                }`}
              >
                <Pencil className="w-4 h-4" />
                Prompt
              </button>
            )}
            {/* Import JSON - Second button */}
            {TEMPLATE_CATEGORIES.includes('Import JSON') && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Import JSON')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                  selectedCategory === 'Import JSON'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a] hover:text-white'
                }`}
              >
                <FileDown className="w-4 h-4" />
                Import JSON
              </button>
            )}
            {/* All Templates - Third button */}
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
            {/* Rest of the categories (excluding Prompt and Import JSON) */}
            {TEMPLATE_CATEGORIES.filter(
              (cat) => cat !== 'Prompt' && cat !== 'Import JSON'
            ).map((category) => (
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
            {/* Build from Scratch - Last button */}
            <button
              type="button"
              onClick={handleBuildFromScratch}
              disabled={isStreaming || isCreatingFromScratch}
              className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                isStreaming || isCreatingFromScratch
                  ? 'bg-gray-700/40 text-gray-500 cursor-not-allowed'
                  : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a] hover:text-white'
              }`}
            >
              {isCreatingFromScratch ? (
                <>
                  <span className="inline-block animate-spin">⚙</span>
                  Creating Empty Flow...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Build from Scratch
                </>
              )}
            </button>
          </div>

          {/* Templates Grid */}
          {selectedCategory === 'Prompt' ? (
            <div className="bg-[#252525] rounded-xl p-6 shadow-lg">
              {/* Custom Prompt Section */}
              <div>
                <textarea
                  ref={promptRef}
                  placeholder="Read in my Google Calendar and send me an email with my upcoming events"
                  value={generationPrompt}
                  onChange={(e) => {
                    setGenerationPrompt(e.target.value);
                    if (selectedPreset !== -1) {
                      setSelectedPreset(-1);
                    }
                    if (
                      !e.target.value.trim() &&
                      (savedPrompt || savedPresetIndex !== -1)
                    ) {
                      setSavedPrompt('');
                      setSavedPresetIndex(-1);
                      localStorage.removeItem('savedPrompt');
                      localStorage.removeItem('savedPresetIndex');
                    }
                  }}
                  onInput={(e) => autoResize(e.currentTarget)}
                  className="bg-transparent text-gray-100 text-sm w-full min-h-[8rem] max-h-[18rem] placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0 overflow-y-auto thin-scrollbar"
                  onKeyDown={(e) => {
                    // Only allow Ctrl+Enter for "Prompt" category
                    if (
                      e.key === 'Enter' &&
                      e.ctrlKey &&
                      !isStreaming &&
                      selectedCategory === 'Prompt'
                    ) {
                      if (!isSignedIn) {
                        if (generationPrompt.trim()) {
                          setSavedPrompt(generationPrompt);
                          localStorage.setItem('savedPrompt', generationPrompt);
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
          ) : selectedCategory === 'Import JSON' ? (
            <div className="bg-[#252525] rounded-xl p-6 shadow-lg">
              {/* Import JSON Section */}
              <div>
                <textarea
                  ref={promptRef}
                  placeholder="Paste in your JSON workflow..."
                  value={generationPrompt}
                  onChange={(e) => {
                    setGenerationPrompt(e.target.value);
                    if (selectedPreset !== -1) {
                      setSelectedPreset(-1);
                    }
                    if (
                      !e.target.value.trim() &&
                      (savedPrompt || savedPresetIndex !== -1)
                    ) {
                      setSavedPrompt('');
                      setSavedPresetIndex(-1);
                      localStorage.removeItem('savedPrompt');
                      localStorage.removeItem('savedPresetIndex');
                    }
                  }}
                  onInput={(e) => autoResize(e.currentTarget)}
                  className="bg-transparent text-gray-100 text-sm w-full min-h-[8rem] max-h-[18rem] placeholder-gray-400 resize-none focus:outline-none focus:ring-0 p-0 overflow-y-auto thin-scrollbar"
                  onKeyDown={(e) => {
                    // Only allow Ctrl+Enter for "Import JSON" category
                    if (
                      e.key === 'Enter' &&
                      e.ctrlKey &&
                      !isStreaming &&
                      selectedCategory === 'Import JSON'
                    ) {
                      if (!isSignedIn) {
                        if (generationPrompt.trim()) {
                          setSavedPrompt(generationPrompt);
                          localStorage.setItem('savedPrompt', generationPrompt);
                        }
                        setShowSignInModal(true);
                        return;
                      }
                      // Prepend system prompt before generating
                      const jsonContent = generationPrompt.trim();
                      setGenerationPrompt(
                        `Convert the following JSON file to a workflow:\n\n${jsonContent}`
                      );
                      setPendingJsonImport(true);
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
                        // Prepend system prompt before generating
                        const jsonContent = generationPrompt.trim();
                        setGenerationPrompt(
                          `Convert the following JSON file to a workflow:\n\n${jsonContent}`
                        );
                        setPendingJsonImport(true);
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
                          setSavedPresetIndex(originalIndex);
                          localStorage.setItem(
                            'savedPresetIndex',
                            originalIndex.toString()
                          );
                        }
                        setShowSignInModal(true);
                        return;
                      }

                      // Track template click
                      const template = getTemplateByIndex(originalIndex);
                      if (template) {
                        trackTemplate({
                          action: 'click',
                          templateId: template.id,
                          templateName: template.name,
                          templateCategory: template.category,
                        });
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

          {(selectedCategory === 'Prompt' ||
            selectedCategory === 'Import JSON') &&
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

      {/* Sign In Modal - shows when user is not signed in */}
      <SignInModal
        isVisible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
      <GenerationOutputOverlay />
    </div>
  );
}
