import {
  describeCronExpression,
  validateCronExpression,
} from '@bubblelab/shared-schemas';

export interface CronDescription {
  description: string;
  isValid: boolean;
  error?: string;
}

export interface CronParts {
  frequency: 'minute' | 'hour' | 'day' | 'week' | 'month';
  interval: number;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  dayOfMonth: number;
}

export interface ConversionResult {
  parts: CronParts;
  warning?: string;
}

/**
 * Convert a cron expression to a human-readable English description
 * @param cronExpression - Standard 5-part cron expression (minute hour day month weekday)
 * @returns Object containing the description, validity, and any error message
 */
export function cronToEnglish(cronExpression: string): CronDescription {
  const validation = validateCronExpression(cronExpression);

  if (!validation.valid) {
    return {
      description: 'Invalid cron expression',
      isValid: false,
      error: validation.error,
    };
  }

  const description = describeCronExpression(cronExpression);

  return {
    description,
    isValid: true,
  };
}

/**
 * Get the user's timezone
 */
export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format timezone label with offset
 */
export function formatTimeZoneLabel(
  tz: string,
  date: Date = new Date()
): string {
  const offset = -date.getTimezoneOffset() / 60;
  const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
  return `${tz} (UTC${offsetStr})`;
}

/**
 * Parse a cron field that may contain single values, comma-separated lists, and/or ranges.
 * Examples: "5", "1,3,5", "1-5", "1,3-5,7" - all become arrays of numbers
 */
function parseCronField(field: string): number[] {
  if (field === '*') return [];

  const results: number[] = [];
  const segments = field.split(',');

  for (const segment of segments) {
    if (segment.includes('-')) {
      // Handle range like "1-5"
      const [startStr, endStr] = segment.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          results.push(i);
        }
      }
    } else if (segment.startsWith('*/')) {
      // Handle step - this is handled separately, so we skip here
      continue;
    } else {
      const num = parseInt(segment, 10);
      if (!isNaN(num)) {
        results.push(num);
      }
    }
  }

  // Remove duplicates and sort
  return Array.from(new Set(results)).sort((a, b) => a - b);
}

/**
 * Extract step interval from a cron field like "STAR/5" or "0-30/10"
 * Returns the interval number, or null if no step pattern
 */
function extractStepInterval(field: string): number | null {
  if (field.includes('/')) {
    const stepPart = field.split('/')[1];
    const interval = parseInt(stepPart, 10);
    return isNaN(interval) ? null : interval;
  }
  return null;
}

/**
 * Parse cron expression to UI-friendly parts.
 * Supports arbitrary cron expressions and maps them to the closest UI representation.
 *
 * Priority order for detection:
 * 1. Minute interval (minute field has step)
 * 2. Hourly interval (hour field has step)
 * 3. Monthly (day-of-month is specific, takes precedence over weekly for mixed expressions)
 * 4. Weekly (day-of-week is specific)
 * 5. Daily (fallback)
 */
