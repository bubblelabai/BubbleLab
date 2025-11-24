import React, { useState } from 'react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';
import { ArrowRight, AlertCircle, Info } from 'lucide-react';
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

  // Calculate percentages for all metrics
  const executionPercentage = Math.min(
    (numberOfExecutions / executionLimit) * 100,
    100
  );
  const activeFlowsPercentage = Math.min(
    (numberOfActiveWebhooksOrCronSchedules / webHookLimit) * 100,
    100
  );

  // Determine if any limit is exceeded or near limit (>80%)
  const isUsageExceeded = percentage >= 100;
  const isExecutionExceeded = executionPercentage >= 100;
  const isActiveFlowsExceeded = activeFlowsPercentage >= 100;
  const anyLimitExceeded =
    isUsageExceeded || isExecutionExceeded || isActiveFlowsExceeded;

  const isUsageNearLimit = percentage >= 80 && !isUsageExceeded;
  const isExecutionNearLimit =
    executionPercentage >= 80 && !isExecutionExceeded;
  const isActiveFlowsNearLimit =
    activeFlowsPercentage >= 80 && !isActiveFlowsExceeded;

  // Helper to get color classes based on usage level
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getTextColor = (percentage: number): string => {
    if (percentage >= 100) return 'text-red-400';
    if (percentage >= 80) return 'text-yellow-400';
    return 'text-gray-400';
  };

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

  // Centralized error messages
  const limitMessages = {
    credits: {
      title: 'Credit limit reached.',
      message:
        'You can continue executing flows by using your own API keys, or upgrade your plan for more managed integration credits.',
      full: "You've reached your plan's cap on credits. You can continue executing flows by using your own API keys, or upgrade your plan for more managed integration credits.",
    },
    executions: {
      title: 'Execution limit reached.',
      message:
        "You've hit your monthly execution cap. Upgrade your plan to run more Bubble Lab workflows this month.",
      full: "You've reached your plan's cap on executions. Upgrade your plan to run more Bubble Lab workflows this month.",
    },
    activeFlows: {
      title: 'Active flow limit reached.',
      message:
        'Your existing active flows will continue running. To activate webhooks or cron schedules for additional workflows, please upgrade your plan.',
      full: "You've reached your plan's cap on active flows. Your existing active flows will continue running. To activate webhooks or cron schedules for additional workflows, please upgrade your plan.",
    },
  };

  // Get the error message based on which limits are exceeded
  const getLimitExceededMessage = (): string => {
    const messages: string[] = [];

    if (isUsageExceeded) {
      messages.push(limitMessages.credits.full);
    }

    if (isExecutionExceeded) {
      messages.push(limitMessages.executions.full);
    }

    if (isActiveFlowsExceeded) {
      messages.push(limitMessages.activeFlows.full);
    }

    // If multiple limits exceeded, join with a space
    return messages.join(' ');
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
                    Plan Usage Limits
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
                    className={`px-3 py-1.5 ${
                      anyLimitExceeded
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-white text-black hover:bg-gray-200'
                    } text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1 shadow-lg hover:scale-105 font-sans`}
                  >
                    {anyLimitExceeded && <AlertCircle className="w-3 h-3" />}
                    <span>
                      {anyLimitExceeded ? 'Upgrade Required' : 'Upgrade Plan'}
                    </span>
                  </button>
                )}
              </div>

              {/* Warning message if any limit exceeded */}
              {anyLimitExceeded && (
                <div className="mb-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-300">
                      {getLimitExceededMessage()}
                    </div>
                  </div>
                </div>
              )}

              {/* Credit Usage */}
              <div
                className={`mb-3 p-3 rounded-lg ${
                  isUsageExceeded
                    ? 'bg-red-500/5 border border-red-500/30'
                    : isUsageNearLimit
                      ? 'bg-yellow-500/5 border border-yellow-500/30'
                      : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs text-gray-400 font-medium">
                      Monthly Credit Usage
                    </div>
                    {isUsageExceeded && (
                      <div className="relative group/credit-tooltip">
                        <Info className="w-3 h-3 text-red-400 cursor-help" />
                        <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-[#0f1115] border border-red-500/30 rounded-lg text-[10px] text-gray-300 leading-relaxed opacity-0 invisible group-hover/credit-tooltip:opacity-100 group-hover/credit-tooltip:visible transition-all duration-200 z-50 shadow-xl">
                          <span className="font-medium text-red-300">
                            {limitMessages.credits.title}
                          </span>{' '}
                          {limitMessages.credits.message}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-400">
                      {formatCost(totalCost)} / {formatLimit(monthlyLimit)}
                    </div>
                    <span
                      className={`text-sm font-semibold ${getTextColor(percentage)}`}
                    >
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${getProgressColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Divider and Details button */}
              <div className="pt-2 border-t border-white/5">
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
                <div
                  className={`rounded-lg bg-[#1a1a1a] border p-3 ${
                    isExecutionExceeded
                      ? 'border-red-500/30 bg-red-500/5'
                      : isExecutionNearLimit
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xs text-gray-400 font-medium">
                        Monthly Executions
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {subscription.planDisplayName} · Resets{' '}
                        {formatResetDate(subscription.usage.resetDate)}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getTextColor(executionPercentage)}`}
                    >
                      {executionPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <div className="text-lg font-semibold text-white">
                      {numberOfExecutions.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      / {executionLimit.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${getProgressColor(executionPercentage)}`}
                      style={{ width: `${executionPercentage}%` }}
                    />
                  </div>
                  {isExecutionExceeded && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400 relative group/exec-tooltip">
                      <AlertCircle className="w-3 h-3" />
                      <span className="cursor-help">Limit reached</span>
                      <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-[#0f1115] border border-red-500/30 rounded-lg text-[10px] text-gray-300 leading-relaxed opacity-0 invisible group-hover/exec-tooltip:opacity-100 group-hover/exec-tooltip:visible transition-all duration-200 z-50 shadow-xl">
                        <span className="font-medium text-red-300">
                          {limitMessages.executions.title}
                        </span>{' '}
                        {limitMessages.executions.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Flows card */}
              <div className="flex-1">
                <div
                  className={`rounded-lg bg-[#1a1a1a] border p-3 ${
                    isActiveFlowsExceeded
                      ? 'border-red-500/30 bg-red-500/5'
                      : isActiveFlowsNearLimit
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xs text-gray-400 font-medium">
                        Total Active Flows (Webhooks + Cron Schedules)
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {subscription.planDisplayName}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getTextColor(activeFlowsPercentage)}`}
                    >
                      {activeFlowsPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <div className="text-lg font-semibold text-white">
                      {numberOfActiveWebhooksOrCronSchedules}
                    </div>
                    <div className="text-xs text-gray-500">
                      / {webHookLimit}
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${getProgressColor(activeFlowsPercentage)}`}
                      style={{ width: `${activeFlowsPercentage}%` }}
                    />
                  </div>
                  {isActiveFlowsExceeded && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400 relative group/flow-tooltip">
                      <AlertCircle className="w-3 h-3" />
                      <span className="cursor-help">Limit reached</span>
                      <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-[#0f1115] border border-red-500/30 rounded-lg text-[10px] text-gray-300 leading-relaxed opacity-0 invisible group-hover/flow-tooltip:opacity-100 group-hover/flow-tooltip:visible transition-all duration-200 z-50 shadow-xl">
                        <span className="font-medium text-red-300">
                          {limitMessages.activeFlows.title}
                        </span>{' '}
                        {limitMessages.activeFlows.message}
                      </div>
                    </div>
                  )}
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
