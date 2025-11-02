import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useGenerationStore } from '@/stores/generationStore';
import { useUIStore } from '@/stores/uiStore';
import { useFlowGeneration } from './useFlowGeneration';

interface UsePromptFromURLOptions {
  prompt?: string;
}

interface UsePromptFromURLReturn {
  showSignInModal: boolean;
}

/**
 * Hook to handle prompt parameter from URL
 *
 * Behavior:
 * - If user is NOT signed in: Shows sign-in modal and saves prompt
 * - If user IS signed in: Auto-triggers generation
 *
 * This matches the behavior of manually clicking the generate button
 */
export const usePromptFromURL = (
  options: UsePromptFromURLOptions
): UsePromptFromURLReturn => {
  const { prompt } = options;
  const { isSignedIn } = useAuth();
  const { setGenerationPrompt, selectedPreset } = useGenerationStore();
  const { closeSidebar } = useUIStore();
  const { generateCode: generateCodeFromHook } = useFlowGeneration();

  // Track if we've already processed the URL prompt
  const hasProcessedPromptRef = useRef(false);

  // Local state to control sign-in modal (for prompt parameter flow)
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Handle prompt from URL - check auth and either show sign-in or auto-generate
  useEffect(() => {
    if (prompt && !hasProcessedPromptRef.current) {
      hasProcessedPromptRef.current = true;
      const decodedPrompt = decodeURIComponent(prompt);
      setGenerationPrompt(decodedPrompt);

      // Check authentication - same logic as generate button
      if (!isSignedIn) {
        // Save prompt for after sign-in (same as DashboardPage button logic)
        localStorage.setItem('savedPrompt', decodedPrompt);
        setShowSignInModal(true);
      } else {
        // User is signed in, auto-trigger generation
        closeSidebar();
        generateCodeFromHook(decodedPrompt, selectedPreset);
      }
    }
  }, [
    prompt,
    isSignedIn,
    setGenerationPrompt,
    closeSidebar,
    generateCodeFromHook,
    selectedPreset,
  ]);

  return {
    showSignInModal,
  };
};
