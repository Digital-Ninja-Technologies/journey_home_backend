import { ClientSession, Types } from "mongoose";
import {
  BillingSchedule,
  BillingScheduleStatus,
  IBillingSchedule,
} from "../models/billing-schedule.model";
import { IPlan, Plan, PlanStatus } from "../../plans/models/plan.model";

export class BillingRepository {

  async createInitialSchedule(
    plan: IPlan,
    session?: ClientSession,
  ): Promise<IBillingSchedule> {

    const [schedule] = await BillingSchedule.create(
      [
        {
          plan: plan._id,
          owner: plan.owner,
          nextDueDate: plan.nextPaymentDate,
          billingFrequency: "monthly",
          status: BillingScheduleStatus.PAUSED,
          retryCount: 0,
          billingCycle: `${plan.nextPaymentDate.getUTCFullYear()}-${String(plan.nextPaymentDate.getUTCMonth() + 1).padStart(2, "0")}`,
        },
      ],
      { session },
    );
    return schedule;
  }

  activateForPlan(
    planId: Types.ObjectId | string,
    nextDueDate: Date,
    billingCycle: string,
  ) {

    return BillingSchedule.updateOne(
      { plan: planId },

      {
        $set: {
          status: BillingScheduleStatus.ACTIVE,
          nextDueDate,
          billingCycle,
          retryCount: 0,
          gracePeriodStartedAt: undefined,
          gracePeriodDeadline: undefined,
          nextRetryDate: undefined,
        },
      },
    ).exec();
  }

  async claimDue(
    now: Date,
    leaseOwner: string,
    leaseExpiresAt: Date,
    limit: number,
  ): Promise<IBillingSchedule[]> {

    const due = await BillingSchedule.find({

      status: {
        $in: [BillingScheduleStatus.ACTIVE, BillingScheduleStatus.OVERDUE],
      },
      nextDueDate: { $lte: now },
      $or: [
        { leaseExpiresAt: { $exists: false } },
        { leaseExpiresAt: { $lte: now } },
      ],
    })
      
      .limit(limit)
      .exec();
    
    const claimed: IBillingSchedule[] = [];

    for (const schedule of due) {
      const result = await BillingSchedule.updateOne(
        {
          _id: schedule._id,
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            leaseOwner,
            leaseExpiresAt,
            status: BillingScheduleStatus.PROCESSING,
          },
        },
      ).exec();
      
      if (result.modifiedCount === 1) claimed.push(schedule);
    }
    return claimed;
  }

  updateSchedule(id: Types.ObjectId, update: Record<string, unknown>) {
    return BillingSchedule.updateOne({ _id: id }, update).exec();
  }

  updatePlanStatus(id: Types.ObjectId, status: PlanStatus) {
    return Plan.updateOne({ _id: id }, { $set: { status } }).exec();
  }
}
