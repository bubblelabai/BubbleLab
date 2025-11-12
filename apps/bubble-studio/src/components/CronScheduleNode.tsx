import { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Save,
} from 'lucide-react';
import { validateCronExpression } from '@bubblelab/shared-schemas';
import {
  cronToEnglish,
  getUserTimeZone,
  formatTimeZoneLabel,
  convertLocalPartsToUtcCron,
  convertUtcCronToLocalParts,
  getSimplifiedSchedule,
  type CronParts,
} from '../utils/cronUtils';
import { parseJSONSchema } from '../utils/inputSchemaParser';
import InputFieldsRenderer from './InputFieldsRenderer';
import { CronToggle } from './CronToggle';
import { useExecutionStore } from '../stores/executionStore';
import { useValidateCode } from '../hooks/useValidateCode';
import { useEditor } from '../hooks/useEditor';
import { useRunExecution } from '../hooks/useRunExecution';
import { filterEmptyInputs } from '../utils/inputUtils';

interface CronScheduleNodeData {
  flowId: number;
  flowName: string;
  cronSchedule: string;
  isActive?: boolean;
  inputSchema?: Record<string, unknown>;
}

interface CronScheduleNodeProps {
  data: CronScheduleNodeData;
}

type FrequencyType = 'minute' | 'hour' | 'day' | 'week' | 'month';

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

// Helper function to build cron from UI state
function buildCronFromUI(
  frequency: FrequencyType,
  interval: number,
  hour: number,
  minute: number,
  daysOfWeek: number[],
  dayOfMonth: number
): string {
  switch (frequency) {
    case 'minute':
      return `*/${interval} * * * *`;
    case 'hour':
      return `${minute} */${interval} * * *`;
    case 'day':
      return `${minute} ${hour} * * *`;
    case 'week': {
      const days = daysOfWeek.length > 0 ? daysOfWeek.sort().join(',') : '*';
      return `${minute} ${hour} * * ${days}`;
    }
    case 'month':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return '0 0 * * *';
  }
}

