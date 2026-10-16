// Imports ClientSession, Types from mongoose.
import { ClientSession, Types } from "mongoose";
// Imports v4 as uuidv4 from uuid.
import { v4 as uuidv4 } from "uuid";
// Imports addOneMonthPreservingBillingDay from ../../plans/services/date.service.
import { addOneMonthPreservingBillingDay } from "../../plans/services/date.service";
// Imports IPlan, PlanStatus from ../../plans/models/plan.model.
import { IPlan, PlanStatus } from "../../plans/models/plan.model";
// Imports Plan from ../../plans/models/plan.model.
import { Plan } from "../../plans/models/plan.model";
// Imports PaymentPurpose, PaymentStatus from ../../payments/models/payment.model.
import { PaymentPurpose, PaymentStatus } from "../../payments/models/payment.model";
// Imports PaymentService from ../../payments/services/payment.service.
import { PaymentService } from "../../payments/services/payment.service";
// Imports BillingScheduleStatus, IBillingSchedule from ../models/billing-schedule.model.
import { BillingScheduleStatus, IBillingSchedule } from "../models/billing-schedule.model";
// Imports BillingRepository from ../repositories/billing.repository.
import { BillingRepository } from "../repositories/billing.repository";
// Imports BillingPolicyService from ./billing-policy.service.
import { BillingPolicyService } from "./billing-policy.service";
// Imports NotificationEvent from ../../notifications/models/notification.model.
import { NotificationEvent } from "../../notifications/models/notification.model";
// Imports NotificationService from ../../notifications/services/notification.service.
import { NotificationService } from "../../notifications/services/notification.service";

// Declares the service class that groups related application operations.
export class BillingScheduleService {
  // Provides the next part of the surrounding operation.
  private repository = new BillingRepository();
  // Creates the first billing schedule for a plan.
  // Declares a function or method used by this service.
  async createInitialSchedule(plan: IPlan, session?: ClientSession): Promise<IBillingSchedule> {
    // Returns this.repository.createInitialSchedule(plan, session) to the caller.
    return this.repository.createInitialSchedule(plan, session);
  // Closes the current block.
  }

  // Builds a year-month billing cycle key from a date.
  // Calls cycleFor to perform the next step.
  cycleFor(date: Date): string {
    // Returns `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` to the caller.
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  // Closes the current block.
  }

  // Activates a plan billing schedule with its next due date.
  // Declares a function or method used by this service.
  async activateForPlan(planId: Types.ObjectId | string, nextDueDate: Date): Promise<void> {
    // Waits for repository.activateForPlan to finish before continuing.
    await this.repository.activateForPlan(planId, nextDueDate, this.cycleFor(nextDueDate));
  // Closes the current block.
  }

  // Claims billing schedules that are currently due for processing.
  // Declares a function or method used by this service.
  async claimDue(limit = 25): Promise<IBillingSchedule[]> {
    // Provides the next part of the surrounding operation.
    new BillingPolicyService().assertRunnable();
    // Stores the result of Date in now.
    const now = new Date();
    // Stores the result of uuidv4 in leaseOwner.
    const leaseOwner = uuidv4();
    // Stores the result of Date in leaseExpiresAt.
    const leaseExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    // Returns this.repository.claimDue(now, leaseOwner, leaseExpiresAt, limit) to the caller.
    return this.repository.claimDue(now, leaseOwner, leaseExpiresAt, limit);
  // Closes the current block.
  }

  // Processes the currently due billing schedules.
  // Declares a function or method used by this service.
  async processDue(limit = 25): Promise<{ attempted: number }> {
    // Stores the result of this.claimDue in schedules.
    const schedules = await this.claimDue(limit);
    // Stores the result of PaymentService in payments.
    const payments = new PaymentService();
    // Calls for to perform the next step.
    for (const schedule of schedules) {
      // Waits for payments.chargeRecurring to finish before continuing.
      await payments.chargeRecurring(schedule);
    // Closes the current block.
    }
    // Returns { attempted: schedules.length } to the caller.
    return { attempted: schedules.length };
  // Closes the current block.
  }

