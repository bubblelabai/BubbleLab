// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CronScheduler } from '../services/cron-scheduler.js';

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let mockLogger: Pick<Console, 'log' | 'error' | 'warn' | 'debug'>;

  beforeEach(() => {
    mockLogger = {
      log: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    };
  });

  afterEach(() => {
    scheduler?.stop();
  });

  describe('isCronDue - */30 expression should only trigger at :00 and :30', () => {
    it('should trigger at minute 0', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:00 PM UTC (13:00:00)
      const date = new Date('2025-10-27T13:00:00.000Z');
      // Access private method through type casting
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(true);
    });

    it('should trigger at minute 30', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:30 PM UTC (13:30:00)
      const date = new Date('2025-10-27T13:30:00.000Z');
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(true);
    });

    it('should NOT trigger at minute 31', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:31 PM UTC (13:31:00)
      const date = new Date('2025-10-27T13:31:00.000Z');
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(false);
    });

    it('should NOT trigger at minute 1', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:01 PM UTC (13:01:00)
      const date = new Date('2025-10-27T13:01:00.000Z');
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(false);
    });

    it('should NOT trigger at minute 15', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:15 PM UTC (13:15:00)
      const date = new Date('2025-10-27T13:15:00.000Z');
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(false);
    });

    it('should NOT trigger at minute 29', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // Test at 1:29 PM UTC (13:29:00)
      const date = new Date('2025-10-27T13:29:00.000Z');
      const isDue = (scheduler as any).isCronDue('*/30 * * * *', date);
      expect(isDue).toBe(false);
    });

    it('should reproduce the bug: check if it triggers at both 1:30 and 1:31', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      // These are the exact times from your logs
      const time1_30 = new Date('2025-10-27T20:30:00.063Z');
      const time1_31 = new Date('2025-10-27T20:31:00.018Z');

      const isDue_1_30 = (scheduler as any).isCronDue('*/30 * * * *', time1_30);
      const isDue_1_31 = (scheduler as any).isCronDue('*/30 * * * *', time1_31);

      // This test will FAIL if the bug exists
      // Expected: only 1:30 should trigger, not 1:31
      expect(isDue_1_30).toBe(true);
      expect(isDue_1_31).toBe(false); // This will fail if bug exists
    });
  });

  describe('step expressions for other intervals', () => {
    it('*/5 should trigger every 5 minutes', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
      });

      const testCases = [
        { minute: 0, expected: true },
        { minute: 5, expected: true },
        { minute: 10, expected: true },
        { minute: 15, expected: true },
        { minute: 20, expected: true },
        { minute: 25, expected: true },
        { minute: 30, expected: true },
        { minute: 1, expected: false },
        { minute: 4, expected: false },
        { minute: 6, expected: false },
        { minute: 31, expected: false },
      ];

      testCases.forEach(({ minute, expected }) => {
        const date = new Date(
          `2025-10-27T13:${minute.toString().padStart(2, '0')}:00.000Z`
        );
        const isDue = (scheduler as any).isCronDue('*/5 * * * *', date);
        expect(isDue).toBe(expected);
      });
    });
  });

  describe('tick timing with tickIntervalMs=60000 (1 minute)', () => {
    it('tick at 20:30:02', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
        tickIntervalMs: 60000, // 1 minute
      });

      const timeAt_1_30_30 = new Date('2025-10-27T20:30:02.000Z');
      const isDue_1_30_30 = (scheduler as any).isCronDue(
        '*/30 * * * *',
        timeAt_1_30_30
      );

      expect(isDue_1_30_30).toBe(true);
    });

    it('tick at 20:30:59.995', () => {
      scheduler = new CronScheduler({
        enabled: false,
        logger: mockLogger,
        tickIntervalMs: 60000,
      });

      const cronExpression = '*/30 * * * *';

      // From your Railway logs, these are the ACTUAL tick times:
      const tick1 = new Date('2025-10-27T20:30:00.000Z');
      const tick2 = new Date('2025-10-27T20:30:59.995Z');
      const tick3 = new Date('2025-10-27T20:29:59.995Z');

      const isDue1 = (scheduler as any).isCronDue(cronExpression, tick1);
      const isDue2 = (scheduler as any).isCronDue(cronExpression, tick2);
      const isDue3 = (scheduler as any).isCronDue(cronExpression, tick3);

      // Both ticks think they're in minute 30, so both match */30
      expect(tick1.getUTCMinutes()).toBe(30);
      expect(tick2.getUTCMinutes()).toBe(30); // Still minute 30!
      expect(isDue1).toBe(true);

      expect(isDue2).toBe(false);

      expect(isDue3).toBe(true);
    });
  });
});
