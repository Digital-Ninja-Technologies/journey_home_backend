import test from "node:test";
import assert from "node:assert/strict";
import { lagosDateKey, addDateKeyDays } from "../modules/subscriptions/services/reminder-cron.service";

test("lagosDateKey formats correctly in Africa/Lagos (UTC+1)", () => {
  // 23:30 UTC on Nov 24 is 00:30 on Nov 25 in Lagos (UTC+1)
  const dateLateUtc = new Date("2026-11-24T23:30:00.000Z");
  assert.equal(lagosDateKey(dateLateUtc), "2026-11-25");

  // 12:00 UTC on Nov 24 is Nov 24 in Lagos
  const dateMidUtc = new Date("2026-11-24T12:00:00.000Z");
  assert.equal(lagosDateKey(dateMidUtc), "2026-11-24");
});

test("addDateKeyDays adds exact calendar days without drift", () => {
  assert.equal(addDateKeyDays("2026-11-24", 7), "2026-12-01");
  assert.equal(addDateKeyDays("2026-11-24", 3), "2026-11-27");
  assert.equal(addDateKeyDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDateKeyDays("2028-02-25", 4), "2028-02-29"); // leap year
});

test("target interval covers exactly 24 hours of Lagos day", () => {
  const targetKey = addDateKeyDays("2026-11-24", 7);
  assert.equal(targetKey, "2026-12-01");

  const start = new Date(`${targetKey}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 86400000);

  // 2026-12-01T00:00:00+01:00 is 2026-11-30T23:00:00Z
  assert.equal(start.toISOString(), "2026-11-30T23:00:00.000Z");
  assert.equal(end.toISOString(), "2026-12-01T23:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 86400000);
});