  // Updates a billing schedule after a successful payment.
  // Declares a function or method used by this service.
  async recordSuccess(schedule: IBillingSchedule, paymentId: Types.ObjectId): Promise<void> {
    // Stores the result of addOneMonthPreservingBillingDay in nextDueDate.
    const nextDueDate = addOneMonthPreservingBillingDay(schedule.nextDueDate);
    // Waits for repository.updateSchedule to finish before continuing.
    await this.repository.updateSchedule(schedule._id, {
        // Declares the $set property with type or value {.
        $set: {
          // Declares the status property with type or value BillingScheduleStatus.ACTIVE,.
          status: BillingScheduleStatus.ACTIVE,
          // Provides the next part of the surrounding operation.
          nextDueDate,
          // Declares the billingCycle property with type or value this.cycleFor(nextDueDate),.
          billingCycle: this.cycleFor(nextDueDate),
          // Declares the currentPaymentAttempt property with type or value paymentId,.
          currentPaymentAttempt: paymentId,
          // Declares the lastSuccessfulPaymentDate property with type or value new Date(),.
          lastSuccessfulPaymentDate: new Date(),
          // Declares the lastAttemptedPaymentDate property with type or value new Date(),.
          lastAttemptedPaymentDate: new Date(),
        // Closes the current block.
        },
        // Declares the $unset property with type or value { leaseOwner: "", leaseExpiresAt: "", gracePeriodStartedAt: "", graceP.
        $unset: { leaseOwner: "", leaseExpiresAt: "", gracePeriodStartedAt: "", gracePeriodDeadline: "", nextRetryDate: "" },
        // Declares the $setOnInsert property with type or value {},.
        $setOnInsert: {},
      // Closes the current block.
      });
  // Closes the current block.
  }

  // Updates retry and plan status after a failed payment.
  // Declares a function or method used by this service.
  async recordFailure(schedule: IBillingSchedule, paymentId: Types.ObjectId): Promise<void> {
    // Stores the result of BillingPolicyService in policy.
    const policy = new BillingPolicyService().assertRunnable();
    // Stores the result of Date in now.
    const now = new Date();
    // Defines retryCount using the value on the right-hand side.
    const retryCount = schedule.retryCount + 1;
    // Stores the result of Math.min in nextInterval.
    const nextInterval = policy.retryIntervalDays[Math.min(retryCount - 1, policy.retryIntervalDays.length - 1)];
    // Defines gracePeriodStartedAt using the value on the right-hand side.
    const gracePeriodStartedAt = schedule.gracePeriodStartedAt || now;
    // Stores the result of Date in gracePeriodDeadline.
    const gracePeriodDeadline = schedule.gracePeriodDeadline || new Date(now.getTime() + policy.gracePeriodDays * 86400000);
    // Defines nextRetryDate using the value on the right-hand side.
    const nextRetryDate = retryCount < policy.maxRetryAttempts
      // Provides the next part of the surrounding operation.
      ? new Date(now.getTime() + nextInterval * 86400000)
      // Provides the next part of the surrounding operation.
      : undefined;
    // Defines overdue using the value on the right-hand side.
    const overdue = now >= gracePeriodDeadline || retryCount >= policy.maxRetryAttempts;

    // Waits for repository.updateSchedule to finish before continuing.
    await this.repository.updateSchedule(schedule._id, {
        // Declares the $set property with type or value {.
        $set: {
          // Declares the status property with type or value overdue ? BillingScheduleStatus.OVERDUE : BillingScheduleStatus.ACTIVE.
          status: overdue ? BillingScheduleStatus.OVERDUE : BillingScheduleStatus.ACTIVE,
          // Declares the currentPaymentAttempt property with type or value paymentId,.
          currentPaymentAttempt: paymentId,
          // Declares the lastAttemptedPaymentDate property with type or value now,.
          lastAttemptedPaymentDate: now,
          // Provides the next part of the surrounding operation.
          retryCount,
          // Provides the next part of the surrounding operation.
          gracePeriodStartedAt,
          // Provides the next part of the surrounding operation.
          gracePeriodDeadline,
          // Provides the next part of the surrounding operation.
          nextRetryDate,
          // Declares the nextDueDate property with type or value nextRetryDate || schedule.nextDueDate,.
          nextDueDate: nextRetryDate || schedule.nextDueDate,
        // Closes the current block.
        },
        // Declares the $unset property with type or value { leaseOwner: "", leaseExpiresAt: "" },.
        $unset: { leaseOwner: "", leaseExpiresAt: "" },
      // Closes the current block.
      });

    // Waits for repository.updatePlanStatus to finish before continuing.
    await this.repository.updatePlanStatus(schedule.plan, overdue ? PlanStatus.OVERDUE : PlanStatus.PAYMENT_DUE);

    // Provides the next part of the surrounding operation.
    await new NotificationService().record(
      // Calls schedule.owner.toString to perform the next step.
      schedule.owner.toString(),
      // Calls schedule.plan.toString to perform the next step.
      schedule.plan.toString(),
      // Provides the next part of the surrounding operation.
      overdue ? NotificationEvent.PAYMENT_OVERDUE : NotificationEvent.GRACE_PERIOD_STARTED,
      // Provides the next part of the surrounding operation.
      `${schedule.plan}:${overdue ? "overdue" : "grace"}:${schedule.billingCycle}`,
    // Provides the next part of the surrounding operation.
    );
  // Closes the current block.
  }
// Closes the current block.
}
