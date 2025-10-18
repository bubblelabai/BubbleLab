import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface TokenUsageDisplayProps {
  isOpen: boolean;
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  isOpen,
}) => {
  const { data: subscription, loading } = useSubscription();
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading || !subscription) {
    return null;
  }

  const { tokenUsage } = subscription.usage;

  // Calculate total tokens across all models
  const totalTokens = tokenUsage.reduce(
    (sum, model) => sum + model.totalTokens,
    0
  );

  // Format large numbers with K/M suffix
  const formatTokens = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="relative group">
      <div
        className={`w-full flex items-center rounded-lg bg-[#0a0a0a] border border-[#30363d] ${
          isOpen ? 'p-3' : 'justify-center p-2'
        }`}
      >
        {/* Token usage details (shown when expanded) */}
        {isOpen && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-400">Monthly Token Usage</div>
              {tokenUsage.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            <div className="text-lg font-semibold text-white">
              {formatTokens(totalTokens)}
            </div>
            {tokenUsage.length > 0 && isExpanded && (
              <div className="mt-2 space-y-1">
                {tokenUsage.map((model) => (
                  <div
                    key={model.modelName}
                    className="text-[10px] text-gray-500 flex justify-between"
                  >
                    <span className="truncate mr-2">{model.modelName}</span>
                    <span className="flex-none">
                      {formatTokens(model.totalTokens)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tooltip when collapsed */}
      {!isOpen && (
        <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <div className="font-semibold">
            {formatTokens(totalTokens)} tokens
          </div>
          <div className="text-[10px] text-gray-400">this month</div>
        </span>
      )}
    </div>
  );
};

export default TokenUsageDisplay;
