import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { PackageService } from "../../packages/services/package.service";
import { BillingScheduleService } from "../../billing/services/billing-schedule.service";
import { Plan, PlanStatus, IPlan, CoverageStatus } from "../models/plan.model";
import { addOneMonthPreservingBillingDay } from "./date.service";
import { PlanStateService } from "./plan-state.service";

export class PlanService {
  private packages = new PackageService();
  private state = new PlanStateService();

  async create(ownerId: string, dto: any): Promise<IPlan> {
    const pkg = await this.packages.getPackage(dto.packageId, false);
    const snapshot = this.packages.toSnapshot(pkg);
    const startDate = new Date();
    const nextPaymentDate = addOneMonthPreservingBillingDay(startDate);
    const session = await mongoose.startSession();

    try {
      let plan!: IPlan;
      await session.withTransaction(async () => {
        const [created] = await Plan.create(
          [{
            owner: ownerId,
            package: pkg._id,
            packageSnapshot: snapshot,
            coveredPerson: {
              ...dto.coveredPerson,
              dateOfBirth: dto.coveredPerson.dateOfBirth ? new Date(dto.coveredPerson.dateOfBirth) : undefined,
            },
            contributionAmountMinor: snapshot.monthlyContributionMinor,
            currency: snapshot.currency,
            billingFrequency: "monthly",
            startDate,
            nextPaymentDate,
            status: PlanStatus.PENDING,
            coverageStatus: CoverageStatus.PENDING,
          }],
          { session },
        );
        plan = created;
        await new BillingScheduleService().createInitialSchedule(plan, session);
      });
      return plan;
    } finally {
      await session.endSession();
    }
  }

  async listForOwner(ownerId: string): Promise<IPlan[]> {
    return Plan.find({ owner: ownerId }).sort({ createdAt: -1 }).exec();
  }

  async listAll(): Promise<IPlan[]> {
    return Plan.find().sort({ createdAt: -1 }).exec();
  }

  async getForOwner(planId: string, ownerId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id");
    const plan = await Plan.findOne({ _id: planId, owner: ownerId }).exec();
    if (!plan) throw new NotFoundError("Plan not found");
    return plan;
  }

  async getForAdmin(planId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id");
    const plan = await Plan.findById(planId).exec();
    if (!plan) throw new NotFoundError("Plan not found");
    return plan;
  }

  async adminTransition(planId: string, status: PlanStatus): Promise<IPlan> {
    const plan = await this.getForAdmin(planId);
    this.state.assertTransition(plan.status, status);
    plan.status = status;
    await plan.save();
    return plan;
  }
}
