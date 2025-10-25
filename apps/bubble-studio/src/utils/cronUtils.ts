import {
  describeCronExpression,
  validateCronExpression,
} from '@bubblelab/shared-schemas';

export interface CronDescription {
  description: string;
  isValid: boolean;
  error?: string;
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
