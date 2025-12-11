import { useEffect } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

/**
 * GenerationOutputOverlay
 *
 * Minimal full-screen overlay showing a sleek loading spinner during generation.
 * - Shows white loading spiral while isStreaming
 * - Auto-navigates on success
 * - Auto-dismisses on error
 */
export function GenerationOutputOverlay() {
  const {
    isStreaming,
    generationResult,
    setGenerationResult,
    stopGenerationFlow,
  } = useGenerationStore();
  const { clearOutput } = useOutputStore();
  const navigate = useNavigate();

  // Auto-navigate on successful generation
  useEffect(() => {
    if (!isStreaming && generationResult?.success && generationResult.flowId) {
      // Clear state and navigate
      const flowId = generationResult.flowId.toString();
      setGenerationResult(null);
      stopGenerationFlow();
      clearOutput();
      navigate({
        to: '/flow/$flowId',
        params: { flowId },
      });
    }
  }, [
    isStreaming,
    generationResult,
    navigate,
    setGenerationResult,
    stopGenerationFlow,
    clearOutput,
  ]);

  // Auto-dismiss on error
  useEffect(() => {
    if (!isStreaming && generationResult && !generationResult.success) {
      // Clear state after a brief delay
      const timeout = setTimeout(() => {
        clearOutput();
        setGenerationResult(null);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, generationResult, clearOutput, setGenerationResult]);

  // Only show while streaming
  if (!isStreaming) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <Loader2 className="w-12 h-12 text-white animate-spin" />
    </div>
  );
}
