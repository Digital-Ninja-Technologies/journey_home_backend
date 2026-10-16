// Advances a date by one month while preserving its billing day.
// Makes this declaration available to other modules.
export function addOneMonthPreservingBillingDay(from: Date): Date {
  // Stores the result of Date in source.
  const source = new Date(from);
  // Stores the result of source.getUTCDate in intendedDay.
  const intendedDay = source.getUTCDate();
  // Stores the result of source.getUTCMonth in targetMonth.
  const targetMonth = source.getUTCMonth() + 1;
  // Stores the result of source.getUTCFullYear in targetYear.
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  // Defines normalizedMonth using the value on the right-hand side.
  const normalizedMonth = targetMonth % 12;
  // Stores the result of Date in lastDay.
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  // Stores the result of Math.min in day.
  const day = Math.min(intendedDay, lastDay);
  // Returns new Date(Date.UTC( to the caller.
  return new Date(Date.UTC(
    // Provides the next part of the surrounding operation.
    targetYear,
    // Provides the next part of the surrounding operation.
    normalizedMonth,
    // Provides the next part of the surrounding operation.
    day,
    // Calls source.getUTCHours to perform the next step.
    source.getUTCHours(),
    // Calls source.getUTCMinutes to perform the next step.
    source.getUTCMinutes(),
    // Calls source.getUTCSeconds to perform the next step.
    source.getUTCSeconds(),
    // Calls source.getUTCMilliseconds to perform the next step.
    source.getUTCMilliseconds(),
  // Provides the next part of the surrounding operation.
  ));
// Closes the current block.
}
