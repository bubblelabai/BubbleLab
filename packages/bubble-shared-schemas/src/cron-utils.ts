/**
 * Utility functions for parsing and working with cron expressions
 * Supports standard 5-field cron format: minute hour day month day-of-week
 */

export interface CronExpression {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  original: string;
}

export interface CronScheduleInfo {
  expression: CronExpression;
  description: string;
  nextRun?: Date;
  isValid: boolean;
  error?: string;
}

/**
 * Parse a cron expression string into its components
 * @param cronString - Cron expression (e.g., "0 0 * * *")
 * @returns Parsed cron expression object
 */
export function parseCronExpression(cronString: string): CronExpression {
  const parts = cronString.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length}`
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    original: cronString,
  };
}

/**
 * Validate a cron expression
 * @param cronString - Cron expression to validate
 * @returns Object with validation result
 */
export function validateCronExpression(cronString: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const expr = parseCronExpression(cronString);

    // Validate each field
    const validations = [
      validateCronField(expr.minute, 0, 59, 'minute'),
      validateCronField(expr.hour, 0, 23, 'hour'),
      validateCronField(expr.dayOfMonth, 1, 31, 'day of month'),
      validateCronField(expr.month, 1, 12, 'month'),
      validateCronField(expr.dayOfWeek, 0, 6, 'day of week'),
    ];

    for (const validation of validations) {
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression',
    };
  }
}

/**
 * Validate a single cron field
 */
function validateCronField(
  field: string,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  // Wildcard
  if (field === '*') return { valid: true };

  // Step values (*/n)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    if (isNaN(step) || step <= 0) {
      return {
        valid: false,
        error: `Invalid step value in ${fieldName}: ${field}`,
      };
    }
    return { valid: true };
  }

  // Ranges (n-m)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map((v) => parseInt(v, 10));
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      return {
        valid: false,
        error: `Invalid range in ${fieldName}: ${field} (must be ${min}-${max})`,
      };
    }
    return { valid: true };
  }

  // Lists (n,m,o)
  if (field.includes(',')) {
    const values = field.split(',').map((v) => parseInt(v.trim(), 10));
    for (const val of values) {
      if (isNaN(val) || val < min || val > max) {
        return {
          valid: false,
          error: `Invalid value in ${fieldName} list: ${val} (must be ${min}-${max})`,
        };
      }
    }
    return { valid: true };
  }

  // Single value
  const value = parseInt(field, 10);
  if (isNaN(value) || value < min || value > max) {
    return {
      valid: false,
      error: `Invalid ${fieldName}: ${field} (must be ${min}-${max})`,
    };
  }

  return { valid: true };
}

/**
 * Generate a human-readable description of a cron expression
 * @param cronString - Cron expression to describe
 * @returns Human-readable description
 */
export function describeCronExpression(cronString: string): string {
  try {
    const expr = parseCronExpression(cronString);

    // Common patterns
    if (cronString === '* * * * *') return 'Every minute';
    if (cronString === '0 * * * *') return 'Every hour';
    if (cronString === '0 0 * * *') return 'Daily at midnight';
    if (cronString === '0 0 * * 0') return 'Weekly on Sunday at midnight';
    if (cronString === '0 0 1 * *') return 'Monthly on the 1st at midnight';
    if (cronString === '0 0 1 1 *') return 'Yearly on January 1st at midnight';

    // Step patterns
    if (expr.minute.startsWith('*/')) {
      const step = expr.minute.substring(2);
      return `Every ${step} minute${step === '1' ? '' : 's'}`;
    }
    if (expr.hour.startsWith('*/') && expr.minute === '0') {
      const step = expr.hour.substring(2);
      return `Every ${step} hour${step === '1' ? '' : 's'}`;
    }

    // Weekday patterns
    if (expr.dayOfWeek === '1-5' && expr.hour === '9' && expr.minute === '0') {
      return 'Every weekday at 9:00 AM';
    }

    // Build description from parts
    let description = 'At ';

    // Time
    if (expr.minute !== '*' && expr.hour !== '*') {
      const hour = parseInt(expr.hour, 10);
      const minute = parseInt(expr.minute, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      description += `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
    } else if (expr.minute !== '*') {
      description += `minute ${expr.minute}`;
    } else if (expr.hour !== '*') {
      description += `hour ${expr.hour}`;
    }

    // Day
    if (expr.dayOfMonth !== '*') {
      description += ` on day ${expr.dayOfMonth}`;
    }
    if (expr.dayOfWeek !== '*') {
      const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      if (expr.dayOfWeek.includes('-')) {
        const [start, end] = expr.dayOfWeek
          .split('-')
          .map((v) => parseInt(v, 10));
        description += ` on ${days[start]} through ${days[end]}`;
      } else {
        const day = parseInt(expr.dayOfWeek, 10);
        description += ` on ${days[day]}`;
      }
    }

    // Month
    if (expr.month !== '*') {
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const month = parseInt(expr.month, 10);
      description += ` in ${months[month - 1]}`;
    }

    return description;
  } catch (error) {
    return 'Invalid cron expression';
  }
}

/**
 * Get schedule information for a cron expression
 * @param cronString - Cron expression
 * @returns Schedule information including description and validation status
 */
export function getCronScheduleInfo(cronString: string): CronScheduleInfo {
  const validation = validateCronExpression(cronString);

  if (!validation.valid) {
    return {
      expression: parseCronExpression(
        cronString.split(/\s+/).length === 5 ? cronString : '0 0 * * *'
      ),
      description: 'Invalid cron expression',
      isValid: false,
      error: validation.error,
    };
  }

  return {
    expression: parseCronExpression(cronString),
    description: describeCronExpression(cronString),
    isValid: true,
  };
}
