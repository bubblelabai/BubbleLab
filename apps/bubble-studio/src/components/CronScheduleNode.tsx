import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  Power,
  Plus,
  Minus,
} from 'lucide-react';
import {
  describeCronExpression,
  validateCronExpression,
} from '@bubblelab/shared-schemas';
import { parseJSONSchema } from '../utils/inputSchemaParser';
import InputFieldsRenderer from './InputFieldsRenderer';

interface CronScheduleNodeData {
  flowName: string;
  cronSchedule: string;
  isActive?: boolean;
  inputSchema?: Record<string, unknown>;
  defaultInputs?: Record<string, unknown>;
  onCronScheduleChange?: (newSchedule: string) => void;
  onActiveToggle?: (
    isActive: boolean,
    defaultInputs?: Record<string, unknown>
  ) => void;
  onDefaultInputChange?: (fieldName: string, value: unknown) => void;
  onExecuteFlow?: () => void;
  isExecuting?: boolean;
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

// Helper function to parse cron into UI-friendly format
function parseCronToUI(cronSchedule: string): {
  frequency: FrequencyType;
  interval: number;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  dayOfMonth: number;
} {
  const parts = cronSchedule.split(' ');
  if (parts.length !== 5) {
    return {
      frequency: 'day',
      interval: 1,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
  }

  const [minutePart, hourPart, dayPart, , weekPart] = parts;

  // Detect frequency type
  if (minutePart.startsWith('*/')) {
    return {
      frequency: 'minute',
      interval: parseInt(minutePart.slice(2)) || 1,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
  }
  if (hourPart.startsWith('*/') && minutePart !== '*') {
    return {
      frequency: 'hour',
      interval: parseInt(hourPart.slice(2)) || 1,
      hour: 0,
      minute: parseInt(minutePart) || 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
  }
  if (weekPart !== '*') {
    // Weekly schedule
    const daysOfWeek = weekPart.includes(',')
      ? weekPart.split(',').map((d) => parseInt(d))
      : weekPart.includes('-')
        ? Array.from(
            {
              length:
                parseInt(weekPart.split('-')[1]) -
                parseInt(weekPart.split('-')[0]) +
                1,
            },
            (_, i) => parseInt(weekPart.split('-')[0]) + i
          )
        : [parseInt(weekPart)];
    return {
      frequency: 'week',
      interval: 1,
      hour: parseInt(hourPart) || 0,
      minute: parseInt(minutePart) || 0,
      daysOfWeek,
      dayOfMonth: 1,
    };
  }
  if (dayPart !== '*' && dayPart !== '1') {
    return {
      frequency: 'month',
      interval: 1,
      hour: parseInt(hourPart) || 0,
      minute: parseInt(minutePart) || 0,
      daysOfWeek: [],
      dayOfMonth: parseInt(dayPart) || 1,
    };
  }

  // Daily schedule
  return {
    frequency: 'day',
    interval: 1,
    hour: parseInt(hourPart) || 0,
    minute: parseInt(minutePart) || 0,
    daysOfWeek: [],
    dayOfMonth: 1,
  };
}

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
    case 'week':
      const days = daysOfWeek.length > 0 ? daysOfWeek.sort().join(',') : '*';
      return `${minute} ${hour} * * ${days}`;
    case 'month':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return '0 0 * * *';
  }
}

function CronScheduleNode({ data }: CronScheduleNodeProps) {
  const {
    flowName,
    cronSchedule,
    isActive = true,
    inputSchema = {},
    defaultInputs = {},
    onCronScheduleChange,
    onActiveToggle,
    onDefaultInputChange,
    onExecuteFlow,
    isExecuting = false,
  } = data;

  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValues, setInputValues] =
    useState<Record<string, unknown>>(defaultInputs);

  // Parse input schema using the same logic as InputSchemaNode
  const schemaFields =
    typeof inputSchema === 'string'
      ? parseJSONSchema(inputSchema)
      : inputSchema.properties
        ? Object.entries(inputSchema.properties).map(([name, schema]) => ({
            name,
            type: (schema as any)?.type || 'string',
            required: Array.isArray(inputSchema.required)
              ? inputSchema.required.includes(name)
              : false,
            description: (schema as any)?.description,
            default: (schema as any)?.default,
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

  const hasMissingRequired = missingRequiredFields.length > 0;

  // Parse initial cron schedule
  const initialState = parseCronToUI(cronSchedule);
  const [frequency, setFrequency] = useState<FrequencyType>(
    initialState.frequency
  );
  const [interval, setInterval] = useState(initialState.interval);
  const [hour, setHour] = useState(initialState.hour);
  const [minute, setMinute] = useState(initialState.minute);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialState.daysOfWeek
  );
  const [dayOfMonth, setDayOfMonth] = useState(initialState.dayOfMonth);

  // Compute current cron from state
  const currentCron = buildCronFromUI(
    frequency,
    interval,
    hour,
    minute,
    daysOfWeek,
    dayOfMonth
  );

  // Parse and validate the current cron expression
  const validation = validateCronExpression(currentCron);
  const description = validation.valid
    ? describeCronExpression(currentCron)
    : 'Invalid cron expression';

  const handleActiveToggle = () => {
    onActiveToggle?.(!isActive, inputValues);
  };

  const handleInputChange = (fieldName: string, value: unknown) => {
    const newInputValues = { ...inputValues, [fieldName]: value };
    setInputValues(newInputValues);
    onDefaultInputChange?.(fieldName, value);
  };

  const handleFrequencyChange = (newFrequency: FrequencyType) => {
    setFrequency(newFrequency);
    const newCron = buildCronFromUI(
      newFrequency,
      interval,
      hour,
      minute,
      daysOfWeek,
      dayOfMonth
    );
    onCronScheduleChange?.(newCron);
  };

  const handleIntervalChange = (newInterval: number) => {
    setInterval(newInterval);
  };

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
  };

  const handleDayOfMonthChange = (newDay: number) => {
    setDayOfMonth(newDay);
  };

  // Call onCronScheduleChange when user finishes editing (on blur)
  const handleBlur = () => {
    const newCron = buildCronFromUI(
      frequency,
      interval,
      hour,
      minute,
      daysOfWeek,
      dayOfMonth
    );
    if (newCron !== cronSchedule) {
      onCronScheduleChange?.(newCron);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    const newDaysOfWeek = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort();
    setDaysOfWeek(newDaysOfWeek);
    const newCron = buildCronFromUI(
      frequency,
      interval,
      hour,
      minute,
      newDaysOfWeek,
      dayOfMonth
    );
    onCronScheduleChange?.(newCron);
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
        className={`w-3 h-3 ${isExecuting ? 'bg-purple-400' : isActive ? 'bg-purple-400' : 'bg-neutral-500'}`}
        style={{ right: -6 }}
      />

      {/* Header */}
      <div className="p-4 border-b border-neutral-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-purple-600' : 'bg-neutral-600'}`}
            >
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                Cron Schedule
              </h3>
              <p className="text-xs text-neutral-400">{flowName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Active/Inactive toggle */}
            {onActiveToggle && (
              <button
                type="button"
                onClick={handleActiveToggle}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30'
                    : 'bg-neutral-700/50 text-neutral-400 border border-neutral-600 hover:bg-neutral-700'
                }`}
                title={isActive ? 'Schedule is active' : 'Schedule is inactive'}
              >
                <Power
                  className={`w-3 h-3 ${isActive ? 'text-green-400' : 'text-neutral-500'}`}
                />
                {isActive ? 'Active' : 'Inactive'}
              </button>
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
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xs text-neutral-400 mb-1">Schedule:</div>
              <div className="text-sm font-medium text-purple-300">
                {description}
              </div>
            </div>
          </div>

          {/* Cron expression display */}
          <div className="bg-neutral-900/50 rounded px-2 py-1.5 font-mono text-xs text-neutral-300 border border-neutral-700">
            {cronSchedule}
          </div>

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
      {isExpanded && onCronScheduleChange && (
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
                      handleBlur();
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
                    onBlur={handleBlur}
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
                      handleBlur();
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
                      handleBlur();
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
                    onBlur={handleBlur}
                    disabled={isExecuting}
                    className="w-14 px-2 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                    placeholder="HH"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.min(23, hour + 1);
                      handleHourChange(newVal);
                      handleBlur();
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
                      handleBlur();
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
                    onBlur={handleBlur}
                    disabled={isExecuting}
                    className="w-14 px-2 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                    placeholder="MM"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = Math.min(59, minute + 1);
                      handleMinuteChange(newVal);
                      handleBlur();
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
                    handleBlur();
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
                  onBlur={handleBlur}
                  disabled={isExecuting}
                  aria-label="Minute at which to run"
                  className="w-20 px-3 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(59, minute + 1);
                    handleMinuteChange(newVal);
                    handleBlur();
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
                    handleBlur();
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
                  onBlur={handleBlur}
                  disabled={isExecuting}
                  aria-label="Day of month"
                  className="w-20 px-3 py-2 text-sm bg-neutral-900 border-t border-b border-neutral-600 text-neutral-100 text-center focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(31, dayOfMonth + 1);
                    handleDayOfMonthChange(newVal);
                    handleBlur();
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

          {/* Preview cron expression */}
          <div className="pt-3 border-t border-neutral-700">
            <div className="text-xs text-neutral-500 mb-1">
              Cron Expression:
            </div>
            <div className="bg-neutral-900/50 rounded px-2 py-1.5 font-mono text-xs text-neutral-300 border border-neutral-700">
              {currentCron}
            </div>
          </div>
        </div>
      )}

      {/* Input fields section */}
      {isExpanded && schemaFields.length > 0 && (
        <div className="p-4 border-t border-neutral-600">
          <div className="text-xs font-medium text-neutral-300 mb-3">
            Default Input Values
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
      {onExecuteFlow && (
        <div className="p-4 border-t border-neutral-600">
          <button
            type="button"
            onClick={onExecuteFlow}
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
      )}
    </div>
  );
}

export default memo(CronScheduleNode);
