import React, { useState } from 'react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';
import { ArrowRight } from 'lucide-react';
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
          className={`w-full rounded-lg bg-[#1a1a1a] border border-white/5 ${
            isOpen ? 'p-3' : 'justify-center p-2'
          }`}
        >
          {isOpen ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-200 font-medium">
                    Monthly Usage
                  </div>
                  <span className="text-xs text-gray-400 font-normal">
                    · {subscription.planDisplayName}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">
                    · Resets {formatResetDate(subscription.usage.resetDate)}
                  </span>
                </div>
                {!DISABLE_AUTH && (
                  <button
                    type="button"
                    onClick={handleUpgradeClick}
                    className="px-3 py-1.5 bg-white text-black hover:bg-gray-200 text-xs font-medium rounded-full transition-all duration-200 flex items-center shadow-lg hover:scale-105 font-sans"
                  >
                    <span>Upgrade Plan</span>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full bg-gray-600"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Monetary usage */}
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-400">
                  {formatCost(totalCost)} / {formatLimit(monthlyLimit)}
                </div>
                <span className="text-sm font-semibold text-gray-400">
                  {percentage.toFixed(1)}%
                </span>
              </div>

              {/* Divider and Details button */}
              <div className="pt-2 mt-2 border-t border-white/5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDetailsModalOpen(true)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 font-medium transition-colors"
                  >
                    View Detailed Breakdown
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
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
          <div className="mt-2">
            <div className="flex gap-4">
              {/* Execution count card */}
              <div className="flex-1">
                <div className="flex items-center rounded-lg bg-[#1a1a1a] border border-white/5 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">
                      Total Executions
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-lg font-semibold text-white">
                        {numberOfExecutions}
                      </div>
                      <div className="text-xs text-gray-500">
                        / {executionLimit}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Flows card */}
              <div className="flex-1">
                <div className="flex items-center rounded-lg bg-[#1a1a1a] border border-white/5 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">
                      Active Flows
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-lg font-semibold text-white">
                        {numberOfActiveWebhooksOrCronSchedules}
                      </div>
                      <div className="text-xs text-gray-500">
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
