### Billing Date scheduler


// /**
//  * Advances a scheduled billing date by one calendar month.
//  *
//  * Preserves the original day of the month when possible. If the target
//  * month does not contain that day (e.g. January 31 → February 28),
//  * uses the last day of the target month instead.
//  *
//  * Important: Pass the scheduled billing date, not the date a payment
//  * retry succeeds. This prevents retries from shifting the billing schedule.
//  */
// export function addOneMonthPreservingBillingDay(from: Date): Date {
//   // Create a separate Date object so we don't accidentally modify
//   // the original date passed into the function.
//   const source = new Date(from);

//   // Remember the original day of the month (1–31).
//   // We'll preserve this day unless the target month is shorter.
//   const intendedDay = source.getUTCDate();

//   // JavaScript months are zero-indexed (January = 0, December = 11).
//   // Add 1 to move to the next calendar month.
//   // This may become 12 when the original month is December.
//   const targetMonth = source.getUTCMonth() + 1;

//   // Advance the year only when the target month crosses into a new year.
//   // Math.floor(12 / 12) = 1 for December → January;
//   // for all other months, Math.floor(targetMonth / 12) = 0.
//   const targetYear =
//     source.getUTCFullYear() + Math.floor(targetMonth / 12);

//   // Convert the target month back to JavaScript's zero-based format.
//   // The remainder operator turns 12 into 0, representing January.
//   const normalizedMonth = targetMonth % 12;

//   // Find the last valid day of the target month.
//   // Passing day 0 means the day before the first of the specified month.
//   // By using the month AFTER our target month, day 0 gives us the
//   // final day of our target month (e.g. March 0 = February 28 or 29).
//   const lastDay = new Date(
//     Date.UTC(targetYear, normalizedMonth + 1, 0)
//   ).getUTCDate();

//   // Use the original billing day if it exists in the target month.
//   // Otherwise, use the month's last day to prevent overflow into
//   // the following month (e.g. January 31 → February 28).
//   const day = Math.min(intendedDay, lastDay);

//   // Build and return the new billing date in UTC.
//   // Preserve the original time so the billing time doesn't reset
//   // to midnight when the date advances.
//   return new Date(Date.UTC(
//     targetYear,                     // Year of the next billing date
//     normalizedMonth,                // Zero-based month of the next billing date
//     day,                            // Valid billing day in that month
//     source.getUTCHours(),           // Preserve the original hour
//     source.getUTCMinutes(),         // Preserve the original minutes
//     source.getUTCSeconds(),         // Preserve the original seconds
//     source.getUTCMilliseconds(),    // Preserve the original milliseconds
//   ));
// }