function CronScheduleNode({ data }: CronScheduleNodeProps) {
  const {
    flowId,
    flowName,
    cronSchedule,
    isActive = true,
    inputSchema = {},
  } = data;

  const [isExpanded, setIsExpanded] = useState(true);

  // Subscribe to execution store (using selectors to avoid re-renders from events)
  const executionInputs = useExecutionStore(flowId, (s) => s.executionInputs);
  const isExecuting = useExecutionStore(flowId, (s) => s.isRunning);
  const setInput = useExecutionStore(flowId, (s) => s.setInput);
  const setInputs = useExecutionStore(flowId, (s) => s.setInputs);
  const pendingCredentials = useExecutionStore(
    flowId,
    (s) => s.pendingCredentials
  );

  // Get editor and mutations
  const validateCodeMutation = useValidateCode({ flowId });
  const { editor, updateCronSchedule } = useEditor(flowId);

  // Get runFlow function
  const { runFlow } = useRunExecution(flowId);

  // Local state for input values (before saving)
  const [inputValues, setInputValues] = useState<Record<string, unknown>>(
    executionInputs || {}
  );

  // Sync local state with store when executionInputs changes externally
  useEffect(() => {
    if (executionInputs && Object.keys(executionInputs).length > 0) {
      setInputValues(executionInputs);
    }
  }, [executionInputs]);

  // Get user's timezone
  const userTimezone = getUserTimeZone();
  const timezoneLabel = formatTimeZoneLabel(userTimezone);

  // Check if there are unsaved input changes (similar to useEditor pattern)
  const hasUnsavedInputChanges = useMemo(() => {
    // Compare current inputValues with the flow's defaultInputs from executionInputs
    return JSON.stringify(inputValues) !== JSON.stringify(executionInputs);
  }, [inputValues, executionInputs]);

  // Parse input schema using the same logic as InputSchemaNode
  const schemaFields =
    typeof inputSchema === 'string'
      ? parseJSONSchema(inputSchema)
      : inputSchema.properties
        ? Object.entries(inputSchema.properties).map(([name, schema]) => ({
            name,
            type:
              ((schema as Record<string, unknown>)?.type as string) || 'string',
            required: Array.isArray(inputSchema.required)
              ? inputSchema.required.includes(name)
              : false,
            description: (schema as Record<string, unknown>)
              ?.description as string,
            default: (schema as Record<string, unknown>)?.default,
          }))
        : [];

  // Check if there are any required fields that are missing
  const missingRequiredFields = schemaFields
    .filter((field) => field.required)
    .filter(
      (field) =>
        (inputValues[field.name] === undefined ||
          inputValues[field.name] === '') &&
        field.default === undefined
    );

  const hasMissingRequired =
    missingRequiredFields.length > 0 &&
    Object.keys(executionInputs).length == 0;

  // Convert UTC cron to local time parts
  const localConversion = convertUtcCronToLocalParts(cronSchedule);
  const [frequency, setFrequency] = useState<FrequencyType>(
    localConversion.parts.frequency
  );
  const [interval, setInterval] = useState(localConversion.parts.interval);
  const [hour, setHour] = useState(localConversion.parts.hour);
  const [minute, setMinute] = useState(localConversion.parts.minute);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    localConversion.parts.daysOfWeek
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    localConversion.parts.dayOfMonth
  );
  const [conversionWarning, setConversionWarning] = useState<
    string | undefined
  >(localConversion.warning);

  // Helper to compute local cron from current state (for display)
  const computeLocalCron = (
    patch: Partial<{
      frequency: FrequencyType;
      interval: number;
      hour: number;
      minute: number;
      daysOfWeek: number[];
      dayOfMonth: number;
    }> = {}
  ) => {
    return buildCronFromUI(
      patch.frequency ?? frequency,
      patch.interval ?? interval,
      patch.hour ?? hour,
      patch.minute ?? minute,
      patch.daysOfWeek ?? daysOfWeek,
      patch.dayOfMonth ?? dayOfMonth
    );
  };

  // Helper to compute UTC cron from current state
  const computeUtcCron = (
    patch: Partial<{
      frequency: FrequencyType;
      interval: number;
      hour: number;
      minute: number;
      daysOfWeek: number[];
      dayOfMonth: number;
    }> = {}
  ) => {
    const parts: CronParts = {
      frequency: patch.frequency ?? frequency,
      interval: patch.interval ?? interval,
      hour: patch.hour ?? hour,
      minute: patch.minute ?? minute,
      daysOfWeek: patch.daysOfWeek ?? daysOfWeek,
      dayOfMonth: patch.dayOfMonth ?? dayOfMonth,
    };
    return convertLocalPartsToUtcCron(parts);
  };

  // Unified state updater that also emits the new UTC cron immediately
  const updateCronState = (
    patch: Partial<{
      frequency: FrequencyType;
      interval: number;
      hour: number;
      minute: number;
      daysOfWeek: number[];
      dayOfMonth: number;
    }>
  ) => {
    if (patch.frequency !== undefined) setFrequency(patch.frequency);
    if (patch.interval !== undefined) setInterval(patch.interval);
    if (patch.hour !== undefined) setHour(patch.hour);
    if (patch.minute !== undefined) setMinute(patch.minute);
    if (patch.daysOfWeek !== undefined) setDaysOfWeek(patch.daysOfWeek);
    if (patch.dayOfMonth !== undefined) setDayOfMonth(patch.dayOfMonth);

    const utcResult = computeUtcCron(patch);
    setConversionWarning(utcResult.warning);
    handleCronScheduleChange(utcResult.cron);
  };

  // Sync local state when cronSchedule prop changes
  useEffect(() => {
    const localConversion = convertUtcCronToLocalParts(cronSchedule);
    setFrequency(localConversion.parts.frequency);
    setInterval(localConversion.parts.interval);
    setHour(localConversion.parts.hour);
    setMinute(localConversion.parts.minute);
    setDaysOfWeek(localConversion.parts.daysOfWeek);
    setDayOfMonth(localConversion.parts.dayOfMonth);
    setConversionWarning(localConversion.warning);
  }, [cronSchedule, userTimezone]);

  // Compute current local cron from state (for display)
  const currentLocalCron = computeLocalCron();

  // Compute current UTC cron from state (for validation and saving)
  const utcResult = computeUtcCron();
  const currentUtcCron = utcResult.cron;

  // Parse and validate the UTC cron expression
  const validation = validateCronExpression(currentUtcCron);
  const cronDescription = cronToEnglish(currentLocalCron);
  const description = cronDescription.description;

  // Get simplified schedule for compact display
  const simplifiedSchedule = getSimplifiedSchedule({
    frequency,
    interval,
    hour,
    minute,
    daysOfWeek,
    dayOfMonth,
  });

  const handleInputChange = (fieldName: string, value: unknown) => {
    const newInputValues = { ...inputValues, [fieldName]: value };
    setInputValues(newInputValues);
    // Also update store immediately for execution
    setInput(fieldName, value);
  };

  const handleCronScheduleChange = (newSchedule: string) => {
    // Update the cron schedule in the editor store
    updateCronSchedule(newSchedule);
  };

  const handleSaveInputs = async () => {
    // Update execution store inputs
    setInputs(inputValues);

    // Call validation with syncInputsWithFlow to save to backend
    await validateCodeMutation.mutateAsync({
      code: editor.getCode(),
      flowId,
      syncInputsWithFlow: true,
      credentials: pendingCredentials,
      defaultInputs: inputValues,
    });
  };

  const handleExecuteFlow = async () => {
    // Filter out empty values (empty strings, undefined, empty arrays) so defaults are used
    const filteredInputs = filterEmptyInputs(executionInputs || {});

    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: filteredInputs,
    });
  };

  const handleFrequencyChange = (newFrequency: FrequencyType) => {
    updateCronState({ frequency: newFrequency });
  };

  const handleIntervalChange = (newInterval: number) => {
    updateCronState({ interval: newInterval });
  };

  const handleHourChange = (newHour: number) => {
    updateCronState({ hour: newHour });
  };

  const handleMinuteChange = (newMinute: number) => {
    updateCronState({ minute: newMinute });
  };

  const handleDayOfMonthChange = (newDay: number) => {
    updateCronState({ dayOfMonth: newDay });
  };

  // (Removed handleBlur; updates now emit immediately in handlers)

  const toggleDayOfWeek = (day: number) => {
    const newDaysOfWeek = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort();
    updateCronState({ daysOfWeek: newDaysOfWeek });
  };

  return (
    <div
      className={`bg-neutral-800/90 rounded-lg border overflow-hidden transition-all duration-300 w-80 ${
        isExecuting
          ? 'border-purple-400 shadow-lg shadow-purple-500/30'
          : !isActive
            ? 'border-neutral-700 opacity-75'
            : hasMissingRequired
              ? 'border-amber-500'
              : validation.valid
                ? 'border-neutral-600'
                : 'border-red-500'
      }`}
    >
      {/* Output handle on the right to connect to first bubble */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={false}
        className={`w-3 h-3 ${isExecuting ? 'bg-purple-400' : isActive ? 'bg-purple-400' : 'bg-neutral-500'}`}
        style={{ right: -6 }}
      />

      {/* Header */}
      <div className="p-4 border-b border-neutral-600">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center ${isActive ? 'bg-purple-600' : 'bg-neutral-600'}`}
            >
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-neutral-100">
                Cron Schedule
              </h3>
              <p className="text-xs text-neutral-400 truncate" title={flowName}>
                {flowName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Active/Inactive toggle using CronToggle component */}
            {flowId && (
              <CronToggle
                flowId={flowId}
                syncInputsWithFlow={true}
                compact={true}
                showScheduleText={false}
              />
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Current schedule display */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <div className="text-xs text-purple-400/60 mb-0.5">
                {simplifiedSchedule}
              </div>
              <div className="text-sm font-medium text-purple-300">
                {description}
              </div>
            </div>
            <div className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 whitespace-nowrap">
              {timezoneLabel}
            </div>
          </div>

          {/* Conversion warning */}
          {conversionWarning && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
              ⚠️ {conversionWarning}
            </div>
          )}

          {/* Validation error */}
          {!validation.valid && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
              ⚠️ {validation.error}
            </div>
          )}

          {/* Missing required fields indicator */}
          {hasMissingRequired && !isExecuting && (
            <div className="mt-2">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-600/40">
                <span>⚠️</span>
                <span>
                  {missingRequiredFields.length} required field
                  {missingRequiredFields.length !== 1 ? 's' : ''} missing
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule editor */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Frequency selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-2">
              Runs
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                handleFrequencyChange(e.target.value as FrequencyType)
              }
              disabled={isExecuting}
              aria-label="Schedule frequency"
              className="w-full px-3 py-2 text-sm bg-neutral-900 border border-neutral-600 rounded text-neutral-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="minute">Every Minute</option>
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>

          {/* Interval (for minute and hour) */}
          {(frequency === 'minute' || frequency === 'hour') && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Every
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.max(1, interval - 1);
                      handleIntervalChange(newVal);
                    }}
                    disabled={isExecuting || interval <= 1}
                    aria-label="Decrease interval"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    value={interval}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      handleIntervalChange(val);
                    }}
                    disabled={isExecuting}
                    aria-label="Interval value"
                    className="w-16 px-2 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const maxVal = frequency === 'minute' ? 59 : 23;
                      const newVal = Math.min(maxVal, interval + 1);
                      handleIntervalChange(newVal);
                    }}
                    disabled={
                      isExecuting ||
                      interval >= (frequency === 'minute' ? 59 : 23)
                    }
                    aria-label="Increase interval"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm text-neutral-400">
                  {frequency === 'minute' ? 'minute(s)' : 'hour(s)'}
                </span>
              </div>
            </div>
          )}

          {/* Time picker (for day, week, month) */}
          {(frequency === 'day' ||
            frequency === 'week' ||
            frequency === 'month') && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Time
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.max(0, hour - 1);
                      handleHourChange(newVal);
                    }}
                    disabled={isExecuting || hour <= 0}
                    aria-label="Decrease hour"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    value={hour.toString().padStart(2, '0')}
                    onChange={(e) => {
                      const val = Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value) || 0)
                      );
                      handleHourChange(val);
                    }}
                    disabled={isExecuting}
                    className="w-14 px-2 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                    placeholder="HH"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.min(23, hour + 1);
                      handleHourChange(newVal);
                    }}
                    disabled={isExecuting || hour >= 23}
                    aria-label="Increase hour"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-neutral-400">:</span>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.max(0, minute - 1);
                      handleMinuteChange(newVal);
                    }}
                    disabled={isExecuting || minute <= 0}
                    aria-label="Decrease minute"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    value={minute.toString().padStart(2, '0')}
                    onChange={(e) => {
                      const val = Math.min(
                        59,
                        Math.max(0, parseInt(e.target.value) || 0)
                      );
                      handleMinuteChange(val);
                    }}
                    disabled={isExecuting}
                    className="w-14 px-2 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                    placeholder="MM"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.min(59, minute + 1);
                      handleMinuteChange(newVal);
                    }}
                    disabled={isExecuting || minute >= 59}
                    aria-label="Increase minute"
                    className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm text-neutral-400">
                  {hour < 12 ? 'AM' : 'PM'}
                </span>
              </div>
            </div>
          )}

          {/* Minute picker (for hour frequency) */}
          {frequency === 'hour' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                At Minute
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.max(0, minute - 1);
                    handleMinuteChange(newVal);
                  }}
                  disabled={isExecuting || minute <= 0}
                  aria-label="Decrease minute"
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  value={minute.toString().padStart(2, '0')}
                  onChange={(e) => {
                    const val = Math.min(
                      59,
                      Math.max(0, parseInt(e.target.value) || 0)
                    );
                    handleMinuteChange(val);
                  }}
                  disabled={isExecuting}
                  aria-label="Minute at which to run"
                  className="w-20 px-3 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(59, minute + 1);
                    handleMinuteChange(newVal);
                  }}
                  disabled={isExecuting || minute >= 59}
                  aria-label="Increase minute"
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Days of week selector (for weekly) */}
          {frequency === 'week' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Days of Week
              </label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    disabled={isExecuting}
                    className={`flex-1 px-2 py-2 rounded text-xs font-medium transition-all ${
                      daysOfWeek.includes(day.value)
                        ? 'bg-purple-600 text-white'
                        : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {daysOfWeek.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  Select at least one day
                </p>
              )}
            </div>
          )}

          {/* Day of month selector (for monthly) */}
          {frequency === 'month' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Day of Month
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.max(1, dayOfMonth - 1);
                    handleDayOfMonthChange(newVal);
                  }}
                  disabled={isExecuting || dayOfMonth <= 1}
                  aria-label="Decrease day"
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-l border border-neutral-600 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  value={dayOfMonth}
                  onChange={(e) => {
                    const val = Math.min(
                      31,
                      Math.max(1, parseInt(e.target.value) || 1)
                    );
                    handleDayOfMonthChange(val);
                  }}
                  disabled={isExecuting}
                  aria-label="Day of month"
                  className="w-20 px-3 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(31, dayOfMonth + 1);
                    handleDayOfMonthChange(newVal);
                  }}
                  disabled={isExecuting || dayOfMonth >= 31}
                  aria-label="Increase day"
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-r border border-neutral-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input fields section */}
      {isExpanded && schemaFields.length > 0 && (
        <div className="p-4 border-t border-neutral-600">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-neutral-300">
              Default Input Values
            </div>
            {hasUnsavedInputChanges && flowId && (
              <button
                type="button"
                onClick={handleSaveInputs}
                disabled={validateCodeMutation.isPending}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 hover:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3 h-3" />
                {validateCodeMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
          <div className="space-y-3">
            <InputFieldsRenderer
              schemaFields={schemaFields}
              inputValues={inputValues}
              onInputChange={handleInputChange}
              isExecuting={isExecuting}
            />
          </div>
        </div>
      )}

      {/* Execute button */}
      <div className="p-4 border-t border-neutral-600">
        <button
          type="button"
          onClick={handleExecuteFlow}
          disabled={!validation.valid || isExecuting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            validation.valid && !isExecuting
              ? 'bg-purple-600 hover:bg-purple-500 text-white'
              : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }`}
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Test Flow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(CronScheduleNode);
