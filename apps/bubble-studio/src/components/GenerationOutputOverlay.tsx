import { useEffect, useRef } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useNavigate } from '@tanstack/react-router';
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Coins,
  Boxes,
} from 'lucide-react';

/**
 * GenerationOutputOverlay
 *
 * Full-screen overlay that displays real-time flow generation progress.
 * - Auto-shows when isStreaming === true
 * - Reads output directly from outputStore
 * - No props needed - self-contained component
 *
 * Success case: Auto-dismisses when navigation occurs
 * Error case: Shows error with close button for retry
 */
export function GenerationOutputOverlay() {
  const {
    isStreaming,
    generationResult,
    setGenerationResult,
    stopGenerationFlow,
  } = useGenerationStore();
  const { output, clearOutput } = useOutputStore();
  const navigate = useNavigate();
  const outputEndRef = useRef<HTMLDivElement>(null);

  console.log('[GenerationOutputOverlay] generationResult:', generationResult);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Don't show if not streaming and no output and no result
  if (!isStreaming && !output && !generationResult) return null;

  const hasError = generationResult?.success ? false : true;

  const handleClose = () => {
    if (!isStreaming) {
      clearOutput();
      setGenerationResult(null);
    }
  };

  const handleOpenFlow = () => {
    if (!generationResult) return;

    // Clear state and navigate
    setGenerationResult(null);
    stopGenerationFlow();
    clearOutput();
    navigate({
      to: '/flow/$flowId',
      params: { flowId: generationResult.flowId?.toString() || '' },
    });
  };

  // Parse output lines and determine their type
  const parseMessageType = (line: string) => {
    if (!line.trim()) return { type: 'empty', icon: null, color: '' };

    if (
      line.includes('Error:') ||
      line.includes('Failed') ||
      line.includes('❌')
    ) {
      return {
        type: 'error',
        icon: <XCircle className="w-5 h-5 flex-shrink-0" />,
        color: 'text-red-400',
        bgColor: 'bg-red-900/20',
        borderColor: 'border-red-700/30',
      };
    }

    if (
      line.includes('✅') ||
      line.includes('complete') ||
      line.includes('created')
    ) {
      return {
        type: 'success',
        icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
        color: 'text-green-400',
        bgColor: 'bg-green-900/20',
        borderColor: 'border-green-700/30',
      };
    }

    if (line.includes('...')) {
      return {
        type: 'loading',
        icon: <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-900/20',
        borderColor: 'border-blue-700/30',
      };
    }

    if (
      line.includes('Pearl is') ||
      line.includes('AI analyzing') ||
      line.includes('Discovering') ||
      line.includes('Creating') ||
      line.includes('Understanding') ||
      line.includes('Validating') ||
      line.includes('refining')
    ) {
      return {
        type: 'ai',
        icon: <Sparkles className="w-5 h-5 flex-shrink-0" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-900/20',
        borderColor: 'border-purple-700/30',
      };
    }

    return {
      type: 'info',
      icon: <Info className="w-5 h-5 flex-shrink-0" />,
      color: 'text-gray-400',
      bgColor: 'bg-gray-800/20',
      borderColor: 'border-gray-700/30',
    };
  };

  const messages = output.split('\n').filter((line) => line.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl mx-6 bg-gradient-to-b from-[#0d1117] to-[#0a0d12] border border-[#30363d] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#30363d]">
          <div className="flex items-center gap-4">
            {isStreaming ? (
              <div className="relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
              </div>
            ) : hasError ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-100">
                {isStreaming
                  ? 'Generating Your Flow'
                  : hasError
                    ? 'Generation Failed'
                    : 'Generation Complete'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {isStreaming
                  ? 'Pearl is crafting your workflow...'
                  : hasError
                    ? 'Something went wrong during generation'
                    : 'Your flow is ready!'}
              </p>
            </div>
          </div>

          {/* Close button - only enabled when not streaming */}
          <button
            onClick={handleClose}
            disabled={isStreaming}
            className={`p-2 rounded-lg transition-all ${
              isStreaming
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d] hover:scale-110'
            }`}
            title={isStreaming ? 'Generation in progress...' : 'Close'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Output Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 thin-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-base">Initializing generation...</p>
            </div>
          ) : (
            messages.map((line, index) => {
              const messageInfo = parseMessageType(line);

              if (messageInfo.type === 'empty') return null;

              return (
                <div
                  key={index}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${messageInfo.bgColor} ${messageInfo.borderColor} animate-in slide-in-from-left-2 duration-200`}
                >
                  <div className={messageInfo.color}>{messageInfo.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`${messageInfo.color} text-base font-medium leading-relaxed`}
                    >
                      {line.replace(/✅|❌|🎯|🚀/g, '').trim()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={outputEndRef} />
        </div>

        {/* Footer - only show when not streaming */}
        {!isStreaming && (
          <div className="p-6 border-t border-[#30363d] bg-[#161b22]">
            {hasError ? (
              // Error State
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-base text-red-300 flex-1">
                    Generation failed. You can close this dialog to modify your
                    prompt and try again.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-lg transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                  >
                    Try Again
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : generationResult ? (
              // Success State - Show Summary and Stats
              <div className="space-y-4">
                {/* Pearl's Summary */}
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-purple-300 font-semibold mb-2">
                        Pearl's Summary
                      </p>
                      <p className="text-sm text-purple-200 leading-relaxed">
                        {generationResult.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                {generationResult.tokenUsage && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
                    {/* Tokens */}
                    <div className="flex flex-col items-center p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                      <Coins className="w-5 h-5 text-blue-400 mb-1" />
                      <p className="text-lg font-bold text-blue-300">
                        {generationResult.tokenUsage.totalTokens.toLocaleString()}
                      </p>
                      <p className="text-xs text-blue-400">tokens</p>
                    </div>

                    {/* Bubbles */}
                    <div className="flex flex-col items-center p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                      <Boxes className="w-5 h-5 text-purple-400 mb-1" />
                      <p className="text-lg font-bold text-purple-300">
                        {generationResult.bubbleCount ??
                          generationResult.bubblesUsed?.length ??
                          0}
                      </p>
                      <p className="text-xs text-purple-400">bubbles</p>
                    </div>
                  </div>
                )}

                {/* Open Flow Button */}
                <div className="flex justify-center mt-2 animate-in fade-in duration-300">
                  <button
                    type="button"
                    onClick={handleOpenFlow}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base font-bold rounded-lg transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                  >
                    Open Flow
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              // Fallback State
              <div className="flex items-center justify-center gap-3 p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-base text-green-300 font-medium">
                  Navigating to flow editor...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
