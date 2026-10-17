// Advances a date by one month while preserving its billing day.
export function addOneMonthPreservingBillingDay(from: Date): Date {
  // Stores the result of Date in source.
  const source = new Date(from);

  // get te day
  const intendedDay = source.getUTCDate();
  const targetMonth = source.getUTCMonth() + 1;
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(intendedDay, lastDay);
  
  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    day,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
}
