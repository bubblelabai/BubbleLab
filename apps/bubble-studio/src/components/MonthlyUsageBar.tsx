import React, { useState } from 'react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';
import { ArrowRight } from 'lucide-react';
import { UsageDetailsModal } from './UsageDetailsModal';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';

interface MonthlyUsageBarProps {
  subscription: SubscriptionStatusResponse;
  isOpen: boolean;
}

export const MonthlyUsageBar: React.FC<MonthlyUsageBarProps> = ({
  subscription,
  isOpen,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: bubbleFlowListResponse } = useBubbleFlowList();

  console.log('subscription', subscription);

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
  const webHookLimit = 1;

  const monthlyLimit = subscription.usage.creditLimit;
  const percentage = Math.min((totalCost / monthlyLimit) * 100, 100);
  const isOverLimit = totalCost > monthlyLimit;

  // Calculate execution percentage
  const executionPercentage =
    executionLimit > 0
      ? Math.min((numberOfExecutions / executionLimit) * 100, 100)
      : 0;
  const isOverExecutionLimit = numberOfExecutions > executionLimit;

  // Calculate webhook percentage
  const webhookPercentage =
    webHookLimit > 0
      ? Math.min(
          (numberOfActiveWebhooksOrCronSchedules / webHookLimit) * 100,
          100
        )
      : 0;
  const isOverWebhookLimit =
    numberOfActiveWebhooksOrCronSchedules > webHookLimit;

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
          className={`w-full rounded-lg bg-[#0a0a0a] border border-[#30363d] ${
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

              {/* Monetary usage and Show Details button */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400">
                      {formatCost(totalCost)} / {formatLimit(monthlyLimit)}
                    </div>
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

                  {/* Execution count */}
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-gray-500">
                      Executions: {numberOfExecutions} / {executionLimit}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isOverExecutionLimit
                          ? 'text-red-400'
                          : executionPercentage > 80
                            ? 'text-yellow-400'
                            : 'text-gray-500'
                      }`}
                    >
                      {executionPercentage.toFixed(0)}%
                    </span>
                  </div>

                  {/* Webhook/Cron count */}
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-gray-500">
                      Active Flows: {numberOfActiveWebhooksOrCronSchedules} /{' '}
                      {webHookLimit}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isOverWebhookLimit
                          ? 'text-red-400'
                          : webhookPercentage > 80
                            ? 'text-yellow-400'
                            : 'text-gray-500'
                      }`}
                    >
                      {webhookPercentage.toFixed(0)}%
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-500">
                    Resets {formatResetDate(subscription.usage.resetDate)}
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-white hover:text-gray-300 font-medium transition-colors"
                >
                  Details
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

        {/* Tooltip when collapsed */}
        {!isOpen && (
          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <div className="font-semibold">
              {formatCost(totalCost)} / {formatLimit(monthlyLimit)}
            </div>
            <div className="text-[10px] text-gray-400">
              Executions: {numberOfExecutions} / {executionLimit}
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceUsage={subscription.usage.serviceUsage}
        limit={monthlyLimit}
      />
    </>
  );
};

export default MonthlyUsageBar;