export function parseCronToParts(cronSchedule: string): CronParts {
  const defaultParts: CronParts = {
    frequency: 'day',
    interval: 1,
    hour: 0,
    minute: 0,
    daysOfWeek: [],
    dayOfMonth: 1,
  };

  const parts = cronSchedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return defaultParts;
  }

  const [minutePart, hourPart, dayPart, , weekPart] = parts;

  // 1. Check for minute interval (e.g., "*/5 * * * *")
  const minuteInterval = extractStepInterval(minutePart);
  if (
    minuteInterval !== null &&
    (minutePart.startsWith('*') || minutePart.includes('/'))
  ) {
    return {
      frequency: 'minute',
      interval: minuteInterval,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
  }

  // 2. Check for hourly interval (e.g., "0 */2 * * *" or "30 */3 * * *")
  const hourInterval = extractStepInterval(hourPart);
  if (
    hourInterval !== null &&
    (hourPart.startsWith('*') || hourPart.includes('/'))
  ) {
    // Parse the minute value (could be specific or wildcard)
    const minuteValue = minutePart === '*' ? 0 : parseInt(minutePart, 10) || 0;
    return {
      frequency: 'hour',
      interval: hourInterval,
      hour: 0,
      minute: minuteValue,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
  }

  // Parse hour and minute for remaining cases
  const hourValue = hourPart === '*' ? 0 : parseInt(hourPart, 10) || 0;
  const minuteValue = minutePart === '*' ? 0 : parseInt(minutePart, 10) || 0;

  // 3. Check for monthly schedule (day-of-month is specific)
  // Monthly takes precedence because day-of-month constraints are more restrictive
  if (dayPart !== '*') {
    const dayOfMonthValues = parseCronField(dayPart);
    return {
      frequency: 'month',
      interval: 1,
      hour: hourValue,
      minute: minuteValue,
      daysOfWeek: [],
      // Use first day if multiple specified, default to 1
      dayOfMonth: dayOfMonthValues.length > 0 ? dayOfMonthValues[0] : 1,
    };
  }

  // 4. Check for weekly schedule (day-of-week is specific)
  if (weekPart !== '*') {
    const daysOfWeek = parseCronField(weekPart);
    return {
      frequency: 'week',
      interval: 1,
      hour: hourValue,
      minute: minuteValue,
      daysOfWeek,
      dayOfMonth: 1,
    };
  }

  // 5. Daily schedule (default fallback)
  return {
    frequency: 'day',
    interval: 1,
    hour: hourValue,
    minute: minuteValue,
    daysOfWeek: [],
    dayOfMonth: 1,
  };
}

/**
 * Build cron from UI parts
 */
export function buildCronFromParts(parts: CronParts): string {
  const { frequency, interval, hour, minute, daysOfWeek, dayOfMonth } = parts;

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

/**
 * Format hour and minute to 12-hour time string (e.g., "9am", "2:30pm", "12am")
 */
function formatTime12Hour(hour: number, minute: number): string {
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  if (minute === 0) {
    return `${hour12}${period}`;
  }
  return `${hour12}:${minute.toString().padStart(2, '0')}${period}`;
}

/**
 * Create simplified schedule description for display
 * @param parts - Parsed cron parts
 * @returns Simplified human-readable schedule description
 */
export function getSimplifiedSchedule(parts: CronParts): string {
  switch (parts.frequency) {
    case 'minute':
      return `Every ${parts.interval} min${parts.interval > 1 ? 's' : ''}`;
    case 'hour':
      return `Every ${parts.interval} hr${parts.interval > 1 ? 's' : ''}`;
    case 'day':
      return `Daily ${formatTime12Hour(parts.hour, parts.minute)}`;
    case 'week':
      return `Weekly ${formatTime12Hour(parts.hour, parts.minute)}`;
    case 'month':
      return `Monthly ${formatTime12Hour(parts.hour, parts.minute)}`;
    default:
      return 'Scheduled';
  }
}

/**
 * Convert local time parts to UTC cron
 */
export function convertLocalPartsToUtcCron(parts: CronParts): {
  cron: string;
  warning?: string;
} {
  // For minute/hour intervals, no timezone conversion needed
  if (parts.frequency === 'minute' || parts.frequency === 'hour') {
    return { cron: buildCronFromParts(parts) };
  }

  // Create a representative date in the local timezone
  const localDate = new Date();
  localDate.setHours(parts.hour, parts.minute, 0, 0);

  // Get timezone offset in minutes
  // Note: getTimezoneOffset() returns positive for timezones behind UTC
  // e.g., UTC-7 returns +420 minutes
  const offsetMinutes = localDate.getTimezoneOffset();
  const offsetHours = offsetMinutes / 60;

  // Calculate UTC time by adding the offset
  // (since offset is positive when behind UTC)
  const utcHour = (parts.hour + offsetHours + 24) % 24;
  const utcMinute = parts.minute;

  // Handle day shifts for weekly/monthly
  const deltaDays = 0;
  let warning: string | undefined;

  if (parts.frequency === 'week') {
    // For weekly, adjust days of week
    const adjustedDaysOfWeek = parts.daysOfWeek.map(
      (day) => (day + deltaDays) % 7
    );
    const utcParts: CronParts = {
      ...parts,
      hour: Math.floor(utcHour),
      minute: utcMinute,
      daysOfWeek: adjustedDaysOfWeek,
    };
    return { cron: buildCronFromParts(utcParts) };
  }

  if (parts.frequency === 'month') {
    // For monthly, check if day shift crosses month boundary
    const newDay = parts.dayOfMonth + deltaDays;
    if (newDay <= 0 || newDay > 31) {
      warning = 'Day of month may shift due to timezone conversion';
    }
    const utcParts: CronParts = {
      ...parts,
      hour: Math.floor(utcHour),
      minute: utcMinute,
      dayOfMonth: Math.max(1, Math.min(31, newDay)),
    };
    return { cron: buildCronFromParts(utcParts), warning };
  }

  // Daily schedule
  const utcParts: CronParts = {
    ...parts,
    hour: Math.floor(utcHour),
    minute: utcMinute,
  };
  return { cron: buildCronFromParts(utcParts) };
}

/**
 * Convert UTC cron to local time parts
 */
export function convertUtcCronToLocalParts(cron: string): ConversionResult {
  const utcParts = parseCronToParts(cron);

  // For minute/hour intervals, no conversion needed
  if (utcParts.frequency === 'minute' || utcParts.frequency === 'hour') {
    return { parts: utcParts };
  }

  // Get current timezone offset
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = offsetMinutes / 60;

  // Calculate local time by subtracting the offset
  // (since offset is positive when behind UTC)
  const localHour = (utcParts.hour - offsetHours + 24) % 24;
  const localMinute = utcParts.minute;

  let warning: string | undefined;

  if (utcParts.frequency === 'week') {
    // For weekly, adjust days of week back to local
    const adjustedDaysOfWeek = utcParts.daysOfWeek.map((day) => (day - 0) % 7);
    return {
      parts: {
        ...utcParts,
        hour: Math.floor(localHour),
        minute: localMinute,
        daysOfWeek: adjustedDaysOfWeek,
      },
    };
  }

  if (utcParts.frequency === 'month') {
    // For monthly, check if day shift crosses boundary
    const newDay = utcParts.dayOfMonth;
    if (newDay <= 0 || newDay > 31) {
      warning = 'Day of month may have shifted due to timezone conversion';
    }
    return {
      parts: {
        ...utcParts,
        hour: Math.floor(localHour),
        minute: localMinute,
        dayOfMonth: Math.max(1, Math.min(31, newDay)),
      },
      warning,
    };
  }

  // Daily schedule
  return {
    parts: {
      ...utcParts,
      hour: Math.floor(localHour),
      minute: localMinute,
    },
  };
}
