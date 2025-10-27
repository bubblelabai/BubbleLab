import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/pages/DashboardPage';
import { useGenerationStore } from '@/stores/generationStore';
import { useFlowGeneration } from '@/hooks/useFlowGeneration';
import { useUIStore } from '@/stores/uiStore';

interface NewRouteSearch {
  showSignIn?: boolean;
}

export const Route = createFileRoute('/new')({
  component: NewFlowPage,
  validateSearch: (search: Record<string, unknown>): NewRouteSearch => {
    return {
      showSignIn: search.showSignIn === true || search.showSignIn === 'true',
    };
  },
});

function NewFlowPage() {
  const { showSignIn } = Route.useSearch();
  const {
    generationPrompt,
    selectedPreset,
    setGenerationPrompt,
    isStreaming,
    setSelectedPreset,
  } = useGenerationStore();

  const { closeSidebar } = useUIStore();
  const { generateCode: generateCodeFromHook } = useFlowGeneration();

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
      autoShowSignIn={showSignIn}
    />
  );
}
