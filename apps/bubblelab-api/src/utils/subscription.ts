// Calculate the next month's reset date based on the user's monthly reset date
export const calculateNextResetDate = (
  originalResetDate: Date | null
): string => {
  if (!originalResetDate) {
    // If no reset date, use next month from today
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString();
  }

  const today = new Date();
  const resetDay = originalResetDate.getDate();

  // Create next reset date starting from current month
  let nextReset = new Date(today.getFullYear(), today.getMonth(), resetDay);

  // If the reset date for this month has already passed, move to next month
  if (nextReset <= today) {
    nextReset = new Date(today.getFullYear(), today.getMonth() + 1, resetDay);
  }

  return nextReset.toISOString();
};

/**
 * Get current month-year string in format 'YYYY-MM'
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get month-year string based on user's created date
 * Calculates the billing period month/year based on months elapsed since user creation
 * The billing period resets each month on the same day as the user was created
 * Format: 'YYYY-MM'
 *
 * Example: User created on Jan 15, 2025
 * - Jan 15 - Feb 14: billing period = "2025-01"
 * - Feb 15 - Mar 14: billing period = "2025-02"
 * - Mar 15 - Apr 14: billing period = "2025-03"
 */
export function getMonthYearFromUserCreatedDate(userCreatedAt: Date): string {
  const now = new Date();
  const createdDate = new Date(userCreatedAt);

  // Calculate months elapsed since user creation
  const yearsDiff = now.getFullYear() - createdDate.getFullYear();
  const monthsDiff = now.getMonth() - createdDate.getMonth();
  let totalMonthsElapsed = yearsDiff * 12 + monthsDiff;

  // If current day is before the creation day, we're still in the previous billing period
  // Example: Created on Jan 15, today is Feb 10 → still in period 0 (Jan billing period)
  // Example: Created on Jan 15, today is Feb 20 → in period 1 (Feb billing period)
  if (now.getDate() < createdDate.getDate()) {
    totalMonthsElapsed -= 1;
  }

  // Calculate the billing period date (created date + months elapsed)
  const billingPeriodDate = new Date(createdDate);
  billingPeriodDate.setMonth(createdDate.getMonth() + totalMonthsElapsed);

  return `${billingPeriodDate.getFullYear()}-${String(billingPeriodDate.getMonth() + 1).padStart(2, '0')}`;
}
