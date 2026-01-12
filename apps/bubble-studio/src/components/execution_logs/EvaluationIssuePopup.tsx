import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Sparkles, AlertCircle } from 'lucide-react';

interface EvaluationResult {
  working: boolean;
  issue?: string;
  rating: number;
}

interface EvaluationIssuePopupProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationResult: EvaluationResult;
  onFixWithPearl: (issueDescription: string) => void;
  isFixingWithPearl?: boolean;
}

/**
 * Popup dialog that appears when workflow evaluation finds issues.
 * Displays the issue description and rating, with options to fix with Pearl or dismiss.
 */
export function EvaluationIssuePopup({
  isOpen,
  onClose,
  evaluationResult,
  onFixWithPearl,
  isFixingWithPearl = false,
}: EvaluationIssuePopupProps) {
  if (!isOpen) {
    return null;
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 7) return 'text-emerald-400 bg-emerald-500/20';
    if (rating >= 4) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 9) return 'Excellent';
    if (rating >= 7) return 'Good';
    if (rating >= 5) return 'Fair';
    if (rating >= 3) return 'Poor';
    return 'Critical';
  };

  const handleFixWithPearl = () => {
    const issueContext = evaluationResult.issue
      ? `The workflow evaluation found the following issue:\n\n${evaluationResult.issue}\n\nPlease help me fix this issue.`
      : 'The workflow evaluation found issues with the execution. Please analyze the workflow and help me fix any problems.';
    onFixWithPearl(issueContext);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0f1115]/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#161b22] rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden border border-[#30363d]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  Evaluation Issues Found
                </h2>
                <p className="text-sm text-gray-400">
                  The workflow evaluation detected potential problems
                </p>
              </div>
            </div>
            <button
              title="Close"
              onClick={onClose}
              disabled={isFixingWithPearl}
              className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Rating Badge */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Quality Score:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getRatingColor(evaluationResult.rating)}`}
            >
              {evaluationResult.rating}/10
              <span className="text-xs opacity-80">
                ({getRatingLabel(evaluationResult.rating)})
              </span>
            </span>
          </div>

          {/* Issue Description */}
          {evaluationResult.issue && (
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Issue Details
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                {evaluationResult.issue}
              </p>
            </div>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-500">
            Pearl can analyze the evaluation results and suggest fixes for your
            workflow.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117]/50">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isFixingWithPearl}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleFixWithPearl}
              disabled={isFixingWithPearl}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isFixingWithPearl ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Fix with Pearl
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
