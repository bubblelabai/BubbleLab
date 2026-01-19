import { describe, it, expect } from 'vitest';
import {
  parseCronToParts,
  buildCronFromParts,
  getSimplifiedSchedule,
  CronParts,
} from './cronUtils';

describe('parseCronToParts', () => {
  describe('minute intervals', () => {
    it('should parse every 5 minutes', () => {
      const result = parseCronToParts('*/5 * * * *');
      expect(result.frequency).toBe('minute');
      expect(result.interval).toBe(5);
    });

    it('should parse every 15 minutes', () => {
      const result = parseCronToParts('*/15 * * * *');
      expect(result.frequency).toBe('minute');
      expect(result.interval).toBe(15);
    });

    it('should parse every 1 minute', () => {
      const result = parseCronToParts('*/1 * * * *');
      expect(result.frequency).toBe('minute');
      expect(result.interval).toBe(1);
    });
  });

  describe('hourly intervals', () => {
    it('should parse every 2 hours at minute 0', () => {
      const result = parseCronToParts('0 */2 * * *');
      expect(result.frequency).toBe('hour');
      expect(result.interval).toBe(2);
      expect(result.minute).toBe(0);
    });

    it('should parse every 3 hours at minute 30', () => {
      const result = parseCronToParts('30 */3 * * *');
      expect(result.frequency).toBe('hour');
      expect(result.interval).toBe(3);
      expect(result.minute).toBe(30);
    });

    it('should parse every hour with wildcard minute', () => {
      const result = parseCronToParts('* */1 * * *');
      expect(result.frequency).toBe('hour');
      expect(result.interval).toBe(1);
      expect(result.minute).toBe(0); // defaults to 0 for wildcard
    });
  });

  describe('daily schedules', () => {
    it('should parse daily at 9am', () => {
      const result = parseCronToParts('0 9 * * *');
      expect(result.frequency).toBe('day');
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(0);
    });

    it('should parse daily at 2:30pm', () => {
      const result = parseCronToParts('30 14 * * *');
      expect(result.frequency).toBe('day');
      expect(result.hour).toBe(14);
      expect(result.minute).toBe(30);
    });

    it('should parse daily at midnight', () => {
      const result = parseCronToParts('0 0 * * *');
      expect(result.frequency).toBe('day');
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
    });
  });

  describe('weekly schedules', () => {
    it('should parse every Monday at 9am', () => {
      const result = parseCronToParts('0 9 * * 1');
      expect(result.frequency).toBe('week');
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(0);
      expect(result.daysOfWeek).toEqual([1]);
    });

    it('should parse Mon-Fri at 9am', () => {
      const result = parseCronToParts('0 9 * * 1-5');
      expect(result.frequency).toBe('week');
      expect(result.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse Mon, Wed, Fri at 9am', () => {
      const result = parseCronToParts('0 9 * * 1,3,5');
      expect(result.frequency).toBe('week');
      expect(result.daysOfWeek).toEqual([1, 3, 5]);
    });

    it('should parse complex weekly schedule with mixed ranges', () => {
      // Mon, Wed-Fri (1, 3-5)
      const result = parseCronToParts('0 9 * * 1,3-5');
      expect(result.frequency).toBe('week');
      expect(result.daysOfWeek).toEqual([1, 3, 4, 5]);
    });

    it('should parse Sunday at 10:30am', () => {
      const result = parseCronToParts('30 10 * * 0');
      expect(result.frequency).toBe('week');
      expect(result.hour).toBe(10);
      expect(result.minute).toBe(30);
      expect(result.daysOfWeek).toEqual([0]);
    });
  });

  describe('monthly schedules', () => {
    it('should parse 1st of every month at 9am', () => {
      const result = parseCronToParts('0 9 1 * *');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(1);
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(0);
    });

    it('should parse 15th of every month at 2pm', () => {
      const result = parseCronToParts('0 14 15 * *');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(15);
      expect(result.hour).toBe(14);
    });

    it('should parse last day of month style (31st)', () => {
      const result = parseCronToParts('0 9 31 * *');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(31);
    });

    it('should parse multiple days of month (uses first)', () => {
      const result = parseCronToParts('0 9 1,15 * *');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(1); // uses first day
    });

    it('should parse range of days of month (uses first)', () => {
      const result = parseCronToParts('0 9 10-15 * *');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid cron (not 5 parts)', () => {
      const result = parseCronToParts('* * *');
      expect(result.frequency).toBe('day');
      expect(result.interval).toBe(1);
    });

    it('should handle empty string', () => {
      const result = parseCronToParts('');
      expect(result.frequency).toBe('day');
    });

    it('should handle extra whitespace', () => {
      const result = parseCronToParts('  0   9   *   *   *  ');
      expect(result.frequency).toBe('day');
      expect(result.hour).toBe(9);
    });

    it('should prioritize monthly over weekly when both are specified', () => {
      // 15th at 9am, only on Mondays - should be detected as monthly
      const result = parseCronToParts('0 9 15 * 1');
      expect(result.frequency).toBe('month');
      expect(result.dayOfMonth).toBe(15);
    });

    it('should handle 0 values correctly', () => {
      const result = parseCronToParts('0 0 * * 0');
      expect(result.frequency).toBe('week');
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.daysOfWeek).toEqual([0]);
    });
  });
});

