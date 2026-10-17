import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { PackageService } from "../../packages/services/package.service";
import { BillingScheduleService } from "../../billing/services/billing-schedule.service";
import { PlanStatus, IPlan, CoverageStatus } from "../models/plan.model";
import { PlanRepository } from "../repositories/plan.repository";
import { addOneMonthPreservingBillingDay } from "./date.service";
import { PlanStateService } from "./plan-state.service";

export class PlanService {
  private packages = new PackageService();
  private state = new PlanStateService();
  private repository = new PlanRepository();

  async create(ownerId: string, dto: any): Promise<IPlan> {
    // Load the selected package and capture its terms for this plan.
    const pkg = await this.packages.getPackage(dto.packageId, false);

    const snapshot = this.packages.toSnapshot(pkg);

    // Establish the plan's start date and first monthly payment date.
    const startDate = new Date();
    const nextPaymentDate = addOneMonthPreservingBillingDay(startDate);

    // start transaction for plan creation and billng schedule creation
    const session = await mongoose.startSession();

    try {
      let plan!: IPlan;

      await session.withTransaction(async () => {
        // Create the plan with a snapshot of the package terms
        plan = await this.repository.createWithSession(
          {
            owner: ownerId,
            package: pkg._id,
            packageSnapshot: snapshot,
            coveredPerson: {
              ...dto.coveredPerson,

              dateOfBirth: dto.coveredPerson.dateOfBirth
                ? new Date(dto.coveredPerson.dateOfBirth)
                : undefined,
            },

            contributionAmountMinor: snapshot.monthlyContributionMinor,

            currency: snapshot.currency,

            billingFrequency: "monthly",

            startDate,

            nextPaymentDate,

            status: PlanStatus.PENDING,

            coverageStatus: CoverageStatus.PENDING,
          },
          session,
        );

        // Create the initial billing schedule
        await new BillingScheduleService().createInitialSchedule(plan, session);
      });

      return plan;
    } finally {
      // release the database session
      await session.endSession();
    }
  }

  // Return all plans belonging to a specific owner.
  async listForOwner(ownerId: string): Promise<IPlan[]> {
    return this.repository.listForOwner(ownerId);
  }

  // Return all plans, typically for an administrative view.
  async listAll(): Promise<IPlan[]> {
    return this.repository.listAll();
  }

  async getForOwner(planId: string, ownerId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) {
      throw new BadRequestError("Invalid plan id");
    }

    const plan = await this.repository.findForOwner(planId, ownerId);

    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    return plan;
  }

  async getPlan(planId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) {
      throw new BadRequestError("Invalid plan id");
    }

    const plan = await this.repository.findById(planId);

    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    return plan;
  }

  async adminTransition(planId: string, status: PlanStatus): Promise<IPlan> {
    const plan = await this.getPlan(planId);
    this.state.assertTransition(plan.status, status);

    plan.status = status;
    await this.repository.save(plan);

    return plan;
  }
}
