import { useEffect, useRef, useState } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useNavigate } from '@tanstack/react-router';
import { TypewriterMarkdown } from './TypewriterMarkdown';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

/**
 * GenerationOutputOverlay
 *
 * Full-screen overlay that displays real-time flow generation progress.
 * - Auto-shows when isStreaming === true
 * - Reads output directly from outputStore
 * - No props needed - self-contained component
 * - Hides generation messages immediately when streaming completes
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
  const [summaryComplete, setSummaryComplete] = useState(false);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Reset summary complete state when a new generation starts
  // Set to true immediately when streaming completes to hide generation messages
  useEffect(() => {
    if (isStreaming) {
      setSummaryComplete(false);
    } else if (!isStreaming && generationResult) {
      setSummaryComplete(true);
    }
  }, [isStreaming, generationResult]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-4xl lg:max-w-5xl bg-gradient-to-b from-[#0d1117] to-[#0a0d12] border border-[#30363d] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center p-4 sm:p-6 border-b border-[#30363d]">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            {isStreaming ? (
              <div className="relative flex-shrink-0">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-ping" />
              </div>
            ) : hasError ? (
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 truncate">
                {isStreaming
                  ? 'Generating Your Flow'
                  : hasError
                    ? 'Generation Failed'
                    : 'Generation Complete'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">
                {isStreaming
                  ? 'Pearl is crafting your workflow...'
                  : hasError
                    ? 'Something went wrong during generation'
                    : 'Your flow is ready!'}
              </p>
            </div>
          </div>
        </div>

        {/* Output Content - Hide when summary is complete */}
        {!summaryComplete && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 sm:space-y-3 thin-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mb-2 sm:mb-3" />
                <p className="text-sm sm:text-base">
                  Initializing generation...
                </p>
              </div>
            ) : (
              messages.map((line, index) => {
                const messageInfo = parseMessageType(line);

                if (messageInfo.type === 'empty') return null;

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border ${messageInfo.bgColor} ${messageInfo.borderColor} animate-in slide-in-from-left-2 duration-200`}
                  >
                    <div className={messageInfo.color}>{messageInfo.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`${messageInfo.color} text-sm sm:text-base font-medium leading-relaxed break-words`}
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
        )}

        {/* Footer - only show when not streaming */}
        {!isStreaming && (
          <div className="p-4 sm:p-6 border-t border-[#30363d] bg-[#161b22]">
            {hasError ? (
              // Error State
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm sm:text-base text-red-300 flex-1">
                    Generation failed. You can close this dialog to modify your
                    prompt and try again.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-semibold rounded-lg transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                  >
                    Try Again
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            ) : generationResult ? (
              // Success State - Show Typewriter Markdown Summary with Stats
              <div className="space-y-4 sm:space-y-6">
                {/* Pearl's Summary with Typewriter Effect and Markdown */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Summary
                  </p>
                  <div className="overflow-y-auto overflow-x-hidden max-h-[45vh] md:max-h-[50vh] thin-scrollbar pr-2">
                    <TypewriterMarkdown
                      text={generationResult.summary}
                      speed={10}
                    />
                  </div>
                </div>

                {/* Stats Grid - show immediately */}
                {generationResult.serviceUsage && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-in fade-in duration-300">
                    {/* Tokens */}
                    <div className="flex flex-col">
                      <p className="text-xl sm:text-2xl font-bold text-gray-100">
                        {generationResult.serviceUsage.reduce(
                          (sum, service) => sum + service.usage,
                          0
                        )}
                      </p>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        tokens
                      </p>
                    </div>

                    {/* Bubbles */}
                    <div className="flex flex-col">
                      <p className="text-xl sm:text-2xl font-bold text-gray-100">
                        {generationResult.bubbleCount
                          ? generationResult.bubbleCount
                          : 0}
                      </p>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        bubbles
                      </p>
                    </div>
                  </div>
                )}

                {/* Open Flow Button - show immediately */}
                <div className="flex justify-center pt-2 animate-in fade-in duration-300">
                  <button
                    type="button"
                    onClick={handleOpenFlow}
                    className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm sm:text-base font-bold rounded-lg transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                  >
                    Open Flow
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            ) : (
              // Fallback State
              <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                <p className="text-sm sm:text-base text-green-300 font-medium">
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
