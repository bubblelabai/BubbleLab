import React from 'react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';

interface MonthlyUsageBarProps {
  subscription: SubscriptionStatusResponse;
  isOpen: boolean;
}

export const MonthlyUsageBar: React.FC<MonthlyUsageBarProps> = ({
  subscription,
  isOpen,
}) => {
  const MONTHLY_LIMIT = 5; // Hardcoded $5 limit

  // Calculate total cost from serviceUsage
  const totalCost = subscription.usage.serviceUsage.reduce(
    (sum, service) => sum + service.totalCost,
    0
  );

  const percentage = Math.min((totalCost / MONTHLY_LIMIT) * 100, 100);
  const isOverLimit = totalCost > MONTHLY_LIMIT;

  // Format cost to 2 decimal places
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="relative group">
      <div
        className={`w-full rounded-lg bg-[#0a0a0a] border border-[#30363d] ${
          isOpen ? 'p-3' : 'justify-center p-2'
        }`}
      >
        {isOpen ? (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">Monthly Usage</div>
              <div className="text-xs text-gray-400">
                {formatCost(totalCost)} / {formatCost(MONTHLY_LIMIT)}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isOverLimit
                    ? 'bg-red-500'
                    : percentage > 80
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Percentage display */}
            <div className="text-right mt-1">
              <span
                className={`text-xs font-semibold ${
                  isOverLimit
                    ? 'text-red-400'
                    : percentage > 80
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                }`}
              >
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-gray-400">
                {formatCost(totalCost)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip when collapsed */}
      {!isOpen && (
        <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <div className="font-semibold">
            {formatCost(totalCost)} / {formatCost(MONTHLY_LIMIT)}
          </div>
          <div className="text-[10px] text-gray-400">this month</div>
        </span>
      )}
    </div>
  );
};

export default MonthlyUsageBar;