describe('buildCronFromParts', () => {
  it('should build minute interval cron', () => {
    const parts: CronParts = {
      frequency: 'minute',
      interval: 5,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('*/5 * * * *');
  });

  it('should build hourly interval cron', () => {
    const parts: CronParts = {
      frequency: 'hour',
      interval: 2,
      hour: 0,
      minute: 30,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('30 */2 * * *');
  });

  it('should build daily cron', () => {
    const parts: CronParts = {
      frequency: 'day',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('0 9 * * *');
  });

  it('should build weekly cron with specific days', () => {
    const parts: CronParts = {
      frequency: 'week',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [1, 3, 5],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('0 9 * * 1,3,5');
  });

  it('should build weekly cron with empty days as wildcard', () => {
    const parts: CronParts = {
      frequency: 'week',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('0 9 * * *');
  });

  it('should build monthly cron', () => {
    const parts: CronParts = {
      frequency: 'month',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 15,
    };
    expect(buildCronFromParts(parts)).toBe('0 9 15 * *');
  });

  it('should build monthly cron for 1st of month', () => {
    const parts: CronParts = {
      frequency: 'month',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(buildCronFromParts(parts)).toBe('0 9 1 * *');
  });
});

describe('round-trip parsing and building', () => {
  const testCases = [
    { name: 'every 5 minutes', cron: '*/5 * * * *' },
    { name: 'every 2 hours', cron: '0 */2 * * *' },
    { name: 'daily at 9am', cron: '0 9 * * *' },
    { name: 'daily at 2:30pm', cron: '30 14 * * *' },
    { name: 'weekly on Monday', cron: '0 9 * * 1' },
    { name: 'monthly on the 1st', cron: '0 9 1 * *' },
    { name: 'monthly on the 15th', cron: '0 9 15 * *' },
  ];

  testCases.forEach(({ name, cron }) => {
    it(`should round-trip: ${name}`, () => {
      const parts = parseCronToParts(cron);
      const rebuilt = buildCronFromParts(parts);
      expect(rebuilt).toBe(cron);
    });
  });
});

describe('getSimplifiedSchedule', () => {
  it('should format minute intervals', () => {
    const parts: CronParts = {
      frequency: 'minute',
      interval: 5,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Every 5 mins');
  });

  it('should format single minute correctly', () => {
    const parts: CronParts = {
      frequency: 'minute',
      interval: 1,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Every 1 min');
  });

  it('should format hourly intervals', () => {
    const parts: CronParts = {
      frequency: 'hour',
      interval: 2,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Every 2 hrs');
  });

  it('should format daily with 12-hour time', () => {
    const parts: CronParts = {
      frequency: 'day',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Daily 9am');
  });

  it('should format daily with PM time', () => {
    const parts: CronParts = {
      frequency: 'day',
      interval: 1,
      hour: 14,
      minute: 30,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Daily 2:30pm');
  });

  it('should format weekly', () => {
    const parts: CronParts = {
      frequency: 'week',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [1],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Weekly 9am');
  });

  it('should format monthly', () => {
    const parts: CronParts = {
      frequency: 'month',
      interval: 1,
      hour: 9,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 15,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Monthly 9am');
  });

  it('should handle midnight correctly', () => {
    const parts: CronParts = {
      frequency: 'day',
      interval: 1,
      hour: 0,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Daily 12am');
  });

  it('should handle noon correctly', () => {
    const parts: CronParts = {
      frequency: 'day',
      interval: 1,
      hour: 12,
      minute: 0,
      daysOfWeek: [],
      dayOfMonth: 1,
    };
    expect(getSimplifiedSchedule(parts)).toBe('Daily 12pm');
  });
});
