import { Clock } from 'lucide-react';
import {
  getUserTimeZone,
  convertUtcCronToLocalParts,
  getSimplifiedSchedule,
} from '../utils/cronUtils';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useValidateCode } from '../hooks/useValidateCode';
import { useExecutionStore } from '../stores/executionStore';

interface CronToggleProps {
  flowId: number;
  syncInputsWithFlow?: boolean;
  showScheduleText?: boolean;
  compact?: boolean;
}

/**
 * Reusable component for displaying and toggling cron schedule activation
 * Used in both DashboardPage and FlowVisualizer
 */
export function CronToggle({
  flowId,
  showScheduleText = true,
  compact = false,
  syncInputsWithFlow = true,
}: CronToggleProps) {
  const { data: currentFlow } = useBubbleFlow(flowId);
  const validateCodeMutation = useValidateCode({ flowId });
  const executionState = useExecutionStore(flowId);
  const cronSchedule = currentFlow?.cron;
  const cronActive = currentFlow?.cronActive;

  // Convert UTC cron to local time for display
  const userTimezone = getUserTimeZone();
  const localConversion = cronSchedule
    ? convertUtcCronToLocalParts(cronSchedule, userTimezone)
    : null;

  const scheduleDescription = localConversion
    ? {
        description: getSimplifiedSchedule(localConversion.parts),
        isValid: true,
      }
    : null;

  const isPending = validateCodeMutation.isPending;

  const handleToggle = async () => {
    if (!cronSchedule || isPending || !currentFlow) return;

    const newActiveState = !cronActive;

    try {
      await validateCodeMutation.mutateAsync({
        code: currentFlow.code,
        flowId: currentFlow.id,
        syncInputsWithFlow: syncInputsWithFlow,
        credentials: executionState.pendingCredentials || {},
        defaultInputs: executionState.executionInputs || {},
        activateCron: newActiveState,
      });
    } catch (error) {
      console.error('Failed to toggle cron status:', error);
    }
  };

  if (!cronSchedule) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Toggle Switch */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={`relative inline-flex items-center h-5 w-9 rounded-full transition-all duration-200 ${
            isPending
              ? 'cursor-not-allowed opacity-50 bg-neutral-700'
              : cronActive
                ? 'bg-green-600 hover:bg-green-500'
                : 'bg-neutral-600 hover:bg-neutral-500'
          }`}
          title={
            isPending
              ? 'Updating schedule...'
              : cronActive
                ? 'Click to deactivate schedule'
                : 'Click to activate schedule'
          }
        >
          <span className="sr-only">Toggle cron schedule</span>
          {isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                cronActive ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          )}
        </button>

        {/* Status Text and Schedule */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              cronActive ? 'text-green-400' : 'text-neutral-500'
            }`}
          >
            {isPending ? 'Updating...' : cronActive ? 'Active' : 'Inactive'}
          </span>
          {showScheduleText && scheduleDescription && (
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="w-3 h-3" />
              <span>{scheduleDescription.description}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#252525] rounded-lg p-4 border border-neutral-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${cronActive ? 'bg-green-600' : 'bg-neutral-600'}`}
          >
            <Clock className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">
              Cron Schedule
            </h3>
            {scheduleDescription && (
              <p className="text-xs text-neutral-400">
                {scheduleDescription.description}
              </p>
            )}
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-medium ${
              cronActive ? 'text-green-400' : 'text-neutral-500'
            }`}
          >
            {isPending ? 'Updating...' : cronActive ? 'Active' : 'Inactive'}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all duration-200 ${
              isPending
                ? 'cursor-not-allowed opacity-50 bg-neutral-700'
                : cronActive
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-neutral-600 hover:bg-neutral-500'
            }`}
            title={
              isPending
                ? 'Updating schedule...'
                : cronActive
                  ? 'Click to deactivate schedule'
                  : 'Click to activate schedule'
            }
          >
            <span className="sr-only">Toggle cron schedule</span>
            {isPending ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  cronActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {scheduleDescription && (
        <div className="space-y-2">
          <div className="text-sm text-neutral-300">
            {scheduleDescription.description}
          </div>
          <div className="text-xs text-neutral-500">
            UTC cron:{' '}
            <span className="font-mono text-neutral-400">{cronSchedule}</span>
          </div>
        </div>
      )}

      {scheduleDescription && !scheduleDescription.isValid && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
          ⚠️ Invalid schedule
        </div>
      )}
    </div>
  );
}
