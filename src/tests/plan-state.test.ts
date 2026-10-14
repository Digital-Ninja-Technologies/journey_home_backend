import test from "node:test";
import assert from "node:assert/strict";
import { PlanStatus } from "../modules/plans/models/plan.model";
import { PlanStateService } from "../modules/plans/services/plan-state.service";

test("plan activation can only happen from pending through verified payment flow", () => {
  const service = new PlanStateService();

  assert.doesNotThrow(() => service.assertTransition(PlanStatus.PENDING, PlanStatus.ACTIVE));
  assert.throws(() => service.assertTransition(PlanStatus.CANCELLED, PlanStatus.ACTIVE));
});

test("completed plans are terminal", () => {
  const service = new PlanStateService();

  assert.throws(() => service.assertTransition(PlanStatus.COMPLETED, PlanStatus.CANCELLED));
});
