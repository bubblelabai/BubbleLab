/**
 * PlanApprovalWidget - Displays the implementation plan from Coffee agent
 * Allows users to approve the plan with optional additional comments before code generation
 */
import { useState } from 'react';
import {
  Check,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { CoffeePlanEvent } from '@bubblelab/shared-schemas';

interface PlanApprovalWidgetProps {
  plan: CoffeePlanEvent;
  onApprove: (comment?: string) => void;
  isLoading: boolean;
}

export function PlanApprovalWidget({
  plan,
  onApprove,
  isLoading,
}: PlanApprovalWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [comment, setComment] = useState('');

  return (
    <div className="border border-green-500/30 rounded-lg overflow-hidden bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-green-500/10 border-b border-green-500/20">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-300">
            Implementation Plan
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Plan content */}
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Summary
              </h4>
              <p className="text-sm text-gray-200 leading-relaxed">
                {plan.summary}
              </p>
            </div>

            {/* Steps */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Steps
              </h4>
              <div className="space-y-3">
                {plan.steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex gap-3 bg-gray-800/30 rounded-lg p-3"
                  >
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-gray-200">
                        {step.title}
                      </h5>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                      {step.bubblesUsed && step.bubblesUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {step.bubblesUsed.map((bubble, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            >
                              {bubble}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated bubbles */}
            {plan.estimatedBubbles && plan.estimatedBubbles.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Integrations to be used
                </h4>
                <div className="flex flex-wrap gap-2">
                  {plan.estimatedBubbles.map((bubble, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    >
                      {bubble}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Additional comments section */}
          <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700">
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any additional requirements or modifications to the plan..."
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-600 bg-gray-900 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Footer with action button */}
          <div className="flex items-center justify-end px-4 py-3 bg-gray-800/30 border-t border-gray-700">
            <button
              onClick={() => onApprove(comment.trim() || undefined)}
              disabled={isLoading}
              className={`px-5 py-2 text-sm rounded-lg font-medium transition-all flex items-center gap-2 ${
                isLoading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Approve & Build
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
