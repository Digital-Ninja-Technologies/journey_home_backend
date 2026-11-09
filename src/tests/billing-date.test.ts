import test from "node:test";
import assert from "node:assert/strict";
import { addOneMonthPreservingBillingDay } from "../modules/plans/services/date.service";

test("monthly billing clamps a 31st start date to shorter months", () => {
  const next = addOneMonthPreservingBillingDay(new Date("2026-01-31T10:00:00.000Z"));

  assert.equal(next.toISOString(), "2026-02-28T10:00:00.000Z");
});

test("monthly billing preserves the intended day when the next month supports it", () => {
  const next = addOneMonthPreservingBillingDay(new Date("2026-03-15T08:30:00.000Z"));

  assert.equal(next.toISOString(), "2026-04-15T08:30:00.000Z");
});

test("monthly billing advances year correctly across December to January", () => {
  const next = addOneMonthPreservingBillingDay(new Date("2026-12-10T12:00:00.000Z"));

  assert.equal(next.toISOString(), "2027-01-10T12:00:00.000Z");
});

test("monthly billing clamps to 29th on leap year February", () => {
  const next = addOneMonthPreservingBillingDay(new Date("2028-01-31T09:00:00.000Z"));

  assert.equal(next.toISOString(), "2028-02-29T09:00:00.000Z");
});
