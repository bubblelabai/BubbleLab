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
