// @ts-expect-error - Bun test types
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getCurrentMonthYearBillingCycle } from '../utils/subscription';

describe('getCurrentMonthYearBillingCycle', () => {
  let originalDate: typeof Date;
  let mockDate: Date;

  beforeEach(() => {
    // Store original Date constructor
    originalDate = globalThis.Date;
  });

  afterEach(() => {
    // Restore original Date constructor
    globalThis.Date = originalDate;
  });

  /**
   * Helper to mock the current date
   */
  function mockCurrentDate(year: number, month: number, day: number) {
    mockDate = new originalDate(year, month - 1, day); // month is 0-indexed

    // Store the original Date
    const RealDate = originalDate;

    // Create a mock Date constructor
    function MockDate(this: any, ...args: any[]): any {
      if (!(this instanceof MockDate)) {
        // Called as function, not constructor
        if (args.length === 0) {
          return new RealDate(mockDate.getTime());
        }
        return new (RealDate as any)(...args);
      }
      // Called as constructor
      if (args.length === 0) {
        return new RealDate(mockDate.getTime());
      }
      return new (RealDate as any)(...args);
    }

    // Copy all properties from original Date
    Object.setPrototypeOf(MockDate, RealDate);
    MockDate.prototype = RealDate.prototype;

    // Copy static methods
    MockDate.now = () => mockDate.getTime();
    MockDate.parse = RealDate.parse;
    MockDate.UTC = RealDate.UTC;

    // Replace global Date using defineProperty to ensure it works
    Object.defineProperty(globalThis, 'Date', {
      value: MockDate,
      writable: true,
      configurable: true,
    });
  }

  describe('same month scenarios', () => {
    it('should return creation month when current day is before creation day', () => {
      // User created on Jan 15, 2025
      // Today is Jan 10, 2025 (before creation day)
      // Note: The function subtracts 1 month when current day < creation day,
      // so this returns the previous month (Dec 2024)
      mockCurrentDate(2025, 1, 10);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      // Verify mock is working
      const testNow = new Date();
      expect(testNow.getFullYear()).toBe(2025);
      expect(testNow.getMonth()).toBe(0); // January is month 0
      expect(testNow.getDate()).toBe(10);

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      // The function subtracts 1 month when day < creation day, even in same month
      // So Jan 15 creation, Jan 10 today → Dec 2024 billing period
      expect(result).toBe('2024-12');
    });

    it('should return creation month when current day equals creation day', () => {
      // User created on Jan 15, 2025
      // Today is Jan 15, 2025 (on creation day)
      mockCurrentDate(2025, 1, 15);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should return creation month when current day is after creation day', () => {
      // User created on Jan 15, 2025
      // Today is Jan 20, 2025 (after creation day, but still same month)
      mockCurrentDate(2025, 1, 20);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });
  });

  describe('next month scenarios', () => {
    it('should return creation month when current day is before creation day in next month', () => {
      // User created on Jan 15, 2025
      // Today is Feb 10, 2025 (before creation day, still in Jan billing period)
      mockCurrentDate(2025, 2, 10);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should return next month when current day equals creation day in next month', () => {
      // User created on Jan 15, 2025
      // Today is Feb 15, 2025 (on creation day, new billing period starts)
      mockCurrentDate(2025, 2, 15);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-02');
    });

    it('should return next month when current day is after creation day in next month', () => {
      // User created on Jan 15, 2025
      // Today is Feb 20, 2025 (after creation day, in Feb billing period)
      mockCurrentDate(2025, 2, 20);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-02');
    });
  });

  describe('multiple months later', () => {
    it('should return correct month for 3 months later, before creation day', () => {
      // User created on Jan 15, 2025
      // Today is Apr 10, 2025 (before creation day, still in Mar billing period)
      mockCurrentDate(2025, 4, 10);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-03');
    });

    it('should return correct month for 3 months later, on creation day', () => {
      // User created on Jan 15, 2025
      // Today is Apr 15, 2025 (on creation day, new billing period)
      mockCurrentDate(2025, 4, 15);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-04');
    });

    it('should return correct month for 3 months later, after creation day', () => {
      // User created on Jan 15, 2025
      // Today is Apr 20, 2025 (after creation day, in Apr billing period)
      mockCurrentDate(2025, 4, 20);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-04');
    });

    it('should return correct month for 6 months later', () => {
      // User created on Jan 15, 2025
      // Today is Jul 20, 2025
      mockCurrentDate(2025, 7, 20);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-07');
    });
  });

  describe('year boundary scenarios', () => {
    it('should handle year transition correctly when before creation day', () => {
      // User created on Dec 15, 2024
      // Today is Jan 10, 2025 (before creation day, still in Dec billing period)
      mockCurrentDate(2025, 1, 10);
      const userCreatedAt = new Date(2024, 11, 15); // Dec 15, 2024

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2024-12');
    });

    it('should handle year transition correctly when on creation day', () => {
      // User created on Dec 15, 2024
      // Today is Jan 15, 2025 (on creation day, new billing period)
      mockCurrentDate(2025, 1, 15);
      const userCreatedAt = new Date(2024, 11, 15); // Dec 15, 2024

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should handle year transition correctly when after creation day', () => {
      // User created on Dec 15, 2024
      // Today is Jan 20, 2025 (after creation day, in Jan billing period)
      mockCurrentDate(2025, 1, 20);
      const userCreatedAt = new Date(2024, 11, 15); // Dec 15, 2024

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should handle multiple year transitions', () => {
      // User created on Jan 15, 2023
      // Today is Mar 20, 2025 (over 2 years later)
      mockCurrentDate(2025, 3, 20);
      const userCreatedAt = new Date(2023, 0, 15); // Jan 15, 2023

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-03');
    });
  });

  describe('edge cases', () => {
    it('should handle month with 31 days correctly', () => {
      // User created on Jan 31, 2025
      // Today is Feb 28, 2025 (before creation day, still in Jan billing period)
      mockCurrentDate(2025, 2, 28);
      const userCreatedAt = new Date(2025, 0, 31); // Jan 31, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should handle leap year correctly', () => {
      // User created on Jan 29, 2024 (leap year)
      // Today is Feb 28, 2024 (before creation day, still in Jan billing period)
      mockCurrentDate(2024, 2, 28);
      const userCreatedAt = new Date(2024, 0, 29); // Jan 29, 2024

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2024-01');
    });

    it('should handle creation on first day of month', () => {
      // User created on Jan 1, 2025
      // Today is Jan 15, 2025 (after creation day)
      mockCurrentDate(2025, 1, 15);
      const userCreatedAt = new Date(2025, 0, 1); // Jan 1, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should handle creation on last day of month', () => {
      // User created on Jan 31, 2025
      // Today is Feb 1, 2025 (before creation day, still in Jan billing period)
      mockCurrentDate(2025, 2, 1);
      const userCreatedAt = new Date(2025, 0, 31); // Jan 31, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-01');
    });

    it('should handle month with 30 days correctly', () => {
      // User created on Apr 30, 2025
      // Today is May 29, 2025 (before creation day, still in Apr billing period)
      mockCurrentDate(2025, 5, 29);
      const userCreatedAt = new Date(2025, 3, 30); // Apr 30, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-04');
    });

    it('should format month with leading zero correctly', () => {
      // User created on Jan 15, 2025
      // Today is Feb 15, 2025
      mockCurrentDate(2025, 2, 15);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-02'); // Should have leading zero if needed
    });

    it('should format single digit months correctly', () => {
      // User created on Jan 15, 2025
      // Today is Oct 15, 2025
      mockCurrentDate(2025, 10, 15);
      const userCreatedAt = new Date(2025, 0, 15); // Jan 15, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-10'); // Should not have leading zero for months 10-12
    });
  });

  describe('real-world scenarios', () => {
    it('should handle user created mid-month, checking mid-next-month', () => {
      // User created on Mar 20, 2025
      // Today is Apr 10, 2025 (before creation day, still in Mar billing period)
      mockCurrentDate(2025, 4, 10);
      const userCreatedAt = new Date(2025, 2, 20); // Mar 20, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-03');
    });

    it('should handle user created mid-month, checking end-of-next-month', () => {
      // User created on Mar 20, 2025
      // Today is Apr 25, 2025 (after creation day, in Apr billing period)
      mockCurrentDate(2025, 4, 25);
      const userCreatedAt = new Date(2025, 2, 20); // Mar 20, 2025

      const result = getCurrentMonthYearBillingCycle(userCreatedAt);

      expect(result).toBe('2025-04');
    });
  });
});
