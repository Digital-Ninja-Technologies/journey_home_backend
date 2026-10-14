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
