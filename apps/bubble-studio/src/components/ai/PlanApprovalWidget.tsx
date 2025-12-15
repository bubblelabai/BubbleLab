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
    <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-200">
            Implementation Plan
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-neutral-400 hover:text-neutral-300 transition-colors"
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
          {/* Summary */}
          <div className="px-4 pt-4 pb-3 border-b border-neutral-700/50">
            <p className="text-sm text-neutral-300 leading-relaxed">
              {plan.summary}
            </p>
          </div>

          {/* Steps */}
          <div className="px-4 py-3 space-y-2 border-b border-neutral-700/50">
            {plan.steps.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <h5 className="text-sm font-medium text-neutral-200">
                    {step.title}
                  </h5>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {step.description}
                  </p>
                  {step.bubblesUsed && step.bubblesUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {step.bubblesUsed.map((bubble, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400 border border-neutral-700"
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

          {/* Estimated bubbles */}
          {plan.estimatedBubbles && plan.estimatedBubbles.length > 0 && (
            <div className="px-4 py-3 border-b border-neutral-700/50">
              <h4 className="text-xs font-medium text-neutral-400 mb-2">
                Integrations
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {plan.estimatedBubbles.map((bubble, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400 border border-neutral-700"
                  >
                    {bubble}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional comments */}
          <div className="px-4 py-3 border-b border-neutral-700/50">
            <label className="text-xs font-medium text-neutral-400 mb-2 block">
              Additional Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any modifications or additional requirements..."
              disabled={isLoading}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded border border-neutral-700 bg-neutral-900 text-neutral-200 placeholder-neutral-500 focus:border-blue-500/50 focus:outline-none disabled:opacity-50 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex justify-end">
            <button
              onClick={() => onApprove(comment.trim() || undefined)}
              disabled={isLoading}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors flex items-center gap-2 ${
                isLoading
                  ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
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
