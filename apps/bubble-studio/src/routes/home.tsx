import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/pages/DashboardPage';
import { useGenerationStore } from '@/stores/generationStore';
import { useFlowGeneration } from '@/hooks/useFlowGeneration';
import { useUIStore } from '@/stores/uiStore';
import { usePromptFromURL } from '@/hooks/usePromptFromURL';

interface HomeRouteSearch {
  showSignIn?: boolean;
  prompt?: string;
}

export const Route = createFileRoute('/home')({
  component: NewFlowPage,
  validateSearch: (search: Record<string, unknown>): HomeRouteSearch => {
    return {
      showSignIn: search.showSignIn === true || search.showSignIn === 'true',
      prompt: typeof search.prompt === 'string' ? search.prompt : undefined,
    };
  },
});

function NewFlowPage() {
  const { showSignIn, prompt } = Route.useSearch();
  const {
    generationPrompt,
    selectedPreset,
    setGenerationPrompt,
    isStreaming,
    setSelectedPreset,
  } = useGenerationStore();

  const { closeSidebar } = useUIStore();
  const { generateCode: generateCodeFromHook } = useFlowGeneration();

  // Handle prompt from URL with authentication check
  const { showSignInModal } = usePromptFromURL({ prompt });

  // Wrapper function that calls the hook's generateCode with proper parameters
  const generateCode = async () => {
    // Hide the sidebar so the IDE has maximum space during a new generation
    closeSidebar();

    await generateCodeFromHook(generationPrompt, selectedPreset);
  };

  return (
    <DashboardPage
      isStreaming={isStreaming}
      generationPrompt={generationPrompt}
      setGenerationPrompt={setGenerationPrompt}
      selectedPreset={selectedPreset}
      setSelectedPreset={setSelectedPreset}
      onGenerateCode={generateCode}
      autoShowSignIn={showSignIn || showSignInModal}
    />
  );
}
