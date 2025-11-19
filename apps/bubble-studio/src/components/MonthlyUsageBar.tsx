import React, { useState } from 'react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';
import { ArrowRight, ArrowUpCircle } from 'lucide-react';
import { UsageDetailsModal } from './UsageDetailsModal';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { useNavigate } from '@tanstack/react-router';
import { DISABLE_AUTH } from '../env';

interface MonthlyUsageBarProps {
  subscription: SubscriptionStatusResponse;
  isOpen: boolean;
}

export const MonthlyUsageBar: React.FC<MonthlyUsageBarProps> = ({
  subscription,
  isOpen,
}) => {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { data: bubbleFlowListResponse } = useBubbleFlowList();
  const navigate = useNavigate();

  console.log('subscription', subscription);

  const handleUpgradeClick = () => {
    navigate({ to: '/pricing' });
  };

  // Calculate total cost from serviceUsage
  const totalCost = subscription.usage.serviceUsage.reduce(
    (sum, service) => sum + service.totalCost,
    0
  );
  const numberOfExecutions = subscription?.usage.executionCount || 0;
  const executionLimit = subscription.usage.executionLimit;
  const numberOfActiveWebhooksOrCronSchedules =
    bubbleFlowListResponse?.bubbleFlows.filter(
      (flow) => flow.isActive || flow.cronActive
    ).length || 0;
  const webHookLimit = subscription.usage.activeFlowLimit;

  const monthlyLimit = subscription.usage.creditLimit;
  const percentage = Math.min((totalCost / monthlyLimit) * 100, 100);
  const isOverLimit = totalCost > monthlyLimit;

  // Format cost to 4 decimal places
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  // Format limit to 0 decimal places
  const formatLimit = (limit: number): string => {
    return `$${limit.toFixed(0)}`;
  };

  // Format reset date
  const formatResetDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div className="relative group">
        <div
          className={`w-full rounded-xl bg-[#1a1a1a] border border-[#30363d] shadow-sm ${
            isOpen ? 'p-5' : 'justify-center p-2'
          }`}
        >
          {isOpen ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="text-base text-white font-semibold">
                    Monthly Usage
                  </div>
                  <span className="text-sm text-gray-400 font-normal">
                    · {subscription.planDisplayName}
                  </span>
                  <span className="text-xs text-gray-500 font-normal bg-[#101010] px-2 py-0.5 rounded-full border border-white/10">
                    Resets {formatResetDate(subscription.usage.resetDate)}
                  </span>
                </div>
                {!DISABLE_AUTH && (
                  <button
                    type="button"
                    onClick={handleUpgradeClick}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Upgrade
                    <ArrowUpCircle className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#101010] rounded-full h-3 overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isOverLimit
                      ? 'bg-red-500'
                      : percentage > 80
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Monetary usage */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300 font-medium">
                    {formatCost(totalCost)}
                  </span>
                  <span className="text-xs text-gray-500">
                    of {formatLimit(monthlyLimit)} limit
                  </span>
                </div>
                <span
                  className={`text-sm font-bold ${
                    isOverLimit
                      ? 'text-red-400'
                      : percentage > 80
                        ? 'text-yellow-400'
                        : percentage === 0
                          ? 'text-gray-400'
                          : 'text-blue-400'
                  }`}
                >
                  {percentage.toFixed(1)}% Used
                </span>
              </div>

              {/* Details button */}
              <div className="mt-4 pt-4 border-t border-[#30363d] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white font-medium transition-colors"
                >
                  View Details
                  <ArrowRight className="w-3 h-3" />
                </button>
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

        {/* Usage cards - outside Monthly Usage container */}
        {isOpen && (
          <div className="mt-4">
            <div className="flex gap-4 flex-wrap">
              {/* Execution count card */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center rounded-xl bg-[#1a1a1a] border border-[#30363d] p-4 shadow-sm hover:border-gray-500 transition-colors duration-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">
                      Total Executions
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-white">
                        {numberOfExecutions}
                      </div>
                      <div className="text-sm text-gray-500">
                        / {executionLimit}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Flows card */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center rounded-xl bg-[#1a1a1a] border border-[#30363d] p-4 shadow-sm hover:border-gray-500 transition-colors duration-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">
                      Active Flows
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-white">
                        {numberOfActiveWebhooksOrCronSchedules}
                      </div>
                      <div className="text-sm text-gray-500">
                        / {webHookLimit}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tooltip when collapsed */}
        {!isOpen && (
          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <div className="font-semibold">
              {formatCost(totalCost)} / {formatLimit(monthlyLimit)}
            </div>
            <div className="text-[10px] text-gray-400">
              Total Executions: {numberOfExecutions} / {executionLimit}
            </div>
            <div className="text-[10px] text-gray-400">
              Active Flows: {numberOfActiveWebhooksOrCronSchedules} /{' '}
              {webHookLimit}
            </div>
            <div className="text-[10px] text-gray-400">
              {subscription.planDisplayName} · Resets{' '}
              {formatResetDate(subscription.usage.resetDate)}
            </div>
          </span>
        )}
      </div>

      {/* Usage Details Modal */}
      <UsageDetailsModal
        resetDate={subscription.usage.resetDate}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        serviceUsage={subscription.usage.serviceUsage}
        limit={monthlyLimit}
      />
    </>
  );
};

export default MonthlyUsageBar;
