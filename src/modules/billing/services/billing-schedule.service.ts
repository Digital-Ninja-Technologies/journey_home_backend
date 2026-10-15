import { ClientSession, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { addOneMonthPreservingBillingDay } from "../../plans/services/date.service";
import { IPlan, PlanStatus } from "../../plans/models/plan.model";
import { Plan } from "../../plans/models/plan.model";
import { PaymentPurpose, PaymentStatus } from "../../payments/models/payment.model";
import { PaymentService } from "../../payments/services/payment.service";
import { BillingScheduleStatus, IBillingSchedule } from "../models/billing-schedule.model";
import { BillingRepository } from "../repositories/billing.repository";
import { BillingPolicyService } from "./billing-policy.service";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";

export class BillingScheduleService {
  private repository = new BillingRepository();
  async createInitialSchedule(plan: IPlan, session?: ClientSession): Promise<IBillingSchedule> {
    return this.repository.createInitialSchedule(plan, session);
  }

  cycleFor(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  async activateForPlan(planId: Types.ObjectId | string, nextDueDate: Date): Promise<void> {
    await this.repository.activateForPlan(planId, nextDueDate, this.cycleFor(nextDueDate));
  }

  async claimDue(limit = 25): Promise<IBillingSchedule[]> {
    new BillingPolicyService().assertRunnable();
    const now = new Date();
    const leaseOwner = uuidv4();
    const leaseExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    return this.repository.claimDue(now, leaseOwner, leaseExpiresAt, limit);
  }

  async processDue(limit = 25): Promise<{ attempted: number }> {
    const schedules = await this.claimDue(limit);
    const payments = new PaymentService();
    for (const schedule of schedules) {
      await payments.chargeRecurring(schedule);
    }
    return { attempted: schedules.length };
  }

  async recordSuccess(schedule: IBillingSchedule, paymentId: Types.ObjectId): Promise<void> {
    const nextDueDate = addOneMonthPreservingBillingDay(schedule.nextDueDate);
    await this.repository.updateSchedule(schedule._id, {
        $set: {
          status: BillingScheduleStatus.ACTIVE,
          nextDueDate,
          billingCycle: this.cycleFor(nextDueDate),
          currentPaymentAttempt: paymentId,
          lastSuccessfulPaymentDate: new Date(),
          lastAttemptedPaymentDate: new Date(),
        },
        $unset: { leaseOwner: "", leaseExpiresAt: "", gracePeriodStartedAt: "", gracePeriodDeadline: "", nextRetryDate: "" },
        $setOnInsert: {},
      });
  }

  async recordFailure(schedule: IBillingSchedule, paymentId: Types.ObjectId): Promise<void> {
    const policy = new BillingPolicyService().assertRunnable();
    const now = new Date();
    const retryCount = schedule.retryCount + 1;
    const nextInterval = policy.retryIntervalDays[Math.min(retryCount - 1, policy.retryIntervalDays.length - 1)];
    const gracePeriodStartedAt = schedule.gracePeriodStartedAt || now;
    const gracePeriodDeadline = schedule.gracePeriodDeadline || new Date(now.getTime() + policy.gracePeriodDays * 86400000);
    const nextRetryDate = retryCount < policy.maxRetryAttempts
      ? new Date(now.getTime() + nextInterval * 86400000)
      : undefined;
    const overdue = now >= gracePeriodDeadline || retryCount >= policy.maxRetryAttempts;

    await this.repository.updateSchedule(schedule._id, {
        $set: {
          status: overdue ? BillingScheduleStatus.OVERDUE : BillingScheduleStatus.ACTIVE,
          currentPaymentAttempt: paymentId,
          lastAttemptedPaymentDate: now,
          retryCount,
          gracePeriodStartedAt,
          gracePeriodDeadline,
          nextRetryDate,
          nextDueDate: nextRetryDate || schedule.nextDueDate,
        },
        $unset: { leaseOwner: "", leaseExpiresAt: "" },
      });

    await this.repository.updatePlanStatus(schedule.plan, overdue ? PlanStatus.OVERDUE : PlanStatus.PAYMENT_DUE);

    await new NotificationService().record(
      schedule.owner.toString(),
      schedule.plan.toString(),
      overdue ? NotificationEvent.PAYMENT_OVERDUE : NotificationEvent.GRACE_PERIOD_STARTED,
      `${schedule.plan}:${overdue ? "overdue" : "grace"}:${schedule.billingCycle}`,
    );
  }
}
