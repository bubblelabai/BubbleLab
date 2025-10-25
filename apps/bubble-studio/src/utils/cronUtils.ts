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
 * Parse cron expression to UI-friendly parts (reused from CronScheduleNode)
 */
function parseCronToParts(cronSchedule: string): CronParts {
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
 * Create simplified schedule description for display
 * @param parts - Parsed cron parts
 * @returns Simplified human-readable schedule description
 */
export function getSimplifiedSchedule(parts: CronParts): string {
  switch (parts.frequency) {
    case 'minute':
      return `Every ${parts.interval} minute${parts.interval > 1 ? 's' : ''}`;
    case 'hour':
      return `Every ${parts.interval} hour${parts.interval > 1 ? 's' : ''}`;
    case 'day':
      return 'Daily';
    case 'week':
      return 'Weekly';
    case 'month':
      return 'Monthly';
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
