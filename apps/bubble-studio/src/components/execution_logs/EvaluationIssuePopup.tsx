import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Settings,
  Code2,
  FileInput,
} from 'lucide-react';

interface EvaluationResult {
  working: boolean;
  issueType: 'setup' | 'workflow' | 'input' | null;
  summary: string;
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
 * Popup dialog that appears when workflow check completes.
 * Shows summary for successful executions, or issue details with fix options for failures.
 * For setup issues, only shows setup instructions (no "Fix with Pearl" button).
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

  const getIssueTypeIcon = (issueType: EvaluationResult['issueType']) => {
    switch (issueType) {
      case 'setup':
        return <Settings className="w-5 h-5 text-yellow-400" />;
      case 'workflow':
        return <Code2 className="w-5 h-5 text-red-400" />;
      case 'input':
        return <FileInput className="w-5 h-5 text-orange-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getIssueTypeLabel = (issueType: EvaluationResult['issueType']) => {
    switch (issueType) {
      case 'setup':
        return 'Setup Issue';
      case 'workflow':
        return 'Workflow Issue';
      case 'input':
        return 'Input Issue';
      default:
        return 'Success';
    }
  };

  const getIssueTypeDescription = (
    issueType: EvaluationResult['issueType']
  ) => {
    switch (issueType) {
      case 'setup':
        return 'Configuration or credentials need to be updated in Settings';
      case 'workflow':
        return 'The workflow code has issues that can be fixed';
      case 'input':
        return 'The input data provided was invalid or missing';
      default:
        return 'The workflow executed successfully';
    }
  };

  const handleFixWithPearl = () => {
    const issueContext = `The workflow check found the following issue:\n\n${evaluationResult.summary}\n\nPlease help me fix this issue.`;
    onFixWithPearl(issueContext);
  };

  // Determine if "Fix with Pearl" should be shown
  // Only show for workflow issues (not setup or input - those require user action outside the workflow)
  const showFixWithPearl =
    !evaluationResult.working && evaluationResult.issueType === 'workflow';

  // Different styling based on success/failure
  const isSuccess = evaluationResult.working;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0f1115]/70"
        onClick={isFixingWithPearl ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#161b22] rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden border border-[#30363d]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isSuccess
                    ? 'bg-emerald-500/20'
                    : evaluationResult.issueType === 'setup'
                      ? 'bg-yellow-500/20'
                      : 'bg-red-500/20'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle
                    className={`w-5 h-5 ${
                      evaluationResult.issueType === 'setup'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  {isSuccess ? 'Execution Summary' : 'Issues Found'}
                </h2>
                <p className="text-sm text-gray-400">
                  {isSuccess
                    ? 'Your workflow completed successfully'
                    : 'The check detected potential problems'}
                </p>
              </div>
            </div>
            <button
              type="button"
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

          {/* Issue Type Badge (only for failures) */}
          {!isSuccess && evaluationResult.issueType && (
            <div className="flex items-center gap-3 p-3 bg-[#0d1117] border border-[#21262d] rounded-lg">
              <div className="flex-shrink-0">
                {getIssueTypeIcon(evaluationResult.issueType)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {getIssueTypeLabel(evaluationResult.issueType)}
                </p>
                <p className="text-xs text-gray-500">
                  {getIssueTypeDescription(evaluationResult.issueType)}
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              {isSuccess ? 'What Happened' : 'Issue Details'}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
              {evaluationResult.summary}
            </p>
          </div>

          {/* Help Text */}
          {!isSuccess && (
            <p className="text-xs text-gray-500">
              {evaluationResult.issueType === 'setup'
                ? 'Please update your settings or credentials to resolve this issue.'
                : evaluationResult.issueType === 'input'
                  ? 'Please provide valid input data and try again.'
                  : 'Pearl can analyze the results and suggest fixes for your workflow.'}
            </p>
          )}
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
              {isSuccess ? 'Close' : 'Dismiss'}
            </button>
            {showFixWithPearl && (
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
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
